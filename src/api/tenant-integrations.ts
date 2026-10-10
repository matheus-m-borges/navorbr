import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTenantSecret, getTenantSecretStatus, putTenantSecret } from "@/lib/security/tenant-secret-vault.server";

type OperationalConfigInput = {
  botName?: string; welcomeMessage?: string; outOfHoursMessage?: string; startTime?: string; endTime?: string;
  businessDays?: number[]; aiEnabled?: boolean; aiAutoCreateLeads?: boolean; aiCustomPrompt?: string;
  receptionMode?: "bot" | "ai" | "hybrid" | "human"; leadRule?: "instant" | "qualified" | "manual"; botMenuText?: string;
};

type CampaignInput = {
  id?: string; code?: string; actionType?: string; areaDireito?: string; description?: string; active?: boolean;
};

const defaultCallCenterDepartments = [
  { slug: "comercial", name: "Comercial / Novos Casos", description: "Triagem de novos clientes e intake inicial", color: "#2563eb" },
  { slug: "trabalhista", name: "Jurídico Trabalhista", description: "Reclamatórias e verbas trabalhistas", color: "#4f46e5" },
  { slug: "civel", name: "Jurídico Cível & Contratos", description: "Indenizações, contratos e direito imobiliário", color: "#7c3aed" },
  { slug: "previdenciario", name: "Jurídico Previdenciário", description: "Benefícios INSS, aposentadorias e revisões", color: "#059669" },
  { slug: "financeiro", name: "Financeiro & Honorários", description: "Cobranças, boletos e prestação de contas", color: "#d97706" },
];

async function ensureDefaultCallCenterTopology(accountId: string) {
  const rows = defaultCallCenterDepartments.map((department, position) => ({
    account_id: accountId, ...department, icon: "Briefcase", is_active: true, position,
  }));
  const { data: departments, error } = await (supabaseAdmin as any)
    .from("law_atendimento_departments")
    .upsert(rows, { onConflict: "account_id,slug" })
    .select("id,name");
  if (error) throw new Error(`Não foi possível preparar os setores do CallCenter: ${error.message}`);
  const queues = (departments || []).map((department: { id: string; name: string }) => ({
    account_id: accountId, department_id: department.id, name: `Fila ${department.name}`, sla_minutes: 15, is_active: true,
  }));
  if (queues.length) {
    const { data: existing, error: queueReadError } = await (supabaseAdmin as any).from("law_atendimento_queues")
      .select("department_id").eq("account_id", accountId);
    if (queueReadError) throw new Error(`Não foi possível preparar as filas do CallCenter: ${queueReadError.message}`);
    const existingDepartmentIds = new Set((existing || []).map((item: { department_id: string }) => item.department_id));
    const missingQueues = queues.filter((queue: { department_id: string }) => !existingDepartmentIds.has(queue.department_id));
    if (missingQueues.length) {
      const { error: queueError } = await (supabaseAdmin as any).from("law_atendimento_queues").insert(missingQueues);
      if (queueError) throw new Error(`Não foi possível criar as filas do CallCenter: ${queueError.message}`);
    }
  }
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

async function tenantAdmin(userId: string) {
  const { requireTenantAdmin } = await import("@/lib/security/authorization.server");
  return requireTenantAdmin(userId);
}

async function verifyMetaCredential(token: string, phoneNumberId: string) {
  const response = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || "v21.0"}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || "A Meta recusou a credencial. Confira o token e o Phone Number ID.");
  }
  return body as { display_phone_number?: string; quality_rating?: string };
}

export const getMetaWhatsAppIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { accountId } = await tenantAdmin(context.userId);
    const [{ data: account, error }, secret] = await Promise.all([
      (supabaseAdmin as any).from("law_whatsapp_accounts")
        .select("phone_number,display_phone_number,waba_id,phone_number_id,status,quality_rating,last_synced_at,updated_at")
        .eq("account_id", accountId).maybeSingle(),
      getTenantSecretStatus(accountId, "meta_whatsapp"),
    ]);
    if (error) throw new Error(`Não foi possível carregar a conexão Meta: ${error.message}`);
    return {
      configured: Boolean(secret),
      tokenLastFour: secret?.last_four || null,
      tokenStatus: secret?.status || "not_configured",
      verifiedAt: secret?.verified_at || null,
      updatedAt: secret?.updated_at || null,
      account: account || null,
    };
  });

