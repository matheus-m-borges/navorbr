import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotificationEvent } from "@/core/notifications/event-store";

export type CommercialStage = "beta" | "trial" | "customer" | "inactive";
export type SubscriptionStatus =
  | "pending_checkout"
  | "trial"
  | "active"
  | "past_due"
  | "grace_period"
  | "suspended"
  | "canceled"
  | "expired";

async function emitLifecycleEvent(params: {
  eventType: string;
  accountId: string;
  subscriptionId: string;
  productId?: string | null;
  source: string;
  sourceId: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createNotificationEvent({
      eventType: params.eventType as any,
      accountId: params.accountId,
      subscriptionId: params.subscriptionId,
      productId: params.productId ?? null,
      source: params.source,
      sourceId: params.sourceId,
      payload: params.payload,
    });
  } catch (err) {
    console.error(`[Lifecycle] Failed to emit ${params.eventType}:`, err);
  }
}

/**
 * Get consolidated commercial lifecycle state for the current account.
 */
export const serverGetLifecycleState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: membership } = await supabaseAdmin
      .from("account_members")
      .select("account_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return { ok: false, error: "ACCOUNT_NOT_FOUND" };
    }

    const accountId = membership.account_id;

    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("commercial_stage")
      .eq("id", accountId)
      .single();

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return {
        ok: true,
        accountId,
        state: {
          account_id: accountId,
          commercial_stage: (account?.commercial_stage as CommercialStage) || "customer",
          subscription_status: "pending_checkout",
        },
      };
    }

    return {
      ok: true,
      accountId,
      state: {
        account_id: accountId,
        commercial_stage: (account?.commercial_stage as CommercialStage) || "customer",
        subscription_status: sub.status as SubscriptionStatus,
        trial_ends_at: sub.trial_ends_at,
        beta_ends_at: sub.beta_ends_at,
        next_billing_at: sub.next_billing_at,
        grace_period_ends_at: sub.grace_period_ends_at,
        suspended_at: sub.suspended_at,
        canceled_at: sub.canceled_at,
        reactivated_at: sub.reactivated_at,
      },
    };
  });

/**
 * Validate and execute a subscription status transition.
 * Uses the atomic RPC with validation matrix.
 */
export const serverTransitionSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { subscriptionId: string; newStatus: SubscriptionStatus; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: membership } = await supabaseAdmin
      .from("account_members")
      .select("role, account_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { ok: false, error: "ACCESS_DENIED", message: "Apenas owners ou admins podem alterar o status." };
    }

    const { data: result, error } = await supabaseAdmin.rpc("transition_subscription_with_validation", {
      p_subscription_id: data.subscriptionId,
      p_new_status: data.newStatus,
      p_metadata: data.reason ? { reason: data.reason } : null,
    });

    if (error) {
      return { ok: false, error: "TRANSITION_FAILED", message: error.message };
    }

    if (!(result as any)?.valid) {
      return { ok: false, error: "INVALID_TRANSITION", message: (result as any)?.reason, details: result };
    }

    // Emit notification event for successful transitions
    const statusToEvent: Record<string, string> = {
      trial: "TRIAL_STARTED",
      active: data.reason?.includes("reactivat") ? "SUBSCRIPTION_REACTIVATED" : "SUBSCRIPTION_ACTIVATED",
      past_due: "SUBSCRIPTION_PAST_DUE",
      grace_period: "GRACE_PERIOD_STARTED",
      suspended: "SUBSCRIPTION_SUSPENDED",
      canceled: "SUBSCRIPTION_CANCELED",
      expired: "TRIAL_ENDED",
    };
    const eventType = statusToEvent[data.newStatus];
    if (eventType) {
      const { data: subDetails } = await supabaseAdmin
        .from("subscriptions")
        .select("product_id, account_id")
        .eq("id", data.subscriptionId)
        .single();
      await emitLifecycleEvent({
        eventType,
        accountId: subDetails?.account_id ?? "",
        subscriptionId: data.subscriptionId,
        productId: subDetails?.product_id,
        source: "lifecycle_transition",
        sourceId: `transition_${data.subscriptionId}_${Date.now()}`,
        payload: { new_status: data.newStatus, reason: data.reason },
      });
    }

    return { ok: true, subscriptionId: data.subscriptionId, newStatus: data.newStatus };
  });

/**
 * Update slug retention state (e.g., after cancellation).
 */
export const serverUpdateSlugRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { accountId: string; productId: string; state: "reserved" | "retained" | "released" }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: membership } = await supabaseAdmin
      .from("account_members")
      .select("role")
      .eq("account_id", data.accountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { ok: false, error: "ACCESS_DENIED" };
    }

    const { data: result, error } = await supabaseAdmin.rpc("update_slug_retention", {
      p_account_id: data.accountId,
      p_product_id: data.productId,
      p_retention_state: data.state,
    });

    if (error) {
      return { ok: false, error: "UPDATE_FAILED", message: error.message };
    }

    return { ok: true, ...((result as any) || {}) };
  });
