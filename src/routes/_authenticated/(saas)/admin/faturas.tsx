import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/navor-rephub/ui";
import { FileText, Search, Filter, Download, CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { createServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/(saas)/admin/faturas")({
  component: AdminFaturas,
});

interface InvoiceRow {
  id: string;
  account_id: string;
  subscription_id: string | null;
  gateway_charge_id: string | null;
  amount_cents: number;
  currency: string;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  accounts: { name: string; email: string | null } | null;
}

const fetchAdminInvoices = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const supabase = supabaseAdmin;
  const { data, error } = await supabase
    .from("invoices")
    .select("*, accounts!inner(name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceRow[];
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    paid: { label: "Paga", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    open: { label: "Aberta", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    draft: { label: "Rascunho", icon: FileText, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
    void: { label: "Cancelada", icon: XCircle, className: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
    uncollectible: { label: "Inadimplente", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
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

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(iso));
}

function AdminFaturas() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["admin_invoices_list"],
    queryFn: () => fetchAdminInvoices(),
  });

  const filtered = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter((inv) => {
      const matchesSearch =
        !search ||
        inv.accounts?.name?.toLowerCase().includes(search.toLowerCase()) ||
        inv.description?.toLowerCase().includes(search.toLowerCase()) ||
        inv.gateway_charge_id?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    if (!invoices) return { total: 0, paid: 0, open: 0, overdue: 0, totalPaidCents: 0 };
    let paid = 0, open = 0, overdue = 0, totalPaidCents = 0;
    for (const inv of invoices) {
      if (inv.status === "paid") { paid++; totalPaidCents += inv.amount_cents; }
      else if (inv.status === "open") open++;
      else if (inv.status === "uncollectible") overdue++;
    }
    return { total: invoices.length, paid, open, overdue, totalPaidCents };
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-card-foreground flex items-center gap-2">
            <FileText className="size-6 text-blue-500" />
            Faturas e Cobranças
          </h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe todas as invoices geradas pelo sistema de billing da plataforma.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Total de Faturas</p>
          <p className="text-2xl font-bold text-card-foreground mt-1">{stats.total}</p>
        </GlassCard>
        <GlassCard className="p-5 border-emerald-500/20">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Receita Confirmada</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatBRL(stats.totalPaidCents)}</p>
        </GlassCard>
        <GlassCard className="p-5 border-amber-500/20">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Abertas / Pendentes</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.open}</p>
        </GlassCard>
        <GlassCard className="p-5 border-red-500/20">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">Inadimplentes</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.overdue}</p>
        </GlassCard>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Buscar por assinante, descrição ou ID da cobrança..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="all">Todos os Status</option>
              <option value="paid">Pagas</option>
              <option value="open">Abertas</option>
              <option value="draft">Rascunho</option>
              <option value="void">Canceladas</option>
              <option value="uncollectible">Inadimplentes</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando faturas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma fatura encontrada{search || statusFilter !== "all" ? " com os filtros aplicados" : ""}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Assinante</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Período</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Valor</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Emissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-card-foreground">{inv.accounts?.name ?? "Desconhecido"}</p>
                      {inv.accounts?.email && (
                        <p className="text-xs text-muted-foreground">{inv.accounts.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="truncate text-card-foreground">{inv.description ?? "—"}</p>
                      {inv.gateway_charge_id && (
                        <p className="text-[10px] font-mono text-muted-foreground">{inv.gateway_charge_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(inv.period_start)} → {formatDate(inv.period_end)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-card-foreground">
                      {formatBRL(inv.amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(inv.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}



