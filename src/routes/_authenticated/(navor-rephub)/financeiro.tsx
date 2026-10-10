import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
  Chip,
  EmptyState,
  Field,
  GhostButton,
  GlassCard,
  KpiCard,
  MoneyInput,
  Modal,
  PrimaryButton,
  SectionTitle,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import { TableShell, Td, Tr } from "@/components/navor-rephub/repui";
import { currency, formatDate } from "@/lib/crm";
import { useRemoveRecord } from "@/lib/registro";
import { crmDb, useBrands } from "@/hooks/useCrm";
import { useCommissions, useFactories } from "@/hooks/useRep";
import { useClients } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  RECURRENCES,
  useCostCenters,
  useExpenseBudgets,
  useExpenseCategories,
  useExpenses,
  useFinancialAccounts,
  useSuppliers,
  useTrips,
  useVehicles,
  type Expense,
  type Trip,
} from "@/hooks/useFinanceiro";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro e despesas | RepHub" },
      {
        name: "description",
        content:
          "Controle de despesas da representação comercial: categorias, fornecedores, centros de custo, viagens com retorno, orçamento e resultado operacional.",
      },
      { property: "og:title", content: "Financeiro e despesas | RepHub" },
      {
        property: "og:description",
        content: "Despesas, viagens, orçamento e resultado operacional da representação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceiroPage,
});

type Tab = "painel" | "despesas" | "viagens" | "orcamento" | "cadastros" | "resultado";

const TABS: { id: Tab; label: string }[] = [
  { id: "painel", label: "Painel" },
  { id: "despesas", label: "Despesas" },
  { id: "viagens", label: "Viagens" },
  { id: "orcamento", label: "Orçamento" },
  { id: "resultado", label: "Resultado" },
  { id: "cadastros", label: "Cadastros" },
];

const emptyExpense = {
  description: "",
  category_id: "",
  supplier_id: "",
  cost_center_id: "",
  account_id: "",
  trip_id: "",
  vehicle_id: "",
  factory_id: "",
  brand_id: "",
  client_id: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  payment_method: "Pix",
  installments_count: "1",
  recurrence: "Nenhuma",
  recurrence_until: "",
  status: "Em aberto",
  paid_amount: "",
  liters: "",
  odometer: "",
  notes: "",
};

const emptyTrip = {
  title: "",
  destination: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  purpose: "",
  client_id: "",
  factory_id: "",
  revenue_generated: "",
  notes: "",
};

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

function FinanceiroPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const remove = useRemoveRecord();

  const [tab, setTab] = useState<Tab>("painel");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: expenses = [], isLoading } = useExpenses();
  const { data: categories = [] } = useExpenseCategories();
  const { data: suppliers = [] } = useSuppliers();
  const { data: costCenters = [] } = useCostCenters();
  const { data: accounts = [] } = useFinancialAccounts();
  const { data: vehicles = [] } = useVehicles();
  const { data: trips = [] } = useTrips();
  const { data: budgets = [] } = useExpenseBudgets();
  const { data: clients = [] } = useClients();
  const { data: brands = [] } = useBrands();
  const { data: factories = [] } = useFactories();
  const { data: commissions = [] } = useCommissions();

  const [openExpense, setOpenExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyExpense);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [openTrip, setOpenTrip] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState(emptyTrip);

  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const inRange = (d: string) => d >= from && d <= to;

  const filtered = useMemo(
    () =>
      expenses.filter(
        (e) =>
          inRange(e.expense_date) &&
          (!filterCategory || e.category_id === filterCategory) &&
          (!filterStatus || e.status === filterStatus),
      ),
    [expenses, from, to, filterCategory, filterStatus],
  );

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const paid = filtered.reduce((s, e) => s + Number(e.paid_amount), 0);
  const open = total - paid;
  const overdue = filtered
    .filter((e) => e.status !== "Pago" && e.due_date && e.due_date < new Date().toISOString().slice(0, 10))
    .reduce((s, e) => s + (Number(e.amount) - Number(e.paid_amount)), 0);
  const fixed = filtered
    .filter((e) => e.expense_categories?.kind === "Fixa")
    .reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const key = e.expense_categories?.name ?? "Sem categoria";
      map.set(key, (map.get(key) ?? 0) + Number(e.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const commissionsInRange = commissions.filter((c) =>
    inRange((c.calculated_at ?? "").slice(0, 10)),
  );
  const receivedCommission = commissionsInRange.reduce((s, c) => s + Number(c.received_amount), 0);
  const releasedCommission = commissionsInRange.reduce((s, c) => s + Number(c.released_amount), 0);
  const result = receivedCommission - total;

  function startNewExpense() {
    setEditingExpense(null);
    setForm(emptyExpense);
    setReceipt(null);
    setOpenExpense(true);
  }

  function startEditExpense(e: Expense) {
    setEditingExpense(e);
    setForm({
      description: e.description,
      category_id: e.category_id ?? "",
      supplier_id: e.supplier_id ?? "",
      cost_center_id: e.cost_center_id ?? "",
      account_id: e.account_id ?? "",
      trip_id: e.trip_id ?? "",
      vehicle_id: e.vehicle_id ?? "",
      factory_id: e.factory_id ?? "",
      brand_id: e.brand_id ?? "",
      client_id: e.client_id ?? "",
      amount: String(e.amount ?? ""),
      expense_date: e.expense_date,
      due_date: e.due_date ?? "",
      payment_method: e.payment_method ?? "Pix",
      installments_count: String(e.installments_count ?? 1),
      recurrence: e.recurrence ?? "Nenhuma",
      recurrence_until: e.recurrence_until ?? "",
      status: e.status,
      paid_amount: String(e.paid_amount ?? ""),
      liters: e.liters != null ? String(e.liters) : "",
      odometer: e.odometer != null ? String(e.odometer) : "",
      notes: e.notes ?? "",
    });
    setReceipt(null);
    setOpenExpense(true);
  }

  async function saveExpense() {
    const amount = Number(form.amount.replace(",", "."));
    if (!form.description.trim() || !(amount > 0)) {
      toast.error("Informe a descrição e um valor maior que zero.");
      return;
    }
    setSaving(true);
    try {
      let receipt_path = editingExpense?.receipt_path ?? null;
      let receipt_name = editingExpense?.receipt_name ?? null;
      if (receipt) {
        const path = `despesas/${crypto.randomUUID()}/${receipt.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("documentos")
          .upload(path, receipt, { upsert: false });
        if (upErr) throw new Error(`Não foi possível anexar o comprovante: ${upErr.message}`);
        receipt_path = path;
        receipt_name = receipt.name;
      }

      const parcelas = Math.max(1, Number(form.installments_count) || 1);
      const payload = {
        description: form.description.trim(),
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        cost_center_id: form.cost_center_id || null,
        account_id: form.account_id || null,
        trip_id: form.trip_id || null,
        vehicle_id: form.vehicle_id || null,
        factory_id: form.factory_id || null,
        brand_id: form.brand_id || null,
        client_id: form.client_id || null,
        amount,
        expense_date: form.expense_date,
        due_date: form.due_date || null,
        payment_method: form.payment_method || null,
        installments_count: parcelas,
        recurrence: form.recurrence,
        recurrence_until: form.recurrence_until || null,
        status: form.status,
        paid_amount: Number(form.paid_amount.replace(",", ".")) || 0,
        paid_at: form.status === "Pago" ? form.expense_date : null,
        receipt_path,
        receipt_name,
        liters: form.liters ? Number(form.liters.replace(",", ".")) : null,
        odometer: form.odometer ? Number(form.odometer.replace(",", ".")) : null,
        notes: form.notes || null,
        owner_name: editingExpense?.owner_name ?? user?.name ?? null,
        ...(editingExpense ? {} : { owner_id: user?.id ?? null, created_by: user?.id ?? null }),
      };

      const { data: saved, error } = editingExpense
        ? await crmDb
            .from("expenses")
            .update(payload)
            .eq("id", editingExpense.id)
            .select("id")
            .maybeSingle()
        : await crmDb.from("expenses").insert(payload).select("id").maybeSingle();
      if (error) throw new Error(error.message);

      const expenseId = (saved as { id?: string } | null)?.id ?? editingExpense?.id;
      if (expenseId) {
        await crmDb.from("expense_installments").delete().eq("expense_id", expenseId);
        const base = Math.round((amount / parcelas) * 100) / 100;
        const startStr = form.due_date || form.expense_date;
        const rows = Array.from({ length: parcelas }, (_, i) => {
          const d = new Date(`${startStr}T12:00:00`);
          d.setMonth(d.getMonth() + i);
          const value =
            i === parcelas - 1 ? Math.round((amount - base * (parcelas - 1)) * 100) / 100 : base;
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return {
            expense_id: expenseId,
            number: i + 1,
            due_date: `${y}-${m}-${day}`,
            amount: value,
            paid_amount: form.status === "Pago" ? value : 0,
          };
        });
        await crmDb.from("expense_installments").insert(rows);
      }

      setOpenExpense(false);
      void qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(editingExpense ? "Despesa atualizada." : "Despesa lançada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveTrip() {
    if (!tripForm.title.trim()) {
      toast.error("Informe um título para a viagem.");
      return;
    }
    const payload = {
      title: tripForm.title.trim(),
      destination: tripForm.destination || null,
      start_date: tripForm.start_date,
      end_date: tripForm.end_date || null,
      purpose: tripForm.purpose || null,
      client_id: tripForm.client_id || null,
      factory_id: tripForm.factory_id || null,
      revenue_generated: Number(tripForm.revenue_generated.replace(",", ".")) || 0,
      notes: tripForm.notes || null,
      owner_name: editingTrip?.owner_name ?? user?.name ?? null,
      ...(editingTrip ? {} : { owner_id: user?.id ?? null, created_by: user?.id ?? null }),
    };
    const { error } = editingTrip
      ? await crmDb.from("trips").update(payload).eq("id", editingTrip.id)
      : await crmDb.from("trips").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpenTrip(false);
    void qc.invalidateQueries({ queryKey: ["trips"] });
    toast.success(editingTrip ? "Viagem atualizada." : "Viagem registrada.");
  }

  async function openReceipt(e: Expense) {
    if (!e.receipt_path) return;
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(e.receipt_path, 120);
    if (error || !data) {
      toast.error("Não foi possível abrir o comprovante.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const tripCost = (id: string) =>
    expenses.filter((e) => e.trip_id === id).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <AppShell
      title="Financeiro"
      subtitle="Despesas, viagens, orçamento e resultado operacional da representação"
      actions={<PrimaryButton onClick={startNewExpense}>+ Lançar despesa</PrimaryButton>}
    >
      <GlassCard className="flex flex-wrap items-end gap-3 p-4">
        <Field label="De">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Até">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Categoria">
          <SelectInput
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Situação">
          <SelectInput value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todas</option>
            {EXPENSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <GhostButton
              key={t.id}
              onClick={() => setTab(t.id)}
              className={tab === t.id ? "border-gold/50 text-gold" : ""}
            >
              {t.label}
            </GhostButton>
          ))}
        </div>
      </GlassCard>

      {tab === "painel" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Despesas no período" value={currency(total)} />
            <KpiCard label="Já pago" value={currency(paid)} tone="brand" />
            <KpiCard label="Em aberto" value={currency(open)} tone="amber" />
            <KpiCard label="Em atraso" value={currency(overdue)} tone="rose" />
          </div>
          <GlassCard className="p-5">
            <SectionTitle
              title="Despesas por categoria"
              hint={`Fixas no período: ${currency(fixed)}`}
            />
            {byCategory.length === 0 ? (
              <EmptyState title="Nenhuma despesa no período" hint="Lance a primeira despesa." />
            ) : (
              <div className="space-y-2">
                {byCategory.map(([name, value]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs">
                      <span className="text-card-foreground">{name}</span>
                      <span className="text-muted-foreground">{currency(value)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-ink-2">
                      <div
                        className="h-2 rounded-full bg-gold/70"
                        style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </>
      ) : null}

      {tab === "despesas" ? (
        <GlassCard className="p-5">
          <SectionTitle title="Despesas" hint={`${filtered.length} lançamentos no período`} />
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando despesas...</p>
          ) : filtered.length === 0 ? (
            <EmptyState title="Nenhuma despesa" hint="Use o botão Lançar despesa." />
          ) : (
            <TableShell
              head={[
                "Data",
                "Descrição",
                "Categoria",
                "Fornecedor",
                "Valor",
                "Situação",
                "Comprovante",
                "",
              ]}
            >
              {filtered.map((e) => (
                <Tr key={e.id}>
                  <Td>{formatDate(e.expense_date)}</Td>
                  <Td>
                    <span className="text-card-foreground">{e.description}</span>
                    {e.installments_count > 1 ? (
                      <span className="text-muted-foreground"> · {e.installments_count}x</span>
                    ) : null}
                  </Td>
                  <Td>{e.expense_categories?.name ?? "—"}</Td>
                  <Td>
                    <div className="font-medium text-card-foreground">{e.suppliers?.legal_name ?? "—"}</div>
                    {e.suppliers?.trade_name && <div className="text-[10px] text-muted-foreground">{e.suppliers.trade_name}</div>}
                  </Td>
                  <Td>{currency(Number(e.amount))}</Td>
                  <Td>
                    <Chip
                      tone={
                        e.status === "Pago" ? "brand" : e.status === "Em atraso" ? "rose" : "amber"
                      }
                    >
                      {e.status}
                    </Chip>
                  </Td>
                  <Td>
                    {e.receipt_path ? (
                      <GhostButton onClick={() => void openReceipt(e)}>Abrir</GhostButton>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <GhostButton onClick={() => startEditExpense(e)}>Editar</GhostButton>
                      <GhostButton
                        onClick={() =>
                          void remove({
                            table: "expenses",
                            id: e.id,
                            label: `a despesa ${e.description}`,
                            keys: ["expenses"],
                          })
                        }
                      >
                        Excluir
                      </GhostButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TableShell>
          )}
        </GlassCard>
      ) : null}

      {tab === "viagens" ? (
        <GlassCard className="p-5">
          <SectionTitle
            title="Viagens e retorno"
            hint="Compare o custo da viagem com a receita gerada"
          />
          <div className="mb-3">
            <PrimaryButton
              onClick={() => {
                setEditingTrip(null);
                setTripForm(emptyTrip);
                setOpenTrip(true);
              }}
            >
              + Nova viagem
            </PrimaryButton>
          </div>
          {trips.length === 0 ? (
            <EmptyState title="Nenhuma viagem" hint="Registre a primeira viagem comercial." />
          ) : (
            <TableShell head={["Viagem", "Período", "Destino", "Custo", "Receita", "Retorno", ""]}>
              {trips.map((t) => {
                const cost = tripCost(t.id);
                const roi = cost > 0 ? ((Number(t.revenue_generated) - cost) / cost) * 100 : null;
                return (
                  <Tr key={t.id}>
                    <Td>{t.title}</Td>
                    <Td>
                      {formatDate(t.start_date)}
                      {t.end_date ? ` a ${formatDate(t.end_date)}` : ""}
                    </Td>
                    <Td>{t.destination ?? "—"}</Td>
                    <Td>{currency(cost)}</Td>
                    <Td>{currency(Number(t.revenue_generated))}</Td>
                    <Td>
                      {roi == null ? (
                        "—"
                      ) : (
                        <Chip tone={roi >= 0 ? "brand" : "rose"}>{roi.toFixed(0)}%</Chip>
                      )}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <GhostButton
                          onClick={() => {
                            setEditingTrip(t);
                            setTripForm({
                              title: t.title,
                              destination: t.destination ?? "",
                              start_date: t.start_date,
                              end_date: t.end_date ?? "",
                              purpose: t.purpose ?? "",
                              client_id: t.client_id ?? "",
                              factory_id: t.factory_id ?? "",
                              revenue_generated: String(t.revenue_generated ?? ""),
                              notes: t.notes ?? "",
                            });
                            setOpenTrip(true);
                          }}
                        >
                          Editar
                        </GhostButton>
                        <GhostButton
                          onClick={() =>
                            void remove({
                              table: "trips",
                              id: t.id,
                              label: `a viagem ${t.title}`,
                              keys: ["trips"],
                            })
                          }
                        >
                          Excluir
                        </GhostButton>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TableShell>
          )}
        </GlassCard>
      ) : null}

      {tab === "orcamento" ? (
        <GlassCard className="p-5">
          <SectionTitle
            title="Orçamento x realizado"
            hint={isAdmin ? "Somente administradores gerenciam o orçamento" : "Visão do período"}
          />
          {budgets.length === 0 ? (
            <EmptyState
              title="Nenhum orçamento definido"
              hint="Defina valores previstos por categoria para acompanhar estouros."
            />
          ) : (
            <TableShell head={["Categoria", "Período", "Previsto", "Realizado", "Diferença"]}>
              {budgets.map((b) => {
                const realizado = expenses
                  .filter(
                    (e) =>
                      e.category_id === b.category_id &&
                      e.expense_date >= b.period_start &&
                      e.expense_date <= b.period_end,
                  )
                  .reduce((s, e) => s + Number(e.amount), 0);
                const diff = Number(b.planned_amount) - realizado;
                return (
                  <Tr key={b.id}>
                    <Td>{categories.find((c) => c.id === b.category_id)?.name ?? "—"}</Td>
                    <Td>
                      {b.period_label ??
                        `${formatDate(b.period_start)} a ${formatDate(b.period_end)}`}
                    </Td>
                    <Td>{currency(Number(b.planned_amount))}</Td>
                    <Td>{currency(realizado)}</Td>
                    <Td>
                      <Chip tone={diff >= 0 ? "brand" : "rose"}>{currency(diff)}</Chip>
                    </Td>
                  </Tr>
                );
              })}
            </TableShell>
          )}
        </GlassCard>
      ) : null}

      {tab === "resultado" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Comissões recebidas" value={currency(receivedCommission)} tone="brand" />
            <KpiCard label="Comissões liberadas" value={currency(releasedCommission)} tone="cyan" />
            <KpiCard label="Despesas" value={currency(total)} tone="amber" />
            <KpiCard
              label="Resultado operacional"
              value={currency(result)}
              tone={result >= 0 ? "brand" : "rose"}
            />
          </div>
          <GlassCard className="p-5">
            <SectionTitle
              title="Como o resultado é calculado"
              hint="Comissões efetivamente recebidas no período menos as despesas do período"
            />
            <p className="text-sm text-muted-foreground">
              Margem sobre as comissões recebidas:{" "}
              <span className="text-card-foreground">
                {receivedCommission > 0
                  ? `${((result / receivedCommission) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </p>
          </GlassCard>
        </>
      ) : null}

      {tab === "cadastros" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SimpleRegistry
            title="Categorias de despesa"
            hint="Fixas e variáveis, com grupo"
            rows={categories.map((c) => ({
              id: c.id,
              main: c.name,
              side: `${c.kind}${c.group_name ? ` · ${c.group_name}` : ""}`,
            }))}
            table="expense_categories"
            queryKey="expense-categories"
            fields={[
              { key: "name", label: "Nome *" },
              { key: "kind", label: "Tipo", options: ["Fixa", "Variável"] },
              { key: "group_name", label: "Grupo" },
            ]}
            canManage={isAdmin}
          />
          <SimpleRegistry
            title="Fornecedores"
            hint="Prestadores e lojas usados nas despesas"
            rows={suppliers.map((s) => ({
              id: s.id,
              main: s.trade_name ?? s.legal_name,
              side: s.city ? `${s.city}${s.state ? `/${s.state}` : ""}` : (s.document ?? ""),
            }))}
            table="suppliers"
            queryKey="suppliers"
            fields={[
              { key: "legal_name", label: "Razão social / nome *" },
              { key: "trade_name", label: "Nome fantasia" },
              { key: "document", label: "CNPJ / CPF" },
              { key: "phone", label: "Telefone" },
              { key: "email", label: "E-mail" },
              { key: "city", label: "Cidade" },
              { key: "state", label: "Estado" },
            ]}
            canManage={isAdmin}
          />
          <SimpleRegistry
            title="Centros de custo"
            hint="Agrupam despesas por fábrica, marca ou área"
            rows={costCenters.map((c) => ({ id: c.id, main: c.name, side: c.notes ?? "" }))}
            table="cost_centers"
            queryKey="cost-centers"
            fields={[
              { key: "name", label: "Nome *" },
              { key: "notes", label: "Observações" },
            ]}
            canManage={isAdmin}
          />
          <SimpleRegistry
            title="Contas"
            hint="Caixa, bancos e cartões usados nos pagamentos"
            rows={accounts.map((a) => ({
              id: a.id,
              main: a.name,
              side: `${a.kind}${a.bank_name ? ` · ${a.bank_name}` : ""}`,
            }))}
            table="financial_accounts"
            queryKey="financial-accounts"
            fields={[
              { key: "name", label: "Nome *" },
              { key: "kind", label: "Tipo", options: ["Caixa", "Banco", "Cartão"] },
              { key: "bank_name", label: "Banco" },
            ]}
            canManage={isAdmin}
          />
          <SimpleRegistry
            title="Veículos"
            hint="Para combustível, pedágio e manutenção"
            rows={vehicles.map((v) => ({ id: v.id, main: v.name, side: v.plate ?? "" }))}
            table="vehicles"
            queryKey="vehicles"
            fields={[
              { key: "name", label: "Identificação *" },
              { key: "plate", label: "Placa" },
              { key: "usage", label: "Uso" },
            ]}
            canManage={isAdmin}
          />
        </div>
      ) : null}

      {/* ============ Lançamento de despesa ============ */}
      <Modal
        open={openExpense}
        onClose={() => setOpenExpense(false)}
        title={editingExpense ? "Editar despesa" : "Lançar despesa"}
        subtitle="Vincule a categoria, viagem, fornecedor e anexe o comprovante"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Descrição *" className="sm:col-span-2">
            <TextInput
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={160}
            />
          </Field>
          <Field label="Categoria">
            <SelectInput
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Fornecedor">
            <SelectInput
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.trade_name ?? s.legal_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Valor total *">
            <MoneyInput
              value={form.amount}
              onValueChange={(val) => setForm({ ...form, amount: val })}
            />
          </Field>
          <Field label="Data da despesa">
            <TextInput
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            />
          </Field>
          <Field label="Vencimento">
            <TextInput
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </Field>
          <Field label="Forma de pagamento">
            <SelectInput
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Parcelas">
            <TextInput
              type="number"
              min={1}
              max={48}
              value={form.installments_count}
              onChange={(e) => setForm({ ...form, installments_count: e.target.value })}
            />
          </Field>
          <Field label="Recorrência">
            <SelectInput
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
            >
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Situação">
            <SelectInput
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {EXPENSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Valor já pago">
            <MoneyInput
              value={form.paid_amount}
              onValueChange={(val) => setForm({ ...form, paid_amount: val })}
            />
          </Field>
          <Field label="Centro de custo">
            <SelectInput
              value={form.cost_center_id}
              onChange={(e) => setForm({ ...form, cost_center_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {costCenters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Conta">
            <SelectInput
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Viagem">
            <SelectInput
              value={form.trip_id}
              onChange={(e) => setForm({ ...form, trip_id: e.target.value })}
            >
              <option value="">Nenhuma</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Veículo">
            <SelectInput
              value={form.vehicle_id}
              onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            >
              <option value="">Nenhum</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Litros (combustível)">
            <TextInput
              value={form.liters}
              onChange={(e) => setForm({ ...form, liters: e.target.value })}
              inputMode="decimal"
            />
          </Field>
          <Field label="Km do painel">
            <TextInput
              value={form.odometer}
              onChange={(e) => setForm({ ...form, odometer: e.target.value })}
              inputMode="decimal"
            />
          </Field>
          <Field label="Fábrica">
            <SelectInput
              value={form.factory_id}
              onChange={(e) => setForm({ ...form, factory_id: e.target.value })}
            >
              <option value="">Nenhuma</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.trade_name ?? f.legal_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Marca">
            <SelectInput
              value={form.brand_id}
              onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
            >
              <option value="">Nenhuma</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brand}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cliente">
            <SelectInput
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name ?? c.legal_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Comprovante (imagem ou PDF)" className="sm:col-span-2">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-border bg-ink-2/60 px-3 py-2 text-xs text-muted-foreground"
            />
            {editingExpense?.receipt_name ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Anexo atual: {editingExpense.receipt_name}
              </p>
            ) : null}
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setOpenExpense(false)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void saveExpense()}>
            {saving ? "Salvando..." : "Salvar despesa"}
          </PrimaryButton>
        </div>
      </Modal>

      {/* ============ Viagem ============ */}
      <Modal
        open={openTrip}
        onClose={() => setOpenTrip(false)}
        title={editingTrip ? "Editar viagem" : "Nova viagem"}
        subtitle="As despesas vinculadas formam o custo total da viagem"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título *" className="sm:col-span-2">
            <TextInput
              value={tripForm.title}
              onChange={(e) => setTripForm({ ...tripForm, title: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Destino">
            <TextInput
              value={tripForm.destination}
              onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
            />
          </Field>
          <Field label="Objetivo">
            <TextInput
              value={tripForm.purpose}
              onChange={(e) => setTripForm({ ...tripForm, purpose: e.target.value })}
            />
          </Field>
          <Field label="Início">
            <TextInput
              type="date"
              value={tripForm.start_date}
              onChange={(e) => setTripForm({ ...tripForm, start_date: e.target.value })}
            />
          </Field>
          <Field label="Fim">
            <TextInput
              type="date"
              value={tripForm.end_date}
              onChange={(e) => setTripForm({ ...tripForm, end_date: e.target.value })}
            />
          </Field>
          <Field label="Cliente atendido">
            <SelectInput
              value={tripForm.client_id}
              onChange={(e) => setTripForm({ ...tripForm, client_id: e.target.value })}
            >
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name ?? c.legal_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Fábrica">
            <SelectInput
              value={tripForm.factory_id}
              onChange={(e) => setTripForm({ ...tripForm, factory_id: e.target.value })}
            >
              <option value="">Nenhuma</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.trade_name ?? f.legal_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Receita gerada pela viagem">
            <MoneyInput
              value={tripForm.revenue_generated}
              onValueChange={(val) => setTripForm({ ...tripForm, revenue_generated: val })}
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea
              rows={3}
              value={tripForm.notes}
              onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setOpenTrip(false)}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => void saveTrip()}>Salvar viagem</PrimaryButton>
        </div>
      </Modal>
    </AppShell>
  );
}

/** Cadastro simples reutilizado pelas listas de apoio do financeiro. */
function SimpleRegistry({
  title,
  hint,
  rows,
  table,
  queryKey,
  fields,
  canManage,
}: {
  title: string;
  hint: string;
  rows: { id: string; main: string; side: string }[];
  table: string;
  queryKey: string;
  fields: { key: string; label: string; options?: string[] }[];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const remove = useRemoveRecord();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  async function save() {
    const first = fields[0];
    if (!first || !values[first.key]?.trim()) {
      toast.error(`Informe ${first?.label ?? "os dados"}.`);
      return;
    }
    const payload: Record<string, string | null> = {};
    for (const f of fields) payload[f.key] = values[f.key]?.trim() || null;
    payload[first.key] = (values[first.key] ?? "").trim();
    const { error } = await crmDb.from(table).insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    setValues({});
    void qc.invalidateQueries({ queryKey: [queryKey] });
    toast.success("Cadastro incluído.");
  }

  return (
    <GlassCard className="p-5">
      <SectionTitle title={title} hint={hint} />
      {canManage ? (
        <div className="mb-3">
          <GhostButton onClick={() => setOpen(true)}>+ Incluir</GhostButton>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="Nada cadastrado" hint={hint} />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-ink-2/40 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-card-foreground">{r.main}</p>
                {r.side ? (
                  <p className="truncate text-[11px] text-muted-foreground">{r.side}</p>
                ) : null}
              </div>
              {canManage ? (
                <GhostButton
                  onClick={() =>
                    void remove({ table, id: r.id, label: r.main, keys: [queryKey] })
                  }
                >
                  Excluir
                </GhostButton>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={`Incluir em ${title}`}>
        <div className="grid gap-3">
          {fields.map((f) =>
            f.options ? (
              <Field key={f.key} label={f.label}>
                <SelectInput
                  value={values[f.key] ?? f.options[0]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                >
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            ) : (
              <Field key={f.key} label={f.label}>
                <TextInput
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              </Field>
            ),
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => void save()}>Salvar</PrimaryButton>
        </div>
      </Modal>
    </GlassCard>
  );
}
