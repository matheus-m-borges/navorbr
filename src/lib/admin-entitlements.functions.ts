import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPlatformAdmin } from "@/core/security/authorization.server";
import { z } from "zod";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const listSubscribersForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    search: z.string().optional(),
    productId: z.string().uuid().optional(),
    status: z.string().optional(),
  }))
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    if (!admin) throw new Error("ACCESS_DENIED: Platform admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("accounts")
      .select("id, name, contact_email, product_id, account_type, commercial_stage, products(slug, name), subscriptions(status, plans(name))")
      .order("name", { ascending: true })
      .limit(100);

    if (data.search) {
      query = query.or(`name.ilike.%${data.search}%,contact_email.ilike.%${data.search}%`);
    }
    if (data.productId) {
      query = query.eq("product_id", data.productId);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`QUERY_FAILURE: ${error.message}`);
    return rows ?? [];
  });

export const getSubscriberDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ accountId: z.string().regex(UUID_REGEX) }))
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    if (!admin) throw new Error("ACCESS_DENIED: Platform admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [accountRes, entitlementsRes, overridesRes, addonsRes, auditRes] = await Promise.all([
      supabaseAdmin.from("accounts").select("*, products(slug, name), subscriptions(*, plans(name))").eq("id", data.accountId).maybeSingle(),
      (supabaseAdmin as any).rpc("get_account_entitlements", { p_account_id: data.accountId }),
      supabaseAdmin.from("account_entitlement_overrides").select("*, product_capabilities(key, name)").eq("account_id", data.accountId),
      supabaseAdmin.from("account_addons").select("*, plan_addons(key, name)").eq("account_id", data.accountId).eq("is_active", true),
      supabaseAdmin.from("entitlement_audit_log").select("*").eq("account_id", data.accountId).order("created_at", { ascending: false }).limit(50),
    ]);

    if (accountRes.error) throw new Error(`ACCOUNT_QUERY_FAILURE: ${accountRes.error.message}`);
    if (!accountRes.data) throw new Error("ACCOUNT_NOT_FOUND");
    if (entitlementsRes.error) throw new Error(`ENTITLEMENTS_RPC_FAILURE: ${entitlementsRes.error.message}`);

    return {
      account: accountRes.data,
      capabilities: entitlementsRes.data ?? [],
      overrides: overridesRes.data ?? [],
      addons: addonsRes.data ?? [],
      auditLog: auditRes.data ?? [],
    };
  });

/**
 * Upsert de override com atomicidade verdadeira via RPC transacional.
 * A alteração comercial e a auditoria ocorrem na mesma transação DB.
 */
export const upsertEntitlementOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    accountId: z.string().regex(UUID_REGEX),
    capabilityId: z.string().regex(UUID_REGEX),
    granted: z.boolean(),
    reason: z.string().min(3).max(500),
  }))
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    if (!admin) throw new Error("ACCESS_DENIED: Platform admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify capability exists before calling RPC
    const { data: cap, error: capErr } = await supabaseAdmin
      .from("product_capabilities")
      .select("id, key, name")
      .eq("id", data.capabilityId)
      .maybeSingle();
    if (capErr || !cap) throw new Error("CAPABILITY_NOT_FOUND");

    // Atomic RPC: override + audit in single transaction
    const { error: rpcErr } = await (supabaseAdmin as any).rpc(
      "upsert_entitlement_override_with_audit",
      {
        p_account_id: data.accountId,
        p_capability_id: data.capabilityId,
        p_granted: data.granted,
        p_reason: data.reason,
        p_changed_by: context.userId,
      },
    );

    if (rpcErr) throw new Error(`ATOMIC_OVERRIDE_UPSERT_FAILURE: ${rpcErr.message}`);
    return { success: true };
  });

/**
 * Remoção de override com atomicidade verdadeira via RPC transacional.
 */
export const removeEntitlementOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    accountId: z.string().regex(UUID_REGEX),
    capabilityId: z.string().regex(UUID_REGEX),
    reason: z.string().min(3).max(500),
  }))
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    if (!admin) throw new Error("ACCESS_DENIED: Platform admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Atomic RPC: delete + audit in single transaction
    const { error: rpcErr } = await (supabaseAdmin as any).rpc(
      "remove_entitlement_override_with_audit",
      {
        p_account_id: data.accountId,
        p_capability_id: data.capabilityId,
        p_reason: data.reason,
        p_changed_by: context.userId,
      },
    );

    if (rpcErr) throw new Error(`ATOMIC_OVERRIDE_REMOVE_FAILURE: ${rpcErr.message}`);
    return { success: true };
  });
