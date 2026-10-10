import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";
import { Field, GhostButton, Modal, PrimaryButton, SelectInput, TextInput } from "./ui";
import { UF_LIST } from "@/lib/crm";
import { formatCnpj, lookupCnpj } from "@/lib/cnpj";
import { crmDb, useClients } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";

const emptyQuick = {
  cnpj: "",
  legal_name: "",
  trade_name: "",
  city: "",
  state: "SP",
  district: "",
  address: "",
  zip_code: "",
  segment: "",
  contact_name: "",
  phone: "",
  whatsapp: "",
  email: "",
};

/**
 * Campo de cliente com busca avançada (nome, CNPJ, contato, cidade, estado)
 * e cadastro rápido sem sair da tela de pedidos.
 */
export function ClientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (clientId: string) => void;
}) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { data: clients = [] } = useClients();
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [uf, setUf] = useState("");
  const [quick, setQuick] = useState({ ...emptyQuick });
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = clients.find((c) => c.id === value) ?? null;

  const results = useMemo(() => {
    const t = term.trim().toLowerCase();
    return clients
      .filter((c) => {
        if (uf && c.state !== uf) return false;
        if (!t) return true;
        return [c.legal_name, c.trade_name, c.cnpj, c.contact_name, c.phone, c.city, c.state, c.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t));
      })
      .slice(0, 60);
  }, [clients, term, uf]);

  async function fillFromCnpj() {
    setLooking(true);
    try {
      const data = await lookupCnpj(quick.cnpj);
      setQuick((q) => ({
        ...q,
        cnpj: data.cnpj,
        legal_name: data.legal_name || q.legal_name,
        trade_name: data.trade_name || q.trade_name,
        city: data.city || q.city,
        state: data.state || q.state,
        district: data.district || q.district,
        address: data.address || q.address,
        zip_code: data.zip_code || q.zip_code,
        segment: data.segment || q.segment,
        phone: data.phone || q.phone,
        email: data.email || q.email,
      }));
      toast.success("Dados do CNPJ preenchidos.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLooking(false);
    }
  }

  async function createClient() {
    if (!quick.legal_name.trim()) {
      toast.error("Informe a razão social / nome do cliente.");
      return;
    }
    setSaving(true);
    const { data, error } = await crmDb
      .from("clients")
      .insert({
        ...quick,
        legal_name: quick.legal_name.trim(),
        trade_name: quick.trade_name.trim() || null,
        cnpj: quick.cnpj.trim() || null,
        city: quick.city.trim() || null,
        district: quick.district.trim() || null,
        address: quick.address.trim() || null,
        zip_code: quick.zip_code.trim() || null,
        segment: quick.segment.trim() || null,
        contact_name: quick.contact_name.trim() || null,
        phone: quick.phone.trim() || null,
        whatsapp: quick.whatsapp.trim() || null,
        email: quick.email.trim() || null,
        status: "Ativo",
        client_type: "Varejo",
        owner_id: user?.id ?? null,
        owner_name: user?.name ?? null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível cadastrar o cliente.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["clients"] });
    onChange((data as { id: string }).id);
    setQuick({ ...emptyQuick });
    setCreateOpen(false);
    toast.success("Cliente cadastrado e selecionado no pedido.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 rounded-lg border border-input bg-ink-2/70 px-3 py-2 text-sm">
          {selected ? (
            <span className="text-card-foreground">
              {selected.legal_name}{selected.trade_name ? ` — ${selected.trade_name}` : ""}
              <span className="ml-2 text-[11px] text-muted-foreground">
                {selected.cnpj ? `${selected.cnpj} · ` : ""}
                {selected.city ?? "—"}/{selected.state ?? "—"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Nenhum cliente selecionado</span>
          )}
        </div>
        <GhostButton className="shrink-0" onClick={() => setSearchOpen(true)}>
          <Search className="size-3.5" /> Pesquisar cliente
        </GhostButton>
        <GhostButton className="shrink-0" onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-3.5" /> Cadastrar cliente
        </GhostButton>
      </div>

      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Pesquisar cliente"
        subtitle="Busque por nome, CNPJ, contato, e-mail, cidade ou estado"
        wide
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <TextInput
            className="sm:col-span-2"
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Nome, CNPJ, contato, cidade..."
          />
          <SelectInput value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">Todos os estados</option>
            {UF_LIST.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
              <button
                className="ml-1 text-brand hover:underline"
                onClick={() => {
                  setSearchOpen(false);
                  setCreateOpen(true);
                }}
              >
                Cadastrar agora
              </button>
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.id);
                  setSearchOpen(false);
                }}
                className="block w-full px-4 py-2.5 text-left transition hover:bg-accent/60"
              >
                <p className="text-sm font-medium text-card-foreground">
                  {c.legal_name}{c.trade_name ? ` — ${c.trade_name}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {c.cnpj ?? "sem CNPJ"} · {c.city ?? "—"}/{c.state ?? "—"} ·{" "}
                  {c.contact_name ?? "sem contato"} · {c.phone ?? "sem telefone"}
                </p>
              </button>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <GhostButton
            onClick={() => {
              setSearchOpen(false);
              setCreateOpen(true);
            }}
          >
            <UserPlus className="size-3.5" /> Cadastrar novo cliente
          </GhostButton>
          <GhostButton onClick={() => setSearchOpen(false)}>Fechar</GhostButton>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Cadastro rápido de cliente"
        subtitle="O cliente já fica selecionado no pedido ao salvar"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CNPJ" className="sm:col-span-2">
            <div className="flex gap-2">
              <TextInput
                value={quick.cnpj}
                onChange={(e) => setQuick({ ...quick, cnpj: formatCnpj(e.target.value) })}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
                autoFocus
              />
              <PrimaryButton
                className="shrink-0 whitespace-nowrap"
                disabled={looking}
                onClick={() => void fillFromCnpj()}
              >
                {looking ? "Buscando..." : "Buscar dados"}
              </PrimaryButton>
            </div>
          </Field>
          <Field label="Razão social *" className="sm:col-span-2">
            <TextInput
              value={quick.legal_name}
              onChange={(e) => setQuick({ ...quick, legal_name: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Nome fantasia">
            <TextInput
              value={quick.trade_name}
              onChange={(e) => setQuick({ ...quick, trade_name: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Segmento">
            <TextInput
              value={quick.segment}
              onChange={(e) => setQuick({ ...quick, segment: e.target.value })}
              maxLength={60}
            />
          </Field>
          <Field label="Cidade">
            <TextInput
              value={quick.city}
              onChange={(e) => setQuick({ ...quick, city: e.target.value })}
              maxLength={80}
            />
          </Field>
          <Field label="Estado">
            <SelectInput
              value={quick.state}
              onChange={(e) => setQuick({ ...quick, state: e.target.value })}
            >
              {UF_LIST.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Responsável / comprador">
            <TextInput
              value={quick.contact_name}
              onChange={(e) => setQuick({ ...quick, contact_name: e.target.value })}
              maxLength={100}
            />
          </Field>
          <Field label="Telefone">
            <TextInput
              value={quick.phone}
              onChange={(e) => setQuick({ ...quick, phone: e.target.value })}
              maxLength={25}
            />
          </Field>
          <Field label="WhatsApp">
            <TextInput
              value={quick.whatsapp}
              onChange={(e) => setQuick({ ...quick, whatsapp: e.target.value })}
              maxLength={25}
            />
          </Field>
          <Field label="E-mail">
            <TextInput
              value={quick.email}
              onChange={(e) => setQuick({ ...quick, email: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Endereço" className="sm:col-span-2">
            <TextInput
              value={quick.address}
              onChange={(e) => setQuick({ ...quick, address: e.target.value })}
              maxLength={160}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setCreateOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void createClient()}>
            {saving ? "Salvando..." : "Salvar cliente"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
