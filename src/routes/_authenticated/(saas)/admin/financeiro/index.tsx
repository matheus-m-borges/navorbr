import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { GlassCard } from "@/components/navor-rephub/ui";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  FileText,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useState } from "react";

const getFinancialData = createServerFn({ method: "GET" }).handler(async () => {
  const { getFinancialSummary, listReceivables, listPayables } = await import("@/lib/finance/navor-finance-service.server");
  
  // Last 30 days period
  const end = new Date().toISOString().split("T")[0];
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const [summary, receivables, payables] = await Promise.all([
    getFinancialSummary(start, end),
    listReceivables({ status: "pending" }),
    listPayables({ status: "pending" }),
  ]);
  
  return { summary, receivables, payables, period: { start, end } };
});

export const Route = createFileRoute("/_authenticated/(saas)/admin/financeiro/")({
  loader: () => getFinancialData(),
  component: FinanceiroAdminPage,
});

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    paid: { label: "Pago", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    pending: { label: "Pendente", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    overdue: { label: "Vencido", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
    partial: { label: "Parcial", icon: CreditCard, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    cancelled: { label: "Cancelado", icon: AlertCircle, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
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

function FinanceiroAdminPage() {
  const data = Route.useLoaderData();
  const [activeTab, setActiveTab] = useState<"overview" | "receivables" | "payables">("overview");

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Carregando dados financeiros...</div>;
  }

  const { summary, receivables, payables, period } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Financeiro Administrativo</h1>
          <p className="text-sm text-slate-400 mt-1">Período: {period.start} a {period.end}</p>
        </div>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 transition-colors flex items-center gap-2">
          <Plus className="size-4" />
          Nova Despesa
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Receita Prevista</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatBRL(summary.totalReceivables)}</p>
          <p className="text-xs text-slate-500 mt-1">Recebido: {formatBRL(summary.receivedAmount)}</p>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Despesas Previstas</span>
            <TrendingDown className="size-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-400">{formatBRL(summary.totalPayables)}</p>
          <p className="text-xs text-slate-500 mt-1">Pago: {formatBRL(summary.paidAmount)}</p>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Fluxo Líquido</span>
            <DollarSign className="size-4 text-blue-500" />
          </div>
          <p className={`text-2xl font-bold ${summary.netCashflow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatBRL(summary.netCashflow)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Efetivo no período</p>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Inadimplência</span>
            <AlertCircle className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{formatBRL(summary.overdueReceivables)}</p>
          <p className="text-xs text-slate-500 mt-1">Recebíveis vencidos</p>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-1">
        {[
          { id: "overview", label: "Visão Geral" },
          { id: "receivables", label: "Contas a Receber" },
          { id: "payables", label: "Contas a Pagar" },
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
      {activeTab === "receivables" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-300">Conta</th>
                <th className="px-4 py-3 font-medium text-slate-300">Valor</th>
                <th className="px-4 py-3 font-medium text-slate-300">Vencimento</th>
                <th className="px-4 py-3 font-medium text-slate-300">Status</th>
                <th className="px-4 py-3 font-medium text-slate-300">Gateway</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {receivables.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum recebível pendente.</td></tr>
              ) : (
                receivables.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-200">{(r as any).accounts?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-200">{formatBRL(r.amount_cents)}</td>
                    <td className="px-4 py-3 text-slate-400">{r.due_date}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{r.gateway_charge_id?.slice(0, 12) ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "payables" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-300">Fornecedor</th>
                <th className="px-4 py-3 font-medium text-slate-300">Descrição</th>
                <th className="px-4 py-3 font-medium text-slate-300">Valor</th>
                <th className="px-4 py-3 font-medium text-slate-300">Vencimento</th>
                <th className="px-4 py-3 font-medium text-slate-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {payables.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhuma despesa pendente.</td></tr>
              ) : (
                payables.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-200">{p.supplier_name}</td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-xs">{p.description}</td>
                    <td className="px-4 py-3 font-mono text-slate-200">{formatBRL(p.amount_cents)}</td>
                    <td className="px-4 py-3 text-slate-400">{p.due_date}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Resumo de Pendências</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Recebíveis Pendentes</span>
                <span className="font-mono text-emerald-400">{formatBRL(summary.pendingReceivables)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Despesas Pendentes</span>
                <span className="font-mono text-rose-400">{formatBRL(summary.pendingPayables)}</span>
              </div>
              <div className="border-t border-slate-800 pt-3 flex justify-between items-center">
                <span className="text-slate-300 font-medium">Saldo Projetado</span>
                <span className={`font-mono font-bold ${summary.pendingReceivables - summary.pendingPayables >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatBRL(summary.pendingReceivables - summary.pendingPayables)}
                </span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm hover:bg-slate-800 transition-colors text-left">
                <Plus className="size-4 text-emerald-500 mb-1" />
                <span className="text-slate-200">Nova Despesa</span>
              </button>
              <button className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm hover:bg-slate-800 transition-colors text-left">
                <FileText className="size-4 text-blue-500 mb-1" />
                <span className="text-slate-200">Relatório Mensal</span>
              </button>
              <button className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm hover:bg-slate-800 transition-colors text-left">
                <CreditCard className="size-4 text-amber-500 mb-1" />
                <span className="text-slate-200">Conciliação</span>
              </button>
              <button className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm hover:bg-slate-800 transition-colors text-left">
                <DollarSign className="size-4 text-purple-500 mb-1" />
                <span className="text-slate-200">Plano de Contas</span>
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
