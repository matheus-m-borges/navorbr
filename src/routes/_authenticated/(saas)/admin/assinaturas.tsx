import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SubscriptionRow = {
  id: string;
  account_id: string;
  plan_name: string | null;
  status: string;
  amount: number;
  due_date: string | null;
  next_due_date: string | null;
  is_billable: boolean;
  account_type: string;
  account_name: string | null;
};

export const Route = createFileRoute("/_authenticated/(saas)/admin/assinaturas")({
  component: AdminSubscriptionsPage,
});

function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await (supabase as any)
          .from("subscriptions")
          .select(`id, account_id, status, amount, due_date, current_period_end, plan_id, accounts!inner(name, account_type, is_billable), plans(name)`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setRows(
          (data ?? []).map((r: any) => ({
            id: r.id,
            account_id: r.account_id,
            plan_name: r.plans?.name ?? null,
            status: r.status,
            amount: r.amount,
            due_date: r.due_date,
            next_due_date: r.current_period_end,
            is_billable: r.accounts?.is_billable ?? true,
            account_type: r.accounts?.account_type ?? "customer",
            account_name: r.accounts?.name ?? null,
          }))
        );
      } catch (e: any) {
        toast.error("Falha ao carregar assinaturas");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Assinaturas NAVOR</h1>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Conta</th>
              <th className="px-4 py-2 text-left font-medium">Tipo</th>
              <th className="px-4 py-2 text-left font-medium">Plano</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Billable</th>
              <th className="px-4 py-2 text-left font-medium">Próximo Venc.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">{r.account_name ?? r.account_id}</td>
                <td className="px-4 py-2 capitalize">{r.account_type}</td>
                <td className="px-4 py-2">{r.plan_name ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(r.amount)}
                </td>
                <td className="px-4 py-2 capitalize">{r.status}</td>
                <td className="px-4 py-2">{r.is_billable ? "Sim" : "Não"}</td>
                <td className="px-4 py-2">{r.next_due_date ? new Date(r.next_due_date).toLocaleDateString("pt-BR") : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma assinatura encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
