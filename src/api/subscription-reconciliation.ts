/**
 * NAVOR SaaS — Rotina de Reconciliação de Assinaturas
 *
 * SEGURANÇA:
 * - `runReconciliation` (admin manual): requer autenticação + isPlatformAdmin.
 * - `cronReconcileSubscriptions` (cron): protegido por CRON_SECRET via HTTP header.
 * - A função `reconcileSubscriptions()` é interna e não é exportada como endpoint público.
 * - Respostas públicas são sempre sanitizadas — sem IDs de assinatura em resposta de erro.
 *
 * ARQUITETURA:
 * - Webhook do gateway é a fonte primária de eventos de pagamento.
 * - Esta rotina é complementar — corrige estados inconsistentes por ausência de webhook.
 * - Idempotente: pode ser executada múltiplas vezes sem efeitos duplicados.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  transitionSubscription,
  type SubscriptionStatus,
} from "@/lib/subscription/subscription-lifecycle.server";

// ─────────────────────────────────────────────────────────────────────────────
// RESULTADO DA RECONCILIAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

interface ReconciliationResult {
  processed: number;
  transitioned: number;
  errors: number;
  /** Detalhes — disponíveis apenas para admins, nunca para cron externo */
  details: {
    subscriptionId: string;
    previousStatus: SubscriptionStatus;
    newStatus: SubscriptionStatus;
    reason: string;
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTINA PRINCIPAL (interna — não exportada como endpoint)
// ─────────────────────────────────────────────────────────────────────────────

async function reconcileSubscriptions(): Promise<ReconciliationResult> {
  const now = new Date();
  const result: ReconciliationResult = {
    processed: 0,
    transitioned: 0,
    errors: 0,
    details: [],
  };

  await reconcileExpiredTrials(now, result);
  await reconcileOverduePayments(now, result);
  await reconcileGracePeriods(now, result);
  await reconcileSuspensions(now, result);

  console.info(
    `[Reconciliation] Concluída: ${result.processed} processadas, ` +
    `${result.transitioned} transições, ${result.errors} erros.`,
  );

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ROTINAS
// ─────────────────────────────────────────────────────────────────────────────

async function reconcileExpiredTrials(
  now: Date,
  result: ReconciliationResult,
): Promise<void> {
  const { data: expiredTrials, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, trial_ends_at, account_id")
    .eq("status", "trial")
    .lt("trial_ends_at", now.toISOString())
    .limit(100);

  if (error) {
    console.error("[Reconciliation] Erro ao buscar trials expirados:", error.message);
    result.errors++;
    return;
  }

  for (const sub of expiredTrials ?? []) {
    result.processed++;
    const transition = await transitionSubscription(sub.id, "expired", {
      reason: "Trial expirado — reconciliação automática",
    });

    if (transition.success) {
      result.transitioned++;
      result.details.push({
        subscriptionId: sub.id,
        previousStatus: "trial",
        newStatus: "expired",
        reason: "Trial expirado",
      });
    } else {
      result.errors++;
      console.warn(`[Reconciliation] Falha ao expirar trial ${sub.id}: ${transition.error}`);
    }
  }
}

async function reconcileOverduePayments(
  now: Date,
  result: ReconciliationResult,
): Promise<void> {
  const { data: overdueActive, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, next_billing_at, account_id")
    .eq("status", "active")
    .lt("next_billing_at", now.toISOString())
    .not("next_billing_at", "is", null)
    .limit(100);

  if (error) {
    console.error("[Reconciliation] Erro ao buscar pagamentos vencidos:", error.message);
    result.errors++;
    return;
  }

  for (const sub of overdueActive ?? []) {
    result.processed++;
    const transition = await transitionSubscription(sub.id, "past_due", {
      reason: "Pagamento vencido — reconciliação automática",
    });

    if (transition.success) {
      result.transitioned++;
      result.details.push({
        subscriptionId: sub.id,
        previousStatus: "active",
        newStatus: "past_due",
        reason: "Próxima cobrança vencida",
      });
    } else {
      result.errors++;
    }
  }
}

async function reconcileGracePeriods(
  now: Date,
  result: ReconciliationResult,
): Promise<void> {
  const { data: pastDue, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, account_id")
    .eq("status", "past_due")
    .is("grace_period_ends_at", null)
    .limit(100);

  if (error) {
    console.error("[Reconciliation] Erro ao buscar past_due para grace_period:", error.message);
    result.errors++;
    return;
  }

  for (const sub of pastDue ?? []) {
    result.processed++;
    const transition = await transitionSubscription(sub.id, "grace_period", {
      reason: "Iniciando período de tolerância — reconciliação automática",
    });

    if (transition.success) {
      result.transitioned++;
      result.details.push({
        subscriptionId: sub.id,
        previousStatus: "past_due",
        newStatus: "grace_period",
        reason: "Início do período de tolerância (5 dias)",
      });
    } else {
      result.errors++;
    }
  }
}

async function reconcileSuspensions(
  now: Date,
  result: ReconciliationResult,
): Promise<void> {
  const { data: graceExpired, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, grace_period_ends_at, account_id")
    .eq("status", "grace_period")
    .lt("grace_period_ends_at", now.toISOString())
    .not("grace_period_ends_at", "is", null)
    .limit(100);

  if (error) {
    console.error("[Reconciliation] Erro ao buscar grace_period expirado:", error.message);
    result.errors++;
    return;
  }

  for (const sub of graceExpired ?? []) {
    result.processed++;
    const transition = await transitionSubscription(sub.id, "suspended", {
      reason: "Período de tolerância encerrado — reconciliação automática",
    });

    if (transition.success) {
      result.transitioned++;
      result.details.push({
        subscriptionId: sub.id,
        previousStatus: "grace_period",
        newStatus: "suspended",
        reason: "Período de tolerância encerrado sem pagamento",
      });
    } else {
      result.errors++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO A — SERVIDOR FUNCTION: Acionamento manual por ADMINISTRADOR NAVOR
//
// Requer:
// - Autenticação válida (requireSupabaseAuth)
// - isPlatformAdmin = true
// - Retorna detalhes completos (apenas para admin)
// ─────────────────────────────────────────────────────────────────────────────

export const runReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verificação de autorização: somente administrador global da plataforma
    const { isPlatformAdmin } = await import("@/lib/security/authorization.server");
    const isAdmin = await isPlatformAdmin(context.userId);

    if (!isAdmin) {
      // Não revela detalhes do erro ao usuário comum
      throw new Error("Acesso não autorizado.");
    }

    // Auditoria da execução manual
    console.info(
      `[Reconciliation][ADMIN] Execução manual solicitada por userId=${context.userId.slice(0, 8)}...`,
    );

    const result = await reconcileSubscriptions();

    // Auditoria do resultado
    console.info(
      `[Reconciliation][ADMIN] Concluída por userId=${context.userId.slice(0, 8)}... ` +
      `— ${result.processed} processadas, ${result.transitioned} transições.`,
    );

    return {
      success: true,
      processed: result.processed,
      transitioned: result.transitioned,
      errors: result.errors,
      // Detalhes disponíveis apenas para admin autenticado
      details: result.details,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// MODO B — Função interna para uso por endpoint de cron (ver cron-reconciliation.ts)
//
// NÃO é um Server Function — é chamada pelo handler do endpoint de cron
// que valida o CRON_SECRET antes de chamar esta função.
// ─────────────────────────────────────────────────────────────────────────────

export async function runReconciliationForCron(): Promise<{
  processed: number;
  transitioned: number;
  errors: number;
}> {
  const result = await reconcileSubscriptions();
  // Retorno sanitizado — sem IDs de assinatura
  return {
    processed: result.processed,
    transitioned: result.transitioned,
    errors: result.errors,
  };
}
