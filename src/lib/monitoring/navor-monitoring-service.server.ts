/**
 * NAVOR Core — Monitoring & Health Service (Server-Only)
 *
 * Infraestrutura de observabilidade: health checks, incidentes e métricas.
 * SEGURANÇA: Acesso restrito a platform_admins via RLS.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface HealthCheckResult {
  id: string;
  service_name: string;
  check_type: "db" | "auth" | "billing" | "worker" | "external" | "custom";
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latency_ms: number | null;
  details: Record<string, unknown>;
  checked_at: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical" | "outage";
  status: "open" | "investigating" | "mitigated" | "resolved" | "post_mortem";
  affected_services: string[];
  description: string | null;
  root_cause: string | null;
  resolution: string | null;
  started_at: string;
  resolved_at: string | null;
}

export interface SystemMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  unit: string | null;
  tags: Record<string, unknown>;
  recorded_at: string;
}

/**
 * Registra resultado de health check.
 */
export async function recordHealthCheck(input: {
  serviceName: string;
  checkType: HealthCheckResult["check_type"];
  status: HealthCheckResult["status"];
  latencyMs?: number;
  details?: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("navor_health_check_results").insert({
    service_name: input.serviceName,
    check_type: input.checkType,
    status: input.status,
    latency_ms: input.latencyMs ?? null,
    details: input.details ?? {},
  });
}

/**
 * Lista health checks recentes por serviço.
 */
export async function listRecentHealthChecks(limit = 50): Promise<HealthCheckResult[]> {
  const { data, error } = await supabaseAdmin
    .from("navor_health_check_results")
    .select("*")
    .order("checked_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as HealthCheckResult[];
}

/**
 * Obtém status atual agregado dos serviços.
 */
export async function getServiceStatusSummary() {
  // Get latest check per service using a subquery approach
  const { data, error } = await supabaseAdmin
    .from("navor_health_check_results")
    .select("service_name, status, checked_at, latency_ms")
    .order("checked_at", { ascending: false });

  if (error) throw new Error(error.message);

  const serviceMap = new Map<string, { status: string; checked_at: string; latency_ms: number | null }>();
  for (const row of data ?? []) {
    if (!serviceMap.has(row.service_name)) {
      serviceMap.set(row.service_name, {
        status: row.status,
        checked_at: row.checked_at,
        latency_ms: row.latency_ms,
      });
    }
  }

  return Array.from(serviceMap.entries()).map(([name, info]) => ({
    service_name: name,
    ...info,
  }));
}

/**
 * Lista incidentes ativos ou recentes.
 */
export async function listIncidents(statusFilter?: string): Promise<Incident[]> {
  let query = supabaseAdmin
    .from("navor_incidents")
    .select("*")
    .order("started_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Incident[];
}

/**
 * Cria novo incidente.
 */
export async function createIncident(input: {
  title: string;
  severity: Incident["severity"];
  description?: string;
  affectedServices?: string[];
}, userId: string): Promise<Incident> {
  const { data, error } = await supabaseAdmin
    .from("navor_incidents")
    .insert({
      title: input.title,
      severity: input.severity,
      description: input.description ?? null,
      affected_services: input.affectedServices ?? [],
      reported_by: userId,
      status: "open",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Incident;
}

/**
 * Atualiza status de incidente.
 */
export async function updateIncidentStatus(
  incidentId: string,
  status: Incident["status"],
  resolution?: string,
  rootCause?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (resolution) updates.resolution = resolution;
  if (rootCause) updates.root_cause = rootCause;
  if (status === "resolved") updates.resolved_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("navor_incidents")
    .update(updates)
    .eq("id", incidentId);

  if (error) throw new Error(error.message);
}

/**
 * Registra métrica de sistema.
 */
export async function recordMetric(input: {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("navor_system_metrics").insert({
    metric_name: input.name,
    metric_value: input.value,
    unit: input.unit ?? null,
    tags: input.tags ?? {},
  });
}

/**
 * Obtém métricas recentes para dashboard.
 */
export async function getRecentMetrics(metricName?: string, limit = 100): Promise<SystemMetric[]> {
  let query = supabaseAdmin
    .from("navor_system_metrics")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (metricName) {
    query = query.eq("metric_name", metricName);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SystemMetric[];
}
