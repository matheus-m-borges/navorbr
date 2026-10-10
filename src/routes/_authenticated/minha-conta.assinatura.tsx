import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { serverGetLifecycleState } from "@/core/commercial-lifecycle/lifecycle-service";

type SubscriptionDetails = {
  subscription_id: string;
  account_id: string;
  plan_name: string | null;
  product_name: string | null;
  status: string;
  amount: number;
  currency: string;
  discount_amount: number | null;
  due_date: string | null;
  next_due_date: string | null;
  started_at: string;
  trial_ends_at: string | null;
  beta_ends_at: string | null;
  grace_period_ends_at: string | null;
  suspended_at: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean | null;
  reactivated_at: string | null;
  is_billable: boolean;
  account_type: string;
  commercial_stage: string | null;
  provisioning_status: string | null;
  slug: string | null;
};

type PaymentRecord = {
  id: string;
  amount: number;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  status: string;
  source: string;
  notes_public: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativa", color: "bg-emerald-100 text-emerald-800" },
  trial: { label: "Em Teste", color: "bg-blue-100 text-blue-800" },
  past_due: { label: "Vencida", color: "bg-amber-100 text-amber-800" },
  suspended: { label: "Suspensa", color: "bg-red-100 text-red-800" },
  canceled: { label: "Cancelada", color: "bg-gray-100 text-gray-600" },
  expired: { label: "Encerrada", color: "bg-gray-100 text-gray-600" },
  grace_period: { label: "Em Tolerância", color: "bg-orange-100 text-orange-800" },
  pending_checkout: { label: "Pendente", color: "bg-gray-100 text-gray-600" },
};

const STAGE_LABELS: Record<string, string> = {
  beta: "Beta",
  trial: "Trial",
  customer: "Cliente",
  inactive: "Inativo",
};

function formatCurrency(value: number | null, currency = "BRL") {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Vencida";
  if (diff === 0) return "Vence hoje";
  if (diff === 1) return "Vence amanhã";
  return `${diff} dias`;
}

