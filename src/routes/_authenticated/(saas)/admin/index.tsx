import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/navor-rephub/ui";
import { Users, AlertCircle, CheckCircle2, DollarSign, Clock, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAdminDashboardStats } from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin_dashboard_stats_v2"],
    queryFn: () => getAdminDashboardStats(),
  });

  if (isLoading) {
    return <div className="p-6 text-card-foreground">Carregando painel...</div>;
  }

  const stats = data || { totalAccounts: 0, activeAccounts: 0, overdueAccounts: 0, nearingAccounts: 0, mrr: 0, recent: [], demoAccountsCount: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Visão Geral</h2>
        <p className="text-sm text-muted-foreground">Monitore o crescimento e a saúde da sua plataforma SaaS.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-brand/20 p-3 text-brand">
              <Users className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total de Contas</p>
              <p className="text-2xl font-bold text-card-foreground">{stats.totalAccounts}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-500/20 p-3 text-green-500">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contas Ativas</p>
              <p className="text-2xl font-bold text-card-foreground">{stats.activeAccounts}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-gold/20 p-3 text-gold">
              <DollarSign className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">MRR Previsto</p>
              <p className="text-2xl font-bold text-card-foreground">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.mrr)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 border border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-500/20 p-3 text-purple-400">
              <Sparkles className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contas Demo / Internas</p>
              <p className="text-2xl font-bold text-card-foreground">{(stats as any).demoAccountsCount ?? 0}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <div>
          <h3 className="mb-4 text-lg font-semibold text-card-foreground flex items-center gap-2">
            <AlertCircle className="size-5 text-red-500" />
            Alertas de Cobrança
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard className="p-5 border border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-3">
                <AlertCircle className="size-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-card-foreground">{stats.overdueAccounts}</p>
                  <p className="text-sm text-red-200">Contas em Atraso</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-5 border border-gold/20 bg-gold/5">
              <div className="flex items-center gap-3">
                <Clock className="size-8 text-gold" />
                <div>
                  <p className="text-2xl font-bold text-card-foreground">{stats.nearingAccounts}</p>
                  <p className="text-sm text-gold/80">Vencimento Próximo</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-semibold text-card-foreground">Últimas Atividades</h3>
          <GlassCard className="p-0">
            <div className="flex flex-col">
              {stats.recent.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Nenhuma conta cadastrada recentemente.</div>
              ) : (
                stats.recent.map((account) => (
                  <div key={account.id} className="flex items-center gap-4 border-b border-border p-4 last:border-0">
                    <div className="size-2 rounded-full bg-brand" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-card-foreground">Nova conta criada: {account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Em {new Intl.DateTimeFormat('pt-BR').format(new Date(account.created_at))}
                      </p>
                    </div>
                    <Link to="/admin/contas" className="text-xs text-brand hover:underline">Ver</Link>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
