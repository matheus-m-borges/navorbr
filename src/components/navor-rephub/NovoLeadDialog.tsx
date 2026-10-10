import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Field, Modal, PrimaryButton, SelectInput, TextArea, TextInput } from "./ui";
import { UF_LIST } from "@/lib/crm";
import { formatCnpj } from "@/lib/cnpj";
import { crmDb, useBrands, useCrmMutation, useLeadSources } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";

export function NovoLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: brands = [] } = useBrands();
  const { data: sources = [] } = useLeadSources();
  const { user } = useCurrentUser();

  const [form, setForm] = useState({
    company_name: "",
    cnpj: "",
    contact_name: "",
    whatsapp: "",
    instagram: "",
    city: "",
    state: "",
    brandIds: [] as string[],
    source: "WhatsApp",
    entry_at: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const [loadingCnpj, setLoadingCnpj] = useState(false);

  async function fillFromCnpj() {
    if (form.cnpj.length < 14) return;
    setLoadingCnpj(true);
    try {
      const { lookupCnpj } = await import("@/lib/cnpj");
      const result = await lookupCnpj(form.cnpj);
      if (result) {
        setForm((prev) => ({
          ...prev,
          company_name: result.legal_name || prev.company_name,
          contact_name: result.trade_name || prev.contact_name,
          whatsapp: result.phone || prev.whatsapp,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }));
        toast.success("Dados preenchidos via Receita Federal.");
      } else {
        toast.error("CNPJ não encontrado.");
      }
    } catch (e) {
      toast.error("Erro ao consultar CNPJ.");
    } finally {
      setLoadingCnpj(false);
    }
  }

  const create = useCrmMutation(async () => {
    if (!form.company_name.trim()) throw new Error("Informe a empresa");
    const brandName = brands.find((b) => b.id === form.brandIds[0])?.brand ?? null;
    const { data, error } = await crmDb
      .from("leads")
      .insert({
        company_name: form.company_name.trim(),
        cnpj: form.cnpj || null,
        contact_name: form.contact_name || null,
        whatsapp: form.whatsapp || null,
        instagram: form.instagram || null,
        phone: form.whatsapp || null,
        city: form.city || null,
        state: form.state || null,
        source: form.source,
        entry_at: new Date(`${form.entry_at}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
        notes: form.notes || null,
        status: "Novo Lead",
        owner_name: user?.name ?? null,
        owner_id: user?.id ?? null,
        created_by: user?.id ?? null,
        last_interaction_at: new Date().toISOString(),
        next_followup_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    const leadId = (data as { id: string }).id;

    if (form.brandIds.length > 0) {
      await crmDb
        .from("lead_brands")
        .insert(form.brandIds.map((brand_id) => ({ lead_id: leadId, brand_id })));
    }

    // Automação 1: novo lead -> tarefa de primeiro contato + histórico + notificação
    await Promise.all([
      crmDb.from("tasks").insert({
        title: "Realizar primeiro contato",
        description: `Lead recebido via ${form.source}.`,
        task_type: "Primeiro contato",
        priority: "Alta",
        due_at: new Date(Date.now() + 86400000).toISOString(),
        lead_id: leadId,
        owner_name: user?.name ?? null,
        owner_id: user?.id ?? null,
      }),
      crmDb.from("lead_status_history").insert({
        lead_id: leadId,
        to_status: "Novo Lead",
        changed_by_name: user?.name ?? null,
        note: `Lead cadastrado (origem: ${form.source}).`,
      }),
      crmDb.from("lead_interactions").insert({
        lead_id: leadId,
        contact_type: form.source === "Ligação" ? "Ligação" : "WhatsApp",
        responsible_name: user?.name ?? null,
        description: `Lead recebido por ${form.source}.`,
        result: "Interesse inicial",
        next_action: "Realizar primeiro contato",
        next_action_at: new Date(Date.now() + 86400000).toISOString(),
      }),
      crmDb.from("notifications").insert({
        title: "Novo lead recebido",
        body: `${form.company_name} entrou por ${form.source}${brandName ? ` interessado em ${brandName}` : ""}.`,
        kind: "info",
        lead_id: leadId,
      }),
    ]);

    return leadId;
  }, ["leads", "tasks", "notifications"]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo lead"
      subtitle="Cadastro rápido — depois você completa os dados na página do lead."
      wide
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Empresa *" className="sm:col-span-2">
          <TextInput
            value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            placeholder="Nome da loja / empresa"
            maxLength={140}
          />
        </Field>
        <Field label="CNPJ">
          <div className="flex gap-2">
            <TextInput
              value={form.cnpj}
              onChange={(e) => set("cnpj", formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              maxLength={18}
            />
            <button
              type="button"
              disabled={loadingCnpj || form.cnpj.replace(/\D/g, "").length !== 14}
              onClick={() => void fillFromCnpj()}
              className="shrink-0 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              {loadingCnpj ? "Buscando..." : "Consultar"}
            </button>
          </div>
        </Field>
        <Field label="Contato">
          <TextInput
            value={form.contact_name}
            onChange={(e) => set("contact_name", e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="WhatsApp">
          <TextInput
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            placeholder="(11) 99999-0000"
            maxLength={25}
          />
        </Field>
        <Field label="Instagram">
          <TextInput
            value={form.instagram}
            onChange={(e) => set("instagram", e.target.value)}
            placeholder="@loja"
            maxLength={100}
          />
        </Field>
        <Field label="Cidade">
          <TextInput value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
        </Field>
        <Field label="Estado">
          <SelectInput value={form.state} onChange={(e) => set("state", e.target.value)}>
            <option value="">—</option>
            {UF_LIST.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Origem *">
          <SelectInput value={form.source} onChange={(e) => set("source", e.target.value)}>
            {sources.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Data de entrada">
          <TextInput
            type="date"
            value={form.entry_at}
            onChange={(e) => set("entry_at", e.target.value)}
          />
        </Field>
        <Field label="Marcas de interesse" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => {
              const active = form.brandIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    set(
                      "brandIds",
                      active
                        ? form.brandIds.filter((id) => id !== b.id)
                        : [...form.brandIds, b.id],
                    )
                  }
                  className={
                    active
                      ? "rounded-lg border border-brand/40 bg-brand/15 px-3 py-1.5 text-xs font-medium text-brand"
                      : "rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                  }
                >
                  {b.brand}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Observação" className="sm:col-span-2">
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <PrimaryButton
          disabled={create.isPending}
          onClick={() =>
            create.mutate(undefined as never, {
              onSuccess: (leadId) => {
                toast.success("Lead salvo. Tarefa de primeiro contato criada.");
                onClose();
                void navigate({ to: "/leads/$leadId", params: { leadId: leadId as string } });
              },
              onError: (e) => toast.error((e as Error).message || "Não foi possível salvar"),
            })
          }
        >
          {create.isPending ? "Salvando..." : "Salvar lead"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
