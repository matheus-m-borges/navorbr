import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "@/components/navor-rephub/ui";
import { CheckCircle2, XCircle, Clock, ArrowRightLeft, AlertCircle, User, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PlanChangeRequest {
  id: string;
  account_id: string;
  subscription_id: string;
  current_plan_id: string;
  requested_plan_id: string;
  requested_by: string;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  accounts: { name: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
  current_plan: { name: string; amount_cents: number } | null;
  requested_plan: { name: string; amount_cents: number } | null;
}

const fetchPlanChangeRequests = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("plan_change_requests")
    .select("*, accounts(name), profiles(full_name, email), current_plan:plans!current_plan_id(name, amount_cents), requested_plan:plans!requested_plan_id(name, amount_cents)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanChangeRequest[];
});

const reviewPlanChangeFn = createServerFn({ method: "POST" }).handler(async ({ data }: { data: { requestId: string; action: "approve" | "reject"; reason?: string } }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: { user } } = await supabaseAdmin.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify platform admin
  const { data: isAdmin } = await supabaseAdmin
    .from("platform_admins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isAdmin) throw new Error("Unauthorized: platform admin access required");

  const updates: Record<string, unknown> = {
    status: data.action === "approve" ? "approved" : "rejected",
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (data.action === "reject" && data.reason) {
    updates.rejection_reason = data.reason;
  }

  const { error } = await supabaseAdmin
    .from("plan_change_requests")
    .update(updates)
    .eq("id", data.requestId);

  if (error) throw new Error(error.message);

  // Audit log
  await supabaseAdmin.from("navor_platform_audit_logs").insert({
    actor_user_id: user.id,
    action: `plan_change_${data.action}`,
    entity_type: "plan_change_request",
    entity_id: data.requestId,
    metadata: { reason: data.reason },
    result: "success",
  });

  return { success: true };
});

export const Route = createFileRoute("/_authenticated/(saas)/admin/assinaturas/alteracoes/")({
  loader: () => fetchPlanChangeRequests(),
  component: AdminPlanChangesPage,
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    pending_approval: { label: "Pendente", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    approved: { label: "Aprovado", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    rejected: { label: "Rejeitado", icon: XCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
    executed: { label: "Executado", icon: CheckCircle2, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    cancelled: { label: "Cancelado", icon: XCircle, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  };
  const config = map[status] ?? { label: status, icon: AlertCircle, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.className}`}>
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function AdminPlanChangesPage() {
  const requests = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const reviewMutation = useMutation({
    mutationFn: (data: { requestId: string; action: "approve" | "reject"; reason?: string }) => reviewPlanChangeFn({ data }),
    onSuccess: () => {
      toast.success("Solicitação processada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["/_authenticated/(saas)/admin/assinaturas/alteracoes"] });
      setReviewingId(null);
      setRejectionReason("");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao processar solicitação"),
  });

  const pending = requests.filter((r) => r.status === "pending_approval");
  const processed = requests.filter((r) => r.status !== "pending_approval");

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Solicitações de Alteração de Plano</h1>
        <p className="text-sm text-slate-400 mt-1">Aprove ou rejeite solicitações de upgrade/downgrade dos assinantes</p>
      </div>

      {/* Pending Requests */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <Clock className="size-5 text-amber-500" />
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <GlassCard className="p-8 text-center text-slate-500">Nenhuma solicitação pendente.</GlassCard>
        ) : (
          <div className="space-y-4">
            {pending.map((req) => (
              <GlassCard key={req.id} className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <Building2 className="size-4 text-emerald-500" />
                      <span className="font-semibold text-slate-100">{req.accounts?.name ?? "Conta desconhecida"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <User className="size-3" />
                      <span>{req.profiles?.full_name ?? req.profiles?.email ?? "Usuário desconhecido"}</span>
                      <span>•</span>
                      <span>{new Date(req.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="rounded-lg bg-slate-800/50 px-3 py-1.5 text-sm">
                        <span className="text-slate-400">Atual:</span>{" "}
                        <span className="text-slate-200 font-medium">{req.current_plan?.name ?? "?"}</span>
                        <span className="text-slate-500 ml-2">({req.current_plan ? formatBRL(req.current_plan.amount_cents) : "?"}/mês)</span>
                      </div>
                      <ArrowRightLeft className="size-4 text-slate-500" />
                      <div className="rounded-lg bg-emerald-900/20 border border-emerald-500/20 px-3 py-1.5 text-sm">
                        <span className="text-emerald-400">Solicitado:</span>{" "}
                        <span className="text-emerald-300 font-medium">{req.requested_plan?.name ?? "?"}</span>
                        <span className="text-emerald-500/70 ml-2">({req.requested_plan ? formatBRL(req.requested_plan.amount_cents) : "?"}/mês)</span>
                      </div>
                    </div>
                    {req.reason && (
                      <p className="text-sm text-slate-400 italic mt-2">"{req.reason}"</p>
                    )}
                  </div>

                  {reviewingId === req.id ? (
                    <div className="flex flex-col gap-2 min-w-[280px]">
                      <input
                        type="text"
                        placeholder="Motivo da rejeição (opcional)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => reviewMutation.mutate({ requestId: req.id, action: "approve" })}
                          disabled={reviewMutation.isPending}
                          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => reviewMutation.mutate({ requestId: req.id, action: "reject", reason: rejectionReason })}
                          disabled={reviewMutation.isPending}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                        >
                          Rejeitar
                        </button>
                        <button
                          onClick={() => { setReviewingId(null); setRejectionReason(""); }}
                          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReviewingId(req.id)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-900/40 transition-colors whitespace-nowrap"
                    >
                      Analisar
                    </button>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Histórico ({processed.length})</h2>
        {processed.length === 0 ? (
          <GlassCard className="p-8 text-center text-slate-500">Nenhum histórico de solicitações.</GlassCard>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-300">Conta</th>
                  <th className="px-4 py-3 font-medium text-slate-300">Alteração</th>
                  <th className="px-4 py-3 font-medium text-slate-300">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-300">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {processed.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-200">{req.accounts?.name ?? "?"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {req.current_plan?.name ?? "?"} → {req.requested_plan?.name ?? "?"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(req.reviewed_at ?? req.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
