import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { VendasResumo } from "@/components/navor-rephub/VendasResumo";
import { Chip, GlassCard, GhostButton, KpiCard, SectionTitle, StatusBadge } from "@/components/navor-rephub/ui";
import { useLeads, useSettings, useTasks } from "@/hooks/useCrm";
import { useRadarColecoes } from "@/hooks/useRadar";
import {
  currency,
  daysSince,
  formatDate,
  FUNNEL_STAGES,
  LOST_STATUSES,
  whatsappLink,
  fillTemplate,
  DEFAULT_WHATSAPP_TEMPLATE,
} from "@/lib/crm";
import { useRepresentation } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard comercial | CRM Representação" },
      {
        name: "description",
        content:
          "Indicadores de leads, conversão, valor em negociação e leads sem retorno da sua representação comercial.",
      },
      { property: "og:title", content: "Dashboard comercial | CRM Representação" },
      {
        property: "og:description",
        content: "Acompanhe leads, funil de vendas e follow-ups pendentes em um só lugar.",
      },
    ],
  }),
  component: Dashboard,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function Dashboard() {
  const { data: leads = [], isLoading } = useLeads();
  const alerts = useRadarColecoes();
  const activeAlerts = alerts.filter(a => a.status === "active");
  const { data: tasks = [] } = useTasks();
  const { data: settings } = useSettings();
  const noReturnDays = Number(settings?.["no_return_days"] ?? 3);
  const template = (settings?.["whatsapp_template"] as string) ?? DEFAULT_WHATSAPP_TEMPLATE;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = now.getTime() - 7 * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const total = leads.length;
  const today = leads.filter((l) => new Date(l.entry_at).getTime() >= startOfToday).length;
  const week = leads.filter((l) => new Date(l.entry_at).getTime() >= weekAgo).length;
  const month = leads.filter((l) => new Date(l.entry_at).getTime() >= startOfMonth).length;
  const negotiating = leads.filter((l) => l.status === "Em negociação");
  const waiting = leads.filter((l) => l.status === "Aguardando retorno").length;
  const positivados = leads.filter((l) => l.status === "Positivado");
  const lost = leads.filter((l) => LOST_STATUSES.includes(l.status as never)).length;

  const stale = leads
    .filter(
      (l) =>
        !LOST_STATUSES.includes(l.status as never) &&
        l.status !== "Positivado" &&
        (daysSince(l.last_interaction_at ?? l.entry_at) ?? 0) >= noReturnDays,
    )
    .sort(
      (a, b) =>
        (daysSince(b.last_interaction_at ?? b.entry_at) ?? 0) -
        (daysSince(a.last_interaction_at ?? a.entry_at) ?? 0),
    );
  const stale7 = stale.filter((l) => (daysSince(l.last_interaction_at ?? l.entry_at) ?? 0) >= 7);

  const overdueTasks = tasks.filter(
    (t) => t.status === "Pendente" && new Date(t.due_at).getTime() < now.getTime(),
  );

  const pipelineValue = negotiating.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
  const soldValue = positivados.reduce((s, l) => s + (l.effective_value ?? l.estimated_value ?? 0), 0);
  const conversion = total > 0 ? (positivados.length / total) * 100 : 0;

  // Leads por mês (últimos 6)
  const monthly: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    monthly.push({
      label: MONTHS[d.getMonth()] ?? "",
      count: leads.filter((l) => {
        const t = new Date(l.entry_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length,
    });
  }
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.count));

  const bySource = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.source] = (acc[l.source] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxSource = Math.max(1, ...bySource.map(([, v]) => v));

  const funnel = FUNNEL_STAGES.map((stage, i) => {
    const reachedFrom = FUNNEL_STAGES.slice(i);
    const count = leads.filter((l) => {
      if (stage === "Novo Lead") return true;
      return reachedFrom.includes(l.status as never) || (stage === "Positivado" && l.status === "Positivado");
    }).length;
    return { stage, count };
  });
  const funnelTop = Math.max(1, funnel[0]?.count ?? 1);

  const sourceTones = ["brand", "cyan", "violet", "amber", "rose", "muted"] as const;

  const { representation } = useRepresentation();
  const title = representation?.name || "Dashboard comercial";
  const subtitle = representation?.slogan || "Captar · Atender · Acompanhar · Negociar · Positivar · Fidelizar";

  return (
    <AppShell
      title={title}
      subtitle={subtitle}
    >
      {representation?.banner_url && (
        <section className="relative h-32 md:h-48 rounded-2xl overflow-hidden mb-6 border border-white/10">
          <img src={representation.banner_url} alt="Capa" className="absolute inset-0 w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-4">
            {representation.icon_url && (
              <img src={representation.icon_url} alt="Ícone" className="size-12 md:size-16 rounded-xl object-contain bg-ink p-1 ring-2 ring-white/20" />
            )}
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
              <p className="text-sm md:text-base text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </section>
      )}

      {!representation?.banner_url && (
        <div className="flex items-center gap-4 mb-6">
          {representation?.icon_url && (
            <img src={representation.icon_url} alt="Ícone" className="size-12 rounded-xl object-contain bg-ink p-1 ring-1 ring-white/10" />
          )}
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <GlassCard className="p-6 text-sm text-muted-foreground">Carregando indicadores...</GlassCard>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total de Leads" value={String(total)} hint={`${month} este mês`} />
        <KpiCard label="Leads novos hoje" value={String(today)} hint={`${week} nos últimos 7 dias`} tone="cyan" />
        <KpiCard
          label="Em negociação"
          value={String(negotiating.length)}
          hint={`${currency(pipelineValue)} potencial`}
          tone="cyan"
        />
        <KpiCard
          label="Positivados"
          value={String(positivados.length)}
          hint={`${currency(soldValue)} vendidos`}
        />
        <KpiCard label="Aguardando retorno" value={String(waiting)} hint="acompanhar de perto" tone="amber" />
        <KpiCard label="Leads sem retorno" value={String(stale.length)} hint={`+${noReturnDays} dias parados`} tone="rose" />
        <KpiCard label="Leads perdidos" value={String(lost)} hint="não quis / perdido / sem retorno" tone="muted" />
        <KpiCard
          label="Taxa de conversão"
          value={`${conversion.toFixed(1).replace(".", ",")}%`}
          hint="leads positivados / total"
          tone="violet"
        />
      </section>

      <VendasResumo />

      {activeAlerts.length > 0 ? (
         <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 backdrop-blur-xl">
           <div className="flex flex-wrap items-center justify-between gap-3">
             <div className="flex items-center gap-3">
               <div className="grid size-9 place-items-center rounded-xl bg-amber-500/20 text-amber-600">⚠️</div>
               <div>
                 <p className="text-sm font-semibold text-card-foreground">
                   Clientes sem pedido na coleção atual
                 </p>
                 <p className="text-xs text-muted-foreground">
                   {activeAlerts.length} clientes vinculados às marcas com coleções ativas ainda não possuem pedidos lançados.
                 </p>
               </div>
             </div>
             <Link to="/radar-colecoes">
               <GhostButton>Ver Clientes</GhostButton>
             </Link>
           </div>
         </section>
      ) : null}

      <section className="rounded-2xl border border-rose/30 bg-rose/[0.07] p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-rose/20 text-rose">⚠</div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">
                Leads que precisam de atenção
              </p>
              <p className="text-xs text-muted-foreground">
                {stale.length} leads sem retorno há mais de {noReturnDays} dias · {stale7.length} há
                mais de 7 dias · {overdueTasks.length} follow-ups vencidos
              </p>
            </div>
          </div>
          <Link to="/leads">
            <GhostButton>Ver todos</GhostButton>
          </Link>
        </div>

        {stale.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Nenhum lead parado. Tudo em acompanhamento.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {stale.slice(0, 6).map((lead) => {
              const days = daysSince(lead.last_interaction_at ?? lead.entry_at) ?? 0;
              const brand = lead.lead_brands?.[0]?.brands?.brand ?? null;
              const wa = whatsappLink(
                lead.whatsapp ?? lead.phone,
                fillTemplate(template, {
                  NOME: lead.contact_name,
                  MARCA: brand,
                  EMPRESA: lead.company_name,
                }),
              );
              return (
                <div key={lead.id} className="rounded-xl border border-border bg-ink-2/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/leads/$leadId"
                      params={{ leadId: lead.id }}
                      className="text-sm font-medium text-card-foreground hover:text-brand"
                    >
                      {lead.company_name}
                    </Link>
                    <Chip tone={days >= 7 ? "rose" : "amber"}>{days} dias</Chip>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {brand ?? "Sem marca"} · último contato{" "}
                    {formatDate(lead.last_interaction_at ?? lead.entry_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-brand/15 px-2 py-1 text-[11px] font-medium text-brand"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                    <Link
                      to="/leads/$leadId"
                      params={{ leadId: lead.id }}
                      className="rounded-md bg-secondary px-2 py-1 text-[11px] text-card-foreground"
                    >
                      Abrir lead
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-5">
          <SectionTitle title="Leads por mês" hint="últimos 6 meses" />
          <div className="mt-4 flex h-32 items-end gap-3">
            {monthly.map((m, i) => (
              <div key={m.label + i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-violet/40 to-violet"
                  style={{ height: `${Math.max(4, (m.count / maxMonthly) * 100)}%` }}
                  title={`${m.count} leads`}
                />
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Leads por origem" />
          <div className="mt-4 space-y-3">
            {bySource.map(([name, count], i) => (
              <div key={name}>
                <div className="flex justify-between text-xs">
                  <span className="text-card-foreground">{name}</span>
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full bg-${sourceTones[i % sourceTones.length]}`}
                    style={{ width: `${(count / maxSource) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Funil de vendas" hint="quantidade e percentual por etapa" />
          <div className="mt-4 space-y-2">
            {funnel.map((f, i) => (
              <div key={f.stage} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="truncate text-muted-foreground">{f.stage}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {f.count} · {Math.round((f.count / funnelTop) * 100)}%
                    </span>
                  </div>
                  <div
                    className={`h-6 rounded-md ${
                      i < 2
                        ? "bg-gradient-to-r from-cyan/60 to-cyan"
                        : i < 4
                          ? "bg-gradient-to-r from-violet/60 to-violet"
                          : "bg-gradient-to-r from-brand/60 to-brand"
                    }`}
                    style={{ width: `${Math.max(6, (f.count / funnelTop) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <section>
        <SectionTitle
          title="Pipeline de leads"
          hint="visão rápida — abra Leads para arrastar entre as etapas"
          action={
            <Link to="/leads">
              <GhostButton>Abrir pipeline</GhostButton>
            </Link>
          }
        />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {["Novo Lead", "Catálogo enviado", "Aguardando retorno", "Em negociação", "Positivado"].map(
            (status) => {
              const items = leads.filter((l) => l.status === status);
              return (
                <div key={status} className="w-56 shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-card-foreground">{status}</span>
                    <span className="rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.slice(0, 3).map((lead) => (
                      <Link
                        key={lead.id}
                        to="/leads/$leadId"
                        params={{ leadId: lead.id }}
                        className="glass block rounded-xl p-3 transition hover:-translate-y-0.5"
                      >
                        <p className="text-sm font-medium text-card-foreground">{lead.company_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {lead.lead_brands?.[0]?.brands?.brand ?? lead.source} · {lead.state ?? "—"}
                        </p>
                        {lead.estimated_value ? (
                          <p className="mt-1 text-[11px] text-brand">{currency(lead.estimated_value)}</p>
                        ) : null}
                      </Link>
                    ))}
                    {items.length === 0 ? (
                      <p className="px-1 text-[11px] text-muted-foreground">Nenhum lead</p>
                    ) : null}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <SectionTitle
            title="Follow-ups de hoje e atrasados"
            action={
              <Link to="/tarefas">
                <GhostButton>Ver tarefas</GhostButton>
              </Link>
            }
          />
          <div className="space-y-2">
            {tasks
              .filter((t) => t.status === "Pendente")
              .slice(0, 6)
              .map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-ink-2/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-card-foreground">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.task_type} · vence {formatDate(t.due_at)}
                    </p>
                  </div>
                  <Chip
                    tone={
                      t.priority === "Urgente" ? "rose" : t.priority === "Alta" ? "amber" : "muted"
                    }
                  >
                    {t.priority}
                  </Chip>
                </div>
              ))}
            {tasks.filter((t) => t.status === "Pendente").length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma tarefa pendente.</p>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Inteligência comercial" hint="cálculo automático sobre seus dados" />
          <ul className="space-y-2 text-xs text-card-foreground">
            <li className="rounded-lg border border-border bg-ink-2/40 p-3">
              Você possui <span className="font-semibold text-rose">{stale.length}</span> leads sem
              retorno.
            </li>
            <li className="rounded-lg border border-border bg-ink-2/40 p-3">
              {negotiating.length} leads em negociação com potencial estimado de{" "}
              <span className="font-semibold text-brand">{currency(pipelineValue)}</span>.
            </li>
            <li className="rounded-lg border border-border bg-ink-2/40 p-3">
              Origem que mais gera leads:{" "}
              <span className="font-semibold text-cyan">{bySource[0]?.[0] ?? "—"}</span> (
              {bySource[0]?.[1] ?? 0} leads).
            </li>
            <li className="rounded-lg border border-border bg-ink-2/40 p-3">
              Marca mais procurada:{" "}
              <span className="font-semibold text-violet">
                {mostRequestedBrand(leads) ?? "—"}
              </span>
              .
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {positivados.slice(0, 3).map((l) => (
              <StatusBadge key={l.id} status="Positivado" />
            ))}
          </div>
        </GlassCard>
      </section>
    </AppShell>
  );
}

function mostRequestedBrand(leads: { lead_brands?: { brands: { brand: string } | null }[] }[]) {
  const counts: Record<string, number> = {};
  for (const l of leads)
    for (const lb of l.lead_brands ?? []) {
      const b = lb.brands?.brand;
      if (b) counts[b] = (counts[b] ?? 0) + 1;
    }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}
