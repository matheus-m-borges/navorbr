import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { GlassCard } from "@/components/navor-rephub/ui";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  Shield,
  Zap,
  XCircle,
} from "lucide-react";
import { useState } from "react";

const getMonitoringData = createServerFn({ method: "GET" }).handler(async () => {
  const { getServiceStatusSummary, listIncidents } = await import("@/lib/monitoring/navor-monitoring-service.server");
  
  const [services, incidents] = await Promise.all([
    getServiceStatusSummary(),
    listIncidents(),
  ]);
  
  return { services, incidents };
});

export const Route = createFileRoute("/_authenticated/(saas)/admin/monitoramento/")({
  loader: () => getMonitoringData(),
  component: MonitoramentoAdminPage,
});

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "healthy": return <CheckCircle2 className="size-4 text-emerald-500" />;
    case "degraded": return <AlertTriangle className="size-4 text-amber-500" />;
    case "unhealthy": return <XCircle className="size-4 text-red-500" />;
    default: return <Clock className="size-4 text-slate-500" />;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    critical: "bg-red-500/10 text-red-600 border-red-500/20",
    outage: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[severity] ?? map.info}`}>
      {severity}
    </span>
  );
}

function MonitoramentoAdminPage() {
  const data = Route.useLoaderData();
  const [activeTab, setActiveTab] = useState<"health" | "incidents">("health");

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Carregando dados de monitoramento...</div>;
  }

  const { services, incidents } = data;
  const activeIncidents = incidents.filter((i: any) => i.status !== "resolved" && i.status !== "post_mortem");

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Monitoramento e Incidentes</h1>
          <p className="text-sm text-slate-400 mt-1">Health checks, métricas e gestão de incidentes da plataforma</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5">
            <Activity className="size-4 text-emerald-500" />
            <span className="text-xs font-medium text-slate-300">{services.length} Serviços</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5">
            <AlertTriangle className="size-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-300">{activeIncidents.length} Incidentes Ativos</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-1">
        {[
          { id: "health", label: "Health Checks", icon: Server },
          { id: "incidents", label: "Incidentes", icon: AlertTriangle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "bg-slate-800 text-emerald-400 border-b-2 border-emerald-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Health Checks Tab */}
      {activeTab === "health" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.length === 0 ? (
            <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-500">
              Nenhum health check registrado ainda.
            </div>
          ) : (
            services.map((svc: any) => (
              <GlassCard key={svc.service_name} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={svc.status} />
                    <h3 className="font-semibold text-slate-100 capitalize">{svc.service_name}</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(svc.checked_at).toLocaleTimeString("pt-BR")}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Status</span>
                    <span className={`font-medium capitalize ${
                      svc.status === "healthy" ? "text-emerald-400" :
                      svc.status === "degraded" ? "text-amber-400" : "text-red-400"
                    }`}>{svc.status}</span>
                  </div>
                  {svc.latency_ms != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Latência</span>
                      <span className="font-mono text-slate-200">{svc.latency_ms}ms</span>
                    </div>
                  )}
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}

      {/* Incidents Tab */}
      {activeTab === "incidents" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-300">Título</th>
                <th className="px-4 py-3 font-medium text-slate-300">Severidade</th>
                <th className="px-4 py-3 font-medium text-slate-300">Status</th>
                <th className="px-4 py-3 font-medium text-slate-300">Início</th>
                <th className="px-4 py-3 font-medium text-slate-300">Serviços</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {incidents.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum incidente registrado.</td></tr>
              ) : (
                incidents.map((inc: any) => (
                  <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium">{inc.title}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{inc.status.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {new Date(inc.started_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(inc.affected_services ?? []).slice(0, 3).map((s: string) => (
                          <span key={s} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{s}</span>
                        ))}
                        {(inc.affected_services ?? []).length > 3 && (
                          <span className="text-[10px] text-slate-500">+{inc.affected_services.length - 3}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
