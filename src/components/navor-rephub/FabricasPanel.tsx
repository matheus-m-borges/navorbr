import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Chip,
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
  EmptyState,
} from "./ui";
import { DocumentsPanel } from "./DocumentsPanel";
import { BrandFormModal } from "./BrandFormModal";
import { BrandTag } from "./BrandTag";
import { currency, formatDate, UF_LIST } from "@/lib/crm";
import { formatCnpj } from "@/lib/cnpj";
import { formatCep, lookupCep } from "@/lib/cep";
import { COMMISSION_MODES, describeRule, FACTORY_STATUSES, sumMoney } from "@/lib/rep";
import { useRemoveRecord } from "@/lib/registro";
import { crmDb, useBrands, type Brand } from "@/hooks/useCrm";
import { useCommissions, useFactories, useOrders, type Factory } from "@/hooks/useRep";
import { useCurrentUser } from "@/hooks/useSession";

const emptyForm = {
  legal_name: "",
  trade_name: "",
  cnpj: "",
  state_registration: "",
  city: "",
  state: "SP",
  address: "",
  zip_code: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  commercial_contact: "",
  rep_name: "",
  region: "",
  rep_start_date: "",
  rep_end_date: "",
  status: "Ativa",
  commission_mode: "Faturamento",
  commission_pct_invoice: "3",
  commission_pct_settlement: "0",
  commercial_notes: "",
  notes: "",
};

