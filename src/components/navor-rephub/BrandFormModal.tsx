import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from "./ui";
import { UF_LIST } from "@/lib/crm";
import { formatCnpj } from "@/lib/cnpj";
import { COMMISSION_MODES, describeRule } from "@/lib/rep";
import { readLogoImage } from "@/lib/logo";
import { crmDb, type Brand } from "@/hooks/useCrm";
import { useFactories } from "@/hooks/useRep";

const emptyForm = {
  company_name: "",
  legal_name: "",
  trade_name: "",
  cnpj: "",
  brand: "",
  segment: "",
  commercial_contact: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  city: "",
  state: "SP",
  address: "",
  status: "Ativa",
  notes: "",
  factory_id: "",
  commission_mode: "",
  commission_pct_invoice: "",
  commission_pct_settlement: "",
  logo_url: "",
  states: [] as string[],
  other_states: "",
};


/** Cadastro de marca — usado na tela de marcas e dentro de cada fábrica. */
export function BrandFormModal({
  open,
  onClose,
  brand,
  factoryId,
  factoryName,
}: {
  open: boolean;
  onClose: () => void;
  brand?: Brand | null;
  factoryId?: string | null;
  factoryName?: string | null;
}) {
  const qc = useQueryClient();
  const { data: factories = [] } = useFactories();
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const b = brand as (Brand & Record<string, unknown>) | null | undefined;
    const factory = factories.find((f) => f.id === (b?.["factory_id"] ?? factoryId));
    setForm({
      ...emptyForm,
      company_name:
        b?.company_name ?? factoryName ?? factory?.trade_name ?? factory?.legal_name ?? "",
      legal_name: b?.legal_name ?? factory?.legal_name ?? "",
      trade_name: b?.trade_name ?? "",
      cnpj: b?.cnpj ?? "",
      brand: b?.brand ?? "",
      segment: b?.segment ?? "",
      commercial_contact: b?.commercial_contact ?? "",
      phone: b?.phone ?? "",
      whatsapp: b?.whatsapp ?? "",
      email: b?.email ?? "",
      website: b?.website ?? "",
      city: b?.city ?? "",
      state: b?.state ?? "SP",
      address: b?.address ?? "",
      status: b?.status ?? "Ativa",
      notes: b?.notes ?? "",
      factory_id: (b?.["factory_id"] as string | null) ?? factoryId ?? "",
      commission_mode: (b?.["commission_mode"] as string | null) ?? "",
      commission_pct_invoice: String((b?.["commission_pct_invoice"] as number | null) ?? ""),
      commission_pct_settlement: String((b?.["commission_pct_settlement"] as number | null) ?? ""),
      logo_url: (b?.["logo_url"] as string | null) ?? "",
      states: ((b?.["states"] as string[] | null) ?? []).filter((s) =>
        (UF_LIST as readonly string[]).includes(s),
      ),
      other_states: ((b?.["states"] as string[] | null) ?? [])
        .filter((s) => !(UF_LIST as readonly string[]).includes(s))
        .join(", "),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brand?.id, factoryId]);

  async function pickLogo(file: File) {
    try {
      const data = await readLogoImage(file);
      setForm((f) => ({ ...f, logo_url: data }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function save() {
    if (!form.brand.trim()) {
      toast.error("Informe o nome da marca.");
      return;
    }
    const company = form.company_name.trim() || form.legal_name.trim();
    if (!company) {
      toast.error("Informe a fábrica / empresa da marca.");
      return;
    }
    setSaving(true);
    const payload = {
      company_name: company,
      legal_name: form.legal_name.trim() || null,
      trade_name: form.trade_name.trim() || null,
      cnpj: form.cnpj.trim() || null,
      brand: form.brand.trim(),
      segment: form.segment.trim() || null,
      commercial_contact: form.commercial_contact.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      city: form.city.trim() || null,
      state: form.state || null,
      address: form.address.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      logo_url: form.logo_url || null,
      factory_id: form.factory_id || null,
      states: [
        ...form.states,
        ...form.other_states
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ],
      // Sem modalidade própria a marca herda a regra da fábrica.
      commission_mode: form.commission_mode || null,
      commission_pct_invoice: form.commission_mode ? Number(form.commission_pct_invoice || 0) : null,
      commission_pct_settlement: form.commission_mode
        ? Number(form.commission_pct_settlement || 0)
        : null,
    };
    const { error } = brand
      ? await crmDb.from("brands").update(payload).eq("id", brand.id)
      : await crmDb.from("brands").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["brands"] });
    onClose();
    toast.success(brand ? "Marca atualizada." : "Marca cadastrada.");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={brand ? "Editar marca" : "Nova marca"}
      subtitle="A logomarca aparece nas listas, pedidos e relatórios"
      wide
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-ink-2/40 p-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-ink-2">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logomarca" className="size-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">sem logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={logoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickLogo(f);
              e.target.value = "";
            }}
          />
          <GhostButton onClick={() => logoRef.current?.click()}>Enviar logomarca</GhostButton>
          {form.logo_url ? (
            <GhostButton
              className="border-rose/30 text-rose"
              onClick={() => setForm({ ...form, logo_url: "" })}
            >
              Remover logo
            </GhostButton>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Marca *">
          <TextInput
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            maxLength={80}
          />
        </Field>
        <Field label="Fábrica vinculada">
          <SelectInput
            value={form.factory_id}
            onChange={(e) => {
              const f = factories.find((x) => x.id === e.target.value);
              setForm({
                ...form,
                factory_id: e.target.value,
                company_name: f ? (f.trade_name ?? f.legal_name) : form.company_name,
              });
            }}
          >
            <option value="">Sem vínculo</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.trade_name ?? f.legal_name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Fábrica / empresa *">
          <TextInput
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            maxLength={140}
          />
        </Field>
        <Field label="Razão social">
          <TextInput
            value={form.legal_name}
            onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            maxLength={140}
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
        <Field label="Segmento">
          <TextInput
            value={form.segment}
            onChange={(e) => setForm({ ...form, segment: e.target.value })}
            maxLength={80}
          />
        </Field>
        <Field label="Status">
          <SelectInput value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {["Ativa", "Inativa", "Em prospecção"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Contato comercial">
          <TextInput
            value={form.commercial_contact}
            onChange={(e) => setForm({ ...form, commercial_contact: e.target.value })}
            maxLength={100}
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
        <Field label="Site">
          <TextInput
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            maxLength={160}
          />
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
        <Field label="Endereço" className="sm:col-span-2">
          <TextInput
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            maxLength={160}
          />
        </Field>
        <Field label="Comissão própria da marca">
          <SelectInput
            value={form.commission_mode}
            onChange={(e) => setForm({ ...form, commission_mode: e.target.value })}
          >
            <option value="">Herdar regra da fábrica</option>
            {COMMISSION_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectInput>
        </Field>
        {form.commission_mode ? (
          <>
            <Field label="% sobre faturamento">
              <TextInput
                type="number"
                step="0.001"
                value={form.commission_pct_invoice}
                onChange={(e) => setForm({ ...form, commission_pct_invoice: e.target.value })}
              />
            </Field>
            <Field label="% sobre liquidez">
              <TextInput
                type="number"
                step="0.001"
                value={form.commission_pct_settlement}
                onChange={(e) => setForm({ ...form, commission_pct_settlement: e.target.value })}
              />
            </Field>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              {describeRule(
                form.commission_mode,
                Number(form.commission_pct_invoice || 0),
                Number(form.commission_pct_settlement || 0),
              )}
            </p>
          </>
        ) : null}
        <Field label="UFs atendidas por esta marca" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {UF_LIST.map((uf) => {
              const on = form.states.includes(uf);
              return (
                <button
                  key={uf}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      states: on ? form.states.filter((x) => x !== uf) : [...form.states, uf],
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    on
                      ? "border-brand/40 bg-brand/15 text-brand"
                      : "border-border text-muted-foreground hover:bg-accent/60"
                  }`}
                >
                  {uf}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setForm({ ...form, other_states: form.other_states ? "" : "Outro" })
              }
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                form.other_states
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border text-muted-foreground hover:bg-accent/60"
              }`}
            >
              Outro
            </button>
          </div>
          {form.other_states ? (
            <TextInput
              className="mt-2"
              value={form.other_states}
              onChange={(e) => setForm({ ...form, other_states: e.target.value })}
              placeholder="Ex.: Exterior, Paraguai"
              maxLength={120}
            />
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Seleção múltipla — clique nos estados onde a marca é vendida.
          </p>
        </Field>
        <Field label="Informações da marca" className="sm:col-span-2">
          <TextArea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            maxLength={1000}
            placeholder="Resumo da marca — este texto aparece para o cliente no portal dele."
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>Cancelar</GhostButton>
        <PrimaryButton disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando..." : "Salvar marca"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
