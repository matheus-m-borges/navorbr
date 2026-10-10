// ============================================================================
// NAVOR CORE — ONBOARDING SERVICE (Cadeira 4.3)
// Authoritative backend operations for account and product onboarding state
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireTenantAdmin } from "@/lib/security/authorization.server";
import { createNotificationEvent } from "@/core/notifications/event-store";

export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "blocked" | "failed";

export interface CompanyProfileData {
  trade_name?: string;
  legal_name?: string;
  document?: string;
  commercial_phone?: string;
  commercial_email?: string;
  address_line1?: string;
  address_line2?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
  logo_url?: string;
  owner_user_id?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  preferences?: Record<string, unknown>;
}

async function emitOnboardingEvent(params: {
  eventType: string;
  accountId: string;
  userId: string;
  source: string;
  sourceId: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createNotificationEvent({
      eventType: params.eventType as any,
      accountId: params.accountId,
      userId: params.userId,
      source: params.source,
      sourceId: params.sourceId,
      payload: params.payload,
    });
  } catch (err) {
    console.error(`[Onboarding] Failed to emit ${params.eventType}:`, err);
  }
}

/**
 * Get consolidated onboarding state for the current account.
 */
export const serverGetOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("account_members")
      .select("account_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberError || !membership) {
      return { ok: false, error: "ACCOUNT_NOT_FOUND", message: "Nenhuma conta associada ao usuário." };
    }

    const accountId = membership.account_id;
    const { data, error } = await supabaseAdmin.rpc("get_onboarding_state", { p_account_id: accountId });

    if (error) {
      console.error("[onboarding] Failed to get state:", error);
      return { ok: false, error: "INTERNAL_ERROR", message: error.message };
    }

    return { ok: true, accountId, state: data };
  });

/**
 * Update account onboarding progress (step, status).
 */
export const serverUpdateOnboardingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: OnboardingStatus; current_step?: string; metadata?: Record<string, unknown> }) => data)
  .handler(async ({ data, context }) => {
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("account_members")
      .select("account_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberError || !membership) {
      return { ok: false, error: "ACCOUNT_NOT_FOUND" };
    }

    const accountId = membership.account_id;
    const { data: result, error } = await supabaseAdmin.rpc("upsert_account_onboarding", {
      p_account_id: accountId,
      p_status: data.status ?? null,
      p_current_step: data.current_step ?? null,
      p_metadata: data.metadata ?? null,
    });

    if (error) {
      console.error("[onboarding] Progress update failed:", error);
      return { ok: false, error: "UPDATE_FAILED", message: error.message };
    }

    if (data.status === "in_progress") {
      await emitOnboardingEvent({
        eventType: "ONBOARDING_STARTED",
        accountId,
        userId: context.userId,
        source: "onboarding_progress",
        sourceId: `${accountId}_${Date.now()}`,
        payload: { step: data.current_step },
      });
    } else if (data.status === "blocked") {
      await emitOnboardingEvent({
        eventType: "ONBOARDING_BLOCKED",
        accountId,
        userId: context.userId,
        source: "onboarding_progress",
        sourceId: `${accountId}_${Date.now()}`,
        payload: { step: data.current_step, metadata: data.metadata },
      });
    } else if (data.status === "failed") {
      await emitOnboardingEvent({
        eventType: "ONBOARDING_FAILED",
        accountId,
        userId: context.userId,
        source: "onboarding_progress",
        sourceId: `${accountId}_${Date.now()}`,
        payload: { step: data.current_step, metadata: data.metadata },
      });
    }

    return { ok: true, ...result };
  });

/**
 * Upsert company profile data during onboarding.
 */
export const serverUpsertCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CompanyProfileData) => data)
  .handler(async ({ data, context }) => {
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("account_members")
      .select("account_id, role")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberError || !membership) {
      return { ok: false, error: "ACCOUNT_NOT_FOUND" };
    }

    const accountId = membership.account_id;

    if (membership.role !== "admin" && membership.role !== "owner") {
      return { ok: false, error: "ACCESS_DENIED", message: "Apenas administradores podem editar o perfil da empresa." };
    }

    const { data: result, error } = await supabaseAdmin.rpc("upsert_company_profile", {
      p_account_id: accountId,
      p_data: data as any,
    });

    if (error) {
      console.error("[onboarding] Company profile upsert failed:", error);
      return { ok: false, error: "UPDATE_FAILED", message: error.message };
    }

    return { ok: true, ...result };
  });

/**
 * Complete onboarding for the current account.
 */
export const serverCompleteOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("account_members")
      .select("account_id, role")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberError || !membership) {
      return { ok: false, error: "ACCOUNT_NOT_FOUND" };
    }

    const accountId = membership.account_id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("company_profiles")
      .select("id, trade_name, timezone")
      .eq("account_id", accountId)
      .maybeSingle();

    if (profileError || !profile || !profile.trade_name || !profile.timezone) {
      return {
        ok: false,
        error: "INCOMPLETE_PROFILE",
        message: "Perfil da empresa incompleto. Preencha nome e timezone antes de concluir.",
      };
    }

    const { data: result, error } = await supabaseAdmin.rpc("upsert_account_onboarding", {
      p_account_id: accountId,
      p_status: "completed",
      p_current_step: "conclusion",
      p_metadata: { completed_via: "client_ui" },
    });

    if (error) {
      console.error("[onboarding] Completion failed:", error);
      return { ok: false, error: "COMPLETION_FAILED", message: error.message };
    }

    await emitOnboardingEvent({
      eventType: "ONBOARDING_COMPLETED",
      accountId,
      userId: context.userId,
      source: "onboarding_completion",
      sourceId: `${accountId}_${Date.now()}`,
      payload: { completed_via: "client_ui" },
    });

    return { ok: true, ...result };
  });

/**
 * Admin-only: Get onboarding dashboard metrics.
 */
export const serverGetOnboardingDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error } = await supabaseAdmin.rpc("is_platform_admin");
    if (error || !isAdmin) {
      return { ok: false, error: "ACCESS_DENIED", message: "Acesso restrito a administradores da plataforma." };
    }

    const { data, error: rpcError } = await supabaseAdmin.rpc("admin_get_onboarding_dashboard");
    if (rpcError) {
      console.error("[onboarding] Dashboard query failed:", rpcError);
      return { ok: false, error: "QUERY_FAILED", message: rpcError.message };
    }

    return { ok: true, metrics: data };
  });