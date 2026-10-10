import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
  History,
  FileSpreadsheet,
  Printer,
  Download,
  Building2,
  CheckCircle2,
  Receipt,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react";
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
import { currency, formatDate, formatDateTime } from "@/lib/crm";
import { COMMISSION_STATUSES, commissionTone, describeRule, pct, sumMoney } from "@/lib/rep";
import { supabase } from "@/integrations/supabase/client";
import { crmDb, useSettings } from "@/hooks/useCrm";
import {
  logAudit,
  useAuditLogs,
  useCommissionReceipts,
  useCommissions,
  useCollections,
  useFactories,
  useFactoryAdvances,
  type AuditLog,
  type Commission,
  type CommissionReceipt,
  type FactoryAdvance,
} from "@/hooks/useRep";
import { useCurrentUser } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/comissoes")({
  head: () => ({
    meta: [
      { title: "Comissões | CRM Representação" },
      {
        name: "description",
        content:
          "Apuração automática de comissões por faturamento, liquidez ou modelo misto, com baixa de recebimentos e conferência de diferenças.",
      },
      { property: "og:title", content: "Comissões | CRM Representação" },
      {
        property: "og:description",
        content: "Comissão prevista, liberada, recebida e pendente por fábrica, marca e coleção.",
      },
    ],
  }),
  component: ComissoesPage,
});

