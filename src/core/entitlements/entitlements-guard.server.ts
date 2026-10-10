// =============================================================================
// CADEIRA 4.6 — ENTITLEMENTS GUARD (SERVER-SIDE)
// Middleware/guard for enforcing capability checks on routes and server fns.
// Fail-closed: denies access if entitlements cannot be resolved.
// =============================================================================

import { hasCapability, resolveAccountEntitlements } from "./entitlements-service.server";
import type { ResolvedCapability } from "./types";

export interface EntitlementCheckResult {
  allowed: boolean;
  requiredCapability: string;
  accountId: string;
  reason?: string;
}

/**
 * Check if an account has a specific capability.
 * Returns structured result for route guards and server functions.
 */
export async function checkEntitlement(
  accountId: string,
  capabilityKey: string,
): Promise<EntitlementCheckResult> {
  try {
    const granted = await hasCapability(accountId, capabilityKey);
    return {
      allowed: granted,
      requiredCapability: capabilityKey,
      accountId,
      reason: granted ? undefined : "CAPABILITY_NOT_GRANTED",
    };
  } catch (err: any) {
    // Fail-closed: if resolution fails, deny access
    return {
      allowed: false,
      requiredCapability: capabilityKey,
      accountId,
      reason: `ENTITLEMENT_RESOLUTION_FAILURE: ${err?.message || "unknown"}`,
    };
  }
}

/**
 * Assert that an account has a capability; throws if not.
 * Use in server functions where denial should be an error.
 */
export async function requireCapability(
  accountId: string,
  capabilityKey: string,
): Promise<void> {
  const result = await checkEntitlement(accountId, capabilityKey);
  if (!result.allowed) {
    throw new Error(
      `ENTITLEMENT_DENIED: ${capabilityKey} — ${result.reason || "not granted"}`,
    );
  }
}

/**
 * Resolve all capabilities for UI rendering (e.g., feature flags, menu visibility).
 * Returns empty array on failure to avoid breaking page render.
 */
export async function safeResolveCapabilities(
  accountId: string,
): Promise<ResolvedCapability[]> {
  try {
    const entitlements = await resolveAccountEntitlements(accountId);
    return entitlements.capabilities;
  } catch {
    return [];
  }
}
