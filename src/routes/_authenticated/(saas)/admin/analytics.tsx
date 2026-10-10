import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GlassCard } from "@/components/navor-rephub/ui";
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  Scale,
  Package,
  HardHat,
  LayoutGrid,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { getAdminAnalyticsData } from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/analytics")({
  head: () => ({
    meta: [{ title: "Analytics Multi-Sistemas | NAVOR" }],
  }),
  component: AnalyticsPage,
});

type SystemKey = "all" | "lawhub" | "rephub" | "enghub";

const SYSTEM_CONFIG = {
  all: {
    label: "Visão Geral",
    icon: BarChart3,
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40",
  },
  lawhub: {
    label: "Navor LawHub",
    icon: Scale,
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
    pathPrefix: "/lawhub",
    moduleKeywords: [
      { key: "processos", label: "Processos & Acervo OAB", match: ["/processos"] },
      { key: "publicacoes", label: "Publicações & Diários", match: ["/publicacoes"] },
      { key: "clientes", label: "Clientes & Partes", match: ["/clientes"] },
      { key: "financeiro", label: "Honorários & Financeiro", match: ["/financeiro"] },
      { key: "agenda", label: "Audiências & Prazos", match: ["/agenda"] },
      { key: "tarefas", label: "Tarefas & Diligências", match: ["/tarefas"] },
      { key: "modelos", label: "Modelos & Peças", match: ["/modelos"] },
    ],
  },
  rephub: {
    label: "Navor RepHub",
    icon: Package,
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/40",
    pathPrefix: "/rephub",
    moduleKeywords: [
      { key: "pedidos", label: "Pedidos & Vendas", match: ["/pedidos"] },
      { key: "clientes", label: "Carteira de Clientes", match: ["/clientes"] },
      { key: "catalogo", label: "Catálogo de Produtos", match: ["/catalogo", "/produtos"] },
      { key: "comissoes", label: "Comissões & Metas", match: ["/comissoes"] },
      { key: "relatorios", label: "Relatórios Comerciais", match: ["/relatorios"] },
    ],
  },
  enghub: {
    label: "Navor EngHub",
    icon: HardHat,
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
    pathPrefix: "/enghub",
    moduleKeywords: [
      { key: "obras", label: "Gestão de Obras", match: ["/obras"] },
      { key: "diario", label: "Diário de Obra (RDO)", match: ["/diario"] },
      { key: "insumos", label: "Insumos & Estoque", match: ["/insumos", "/materiais"] },
      { key: "orcamentos", label: "Orçamentos & Custos", match: ["/orcamentos"] },
      { key: "equipes", label: "Equipes de Campo", match: ["/equipes"] },
    ],
  },
};