/** Cadastro das fábricas representadas, contrato de representação e regra de comissão. */
export function FabricasPanel() {
  const qc = useQueryClient();
  const { data: factories = [], isLoading } = useFactories();
  const { data: brands = [] } = useBrands();
  const { data: orders = [] } = useOrders();
  const { data: commissions = [] } = useCommissions();
  const { user } = useCurrentUser();
  const removeRecord = useRemoveRecord();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Factory | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [docsFor, setDocsFor] = useState<Factory | null>(null);
  const [brandModal, setBrandModal] = useState<{ factory: Factory; brand: Brand | null } | null>(null);
  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("hide_all");

  const isAdmin = user?.role === "admin";

  function startNew() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function startEdit(f: Factory) {
    setEditing(f);
    setForm({
      legal_name: f.legal_name ?? "",
      trade_name: f.trade_name ?? "",
      cnpj: f.cnpj ?? "",
      state_registration: f.state_registration ?? "",
      city: f.city ?? "",
      state: f.state ?? "SP",
      address: f.address ?? "",
      zip_code: f.zip_code ?? "",
      phone: f.phone ?? "",
      whatsapp: f.whatsapp ?? "",
      email: f.email ?? "",
      website: f.website ?? "",
      commercial_contact: f.commercial_contact ?? "",
      rep_name: f.rep_name ?? "",
      region: f.region ?? "",
      rep_start_date: f.rep_start_date?.slice(0, 10) ?? "",
      rep_end_date: f.rep_end_date?.slice(0, 10) ?? "",
      status: f.status ?? "Ativa",
      commission_mode: f.commission_mode ?? "Faturamento",
      commission_pct_invoice: String(f.commission_pct_invoice ?? 0),
      commission_pct_settlement: String(f.commission_pct_settlement ?? 0),
      commercial_notes: f.commercial_notes ?? "",
      notes: f.notes ?? "",
    });
    setOpen(true);
  }

  /** Preenche endereço, bairro, cidade e UF a partir do CEP informado. */
  async function fillFromCep(cep: string) {
    if (cep.replace(/\D/g, "").length !== 8) return;
    try {
      const d = await lookupCep(cep);
      setForm((f) => ({
        ...f,
        address: d.address || f.address,
        city: d.city || f.city,
        state: d.state || f.state,
      }));
    } catch {
      /* CEP não encontrado: o usuário pode preencher manualmente. */
    }
  }

  async function save() {
    if (!form.legal_name.trim()) {
      toast.error("Informe a razão social da fábrica.");
      return;
    }
    const payload = {
      legal_name: form.legal_name.trim(),
      trade_name: form.trade_name.trim() || null,
      cnpj: form.cnpj.trim() || null,
      state_registration: form.state_registration.trim() || null,
      city: form.city.trim() || null,
      state: form.state || null,
      address: form.address.trim() || null,
      zip_code: form.zip_code.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      commercial_contact: form.commercial_contact.trim() || null,
      rep_name: form.rep_name.trim() || null,
      region: form.region.trim() || null,
      // As UFs atendidas passaram a ser controladas em cada marca.

      rep_start_date: form.rep_start_date || null,
      rep_end_date: form.rep_end_date || null,
      status: form.status,
      commission_mode: form.commission_mode,
      commission_pct_invoice: Number(form.commission_pct_invoice || 0),
      commission_pct_settlement: Number(form.commission_pct_settlement || 0),
      commercial_notes: form.commercial_notes.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await crmDb.from("factories").update(payload).eq("id", editing.id)
      : await crmDb.from("factories").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["factories"] });
    setOpen(false);
    toast.success(editing ? "Fábrica atualizada." : "Fábrica cadastrada.");
  }

  const filtered = factories.filter((f) => {
    if (statusFilter !== "hide_all" && statusFilter !== "all" && f.status !== statusFilter) return false;
    if (term) {
      const t = term.toLowerCase();
      return [f.legal_name, f.trade_name, f.cnpj, f.city, f.state, f.commercial_contact]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    }
    return true;
  });

  return (
    <div>
      <SectionTitle
        title="Fábricas representadas"
        hint="Contrato de representação, região atendida e regra de comissão"
        action={
          <div className="flex items-center gap-4">
            <ShowAllToggle 
              showAll={statusFilter !== "hide_all"} 
              onToggle={(v) => setStatusFilter(v ? "all" : "hide_all")} 
            />
            <PrimaryButton onClick={startNew}>+ Nova fábrica</PrimaryButton>
          </div>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <TextInput
          placeholder="Buscar fábrica, CNPJ..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="lg:col-span-2"
        />
        <SelectInput
          value={statusFilter === "hide_all" ? "all" : statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="all">Todos os status</option>
          {FACTORY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectInput>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : statusFilter === "hide_all" && !term ? (
        <EmptyState
          title="Pesquise para listar"
          hint="Selecione um status ou pesquise para carregar as fábricas."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhuma fábrica encontrada" hint="Cadastre uma nova fábrica ou ajuste os filtros." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => {
            const fOrders = orders.filter((o) => o.factory_id === f.id && o.status !== "Cancelado");
            const fBrands = brands.filter((b) => b.factory_id === f.id);
            const fCommissions = commissions.filter((c) => c.factory_id === f.id);
            return (
              <GlassCard key={f.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-card-foreground">
                      {f.trade_name ?? f.legal_name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{f.legal_name}</p>
                  </div>
                  <Chip tone={f.status === "Ativa" ? "brand" : "muted"}>{f.status}</Chip>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {describeRule(
                    f.commission_mode,
                    Number(f.commission_pct_invoice),
                    Number(f.commission_pct_settlement),
                  )}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {f.city ?? "—"}/{f.state ?? "—"} · região {f.region ?? "—"}
                </p>

                <p className="mt-1 text-[11px] text-muted-foreground">
                  Representação desde {formatDate(f.rep_start_date)}
                  {f.rep_end_date ? ` até ${formatDate(f.rep_end_date)}` : ""}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-ink-2/40 p-2">
                    <p className="text-[10px] text-muted-foreground">Marcas</p>
                    <p className="text-sm font-semibold text-card-foreground">{fBrands.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-ink-2/40 p-2">
                    <p className="text-[10px] text-muted-foreground">Pedidos</p>
                    <p className="text-sm font-semibold text-card-foreground">{fOrders.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-ink-2/40 p-2">
                    <p className="text-[10px] text-muted-foreground">Comissão</p>
                    <p className="text-sm font-semibold text-card-foreground">
                      {currency(sumMoney(fCommissions, (c) => c.potential_amount))}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Vendas: {currency(sumMoney(fOrders, (o) => o.total_value))}
                </p>

                <div className="mt-3 rounded-xl border border-border bg-ink-2/30 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Marcas desta fábrica
                    </p>
                    <GhostButton onClick={() => setBrandModal({ factory: f, brand: null })}>
                      + Marca
                    </GhostButton>
                  </div>
                  {fBrands.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Nenhuma marca cadastrada nesta fábrica.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {fBrands.map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0">
                            <BrandTag
                              brand={b.brand}
                              logoUrl={b.logo_url}
                              size="lg"
                              className="min-w-0 text-xs"
                            />
                            {(b.states ?? []).length > 0 ? (
                              <span className="mt-1 block text-[10px] text-muted-foreground">
                                UFs: {(b.states ?? []).join(" · ")}
                              </span>
                            ) : null}
                          </span>

                          <span className="flex shrink-0 gap-1">
                            <GhostButton
                              className="px-2 py-1"
                              onClick={() => setBrandModal({ factory: f, brand: b })}
                            >
                              Editar
                            </GhostButton>
                            {isAdmin ? (
                              <GhostButton
                                className="border-rose/30 px-2 py-1 text-rose"
                                onClick={() =>
                                  void removeRecord({
                                    table: "brands",
                                    id: b.id,
                                    label: `a marca ${b.brand}`,
                                    keys: ["brands", "collections", "orders"],
                                  })
                                }
                              >
                                Excluir
                              </GhostButton>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton onClick={() => startEdit(f)}>Editar</GhostButton>
                  <GhostButton onClick={() => setDocsFor(f)}>Documentos</GhostButton>
                  {isAdmin ? (
                    <GhostButton
                      className="border-rose/30 text-rose"
                      onClick={() =>
                        void removeRecord({
                          table: "factories",
                          id: f.id,
                          label: `a fábrica ${f.trade_name ?? f.legal_name}`,
                          keys: ["factories", "brands", "orders", "commissions"],
                        })
                      }
                    >
                      Excluir
                    </GhostButton>
                  ) : null}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}


      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar fábrica" : "Nova fábrica"}
        subtitle="A regra de comissão da fábrica vale para todas as marcas sem regra própria"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Razão social *">
            <TextInput
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            />
          </Field>
          <Field label="Nome fantasia">
            <TextInput
              value={form.trade_name}
              onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
            />
          </Field>
          <Field label="CNPJ">
            <TextInput
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              maxLength={18}
            />
          </Field>

          <Field label="Inscrição estadual">
            <TextInput
              value={form.state_registration}
              onChange={(e) => setForm({ ...form, state_registration: e.target.value })}
            />
          </Field>
          <Field label="Contato comercial">
            <TextInput
              value={form.commercial_contact}
              onChange={(e) => setForm({ ...form, commercial_contact: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <TextInput
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <TextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Site">
            <TextInput value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </Field>
          <Field label="Cidade">
            <TextInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="UF">
            <SelectInput value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              {UF_LIST.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </SelectInput>
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
            <TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Representante">
            <TextInput
              value={form.rep_name}
              onChange={(e) => setForm({ ...form, rep_name: e.target.value })}
            />
          </Field>
          <Field label="Região atendida">
            <TextInput value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </Field>
          <p className="text-[11px] text-muted-foreground sm:col-span-2">
            As UFs atendidas agora são informadas em cada marca desta fábrica.
          </p>

          <Field label="Início da representação">
            <TextInput
              type="date"
              value={form.rep_start_date}
              onChange={(e) => setForm({ ...form, rep_start_date: e.target.value })}
            />
          </Field>
          <Field label="Fim da representação">
            <TextInput
              type="date"
              value={form.rep_end_date}
              onChange={(e) => setForm({ ...form, rep_end_date: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {FACTORY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Modalidade de comissão">
            <SelectInput
              value={form.commission_mode}
              onChange={(e) => setForm({ ...form, commission_mode: e.target.value })}
            >
              {COMMISSION_MODES.map((m) => (
                <option key={m} value={m}>
                  {m === "Faturamento"
                    ? "Faturamento — comissão integral ao faturar"
                    : m === "Liquidez"
                      ? "Liquidez — comissão quando o cliente paga o boleto"
                      : "Faturamento/Liquidez — meio a meio"}
                </option>
              ))}
            </SelectInput>
          </Field>
          {form.commission_mode !== "Liquidez" ? (
            <Field label="% da comissão no faturamento">
              <TextInput
                type="number"
                step="0.001"
                value={form.commission_pct_invoice}
                onChange={(e) => setForm({ ...form, commission_pct_invoice: e.target.value })}
              />
            </Field>
          ) : null}
          {form.commission_mode !== "Faturamento" ? (
            <Field label="% da comissão na liquidez (boletos pagos)">
              <TextInput
                type="number"
                step="0.001"
                value={form.commission_pct_settlement}
                onChange={(e) => setForm({ ...form, commission_pct_settlement: e.target.value })}
              />
            </Field>
          ) : null}
          <p className="text-[11px] text-muted-foreground sm:col-span-2">
            {form.commission_mode === "Faturamento"
              ? "A comissão é calculada assim que o faturamento é lançado."
              : form.commission_mode === "Liquidez"
                ? "A comissão é liberada conforme os boletos pagos pelo cliente forem registrados nas parcelas."
                : "Meio a meio: informe metade do percentual em cada campo (ex.: 1,5% + 1,5% para 3% no total). Metade libera no faturamento e metade nos boletos pagos."}
          </p>

          <Field label="Condições comerciais" className="sm:col-span-2">
            <TextArea
              value={form.commercial_notes}
              onChange={(e) => setForm({ ...form, commercial_notes: e.target.value })}
              placeholder="Pedido mínimo, prazos, política de frete..."
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => void save()}>Salvar fábrica</PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={docsFor !== null}
        onClose={() => setDocsFor(null)}
        title={`Documentos — ${docsFor?.trade_name ?? docsFor?.legal_name ?? ""}`}
        wide
      >
        {docsFor ? (
          <DocumentsPanel
            entityType="factory"
            entityId={docsFor.id}
            title="Arquivos da fábrica"
            hint="Contrato de representação, tabelas e catálogos"
            defaultCategory="Contrato"
          />
        ) : null}
      </Modal>

      <BrandFormModal
        open={brandModal !== null}
        onClose={() => setBrandModal(null)}
        brand={brandModal?.brand ?? null}
        factoryId={brandModal?.factory.id ?? null}
        factoryName={brandModal?.factory.trade_name ?? brandModal?.factory.legal_name ?? null}
      />
    </div>
  );
}
