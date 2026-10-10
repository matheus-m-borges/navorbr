import { useQuery } from "@tanstack/react-query";
import { crmDb } from "@/hooks/useCrm";
import { supabase } from "@/integrations/supabase/client";

export interface Factory {
  id: string;
  legal_name: string;
  trade_name: string | null;
  cnpj: string | null;
  state_registration: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  commercial_contact: string | null;
  notes: string | null;
  rep_start_date: string | null;
  rep_end_date: string | null;
  rep_name: string | null;
  region: string | null;
  states: string[];
  commercial_notes: string | null;
  status: string;
  commission_mode: string;
  commission_pct_invoice: number;
  commission_pct_settlement: number;
  created_at: string;
}

export interface Collection {
  id: string;
  name: string;
  code: string | null;
  collection_type: string | null;
  year: number | null;
  brand_id: string | null;
  factory_id: string | null;
  sales_start: string | null;
  sales_end: string | null;
  launch_date: string | null;
  status: string;
  target_value: number;
  notes: string | null;
  description: string | null;
  season: string | null;
  cover_url: string | null;
  portal_scope: string;
  allow_download: boolean;
  created_at: string;
  brands?: { id: string; brand: string; factory_id: string | null; logo_url?: string | null } | null;
  brand_collections?: BrandCollection[];
}

export interface BrandCollection {
  id: string;
  collection_id: string;
  brand_id: string;
  factory_id: string | null;
  name: string;
  brand_code: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  description: string | null;
  photos_link: string | null;
  allow_download: boolean;
  created_at: string;
  brands?: { id: string; brand: string; factory_id: string | null; logo_url?: string | null } | null;
  collections?: { id: string; name: string; portal_scope?: string } | null;
}

export interface Order {
  id: string;
  internal_number: string;
  factory_order_number: string | null;
  client_id: string;
  brand_id: string;
  factory_id: string | null;
  collection_id: string;
  brand_collection_id: string;
  lead_id: string | null;
  order_date: string;
  issue_date: string | null;
  total_value: number;
  total_pieces: number;
  payment_method: string | null;
  payment_terms: string | null;
  rep_name: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  clients?: { id: string; legal_name: string; trade_name: string | null; cnpj: string | null; city: string | null; state: string | null } | null;
  brands?: { id: string; brand: string } | null;
  collections?: { id: string; name: string } | null;
  brand_collections?: { id: string; name: string; brand_code?: string | null } | null;
  factories?: { id: string; legal_name: string; trade_name: string | null } | null;
}

