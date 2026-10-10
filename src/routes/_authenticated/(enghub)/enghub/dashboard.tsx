import { createFileRoute } from "@tanstack/react-router";
import { EngHubAppShell } from "@/components/navor-enghub/EngHubAppShell";
import { HardHat, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/navor-rephub/ui";

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Navor EngHub" },
      { name: "description", content: "Visão geral de suas obras, custos e produtividade." },
    ],
  }),
  component: EngHubDashboard,
});

function EngHubDashboard() {
  return (
    <EngHubAppShell
      title="Dashboard"
      subtitle="Visão consolidada das suas obras e saúde financeira"
    >
      <div className="grid gap-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Obras Ativas" value="12" icon={HardHat} trend="+2 no mês" trendUp />
          <KpiCard title="Custo Realizado" value="R$ 1.2M" icon={DollarSign} trend="Dentro do orçamento" trendUp />
          <KpiCard title="A Receber" value="R$ 450k" icon={TrendingUp} trend="Próximos 30 dias" trendUp />
          <KpiCard title="Obras Atrasadas" value="2" icon={AlertTriangle} trend="Requer atenção" trendUp={false} danger />
        </div>

        {/* Listagem Resumo */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GlassCard className="p-6 h-96 flex flex-col items-center justify-center text-center">
              <HardHat className="size-12 text-gold mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-white">Nenhuma obra cadastrada ainda</h3>
              <p className="text-muted-foreground mt-2 max-w-sm">Comece adicionando sua primeira obra para acompanhar o planejamento e o fluxo financeiro.</p>
            </GlassCard>
          </div>
          
          <div className="flex flex-col gap-6">
            <GlassCard className="p-6">
              <h3 className="font-display font-bold text-white mb-4">Avisos e Alertas</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded bg-red-500/10 p-3 border border-red-500/20">
                  <AlertTriangle className="size-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-500">Obra Residencial Alphaville</p>
                    <p className="text-xs text-red-400/80">Etapa de Fundação com 5 dias de atraso.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded bg-yellow-500/10 p-3 border border-yellow-500/20">
                  <AlertTriangle className="size-5 text-yellow-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-yellow-500">Estoque Baixo</p>
                    <p className="text-xs text-yellow-500/80">Cimento Votorantim abaixo da quantidade mínima.</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </EngHubAppShell>
  );
}

function KpiCard({ title, value, icon: Icon, trend, trendUp, danger }: any) {
  return (
    <GlassCard className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className={`grid size-8 place-items-center rounded-lg ${danger ? 'bg-red-500/20 text-red-500' : 'bg-gold/20 text-gold'}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div>
        <div className="font-display text-2xl font-bold text-white">{value}</div>
        <p className={`text-xs mt-1 font-medium ${danger ? 'text-red-400' : (trendUp ? 'text-emerald-400' : 'text-muted-foreground')}`}>
          {trend}
        </p>
      </div>
    </GlassCard>
  );
}
