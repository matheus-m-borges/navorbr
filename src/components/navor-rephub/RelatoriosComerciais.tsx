import { useMemo, useState } from "react";
import { GhostButton, GlassCard, SectionTitle, SelectInput } from "./ui";
import { TableShell, Td, Tr } from "./repui";
import { currency, formatDate } from "@/lib/crm";
import { pct, sumMoney } from "@/lib/rep";
import { useCommissions, useInvoices, useOrders } from "@/hooks/useRep";

function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Relatórios de vendas, comissões e comparação de coleções. */
export function RelatoriosComerciais() {
  const { data: orders = [] } = useOrders();
  const { data: invoices = [] } = useInvoices();
  const { data: commissions = [] } = useCommissions();
  const [period, setPeriod] = useState("365");

  const valid = useMemo(() => {
    const rows = orders.filter((o) => o.status !== "Cancelado");
    if (period === "all") return rows;
    const limit = Date.now() - Number(period) * 86400000;
    return rows.filter((o) => new Date(`${o.order_date}T12:00:00`).getTime() >= limit);
  }, [orders, period]);

  const byCollection = useMemo(() => {
    const map = new Map<
      string,
      { name: string; brand: string; value: number; pieces: number; count: number }
    >();
    for (const o of valid) {
      const key = o.collection_id;
      const cur =
        map.get(key) ??
        { name: o.collections?.name ?? "—", brand: o.brands?.brand ?? "—", value: 0, pieces: 0, count: 0 };
      cur.value += Number(o.total_value ?? 0);
      cur.pieces += Number(o.total_pieces ?? 0);
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [valid]);

  const byFactory = useMemo(() => {
    const map = new Map<string, { name: string; value: number; commission: number; received: number }>();
    for (const o of valid) {
      const key = o.factory_id ?? "sem";
      const cur =
        map.get(key) ??
        {
          name: o.factories?.trade_name ?? o.factories?.legal_name ?? "Sem fábrica",
          value: 0,
          commission: 0,
          received: 0,
        };
      cur.value += Number(o.total_value ?? 0);
      map.set(key, cur);
    }
    for (const c of commissions) {
      const key = c.factory_id ?? "sem";
      const cur = map.get(key);
      if (!cur) continue;
      cur.commission += Number(c.potential_amount ?? 0);
      cur.received += Number(c.received_amount ?? 0);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [valid, commissions]);

  const totalOrders = sumMoney(valid, (o) => o.total_value);
  const totalInvoiced = sumMoney(invoices, (i) => i.invoiced_value);

  return (
    <div className="grid gap-4">
      <GlassCard className="p-4">
        <SectionTitle
          title="Relatório de vendas por coleção"
          hint={`${valid.length} pedidos · ${currency(totalOrders)} · faturado ${currency(totalInvoiced)}`}
          action={
            <div className="flex gap-2">
              <SelectInput
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="max-w-44"
              >
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="365">Últimos 12 meses</option>
                <option value="all">Todo o período</option>
              </SelectInput>
              <GhostButton
                onClick={() =>
                  downloadCsv(
                    "vendas-por-colecao",
                    ["Coleção", "Marca", "Pedidos", "Peças", "Valor"],
                    byCollection.map((c) => [c.name, c.brand, c.count, c.pieces, c.value.toFixed(2)]),
                  )
                }
              >
                Exportar
              </GhostButton>
            </div>
          }
        />
        {byCollection.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum pedido no período.</p>
        ) : (
          <TableShell head={["Coleção", "Marca", "Pedidos", "Peças", "Valor", "Participação"]}>
            {byCollection.map((c) => (
              <Tr key={c.name + c.brand}>
                <Td className="text-card-foreground">{c.name}</Td>
                <Td className="text-muted-foreground">{c.brand}</Td>
                <Td className="tabular-nums text-muted-foreground">{c.count}</Td>
                <Td className="tabular-nums text-muted-foreground">{c.pieces}</Td>
                <Td className="tabular-nums text-card-foreground">{currency(c.value)}</Td>
                <Td className="tabular-nums text-muted-foreground">
                  {pct(c.value, totalOrders).toFixed(1)}%
                </Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </GlassCard>

      <GlassCard className="p-4">
        <SectionTitle
          title="Relatório de comissões por fábrica"
          hint="Previsto x recebido no período selecionado"
          action={
            <GhostButton
              onClick={() =>
                downloadCsv(
                  "comissoes-por-fabrica",
                  ["Fábrica", "Vendas", "Comissão prevista", "Comissão recebida"],
                  byFactory.map((f) => [
                    f.name,
                    f.value.toFixed(2),
                    f.commission.toFixed(2),
                    f.received.toFixed(2),
                  ]),
                )
              }
            >
              Exportar
            </GhostButton>
          }
        />
        {byFactory.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados no período.</p>
        ) : (
          <TableShell head={["Fábrica", "Vendas", "Comissão prevista", "Recebida", "% recebido"]}>
            {byFactory.map((f) => (
              <Tr key={f.name}>
                <Td className="text-card-foreground">{f.name}</Td>
                <Td className="tabular-nums text-muted-foreground">{currency(f.value)}</Td>
                <Td className="tabular-nums text-card-foreground">{currency(f.commission)}</Td>
                <Td className="tabular-nums text-muted-foreground">{currency(f.received)}</Td>
                <Td className="tabular-nums text-muted-foreground">
                  {pct(f.received, f.commission).toFixed(0)}%
                </Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </GlassCard>

      <GlassCard className="p-4">
        <SectionTitle
          title="Últimos faturamentos"
          hint="Notas emitidas e liquidação"
          action={
            <GhostButton
              onClick={() =>
                downloadCsv(
                  "faturamentos",
                  ["NF", "Emissão", "Cliente", "Marca", "Valor", "Pago"],
                  invoices.map((i) => [
                    i.nf_number ?? "—",
                    i.issue_date,
                    i.clients?.trade_name ?? i.clients?.legal_name ?? "",
                    i.brands?.brand ?? "",
                    Number(i.invoiced_value ?? 0).toFixed(2),
                    sumMoney(i.invoice_installments ?? [], (p) => p.paid_amount).toFixed(2),
                  ]),
                )
              }
            >
              Exportar
            </GhostButton>
          }
        />
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma nota fiscal lançada.</p>
        ) : (
          <TableShell head={["NF", "Emissão", "Cliente", "Marca", "Valor", "Pago"]}>
            {invoices.slice(0, 15).map((i) => (
              <Tr key={i.id}>
                <Td className="text-card-foreground">{i.nf_number}</Td>
                <Td className="text-muted-foreground">{formatDate(i.issue_date)}</Td>
                <Td className="text-muted-foreground">
                  {i.clients?.trade_name ?? i.clients?.legal_name ?? "—"}
                </Td>
                <Td className="text-muted-foreground">{i.brands?.brand ?? "—"}</Td>
                <Td className="tabular-nums text-card-foreground">
                  {currency(Number(i.invoiced_value ?? 0))}
                </Td>
                <Td className="tabular-nums text-muted-foreground">
                  {currency(sumMoney(i.invoice_installments ?? [], (p) => p.paid_amount))}
                </Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </GlassCard>
    </div>
  );
}
