import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/navor-rephub/ui";
import { FileText, Download, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/(saas)/minha-conta/faturas")({
  component: MinhasFaturas,
});

interface MyInvoice {
  id: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  pdf_url: string | null;
  created_at: string;
}

const fetchMyInvoices = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Resolve account_id via membership — strict tenant isolation
  const { data: membership } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select("id, amount_cents, currency, description, period_start, period_end, status, pdf_url, created_at")
    .eq("account_id", membership.account_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as MyInvoice[];
});

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    paid: { label: "Paga", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    open: { label: "Aberta", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    void: { label: "Cancelada", icon: XCircle, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
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

function MinhasFaturas() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["my_invoices"],
    queryFn: () => fetchMyInvoices(),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando faturas...</div>;
  }

  if (!invoices || invoices.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-card-foreground">Nenhuma fatura encontrada</h3>
        <p className="mt-1 text-sm text-muted-foreground">Suas faturas aparecerão aqui assim que forem geradas.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-card-foreground">Minhas Faturas</h2>
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Descrição</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Período</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Valor</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Status</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Emissão</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-center">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 max-w-[250px]">
                    <p className="truncate text-card-foreground">{inv.description ?? "Fatura"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {inv.period_start ? new Intl.DateTimeFormat("pt-BR").format(new Date(inv.period_start)) : "—"}
                    {" → "}
                    {inv.period_end ? new Intl.DateTimeFormat("pt-BR").format(new Date(inv.period_end)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-card-foreground">
                    {formatBRL(inv.amount_cents)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Intl.DateTimeFormat("pt-BR").format(new Date(inv.created_at))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {inv.pdf_url ? (
                      <a
                        href={inv.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                      >
                        <Download className="size-3" />
                        Baixar
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}



