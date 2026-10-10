/**
 * NAVOR Core — Financeiro Administrativo Service (Server-Only)
 *
 * Gestão financeira interna da plataforma NAVOR.
 * Receitas (assinaturas), despesas, fluxo de caixa e conciliação.
 * SEGURANÇA: Acesso restrito a platform_admins via RLS.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface FinanceCategory {
  id: string;
  name: string;
  type: "revenue" | "expense";
  parent_id: string | null;
  is_active: boolean;
}

export interface FinanceReceivable {
  id: string;
  invoice_id: string | null;
  account_id: string;
  amount_cents: number;
  due_date: string;
  paid_at: string | null;
  status: string;
  gateway_charge_id: string | null;
}

export interface FinancePayable {
  id: string;
  supplier_name: string;
  category_id: string | null;
  cost_center_id: string | null;
  description: string;
  amount_cents: number;
  due_date: string;
  paid_at: string | null;
  status: string;
}

export interface CashflowEntry {
  id: string;
  type: "in" | "out" | "transfer";
  amount_cents: number;
  description: string;
  reference_date: string;
  category_id: string | null;
}

/**
 * Lista categorias financeiras ativas.
 */
export async function listCategories(type?: "revenue" | "expense"): Promise<FinanceCategory[]> {
  let query = supabaseAdmin
    .from("navor_finance_categories")
    .select("*")
    .eq("is_active", true)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as FinanceCategory[];
}

/**
 * Lista contas a receber com filtros.
 */
export async function listReceivables(filters?: {
  status?: string;
  accountId?: string;
  fromDue?: string;
  toDue?: string;
}): Promise<FinanceReceivable[]> {
  let query = supabaseAdmin
    .from("navor_finance_receivables")
    .select("*, accounts(name)")
    .order("due_date", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.accountId) query = query.eq("account_id", filters.accountId);
  if (filters?.fromDue) query = query.gte("due_date", filters.fromDue);
  if (filters?.toDue) query = query.lte("due_date", filters.toDue);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as FinanceReceivable[];
}

/**
 * Lista contas a pagar com filtros.
 */
export async function listPayables(filters?: {
  status?: string;
  categoryId?: string;
  fromDue?: string;
  toDue?: string;
}): Promise<FinancePayable[]> {
  let query = supabaseAdmin
    .from("navor_finance_payables")
    .select("*, navor_finance_categories(name), navor_finance_cost_centers(name)")
    .order("due_date", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters?.fromDue) query = query.gte("due_date", filters.fromDue);
  if (filters?.toDue) query = query.lte("due_date", filters.toDue);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as FinancePayable[];
}

/**
 * Registra nova despesa operacional.
 */
export async function createPayable(input: {
  supplierName: string;
  supplierDocument?: string;
  categoryId?: string;
  costCenterId?: string;
  description: string;
  amountCents: number;
  dueDate: string;
  paymentMethod?: string;
  notes?: string;
}, userId: string): Promise<FinancePayable> {
  const { data, error } = await supabaseAdmin
    .from("navor_finance_payables")
    .insert({
      supplier_name: input.supplierName,
      supplier_document: input.supplierDocument ?? null,
      category_id: input.categoryId ?? null,
      cost_center_id: input.costCenterId ?? null,
      description: input.description,
      amount_cents: input.amountCents,
      due_date: input.dueDate,
      payment_method: input.paymentMethod ?? null,
      notes: input.notes ?? null,
      created_by: userId,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // Register cashflow entry for tracking
  await supabaseAdmin.from("navor_finance_cashflow_entries").insert({
    type: "out",
    source_table: "payables",
    source_id: data.id,
    category_id: input.categoryId ?? null,
    cost_center_id: input.costCenterId ?? null,
    amount_cents: input.amountCents,
    description: `Despesa: ${input.description}`,
    reference_date: input.dueDate,
    created_by: userId,
  });

  return data as FinancePayable;
}

/**
 * Obtém resumo financeiro (KPIs).
 */
export async function getFinancialSummary(periodStart: string, periodEnd: string) {
  const [receivables, payables] = await Promise.all([
    supabaseAdmin
      .from("navor_finance_receivables")
      .select("amount_cents, paid_amount_cents, status")
      .gte("due_date", periodStart)
      .lte("due_date", periodEnd),
    supabaseAdmin
      .from("navor_finance_payables")
      .select("amount_cents, paid_amount_cents, status")
      .gte("due_date", periodStart)
      .lte("due_date", periodEnd),
  ]);

  if (receivables.error) throw new Error(receivables.error.message);
  if (payables.error) throw new Error(payables.error.message);

  const totalReceivables = (receivables.data ?? []).reduce((sum, r: any) => sum + (r.amount_cents || 0), 0);
  const receivedAmount = (receivables.data ?? []).reduce((sum, r: any) => sum + (r.paid_amount_cents || 0), 0);
  const overdueReceivables = (receivables.data ?? [])
    .filter((r: any) => r.status === "overdue")
    .reduce((sum, r: any) => sum + (r.amount_cents || 0), 0);

  const totalPayables = (payables.data ?? []).reduce((sum, p: any) => sum + (p.amount_cents || 0), 0);
  const paidAmount = (payables.data ?? []).reduce((sum, p: any) => sum + (p.paid_amount_cents || 0), 0);

  return {
    totalReceivables,
    receivedAmount,
    overdueReceivables,
    totalPayables,
    paidAmount,
    netCashflow: receivedAmount - paidAmount,
    pendingReceivables: totalReceivables - receivedAmount,
    pendingPayables: totalPayables - paidAmount,
  };
}