function getPeriodDates(period: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "this_month") {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      start: firstDay.toISOString().slice(0, 10),
      end: lastDay.toISOString().slice(0, 10),
      label: "Mês atual",
    };
  }
  if (period === "last_month") {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    return {
      start: firstDay.toISOString().slice(0, 10),
      end: lastDay.toISOString().slice(0, 10),
      label: "Mês anterior",
    };
  }
  if (period === "last_3_months") {
    const firstDay = new Date(year, month - 2, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      start: firstDay.toISOString().slice(0, 10),
      end: lastDay.toISOString().slice(0, 10),
      label: "Últimos 3 meses",
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

function ComissoesPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { data: commissions = [], isLoading } = useCommissions();
  const { data: receipts = [] } = useCommissionReceipts();
  const { data: advances = [] } = useFactoryAdvances();
  const { data: factories = [] } = useFactories();
  const { data: collections = [] } = useCollections();
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: settings } = useSettings();

  const hideClosed = settings?.["active_collections_only"] === "true";
  const visibleCommissions = useMemo(() => {
    if (!hideClosed) return commissions;
    const activeCols = new Set(collections.filter((c) => c.status !== "Encerrada").map((c) => c.id));
    return commissions.filter((c) => !c.collection_id || activeCols.has(c.collection_id));
  }, [commissions, collections, hideClosed]);

  const [period, setPeriod] = useState("hide_all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const [detail, setDetail] = useState<Commission | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Registro de recebimento
  const [receipt, setReceipt] = useState({
    factory_id: "",
    received_at: new Date().toISOString().slice(0, 10),
    amount: "",
    period_label: "",
    justification: "",
    notes: "",
    advances: {} as Record<string, number>,
  });

  // Edição de recebimento
  const [editingReceipt, setEditingReceipt] = useState<CommissionReceipt | null>(null);
  const [editReceiptForm, setEditReceiptForm] = useState({
    received_at: "",
    amount: "",
    period_label: "",
    justification: "",
    notes: "",
  });

  // Lançamento de Adiantamento
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    factory_id: "",
    collection_id: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    notes: "",
  });
  const [editingAdvance, setEditingAdvance] = useState<FactoryAdvance | null>(null);
  const [showClosingModal, setShowClosingModal] = useState(false);

  const periodDates = useMemo(() => getPeriodDates(period), [period]);

  const filtered = useMemo(() => {
    const { start, end } = periodDates;
    return visibleCommissions.filter((c) => {
      if (factoryFilter !== "all" && c.factory_id !== factoryFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;

      const d = c.invoices?.issue_date ?? c.calculated_at.slice(0, 10);
      if (start && end && (d < start || d > end)) return false;
      if (dateStart && d < dateStart) return false;
      if (dateEnd && d > dateEnd) return false;

      return true;
    });
  }, [visibleCommissions, factoryFilter, statusFilter, periodDates, dateStart, dateEnd]);

  const sorted = useMemo(() => {
    let sortable = [...filtered];
    if (sortConfig) {
      sortable.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof typeof a];
        let bValue: any = b[sortConfig.key as keyof typeof b];

        if (sortConfig.key === 'nf_number') {
          aValue = a.invoices?.nf_number || ''; bValue = b.invoices?.nf_number || '';
        } else if (sortConfig.key === 'client_brand') {
          aValue = a.clients?.legal_name || ''; bValue = b.clients?.legal_name || '';
        } else if (sortConfig.key === 'rule') {
          aValue = a.mode || ''; bValue = b.mode || '';
        } else if (sortConfig.key === 'potential_amount') {
          aValue = Number(a.potential_amount || 0); bValue = Number(b.potential_amount || 0);
        } else if (sortConfig.key === 'received_amount') {
          aValue = Number(a.received_amount || 0); bValue = Number(b.received_amount || 0);
        } else if (sortConfig.key === 'pending_amount') {
          aValue = Number(a.pending_amount || 0); bValue = Number(b.pending_amount || 0);
        } else if (sortConfig.key === 'status') {
          aValue = a.status || ''; bValue = b.status || '';
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filtered, sortConfig]);

  const potential = sumMoney(filtered, (c) => c.potential_amount);
  const released = sumMoney(filtered, (c) => c.released_amount);
  const received = sumMoney(filtered, (c) => c.received_amount);
  const pending = sumMoney(filtered, (c) => c.pending_amount);
  const invoicedTotal = sumMoney(filtered, (c) => c.base_invoiced ?? 0);

  const relevantAdvances = useMemo(() => {
    return advances.filter((a) => {
      if (factoryFilter !== "all" && a.factory_id !== factoryFilter) return false;
      const { start, end } = periodDates;
      if (start && end && (a.date < start || a.date > end)) return false;
      if (dateStart && a.date < dateStart) return false;
      if (dateEnd && a.date > dateEnd) return false;
      return true;
    });
  }, [advances, factoryFilter, periodDates, dateStart, dateEnd]);

  const totalAdvancesAmount = sumMoney(relevantAdvances, (a) => a.amount);
  const totalAdvancesDiscounted = sumMoney(relevantAdvances, (a) => a.discounted_amount);
  const netEstimatedBalance = Math.max(0, potential - totalAdvancesAmount);

  function exportClosingExcel() {
    const header = [
      "Fábrica / Indústria",
      "Coleção",
      "Razão Social Cliente",
      "Nome Fantasia",
      "Nota Fiscal",
      "Data Emissão NF",
      "Base Faturada (R$)",
      "Modelo / Regra",
      "Alíquota (%)",
      "Comissão Bruta (R$)",
      "Liberada (R$)",
      "Recebida (R$)",
      "Pendente (R$)",
      "Status Atual",
    ];

    const rows = sorted.map((c) => {
      const baseVal = Number(c.base_invoiced || 0);
      const rulePct = c.pct_invoice || c.pct_settlement || 0;
      return [
        c.factories?.legal_name ?? "Sem fábrica",
        c.collections?.name ?? "-",
        c.clients?.legal_name ?? "-",
        c.clients?.trade_name ?? "-",
        c.invoices?.nf_number ?? "-",
        c.invoices?.issue_date ? formatDate(c.invoices.issue_date) : "-",
        baseVal.toFixed(2).replace(".", ","),
        c.mode || "-",
        rulePct ? String(rulePct).replace(".", ",") : "-",
        Number(c.potential_amount || 0).toFixed(2).replace(".", ","),
        Number(c.released_amount || 0).toFixed(2).replace(".", ","),
        Number(c.received_amount || 0).toFixed(2).replace(".", ","),
        Number(c.pending_amount || 0).toFixed(2).replace(".", ","),
        c.status || "-",
      ];
    });

    // Linha de totalização consolidada
    rows.push([
      "=== TOTAL CONSOLIDADO ===",
      "",
      "",
      "",
      "",
      "",
      invoicedTotal.toFixed(2).replace(".", ","),
      "",
      "",
      potential.toFixed(2).replace(".", ","),
      released.toFixed(2).replace(".", ","),
      received.toFixed(2).replace(".", ","),
      pending.toFixed(2).replace(".", ","),
      "APURADO",
    ]);

    const csvContent = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeDate = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `fechamento-contabil-comissoes-${safeDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Demonstrativo de fechamento exportado em formato Excel CSV.");
  }

  function printClosingStatement() {
    window.print();
  }

  function SortButton({ label, sortKey }: { label: string, sortKey: string }) {
    return (
      <button 
        onClick={() => {
          let direction: "asc" | "desc" = "asc";
          if (sortConfig && sortConfig.key === sortKey && sortConfig.direction === "asc") direction = "desc";
          setSortConfig({ key: sortKey, direction });
        }}
        className="flex items-center gap-1 hover:text-brand transition-colors select-none"
      >
        {label}
        <span className="text-[10px] opacity-70 w-3 inline-block">
          {sortConfig?.key === sortKey ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  // Cálculo da comissão PREVISTA e saldo pendente para a fábrica no modal de recebimento
  const expectedInfo = useMemo(() => {
    const rows = receipt.factory_id
      ? visibleCommissions.filter((c) => c.factory_id === receipt.factory_id)
      : visibleCommissions;
    const potentialTotal = sumMoney(rows, (c) => c.potential_amount);
    const receivedTotal = sumMoney(rows, (c) => c.received_amount);
    const pendingBalance = Math.max(0, potentialTotal - receivedTotal);
    const releasedTotal = sumMoney(rows, (c) => c.released_amount);

    const pendingAdvances = (receipt.factory_id
      ? advances.filter((a) => a.factory_id === receipt.factory_id)
      : advances
    ).filter((a) => Number(a.amount) - Number(a.discounted_amount) > 0);

    return { potentialTotal, receivedTotal, pendingBalance, releasedTotal, pendingAdvances };
  }, [visibleCommissions, receipt.factory_id, advances]);

  const byFactory = useMemo(() => {
    const map = new Map<string, { name: string; potential: number; received: number; pending: number }>();
    for (const c of commissions) {
      const key = c.factory_id ?? "sem";
      const cur =
        map.get(key) ?? { name: c.factories?.legal_name ?? "Sem fábrica", potential: 0, received: 0, pending: 0 };
      cur.potential += Number(c.potential_amount ?? 0);
      cur.received += Number(c.received_amount ?? 0);
      cur.pending += Number(c.pending_amount ?? 0);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.potential - a.potential);
  }, [commissions]);

  const commissionLogs = useMemo(() => {
    return auditLogs.filter(
      (a) => a.entity_type === "commission_receipt" || a.entity_type === "commission",
    );
  }, [auditLogs]);

  async function saveReceipt() {
    const amount = Number(receipt.amount);
    const advancesTotal = Object.values(receipt.advances).reduce((acc, val) => acc + (val || 0), 0);
    const totalWithAdvances = amount + advancesTotal;

    if (!amount && advancesTotal <= 0) {
      toast.error("Informe o valor recebido ou os adiantamentos a descontar.");
      return;
    }
    const diff = totalWithAdvances - expectedInfo.pendingBalance;
    if (Math.abs(diff) >= 0.01 && !receipt.justification.trim()) {
      toast.error("Há diferença entre a comissão prevista pendente e o total a baixar: informe a justificativa.");
      return;
    }
    setSaving(true);
    
    // The RPC registers the receipt based on total amount
    const { data: receiptId, error } = await (
      supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: string | null, error: { message: string } | null }>;
      }
    ).rpc("register_commission_receipt", {
      p_factory_id: receipt.factory_id || null,
      p_amount: totalWithAdvances,
      p_received_at: receipt.received_at,
      p_period_label: receipt.period_label.trim() || null,
      p_notes: receipt.notes.trim() || null,
      p_justification: receipt.justification.trim() || null,
      p_user_name: user?.name ?? null,
    });
    
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    if (advancesTotal > 0) {
      // Find the created receipt to link the advances
      const { data: latestReceipts } = await crmDb
        .from("commission_receipts")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1);
        
      if (latestReceipts && latestReceipts.length > 0) {
        const receiptId = latestReceipts[0].id;
        
        // Update the receipt with advances_total and the real amount received
        await crmDb.from("commission_receipts").update({ 
          amount: amount, 
          advances_total: advancesTotal 
        }).eq("id", receiptId);

        for (const [advanceId, advAmount] of Object.entries(receipt.advances)) {
          if (advAmount > 0) {
            await crmDb.from("commission_receipt_advances").insert({
              receipt_id: receiptId,
              advance_id: advanceId,
              amount_discounted: advAmount
            });
            const advance = advances.find(a => a.id === advanceId);
            if (advance) {
              await crmDb.from("factory_advances").update({
                discounted_amount: Number(advance.discounted_amount || 0) + advAmount
              }).eq("id", advanceId);
            }
          }
        }
      }
    }

    if (receiptId) {
      await logAudit({
        entityType: "commission_receipt",
        entityId: receiptId,
        action: "Baixa",
        description: `Baixa de comissão de ${currency(totalWithAdvances)} registrada.`,
        userName: user?.name ?? null,
        userId: user?.id ?? null,
      });
    }

    setSaving(false);
    for (const key of ["commissions", "commission-receipts", "audit-logs", "factory-advances"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
    setReceiptOpen(false);
    setReceipt({ ...receipt, amount: "", justification: "", notes: "", advances: {} });
    toast.success("Recebimento registrado e abatido das comissões previstas.");
  }

  function openEditReceipt(r: CommissionReceipt) {
    setEditingReceipt(r);
    setEditReceiptForm({
      received_at: r.received_at ? r.received_at.slice(0, 10) : "",
      amount: String(r.amount ?? ""),
      period_label: r.period_label ?? "",
      justification: r.justification ?? "",
      notes: r.notes ?? "",
    });
  }

  async function saveEditReceipt() {
    if (!editingReceipt) return;
    const amount = Number(editReceiptForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Informe o valor recebido.");
      return;
    }
    setSaving(true);
    const oldAmount = Number(editingReceipt.amount ?? 0);
    const amountChanged = Math.abs(amount - oldAmount) >= 0.01;

    try {
      if (amountChanged) {
        // Reverte os itens anteriores
        const { data: items } = await crmDb
          .from("commission_receipt_items")
          .select("commission_id, amount")
          .eq("receipt_id", editingReceipt.id);

        if (items && items.length > 0) {
          for (const it of items) {
            const comm = commissions.find((c) => c.id === it.commission_id);
            if (comm) {
              const newRec = Math.max(0, Number(comm.received_amount ?? 0) - Number(it.amount));
              const newPend = Math.max(0, Number(comm.released_amount ?? 0) - newRec);
              const newStat =
                Number(comm.potential_amount) > 0 && newRec >= Number(comm.potential_amount)
                  ? "Recebida"
                  : newRec > 0
                    ? "Parcialmente recebida"
                    : Number(comm.released_amount) > 0
                      ? "A receber"
                      : "Prevista";
              await crmDb
                .from("commissions")
                .update({
                  received_amount: newRec,
                  pending_amount: newPend,
                  status: newStat,
                })
                .eq("id", comm.id);
            }
          }
          await crmDb.from("commission_receipt_items").delete().eq("receipt_id", editingReceipt.id);
        }

        const diff = Number(editingReceipt.expected_amount ?? 0) - amount;
        await crmDb
          .from("commission_receipts")
          .update({
            received_at: editReceiptForm.received_at,
            amount: amount,
            difference: diff,
            period_label: editReceiptForm.period_label.trim() || null,
            justification: editReceiptForm.justification.trim() || null,
            notes: editReceiptForm.notes.trim() || null,
          })
          .eq("id", editingReceipt.id);

        // Re-aloca novo montante
        let remaining = amount;
        const factoryComms = commissions
          .filter(
            (c) =>
              (!editingReceipt.factory_id || c.factory_id === editingReceipt.factory_id) &&
              c.pending_amount > 0,
          )
          .sort((a, b) => a.calculated_at.localeCompare(b.calculated_at));

        for (const c of factoryComms) {
          if (remaining <= 0) break;
          const take = Math.min(Number(c.pending_amount), remaining);
          await crmDb.from("commission_receipt_items").insert({
            receipt_id: editingReceipt.id,
            commission_id: c.id,
            amount: take,
          });
          const newRec = Number(c.received_amount ?? 0) + take;
          const newPend = Math.max(0, Number(c.released_amount ?? 0) - newRec);
          const newStat =
            Number(c.potential_amount) > 0 && newRec >= Number(c.potential_amount)
              ? "Recebida"
              : "Parcialmente recebida";
          await crmDb
            .from("commissions")
            .update({
              received_amount: newRec,
              pending_amount: newPend,
              status: newStat,
            })
            .eq("id", c.id);
          remaining -= take;
        }
      } else {
        await crmDb
          .from("commission_receipts")
          .update({
            received_at: editReceiptForm.received_at,
            period_label: editReceiptForm.period_label.trim() || null,
            justification: editReceiptForm.justification.trim() || null,
            notes: editReceiptForm.notes.trim() || null,
          })
          .eq("id", editingReceipt.id);
      }

      await logAudit({
        entityType: "commission_receipt",
        entityId: editingReceipt.id,
        action: "Edição",
        description: `Recebimento de comissão editado: ${currency(oldAmount)} → ${currency(amount)}${editReceiptForm.period_label ? ` (${editReceiptForm.period_label})` : ""}`,
        userName: user?.name ?? null,
        userId: user?.id ?? null,
      });

      for (const key of ["commissions", "commission-receipts", "audit-logs"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      setEditingReceipt(null);
      toast.success("Recebimento atualizado e registrado no histórico.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteReceipt(r: CommissionReceipt) {
    if (
      !confirm(
        `Deseja realmente excluir o recebimento de ${currency(Number(r.amount ?? 0))}? Os saldos das comissões abatidas serão restabelecidos.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const { data: items } = await crmDb
        .from("commission_receipt_items")
        .select("commission_id, amount")
        .eq("receipt_id", r.id);

      if (items && items.length > 0) {
        for (const it of items) {
          const comm = commissions.find((c) => c.id === it.commission_id);
          if (comm) {
            const newRec = Math.max(0, Number(comm.received_amount ?? 0) - Number(it.amount));
            const newPend = Math.max(0, Number(comm.released_amount ?? 0) - newRec);
            const newStat =
              Number(comm.potential_amount) > 0 && newRec >= Number(comm.potential_amount)
                ? "Recebida"
                : newRec > 0
                  ? "Parcialmente recebida"
                  : Number(comm.released_amount) > 0
                    ? "A receber"
                    : "Prevista";
            await crmDb
              .from("commissions")
              .update({
                received_amount: newRec,
                pending_amount: newPend,
                status: newStat,
              })
              .eq("id", comm.id);
          }
        }
        await crmDb.from("commission_receipt_items").delete().eq("receipt_id", r.id);
      }

      await crmDb.from("commission_receipts").delete().eq("id", r.id);

      await logAudit({
        entityType: "commission_receipt",
        entityId: r.id,
        action: "Exclusão",
        description: `Recebimento de ${currency(Number(r.amount ?? 0))} (${r.factories?.legal_name ?? "Geral"}) excluído`,
        userName: user?.name ?? null,
        userId: user?.id ?? null,
      });

      for (const key of ["commissions", "commission-receipts", "audit-logs"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      toast.success("Recebimento excluído e saldos restaurados.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAdvance() {
    if (!advanceForm.factory_id || !advanceForm.amount) {
      toast.error("Fábrica e valor são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      if (editingAdvance) {
        const { error } = await crmDb
          .from("factory_advances")
          .update({
            factory_id: advanceForm.factory_id,
            collection_id: advanceForm.collection_id || null,
            date: advanceForm.date,
            amount: Number(advanceForm.amount),
            notes: advanceForm.notes,
          })
          .eq("id", editingAdvance.id);
        if (error) throw error;
      } else {
        const { error } = await crmDb.from("factory_advances").insert({
          factory_id: advanceForm.factory_id,
          collection_id: advanceForm.collection_id || null,
          date: advanceForm.date,
          amount: Number(advanceForm.amount),
          notes: advanceForm.notes,
          owner_id: user?.id ?? null,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
      void qc.invalidateQueries({ queryKey: ["factory-advances"] });
      setAdvanceOpen(false);
      setEditingAdvance(null);
      setAdvanceForm({
        factory_id: "",
        collection_id: "",
        date: new Date().toISOString().slice(0, 10),
        amount: "",
        notes: "",
      });
      toast.success("Adiantamento salvo com sucesso.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAdvance(a: FactoryAdvance) {
    if (a.discounted_amount > 0) {
      toast.error("Não é possível excluir um adiantamento que já possui baixas vinculadas.");
      return;
    }
    if (!confirm("Deseja realmente excluir este adiantamento?")) return;
    setSaving(true);
    try {
      const { error } = await crmDb.from("factory_advances").delete().eq("id", a.id);
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ["factory-advances"] });
      toast.success("Adiantamento excluído.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Comissões"
      subtitle={`Apuração automática, baixa de recebimentos e conferência · ${periodDates.label}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton
            onClick={() => setShowClosingModal(true)}
            className="flex items-center gap-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Fechamento & Relatórios</span>
          </GhostButton>
          <GhostButton
            onClick={() => setAdvanceOpen(true)}
          >
            + Adiantamento
          </GhostButton>
          <PrimaryButton
            onClick={() => {
              setReceipt({
                ...receipt,
                amount: expectedInfo.pendingBalance > 0 ? String(expectedInfo.pendingBalance) : "",
              });
              setReceiptOpen(true);
            }}
          >
            + Registrar recebimento
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Exibindo: <strong className="text-card-foreground">{periodDates.label}</strong>
          {periodDates.start && periodDates.end
            ? ` (${formatDate(periodDates.start)} até ${formatDate(periodDates.end)})`
            : ""}
          {filtered.length > 0 ? ` · ${filtered.length} comissão(ões) no período` : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Comissão prevista" value={currency(potential)} />
        <KpiCard
          label="Liberada"
          value={currency(released)}
          tone="cyan"
          hint={`${pct(released, potential).toFixed(0)}% do previsto`}
        />
        <KpiCard label="Recebida" value={currency(received)} tone="brand" />
        <KpiCard label="Pendente" value={currency(pending)} tone={pending ? "amber" : "muted"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="p-4">
          <SectionTitle title="Por fábrica" hint="Previsto, recebido e pendente" />
          {byFactory.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem comissões apuradas.</p>
          ) : (
            <div className="space-y-2">
              {byFactory.map((f) => (
                <div key={f.name} className="rounded-xl border border-border bg-ink-2/40 p-3">
                  <p className="text-sm font-medium text-card-foreground">{f.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    previsto {currency(f.potential)} · recebido {currency(f.received)} · pendente{" "}
                    {currency(f.pending)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5">
            <SectionTitle title="Histórico de Recebimentos" hint="Baixas, conferência e edição" />
            {receipts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum recebimento registrado.</p>
            ) : (
              <div className="space-y-2">
                {receipts.slice(0, 15).map((r) => (
                  <div key={r.id} className="rounded-xl border border-border bg-ink-2/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-card-foreground">
                        {currency(Number(r.amount ?? 0))} ·{" "}
                        <span className="text-muted-foreground">{r.factories?.legal_name ?? "Geral"}</span>
                      </p>
                      <div className="flex items-center gap-1">
                        <GhostButton
                          className="px-2 py-0.5 text-xs"
                          onClick={() => openEditReceipt(r)}
                        >
                          Editar
                        </GhostButton>
                        {user?.role === "admin" ? (
                          <GhostButton
                            className="border-rose/30 px-2 py-0.5 text-xs text-rose hover:bg-rose/10"
                            onClick={() => void deleteReceipt(r)}
                          >
                            Excluir
                          </GhostButton>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(r.received_at)} · esperado {currency(Number(r.expected_amount ?? 0))} ·
                      diferença {currency(Number(r.difference ?? 0))}
                    </p>
                    {r.period_label ? (
                      <p className="text-[11px] text-brand">{r.period_label}</p>
                    ) : null}
                    {r.justification ? (
                      <p className="mt-1 text-[11px] text-amber">Justificativa: {r.justification}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <SectionTitle title="Adiantamentos" hint="Valores adiantados pelas fábricas" />
            </div>
            {advances.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum adiantamento registrado.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {advances.map((a) => (
                  <div key={a.id} className="rounded-xl border border-border bg-ink-2/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-card-foreground">
                        {currency(Number(a.amount ?? 0))}
                      </p>
                      <div className="flex items-center gap-1">
                        <GhostButton
                          className="px-2 py-0.5 text-xs"
                          onClick={() => {
                            setEditingAdvance(a);
                            setAdvanceForm({
                              factory_id: a.factory_id,
                              collection_id: a.collection_id || "",
                              date: a.date,
                              amount: String(a.amount),
                              notes: a.notes || "",
                            });
                            setAdvanceOpen(true);
                          }}
                        >
                          Editar
                        </GhostButton>
                        {user?.role === "admin" ? (
                          <GhostButton
                            className="border-rose/30 px-2 py-0.5 text-xs text-rose hover:bg-rose/10"
                            onClick={() => void deleteAdvance(a)}
                          >
                            Excluir
                          </GhostButton>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Fábrica: {a.factories?.legal_name ?? "Desconhecida"} · {formatDate(a.date)}
                    </p>
                    <p className="text-[11px] text-amber">
                      Descontado: {currency(Number(a.discounted_amount ?? 0))} · Pendente: {currency(Number(a.amount) - Number(a.discounted_amount))}
                    </p>
                    {a.status && (
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-1">{a.status}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-4 xl:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-card-foreground">Filtros</span>
            <ShowAllToggle 
              showAll={period !== "hide_all"} 
              onToggle={(v) => setPeriod(v ? "this_month" : "hide_all")} 
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SelectInput
              value={period === "hide_all" ? "this_month" : period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-44"
            >
              <option value="this_month">Mês atual</option>
              <option value="last_month">Mês anterior</option>
              <option value="last_3_months">Últimos 3 meses</option>
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
              className="w-52"
            >
              <option value="all">Todas as fábricas</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.trade_name ?? f.legal_name}
                </option>
              ))}
            </SelectInput>

            <SelectInput
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-44"
            >
              <option value="all">Todos os status</option>
              {COMMISSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : period === "hide_all" && factoryFilter === "all" && statusFilter === "all" && !dateStart && !dateEnd ? (
            <EmptyState
              title="Pesquise para listar"
              hint="Selecione um período ou filtro acima para exibir as comissões."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nenhuma comissão no período"
              hint="Ajuste os filtros de período ou fábrica para conferir outras comissões."
            />
          ) : (
            <TableShell head={[
              <SortButton key="1" label="NF" sortKey="nf_number" />,
              <SortButton key="2" label="Cliente / Marca" sortKey="client_brand" />,
              <SortButton key="3" label="Regra" sortKey="rule" />,
              <SortButton key="4" label="Prevista" sortKey="potential_amount" />,
              <SortButton key="5" label="Recebida" sortKey="received_amount" />,
              <SortButton key="6" label="Pendente" sortKey="pending_amount" />,
              <SortButton key="7" label="Status" sortKey="status" />
            ]}>
              {sorted.map((c) => (
                <Tr key={c.id} onClick={() => setDetail(c)}>
                  <Td>
                    <p className="font-medium text-card-foreground">{c.invoices?.nf_number ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(c.invoices?.issue_date ?? null)}
                    </p>
                  </Td>
                  <Td>
                    <p className="font-medium text-card-foreground">
                      {c.clients?.legal_name ?? "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.clients?.trade_name ? `${c.clients.trade_name} · ` : ""}{c.brands?.brand ?? "—"}
                    </p>
                  </Td>
                  <Td className="text-[11px] text-muted-foreground">
                    {c.mode} ({c.rule_source})
                  </Td>
                  <Td className="tabular-nums font-semibold text-card-foreground">
                    {currency(Number(c.potential_amount ?? 0))}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {currency(Number(c.received_amount ?? 0))}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {currency(Number(c.pending_amount ?? 0))}
                  </Td>
                  <Td>
                    <RepBadge status={c.status} tones={commissionTone} />
                  </Td>
                </Tr>
              ))}
            </TableShell>
          )}
        </GlassCard>
      </div>

      {/* Sessão de Logs de Auditoria de Comissões e Recebimentos */}
      <GlassCard className="mt-4 p-4">
        <SectionTitle
          title="Histórico de Auditoria & Modificações"
          hint="Registro auditado de baixas, alterações de valores e exclusões de comissões"
        />
        {commissionLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {commissionLogs.slice(0, 20).map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-ink-2/40 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-card-foreground">{log.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Responsável: <strong className="text-card-foreground">{log.user_name ?? "Sistema"}</strong> ·{" "}
                    {formatDateTime(log.created_at)}
                  </p>
                </div>
                <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">
                  {log.action}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Modal de Detalhe da Comissão (Sem Memória de Cálculo crua) */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={`Detalhe da comissão — NF ${detail?.invoices?.nf_number ?? ""}`}
        subtitle={
          detail
            ? describeRule(detail.mode, Number(detail.pct_invoice), Number(detail.pct_settlement))
            : ""
        }
        wide
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-ink-2/40 p-3">
                <p className="text-[11px] text-muted-foreground">Fábrica / Marca</p>
                <p className="font-medium text-card-foreground">
                  {detail.factories?.legal_name ?? "—"} / {detail.brands?.brand ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-ink-2/40 p-3">
                <p className="text-[11px] text-muted-foreground">Regra e Modalidade</p>
                <p className="font-medium text-card-foreground">
                  {detail.mode} ({detail.rule_source})
                </p>
              </div>
              <div className="rounded-xl border border-border bg-ink-2/40 p-3">
                <p className="text-[11px] text-muted-foreground">Base faturada</p>
                <p className="tabular-nums font-semibold text-card-foreground">
                  {currency(Number(detail.base_invoiced ?? 0))}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-ink-2/40 p-3">
                <p className="text-[11px] text-muted-foreground">Base liquidada (paga)</p>
                <p className="tabular-nums font-semibold text-card-foreground">
                  {currency(Number(detail.base_settled ?? 0))}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-ink-2/40 p-3">
                <p className="text-[11px] text-muted-foreground">Comissão Prevista</p>
                <p className="tabular-nums font-semibold text-brand">
                  {currency(Number(detail.potential_amount ?? 0))}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-ink-2/40 p-3">
                <p className="text-[11px] text-muted-foreground">Comissão Liberada</p>
                <p className="tabular-nums font-semibold text-cyan">
                  {currency(Number(detail.released_amount ?? 0))}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-ink-2/40 p-3">
                <p className="text-[11px] text-muted-foreground">Comissão Recebida</p>
                <p className="tabular-nums font-semibold text-emerald-400">
                  {currency(Number(detail.received_amount ?? 0))}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-ink-2/40 p-3">
                <p className="text-[11px] text-muted-foreground">Saldo Pendente</p>
                <p className="tabular-nums font-semibold text-amber">
                  {currency(Number(detail.pending_amount ?? 0))}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-ink-2/40 p-3 text-xs text-muted-foreground">
              <span>
                Situação atual: <RepBadge status={detail.status} tones={commissionTone} />
              </span>
              <span>Data da apuração: {formatDateTime(detail.calculated_at)}</span>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal de Registro de Recebimento com Abatimento do Previsto */}
      <Modal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title="Registrar recebimento de comissão"
        subtitle="O valor recebido é abatido do saldo previsto da fábrica"
      >
        <div className="grid gap-3">
          <Field label="Fábrica">
            <SelectInput
              value={receipt.factory_id}
              onChange={(e) => {
                const fid = e.target.value;
                const rows = fid ? commissions.filter((c) => c.factory_id === fid) : commissions;
                const pot = sumMoney(rows, (c) => c.potential_amount);
                const rec = sumMoney(rows, (c) => c.received_amount);
                const bal = Math.max(0, pot - rec);
                setReceipt({
                  ...receipt,
                  factory_id: fid,
                  amount: bal > 0 ? String(bal) : "",
                });
              }}
            >
              <option value="">Todas as fábricas</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.trade_name ?? f.legal_name}
                </option>
              ))}
            </SelectInput>
          </Field>

          {/* Destaque da Comissão Prevista calculada no Faturamento */}
          <div className="rounded-xl border border-border bg-ink-2/40 p-3 text-xs space-y-1">
            <p className="text-muted-foreground">
              Comissão prevista total: <strong className="text-card-foreground">{currency(expectedInfo.potentialTotal)}</strong>
            </p>
            <p className="text-muted-foreground">
              Já recebido anteriormente: <strong className="text-card-foreground">{currency(expectedInfo.receivedTotal)}</strong>
            </p>
            <p className="text-emerald-400 font-semibold">
              Saldo previsto a abater: {currency(expectedInfo.pendingBalance)}
            </p>
          </div>

          <Field label="Data do recebimento">
            <TextInput
              type="date"
              value={receipt.received_at}
              onChange={(e) => setReceipt({ ...receipt, received_at: e.target.value })}
            />
          </Field>
          <Field label="Valor recebido">
            <MoneyInput
              value={receipt.amount}
              onValueChange={(val) => setReceipt({ ...receipt, amount: val })}
            />
          </Field>

          {expectedInfo.pendingAdvances.length > 0 && (
            <div className="rounded-xl border border-amber/30 bg-amber/5 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-500">Adiantamentos pendentes disponíveis para baixa</p>
              {expectedInfo.pendingAdvances.map(adv => {
                const maxDiscount = Number(adv.amount) - Number(adv.discounted_amount);
                return (
                  <div key={adv.id} className="flex flex-col gap-1 pb-2 border-b border-border/50 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">{formatDate(adv.date)} · Saldo: {currency(maxDiscount)}</span>
                    </div>
                    <Field label="Valor a descontar" className="flex flex-col gap-1">
                      <MoneyInput
                        value={receipt.advances[adv.id] === undefined ? "" : String(receipt.advances[adv.id])}
                        onValueChange={(val) => {
                          const num = Number(val);
                          if (num > maxDiscount) {
                            toast.error(`O valor máximo a descontar é ${currency(maxDiscount)}`);
                            return;
                          }
                          setReceipt({
                            ...receipt,
                            advances: {
                              ...receipt.advances,
                              [adv.id]: num
                            }
                          });
                        }}
                      />
                    </Field>
                  </div>
                );
              })}
            </div>
          )}

          <Field label="Período de referência">
            <TextInput
              value={receipt.period_label}
              onChange={(e) => setReceipt({ ...receipt, period_label: e.target.value })}
              placeholder="Ex.: Fechamento de março/2026"
            />
          </Field>
          <Field label="Justificativa da diferença">
            <TextArea
              value={receipt.justification}
              onChange={(e) => setReceipt({ ...receipt, justification: e.target.value })}
              placeholder="Obrigatória se o valor recebido diferir do saldo previsto pendente"
            />
          </Field>
          <Field label="Observações">
            <TextArea
              value={receipt.notes}
              onChange={(e) => setReceipt({ ...receipt, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setReceiptOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void saveReceipt()}>
            {saving ? "Salvando..." : "Confirmar recebimento"}
          </PrimaryButton>
        </div>
      </Modal>

      {/* Modal de Edição de Recebimento de Comissão */}
      <Modal
        open={editingReceipt !== null}
        onClose={() => setEditingReceipt(null)}
        title="Editar recebimento de comissão"
        subtitle={`Fábrica: ${editingReceipt?.factories?.legal_name ?? "Geral"}`}
      >
        <div className="grid gap-3">
          <Field label="Data do recebimento">
            <TextInput
              type="date"
              value={editReceiptForm.received_at}
              onChange={(e) => setEditReceiptForm({ ...editReceiptForm, received_at: e.target.value })}
            />
          </Field>
          <Field label="Valor recebido">
            <MoneyInput
              value={editReceiptForm.amount}
              onValueChange={(val) => setEditReceiptForm({ ...editReceiptForm, amount: val })}
            />
          </Field>
          <Field label="Período de referência">
            <TextInput
              value={editReceiptForm.period_label}
              onChange={(e) => setEditReceiptForm({ ...editReceiptForm, period_label: e.target.value })}
              placeholder="Ex.: Fechamento de março/2026"
            />
          </Field>
          <Field label="Justificativa da diferença">
            <TextArea
              value={editReceiptForm.justification}
              onChange={(e) => setEditReceiptForm({ ...editReceiptForm, justification: e.target.value })}
              placeholder="Informe a justificativa em caso de diferença"
            />
          </Field>
          <Field label="Observações">
            <TextArea
              value={editReceiptForm.notes}
              onChange={(e) => setEditReceiptForm({ ...editReceiptForm, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setEditingReceipt(null)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void saveEditReceipt()}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </PrimaryButton>
        </div>
      </Modal>

      {/* Modal de Adiantamento */}
      <Modal
        open={advanceOpen}
        onClose={() => {
          setAdvanceOpen(false);
          setEditingAdvance(null);
        }}
        title={editingAdvance ? "Editar Adiantamento" : "Lançar Adiantamento"}
        subtitle="Valores adiantados pelas fábricas para descontar em comissões futuras"
      >
        <div className="grid gap-3">
          <Field label="Fábrica *">
            <SelectInput
              value={advanceForm.factory_id}
              onChange={(e) => setAdvanceForm({ ...advanceForm, factory_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.legal_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Coleção (opcional)">
            <SelectInput
              value={advanceForm.collection_id}
              onChange={(e) => setAdvanceForm({ ...advanceForm, collection_id: e.target.value })}
            >
              <option value="">Nenhuma</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Data do adiantamento">
            <TextInput
              type="date"
              value={advanceForm.date}
              onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
            />
          </Field>
          <Field label="Valor adiantado *">
            <MoneyInput
              value={advanceForm.amount}
              onValueChange={(val) => setAdvanceForm({ ...advanceForm, amount: val })}
            />
          </Field>
          <Field label="Observações">
            <TextArea
              value={advanceForm.notes}
              onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => { setAdvanceOpen(false); setEditingAdvance(null); }}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void saveAdvance()}>
            {saving ? "Salvando..." : "Salvar adiantamento"}
          </PrimaryButton>
        </div>
      </Modal>

      {/* Modal de Fechamento Contábil e Relatórios em PDF / Excel */}
      <Modal
        open={showClosingModal}
        onClose={() => setShowClosingModal(false)}
        title="Fechamento Contábil de Comissões & Demonstrativo Financeiro"
      >
        <div className="space-y-5">
          {/* Barra de Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Período: {periodDates.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {factoryFilter !== "all"
                  ? `Fábrica: ${factories.find((f) => f.id === factoryFilter)?.legal_name ?? "Selecionada"}`
                  : "Todas as indústrias representadas"} · {sorted.length} título(s) apurado(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportClosingExcel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 transition cursor-pointer"
                title="Exportar planilha analítica compatível com Excel"
              >
                <Download className="size-3.5" />
                <span>Exportar Excel (.csv)</span>
              </button>
              <button
                type="button"
                onClick={printClosingStatement}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer shadow-2xs"
                title="Imprimir ou Salvar em PDF"
              >
                <Printer className="size-3.5 text-blue-600 dark:text-blue-400" />
                <span>Imprimir / Salvar PDF</span>
              </button>
            </div>
          </div>

          {/* Cards de Resumo da Conciliação */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Faturamento Total
              </span>
              <div className="mt-1 text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono">
                {currency(invoicedTotal)}
              </div>
              <span className="text-[10px] text-muted-foreground">Base dos pedidos</span>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/60 dark:bg-blue-950/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Comissão Bruta
              </span>
              <div className="mt-1 text-sm sm:text-base font-black text-blue-700 dark:text-blue-300 font-mono">
                {currency(potential)}
              </div>
              <span className="text-[10px] text-blue-600/80 dark:text-blue-400">Total apurado</span>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Adiantamentos
              </span>
              <div className="mt-1 text-sm sm:text-base font-black text-amber-700 dark:text-amber-300 font-mono">
                {currency(totalAdvancesAmount)}
              </div>
              <span className="text-[10px] text-amber-600/80 dark:text-amber-400">
                Baixados: {currency(totalAdvancesDiscounted)}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Líquido Estimado
              </span>
              <div className="mt-1 text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 font-mono">
                {currency(netEstimatedBalance)}
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400">Pendente líquido</span>
            </div>
          </div>

          {/* Demonstrativo Contábil Timbrado (Renderizável e Imprimível) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4 print:p-0 print:border-none">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-blue-600" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    DEMONSTRATIVO DE PRESTAÇÃO DE CONTAS DE COMISSÕES
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Regulamentado nos moldes da Lei Federal nº 4.886/1965 (Art. 32 e seguintes)
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                Data do Relatório: <strong>{new Date().toLocaleDateString("pt-BR")}</strong>
              </div>
            </div>

            {/* Espelho Sintético de Títulos */}
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="p-2">Fábrica</th>
                    <th className="p-2">Cliente Comprador</th>
                    <th className="p-2">NF</th>
                    <th className="p-2">Emissão</th>
                    <th className="p-2 text-right">Faturado</th>
                    <th className="p-2 text-right">Comissão</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {sorted.slice(0, 50).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2 font-medium">{c.factories?.legal_name ?? "-"}</td>
                      <td className="p-2 truncate max-w-[150px]">{c.clients?.legal_name ?? "-"}</td>
                      <td className="p-2 font-mono">{c.invoices?.nf_number ?? "-"}</td>
                      <td className="p-2 text-muted-foreground">
                        {c.invoices?.issue_date ? formatDate(c.invoices.issue_date) : "-"}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {currency(Number(c.base_invoiced || 0))}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {currency(Number(c.potential_amount || 0))}
                      </td>
                      <td className="p-2 text-center">
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sorted.length > 50 && (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-xs text-muted-foreground italic">
                        ... e mais {sorted.length - 50} título(s). Utilize a exportação em Excel para conferência completa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Termo de Conciliação e Fechamento Mútuo */}
            <div className="rounded-lg bg-slate-50/80 dark:bg-slate-800/40 p-3 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Termo de Conferência e Conciliação Contábil:
              </p>
              <p>
                As partes conferem os lançamentos retro discriminados relativos aos pedidos e faturamentos do período.
                Havendo antecipações ou adiantamentos concedidos, estes restam compensados contra o montante de comissão apurada,
                constituindo o presente documento espelho hábil de prestação de contas.
              </p>
            </div>

            {/* Assinaturas */}
            <div className="pt-4 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="border-t border-slate-300 pt-2 dark:border-slate-700">
                <p className="font-bold text-slate-800 dark:text-slate-200">{user?.name || "Representante Comercial"}</p>
                <p className="text-[10px] text-muted-foreground">Representação Comercial</p>
              </div>
              <div className="border-t border-slate-300 pt-2 dark:border-slate-700">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {factoryFilter !== "all"
                    ? factories.find((f) => f.id === factoryFilter)?.legal_name ?? "Indústria Representada"
                    : "Indústria / Representada"}
                </p>
                <p className="text-[10px] text-muted-foreground">Departamento Financeiro / Controladoria</p>
              </div>
            </div>
          </div>

          {/* Rodapé do Modal */}
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-800">
            <GhostButton onClick={() => setShowClosingModal(false)}>Fechar</GhostButton>
            <PrimaryButton onClick={exportClosingExcel}>
              <Download className="size-4 mr-1.5" />
              Baixar Planilha Excel
            </PrimaryButton>
          </div>
        </div>
      </Modal>

    </AppShell>
  );
}