export const saveMetaWhatsAppIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string; phoneNumberId: string; wabaId: string; accessToken: string }) => ({
    phoneNumber: String(input?.phoneNumber || "").trim(),
    phoneNumberId: String(input?.phoneNumberId || "").trim(),
    wabaId: String(input?.wabaId || "").trim(),
    accessToken: String(input?.accessToken || "").trim(),
  }))
  .handler(async ({ data, context }) => {
    const { accountId } = await tenantAdmin(context.userId);
    if (!normalizePhone(data.phoneNumber) || !/^\d{8,}$/.test(data.phoneNumberId) || !/^\d{8,}$/.test(data.wabaId)) {
      throw new Error("Informe número, Phone Number ID e WABA ID válidos.");
    }
    if (data.accessToken.length < 20) throw new Error("Informe um token permanente válido da Meta.");

    // Testa antes de gravar: um token inválido nunca substitui o já funcional.
    const meta = await verifyMetaCredential(data.accessToken, data.phoneNumberId);
    const verifiedAt = new Date().toISOString();
    await putTenantSecret({ accountId, integration: "meta_whatsapp", value: data.accessToken, userId: context.userId, status: "verified", verifiedAt });

    const { error } = await (supabaseAdmin as any).from("law_whatsapp_accounts").upsert({
      account_id: accountId,
      phone_number: `+${normalizePhone(data.phoneNumber)}`,
      display_phone_number: meta.display_phone_number || data.phoneNumber,
      waba_id: data.wabaId,
      phone_number_id: data.phoneNumberId,
      // O campo legado jamais recebe token novo; a chave está no cofre.
      access_token_encrypted: null,
      status: "connected",
      quality_rating: meta.quality_rating || "UNKNOWN",
      last_synced_at: verifiedAt,
      updated_at: verifiedAt,
    }, { onConflict: "account_id" });
    if (error) throw new Error(`Não foi possível salvar a conexão Meta: ${error.message}`);

    await (supabaseAdmin as any).from("law_atendimento_audit_logs").insert({
      account_id: accountId,
      user_id: context.userId,
      action: "meta_credential_replaced",
      details: { phone_number_id: data.phoneNumberId, waba_id: data.wabaId, verified: true },
    });
    return { success: true, displayPhoneNumber: meta.display_phone_number || data.phoneNumber, verifiedAt };
  });

export const testStoredMetaWhatsAppIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { accountId } = await tenantAdmin(context.userId);
    const [{ data: account }, token] = await Promise.all([
      (supabaseAdmin as any).from("law_whatsapp_accounts")
        .select("phone_number_id,waba_id,display_phone_number,quality_rating")
        .eq("account_id", accountId).maybeSingle(),
      getTenantSecret(accountId, "meta_whatsapp"),
    ]);
    if (!account?.phone_number_id || !token) throw new Error("Nenhuma credencial Meta segura foi configurada para este escritório.");
    const meta = await verifyMetaCredential(token, account.phone_number_id);
    const verifiedAt = new Date().toISOString();
    await (supabaseAdmin as any).from("tenant_integration_secrets")
      .update({ status: "verified", verified_at: verifiedAt, last_error_code: null, updated_by: context.userId })
      .eq("account_id", accountId).eq("integration", "meta_whatsapp");
    await (supabaseAdmin as any).from("law_whatsapp_accounts")
      .update({ status: "connected", quality_rating: meta.quality_rating || "UNKNOWN", last_synced_at: verifiedAt })
      .eq("account_id", accountId);
    return {
      success: true,
      displayPhoneNumber: meta.display_phone_number || account.display_phone_number || null,
      qualityRating: meta.quality_rating || account.quality_rating || "UNKNOWN",
      verifiedAt,
      checks: {
        credential: true,
        phoneNumber: Boolean(account.phone_number_id),
        waba: Boolean(account.waba_id),
        metaApi: true,
        webhookVerification: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
        webhookSignature: Boolean(process.env.WHATSAPP_WEBHOOK_SECRET),
      },
    };
  });