export const Route = createFileRoute("/_authenticated/minha-conta/assinatura")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { accountId } = Route.useRouteContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [lifecycle, setLifecycle] = useState<any>(null);

  useEffect(() => {
    async function load() {
      if (!accountId) {
        setError("Conta não identificada.");
        setLoading(false);
        return;
      }
      try {
        const [subResult, payResult, lcResult] = await Promise.all([
          supabase.rpc("get_subscription_details" as never, { p_account_id: accountId }),
          supabase.rpc("get_payment_history" as never, { p_account_id: accountId }),
          serverGetLifecycleState(),
        ]);
        if (subResult.error || !subResult.data) {
          setError("Não foi possível carregar os dados da assinatura.");
        } else {
          setSubscription(subResult.data as unknown as SubscriptionDetails);
        }
        if (!payResult.error && payResult.data) {
          setPayments((payResult.data as unknown as PaymentRecord[]) ?? []);
        }
        if (lcResult.ok) {
          setLifecycle(lcResult.state);
        }
      } catch (e) {
        setError("Não foi possível carregar os dados da assinatura.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [accountId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando assinatura...</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!subscription) return <div className="p-6 text-sm text-muted-foreground">Nenhuma assinatura encontrada.</div>;

  const statusInfo = STATUS_LABELS[subscription.status] ?? { label: subscription.status, color: "bg-gray-100 text-gray-700" };
  const isDemo = subscription.account_type === "demo" || subscription.account_type === "internal" || !subscription.is_billable;
  const commercialStage = lifecycle?.commercial_stage || subscription.commercial_stage || "customer";
  const stageLabel = STAGE_LABELS[commercialStage] || commercialStage;

  let billingStatus = "Em dia";
  let billingColor = "text-emerald-700";
  if (isDemo) {
    billingStatus = "Não faturável";
    billingColor = "text-gray-500";
  } else if (subscription.status === "past_due") {
    billingStatus = "Vencida";
    billingColor = "text-amber-700";
  } else if (subscription.status === "grace_period") {
    billingStatus = "Em tolerância";
    billingColor = "text-orange-700";
  } else if (subscription.status === "suspended") {
    billingStatus = "Suspensa";
    billingColor = "text-red-700";
  } else if (subscription.status === "canceled" || subscription.status === "expired") {
    billingStatus = "Inativa";
    billingColor = "text-gray-500";
  } else if (subscription.next_due_date) {
    const d = daysUntil(subscription.next_due_date);
    if (d === "Vence hoje" || d === "Vence amanhã") {
      billingStatus = "A vencer";
      billingColor = "text-blue-700";
    }
  }

  const needsAttention = ["past_due", "grace_period", "suspended"].includes(subscription.status) ||
    (subscription.cancel_at_period_end && subscription.status === "active");

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Minha Assinatura</h1>
        <div className="flex gap-2">
          {isDemo && (
            <span className="text-xs font-medium px-2 py-1 rounded bg-purple-100 text-purple-800 uppercase tracking-wide">
              {subscription.account_type}
            </span>
          )}
          <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700 uppercase tracking-wide">
            {stageLabel}
          </span>
        </div>
      </header>

      {needsAttention && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {subscription.status === "past_due" && "Há uma pendência na sua assinatura. Entre em contato para regularizar."}
          {subscription.status === "grace_period" && `Período de tolerância ativo até ${formatDate(subscription.grace_period_ends_at)}.`}
          {subscription.status === "suspended" && "Sua assinatura está suspensa. O acesso aos serviços está bloqueado."}
          {subscription.cancel_at_period_end && subscription.status === "active" &&
            `Cancelamento agendado para ${formatDate(subscription.next_due_date)}. O acesso continua ativo até essa data.`}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Produto / Plano</p>
          <p className="text-base font-medium">{subscription.product_name ?? "NAVOR"}</p>
          <p className="text-sm text-muted-foreground">{subscription.plan_name ?? "Sem plano"}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Status da Assinatura</p>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Status de Cobrança</p>
          <p className={`text-base font-medium ${billingColor}`}>{billingStatus}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor</p>
          <p className="text-base font-medium">{formatCurrency(subscription.amount, subscription.currency)}</p>
          {subscription.discount_amount != null && subscription.discount_amount > 0 && (
            <p className="text-xs text-emerald-600">Desconto: {formatCurrency(subscription.discount_amount, subscription.currency)}</p>
          )}
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Próximo Vencimento</p>
          <p className="text-base font-medium">{formatDate(subscription.next_due_date)}</p>
          <p className="text-xs text-muted-foreground">{daysUntil(subscription.next_due_date)}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Forma de Pagamento</p>
          <p className="text-base font-medium">
            {payments.length > 0 && payments[0].payment_method ? payments[0].payment_method : "Não informado"}
          </p>
        </div>
      </section>

      {(subscription.beta_ends_at || subscription.trial_ends_at || subscription.grace_period_ends_at ||
        subscription.suspended_at || subscription.canceled_at || subscription.reactivated_at) && (
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Detalhes do Ciclo</h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            {subscription.beta_ends_at && (
              <div>
                <span className="text-muted-foreground">Beta até:</span>{" "}
                <span className="font-medium">{formatDate(subscription.beta_ends_at)}</span>
                <span className="ml-2 text-xs text-muted-foreground">({daysUntil(subscription.beta_ends_at)})</span>
              </div>
            )}
            {subscription.trial_ends_at && (
              <div>
                <span className="text-muted-foreground">Trial até:</span>{" "}
                <span className="font-medium">{formatDate(subscription.trial_ends_at)}</span>
                <span className="ml-2 text-xs text-muted-foreground">({daysUntil(subscription.trial_ends_at)})</span>
              </div>
            )}
            {subscription.grace_period_ends_at && subscription.status === "grace_period" && (
              <div>
                <span className="text-muted-foreground">Tolerância até:</span>{" "}
                <span className="font-medium text-orange-700">{formatDate(subscription.grace_period_ends_at)}</span>
              </div>
            )}
            {subscription.suspended_at && (
              <div>
                <span className="text-muted-foreground">Suspenso em:</span>{" "}
                <span className="font-medium text-red-700">{formatDate(subscription.suspended_at)}</span>
              </div>
            )}
            {subscription.canceled_at && !subscription.cancel_at_period_end && (
              <div>
                <span className="text-muted-foreground">Cancelado em:</span>{" "}
                <span className="font-medium">{formatDate(subscription.canceled_at)}</span>
              </div>
            )}
            {subscription.reactivated_at && (
              <div>
                <span className="text-muted-foreground">Reativado em:</span>{" "}
                <span className="font-medium text-emerald-700">{formatDate(subscription.reactivated_at)}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {(subscription.provisioning_status || subscription.slug) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {subscription.provisioning_status && (
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Provisionamento</p>
              <p className="text-sm font-medium capitalize">{subscription.provisioning_status}</p>
            </div>
          )}
          {subscription.slug && (
            <div className="rounded-lg border p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">URL / Slug</p>
              <p className="text-sm font-medium font-mono">{subscription.slug}</p>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Histórico de Pagamentos</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Descrição</th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Forma</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(p.paid_at ?? p.created_at)}</td>
                    <td className="px-4 py-2">
                      {p.source === "MANUAL" ? "Pagamento registrado manualmente" : subscription.plan_name ?? "Assinatura"}
                      {p.notes_public ? <span className="block text-xs text-muted-foreground">{p.notes_public}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="px-4 py-2 capitalize">{p.status}</td>
                    <td className="px-4 py-2">{p.payment_method ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
