/**
 * NAVOR Core — Audit & LGPD Service (Server-Only)
 *
 * Auditoria unificada de ações administrativas e gestão de solicitações LGPD.
 * SEGURANÇA: Acesso restrito a platform_admins via RLS.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuditLog {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  result: "success" | "failure" | "denied";
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface LgpdRequest {
  id: string;
  requester_email: string;
  requester_name: string | null;
  request_type: "access" | "correction" | "deletion" | "portability" | "objection" | "revocation";
  status: "received" | "in_review" | "approved" | "denied" | "completed" | "expired";
  description: string | null;
  response_summary: string | null;
  responded_by: string | null;
  responded_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Registra log de auditoria.
 */
export async function logAudit(input: {
  actorUserId: string;
  actorAccountId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result?: "success" | "failure" | "denied";
  errorMessage?: string;
}): Promise<void> {
  await supabaseAdmin.from("navor_platform_audit_logs").insert({
    actor_user_id: input.actorUserId,
    actor_account_id: input.actorAccountId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    result: input.result ?? "success",
    error_message: input.errorMessage ?? null,
  });
}

/**
 * Lista logs de auditoria com filtros.
 */
export async function listAuditLogs(filters?: {
  action?: string;
  entityType?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  let query = supabaseAdmin
    .from("navor_platform_audit_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.action) query = query.eq("action", filters.action);
  if (filters?.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters?.actorUserId) query = query.eq("actor_user_id", filters.actorUserId);
  if (filters?.from) query = query.gte("created_at", filters.from);
  if (filters?.to) query = query.lte("created_at", filters.to);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLog[];
}

/**
 * Lista solicitações LGPD.
 */
export async function listLgpdRequests(status?: string): Promise<LgpdRequest[]> {
  let query = supabaseAdmin
    .from("navor_lgpd_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LgpdRequest[];
}

/**
 * Atualiza status de solicitação LGPD.
 */
export async function updateLgpdRequestStatus(
  requestId: string,
  status: LgpdRequest["status"],
  responseSummary?: string,
  respondedBy?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (responseSummary) updates.response_summary = responseSummary;
  if (respondedBy) updates.responded_by = respondedBy;
  if (status === "completed") updates.completed_at = new Date().toISOString();
  if (status === "denied" || status === "approved") {
    updates.responded_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("navor_lgpd_requests")
    .update(updates)
    .eq("id", requestId);

  if (error) throw new Error(error.message);
}
