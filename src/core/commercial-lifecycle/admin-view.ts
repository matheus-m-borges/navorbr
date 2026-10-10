import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CommercialRecord {
  account_id: string;
  account_name: string | null;
  commercial_stage: string;
  subscription_id: string | null;
  subscription_status: string | null;
  plan_name: string | null;
  product_name: string | null;
  amount: number | null;
  currency: string | null;
  next_billing_at: string | null;
  grace_period_ends_at: string | null;
  suspended_at: string | null;
  canceled_at: string | null;
  reactivated_at: string | null;
  retention_state: string | null;
  is_billable: boolean;
  account_type: string;
}

/**
 * Admin view: consolidated commercial lifecycle dashboard.
 * Platform admin only. Does NOT expose tenant operational data.
 */
export const serverGetCommercialDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { statusFilter?: string; stageFilter?: string; page?: number; pageSize?: number }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, is_platform_admin")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_platform_admin && profile?.role !== "platform_admin") {
      return { ok: false, error: "ACCESS_DENIED", message: "Acesso restrito a administradores da plataforma." };
    }

    const pageSize = Math.min(data.pageSize || 50, 200);
    const offset = ((data.page || 1) - 1) * pageSize;

    let query = supabaseAdmin
      .from("accounts")
      .select(`
        id,
        name,
        commercial_stage,
        account_type,
        is_billable,
        subscriptions!inner (
          id,
          status,
          next_billing_at,
          grace_period_ends_at,
          suspended_at,
          canceled_at,
          reactivated_at,
          plans ( name ),
          products ( name )
        ),
        account_slugs ( retention_state )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (data.stageFilter && data.stageFilter !== "ALL") {
      query = query.eq("commercial_stage", data.stageFilter);
    }

    const { data: rows, error, count } = await query;

    if (error) {
      return { ok: false, error: "QUERY_FAILED", message: error.message };
    }

    const records: CommercialRecord[] = (rows || []).map((row: any) => {
      const sub = Array.isArray(row.subscriptions) ? row.subscriptions[0] : row.subscriptions;
      const slug = Array.isArray(row.account_slugs) ? row.account_slugs[0] : row.account_slugs;
      return {
        account_id: row.id,
        account_name: row.name,
        commercial_stage: row.commercial_stage,
        subscription_id: sub?.id || null,
        subscription_status: sub?.status || null,
        plan_name: sub?.plans?.name || null,
        product_name: sub?.products?.name || null,
        amount: null,
        currency: "BRL",
        next_billing_at: sub?.next_billing_at || null,
        grace_period_ends_at: sub?.grace_period_ends_at || null,
        suspended_at: sub?.suspended_at || null,
        canceled_at: sub?.canceled_at || null,
        reactivated_at: sub?.reactivated_at || null,
        retention_state: slug?.retention_state || "active",
        is_billable: row.is_billable,
        account_type: row.account_type,
      };
    });

    let filteredRecords = records;
    if (data.statusFilter && data.statusFilter !== "ALL") {
      filteredRecords = records.filter(r => r.subscription_status === data.statusFilter);
    }

    return { ok: true, records: filteredRecords, total: count || 0, page: data.page || 1, pageSize };
  });

/**
 * Get detailed commercial state for a specific account (admin view).
 */
export const serverGetAccountCommercialDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { accountId: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, is_platform_admin")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_platform_admin && profile?.role !== "platform_admin") {
      return { ok: false, error: "ACCESS_DENIED" };
    }

    const { data: account, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("*, subscriptions(*, plans(*), products(*)), account_slugs(*)")
      .eq("id", data.accountId)
      .single();

    if (accErr || !account) {
      return { ok: false, error: "ACCOUNT_NOT_FOUND" };
    }

    const { data: payments } = await supabaseAdmin
      .from("subscription_payments")
      .select("*")
      .eq("account_id", data.accountId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: auditLog } = await supabaseAdmin
      .from("billing_audit_log")
      .select("*")
      .eq("account_id", data.accountId)
      .order("created_at", { ascending: false })
      .limit(30);

    return { ok: true, account, payments: payments || [], auditLog: auditLog || [] };
  });
