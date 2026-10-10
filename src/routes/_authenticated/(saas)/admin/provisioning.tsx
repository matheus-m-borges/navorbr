import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const retryProvisioningAction = createServerFn({ method: "POST" })
  .inputValidator((data: { recordId: string }) => data)
  .handler(async ({ data }) => {
    const { data: result, error } = await supabaseAdmin.rpc("retry_provisioning", {
      p_record_id: data.recordId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

type ProvisioningRecord = {
  id: string;
  account_id: string;
  product_id: string;
  subscription_id: string | null;
  status: string;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  failure_message_internal: string | null;
  created_at: string;
  updated_at: string;
};

export const Route = createFileRoute("/_authenticated/(saas)/admin/provisioning")({
  component: AdminProvisioningPage,
});

function AdminProvisioningPage() {
  const [records, setRecords] = useState<ProvisioningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("provisioning_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRecords((data ?? []) as ProvisioningRecord[]);
    } catch (e: any) {
      toast.error("Falha ao carregar registros de provisionamento");
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(recordId: string) {
    if (!confirm("Confirmar retry do provisionamento?")) return;
    setRetryingId(recordId);
    try {
      const result = await retryProvisioningAction({ data: { recordId } });
      if (result?.success) {
        toast.success("Retry iniciado com sucesso.");
        await load();
      } else {
        toast.error(result?.reason || "Falha ao iniciar retry.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar retry.");
    } finally {
      setRetryingId(null);
    }
  }

  const filtered = filterStatus === "all" ? records : records.filter(r => r.status === filterStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Provisionamento</h1>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
          <option value="all">Todos</option>
          <option value="pending">Pending</option>
          <option value="provisioning">Provisioning</option>
          <option value="active">Active</option>
          <option value="failed">Failed</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>
      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Account</th>
                <th className="px-4 py-2 text-left font-medium">Attempts</th>
                <th className="px-4 py-2 text-left font-medium">Failure</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Updated</th>
                <th className="px-4 py-2 text-left font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 capitalize">{r.status}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.account_id.slice(0, 8)}</td>
                  <td className="px-4 py-2">{r.attempts}</td>
                  <td className="px-4 py-2 text-xs text-destructive max-w-xs truncate">{r.failure_message_internal ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-xs">{new Date(r.updated_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2">
                    {r.status === "failed" && (
                      <button
                        onClick={() => handleRetry(r.id)}
                        disabled={retryingId === r.id}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        {retryingId === r.id ? "Retentando..." : "Retry"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