function AnalyticsPage() {
  const [selectedSystem, setSelectedSystem] = useState<SystemKey>("all");

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["admin_analytics_data"],
    queryFn: () => getAdminAnalyticsData(),
  });
  const rawLogs = analyticsData?.logs || [];
  const accounts = analyticsData?.accounts || [];
  const loadingLogs = isLoading;
  const loadingAccounts = isLoading;

  // 3. Processar Métricas e Classificação por Sistema
  const processedData = useMemo(() => {
    let filteredLogs = rawLogs;

    if (selectedSystem !== "all") {
      const prefix = SYSTEM_CONFIG[selectedSystem].pathPrefix;
      filteredLogs = rawLogs.filter((log: any) => {
        const path = (log.description || "").toLowerCase();
        return path.includes(prefix) || path.includes(selectedSystem);
      });
    }

    // Contadores de rotas
    const routeCounts: Record<string, number> = {};
    for (const row of filteredLogs) {
      const desc = row.description || "Desconhecido";
      routeCounts[desc] = (routeCounts[desc] || 0) + 1;
    }

    const sortedRoutes = Object.entries(routeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);

    // Contagem de assinantes por sistema
    const filteredAccounts = accounts.filter((acc: any) => {
      if (selectedSystem === "all") return true;
      const slug = (acc.products?.slug || acc.products?.name || "").toLowerCase();
      return slug.includes(selectedSystem);
    });

    // Análise de módulos mais usados
    const moduleUsage: { name: string; count: number; percentage: number }[] = [];

    if (selectedSystem === "lawhub" || selectedSystem === "all") {
      for (const mod of SYSTEM_CONFIG.lawhub.moduleKeywords) {
        let count = 0;
        for (const [route, c] of Object.entries(routeCounts)) {
          if (mod.match.some((m) => route.toLowerCase().includes(m))) {
            count += c;
          }
        }
        if (count > 0 || selectedSystem === "lawhub") {
          moduleUsage.push({ name: `[LawHub] ${mod.label}`, count: count, percentage: 0 });
        }
      }
    }

    if (selectedSystem === "rephub" || selectedSystem === "all") {
      for (const mod of SYSTEM_CONFIG.rephub.moduleKeywords) {
        let count = 0;
        for (const [route, c] of Object.entries(routeCounts)) {
          if (mod.match.some((m) => route.toLowerCase().includes(m))) {
            count += c;
          }
        }
        if (count > 0 || selectedSystem === "rephub") {
          moduleUsage.push({ name: `[RepHub] ${mod.label}`, count: count, percentage: 0 });
        }
      }
    }

    if (selectedSystem === "enghub" || selectedSystem === "all") {
      for (const mod of SYSTEM_CONFIG.enghub.moduleKeywords) {
        let count = 0;
        for (const [route, c] of Object.entries(routeCounts)) {
          if (mod.match.some((m) => route.toLowerCase().includes(m))) {
            count += c;
          }
        }
        if (count > 0 || selectedSystem === "enghub") {
          moduleUsage.push({ name: `[EngHub] ${mod.label}`, count: count, percentage: 0 });
        }
      }
    }

    // Calcular percentuais
    const totalModuleCount = moduleUsage.reduce((acc, curr) => acc + curr.count, 0) || 1;
    moduleUsage.forEach((m) => {
      m.percentage = Math.round((m.count / totalModuleCount) * 100);
    });
    moduleUsage.sort((a, b) => b.count - a.count);

    const totalViews = filteredLogs.length;
    const topModule = moduleUsage[0]?.name || "N/A";

    return {
      totalViews,
      totalAccounts: filteredAccounts.length,
      topModule,
      moduleUsage,
      sortedRoutes,
    };
  }, [rawLogs, accounts, selectedSystem]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="size-6 text-blue-600" />
            <span>NAVOR Analytics Multi-Sistemas</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Engajamento, módulos mais acessados e telemetria separados por sistema contratado.
          </p>
        </div>
      </div>

      {/* Tabs de Sistemas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-white/10">
        {(["all", "lawhub", "rephub", "enghub"] as SystemKey[]).map((sysKey) => {
          const cfg = SYSTEM_CONFIG[sysKey];
          const Icon = cfg.icon;
          const isActive = selectedSystem === sysKey;

          return (
            <button
              key={sysKey}
              onClick={() => setSelectedSystem(sysKey)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30"
                  : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-card/40 dark:text-slate-300 dark:hover:bg-card/80 border border-slate-200 dark:border-white/5"
              }`}
            >
              <Icon className="size-4" />
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Visualizações */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-card/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Acessos / Pageviews</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Eye className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {loadingLogs ? "..." : processedData.totalViews.toLocaleString("pt-BR")}
          </p>
          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <TrendingUp className="size-3" />
            <span>Telemetria em tempo real</span>
          </span>
        </div>

        {/* KPI 2: Assinantes Ativos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-card/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Assinantes do Sistema</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <Users className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {loadingAccounts ? "..." : processedData.totalAccounts}
          </p>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Contas com isolamento multi-tenant
          </span>
        </div>

        {/* KPI 3: Módulo Mais Usado */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-card/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Módulo Mais Engajado</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Sparkles className="size-4" />
            </div>
          </div>
          <p className="text-sm font-black text-slate-900 dark:text-white mt-2 truncate">
            {processedData.topModule}
          </p>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Maior frequência de uso
          </span>
        </div>

        {/* KPI 4: Sistema Selecionado */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-card/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Segmento Analisado</span>
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
              <LayoutGrid className="size-4" />
            </div>
          </div>
          <p className="text-base font-black text-slate-900 dark:text-white mt-2 capitalize">
            {SYSTEM_CONFIG[selectedSystem].label}
          </p>
          <span className="text-[10px] text-cyan-600 font-bold mt-1 block">
            Filtro ativo
          </span>
        </div>
      </div>

      {/* Grid: Gráficos de Módulos Mais Usados vs Rotas Acessadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Módulos Mais Utilizados */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <LayoutGrid className="size-4 text-blue-600" />
                <span>Módulos Mais Utilizados</span>
              </h3>
              <p className="text-xs text-slate-500">
                Distribuição percentual de engajamento por funcionalidade.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {processedData.moduleUsage.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum uso registrado para este sistema.</p>
            ) : (
              processedData.moduleUsage.slice(0, 8).map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.name}
                    </span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {item.percentage}% ({item.count} acessos)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                      style={{ width: `${Math.max(item.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Card: Rotas e Telas Mais Frequentes */}
        <GlassCard className="p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <ArrowUpRight className="size-4 text-emerald-600" />
                <span>Telas & URLs Mais Acessadas</span>
              </h3>
              <p className="text-xs text-slate-500">
                Ranking de acessos diretos capturados pelos audit logs.
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] text-slate-500 sticky top-0 backdrop-blur-xs">
                <tr>
                  <th className="p-2.5 font-bold">Caminho / Tela</th>
                  <th className="p-2.5 font-bold text-right">Acessos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {processedData.sortedRoutes.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-6 text-center text-slate-400">
                      Nenhum acesso registrado no filtro atual.
                    </td>
                  </tr>
                ) : (
                  processedData.sortedRoutes.map(([route, count], idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200 font-mono truncate max-w-[280px]">
                        {route}
                      </td>
                      <td className="p-2.5 text-right font-bold text-blue-600 dark:text-blue-400">
                        {count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
