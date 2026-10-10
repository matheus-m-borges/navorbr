/**
 * NAVOR Core — ProvisioningService
 *
 * Orquestra o fluxo completo de provisionamento SaaS:
 * Account → Subscription → Entitlements → S2S Provisioning (BarberHub V2, LawHub, etc.)
 *
 * SEGURANÇA:
 * - Todas as operações são server-side apenas.
 * - Idempotência garantida por provisioning_events.
 * - Falhas são registradas e podem ser retentadas.
 * - Isolamento multi-tenant estrito em todas as consultas.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { provisionBarberHubAccount } from "./barberhub-provisioner";

export type ProvisioningTarget = "barberhub" | "lawhub" | "rephub" | "enghub" | "pethub";

export interface ProvisioningRequest {
  accountId: string;
  subscriptionId: string;
  productSlug: ProvisioningTarget;
  planId: string;
  adminUserId: string;
  adminEmail: string;
  companyName: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisioningResult {
  success: boolean;
  provisioningEventId: string;
  targetAccountId?: string;
  error?: string;
}

/**
 * Executa o provisionamento completo de uma conta SaaS.
 * Idempotente: se já existir um evento de provisionamento bem-sucedido
 * para esta subscription, retorna o resultado anterior sem re-executar.
 */
export async function provisionAccount(
  request: ProvisioningRequest
): Promise<ProvisioningResult> {
  const supabase = supabaseAdmin;

  // 1. Verificar idempotência
  const { data: existingEvent } = await supabase
    .from("provisioning_events")
    .select("id, status, target_account_id, error_message")
    .eq("subscription_id", request.subscriptionId)
    .eq("product_slug", request.productSlug)
    .eq("status", "completed")
    .maybeSingle();

  if (existingEvent) {
    console.log(`[ProvisioningService] Provisionamento já concluído para subscription ${request.subscriptionId}`);
    return {
      success: true,
      provisioningEventId: existingEvent.id,
      targetAccountId: existingEvent.target_account_id ?? undefined,
    };
  }

  // 2. Criar evento de provisionamento como 'processing'
  const { data: newEvent, error: insertError } = await supabase
    .from("provisioning_events")
    .insert({
      account_id: request.accountId,
      subscription_id: request.subscriptionId,
      product_slug: request.productSlug,
      plan_id: request.planId,
      admin_user_id: request.adminUserId,
      status: "processing",
      request_payload: request.metadata ?? {},
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      console.log(`[ProvisioningService] Provisionamento duplicado detectado para subscription ${request.subscriptionId}`);
      const { data: concurrentEvent } = await supabase
        .from("provisioning_events")
        .select("id, status, target_account_id")
        .eq("subscription_id", request.subscriptionId)
        .eq("product_slug", request.productSlug)
        .maybeSingle();

      return {
        success: concurrentEvent?.status === "completed",
        provisioningEventId: concurrentEvent?.id ?? "",
        targetAccountId: concurrentEvent?.target_account_id ?? undefined,
        error: concurrentEvent?.status !== "completed" ? "Concurrent provisioning in progress" : undefined,
      };
    }
    console.error("[ProvisioningService] Erro ao criar evento:", insertError.message);
    return { success: false, provisioningEventId: "", error: insertError.message };
  }

  const eventId = newEvent.id;

  try {
    let targetAccountId: string | undefined;

    switch (request.productSlug) {
      case "barberhub":
        targetAccountId = await provisionBarberHubAccount({
          coreAccountId: request.accountId,
          adminUserId: request.adminUserId,
          adminEmail: request.adminEmail,
          companyName: request.companyName,
          planId: request.planId,
        });
        break;

      case "lawhub":
      case "rephub":
      case "enghub":
      case "pethub":
        console.warn(`[ProvisioningService] Provisioner para ${request.productSlug} ainda não implementado.`);
        throw new Error(`Provisioner para ${request.productSlug} não está disponível.`);

      default:
        throw new Error(`Produto desconhecido: ${request.productSlug}`);
    }

    await supabase
      .from("provisioning_events")
      .update({
        status: "completed",
        target_account_id: targetAccountId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    console.log(`[ProvisioningService] Provisionamento concluído: ${request.productSlug} → ${targetAccountId}`);
    return { success: true, provisioningEventId: eventId, targetAccountId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[ProvisioningService] Falha no provisionamento:`, errorMessage);

    await supabase
      .from("provisioning_events")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    return { success: false, provisioningEventId: eventId, error: errorMessage };
  }
}

/**
 * Lista eventos de provisionamento de uma conta com isolamento tenant.
 */
export async function listProvisioningEvents(accountId: string) {
  const supabase = supabaseAdmin;
  const { data, error } = await supabase
    .from("provisioning_events")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

