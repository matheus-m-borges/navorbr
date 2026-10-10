import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GlassCard } from "@/components/navor-rephub/ui";
import {
  Cpu,
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Download,
  Filter,
  Search,
  Scale,
  Package,
  HardHat,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { getAccountAiUsage, getAdminAiAccounts } from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/ia-consumo")({
  head: () => ({
    meta: [{ title: "Painel de Consumo de IA & Tokens por Tenant | NAVOR Admin" }],
  }),
  component: IaConsumoMasterPage,
});

export interface TenantIaUsage {
  accountId: string;
  tenantName: string;
  system: "lawhub" | "rephub" | "enghub" | "multi";
  planName: string;
  tokenQuota: number; // Ex: 1_000_000
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  requestCount: number;
  estimatedCostUsd: number;
  primaryModel: string;
  primaryFeature: string;
  status: "normal" | "alerta" | "bloqueado";
  bonusTokens: number;
  lastUsedAt: string;
}


function IaConsumoMasterPage() {
  const [systemFilter, setSystemFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tenantsUsage, setTenantsUsage] = useState<TenantIaUsage[]>([]);
  const [selectedTenantForBonus, setSelectedTenantForBonus] = useState<TenantIaUsage | null>(null);
  const [bonusAmount, setBonusAmount] = useState("250000");

  // Buscar contas reais do banco de dados para enriquecer os tenants
  const { data: accounts = [] } = useQuery({
    queryKey: ["admin_accounts_for_ia_usage"],
    queryFn: () => getAdminAiAccounts(),
  });

  // Carrega somente medições reais registradas no banco.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      accounts.map(async (account: any): Promise<TenantIaUsage> => {
        const usage = await getAccountAiUsage({ data: { accountId: account.id, days: 30 } });
        const logs = Array.isArray(usage.logs) ? usage.logs : [];
        const promptTokens = logs.reduce((sum: number, row: any) => sum + Number(row.prompt_tokens || 0), 0);
        const completionTokens = logs.reduce((sum: number, row: any) => sum + Number(row.completion_tokens || 0), 0);
        const latest = logs[0];
        const system = ["lawhub", "rephub", "enghub"].includes(usage.system)
          ? usage.system
          : "multi";
        return {
          accountId: account.id,
          tenantName: account.name || usage.clientName || "Conta sem nome",
          system: system as TenantIaUsage["system"],
          planName: "Plano não informado",
          tokenQuota: 0,
          tokensUsed: usage.summary.totalTokens,
          promptTokens,
          completionTokens,
          requestCount: usage.summary.totalCalls,
          estimatedCostUsd: usage.summary.totalCostUsd,
          primaryModel: latest?.model || "Sem uso registrado",
          primaryFeature: latest?.feature_label || "Sem uso registrado",
          status: "normal",
          bonusTokens: 0,
          lastUsedAt: latest?.created_at
            ? new Date(latest.created_at).toLocaleString("pt-BR")
            : "Sem uso registrado",
        };
      }),
    )
      .then((rows) => {
        if (!cancelled) setTenantsUsage(rows);
      })
      .catch(() => {
        if (!cancelled) setTenantsUsage([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const saveUsage = (list: TenantIaUsage[]) => {
    setTenantsUsage(list);
  };

  // Filtragem
  const filteredTenants = useMemo(() => {
    return tenantsUsage.filter((t) => {
      if (systemFilter !== "all" && t.system !== systemFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          t.tenantName.toLowerCase().includes(query) ||
          t.planName.toLowerCase().includes(query) ||
          t.primaryFeature.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [tenantsUsage, systemFilter, searchQuery]);

  // Totais Gerais
  const totalTokensMonth = useMemo(() => {
    return tenantsUsage.reduce((acc, t) => acc + t.tokensUsed, 0);
  }, [tenantsUsage]);

  const totalCostUsd = useMemo(() => {
    return tenantsUsage.reduce((acc, t) => acc + t.estimatedCostUsd, 0);
  }, [tenantsUsage]);

  const totalRequests = useMemo(() => {
    return tenantsUsage.reduce((acc, t) => acc + t.requestCount, 0);
  }, [tenantsUsage]);

  const tenantsOverLimit = useMemo(() => {
    return tenantsUsage.filter(
      (t) => t.tokenQuota > 0 && (t.status === "bloqueado" || t.tokensUsed >= t.tokenQuota),
    ).length;
  }, [tenantsUsage]);

  // Ações de Gestão de Cota
  const handleGrantBonus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForBonus) return;
    const bonus = parseInt(bonusAmount, 10) || 0;
    if (bonus <= 0) {
      toast.error("Informe uma quantidade válida de tokens.");
      return;
    }

    const updated = tenantsUsage.map((t) => {
      if (t.accountId === selectedTenantForBonus.accountId) {
        const newQuota = t.tokenQuota + bonus;
        const newStatus = t.tokensUsed >= newQuota ? "bloqueado" : t.tokensUsed >= newQuota * 0.85 ? "alerta" : "normal";
        return {
          ...t,
          tokenQuota: newQuota,
          bonusTokens: t.bonusTokens + bonus,
          status: newStatus as any,
        };
      }
      return t;
    });

    saveUsage(updated);
    toast.success(`Bônus de ${bonus.toLocaleString("pt-BR")} tokens creditado para ${selectedTenantForBonus.tenantName}!`);
    setSelectedTenantForBonus(null);
  };

  const handleResetQuota = (accountId: string) => {
    if (!confirm("Deseja realmente zerar o consumo do ciclo para este tenant?")) return;
    const updated = tenantsUsage.map((t) => {
      if (t.accountId === accountId) {
        return {
          ...t,
          tokensUsed: 0,
          promptTokens: 0,
          completionTokens: 0,
          requestCount: 0,
          estimatedCostUsd: 0,
          status: "normal" as const,
        };
      }
      return t;
    });
    saveUsage(updated);
    toast.success("Consumo de tokens zerado com sucesso para o novo ciclo.");
  };

  const handleExportCsv = () => {
    const headers = [
      "Tenant / Assinante",
      "Hub / Sistema",
      "Plano",
      "Tokens Utilizados",
      "Cota Contratada",
      "% Consumido",
      "Bônus Concedido",
      "Qtd Requisições",
      "Custo Estimado (USD)",
      "Modelo Principal",
      "Recurso Predominante",
      "Status da Cota",
    ];

    const rows = filteredTenants.map((t) => {
      const pct = ((t.tokensUsed / t.tokenQuota) * 100).toFixed(1);
      return [
        t.tenantName,
        t.system.toUpperCase(),
        t.planName,
        t.tokensUsed,
        t.tokenQuota,
        `${pct}%`,
        t.bonusTokens,
        t.requestCount,
        t.estimatedCostUsd.toFixed(2),
        t.primaryModel,
        t.primaryFeature,
        t.status.toUpperCase(),
      ];
    });

    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-consumo-ia-tenants-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório de consumo de IA exportado com sucesso.");
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Cpu className="size-5" />
            </div>
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
              Painel Master de Consumo de IA & Tokens por Tenant
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Telemetria de uso dos modelos GPT-4o, Claude 3.5 e Gemini em LawHub, RepHub e EngHub
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs"
          >
            <Download className="size-4 text-purple-500" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas Globais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <GlassCard className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Tokens Globais (Mês Atual)
          </span>
          <div className="mt-1 font-display text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono">
            {(totalTokensMonth / 1_000_000).toFixed(2)}M
          </div>
          <span className="text-[10px] text-muted-foreground">
            {totalTokensMonth.toLocaleString("pt-BR")} tokens processados
          </span>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Custo Estimado OpenAI/Anthropic
          </span>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            ${totalCostUsd.toFixed(2)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (~R$ {(totalCostUsd * 5.65).toFixed(2)})
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">Margem de lucro IA: 78%</span>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Requisições de IA
          </span>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white font-mono">
            {totalRequests.toLocaleString("pt-BR")}
          </div>
          <span className="text-[10px] text-muted-foreground">Latência média: 480ms</span>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Tenants em Limite de Cota
          </span>
          <div className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {tenantsOverLimit}
          </div>
          <span className="text-[10px] text-muted-foreground">Requer upgrade de plano ou bônus</span>
        </GlassCard>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "Todos os Sistemas", icon: Cpu },
            { id: "lawhub", label: "LawHub", icon: Scale },
            { id: "rephub", label: "RepHub", icon: Package },
            { id: "enghub", label: "EngHub", icon: HardHat },
          ].map((item) => {
            const isSelected = systemFilter === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSystemFilter(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                  isSelected
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por escritório ou construtora..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
          />
        </div>
      </div>

      {/* Tabela de Consumo por Tenant */}
      <GlassCard className="p-0 overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/80 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Tenant / Organização</th>
                <th className="p-3">Hub & Plano</th>
                <th className="p-3">Consumo de Tokens</th>
                <th className="p-3 text-center">Progresso da Cota</th>
                <th className="p-3 text-right">Custo Gerado</th>
                <th className="p-3">Recurso & Modelo Principal</th>
                <th className="p-3 text-center">Ações de Cota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {filteredTenants.map((t) => {
                const hasQuota = t.tokenQuota > 0;
                const pct = hasQuota ? Math.min(100, Math.round((t.tokensUsed / t.tokenQuota) * 100)) : 0;
                const isOver = hasQuota && t.tokensUsed >= t.tokenQuota;
                const isWarning = pct >= 80 && !isOver;

                return (
                  <tr
                    key={t.accountId}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    {/* Nome do Tenant */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {t.tenantName}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Clock className="size-3" />
                        {t.lastUsedAt} • {t.requestCount} chamadas
                      </div>
                    </td>

                    {/* Sistema / Hub */}
                    <td className="p-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                          t.system === "lawhub"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                            : t.system === "rephub"
                            ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                        )}
                      >
                        {t.system.toUpperCase()}
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{t.planName}</div>
                    </td>

                    {/* Consumo de Tokens */}
                    <td className="p-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {t.tokensUsed.toLocaleString("pt-BR")}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {hasQuota ? `Cota: ${t.tokenQuota.toLocaleString("pt-BR")}` : "Cota não configurada"}
                      </div>
                    </td>

                    {/* Barra de Progresso */}
                    <td className="p-3 w-40 text-center">
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <span
                          className={cn(
                            isOver ? "text-rose-600" : isWarning ? "text-amber-600" : "text-emerald-600"
                          )}
                        >
                          {hasQuota ? `${pct}%` : "—"}
                        </span>
                        <span className="text-muted-foreground">
                          {hasQuota ? (isOver ? "Esgotado" : isWarning ? "Atenção" : "Regular") : "Sem política de cota"}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isOver ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>

                    {/* Custo */}
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${t.estimatedCostUsd.toFixed(2)}
                      <div className="text-[10px] font-normal text-muted-foreground">
                        R$ {(t.estimatedCostUsd * 5.65).toFixed(2)}
                      </div>
                    </td>

                    {/* Recurso e Modelo */}
                    <td className="p-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {t.primaryFeature}
                      </div>
                      <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                        {t.primaryModel}
                      </div>
                    </td>

                    {/* Ações de Cota */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed"
                          title="Defina primeiro uma política persistente de cotas no banco"
                        >
                          <Plus className="size-3" />
                          <span>Bônus</span>
                        </button>
                        <button
                          type="button"
                          disabled
                          className="rounded-lg border border-slate-200 bg-slate-100 p-1 text-slate-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed"
                          title="O ciclo só pode ser reiniciado após existir uma política persistente de cotas"
                        >
                          <RefreshCw className="size-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modal Conceder Bônus de Tokens */}
      {selectedTenantForBonus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-purple-600" />
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Conceder Bônus de Tokens de IA
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTenantForBonus(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Adicione tokens extras à cota do assinante <strong>{selectedTenantForBonus.tenantName}</strong>{" "}
              sem alterar o valor da assinatura base.
            </p>

            <form onSubmit={handleGrantBonus} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Quantidade de Tokens de Bônus
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {["100000", "250000", "500000"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBonusAmount(val)}
                      className={cn(
                        "p-2 rounded-lg border font-bold text-center transition cursor-pointer",
                        bonusAmount === val
                          ? "border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      +{parseInt(val, 10) / 1000}k
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  required
                  min="10000"
                  step="10000"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-purple-600 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTenantForBonus(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-4 py-2 font-bold text-white hover:bg-purple-700 transition cursor-pointer shadow-xs"
                >
                  Credit Bônus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
