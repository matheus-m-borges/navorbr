import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Brand {
  id: string;
  company_name: string;
  legal_name: string | null;
  trade_name: string | null;
  cnpj: string | null;
  brand: string;
  segment: string | null;
  commercial_contact: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  logo_url?: string | null;
  factory_id?: string | null;
  states?: string[] | null;
  commission_mode?: string | null;
  commission_pct_invoice?: number | null;
  commission_pct_settlement?: number | null;
  created_at: string;
}

export interface Client {
  id: string;
  cnpj: string | null;
  legal_name: string;
  trade_name: string | null;
  state_registration: string | null;
  segment: string | null;
  client_type: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  district: string | null;
  zip_code: string | null;
  contact_name: string | null;
  contact_role: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  other_contacts: string | null;
  interest_brands: string[];
  owner_name: string | null;
  first_contact_date: string | null;
  source: string | null;
  status: string;
  purchase_potential: string | null;
  notes: string | null;
  origin_lead_id: string | null;
  created_at: string;
}

export interface ClientInterestPoint {
  id: string;
  client_id: string;
  point_date: string;
  source: string;
  subject: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Lead {
  id: string;
  entry_at: string;
  company_name: string;
  cnpj: string | null;
  legal_name: string | null;
  trade_name: string | null;
  city: string | null;
  state: string | null;
  contact_name: string | null;
  contact_role: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  website: string | null;
  source: string;
  status: string;
  owner_name: string | null;
  catalog_sent: boolean;
  catalog_sent_at: string | null;
  catalog_channel: string | null;
  catalog_name: string | null;
  catalog_notes: string | null;
  positivado: string;
  positivado_at: string | null;
  positivado_brand: string | null;
  estimated_value: number | null;
  effective_value: number | null;
  order_number: string | null;
  positivado_notes: string | null;
  loss_reason: string | null;
  loss_notes: string | null;
  last_interaction_at: string | null;
  next_followup_at: string | null;
  notes: string | null;
  converted_client_id: string | null;
  created_at: string;
  lead_brands?: { brand_id: string; brands: { id: string; brand: string } | null }[];
}

export interface Interaction {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  occurred_at: string;
  contact_type: string;
  responsible_name: string | null;
  description: string;
  result: string | null;
  next_action: string | null;
  next_action_at: string | null;
}

export interface StatusHistory {
  id: string;
  lead_id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by_name: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  status: string;
  due_at: string;
  completed_at: string | null;
  lead_id: string | null;
  client_id: string | null;
  owner_name: string | null;
}

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  lead_id: string | null;
  read: boolean;
  created_at: string;
}

const db = supabase as unknown as {
  from: (table: string) => any;
};

async function fetchAll<T>(table: string, select: string, order?: { col: string; asc?: boolean }) {
  let q = db.from(table).select(select);
  if (order) q = q.order(order.col, { ascending: order.asc ?? false });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: () =>
      fetchAll<Lead>("leads", "*, lead_brands(brand_id, brands(id, brand))", {
        col: "entry_at",
      }),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("leads")
        .select("*, lead_brands(brand_id, brands(id, brand))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Lead | null;
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: () => fetchAll<Brand>("brands", "*", { col: "brand", asc: true }),
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchAll<Client>("clients", "*", { col: "created_at" }),
  });
}

export function useClientInterestPoints(clientId: string) {
  return useQuery({
    queryKey: ["client-interest-points", clientId],
    queryFn: async () => {
      const { data, error } = await db
        .from("client_interest_points")
        .select("*")
        .eq("client_id", clientId)
        .order("point_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientInterestPoint[];
    },
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchAll<Task>("tasks", "*", { col: "due_at", asc: true }),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchAll<Notification>("notifications", "*", { col: "created_at" }),
  });
}

export function useInteractions(leadId: string) {
  return useQuery({
    queryKey: ["interactions", leadId],
    queryFn: async () => {
      const { data, error } = await db
        .from("lead_interactions")
        .select("*")
        .eq("lead_id", leadId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Interaction[];
    },
  });
}

export function useStatusHistory(leadId: string) {
  return useQuery({
    queryKey: ["status-history", leadId],
    queryFn: async () => {
      const { data, error } = await db
        .from("lead_status_history")
        .select("*")
        .eq("lead_id", leadId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StatusHistory[];
    },
  });
}

export function useLeadTasks(leadId: string) {
  return useQuery({
    queryKey: ["lead-tasks", leadId],
    queryFn: async () => {
      const { data, error } = await db
        .from("tasks")
        .select("*")
        .eq("lead_id", leadId)
        .order("due_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useLeadSources() {
  return useQuery({
    queryKey: ["lead-sources"],
    queryFn: () =>
      fetchAll<{ id: string; name: string; active: boolean }>("lead_sources", "*", {
        col: "name",
        asc: true,
      }),
  });
}

export function useLossReasons() {
  return useQuery({
    queryKey: ["loss-reasons"],
    queryFn: () =>
      fetchAll<{ id: string; name: string; active: boolean }>("loss_reasons", "*", {
        col: "name",
        asc: true,
      }),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await db.from("app_settings").select("*");
      if (error) throw error;
      const map: Record<string, unknown> = {};
      for (const row of (data ?? []) as { key: string; value: unknown }[]) map[row.key] = row.value;
      return map;
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        db.from("profiles").select("*"),
        db.from("user_roles").select("*"),
      ]);
      const roleMap = new Map<string, string>();
      for (const r of (roles ?? []) as { user_id: string; role: string }[])
        roleMap.set(r.user_id, r.role);
      return ((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[])
        .map((p) => ({ ...p, role: roleMap.get(p.id) ?? "vendedor" }));
    },
  });
}

/** Invalidação central após qualquer escrita. */
export function useCrmMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const crmDb = db;
