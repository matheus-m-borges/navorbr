import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { NovoLeadDialog } from "@/components/navor-rephub/NovoLeadDialog";
import {
  Chip,
  EmptyState,
  Field,
  GhostButton,
  GlassCard,
  Modal,
  PrimaryButton,
  SectionTitle,
  SelectInput,
  ShowAllToggle,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import {
  currency,
  daysSince,
  formatDate,
  LEAD_STATUSES,
  UF_LIST,
} from "@/lib/crm";
import { useBrands, useLeads, useLeadSources, useLossReasons, useSettings } from "@/hooks/useCrm";
import type { Lead } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";
import { changeLeadStatus } from "@/lib/leadActions";
import { useRemoveRecord } from "@/lib/registro";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/leads")({
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined } => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Leads e pipeline | CRM Representação" },
      {
        name: "description",
        content:
          "Pipeline visual de leads por etapa: novo lead, catálogo enviado, aguardando retorno, negociação e positivação.",
      },
      { property: "og:title", content: "Leads e pipeline | CRM Representação" },
      {
        property: "og:description",
        content: "Arraste leads entre etapas, filtre por marca, origem, cidade e responsável.",
      },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { q } = Route.useSearch();
  const qc = useQueryClient();
  const { data: leads = [], isLoading } = useLeads();
  const { data: brands = [] } = useBrands();
  const { data: sources = [] } = useLeadSources();
  const { data: reasons = [] } = useLossReasons();
  const { data: settings } = useSettings();
  const { user } = useCurrentUser();
  const removeRecord = useRemoveRecord();

  const [novoLead, setNovoLead] = useState(false);
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [search, setSearch] = useState(q ?? "");

  useEffect(() => {
    if (q !== undefined) setSearch(q);
  }, [q]);
  const [filters, setFilters] = useState({
    brand: "",
    source: "",
    state: "",
    city: "",
    status: "hide_all",
    catalog: "",
    stale: "",
    positivado: "",
  });
  const [lossModal, setLossModal] = useState<{ lead: Lead; to: string } | null>(null);
  const [lossForm, setLossForm] = useState({ reason: "", notes: "" });
  const [dragging, setDragging] = useState<string | null>(null);

  const noReturnDays = Number(settings?.["no_return_days"] ?? 3);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (term) {
        const hay = [
          l.company_name,
          l.legal_name,
          l.trade_name,
          l.cnpj,
          l.contact_name,
          l.phone,
          l.whatsapp,
          l.email,
          l.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (filters.brand && !(l.lead_brands ?? []).some((b) => b.brands?.id === filters.brand))
        return false;
      if (filters.source && l.source !== filters.source) return false;
      if (filters.state && l.state !== filters.state) return false;
      if (filters.city && !(l.city ?? "").toLowerCase().includes(filters.city.toLowerCase()))
        return false;
      if (filters.status !== "hide_all" && filters.status !== "all" && l.status !== filters.status) return false;
      if (filters.catalog === "sim" && !l.catalog_sent) return false;
      if (filters.catalog === "nao" && l.catalog_sent) return false;
      if (filters.positivado && l.positivado !== filters.positivado) return false;
      if (filters.stale === "sim") {
        const d = daysSince(l.last_interaction_at ?? l.entry_at) ?? 0;
        if (d < noReturnDays) return false;
      }
      return true;
    });
  }, [leads, search, filters, noReturnDays]);

  async function applyStatus(lead: Lead, to: string, extra?: { reason?: string; notes?: string }) {
    try {
      await changeLeadStatus({
        lead,
        to,
        userName: user?.name ?? null,
        userId: user?.id ?? null,
        lossReason: extra?.reason ?? null,
        lossNotes: extra?.notes ?? null,
        followupDays: Number(settings?.["followup_days_after_catalog"] ?? 2),
      });
      void qc.invalidateQueries({ queryKey: ["leads"] });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(`Lead movido para "${to}".`);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível alterar a etapa");
    }
  }

  function onDrop(status: string) {
    const lead = leads.find((l) => l.id === dragging);
    setDragging(null);
    if (!lead || lead.status === status) return;
    if (status === "Não quis" || status === "Perdido") {
      setLossForm({ reason: "", notes: "" });
      setLossModal({ lead, to: status });
      return;
    }
    void applyStatus(lead, status);
  }

  return (
    <AppShell
      title="Leads"
      subtitle={`${filtered.length} de ${leads.length} leads · arraste os cartões para atualizar a etapa`}
      actions={
        <div className="flex gap-2">
          <GhostButton
            onClick={() => setView("kanban")}
            className={view === "kanban" ? "border-brand/40 text-brand" : ""}
          >
            Kanban
          </GhostButton>
          <GhostButton
            onClick={() => setView("lista")}
            className={view === "lista" ? "border-brand/40 text-brand" : ""}
          >
            Lista
          </GhostButton>
          <PrimaryButton onClick={() => setNovoLead(true)}>+ Novo lead</PrimaryButton>
        </div>
      }
    >
      <NovoLeadDialog open={novoLead} onClose={() => setNovoLead(false)} />
      <GlassCard className="p-4">
        <SectionTitle 
          title="Filtros e pesquisa" 
          hint="CNPJ, razão social, contato, telefone" 
          action={
            <ShowAllToggle 
              showAll={filters.status !== "hide_all"} 
              onToggle={(v) => setFilters({ ...filters, status: v ? "all" : "hide_all" })} 
            />
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <Field label="Pesquisa rápida" className="sm:col-span-2">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por empresa, CNPJ, contato, telefone..."
            />
          </Field>
          <Field label="Marca / Fábrica">
            <SelectInput
              value={filters.brand}
              onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
            >
              <option value="">Todas</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brand} — {b.company_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Origem">
            <SelectInput
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            >
              <option value="">Todas</option>
              {sources.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Estado">
            <SelectInput
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            >
              <option value="">Todos</option>
              {UF_LIST.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cidade">
            <TextInput
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              placeholder="Cidade"
            />
          </Field>
          <Field label="Etapa">
            <SelectInput
              value={filters.status === "hide_all" ? "all" : filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="all">Todas as etapas</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Catálogo enviado">
            <SelectInput
              value={filters.catalog}
              onChange={(e) => setFilters({ ...filters, catalog: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </SelectInput>
          </Field>
          <Field label="Sem retorno">
            <SelectInput
              value={filters.stale}
              onChange={(e) => setFilters({ ...filters, stale: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="sim">Somente parados</option>
            </SelectInput>
          </Field>
        </div>
      </GlassCard>

      {isLoading ? (
        <GlassCard className="p-6 text-sm text-muted-foreground">Carregando leads...</GlassCard>
      ) : filters.status === "hide_all" && !search && Object.values(filters).filter(k => k !== "hide_all").every(v => !v) ? (
        <EmptyState
          title="Pesquise para listar"
          hint="Selecione uma etapa ou filtro acima para carregar o quadro de leads."
        />
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {LEAD_STATUSES.map((status) => {
            const items = filtered.filter((l) => l.status === status);
            return (
              <div
                key={status}
                className="w-64 shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(status)}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-card-foreground">{status}</span>
                  <span className="rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
                <div className="min-h-24 space-y-2 rounded-xl border border-dashed border-border/60 p-1.5">
                  {items.map((lead) => {
                    const days = daysSince(lead.last_interaction_at ?? lead.entry_at) ?? 0;
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDragging(lead.id)}
                        className="glass cursor-grab rounded-xl p-3 transition hover:-translate-y-0.5 active:cursor-grabbing"
                      >
                        <Link
                          to="/leads/$leadId"
                          params={{ leadId: lead.id }}
                          className="text-sm font-medium text-card-foreground hover:text-brand"
                        >
                          {lead.company_name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {lead.city ?? "—"} · {lead.state ?? "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {(lead.lead_brands ?? []).slice(0, 2).map((lb) => (
                            <Chip key={lb.brand_id} tone="violet">
                              {lb.brands?.brand}
                            </Chip>
                          ))}
                          <Chip tone="cyan">{lead.source}</Chip>
                          {days >= noReturnDays &&
                          lead.status !== "Positivado" &&
                          !["Não quis", "Perdido", "Sem retorno"].includes(lead.status) ? (
                            <Chip tone={days >= 7 ? "rose" : "amber"}>{days}d sem retorno</Chip>
                          ) : null}
                        </div>
                        {lead.estimated_value ? (
                          <p className="mt-2 text-[11px] font-medium text-brand">
                            {currency(lead.effective_value ?? lead.estimated_value)}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                  {items.length === 0 ? (
                    <p className="px-2 py-3 text-[11px] text-muted-foreground">Solte um lead aqui</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Cidade/UF</th>
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Sem retorno</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const days = daysSince(lead.last_interaction_at ?? lead.entry_at) ?? 0;
                  return (
                    <tr key={lead.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          to="/leads/$leadId"
                          params={{ leadId: lead.id }}
                          className="font-medium text-card-foreground hover:text-brand"
                        >
                          {lead.company_name}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">
                          {lead.contact_name ?? "—"} · {formatDate(lead.entry_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {lead.city ?? "—"}/{lead.state ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {(lead.lead_brands ?? []).map((b) => b.brands?.brand).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.source}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {days >= noReturnDays ? (
                          <span className={days >= 7 ? "text-rose" : "text-amber"}>{days} dias</span>
                        ) : (
                          <span className="text-muted-foreground">em dia</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-card-foreground tabular-nums">
                        {currency(lead.effective_value ?? lead.estimated_value)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex justify-end gap-1">
                          <Link to="/leads/$leadId" params={{ leadId: lead.id }}>
                            <GhostButton className="px-2 py-1">Editar</GhostButton>
                          </Link>
                          {user?.role === "admin" ? (
                            <GhostButton
                              className="border-rose/30 px-2 py-1 text-rose"
                              onClick={() =>
                                void removeRecord({
                                  table: "leads",
                                  id: lead.id,
                                  label: `o lead ${lead.company_name}`,
                                  keys: ["leads", "tasks", "notifications"],
                                })
                              }
                            >
                              Excluir
                            </GhostButton>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>

          <div className="divide-y divide-border/50 md:hidden">
            {filtered.map((lead) => (
              <Link
                key={lead.id}
                to="/leads/$leadId"
                params={{ leadId: lead.id }}
                className="block p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-card-foreground">{lead.company_name}</p>
                  <StatusBadge status={lead.status} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {lead.city ?? "—"}/{lead.state ?? "—"} · {lead.source} ·{" "}
                  {currency(lead.effective_value ?? lead.estimated_value)}
                </p>
              </Link>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nenhum lead encontrado" hint="Ajuste os filtros ou cadastre um novo lead." />
            </div>
          ) : null}
        </GlassCard>
      )}

      <Modal
        open={Boolean(lossModal)}
        onClose={() => setLossModal(null)}
        title={lossModal?.to === "Não quis" ? "Cliente não quis" : "Lead perdido"}
        subtitle="Informe o motivo para manter o histórico e os relatórios corretos."
      >
        <div className="space-y-3">
          <Field label="Motivo da recusa *">
            <SelectInput
              value={lossForm.reason}
              onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })}
            >
              <option value="">Selecione</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Observação da recusa">
            <TextArea
              value={lossForm.notes}
              onChange={(e) => setLossForm({ ...lossForm, notes: e.target.value })}
              maxLength={1000}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton
            onClick={() => {
              if (!lossModal) return;
              if (!lossForm.reason) {
                toast.error("Selecione o motivo da recusa");
                return;
              }
              void applyStatus(lossModal.lead, lossModal.to, {
                reason: lossForm.reason,
                notes: lossForm.notes,
              });
              setLossModal(null);
            }}
          >
            Salvar
          </PrimaryButton>
        </div>
      </Modal>
    </AppShell>
  );
}
