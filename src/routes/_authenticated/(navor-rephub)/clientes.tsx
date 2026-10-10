import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { ClienteComercial } from "@/components/navor-rephub/ClienteComercial";
import { PortalAccessPanel } from "@/components/navor-rephub/PortalAccessPanel";
import { ClientInterestPoints } from "@/components/navor-rephub/ClientInterestPoints";
import {
  Chip,
  DataRow,
  EmptyState,
  Field,
  GhostButton,
  GlassCard,
  Modal,
  PrimaryButton,
  SectionTitle,
  SelectInput,
  ShowAllToggle,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import {
  CLIENT_STATUSES,
  DEFAULT_WHATSAPP_TEMPLATE,
  fillTemplate,
  formatDate,
  normalizeClientStatus,
  UF_LIST,
  whatsappLink,
} from "@/lib/crm";
import { useRemoveRecord } from "@/lib/registro";
import { formatCnpj, lookupCnpj } from "@/lib/cnpj";
import { formatCep, lookupCep } from "@/lib/cep";
import { crmDb, useBrands, useClients, useSettings, type Client } from "@/hooks/useCrm";
import { useClientBrands } from "@/hooks/useRep";
import { useCurrentUser } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/clientes")({
  validateSearch: (search: Record<string, unknown>): { c?: string | undefined } => ({
    c: typeof search["c"] === "string" ? (search["c"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Clientes | CRM Representação" },
      {
        name: "description",
        content:
          "Cadastro completo de clientes da representação: dados fiscais, contatos, marcas de interesse e potencial de compra.",
      },
      { property: "og:title", content: "Clientes | CRM Representação" },
      {
        property: "og:description",
        content: "Base de clientes ativos, inativos e prospects com histórico comercial.",
      },
    ],
  }),
  component: ClientesPage,
});

const emptyForm = {
  legal_name: "",
  trade_name: "",
  cnpj: "",
  state_registration: "",
  segment: "",
  client_type: "Varejo",
  city: "",
  state: "SP",
  district: "",
  address: "",
  zip_code: "",
  contact_name: "",
  contact_role: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  status: "Ativo",
  purchase_potential: "Médio",
  source: "Indicação",
  notes: "",
  interest_brands: [] as string[],
};

function ClientesPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const { data: clients = [], isLoading } = useClients();
  const { data: brands = [] } = useBrands();
  const { data: settings } = useSettings();
  const { user } = useCurrentUser();
  const removeRecord = useRemoveRecord();

  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("hide_all");
  const [uf, setUf] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [selected, setSelected] = useState<string | null>(search.c ?? null);

  useEffect(() => {
    if (search.c) setSelected(search.c);
  }, [search.c]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !open) setSelected(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const [form, setForm] = useState(emptyForm);
  const [buyingBrands, setBuyingBrands] = useState<string[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const { data: clientBrands = [] } = useClientBrands();

  /** Consulta o CNPJ na base pública e preenche os campos do cadastro. */
  async function fillFromCnpj() {
    setLookingUp(true);
    try {
      const data = await lookupCnpj(form.cnpj);
      setForm((f) => ({
        ...f,
        cnpj: data.cnpj,
        legal_name: data.legal_name || f.legal_name,
        trade_name: data.trade_name || f.trade_name,
        state_registration: data.state_registration || f.state_registration,
        phone: data.phone || f.phone,
        email: data.email || f.email,
        zip_code: data.zip_code || f.zip_code,
        address: data.address || f.address,
        district: data.district || f.district,
        city: data.city || f.city,
        state: data.state || f.state,
        segment: data.segment || f.segment,
      }));
      toast.success(
        data.situation ? `Dados encontrados (${data.situation}).` : "Dados do CNPJ preenchidos.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLookingUp(false);
    }
  }

  /** Preenche o endereço automaticamente a partir do CEP. */
  async function fillFromCep(cep: string) {
    if (cep.replace(/\D/g, "").length !== 8) return;
    try {
      const d = await lookupCep(cep);
      setForm((f) => ({
        ...f,
        address: d.address || f.address,
        district: d.district || f.district,
        city: d.city || f.city,
        state: d.state || f.state,
      }));
    } catch {
      /* CEP não encontrado: segue o preenchimento manual. */
    }
  }

  /** Atualiza a lista de marcas que o cliente já compra. */
  async function syncBuyingBrands(clientId: string) {
    const current = clientBrands.filter((cb) => cb.client_id === clientId);
    const toRemove = current.filter((cb) => !buyingBrands.includes(cb.brand_id));
    const toAdd = buyingBrands.filter((id) => !current.some((cb) => cb.brand_id === id));
    if (toRemove.length > 0) {
      await crmDb
        .from("client_brands")
        .delete()
        .in("id", toRemove.map((cb) => cb.id));
    }
    if (toAdd.length > 0) {
      await crmDb
        .from("client_brands")
        .insert(toAdd.map((brand_id) => ({ client_id: clientId, brand_id })));
    }
    void qc.invalidateQueries({ queryKey: ["client-brands"] });
  }

  const template = (settings?.["whatsapp_template"] as string) ?? DEFAULT_WHATSAPP_TEMPLATE;

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return clients.filter((c) => {
      if (
        status !== "hide_all" &&
        status !== "all" &&
        normalizeClientStatus(c.status) !== normalizeClientStatus(status)
      )
        return false;
      if (uf && c.state !== uf) return false;
      if (!t) return true;
      return [c.legal_name, c.trade_name, c.cnpj, c.contact_name, c.phone, c.city]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [clients, term, status, uf]);

  /** Colunas do Kanban: situações oficiais + qualquer situação antiga em "Outros". */
  const kanbanGroups = useMemo(() => {
    const known = new Set<string>(CLIENT_STATUSES);
    const groups = CLIENT_STATUSES.map((statusGroup) => ({
      statusGroup: statusGroup as string,
      groupClients: filtered.filter((c) => normalizeClientStatus(c.status) === statusGroup),
    }));
    const others = filtered.filter((c) => !known.has(normalizeClientStatus(c.status)));
    if (others.length > 0) groups.push({ statusGroup: "Outros", groupClients: others });
    return groups;
  }, [filtered]);

  const current = clients.find((c) => c.id === selected) ?? null;

  function startNew() {
    setEditing(null);
    setForm(emptyForm);
    setBuyingBrands([]);
    setOpen(true);
  }

  function startEdit(c: Client) {
    setEditing(c);
    setForm({
      legal_name: c.legal_name ?? "",
      trade_name: c.trade_name ?? "",
      cnpj: c.cnpj ?? "",
      state_registration: c.state_registration ?? "",
      segment: c.segment ?? "",
      client_type: c.client_type ?? "Varejo",
      city: c.city ?? "",
      state: c.state ?? "SP",
      district: c.district ?? "",
      address: c.address ?? "",
      zip_code: c.zip_code ?? "",
      contact_name: c.contact_name ?? "",
      contact_role: c.contact_role ?? "",
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      email: c.email ?? "",
      instagram: c.instagram ?? "",
      status: c.status ?? "Ativo",
      purchase_potential: c.purchase_potential ?? "Médio",
      source: c.source ?? "Indicação",
      notes: c.notes ?? "",
      interest_brands: c.interest_brands ?? [],
    });
    setBuyingBrands(clientBrands.filter((cb) => cb.client_id === c.id).map((cb) => cb.brand_id));
    setOpen(true);
  }

  async function save() {
    if (!form.legal_name.trim()) {
      toast.error("Informe a razão social / nome do cliente");
      return;
    }
    const cnpj = form.cnpj.replace(/\D/g, "");
    if (cnpj) {
      const dup = clients.find(
        (c) => c.id !== editing?.id && (c.cnpj ?? "").replace(/\D/g, "") === cnpj,
      );
      if (dup) {
        toast.error(`CNPJ já cadastrado para ${dup.trade_name ?? dup.legal_name}.`);
        setSelected(dup.id);
        return;
      }
    }
    const payload = {
      ...form,
      legal_name: form.legal_name.trim(),
      trade_name: form.trade_name.trim() || null,
      cnpj: cnpj || null,
      state_registration: form.state_registration.trim() || null,
      segment: form.segment.trim() || null,
      city: form.city.trim() || null,
      district: form.district.trim() || null,
      address: form.address.trim() || null,
      zip_code: form.zip_code.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_role: form.contact_role.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      instagram: form.instagram.trim() || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      owner_name: editing?.owner_name ?? user?.name ?? null,
      ...(editing
        ? {}
        : { owner_id: user?.id ?? null, created_by: user?.id ?? null }),
    };
    const { data: saved, error } = editing
      ? await crmDb.from("clients").update(payload).eq("id", editing.id).select("id").maybeSingle()
      : await crmDb.from("clients").insert(payload).select("id").maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    const savedId = (saved as { id?: string } | null)?.id ?? editing?.id;
    if (savedId) await syncBuyingBrands(savedId);
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success(editing ? "Cliente atualizado." : "Cliente cadastrado.");
  }

  return (
    <AppShell
      title="Clientes"
      subtitle={`${clients.length} clientes cadastrados`}
      actions={<PrimaryButton onClick={startNew}>+ Novo cliente</PrimaryButton>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr] lg:h-[calc(100vh-140px)]">
        {/* COLUNA ESQUERDA: LISTA E FILTROS */}
        <div className="flex flex-col gap-4 lg:overflow-hidden">
          <GlassCard className="shrink-0 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-card-foreground">Filtros</span>
                <ShowAllToggle 
                  showAll={status !== "hide_all"} 
                  onToggle={(v) => setStatus(v ? "all" : "hide_all")} 
                />
              </div>
              <TextInput
                placeholder="Buscar por nome, CNPJ, contato, cidade..."
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
              <div className="flex gap-2">
                <SelectInput value={status === "hide_all" ? "all" : status} onChange={(e) => setStatus(e.target.value)} className="flex-1 w-0">

                  <option value="all">Todos os status</option>
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </SelectInput>
                <SelectInput value={uf} onChange={(e) => setUf(e.target.value)} className="flex-1 w-0">
                  <option value="">Todos os estados</option>
                  {UF_LIST.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </SelectInput>
              </div>
              <div className="flex bg-muted/30 p-1 rounded-lg border border-border">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex-1 rounded-md text-xs font-semibold py-1.5 transition-colors ${viewMode === "list" ? "bg-card shadow-sm text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setViewMode("kanban")}
                  className={`flex-1 rounded-md text-xs font-semibold py-1.5 transition-colors ${viewMode === "kanban" ? "bg-card shadow-sm text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Kanban
                </button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="flex-1 p-0 overflow-y-auto min-h-[300px]">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Carregando clientes...</p>
            ) : status === "hide_all" && !term && !uf ? (
              <EmptyState
                title="Pesquise para listar"
                hint="Selecione um status ou filtro acima para carregar os clientes."
              />
            ) : filtered.length === 0 ? (
              <EmptyState title="Nenhum cliente encontrado" hint="Ajuste os filtros ou cadastre um novo cliente." />
            ) : viewMode === "list" ? (
              <div className="divide-y divide-border">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-accent/60 ${
                      selected === c.id ? "bg-accent/70" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-card-foreground">
                        {c.legal_name}
                      </p>
                      <Chip
                        tone={
                          normalizeClientStatus(c.status) === "Cliente ativo"
                            ? "brand"
                            : normalizeClientStatus(c.status) === "Prospect"
                              ? "cyan"
                              : "muted"
                        }
                      >
                        {normalizeClientStatus(c.status)}
                      </Chip>
                      {c.purchase_potential ? <Chip tone="violet">{c.purchase_potential}</Chip> : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.trade_name ? `${c.legal_name} · ` : ""}
                      {c.city || "-"}/{c.state || "-"}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-4">
                {kanbanGroups.map(({ statusGroup, groupClients }) => {
                  if (statusGroup !== "Cliente ativo" && groupClients.length === 0 && status !== statusGroup) return null;

                  
                  return (
                    <div key={statusGroup} className="flex flex-col gap-3">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-card-foreground">{statusGroup}</h3>
                        <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-semibold">{groupClients.length}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {groupClients.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setSelected(c.id)}
                            className={`text-left rounded-xl border border-border p-3 transition shadow-sm hover:border-primary/30 ${selected === c.id ? "ring-2 ring-primary ring-offset-1 bg-card" : "bg-card"}`}
                          >
                            <p className="font-semibold text-sm text-card-foreground truncate">{c.legal_name}</p>
                            {c.trade_name && <p className="text-xs text-muted-foreground truncate">{c.trade_name}</p>}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span className="bg-muted px-1.5 py-0.5 rounded text-card-foreground truncate max-w-full">
                                {c.city || "—"}/{c.state || "—"}
                              </span>
                            </div>
                          </button>
                        ))}
                        {groupClients.length === 0 && (
                          <div className="border border-dashed border-border rounded-xl p-4 text-center text-xs text-muted-foreground bg-muted/10">
                            Nenhum cliente
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>

        {/* COLUNA DIREITA: DETALHES */}
        <div className="flex flex-col gap-4 lg:overflow-y-auto pb-4">
          {!current ? (
            <GlassCard className="p-5 h-full flex flex-col justify-center">
              <EmptyState title="Selecione um cliente" hint="Os detalhes, histórico e contatos aparecem aqui." />
            </GlassCard>
          ) : (
            <>
              <GlassCard className="p-5 shrink-0">
                <SectionTitle
                  title={current.trade_name || current.legal_name}
                  hint={current.segment ?? undefined}
                  action={
                    <span className="flex gap-2">
                      <GhostButton onClick={() => startEdit(current)}>Editar</GhostButton>
                      {user?.role === "admin" ? (
                        <GhostButton
                          className="border-rose/30 text-rose"
                          onClick={() =>
                            void removeRecord({
                              table: "clients",
                              id: current.id,
                              label: `o cliente ${current.trade_name || current.legal_name}`,
                              keys: ["clients", "orders", "commissions"],
                            }).then((ok) => {
                              if (ok) setSelected(null);
                            })
                          }
                        >
                          Excluir
                        </GhostButton>
                      ) : null}
                    </span>
                  }
                />
                <div className="grid sm:grid-cols-2 gap-x-8 mt-2">
                  <div className="flex flex-col">
                    <DataRow label="Razão social" value={current.legal_name || "—"} />
                    <DataRow label="CNPJ" value={current.cnpj || "—"} />
                    <DataRow label="Inscrição estadual" value={current.state_registration || "—"} />
                    <DataRow label="Tipo" value={current.client_type || "—"} />
                    <DataRow
                      label="Endereço"
                      value={[current.address, current.district, current.city, current.state, current.zip_code]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    />
                    <DataRow label="Origem" value={current.source || "—"} />
                    <DataRow label="Primeiro contato" value={formatDate(current.first_contact_date) || "—"} />
                  </div>
                  <div className="flex flex-col">
                    <DataRow label="Contato" value={current.contact_name ? `${current.contact_name} ${current.contact_role ? `(${current.contact_role})` : ""}` : "—"} />
                    <DataRow label="Telefone" value={current.phone || "—"} />
                    <DataRow label="E-mail" value={current.email || "—"} />
                    <DataRow label="Instagram" value={current.instagram || "—"} />
                    <DataRow
                      label="Marcas de interesse"
                      value={(current.interest_brands ?? []).join(", ") || "—"}
                    />
                    <DataRow label="Observações" value={current.notes || "—"} />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                    {whatsappLink(
                      current.whatsapp || current.phone,
                      fillTemplate(template, {
                        NOME: current.contact_name,
                        EMPRESA: current.trade_name || current.legal_name,
                      }),
                    ) ? (
                      <a
                        href={whatsappLink(
                          current.whatsapp || current.phone,
                          fillTemplate(template, {
                            NOME: current.contact_name,
                            EMPRESA: current.trade_name || current.legal_name,
                          }),
                        )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <GhostButton className="border-brand/30 text-brand">
                        <MessageCircle className="size-3.5" /> WhatsApp
                      </GhostButton>
                    </a>
                  ) : null}
                  {current.phone ? (
                    <a href={`tel:${current.phone}`}>
                      <GhostButton>
                        <Phone className="size-3.5" /> Ligar
                      </GhostButton>
                    </a>
                  ) : null}
                  {current.email ? (
                    <a href={`mailto:${current.email}`}>
                      <GhostButton>
                        <Mail className="size-3.5" /> E-mail
                      </GhostButton>
                    </a>
                  ) : null}
                </div>
              </GlassCard>

              <GlassCard className="p-4 shrink-0">
                <ClientInterestPoints clientId={current.id} />
              </GlassCard>

              <GlassCard className="p-4 shrink-0">
                <ClienteComercial clientId={current.id} />
              </GlassCard>

              {user?.role === "admin" ? (
                <GlassCard className="p-4 shrink-0">
                  <PortalAccessPanel
                    clientId={current.id}
                    clientName={current.trade_name || current.legal_name}
                    defaultEmail={current.email}
                    whatsapp={current.whatsapp || current.phone}
                  />
                </GlassCard>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar cliente" : "Novo cliente"}
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CNPJ — buscamos os dados automaticamente" className="sm:col-span-2">
            <div className="flex gap-2">
              <TextInput
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void fillFromCnpj();
                  }
                }}
              />
              <PrimaryButton
                className="shrink-0 whitespace-nowrap"
                disabled={lookingUp}
                onClick={() => void fillFromCnpj()}
              >
                {lookingUp ? "Buscando..." : "Buscar dados"}
              </PrimaryButton>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Digite o CNPJ e clique em Buscar dados: razão social, nome fantasia, endereço,
              telefone e atividade são preenchidos com a base pública da Receita Federal.
            </p>
          </Field>
          <Field label="Razão social *" className="sm:col-span-2">
            <TextInput
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Nome fantasia">
            <TextInput
              value={form.trade_name}
              onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Inscrição estadual">
            <TextInput
              value={form.state_registration}
              onChange={(e) => setForm({ ...form, state_registration: e.target.value })}
              maxLength={30}
            />
          </Field>
          <Field label="Segmento">
            <TextInput
              value={form.segment}
              onChange={(e) => setForm({ ...form, segment: e.target.value })}
              maxLength={60}
            />
          </Field>
          <Field label="Tipo de cliente">
            <SelectInput
              value={form.client_type}
              onChange={(e) => setForm({ ...form, client_type: e.target.value })}
            >
              {["Varejo", "Atacado", "Distribuidor", "Multimarcas", "E-commerce"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cidade">
            <TextInput
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              maxLength={80}
            />
          </Field>
          <Field label="Estado">
            <SelectInput value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              {UF_LIST.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Bairro">
            <TextInput
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              maxLength={80}
            />
          </Field>
          <Field label="CEP — preenche o endereço">
            <TextInput
              value={form.zip_code}
              onChange={(e) => {
                const cep = formatCep(e.target.value);
                setForm({ ...form, zip_code: cep });
                void fillFromCep(cep);
              }}
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
            />
          </Field>
          <Field label="Endereço" className="sm:col-span-2">
            <TextInput
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              maxLength={160}
            />
          </Field>
          <Field label="Responsável / comprador">
            <TextInput
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              maxLength={100}
            />
          </Field>
          <Field label="Cargo">
            <TextInput
              value={form.contact_role}
              onChange={(e) => setForm({ ...form, contact_role: e.target.value })}
              maxLength={60}
            />
          </Field>
          <Field label="Telefone">
            <TextInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              maxLength={25}
            />
          </Field>
          <Field label="WhatsApp">
            <TextInput
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              maxLength={25}
            />
          </Field>
          <Field label="E-mail">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Instagram">
            <TextInput
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              maxLength={60}
            />
          </Field>
          <Field label="Potencial de compra">
            <SelectInput
              value={form.purchase_potential}
              onChange={(e) => setForm({ ...form, purchase_potential: e.target.value })}
            >
              {["Baixo", "Médio", "Alto"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Origem">
            <TextInput
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              maxLength={60}
            />
          </Field>
          <Field label="Marcas de interesse" className="sm:col-span-2">
            {brands.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma marca cadastrada ainda. Abra Fábricas / Marcas e cadastre as marcas dentro da
                fábrica para poder selecioná-las aqui.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => {
                  const active = form.interest_brands.includes(b.brand);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          interest_brands: active
                            ? form.interest_brands.filter((x) => x !== b.brand)
                            : [...form.interest_brands, b.brand],
                        })
                      }
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                        active
                          ? "border-brand/40 bg-brand/15 text-brand"
                          : "border-border text-muted-foreground hover:bg-accent/60"
                      }`}
                    >
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" className="size-4 rounded object-contain" />
                      ) : null}
                      {b.brand}
                      <span className="text-[10px] opacity-70">{b.company_name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Seleção múltipla — clique nas marcas que o cliente tem interesse.
            </p>
          </Field>
          <Field label="Marcas que este cliente já compra" className="sm:col-span-2">
            {brands.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Cadastre as marcas dentro de cada fábrica para poder selecioná-las aqui.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => {
                  const active = buyingBrands.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setBuyingBrands(
                          active
                            ? buyingBrands.filter((x) => x !== b.id)
                            : [...buyingBrands, b.id],
                        )
                      }
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                        active
                          ? "border-gold/50 bg-gold/15 text-gold"
                          : "border-border text-muted-foreground hover:bg-accent/60"
                      }`}
                    >
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" className="size-4 rounded object-contain" />
                      ) : null}
                      {b.brand}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Seleção múltipla — clique para marcar ou desmarcar.
            </p>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={1000}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => void save()}>Salvar cliente</PrimaryButton>
        </div>
      </Modal>
    </AppShell>
  );
}
