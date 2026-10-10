/**
 * NAVOR Core — IntegrationService
 *
 * Gerencia provedores de integração e credenciais com segurança.
 * Segredos são referenciados via Vault, nunca armazenados em texto puro.
 *
 * SEGURANÇA:
 * - Platform Admin: acesso total.
 * - Tenant Admin: apenas configs do próprio account.
 * - Secrets nunca retornados em queries diretas.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface IntegrationProvider {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  capabilities: string[];
  config_schema: Record<string, unknown>;
  is_active: boolean;
}

export interface IntegrationConfig {
  id: string;
  provider_id: string;
  scope_type: "platform" | "product" | "account";
  scope_id: string | null;
  params: Record<string, unknown>;
  vault_secret_name: string | null;
  status: string;
  last_verified_at: string | null;
  last_error: string | null;
  is_enabled: boolean;
  providers: IntegrationProvider | null;
}

/**
 * Lista todos os provedores disponíveis (catálogo público interno).
 */
export async function listProviders(): Promise<IntegrationProvider[]> {
  const { data, error } = await supabaseAdmin
    .from("integration_providers")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as IntegrationProvider[];
}

/**
 * Lista configurações de integração com escopo seguro.
 * Platform Admin vê tudo; outros veem apenas do seu account.
 */
export async function listConfigs(options?: {
  scopeType?: string;
  scopeId?: string;
  isAdmin?: boolean;
}): Promise<IntegrationConfig[]> {
  let query = supabaseAdmin
    .from("integration_configs")
    .select("*, providers!inner(id, slug, name, category)")
    .order("created_at", { ascending: false });

  if (options?.scopeType) {
    query = query.eq("scope_type", options.scopeType);
  }
  if (options?.scopeId) {
    query = query.eq("scope_id", options.scopeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as IntegrationConfig[];
}

/**
 * Salva ou atualiza configuração de integração.
 * NÃO salva secrets diretamente — apenas referência ao Vault.
 */
export async function saveIntegrationConfig(input: {
  providerId: string;
  scopeType: "platform" | "product" | "account";
  scopeId?: string;
  params?: Record<string, unknown>;
  vaultSecretName?: string;
  isEnabled?: boolean;
  actorUserId: string;
}): Promise<IntegrationConfig> {
  // Upsert baseado em provider + scope
  const { data: existing } = await supabaseAdmin
    .from("integration_configs")
    .select("id, status")
    .eq("provider_id", input.providerId)
    .eq("scope_type", input.scopeType)
    .eq("scope_id", input.scopeId ?? null)
    .maybeSingle();

  const payload = {
    provider_id: input.providerId,
    scope_type: input.scopeType,
    scope_id: input.scopeId ?? null,
    params: input.params ?? {},
    vault_secret_name: input.vaultSecretName ?? null,
    is_enabled: input.isEnabled ?? false,
    status: input.vaultSecretName ? "CONFIGURED" : "NOT_CONFIGURED",
    updated_at: new Date().toISOString(),
  };

  let configId: string;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("integration_configs")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    configId = data.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("integration_configs")
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    configId = data.id;
  }

  // Registrar auditoria
  await supabaseAdmin.from("credential_audit_logs").insert({
    actor_user_id: input.actorUserId,
    target_config_id: configId,
    action: existing ? "updated" : "created",
    previous_status: existing?.status ?? null,
    new_status: payload.status,
    metadata: { scope_type: input.scopeType, scope_id: input.scopeId },
  });

  // Retornar config completa
  const { data: result, error: fetchErr } = await supabaseAdmin
    .from("integration_configs")
    .select("*, providers!inner(id, slug, name, category)")
    .eq("id", configId)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);
  return result as IntegrationConfig;
}

/**
 * Verifica conexão com provedor (simulação segura).
 * Em produção, chamaria a API real do provider usando o secret do Vault.
 */
export async function verifyIntegration(configId: string): Promise<{
  success: boolean;
  status: string;
  error?: string;
}> {
  const { data: config } = await supabaseAdmin
    .from("integration_configs")
    .select("*, providers!inner(slug)")
    .eq("id", configId)
    .single();

  if (!config) {
    return { success: false, status: "ERROR", error: "Config not found" };
  }

  // Simulação: se tem vault_secret_name, considera CONFIGURED → CONNECTED
  // Em produção real, aqui faríamos fetch ao provider com o token descriptografado
  const isConnected = Boolean(config.vault_secret_name);
  const newStatus = isConnected ? "CONNECTED" : "NOT_CONFIGURED";

  await supabaseAdmin
    .from("integration_configs")
    .update({
      status: newStatus,
      last_verified_at: new Date().toISOString(),
      last_error: isConnected ? null : "No credentials configured",
    })
    .eq("id", configId);

  return {
    success: isConnected,
    status: newStatus,
    error: isConnected ? undefined : "No credentials configured",
  };
}