export interface Invoice {
  id: string;
  order_id: string;
  client_id: string | null;
  factory_id: string | null;
  brand_id: string | null;
  collection_id: string | null;
  brand_collection_id: string | null;
  nf_number: string | null;
  issue_date: string;
  invoiced_value: number;
  net_value: number | null;
  invoiced_pieces: number | null;
  custom_commission_pct: number | null;
  notes: string | null;
  created_at: string;
  orders?: {
    id: string;
    internal_number: string;
    total_value: number;
    status: string;
    factory_order_number?: string | null;
  } | null;
  clients?: { 
    id: string; 
    legal_name: string; 
    trade_name: string | null;
    cnpj?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  brands?: { id: string; brand: string } | null;
  brand_collections?: { id: string; name: string } | null;
  factories?: { id: string; legal_name: string; trade_name?: string | null } | null;
  invoice_installments?: Installment[];

}

export interface Installment {
  id: string;
  invoice_id: string;
  number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  paid_at: string | null;
  status: string;
  notes: string | null;
}

export interface Commission {
  id: string;
  invoice_id: string;
  order_id: string | null;
  client_id: string | null;
  factory_id: string | null;
  brand_id: string | null;
  collection_id: string | null;
  brand_collection_id: string | null;
  mode: string;
  rule_source: string;
  pct_invoice: number;
  pct_settlement: number;
  base_invoiced: number;
  base_settled: number;
  potential_amount: number;
  released_amount: number;
  received_amount: number;
  pending_amount: number;
  status: string;
  calc_memory: Record<string, unknown>;
  calculated_at: string;
  invoices?: { id: string; nf_number: string; issue_date: string } | null;
  clients?: { id: string; legal_name: string; trade_name: string | null } | null;
  brands?: { id: string; brand: string } | null;
  factories?: { id: string; legal_name: string } | null;
  collections?: { id: string; name: string } | null;
  brand_collections?: { id: string; name: string } | null;
}

export interface CommissionReceipt {
  id: string;
  factory_id: string | null;
  received_at: string;
  expected_amount: number;
  amount: number;
  difference: number;
  advances_total: number;
  justification: string | null;
  period_label: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  factories?: { id: string; legal_name: string } | null;
}

export interface FactoryAdvance {
  id: string;
  factory_id: string;
  collection_id: string | null;
  date: string;
  amount: number;
  discounted_amount: number;
  status: string;
  notes: string | null;
  factories?: { id: string; legal_name: string } | null;
  collections?: { id: string; name: string } | null;
}

export interface CommissionReceiptAdvance {
  id: string;
  receipt_id: string;
  advance_id: string;
  amount_discounted: number;
}

export interface ClientBrand {
  id: string;
  client_id: string;
  brand_id: string;
  start_date: string | null;
  notes: string | null;
  brands?: { id: string; brand: string; factory_id: string | null } | null;
}

export interface DocumentRow {
  id: string;
  entity_type: string;
  entity_id: string;
  category: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface SalesTarget {
  id: string;
  scope: string;
  factory_id: string | null;
  brand_id: string | null;
  collection_id: string | null;
  brand_collection_id: string | null;
  rep_name: string | null;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  target_value: number;
}

export interface AuditLog {
  id: string;
  user_name: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string;
  created_at: string;
}

async function list<T>(table: string, select: string, order?: { col: string; asc?: boolean }) {
  let q = crmDb.from(table).select(select);
  if (order) q = q.order(order.col, { ascending: order.asc ?? false });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useFactories() {
  return useQuery({
    queryKey: ["factories"],
    queryFn: () => list<Factory>("factories", "*", { col: "legal_name", asc: true }),
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: () =>
      list<Collection>("collections", "*, brand_collections(*, brands(id, brand, factory_id))", {
        col: "created_at",
      }),
  });
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: ["collection", id],
    queryFn: async () => {
      const { data, error } = await crmDb
        .from("collections")
        .select("*, brand_collections(*, brands(id, brand, factory_id))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Collection | null;
    },
  });
}

const ORDER_SELECT =
  "*, clients(id, legal_name, trade_name, cnpj, city, state), brands(id, brand), collections(id, name), brand_collections(id, name, brand_code), factories(id, legal_name, trade_name)";

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => list<Order>("orders", ORDER_SELECT, { col: "order_date" }),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await crmDb.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Order | null;
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: () =>
      list<Invoice>(
        "invoices",
        "*, orders(id, internal_number, total_value, status, factory_order_number), clients(id, legal_name, trade_name, cnpj, city, state), brands(id, brand), brand_collections(id, name), factories(id, legal_name, trade_name), invoice_installments(*)",
        { col: "issue_date" },
      ),
  });
}

export function useCommissions() {
  return useQuery({
    queryKey: ["commissions"],
    queryFn: () =>
      list<Commission>(
        "commissions",
        "*, invoices(id, nf_number, issue_date), clients(id, legal_name, trade_name), brands(id, brand), factories(id, legal_name), collections(id, name), brand_collections(id, name)",
        { col: "created_at", asc: false },
      ),
  });
}

export function useFactoryAdvances() {
  return useQuery({
    queryKey: ["factory-advances"],
    queryFn: () =>
      list<FactoryAdvance>(
        "factory_advances",
        "*, factories(id, legal_name), collections(id, name)",
        { col: "date", asc: false },
      ),
  });
}

export function useCommissionReceipts() {
  return useQuery({
    queryKey: ["commission-receipts"],
    queryFn: () =>
      list<CommissionReceipt>("commission_receipts", "*, factories(id, legal_name)", {
        col: "received_at",
      }),
  });
}

export function useClientBrands() {
  return useQuery({
    queryKey: ["client-brands"],
    queryFn: () => list<ClientBrand>("client_brands", "*, brands(id, brand, factory_id)"),
  });
}

export function useDocuments(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ["documents", entityType ?? "all", entityId ?? "all"],
    queryFn: async () => {
      let q = crmDb.from("documents").select("*").order("created_at", { ascending: false });
      if (entityType) q = q.eq("entity_type", entityType);
      if (entityId) q = q.eq("entity_id", entityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });
}

export function useSalesTargets() {
  return useQuery({
    queryKey: ["sales-targets"],
    queryFn: () => list<SalesTarget>("sales_targets", "*", { col: "period_start" }),
  });
}

export function useAuditLogs(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ["audit-logs", entityType ?? "all", entityId ?? "all"],
    queryFn: async () => {
      let q = crmDb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (entityType) q = q.eq("entity_type", entityType);
      if (entityId) q = q.eq("entity_id", entityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
  });
}

export async function logAudit(entry: {
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  userName?: string | null;
  userId?: string | null;
}) {
  const { writeAuditLog } = await import("@/lib/audit.functions");
  try {
    await writeAuditLog({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        action: entry.action,
        description: entry.description,
      },
    });
  } catch {
    // O histórico não deve interromper a operação principal.
  }
}
