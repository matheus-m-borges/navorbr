/**
 * NAVOR SaaS — Ciclo de Vida de Assinaturas (Servidor)
 *
 * Funções para gerenciar transições de estado de assinaturas.
 * Usadas por: rotina de reconciliação, webhooks de gateway, painel admin.
 *
 * SEGURANÇA:
 * - Nunca executar transições a partir de dados do frontend sem revalidar no servidor.
 * - Toda transição deve gerar auditoria.
 * - Estados válidos definidos no banco — see migration 20261001100000.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EmailEventType } from "@/lib/email/email-provider";

export type SubscriptionStatus =
  | "pending_checkout"
  | "trial"
  | "active"
  | "past_due"
  | "grace_period"
  | "suspended"
  | "canceled"
  | "expired";

/** Estados que permitem acesso ao produto */
export const ACCESS_ALLOWED_STATUSES: SubscriptionStatus[] = ["trial", "active", "grace_period"];

/** Estados que bloqueiam acesso */
export const ACCESS_BLOCKED_STATUSES: SubscriptionStatus[] = [
  "pending_checkout",
  "past_due",
  "suspended",
  "canceled",
  "expired",
];

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÃO CENTRAL DE TRANSIÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionSubscription(
  subscriptionId: string,
  newStatus: SubscriptionStatus,
  options?: {
    reason?: string;
    actorId?: string;
    gatewayEventId?: string;
    additionalFields?: Record<string, unknown>;
  },
): Promise<{ success: boolean; error?: string }> {
  // Busca apenas os dados necessários para montar o evento. A transição,
  // atualização e enqueue são executados juntos pela RPC transacional.
  const { data: sub, error: fetchError } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, account_id, billing_email, plan_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (fetchError || !sub) {
    return { success: false, error: "Assinatura não encontrada." };
  }

  // O RPC revalida a transição sob lock e mantém a alteração e o e-mail na
  // mesma transação. O mapa local só define o destinatário do evento.
  const emailEventMap: Partial<Record<string, EmailEventType>> = {
    active:    "payment_approved",
    suspended: "access_suspended",
    canceled:  "subscription_canceled",
    expired:   "subscription_canceled",
    past_due:  "charge_overdue",
  };

  const emailEventType = emailEventMap[newStatus];
  let recipientName = "Cliente";
  if (emailEventType && sub.billing_email) {
    const { data: member, error: memberError } = await supabaseAdmin
      .from("account_members")
      .select("user_id")
      .eq("account_id", sub.account_id)
      .eq("role", "owner")
      .maybeSingle();
    if (memberError) return { success: false, error: `Falha ao buscar responsável: ${memberError.message}` };

    if (member?.user_id) {
      const { data: userRow, error: userError } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      if (userError) return { success: false, error: `Falha ao buscar responsável: ${userError.message}` };
      recipientName = userRow?.user?.user_metadata?.full_name ?? "Cliente";
    }
  }

  const { error: transitionError } = await (supabaseAdmin as any).rpc("transition_subscription_atomic", {
    p_subscription_id: subscriptionId,
    p_new_status: newStatus,
    p_event_type: emailEventType ?? null,
    p_recipient_email: sub.billing_email ?? null,
    p_recipient_name: recipientName,
  });

  if (transitionError) {
    return { success: false, error: `Falha na transição da assinatura: ${transitionError.message}` };
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVISIONING DE MÓDULOS (pós-mudança de plano)
// ─────────────────────────────────────────────────────────────────────────────

export async function syncAccountModulesFromPlan(
  accountId: string,
  planId: string,
): Promise<void> {
  const { error } = await (supabaseAdmin as any).rpc("reconcile_account_modules", {
    p_account_id: accountId,
    p_plan_id: planId,
  });
  if (error) throw new Error(`Falha ao reconciliar módulos da assinatura: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICAÇÃO DE ACESSO BASEADA NO STATUS
// ─────────────────────────────────────────────────────────────────────────────

export function isSubscriptionAccessAllowed(
  status: SubscriptionStatus,
  allowGracePeriod = true,
): boolean {
  if (status === "active" || status === "trial") return true;
  if (status === "grace_period" && allowGracePeriod) return true;
  return false;
}

export function getBlockedStatusMessage(status: SubscriptionStatus): {
  title: string;
  description: string;
  action: string;
} {
  const messages: Record<SubscriptionStatus, { title: string; description: string; action: string }> = {
    pending_checkout: {
      title: "Cadastro pendente",
      description: "Seu cadastro foi iniciado mas ainda não foi concluído.",
      action: "Conclua o cadastro para ativar seu acesso.",
    },
    past_due: {
      title: "Cobrança vencida",
      description: "Identificamos uma cobrança em atraso na sua assinatura.",
      action: "Regularize o pagamento para restaurar o acesso.",
    },
    grace_period: {
      title: "Período de tolerância",
      description: "Sua assinatura está em período de tolerância após vencimento.",
      action: "Regularize o pagamento o quanto antes para evitar a suspensão.",
    },
    suspended: {
      title: "Acesso suspenso",
      description: "Seu acesso foi suspenso por falta de pagamento.",
      action: "Entre em contato com o suporte para reativar sua conta.",
    },
    canceled: {
      title: "Assinatura cancelada",
      description: "Sua assinatura foi cancelada.",
      action: "Inicie uma nova assinatura para voltar a usar o sistema.",
    },
    expired: {
      title: "Período de teste encerrado",
      description: "Seu período de teste gratuito foi encerrado.",
      action: "Assine um plano para continuar com acesso completo.",
    },
    trial: {
      title: "Em teste",
      description: "Você está no período de teste.",
      action: "",
    },
    active: {
      title: "Ativo",
      description: "Sua assinatura está ativa.",
      action: "",
    },
  };

  return messages[status] ?? messages["suspended"];
}
