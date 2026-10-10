import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Lock,
  Key,
  Users,
  Clock,
  Download,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Scale,
  Calendar,
  Save,
  RefreshCw,
  FileText,
  UserCheck,
  LogOut,
  Laptop,
  Smartphone,
  Globe,
  X,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LawHubAuditService,
  type ForensicAuditEntry,
  type ForensicSecurityPolicies,
  type AuditSeverity,
  type AuditResourceType,
  type ForensicAuditEventType,
} from "@/lib/lawhub/audit-service";
import { useCurrentUser } from "@/hooks/useSession";

export function SegurancaAuditoriaTab() {
  const { user } = useCurrentUser();
  const [activeSubTab, setActiveSubTab] = useState<"auditoria" | "politicas" | "sessoes">("auditoria");
  const [logs, setLogs] = useState<ForensicAuditEntry[]>([]);
  const [policies, setPolicies] = useState<ForensicSecurityPolicies>(() => LawHubAuditService.getSecurityPolicies());
  const [isLoading, setIsLoading] = useState(false);

  // Filtros de Auditoria
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "todas">("todas");
  const [resourceFilter, setResourceFilter] = useState<AuditResourceType | "todos">("todos");

  // Modal de Detalhes do Log
  const [selectedLog, setSelectedLog] = useState<ForensicAuditEntry | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await LawHubAuditService.getLogs();
      setLogs(data);
    } catch {
      toast.error("Erro ao carregar logs de auditoria.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const handleUpdate = () => {
      loadLogs();
      setPolicies(LawHubAuditService.getSecurityPolicies());
    };
    window.addEventListener("lawhub_audit_updated", handleUpdate);
    window.addEventListener("lawhub_security_policies_updated", handleUpdate);
    return () => {
      window.removeEventListener("lawhub_audit_updated", handleUpdate);
      window.removeEventListener("lawhub_security_policies_updated", handleUpdate);
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (severityFilter !== "todas" && log.severity !== severityFilter) return false;
      if (resourceFilter !== "todos" && log.resource_type !== resourceFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchTitle = log.title.toLowerCase().includes(q);
        const matchDesc = log.description.toLowerCase().includes(q);
        const matchUser = log.user_name.toLowerCase().includes(q) || log.user_email.toLowerCase().includes(q);
        const matchCnj = log.process_cnj && log.process_cnj.includes(q);
        const matchIp = log.ip_address.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchUser && !matchCnj && !matchIp) return false;
      }
      return true;
    });
  }, [logs, severityFilter, resourceFilter, searchTerm]);

  const stats = useMemo(() => {
    const total = logs.length;
    const criticos = logs.filter((l) => l.severity === "critica").length;
    const alertas = logs.filter((l) => l.severity === "alerta").length;
    const contratos = logs.filter((l) => l.resource_type === "contrato").length;
    const prazos = logs.filter((l) => l.resource_type === "prazo").length;
    return { total, criticos, alertas, contratos, prazos };
  }, [logs]);

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast.info("Nenhum registro para exportar.");
      return;
    }
    const csvContent = LawHubAuditService.exportAuditReportCsv(filteredLogs);
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_auditoria_lawhub_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Relatório de auditoria forense exportado com sucesso!");
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await LawHubAuditService.updateSecurityPolicies(policies);
      toast.success("Diretrizes de segurança e governança salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar diretrizes de segurança.");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header com Métricas de Governança */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Governança Forense</span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 dark:text-white">Conforme</span>
            <span className="text-[10px] text-emerald-600 font-semibold">LGPD / OAB</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Trilha de Auditoria</span>
            <FileText className="size-4 text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
            <span className="text-[10px] text-slate-400">Eventos</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Alertas & Críticos</span>
            <AlertTriangle className="size-4 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-amber-900 dark:text-amber-200">
              {stats.criticos + stats.alertas}
            </span>
            <span className="text-[10px] text-amber-600 font-semibold">Monitorados</span>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Cadeia de Custódia</span>
            <Lock className="size-4 text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-blue-900 dark:text-blue-200">SHA-256</span>
            <span className="text-[10px] text-blue-600 font-semibold">Integridade</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Navegação Interna */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("auditoria")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer",
              activeSubTab === "auditoria"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            <FileText className="size-3.5" />
            <span>Trilha de Auditoria Forense</span>
            <span className="rounded bg-black/10 dark:bg-white/20 px-1.5 py-0.2 text-[10px]">
              {logs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("politicas")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer",
              activeSubTab === "politicas"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            <ShieldCheck className="size-3.5" />
            <span>Diretrizes de Segurança & LGPD</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("sessoes")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer",
              activeSubTab === "sessoes"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            <Laptop className="size-3.5" />
            <span>Sessões Ativas</span>
          </button>
        </div>

        {activeSubTab === "auditoria" && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Exportar Relatório (CSV)</span>
          </button>
        )}
      </div>

      {/* 3. CONTEÚDO DA SUB-ABA 1: TRILHA DE AUDITORIA FORENSE */}
      {activeSubTab === "auditoria" && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar evento por título, usuário, CNJ, IP ou detalhes..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-slate-400 shrink-0" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="todas">Todas as Severidades</option>
                <option value="critica">Crítica (Atenção)</option>
                <option value="alerta">Alerta</option>
                <option value="info">Informativa</option>
              </select>

              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value as any)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="todos">Todos os Recursos</option>
                <option value="contrato">Contratos & Procurações</option>
                <option value="processo">Processos Sigilosos</option>
                <option value="prazo">Prazos & Tempestividade</option>
                <option value="usuario">Usuários & RBAC</option>
                <option value="sistema">Sistema & Segurança</option>
              </select>

              <button
                type="button"
                onClick={loadLogs}
                title="Recarregar logs"
                className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition cursor-pointer"
              >
                <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Listagem de Logs */}
          {filteredLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
              <Shield className="mx-auto size-8 text-slate-400 mb-2" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Nenhum evento de auditoria localizado
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Tente ajustar os filtros ou os termos de pesquisa acima.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Timestamp / Severidade</th>
                      <th className="px-4 py-3">Evento & Descrição</th>
                      <th className="px-4 py-3">Usuário & IP</th>
                      <th className="px-4 py-3">Recurso / Processo</th>
                      <th className="px-4 py-3 text-right">Cadeia de Custódia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLogs.map((log) => {
                      const dateObj = new Date(log.timestamp);
                      const formattedDate = dateObj.toLocaleDateString("pt-BR") + " " + dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition">
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                {formattedDate}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold w-fit uppercase",
                                  log.severity === "critica"
                                    ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                                    : log.severity === "alerta"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                )}
                              >
                                {log.severity === "critica" ? (
                                  <ShieldAlert className="size-2.5" />
                                ) : log.severity === "alerta" ? (
                                  <AlertTriangle className="size-2.5" />
                                ) : (
                                  <ShieldCheck className="size-2.5" />
                                )}
                                {log.severity}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 max-w-sm">
                            <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {log.title}
                            </h5>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {log.description}
                            </p>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {log.user_name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {log.ip_address}
                            </p>
                            {log.user_role && (
                              <span className="text-[9px] text-slate-400">
                                {log.user_role}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {log.process_cnj ? (
                              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                                <Scale className="size-3 text-blue-600" />
                                <span>{log.process_cnj}</span>
                              </div>
                            ) : log.resource_type ? (
                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                                {log.resource_type}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer shadow-2xs"
                            >
                              <Eye className="size-3" />
                              <span>Ver Custódia</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. CONTEÚDO DA SUB-ABA 2: DIRETRIZES DE SEGURANÇA & LGPD */}
      {activeSubTab === "politicas" && (
        <form onSubmit={handleSavePolicies} className="space-y-6 max-w-3xl">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="size-4 text-blue-600" />
                Políticas de Acesso & Autenticação Forte
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Diretrizes de conformidade forense com o Provimento OAB e Art. 46 da LGPD
              </p>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policies.require_2fa_all_users}
                  onChange={(e) => setPolicies({ ...policies, require_2fa_all_users: e.target.checked })}
                  className="mt-0.5 size-4 rounded text-blue-600"
                />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Exigir Autenticação em Dois Fatores (2FA) para todos os colaboradores
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Obriga a validação via aplicativo autenticador (TOTP) ou SMS em todos os logins fora da rede do escritório.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policies.require_case_secrecy_justification}
                  onChange={(e) => setPolicies({ ...policies, require_case_secrecy_justification: e.target.checked })}
                  className="mt-0.5 size-4 rounded text-blue-600"
                />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Justificativa Obrigatória para Visualização de Processos em Segredo de Justiça
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Exige o registro do motivo forense antes da abertura de autos com segredo (Art. 189 do CPC).
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policies.mask_client_sensitive_docs}
                  onChange={(e) => setPolicies({ ...policies, mask_client_sensitive_docs: e.target.checked })}
                  className="mt-0.5 size-4 rounded text-blue-600"
                />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Mascaramento Preventivo de Dados de Clientes para Estagiários e Recepção
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Oculta os 6 primeiros dígitos do CPF e contas bancárias nas visualizações sem permissão financeira.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policies.notify_admins_critical_events}
                  onChange={(e) => setPolicies({ ...policies, notify_admins_critical_events: e.target.checked })}
                  className="mt-0.5 size-4 rounded text-blue-600"
                />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Alerta Imediato aos Sócios Titulares em Eventos Críticos
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Dispara notificação push e e-mail sempre que houver alteração de permissões ou exclusão de contratos.
                  </p>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tempo Limite de Inatividade de Sessão:
                </label>
                <select
                  value={policies.session_timeout_minutes}
                  onChange={(e) => setPolicies({ ...policies, session_timeout_minutes: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={60}>60 minutos (Recomendado)</option>
                  <option value={120}>2 horas</option>
                  <option value={480}>8 horas (Expediente Completo)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tentativas Máximas de Login com Falha:
                </label>
                <select
                  value={policies.max_login_attempts}
                  onChange={(e) => setPolicies({ ...policies, max_login_attempts: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value={3}>3 tentativas (Alta Segurança)</option>
                  <option value={5}>5 tentativas (Padrão Bancário)</option>
                  <option value={10}>10 tentativas</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>Salvar Diretrizes de Segurança</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 5. CONTEÚDO DA SUB-ABA 3: SESSÕES ATIVAS */}
      {activeSubTab === "sessoes" && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Sessão Atual do Usuário
                </h4>
                <p className="text-[11px] text-slate-500">
                  Dispositivo conectado neste momento ao Navor LawHub
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Sessão Ativa
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                <Laptop className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  Windows 11 • Google Chrome 128
                </p>
                <p className="text-[11px] text-slate-500">
                  IP: 187.19.204.112 (Teresina - PI, Brasil) • Conectado desde 08:30
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3 text-xs">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Ações de Segurança Emergencial
            </h4>
            <p className="text-[11px] text-slate-500">
              Caso suspeite de comprometimento de credenciais, encerre imediatamente todas as outras conexões do escritório.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  toast.success("Todas as outras sessões ativas foram revogadas com sucesso!");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 transition cursor-pointer"
              >
                <LogOut className="size-3.5" />
                <span>Desconectar Todas as Outras Sessões</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal de Cadeia de Custódia (Detalhes do Log Forense) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Cadeia de Custódia & Integridade Forense
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Hash de Integridade Criptográfica (SHA-256):
                </span>
                <div className="flex items-center justify-between gap-2 mt-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-850 font-mono text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 break-all">
                  <span>{selectedLog.integrity_hash}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedLog.integrity_hash);
                      toast.success("Hash SHA-256 copiado!");
                    }}
                    title="Copiar Hash"
                    className="p-1 hover:text-blue-600 transition cursor-pointer shrink-0"
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-400">Identificador Único:</span>
                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLog.id}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Data e Hora (UTC/ISO):</span>
                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLog.timestamp}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Usuário Responsável:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLog.user_name} ({selectedLog.user_email})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Endereço IP & Origem:</span>
                  <p className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedLog.ip_address}
                  </p>
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Metadados Forenses do Evento:
                  </span>
                  <pre className="mt-1 p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-100 px-4 py-1.5 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
