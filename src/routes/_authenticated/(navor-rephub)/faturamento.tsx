import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
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
  ShowAllToggle,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import { RepBadge, TableShell, Td, Tr } from "@/components/navor-rephub/repui";
import { currency, formatDate } from "@/lib/crm";
import { installmentTone, pct, sumMoney, toCents } from "@/lib/rep";
import { useRemoveRecord } from "@/lib/registro";
import { crmDb, useBrands, useClients, useSettings } from "@/hooks/useCrm";
import {
  logAudit,
  useCollections,
  useFactories,
  useInvoices,
  useOrders,
  type Installment,
  type Invoice,
} from "@/hooks/useRep";
import { useCurrentUser } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/faturamento")({
  head: () => ({
    meta: [
      { title: "Faturamento | CRM Representação" },
      {
        name: "description",
        content:
          "Notas fiscais, faturamento parcial, parcelas, vencimentos e liquidez dos pedidos da representação.",
      },
      { property: "og:title", content: "Faturamento | CRM Representação" },
      {
        property: "og:description",
        content: "Registre notas, parcelas e pagamentos e acompanhe contas em atraso.",
      },
    ],
  }),
  component: FaturamentoPage,
});

const emptyForm = {
  order_id: "",
  nf_number: "",
  issue_date: new Date().toISOString().slice(0, 10),
  invoiced_value: "",
  net_value: "",
  invoiced_pieces: "",
  custom_commission_pct: "",
  installments: "1",
  first_due: "",
  interval_days: "30",
  notes: "",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getPeriodDates(period: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "last_month") {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    return {
      start: firstDay.toISOString().slice(0, 10),
      end: lastDay.toISOString().slice(0, 10),
      label: "Último mês",
    };
  }
  if (period === "this_month") {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      start: firstDay.toISOString().slice(0, 10),
      end: lastDay.toISOString().slice(0, 10),
      label: "Mês atual",
    };
  }
  if (period === "last_30_days") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return {
      start: d.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
      label: "Últimos 30 dias",
    };
  }
  if (period === "last_90_days") {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return {
      start: d.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
      label: "Últimos 90 dias",
    };
  }
  if (period === "this_year") {
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: "Ano atual",
    };
  }
  return { start: "", end: "", label: "Todos os períodos" };
}

function FaturamentoPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const removeRecord = useRemoveRecord();
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: orders = [] } = useOrders();
  const { data: factories = [] } = useFactories();
  const { data: clients = [] } = useClients();
  const { data: brands = [] } = useBrands();
  const { data: collections = [] } = useCollections();
  const { data: settings } = useSettings();

  const hideClosed = settings?.["active_collections_only"] === "true";
  const visibleInvoices = useMemo(() => {
    if (!hideClosed) return invoices;
    const activeCols = new Set(collections.filter((c) => c.status !== "Encerrada").map((c) => c.id));
    return invoices.filter((i) => !i.collection_id || activeCols.has(i.collection_id));
  }, [invoices, collections, hideClosed]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [payTarget, setPayTarget] = useState<Installment | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [q, setQ] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [tab, setTab] = useState<"notas" | "parcelas">("notas");

  useEffect(() => {
    if (!open) {
      setOrderSearch("");
    }
  }, [open]);
  const [sortConfigNotas, setSortConfigNotas] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [sortConfigParcelas, setSortConfigParcelas] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const [period, setPeriod] = useState("hide_all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [installmentStatusFilter, setInstallmentStatusFilter] = useState("all");

  // Edição de nota fiscal
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({
    nf_number: "",
    issue_date: "",
    invoiced_value: "",
    net_value: "",
    invoiced_pieces: "",
    custom_commission_pct: "",
    notes: "",
  });

  function openEditInvoice(i: Invoice) {
    setEditingInvoice(i);
    setEditForm({
      nf_number: i.nf_number ?? "",
      issue_date: i.issue_date ? i.issue_date.slice(0, 10) : "",
      invoiced_value: String(i.invoiced_value ?? ""),
      net_value: i.net_value ? String(i.net_value) : "",
      invoiced_pieces: i.invoiced_pieces ? String(i.invoiced_pieces) : "",
      custom_commission_pct: i.custom_commission_pct ? String(i.custom_commission_pct) : "",
      notes: i.notes ?? "",
    });
  }

  async function saveEditInvoice() {
    if (!editingInvoice) return;
    const value = Number(editForm.invoiced_value);
    if (!value || value <= 0) {
      toast.error("Informe o valor faturado.");
      return;
    }
    setSaving(true);
    const { error } = await crmDb
      .from("invoices")
      .update({
        nf_number: editForm.nf_number.trim() || null,
        issue_date: editForm.issue_date,
        invoiced_value: value,
        net_value: editForm.net_value ? Number(editForm.net_value) : null,
        invoiced_pieces: editForm.invoiced_pieces ? Number(editForm.invoiced_pieces) : null,
        custom_commission_pct: editForm.custom_commission_pct ? Number(editForm.custom_commission_pct) : null,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", editingInvoice.id);

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    const oldValue = Number(editingInvoice.invoiced_value ?? 0);
    if (Math.abs(value - oldValue) >= 0.01) {
      const { data: insts } = await crmDb
        .from("invoice_installments")
        .select("id, status, number, paid_amount")
        .eq("invoice_id", editingInvoice.id)
        .order("number", { ascending: true });
      const items = (insts ?? []) as { id: string; status: string; number: number; paid_amount: number }[];
      const anyPaid = items.some((it) => it.status === "Pago" || Number(it.paid_amount ?? 0) > 0);
      if (!anyPaid && items.length > 0) {
        const cents = toCents(value);
        const count = items.length;
        const base = Math.floor(cents / count);
        const rest = cents - base * count;
        for (let idx = 0; idx < count; idx++) {
          const it = items[idx];
          if (!it) continue;
          const newAmt = (base + (idx === 0 ? rest : 0)) / 100;
          await crmDb.from("invoice_installments").update({ amount: newAmt }).eq("id", it.id);
        }
      }
    }

    if (editingInvoice.order_id) {
      const otherInvoices = invoices.filter(
        (x) => x.order_id === editingInvoice.order_id && x.id !== editingInvoice.id,
      );
      const totalOrderInvoiced = sumMoney(otherInvoices, (x) => x.invoiced_value) + value;
      const orderTotal = Number(editingInvoice.orders?.total_value ?? 0);
      const nextStatus =
        toCents(totalOrderInvoiced) >= toCents(orderTotal) ? "Faturado" : "Faturamento parcial";
      await crmDb.from("orders").update({ status: nextStatus }).eq("id", editingInvoice.order_id);
    }

    await logAudit({
      entityType: "invoice",
      entityId: editingInvoice.id,
      action: "Edição",
      description: `Faturamento da NF ${editForm.nf_number.trim() || editingInvoice.orders?.internal_number || "—"} editado — valor ${currency(value)}`,
      userName: user?.name ?? null,
      userId: user?.id ?? null,
    });

    for (const key of ["invoices", "orders", "order", "commissions", "audit-logs"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
    setSaving(false);
    setEditingInvoice(null);
    toast.success("Nota fiscal atualizada e comissões recalculadas.");
  }

  const periodDates = useMemo(
    () => getPeriodDates(period),
    [period],
  );

  const filteredInvoices = useMemo(() => {
    const term = q.trim().toLowerCase();
    const { start, end } = periodDates;

    return visibleInvoices.filter((i) => {
      if (start && i.issue_date < start) return false;
      if (end && i.issue_date > end) return false;
      if (dateStart && i.issue_date < dateStart) return false;
      if (dateEnd && i.issue_date > dateEnd) return false;
      if (factoryFilter !== "all" && i.factory_id !== factoryFilter) return false;
      if (clientFilter !== "all" && i.client_id !== clientFilter) return false;
      if (brandFilter !== "all" && i.brand_id !== brandFilter) return false;
      if (!term) return true;
      const termIsNumeric = /^\d+$/.test(term);
      return [
        i.nf_number,
        i.clients?.legal_name,
        i.clients?.trade_name,
        i.clients?.cnpj ? (termIsNumeric ? i.clients.cnpj.replace(/\D/g, "") : i.clients.cnpj) : "",
        i.clients?.city,
        i.clients?.state,
        i.brands?.brand,
        i.factories?.trade_name,
        i.factories?.legal_name,
        i.orders?.internal_number,
        i.orders?.factory_order_number,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [visibleInvoices, periodDates, factoryFilter, clientFilter, brandFilter, q, dateStart, dateEnd]);

  const installments = useMemo(
    () =>
      filteredInvoices.flatMap((i) =>
        (i.invoice_installments ?? []).map((p) => ({
          ...p,
          nf: i.nf_number || "—",
          client: i.clients?.legal_name ?? "—",
          client_trade: i.clients?.trade_name ?? "",
          brand: i.brands?.brand ?? "—",
          factory: i.factories?.trade_name ?? i.factories?.legal_name ?? "—",
        })),
      ),
    [filteredInvoices],
  );

  const filteredInstallments = useMemo(() => {
    const term = q.trim().toLowerCase();
    return installments.filter((p) => {
      if (installmentStatusFilter !== "all" && p.status !== installmentStatusFilter) return false;
      if (!term) return true;
      return [p.nf, p.client, p.client_trade, p.brand, p.factory].some((v) => v.toLowerCase().includes(term));
    });
  }, [installments, installmentStatusFilter, q]);

  const sortedInvoices = useMemo(() => {
    let sortable = [...filteredInvoices];
    if (sortConfigNotas) {
      sortable.sort((a, b) => {
        let aValue: any = a[sortConfigNotas.key as keyof typeof a];
        let bValue: any = b[sortConfigNotas.key as keyof typeof b];

        if (sortConfigNotas.key === 'nf_number') {
          aValue = a.nf_number || ''; bValue = b.nf_number || '';
        } else if (sortConfigNotas.key === 'order_number') {
          aValue = a.orders?.internal_number || ''; bValue = b.orders?.internal_number || '';
        } else if (sortConfigNotas.key === 'client') {
          aValue = a.clients?.legal_name || ''; bValue = b.clients?.legal_name || '';
        } else if (sortConfigNotas.key === 'brand') {
          aValue = a.brands?.brand || ''; bValue = b.brands?.brand || '';
        } else if (sortConfigNotas.key === 'issue_date') {
          aValue = a.issue_date || ''; bValue = b.issue_date || '';
        } else if (sortConfigNotas.key === 'invoiced_value') {
          aValue = Number(a.invoiced_value || 0); bValue = Number(b.invoiced_value || 0);
        } else if (sortConfigNotas.key === 'paid_value') {
          aValue = sumMoney(a.invoice_installments || [], (x) => x.paid_amount);
          bValue = sumMoney(b.invoice_installments || [], (x) => x.paid_amount);
        }

        if (aValue < bValue) return sortConfigNotas.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfigNotas.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filteredInvoices, sortConfigNotas]);

  const sortedInstallments = useMemo(() => {
    let sortable = [...filteredInstallments];
    if (sortConfigParcelas) {
      sortable.sort((a, b) => {
        let aValue: any = a[sortConfigParcelas.key as keyof typeof a];
        let bValue: any = b[sortConfigParcelas.key as keyof typeof b];

        if (sortConfigParcelas.key === 'nf_number') {
          aValue = a.nf || ''; bValue = b.nf || '';
        } else if (sortConfigParcelas.key === 'client') {
          aValue = a.client || ''; bValue = b.client || '';
        } else if (sortConfigParcelas.key === 'number') {
          aValue = Number(a.number || 0); bValue = Number(b.number || 0);
        } else if (sortConfigParcelas.key === 'due_date') {
          aValue = a.due_date || ''; bValue = b.due_date || '';
        } else if (sortConfigParcelas.key === 'amount') {
          aValue = Number(a.amount || 0); bValue = Number(b.amount || 0);
        } else if (sortConfigParcelas.key === 'paid_amount') {
          aValue = Number(a.paid_amount || 0); bValue = Number(b.paid_amount || 0);
        } else if (sortConfigParcelas.key === 'status') {
          aValue = a.status || ''; bValue = b.status || '';
        }

        if (aValue < bValue) return sortConfigParcelas.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfigParcelas.direction === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort for installments
      sortable.sort((a, b) => a.due_date.localeCompare(b.due_date));
    }
    return sortable;
  }, [filteredInstallments, sortConfigParcelas]);

  function SortButtonNotas({ label, sortKey }: { label: string, sortKey: string }) {
    return (
      <button 
        onClick={() => {
          let direction: "asc" | "desc" = "asc";
          if (sortConfigNotas && sortConfigNotas.key === sortKey && sortConfigNotas.direction === "asc") direction = "desc";
          setSortConfigNotas({ key: sortKey, direction });
        }}
        className="flex items-center gap-1 hover:text-brand transition-colors select-none"
      >
        {label}
        <span className="text-[10px] opacity-70 w-3 inline-block">
          {sortConfigNotas?.key === sortKey ? (sortConfigNotas.direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  function SortButtonParcelas({ label, sortKey }: { label: string, sortKey: string }) {
    return (
      <button 
        onClick={() => {
          let direction: "asc" | "desc" = "asc";
          if (sortConfigParcelas && sortConfigParcelas.key === sortKey && sortConfigParcelas.direction === "asc") direction = "desc";
          setSortConfigParcelas({ key: sortKey, direction });
        }}
        className="flex items-center gap-1 hover:text-brand transition-colors select-none"
      >
        {label}
        <span className="text-[10px] opacity-70 w-3 inline-block">
          {sortConfigParcelas?.key === sortKey ? (sortConfigParcelas.direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  const totalInvoiced = sumMoney(filteredInvoices, (i) => i.invoiced_value);
  const totalPaid = sumMoney(filteredInstallments, (p) => p.paid_amount);
  const openInstallments = filteredInstallments.filter((p) => p.status !== "Pago" && p.status !== "Cancelado");
  const overdue = openInstallments.filter((p) => p.due_date < today());
  const openBalance = sumMoney(openInstallments, (p) => Number(p.amount) - Number(p.paid_amount));

  const orderOptions = orders.filter((o) => o.status !== "Cancelado");

  const filteredOrderOptions = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    const termIsNumeric = /^\d+$/.test(term);

    return orderOptions.filter((o) => {
      if (!term) return true;

      return [
        o.internal_number,
        o.factory_order_number,
        o.clients?.legal_name,
        o.clients?.trade_name,
        o.clients?.cnpj ? (termIsNumeric ? o.clients.cnpj.replace(/\D/g, "") : o.clients.cnpj) : "",
        o.clients?.city,
        o.clients?.state,
        o.brands?.brand,
        o.factories?.trade_name,
        o.factories?.legal_name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [orderOptions, orderSearch]);

  useEffect(() => {
    const onlyResult = filteredOrderOptions[0];
    if (orderSearch && !form.order_id && filteredOrderOptions.length === 1 && onlyResult) {
      setForm((prev) => ({ ...prev, order_id: onlyResult.id }));
    }
  }, [filteredOrderOptions, orderSearch, form.order_id]);

  const selectedOrder = orderOptions.find((o) => o.id === form.order_id);
  const alreadyInvoiced = selectedOrder
    ? sumMoney(
        invoices.filter((i) => i.order_id === selectedOrder.id),
        (i) => i.invoiced_value,
      )
    : 0;

  async function saveInvoice() {
    if (!form.order_id) {
      toast.error("Selecione o pedido.");
      return;
    }
    const value = Number(form.invoiced_value);
    if (!value || value <= 0) {
      toast.error("Informe o valor faturado.");
      return;
    }
    const count = Math.max(1, Number(form.installments) || 1);
    setSaving(true);
    const order = orderOptions.find((o) => o.id === form.order_id);
    if (!order) {
      setSaving(false);
      toast.error("O pedido selecionado não está mais disponível. Pesquise e selecione novamente.");
      return;
    }
    const { data, error } = await crmDb
      .from("invoices")
      .insert({
        order_id: order.id,
        client_id: order.client_id,
        brand_id: order.brand_id,
        factory_id: order.factory_id,
        collection_id: order.collection_id,
        brand_collection_id: order.brand_collection_id ?? null,
        nf_number: form.nf_number.trim() || null,
        issue_date: form.issue_date,
        invoiced_value: value,
        net_value: form.net_value ? Number(form.net_value) : null,
        invoiced_pieces: form.invoiced_pieces ? Number(form.invoiced_pieces) : null,
        custom_commission_pct: form.custom_commission_pct ? Number(form.custom_commission_pct) : null,
        notes: form.notes.trim() || null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setSaving(false);
      const detail = error?.message ?? "Não foi possível concluir o lançamento.";
      toast.error(`Não foi possível lançar o faturamento: ${detail}`);
      return;
    }
    const invoiceId = (data as { id: string }).id;

    // Parcelas divididas em centavos, com o resto somado à primeira.
    const cents = toCents(value);
    const base = Math.floor(cents / count);
    const rest = cents - base * count;
    const start = form.first_due || form.issue_date;
    const step = Math.max(1, Number(form.interval_days) || 30);
    const rows = Array.from({ length: count }, (_, idx) => {
      const due = new Date(`${start}T12:00:00`);
      due.setDate(due.getDate() + idx * step);
      return {
        invoice_id: invoiceId,
        number: idx + 1,
        due_date: due.toISOString().slice(0, 10),
        amount: (base + (idx === 0 ? rest : 0)) / 100,
        status: "Em aberto",
      };
    });
    const { error: instErr } = await crmDb.from("invoice_installments").insert(rows);
    setSaving(false);
    if (instErr) {
      toast.error(instErr.message);
      return;
    }

    const totalNow = alreadyInvoiced + value;
    const nextStatus =
      toCents(totalNow) >= toCents(Number(order.total_value ?? 0)) ? "Faturado" : "Faturamento parcial";
    await crmDb.from("orders").update({ status: nextStatus }).eq("id", order.id);
    await logAudit({
      entityType: "order",
      entityId: order.id,
      action: "Faturamento",
      description: `Faturamento da NF ${form.nf_number.trim() || order.internal_number || "—"} lançado — ${currency(value)} em ${count}x`,
      userName: user?.name ?? null,
      userId: user?.id ?? null,
    });

    for (const key of ["invoices", "orders", "order", "commissions", "audit-logs"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
    setOpen(false);
    setForm({ ...emptyForm });
    toast.success("Faturamento lançado e comissão recalculada.");
  }

  async function registerPayment() {
    if (!payTarget) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Informe o valor pago.");
      return;
    }
    const paid = Number(payTarget.paid_amount ?? 0) + amount;
    const total = Number(payTarget.amount ?? 0);
    const status =
      toCents(paid) >= toCents(total) ? "Pago" : paid > 0 ? "Pago parcialmente" : payTarget.status;
    const { error } = await crmDb
      .from("invoice_installments")
      .update({
        paid_amount: Math.min(paid, total),
        paid_at: status === "Pago" ? payDate : payTarget.paid_at,
        status,
      })
      .eq("id", payTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    for (const key of ["invoices", "commissions", "orders"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
    setPayTarget(null);
    setPayAmount("");
    toast.success("Pagamento registrado. Comissão de liquidez atualizada.");
  }

  return (
    <AppShell
      title="Faturamento"
      subtitle={`Notas fiscais, parcelas e liquidez · ${periodDates.label}`}
      actions={<PrimaryButton onClick={() => setOpen(true)}>+ Lançar faturamento</PrimaryButton>}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Exibindo: <strong className="text-card-foreground">{periodDates.label}</strong>
          {periodDates.start && periodDates.end ? ` (${formatDate(periodDates.start)} até ${formatDate(periodDates.end)})` : ""}
          {filteredInvoices.length > 0 ? ` · ${filteredInvoices.length} nota(s) encontrada(s)` : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total faturado" value={currency(totalInvoiced)} />
        <KpiCard
          label="Recebido (liquidez)"
          value={currency(totalPaid)}
          tone="brand"
          hint={`${pct(totalPaid, totalInvoiced).toFixed(0)}% do faturado`}
        />
        <KpiCard label="Em aberto" value={currency(openBalance)} tone="cyan" hint={`${openInstallments.length} parcelas`} />
        <KpiCard
          label="Em atraso"
          value={currency(sumMoney(overdue, (p) => Number(p.amount) - Number(p.paid_amount)))}
          tone={overdue.length ? "rose" : "muted"}
          hint={`${overdue.length} parcelas vencidas`}
        />
      </div>

      <GlassCard className="p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-card-foreground">Filtros</span>
          <ShowAllToggle 
            showAll={period !== "hide_all"} 
            onToggle={(v) => setPeriod(v ? "this_month" : "hide_all")} 
          />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border p-1">
            {(["notas", "parcelas"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  tab === t
                    ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-card-foreground"
                    : "rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
                }
              >
                {t === "notas" ? "Notas fiscais" : "Parcelas"}
              </button>
            ))}
          </div>

          <SelectInput
            value={period === "hide_all" ? "this_month" : period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-44"
          >
            <option value="last_month">Último mês</option>
            <option value="this_month">Mês atual</option>
            <option value="last_30_days">Últimos 30 dias</option>
            <option value="last_90_days">Últimos 90 dias</option>
            <option value="this_year">Ano atual</option>
            <option value="all">Todos os períodos</option>
          </SelectInput>

          <div className="flex items-center gap-1.5">
            <TextInput
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-36"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <TextInput
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-36"
            />
            {(dateStart || dateEnd) && (
              <GhostButton className="text-xs" onClick={() => { setDateStart(""); setDateEnd(""); }}>Limpar</GhostButton>
            )}
          </div>

          <SelectInput
            value={factoryFilter}
            onChange={(e) => setFactoryFilter(e.target.value)}
            className="w-44"
          >
            <option value="all">Todas as fábricas</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.trade_name ?? f.legal_name}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="w-40"
          >
            <option value="all">Todas as marcas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.brand}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="w-44"
          >
            <option value="all">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.trade_name ?? c.legal_name}
              </option>
            ))}
          </SelectInput>

          {tab === "parcelas" ? (
            <SelectInput
              value={installmentStatusFilter}
              onChange={(e) => setInstallmentStatusFilter(e.target.value)}
              className="w-36"
            >
              <option value="all">Todos status</option>
              <option value="Em aberto">Em aberto</option>
              <option value="Pago">Pagas</option>
              <option value="Pago parcialmente">Parciais</option>
            </SelectInput>
          ) : null}

          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar NF, cliente, CNPJ, cidade, pedido..."
            className="min-w-48 flex-1"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : period === "hide_all" && !q && factoryFilter === "all" && clientFilter === "all" && brandFilter === "all" && !dateStart && !dateEnd && (tab !== "parcelas" || installmentStatusFilter === "all") ? (
          <EmptyState
            title="Pesquise para listar"
            hint="Selecione um período ou filtro acima para exibir os faturamentos."
          />
        ) : tab === "notas" ? (
          filteredInvoices.length === 0 ? (
            <EmptyState title="Nenhuma nota lançada" hint="Registre o faturamento de um pedido." />
          ) : (
            <TableShell head={[
              <SortButtonNotas key="1" label="NF" sortKey="nf_number" />,
              <SortButtonNotas key="2" label="Pedido" sortKey="order_number" />,
              <SortButtonNotas key="3" label="Cliente" sortKey="client" />,
              <SortButtonNotas key="4" label="Marca" sortKey="brand" />,
              <SortButtonNotas key="5" label="Emissão" sortKey="issue_date" />,
              <SortButtonNotas key="6" label="Valor" sortKey="invoiced_value" />,
              <SortButtonNotas key="7" label="Pago" sortKey="paid_value" />,
              ""
            ]}>
              {sortedInvoices.map((i) => {
                const inst = i.invoice_installments ?? [];
                return (
                  <Tr key={i.id}>
                    <Td className="font-medium text-card-foreground">{i.nf_number || "—"}</Td>
                    <Td className="text-muted-foreground">{i.orders?.internal_number ?? "—"}</Td>
                    <Td>
                      <div className="font-medium text-card-foreground">{i.clients?.legal_name ?? "—"}</div>
                      {i.clients?.trade_name && <div className="text-[10px] text-muted-foreground">{i.clients.trade_name}</div>}
                    </Td>
                    <Td className="text-muted-foreground">{i.brands?.brand ?? "—"}</Td>
                    <Td className="text-muted-foreground">{formatDate(i.issue_date)}</Td>
                    <Td className="tabular-nums text-card-foreground">
                      {currency(Number(i.invoiced_value ?? 0))}
                    </Td>
                    <Td className="tabular-nums text-muted-foreground">
                      {currency(sumMoney(inst, (x) => x.paid_amount))}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <GhostButton
                          className="px-2.5 py-1 text-xs"
                          onClick={() => openEditInvoice(i)}
                        >
                          Editar
                        </GhostButton>
                        {user?.role === "admin" ? (
                          <GhostButton
                            className="border-rose/30 px-2.5 py-1 text-xs text-rose hover:bg-rose/10"
                            onClick={() =>
                              void removeRecord({
                                table: "invoices",
                                id: i.id,
                                label: `o faturamento da NF ${i.nf_number || i.orders?.internal_number || "—"}`,
                                keys: ["invoices", "installments", "commissions", "orders"],
                              })
                            }
                          >
                            Excluir
                          </GhostButton>
                        ) : null}
                      </span>
                    </Td>
                  </Tr>
                );
              })}

            </TableShell>
          )
        ) : filteredInstallments.length === 0 ? (
          <EmptyState title="Nenhuma parcela" hint="As parcelas aparecem ao lançar um faturamento." />
        ) : (
          <TableShell head={[
            <SortButtonParcelas key="1" label="NF" sortKey="nf_number" />,
            <SortButtonParcelas key="2" label="Cliente" sortKey="client" />,
            <SortButtonParcelas key="3" label="Parcela" sortKey="number" />,
            <SortButtonParcelas key="4" label="Vencimento" sortKey="due_date" />,
            <SortButtonParcelas key="5" label="Valor" sortKey="amount" />,
            <SortButtonParcelas key="6" label="Pago" sortKey="paid_amount" />,
            <SortButtonParcelas key="7" label="Status" sortKey="status" />,
            ""
          ]}>
            {sortedInstallments
              .map((p) => {
                const late = p.due_date < today() && p.status !== "Pago" && p.status !== "Cancelado";
                return (
                  <Tr key={p.id}>
                    <Td className="text-card-foreground">{p.nf}</Td>
                    <Td>
                      <div className="text-card-foreground">{p.client}</div>
                      {p.client_trade && <div className="text-[10px] text-muted-foreground">{p.client_trade}</div>}
                    </Td>
                    <Td className="text-muted-foreground">{p.number}</Td>
                    <Td className={late ? "font-semibold text-rose" : "text-muted-foreground"}>
                      {formatDate(p.due_date)}
                    </Td>
                    <Td className="tabular-nums text-card-foreground">{currency(Number(p.amount ?? 0))}</Td>
                    <Td className="tabular-nums text-muted-foreground">
                      {currency(Number(p.paid_amount ?? 0))}
                    </Td>
                    <Td>
                      <RepBadge status={late ? "Em atraso" : p.status} tones={installmentTone} />
                    </Td>
                    <Td>
                      {p.status === "Pago" ? null : (
                        <GhostButton
                          onClick={() => {
                            setPayTarget(p);
                            setPayAmount(String(Number(p.amount ?? 0) - Number(p.paid_amount ?? 0)));
                            setPayDate(today());
                          }}
                        >
                          Registrar pagamento
                        </GhostButton>
                      )}
                    </Td>
                  </Tr>
                );
              })}
          </TableShell>
        )}
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Lançar faturamento"
        subtitle="Permite faturamento parcial e parcelamento automático"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {form.order_id ? (
            <Field label="Pedido selecionado" className="sm:col-span-2">
              <div className="flex items-center justify-between p-3 border border-brand/20 bg-brand/5 rounded-lg">
                <div>
                  <div className="font-medium text-brand">
                    {selectedOrder?.internal_number} — {selectedOrder?.clients?.legal_name ?? "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedOrder?.clients?.trade_name ? `${selectedOrder.clients.trade_name} · ` : ""}{selectedOrder?.clients?.city || "—"}/{selectedOrder?.clients?.state || "—"} · {selectedOrder?.brands?.brand} · {currency(Number(selectedOrder?.total_value ?? 0))}
                  </div>
                </div>
                <GhostButton className="text-xs text-rose hover:text-rose hover:bg-rose/10" onClick={() => { setForm({...form, order_id: ""}); setOrderSearch(""); }}>Remover</GhostButton>
              </div>
            </Field>
          ) : (
            <>
              <Field label="Buscar pedido" className="sm:col-span-2">
                <TextInput
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Digite o número, cliente, CNPJ, cidade, marca ou fábrica..."
                />
              </Field>
              <Field label="Resultados" className="sm:col-span-2">
                {filteredOrderOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg border border-border">Nenhum pedido encontrado com "{orderSearch}".</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-1">
                    {filteredOrderOptions.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setForm({ ...form, order_id: o.id })}
                        className="text-left p-2 rounded-md hover:bg-muted/50 transition-colors border border-border/50 hover:border-brand/30 flex flex-col bg-card"
                      >
                        <div className="font-medium text-card-foreground text-sm flex items-center justify-between w-full">
                          <span>{o.internal_number} — {o.clients?.legal_name ?? "—"}</span>
                          <span className="text-brand tabular-nums">{currency(Number(o.total_value ?? 0))}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {o.clients?.trade_name ? `${o.clients.trade_name} · ` : ""}{o.clients?.city || "—"}/{o.clients?.state || "—"} · {o.brands?.brand}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            </>
          )}
          {selectedOrder ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Pedido de {currency(Number(selectedOrder.total_value ?? 0))} · já faturado{" "}
              {currency(alreadyInvoiced)} · saldo{" "}
              {currency(Number(selectedOrder.total_value ?? 0) - alreadyInvoiced)}
            </p>
          ) : null}
          <Field label="Número da NF">
            <TextInput
              value={form.nf_number}
              onChange={(e) => setForm({ ...form, nf_number: e.target.value })}
            />
          </Field>
          <Field label="Data de emissão *">
            <TextInput
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            />
          </Field>
          <Field label="Valor faturado *">
            <MoneyInput
              value={form.invoiced_value}
              onValueChange={(val) => setForm({ ...form, invoiced_value: val })}
            />
          </Field>
          <Field label="Valor líquido">
            <MoneyInput
              value={form.net_value}
              onValueChange={(val) => setForm({ ...form, net_value: val })}
            />
          </Field>
          <Field label="Peças faturadas">
            <TextInput
              type="number"
              value={form.invoiced_pieces}
              onChange={(e) => setForm({ ...form, invoiced_pieces: e.target.value })}
            />
          </Field>
          <Field label="Comissão pers. (%)" hint="Sobrescreve a % padrão da fábrica/marca para esta nota.">
            <TextInput
              type="number"
              step="0.01"
              value={form.custom_commission_pct}
              onChange={(e) => setForm({ ...form, custom_commission_pct: e.target.value })}
              placeholder="Ex: 5"
            />
          </Field>
          <Field label="Nº de parcelas">
            <TextInput
              type="number"
              min="1"
              value={form.installments}
              onChange={(e) => setForm({ ...form, installments: e.target.value })}
            />
          </Field>
          <Field label="1º vencimento">
            <TextInput
              type="date"
              value={form.first_due}
              onChange={(e) => setForm({ ...form, first_due: e.target.value })}
            />
          </Field>
          <Field label="Intervalo entre parcelas (dias)">
            <TextInput
              type="number"
              value={form.interval_days}
              onChange={(e) => setForm({ ...form, interval_days: e.target.value })}
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void saveInvoice()}>
            {saving ? "Salvando..." : "Lançar faturamento"}
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        title="Registrar pagamento"
        subtitle="A comissão por liquidez é atualizada automaticamente"
      >
        <SectionTitle
          title={`Parcela ${payTarget?.number ?? ""}`}
          hint={`Valor ${currency(Number(payTarget?.amount ?? 0))} · vencimento ${formatDate(payTarget?.due_date)}`}
        />
        <div className="grid gap-3">
          <Field label="Valor recebido">
            <MoneyInput
              value={payAmount}
              onValueChange={setPayAmount}
            />
          </Field>
          <Field label="Data do pagamento">
            <TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setPayTarget(null)}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => void registerPayment()}>Confirmar</PrimaryButton>
        </div>
      </Modal>
      {/* Modal de Edição de Faturamento */}
      <Modal
        open={editingInvoice !== null}
        onClose={() => setEditingInvoice(null)}
        title={`Editar faturamento — NF ${editingInvoice?.nf_number || "—"}`}
        subtitle={`Pedido ${editingInvoice?.orders?.internal_number ?? ""} · ${editingInvoice?.clients?.trade_name ?? editingInvoice?.clients?.legal_name ?? ""}`}
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Número da NF">
            <TextInput
              value={editForm.nf_number}
              onChange={(e) => setEditForm({ ...editForm, nf_number: e.target.value })}
            />
          </Field>
          <Field label="Data de emissão *">
            <TextInput
              type="date"
              value={editForm.issue_date}
              onChange={(e) => setEditForm({ ...editForm, issue_date: e.target.value })}
            />
          </Field>
          <Field label="Valor faturado *">
            <MoneyInput
              value={editForm.invoiced_value}
              onValueChange={(val) => setEditForm({ ...editForm, invoiced_value: val })}
            />
          </Field>
          <Field label="Valor líquido">
            <MoneyInput
              value={editForm.net_value}
              onValueChange={(val) => setEditForm({ ...editForm, net_value: val })}
            />
          </Field>
          <Field label="Peças faturadas">
            <TextInput
              type="number"
              value={editForm.invoiced_pieces}
              onChange={(e) => setEditForm({ ...editForm, invoiced_pieces: e.target.value })}
            />
          </Field>
          <Field label="Comissão pers. (%)" hint="Sobrescreve a % padrão da fábrica/marca.">
            <TextInput
              type="number"
              step="0.01"
              value={editForm.custom_commission_pct}
              onChange={(e) => setEditForm({ ...editForm, custom_commission_pct: e.target.value })}
              placeholder="Ex: 5"
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setEditingInvoice(null)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void saveEditInvoice()}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </PrimaryButton>
        </div>
      </Modal>
    </AppShell>
  );
}