/** Configuração que comanda o webhook, isolada por escritório. */
export const saveCallCenterOperationalConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OperationalConfigInput) => input || {})
  .handler(async ({ data, context }) => {
    const { accountId } = await tenantAdmin(context.userId);
    const payload = {
      account_id: accountId,
      bot_name: String(data.botName || "Assistente Jurídica").slice(0, 120),
      welcome_message: String(data.welcomeMessage || "").slice(0, 4000),
      out_of_hours_message: String(data.outOfHoursMessage || "").slice(0, 4000),
      business_hours_start: /^\d{2}:\d{2}/.test(data.startTime || "") ? data.startTime : "08:00",
      business_hours_end: /^\d{2}:\d{2}/.test(data.endTime || "") ? data.endTime : "18:00",
      business_days: Array.isArray(data.businessDays) ? data.businessDays.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7) : [1,2,3,4,5],
      ai_enabled: data.aiEnabled !== false,
      ai_auto_create_leads: data.aiAutoCreateLeads !== false,
      ai_system_prompt: String(data.aiCustomPrompt || "").slice(0, 12000) || null,
      reception_mode: ["bot","ai","hybrid","human"].includes(data.receptionMode || "") ? data.receptionMode : "hybrid",
      lead_rule: ["instant","qualified","manual"].includes(data.leadRule || "") ? data.leadRule : "qualified",
      bot_menu_text: String(data.botMenuText || "").slice(0, 4000) || null,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabaseAdmin as any).from("law_atendimento_settings").upsert(payload, { onConflict: "account_id" });
    if (error) throw new Error(`Não foi possível salvar as configurações operacionais: ${error.message}`);
    await ensureDefaultCallCenterTopology(accountId);
    return { success: true };
  });

/** Configuração carregada do servidor; o navegador não é a fonte operacional. */
export const getCallCenterOperationalConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { accountId } = await tenantAdmin(context.userId);
    const [{ data: settings, error: settingsError }, { data: campaigns, error: campaignsError }] = await Promise.all([
      (supabaseAdmin as any).from("law_atendimento_settings").select("*").eq("account_id", accountId).maybeSingle(),
      (supabaseAdmin as any).from("law_atendimento_campaign_codes").select("id,code,action_type,area_direito,description,active,created_at").eq("account_id", accountId).order("created_at"),
    ]);
    if (settingsError) throw new Error(`Não foi possível carregar as configurações operacionais: ${settingsError.message}`);
    if (campaignsError) throw new Error(`Não foi possível carregar as campanhas: ${campaignsError.message}`);
    return { settings: settings || null, campaigns: campaigns || [] };
  });

export const saveCallCenterCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CampaignInput) => input || {})
  .handler(async ({ data, context }) => {
    const { accountId } = await tenantAdmin(context.userId);
    const code = String(data.code || "").trim().toUpperCase();
    const actionType = String(data.actionType || "").trim();
    if (!code || !actionType) throw new Error("Informe o código e a ação jurídica da campanha.");
    const payload = { account_id: accountId, code: code.slice(0, 80), action_type: actionType.slice(0, 240), area_direito: String(data.areaDireito || "Geral").slice(0, 120), description: String(data.description || "").slice(0, 1000) || null, active: data.active !== false };
    const query = (supabaseAdmin as any).from("law_atendimento_campaign_codes");
    const { data: campaign, error } = data.id
      ? await query.update(payload).eq("id", data.id).eq("account_id", accountId).select("id,code,action_type,area_direito,description,active,created_at").single()
      : await query.upsert(payload, { onConflict: "account_id,code" }).select("id,code,action_type,area_direito,description,active,created_at").single();
    if (error) throw new Error(`Não foi possível salvar a campanha: ${error.message}`);
    return campaign;
  });

export const deleteCallCenterCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string }) => ({ id: String(input?.id || "") }))
  .handler(async ({ data, context }) => {
    const { accountId } = await tenantAdmin(context.userId);
    if (!data.id) throw new Error("Campanha inválida.");
    const { error } = await (supabaseAdmin as any).from("law_atendimento_campaign_codes").delete().eq("id", data.id).eq("account_id", accountId);
    if (error) throw new Error(`Não foi possível remover a campanha: ${error.message}`);
    return { success: true };
  });
