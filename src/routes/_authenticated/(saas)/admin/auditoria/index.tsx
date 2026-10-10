import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { GlassCard } from "@/components/navor-rephub/ui";
import {
  ShieldCheck,
  UserX,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";
import { useState } from "react";

const getAuditData = createServerFn({ method: "GET" }).handler(async () => {
  const { listAuditLogs, listLgpdRequests } = await import("@/lib/audit/navor-audit-service.server");
  
  const [logs, lgpdRequests] = await Promise.all([
    listAuditLogs({ limit: 50 }),
    listLgpdRequests(),
  ]);
  
  return { logs, lgpdRequests };
});

export const Route = createFileRoute("/_authenticated/(saas)/admin/auditoria/")({
  loader: () => getAuditData(),
  component: AuditoriaAdminPage,
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    success: { label: "Sucesso", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    failure: { label: "Falha", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
    denied: { label: "Negado", icon: UserX, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    received: { label: "Recebido", icon: Clock, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    in_review: { label: "Em Análise", icon: Search, className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    completed: { label: "Concluído", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    denied_lgpd: { label: "Negado", icon: UserX, className: "bg-red-500/10 text-red-600 border-red-500/20" },
  };
  const config = map[status] ?? { label: status, icon: FileText, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.className}`}>
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

function AuditoriaAdminPage() {
  const data = Route.useLoaderData();
  const [activeTab, setActiveTab] = useState<"logs" | "lgpd">("logs");

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Carregando dados de auditoria...</div>;
  }

  const { logs, lgpdRequests } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Auditoria e LGPD</h1>
          <p className="text-sm text-slate-400 mt-1">Rastreabilidade de ações e solicitações de titulares</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-1">
        {[
          { id: "logs", label: "Logs de Auditoria" },
          { id: "lgpd", label: "Solicitações LGPD" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "bg-slate-800 text-emerald-400 border-b-2 border-emerald-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "logs" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-300">Ação</th>
                <th className="px-4 py-3 font-medium text-slate-300">Entidade</th>
                <th className="px-4 py-3 font-medium text-slate-300">Resultado</th>
                <th className="px-4 py-3 font-medium text-slate-300">Data/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nenhum log encontrado.</td></tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium">{log.action}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {log.entity_type}{log.entity_id ? ` (${log.entity_id.slice(0, 8)}...)` : ""}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={log.result} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "lgpd" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-300">Titular</th>
                <th className="px-4 py-3 font-medium text-slate-300">Tipo</th>
                <th className="px-4 py-3 font-medium text-slate-300">Status</th>
                <th className="px-4 py-3 font-medium text-slate-300">Expira em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lgpdRequests.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nenhuma solicitação encontrada.</td></tr>
              ) : (
                lgpdRequests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-200">
                      {req.requester_name ?? req.requester_email}
                    </td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{req.request_type.replace("_", " ")}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status === "denied" ? "denied_lgpd" : req.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {new Date(req.expires_at).toLocaleDateString("pt-BR")}
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
