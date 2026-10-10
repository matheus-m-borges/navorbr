import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { RelatoriosComerciais } from "@/components/navor-rephub/RelatoriosComerciais";
import { GlassCard, KpiCard, PrimaryButton, SectionTitle, SelectInput } from "@/components/navor-rephub/ui";
import { currency, FUNNEL_STAGES, LOST_STATUSES, UF_LIST } from "@/lib/crm";
import { useBrands, useLeads } from "@/hooks/useCrm";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios comerciais | CRM Representação" },
      {
        name: "description",
        content:
          "Relatórios de leads por período, marca, origem e região, com taxa de conversão, motivos de recusa e exportação em CSV.",
      },
      { property: "og:title", content: "Relatórios comerciais | CRM Representação" },
      {
        property: "og:description",
        content: "Análise de conversão, positivação e desempenho por marca e região.",
      },
    ],
  }),
  component: RelatoriosPage,
});

const COLORS = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#60a5fa"];

function RelatoriosPage() {
  const { data: leads = [] } = useLeads();
  const { data: brands = [] } = useBrands();
  const [days, setDays] = useState("90");
  const [brand, setBrand] = useState("");
  const [uf, setUf] = useState("");

  const filtered = useMemo(() => {
    const limit = days === "all" ? 0 : Date.now() - Number(days) * 86400000;
    return leads.filter((l) => {
      if (limit && new Date(l.entry_at).getTime() < limit) return false;
      if (uf && l.state !== uf) return false;
      if (brand && !(l.lead_brands ?? []).some((lb) => lb.brands?.brand === brand)) return false;
      return true;
    });
  }, [leads, days, brand, uf]);

  const positivados = filtered.filter((l) => l.status === "Positivado");
  const perdidos = filtered.filter((l) => LOST_STATUSES.includes(l.status as never));
  const conversion = filtered.length ? (positivados.length / filtered.length) * 100 : 0;
  const sold = positivados.reduce((s, l) => s + (l.effective_value ?? l.estimated_value ?? 0), 0);
  const pipeline = filtered
    .filter((l) => !LOST_STATUSES.includes(l.status as never) && l.status !== "Positivado")
    .reduce((s, l) => s + (l.estimated_value ?? 0), 0);

  const byBrand = useMemo(() => {
    const map = new Map<string, { name: string; leads: number; positivados: number }>();
    for (const l of filtered) {
      for (const lb of l.lead_brands ?? []) {
        const name = lb.brands?.brand;
        if (!name) continue;
        const cur = map.get(name) ?? { name, leads: 0, positivados: 0 };
        cur.leads += 1;
        if (l.status === "Positivado") cur.positivados += 1;
        map.set(name, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.leads - a.leads);
  }, [filtered]);

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of filtered) map.set(l.source, (map.get(l.source) ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byState = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of filtered) map.set(l.state ?? "—", (map.get(l.state ?? "—") ?? 0) + 1);
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of perdidos) {
      const r = l.loss_reason ?? "Não informado";
      map.set(r, (map.get(r) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [perdidos]);

  const funnel = FUNNEL_STAGES.map((s) => ({
    name: s,
    value: filtered.filter((l) => l.status === s).length,
  }));

  function exportCsv() {
    const header = [
      "Empresa",
      "CNPJ",
      "Cidade",
      "UF",
      "Contato",
      "Telefone",
      "Origem",
      "Status",
      "Marcas",
      "Catálogo enviado",
      "Positivado",
      "Valor estimado",
      "Valor efetivo",
      "Motivo da recusa",
      "Entrada",
    ];
    const rows = filtered.map((l) => [
      l.company_name,
      l.cnpj ?? "",
      l.city ?? "",
      l.state ?? "",
      l.contact_name ?? "",
      l.phone ?? "",
      l.source,
      l.status,
      (l.lead_brands ?? []).map((lb) => lb.brands?.brand).filter(Boolean).join(" | "),
      l.catalog_sent ? "Sim" : "Não",
      l.positivado,
      l.estimated_value ?? "",
      l.effective_value ?? "",
      l.loss_reason ?? "",
      new Date(l.entry_at).toLocaleString("pt-BR"),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Relatórios"
      subtitle="Desempenho comercial por período, marca e região"
      actions={<PrimaryButton onClick={exportCsv}>Exportar CSV</PrimaryButton>}
    >
      <GlassCard className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectInput value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Últimos 12 meses</option>
            <option value="all">Todo o período</option>
          </SelectInput>
          <SelectInput value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Todas as marcas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.brand}>
                {b.brand}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">Todos os estados</option>
            {UF_LIST.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </SelectInput>
        </div>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Leads no período" value={String(filtered.length)} />
        <KpiCard label="Positivados" value={String(positivados.length)} tone="brand" />
        <KpiCard label="Taxa de conversão" value={`${conversion.toFixed(1)}%`} tone="cyan" />
        <KpiCard label="Valor vendido" value={currency(sold)} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <SectionTitle title="Leads e positivações por marca" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBrand}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="leads" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                <Bar dataKey="positivados" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Leads por origem" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bySource} dataKey="value" nameKey="name" outerRadius={95} innerRadius={55}>
                  {bySource.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Funil de vendas" hint={`Pipeline em aberto: ${currency(pipeline)}`} />
          <div className="space-y-2">
            {funnel.map((f) => {
              const max = Math.max(...funnel.map((x) => x.value), 1);
              return (
                <div key={f.name}>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{f.name}</span>
                    <span>{f.value}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-ink-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-brand to-cyan"
                      style={{ width: `${(f.value / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Motivos de recusa" hint={`${perdidos.length} leads perdidos`} />
          <div className="space-y-2">
            {byReason.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma recusa registrada no período.</p>
            ) : (
              byReason.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between rounded-xl border border-border bg-ink-2/40 px-3 py-2 text-xs"
                >
                  <span className="text-card-foreground">{r.name}</span>
                  <span className="text-muted-foreground">{r.value}</span>
                </div>
              ))
            )}
          </div>

          <div className="mt-5">
            <SectionTitle title="Leads por estado" />
            <div className="space-y-1.5">
              {byState.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <span className="text-card-foreground">{s.name}</span>
                  <span className="text-muted-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      <RelatoriosComerciais />
    </AppShell>
  );
}
