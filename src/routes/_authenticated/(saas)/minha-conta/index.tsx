import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/navor-rephub/ui";
import { Building2, Package, CreditCard, Calendar, CheckCircle2, AlertCircle, Users, Bell, FileText, Settings, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

const fetchMyAccountSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { getAccountSummary } = await import("@/lib/subscriber/subscriber-portal-service.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: { user } } = await supabaseAdmin.auth.getUser();
  if (!user) return null;
  const summary = await getAccountSummary(user.id);
  if (summary) summary.email = user.email ?? null;
  return summary;
});

export const Route = createFileRoute("/_authenticated/(saas)/minha-conta/")({
  loader: () => fetchMyAccountSummary(),
  component: MinhaContaDashboard,
});

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const map: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    active: { label: "Ativa", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
    trial: { label: "Teste", className: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: CheckCircle2 },
    past_due: { label: "Atrasada", className: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: AlertCircle },
    suspended: { label: "Suspensa", className: "bg-red-500/10 text-red-600 border-red-500/20", icon: AlertCircle },
    cancelled: { label: "Cancelada", className: "bg-slate-500/10 text-slate-500 border-slate-500/20", icon: AlertCircle },
    grace_period: { label: "Carência", className: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: AlertCircle },
  };
  const config = map[status] ?? { label: status, className: "bg-slate-500/10 text-slate-500 border-slate-500/20", icon: AlertCircle };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.className}`}>
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function MinhaContaDashboard() {
  const account = Route.useLoaderData();
  if (!account) {
    return (<div className="p-8 max-w-7xl mx-auto"><GlassCard className="p-12 text-center"><AlertCircle className="mx-auto mb-4 size-12 text-amber-500" /><h2 className="text-xl font-semibold text-card-foreground mb-2">Conta não encontrada</h2><p className="text-muted-foreground">Sua conta ainda não foi provisionada.</p></GlassCard></div>);
  }
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div><h1 className="text-2xl font-bold text-slate-100">Minha Conta</h1><p className="text-sm text-slate-400 mt-1">Gerencie sua assinatura, equipe e preferências</p></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-6"><div className="flex items-center gap-3 mb-3"><Building2 className="size-5 text-emerald-500" /><span className="text-xs font-medium uppercase tracking-wide text-slate-400">Empresa</span></div><p className="text-lg font-semibold text-slate-100 truncate">{account.name}</p><p className="text-xs text-slate-500 mt-1 truncate">{account.email ?? "—"}</p></GlassCard>
        <GlassCard className="p-6"><div className="flex items-center gap-3 mb-3"><Package className="size-5 text-blue-500" /><span className="text-xs font-medium uppercase tracking-wide text-slate-400">Produto</span></div><p className="text-lg font-semibold text-slate-100">{account.product_name ?? "—"}</p><p className="text-xs text-slate-500 mt-1">{account.plan_name ?? "Sem plano"}</p></GlassCard>
        <GlassCard className="p-6"><div className="flex items-center gap-3 mb-3"><CreditCard className="size-5 text-purple-500" /><span className="text-xs font-medium uppercase tracking-wide text-slate-400">Assinatura</span></div><StatusBadge status={account.subscription_status} /><p className="text-xs text-slate-500 mt-2">Renova em: {formatDate(account.current_period_end)}</p></GlassCard>
        <GlassCard className="p-6"><div className="flex items-center gap-3 mb-3"><Users className="size-5 text-cyan-500" /><span className="text-xs font-medium uppercase tracking-wide text-slate-400">Equipe</span></div><p className="text-2xl font-bold text-slate-100">{account.active_members_count}</p><p className="text-xs text-slate-500 mt-1">membros ativos</p></GlassCard>
      </div>
      <div><h2 className="text-lg font-semibold text-slate-100 mb-4">Ações Rápidas</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/_authenticated/(saas)/minha-conta/equipe" className="group"><GlassCard className="p-6 h-full hover:border-emerald-500/50 transition-colors"><div className="flex items-center justify-between mb-3"><Users className="size-6 text-emerald-500" /><ArrowRight className="size-4 text-slate-600 group-hover:text-emerald-400 transition-colors" /></div><h3 className="font-semibold text-slate-100 mb-1">Gerenciar Equipe</h3><p className="text-xs text-slate-400">Convidar membros, alterar permissões e revogar acessos.</p></GlassCard></Link>
          <Link to="/_authenticated/(saas)/minha-conta/faturas" className="group"><GlassCard className="p-6 h-full hover:border-emerald-500/50 transition-colors"><div className="flex items-center justify-between mb-3"><FileText className="size-6 text-blue-500" /><ArrowRight className="size-4 text-slate-600 group-hover:text-emerald-400 transition-colors" /></div><h3 className="font-semibold text-slate-100 mb-1">Faturas e Pagamentos</h3><p className="text-xs text-slate-400">Histórico financeiro, recibos e status de cobranças.</p></GlassCard></Link>
          <Link to="/_authenticated/(saas)/suporte" className="group"><GlassCard className="p-6 h-full hover:border-emerald-500/50 transition-colors"><div className="flex items-center justify-between mb-3"><Bell className="size-6 text-amber-500" /><ArrowRight className="size-4 text-slate-600 group-hover:text-emerald-400 transition-colors" /></div><h3 className="font-semibold text-slate-100 mb-1">Suporte e Ajuda</h3><p className="text-xs text-slate-400">Abrir tickets, acompanhar chamados e base de conhecimento.</p></GlassCard></Link>
        </div>
      </div>
    </div>
  );
}
