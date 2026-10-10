import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DataRow,
  EmptyState,
  GhostButton,
  GlassCard,
  KpiCard,
  SectionTitle,
  SelectInput,
} from "@/components/navor-rephub/ui";
import { RepBadge, TableShell, Td, Tr } from "@/components/navor-rephub/repui";
import { DocumentsPanel } from "@/components/navor-rephub/DocumentsPanel";
import { AuditHistoryButton } from "@/components/navor-rephub/AuditHistoryButton";
import { currency, formatDate } from "@/lib/crm";
import { useRemoveRecord } from "@/lib/registro";
import {
  commissionTone,
  installmentTone,
  ORDER_STATUSES,
  orderTone,
  pct,
  sumMoney,
} from "@/lib/rep";
import { crmDb } from "@/hooks/useCrm";
import {
  logAudit,
  useAuditLogs,
  useCommissions,
  useDocuments,
  useInvoices,
  useOrder,
} from "@/hooks/useRep";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useSession";

export function OrderDetailsPanel({ orderId, onClose, onEdit }: { orderId: string, onClose: () => void, onEdit: () => void }) {
  const qc = useQueryClient();
  const removeRecord = useRemoveRecord();
  const { user } = useCurrentUser();
  const { data: order, isLoading } = useOrder(orderId);
  const { data: orderDocs = [] } = useDocuments("order", orderId);
  const { data: allInvoices = [] } = useInvoices();
  const { data: allCommissions = [] } = useCommissions();
  const { data: audit = [] } = useAuditLogs("order", orderId);
  const [status, setStatus] = useState<string | null>(null);

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function deleteDoc(docId: string, path: string) {
    if (!window.confirm("Deseja realmente excluir a cópia do pedido? Esta ação não pode ser desfeita.")) {
      return;
    }
    const { error: stErr } = await supabase.storage.from("documentos").remove([path]);
    if (stErr) {
      toast.error(`Falha no armazenamento: ${stErr.message}`);
      return;
    }
    const { error } = await crmDb.from("documents").delete().eq("id", docId);
    if (error) {
      toast.error(`Falha ao excluir registro: ${error.message}`);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Cópia do pedido excluída.");
  }

  const invoices = allInvoices.filter((i) => i.order_id === orderId);
  const commissions = allCommissions.filter((c) => c.order_id === orderId);
  const installments = invoices.flatMap((i) => i.invoice_installments ?? []);

  const invoiced = sumMoney(invoices, (i) => i.invoiced_value);
  const settled = sumMoney(installments, (i) => i.paid_amount);
  const potential = sumMoney(commissions, (c) => c.potential_amount);
  const received = sumMoney(commissions, (c) => c.received_amount);
  const pending = sumMoney(commissions, (c) => c.pending_amount);

  async function changeStatus(next: string) {
    if (!order) return;
    const { error } = await crmDb.from("orders").update({ status: next }).eq("id", order.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      entityType: "order",
      entityId: order.id,
      action: "Status",
      description: `Status alterado de ${order.status} para ${next}`,
      userName: user?.name ?? null,
      userId: user?.id ?? null,
    });
    void qc.invalidateQueries({ queryKey: ["order", order.id] });
    void qc.invalidateQueries({ queryKey: ["orders"] });
    void qc.invalidateQueries({ queryKey: ["audit-logs"] });
    toast.success("Status atualizado.");
  }

  if (isLoading) {
    return <GlassCard className="p-6 text-sm text-muted-foreground shrink-0 h-full">Carregando pedido...</GlassCard>;
  }

  if (!order) {
    return (
      <GlassCard className="p-6 shrink-0 h-full flex flex-col justify-center">
        <EmptyState title="Pedido não encontrado" hint="Ele pode ter sido excluído." />
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="p-5 shrink-0">
        <SectionTitle
          title={`Pedido ${order.internal_number}`}
          hint={`${order.clients?.trade_name ?? order.clients?.legal_name ?? "Cliente"} · ${order.brands?.brand ?? ""} · ${order.collections?.name ?? ""}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SelectInput
                value={status ?? order.status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  void changeStatus(e.target.value);
                }}
                className="max-w-52"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
              <GhostButton
                className="border-brand/30 text-brand"
                onClick={onEdit}
              >
                Editar pedido
              </GhostButton>
              {user?.role === "admin" ? (
                <GhostButton
                  className="border-rose/30 text-rose"
                  onClick={() =>
                    void removeRecord({
                      table: "orders",
                      id: order.id,
                      label: `o pedido ${order.internal_number}`,
                      keys: ["orders", "invoices", "commissions", "documents"],
                    }).then((ok) => {
                      if (ok) onClose();
                    })
                  }
                >
                  Excluir
                </GhostButton>
              ) : null}
              <GhostButton onClick={onClose}>Fechar</GhostButton>
            </div>
          }
        />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 mt-4">
          <KpiCard label="Valor" value={currency(Number(order.total_value ?? 0))} />
          <KpiCard
            label="Faturado"
            value={currency(invoiced)}
            tone="cyan"
            hint={`${pct(invoiced, Number(order.total_value ?? 0)).toFixed(0)}% do pedido`}
          />
          <KpiCard
            label="Liquidez"
            value={currency(settled)}
            tone="brand"
            hint={`${pct(settled, invoiced).toFixed(0)}% do faturado`}
          />
          <KpiCard
            label="Comissão"
            value={currency(potential)}
            tone="violet"
            hint={`recebida ${currency(received)}`}
          />
        </div>
      </GlassCard>

      <GlassCard className="p-4 shrink-0">
        <SectionTitle title="Dados do pedido" />
        <div className="grid sm:grid-cols-2 gap-x-8 mt-2">
          <div className="flex flex-col">
            <DataRow label="Nº interno" value={order.internal_number} />
            <DataRow label="Nº na fábrica" value={order.factory_order_number ?? "—"} />
            <DataRow label="Status" value={<RepBadge status={order.status} tones={orderTone} />} />
            <DataRow label="Data do pedido" value={formatDate(order.order_date)} />
            <DataRow label="Peças" value={String(order.total_pieces)} />
            <DataRow label="Pgto" value={order.payment_method ?? "—"} />
            <DataRow label="Prazo" value={order.payment_terms ?? "—"} />
            <DataRow label="Fábrica" value={order.factories?.trade_name ?? order.factories?.legal_name ?? "—"} />
          </div>
          <div className="flex flex-col">
            <DataRow label="Marca" value={order.brands?.brand ?? "—"} />
            <DataRow label="Coleção" value={order.collections?.name ?? "—"} />
            <DataRow label="Representante" value={order.rep_name ?? "—"} />
            <DataRow
              label="Cliente"
              value={
                <Link
                  to="/clientes"
                  search={{ c: order.client_id } as never}
                  className="text-brand hover:underline"
                >
                  {order.clients?.trade_name ?? order.clients?.legal_name ?? "—"}
                </Link>
              }
            />
            <DataRow label="CNPJ" value={order.clients?.cnpj ?? "—"} />
          </div>
        </div>
        {order.notes ? (
          <p className="mt-3 rounded-lg border border-border bg-ink-2/40 p-3 text-xs text-muted-foreground">
            {order.notes}
          </p>
        ) : null}

        <div className="mt-4 border-t border-border/50 pt-3">
          <p className="mb-2 text-xs font-semibold text-card-foreground">Cópia do pedido da fábrica</p>
          {orderDocs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nenhuma cópia anexada no lançamento.</p>
          ) : (
            <div className="space-y-1.5">
              {orderDocs.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-ink-2/40 p-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-card-foreground">{d.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {((d.size_bytes ?? 0) / 1024).toFixed(0)} KB · {d.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <GhostButton className="px-2 py-1 text-xs" onClick={() => void openDoc(d.file_path)}>
                      <Download className="size-3" /> Abrir
                    </GhostButton>
                    <GhostButton
                      className="border-rose/30 px-2 py-1 text-xs text-rose hover:bg-rose/10"
                      onClick={() => void deleteDoc(d.id, d.file_path)}
                    >
                      <Trash2 className="size-3" /> Excluir
                    </GhostButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-4 shrink-0">
        <SectionTitle
          title="Faturamentos"
          hint="Notas fiscais emitidas para este pedido, incluindo faturamento parcial"
        />
        {invoices.length === 0 ? (
          <EmptyState title="Nenhuma nota lançada" hint="Registre o faturamento na tela Faturamento." />
        ) : (
          <TableShell head={["NF", "Emissão", "Valor", "Peças", "Parcelas", "Pago"]}>
            {invoices.map((i) => {
              const inst = i.invoice_installments ?? [];
              return (
                <Tr key={i.id}>
                  <Td className="font-medium text-card-foreground">{i.nf_number}</Td>
                  <Td className="text-muted-foreground">{formatDate(i.issue_date)}</Td>
                  <Td className="tabular-nums text-card-foreground">
                    {currency(Number(i.invoiced_value ?? 0))}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">{i.invoiced_pieces ?? "—"}</Td>
                  <Td className="text-muted-foreground">{inst.length}</Td>
                  <Td className="tabular-nums text-card-foreground">
                    {currency(sumMoney(inst, (x) => x.paid_amount))}
                  </Td>
                </Tr>
              );
            })}
          </TableShell>
        )}

        <div className="mt-5">
          <SectionTitle title="Parcelas" hint="Vencimentos e liquidação" />
          {installments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem parcelas registradas.</p>
          ) : (
            <TableShell head={["Parcela", "Vencimento", "Valor", "Pago", "Status"]}>
              {installments
                .slice()
                .sort((a, b) => a.due_date.localeCompare(b.due_date))
                .map((p) => (
                  <Tr key={p.id}>
                    <Td className="text-card-foreground">{p.number}</Td>
                    <Td className="text-muted-foreground">{formatDate(p.due_date)}</Td>
                    <Td className="tabular-nums text-card-foreground">{currency(Number(p.amount ?? 0))}</Td>
                    <Td className="tabular-nums text-muted-foreground">
                      {currency(Number(p.paid_amount ?? 0))}
                    </Td>
                    <Td>
                      <RepBadge status={p.status} tones={installmentTone} />
                    </Td>
                  </Tr>
                ))}
            </TableShell>
          )}
        </div>

        <div className="mt-5">
          <SectionTitle title="Comissões apuradas" hint="Cálculo automático conforme a regra da marca/fábrica" />
          {commissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              A comissão é gerada automaticamente quando a nota fiscal é lançada.
            </p>
          ) : (
            <TableShell head={["NF", "Regra", "Potencial", "Liberada", "Recebida", "Status"]}>
              {commissions.map((c) => (
                <Tr key={c.id}>
                  <Td className="text-card-foreground">{c.invoices?.nf_number ?? "—"}</Td>
                  <Td className="text-[11px] text-muted-foreground">
                    {c.mode} · {c.rule_source} · {c.pct_invoice}%/{c.pct_settlement}%
                  </Td>
                  <Td className="tabular-nums text-card-foreground">
                    {currency(Number(c.potential_amount ?? 0))}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {currency(Number(c.released_amount ?? 0))}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {currency(Number(c.received_amount ?? 0))}
                  </Td>
                  <Td>
                    <RepBadge status={c.status} tones={commissionTone} />
                  </Td>
                </Tr>
              ))}
            </TableShell>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-4 shrink-0">
        <DocumentsPanel
          entityType="order"
          entityId={order.id}
          title="Arquivos do pedido"
          hint="Cópia do pedido da fábrica, faturamento e comprovantes"
          defaultCategory="Espelho do pedido"
        />
      </GlassCard>

      <GlassCard className="p-4 flex flex-col items-center justify-center text-center shrink-0">
        <SectionTitle title="Histórico de alterações" hint="Auditoria de valores e status" />
        <p className="mt-2 text-xs text-muted-foreground mb-4 max-w-xs">
          Acompanhe todas as modificações realizadas neste pedido ao longo do tempo.
        </p>
        <AuditHistoryButton entityType="order" entityId={order.id} />
      </GlassCard>
    </div>
  );
}
