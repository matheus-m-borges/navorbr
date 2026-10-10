// =============================================================================
// CADEIRA 4.6 — ENTITLEMENTS ENGINE SERVICE (SERVER-SIDE)
// Authoritative resolution of account capabilities, limits, and addons.
// Reuses get_account_entitlements RPC from Chair 4.6 migration.
// =============================================================================

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  AccountEntitlements,
  ActiveAddon,
  CapabilitySource,
  ResolvedCapability,
  UsageLimit,
} from "./types";

/**
 * Resolve all effective entitlements for an account.
 * Combines plan-based capabilities, overrides, and addons.
 * Fail-closed: throws on RPC or query failure.
 */
export async function resolveAccountEntitlements(
  accountId: string,
): Promise<AccountEntitlements> {
  const { data, error } = await (supabaseAdmin as any).rpc(
    "get_account_entitlements",
    { p_account_id: accountId },
  );

  if (error) {
    throw new Error(`ENTITLEMENTS_RPC_FAILURE: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error("ENTITLEMENTS_RPC_FAILURE: invalid response schema");
  }

  const capabilities: ResolvedCapability[] = data.map((row: any) => ({
    key: row.capability_key,
    name: row.capability_name,
    granted: Boolean(row.granted),
    source: row.source as CapabilitySource,
  }));

  return {
    accountId,
    capabilities,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * Check if a specific capability is granted for an account.
 * Returns false if not found or explicitly denied via override.
 */
export async function hasCapability(
  accountId: string,
  capabilityKey: string,
): Promise<boolean> {
  const entitlements = await resolveAccountEntitlements(accountId);
  const cap = entitlements.capabilities.find(
    (c) => c.key === capabilityKey,
  );
  return cap?.granted === true;
}

/**
 * Fetch active addons for an account.
 */
export async function getActiveAddons(
  accountId: string,
): Promise<ActiveAddon[]> {
  const { data, error } = await supabaseAdmin
    .from("account_addons")
    .select(
      "addon_id, activated_at, expires_at, is_active, plan_addons!inner(key, name)",
    )
    .eq("account_id", accountId)
    .eq("is_active", true)
    .or("expires_at.is.null,expires_at.gt.now()");

  if (error) {
    throw new Error(`ADDONS_QUERY_FAILURE: ${error.message}`);
  }

  return ((data ?? []) as any[]).map((row) => ({
    addonId: row.addon_id,
    key: row.plan_addons?.key ?? "",
    name: row.plan_addons?.name ?? "",
    activatedAt: row.activated_at,
    expiresAt: row.expires_at ?? null,
  }));
}

/**
 * Fetch usage limits for the account's current active subscription plan.
 */
export async function getUsageLimits(
  accountId: string,
): Promise<UsageLimit[]> {
  const { data: subs, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id")
    .eq("account_id", accountId)
    .in("status", ["active", "trial", "grace_period"])
    .maybeSingle();

  if (subError) {
    throw new Error(`SUBSCRIPTION_QUERY_FAILURE: ${subError.message}`);
  }

  if (!subs?.plan_id) {
    return [];
  }

  const { data: limits, error: limitsError } = await supabaseAdmin
    .from("plan_usage_limits")
    .select("limit_key, limit_value, unit, description")
    .eq("plan_id", subs.plan_id);

  if (limitsError) {
    throw new Error(`USAGE_LIMITS_QUERY_FAILURE: ${limitsError.message}`);
  }

  return ((limits ?? []) as any[]).map((row) => ({
    limitKey: row.limit_key,
    limitValue: Number(row.limit_value),
    unit: row.unit ?? "units",
    description: row.description ?? null,
  }));
}
