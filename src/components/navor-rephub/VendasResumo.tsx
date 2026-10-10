import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { GhostButton, GlassCard, KpiCard, SectionTitle } from "./ui";
import { currency } from "@/lib/crm";
import { pct, sumMoney } from "@/lib/rep";
import { useCommissions, useInvoices, useOrders, useCollections } from "@/hooks/useRep";
import { useSettings } from "@/hooks/useCrm";

function ranking(rows: { key: string; value: number; pieces: number }[]) {
  const map = new Map<string, { value: number; pieces: number }>();
  for (const r of rows) {
    const cur = map.get(r.key) ?? { value: 0, pieces: 0 };
    cur.value += r.value;
    cur.pieces += r.pieces;
    map.set(r.key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

/** Resumo comercial (pedidos, faturamento e comissões) exibido no dashboard. */
export function VendasResumo() {
  const { data: rawOrders = [] } = useOrders();
  const { data: rawInvoices = [] } = useInvoices();
  const { data: rawCommissions = [] } = useCommissions();
  const { data: collections = [] } = useCollections();
  const { data: settings } = useSettings();

  const hideClosed = settings?.["active_collections_only"] === "true";
  const { orders, invoices, commissions } = useMemo(() => {
    if (!hideClosed) return { orders: rawOrders, invoices: rawInvoices, commissions: rawCommissions };
    const activeCols = new Set(collections.filter((c) => c.status !== "Encerrada").map((c) => c.id));
    return {
      orders: rawOrders.filter((o) => o.collection_id && activeCols.has(o.collection_id)),
      invoices: rawInvoices.filter((i) => !i.collection_id || activeCols.has(i.collection_id)),
      commissions: rawCommissions.filter((c) => !c.collection_id || activeCols.has(c.collection_id)),
    };
  }, [rawOrders, rawInvoices, rawCommissions, collections, hideClosed]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const today = now.toISOString().slice(0, 10);

  const valid = orders.filter((o) => o.status !== "Cancelado");
  const inMonth = valid.filter((o) => new Date(`${o.order_date}T12:00:00`).getTime() >= monthStart);
  const inYear = valid.filter((o) => new Date(`${o.order_date}T12:00:00`).getTime() >= yearStart);

  const monthValue = sumMoney(inMonth, (o) => o.total_value);
  const yearValue = sumMoney(inYear, (o) => o.total_value);
  const pieces = valid.reduce((a, o) => a + Number(o.total_pieces ?? 0), 0);
  const avgTicket = valid.length ? sumMoney(valid, (o) => o.total_value) / valid.length : 0;

  const invoiced = sumMoney(invoices, (i) => i.invoiced_value);
  const installments = invoices.flatMap((i) => i.invoice_installments ?? []);
  const settled = sumMoney(installments, (p) => p.paid_amount);
  const overdue = installments.filter(
    (p) => p.status !== "Pago" && p.status !== "Cancelado" && p.due_date < today,
  );
  const overdueValue = sumMoney(overdue, (p) => Number(p.amount) - Number(p.paid_amount));

  const commissionPotential = sumMoney(commissions, (c) => c.potential_amount);
  const commissionPending = sumMoney(commissions, (c) => c.pending_amount);

  const openOrders = valid.filter((o) => !["Faturado", "Finalizado"].includes(o.status));

  const byBrand = useMemo(
    () =>
      ranking(
        valid.map((o) => ({
          key: o.brands?.brand ?? "—",
          value: Number(o.total_value ?? 0),
          pieces: Number(o.total_pieces ?? 0),
        })),
      ),
    [valid],
  );
  const byCollection = useMemo(
    () =>
      ranking(
        valid.map((o) => ({
          key: o.collections?.name ?? "—",
          value: Number(o.total_value ?? 0),
          pieces: Number(o.total_pieces ?? 0),
        })),
      ),
    [valid],
  );
  const byClient = useMemo(
    () =>
      ranking(
        valid.map((o) => ({
          key: o.clients?.trade_name ?? o.clients?.legal_name ?? "—",
          value: Number(o.total_value ?? 0),
          pieces: Number(o.total_pieces ?? 0),
        })),
      ),
    [valid],
  );

  if (orders.length === 0) return null;

  const maxBrand = Math.max(1, ...byBrand.map((b) => b.value));

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Vendas do mês" value={currency(monthValue)} hint={`${inMonth.length} pedidos`} />
        <KpiCard
          label="Vendas do ano"
          value={currency(yearValue)}
          tone="cyan"
          hint={`${inYear.length} pedidos`}
        />
        <KpiCard
          label="Peças vendidas"
          value={pieces.toLocaleString("pt-BR")}
          tone="violet"
          hint={`ticket médio ${currency(avgTicket)}`}
        />
        <KpiCard
          label="Faturado"
          value={currency(invoiced)}
          hint={`${pct(invoiced, sumMoney(valid, (o) => o.total_value)).toFixed(0)}% dos pedidos`}
        />
        <KpiCard
          label="Recebido (liquidez)"
          value={currency(settled)}
          tone="brand"
          hint={`${pct(settled, invoiced).toFixed(0)}% do faturado`}
        />
        <KpiCard
          label="Contas em atraso"
          value={currency(overdueValue)}
          tone={overdue.length ? "rose" : "muted"}
          hint={`${overdue.length} parcelas vencidas`}
        />
        <KpiCard
          label="Comissão prevista"
          value={currency(commissionPotential)}
          tone="violet"
          hint={`pendente ${currency(commissionPending)}`}
        />
        <KpiCard
          label="Pedidos em aberto"
          value={String(openOrders.length)}
          tone="amber"
          hint={currency(sumMoney(openOrders, (o) => o.total_value))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-5">
          <SectionTitle
            title="Vendas por marca"
            hint="top 5"
            action={
              <Link to="/pedidos">
                <GhostButton>Pedidos</GhostButton>
              </Link>
            }
          />
          <div className="space-y-3">
            {byBrand.map((b) => (
              <div key={b.key}>
                <div className="flex justify-between text-xs">
                  <span className="truncate text-card-foreground">{b.key}</span>
                  <span className="text-muted-foreground tabular-nums">{currency(b.value)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-brand/60 to-brand"
                    style={{ width: `${(b.value / maxBrand) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Vendas por coleção" hint="top 5" />
          <div className="space-y-2">
            {byCollection.map((c) => (
              <div
                key={c.key}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-ink-2/40 p-3"
              >
                <span className="min-w-0 truncate text-xs text-card-foreground">{c.key}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {currency(c.value)} · {c.pieces} pçs
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Melhores clientes" hint="por valor comprado" />
          <div className="space-y-2">
            {byClient.map((c, i) => (
              <div
                key={c.key}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-ink-2/40 p-3"
              >
                <span className="min-w-0 truncate text-xs text-card-foreground">
                  {i + 1}. {c.key}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{currency(c.value)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    </>
  );
}
