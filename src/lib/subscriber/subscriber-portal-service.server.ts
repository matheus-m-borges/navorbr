/**
 * NAVOR Core — Subscriber Portal Service (Server-Only)
 *
 * Operações reais do portal do assinante:
 * - Visualização de conta e assinatura
 * - Edição autorizada de dados cadastrais
 * - Gestão de usuários (convites, revogações)
 * - Solicitação de mudança de plano
 * - Preferências de notificação
 * - Histórico de termos aceitos
 *
 * SEGURANÇA: Todas as operações validam membership + account_id.
 * Tenant isolation estrito em todas as queries.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AccountSummary {
  id: string;
  name: string;
  email: string | null;
  product_name: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  active_members_count: number;
}

export interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  invited_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
}

export interface NotificationPreference {
  id: string;
  category: string;
  channel: string;
  enabled: boolean;
  frequency: string;
}

export interface PlanChangeRequest {
  id: string;
  current_plan_id: string;
  requested_plan_id: string;
  status: string;
  created_at: string;
}

/**
 * Obtém resumo da conta do assinante autenticado.
 */
export async function getAccountSummary(userId: string): Promise<AccountSummary | null> {
  const { data: membership } = await supabaseAdmin
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return null;

  const { data: account, error } = await supabaseAdmin
    .from("accounts")
    .select("id, name, products(name), subscriptions(status, current_period_end, plans(name))")
    .eq("id", membership.account_id)
    .single();

  if (error || !account) return null;

  const sub = Array.isArray(account.subscriptions) ? account.subscriptions[0] : account.subscriptions;

  const { count } = await supabaseAdmin
    .from("account_members")
    .select("*", { count: "exact", head: true })
    .eq("account_id", membership.account_id)
    .eq("status", "active");

  return {
    id: account.id,
    name: account.name,
    email: null, // Will be filled by caller from auth context
    product_name: (account.products as any)?.name ?? null,
    plan_name: (sub?.plans as any)?.name ?? null,
    subscription_status: sub?.status ?? null,
    current_period_end: sub?.current_period_end ?? null,
    active_members_count: count ?? 0,
  };
}

/**
 * Atualiza dados cadastrais da conta (nome, responsável).
 * Apenas admin da conta pode executar.
 */
export async function updateAccountData(
  userId: string,
  input: { companyName?: string; responsibleName?: string; phone?: string }
): Promise<{ success: boolean; error?: string }> {
  const { data: membership } = await supabaseAdmin
    .from("account_members")
    .select("account_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return { success: false, error: "Usuário não vinculado a nenhuma conta" };

  // Only account admins can update company data
  if (!["administrador", "PROPRIETARIO", "admin"].includes(membership.role)) {
    return { success: false, error: "Apenas administradores podem alterar dados da conta" };
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.companyName) updates.name = input.companyName;
  if (input.responsibleName) updates.responsible_name = input.responsibleName;
  if (input.phone) updates.phone = input.phone;

  const { error } = await supabaseAdmin
    .from("accounts")
    .update(updates)
    .eq("id", membership.account_id);

  if (error) return { success: false, error: error.message };

  // Audit log
  await supabaseAdmin.from("navor_platform_audit_logs").insert({
    actor_user_id: userId,
    actor_account_id: membership.account_id,
    action: "update_account_data",
    entity_type: "account",
    entity_id: membership.account_id,
    metadata: input,
    result: "success",
  });

  return { success: true };
}

/**
 * Lista membros da equipe da conta.
 */
export async function listTeamMembers(userId: string): Promise<TeamMember[]> {
  const { data: membership } = await supabaseAdmin
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return [];

  const { data, error } = await supabaseAdmin
    .from("account_members")
    .select("id, user_id, role, status, invited_at, profiles(full_name, email)")
    .eq("account_id", membership.account_id)
    .order("invited_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
}

/**
 * Convida novo usuário para a conta.
 * Respeita limites do plano e RBAC.
 */
export async function inviteTeamMember(
  userId: string,
  input: { email: string; role: string }
): Promise<{ success: boolean; error?: string }> {
  const { data: membership } = await supabaseAdmin
    .from("account_members")
    .select("account_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return { success: false, error: "Usuário não vinculado a nenhuma conta" };

  if (!["administrador", "PROPRIETARIO", "admin"].includes(membership.role)) {
    return { success: false, error: "Apenas administradores podem convidar membros" };
  }

  // Check member limit based on subscription plan
  const { count: currentCount } = await supabaseAdmin
    .from("account_members")
    .select("*", { count: "exact", head: true })
    .eq("account_id", membership.account_id)
    .in("status", ["active", "pending"]);

  // TODO: Fetch plan member limit from entitlements engine
  // For now, use a reasonable default
  const MEMBER_LIMIT = 50;
  if ((currentCount ?? 0) >= MEMBER_LIMIT) {
    return { success: false, error: `Limite de ${MEMBER_LIMIT} membros atingido. Faça upgrade do plano.` };
  }

  // Check if user already exists in system
  const { data: existingUser } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();

  if (existingUser) {
    // Check if already a member of this account
    const { data: existingMembership } = await supabaseAdmin
      .from("account_members")
      .select("id")
      .eq("account_id", membership.account_id)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMembership) {
      return { success: false, error: "Usuário já é membro desta conta" };
    }

    // Add existing user to account
    const { error } = await supabaseAdmin.from("account_members").insert({
      account_id: membership.account_id,
      user_id: existingUser.id,
      role: input.role,
      status: "active",
    });

    if (error) return { success: false, error: error.message };
  } else {
    // Create invitation record for non-existent user
    const { error } = await supabaseAdmin.from("account_members").insert({
      account_id: membership.account_id,
      user_id: null, // Will be linked when user accepts invite
      role: input.role,
      status: "pending",
      invited_email: input.email,
    });

    if (error) return { success: false, error: error.message };
  }

  // Audit log
  await supabaseAdmin.from("navor_platform_audit_logs").insert({
    actor_user_id: userId,
    actor_account_id: membership.account_id,
    action: "invite_team_member",
    entity_type: "account_member",
    metadata: { email: input.email, role: input.role },
    result: "success",
  });

  return { success: true };
}

/**
 * Revoga acesso de um membro da equipe.
 */
export async function revokeTeamMember(
  userId: string,
  targetMemberId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: membership } = await supabaseAdmin
    .from("account_members")
    .select("account_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return { success: false, error: "Usuário não vinculado a nenhuma conta" };

  if (!["administrador", "PROPRIETARIO", "admin"].includes(membership.role)) {
    return { success: false, error: "Apenas administradores podem revogar acessos" };
  }

  // Verify target belongs to same account
  const { data: targetMember } = await supabaseAdmin
    .from("account_members")
    .select("id, user_id")
    .eq("id", targetMemberId)
    .eq("account_id", membership.account_id)
    .maybeSingle();

  if (!targetMember) return { success: false, error: "Membro não encontrado nesta conta" };

  // Cannot revoke own access via this endpoint
  if (targetMember.user_id === userId) {
    return { success: false, error: "Não é possível revogar seu próprio acesso por esta operação" };
  }

  const { error } = await supabaseAdmin
    .from("account_members")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", targetMemberId);

  if (error) return { success: false, error: error.message };

  // Audit log
  await supabaseAdmin.from("navor_platform_audit_logs").insert({
    actor_user_id: userId,
    actor_account_id: membership.account_id,
    action: "revoke_team_member",
    entity_type: "account_member",
    entity_id: targetMemberId,
    result: "success",
  });

  return { success: true };
}

/**
 * Obtém preferências de notificação do usuário.
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .order("category");

  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationPreference[];
}

/**
 * Atualiza preferência de notificação.
 */
export async function updateNotificationPreference(
  userId: string,
  input: { category: string; channel: string; enabled: boolean; frequency?: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("notification_preferences")
    .upsert({
      user_id: userId,
      category: input.category,
      channel: input.channel,
      enabled: input.enabled,
      frequency: input.frequency ?? "immediate",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,category,channel" });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Solicita mudança de plano.
 * Cria registro pendente para aprovação administrativa.
 */
export async function requestPlanChange(
  userId: string,
  input: { requestedPlanId: string; reason?: string }
): Promise<{ success: boolean; error?: string }> {
  const { data: membership } = await supabaseAdmin
    .from("account_members")
    .select("account_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return { success: false, error: "Usuário não vinculado a nenhuma conta" };

  if (!["administrador", "PROPRIETARIO", "admin"].includes(membership.role)) {
    return { success: false, error: "Apenas administradores podem solicitar mudança de plano" };
  }

  // Get current subscription
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id, plan_id, status")
    .eq("account_id", membership.account_id)
    .in("status", ["active", "trial", "grace_period"])
    .maybeSingle();

  if (!subscription) return { success: false, error: "Nenhuma assinatura ativa encontrada" };

  // Verify requested plan exists and is active
  const { data: targetPlan } = await supabaseAdmin
    .from("plans")
    .select("id, name, amount_cents")
    .eq("id", input.requestedPlanId)
    .eq("is_active", true)
    .maybeSingle();

  if (!targetPlan) return { success: false, error: "Plano solicitado não encontrado ou inativo" };

  // Create plan change request record
  const { error } = await supabaseAdmin.from("plan_change_requests").insert({
    account_id: membership.account_id,
    subscription_id: subscription.id,
    current_plan_id: subscription.plan_id,
    requested_plan_id: input.requestedPlanId,
    requested_by: userId,
    reason: input.reason ?? null,
    status: "pending_approval",
  });

  if (error) {
    // Table may not exist yet - create inline fallback
    // In production, this should be a proper migration
    console.warn("[SubscriberPortal] plan_change_requests table may not exist:", error.message);
    return { success: false, error: "Sistema de solicitação de planos indisponível temporariamente" };
  }

  // Audit log
  await supabaseAdmin.from("navor_platform_audit_logs").insert({
    actor_user_id: userId,
    actor_account_id: membership.account_id,
    action: "request_plan_change",
    entity_type: "subscription",
    entity_id: subscription.id,
    metadata: { requested_plan_id: input.requestedPlanId, reason: input.reason },
    result: "success",
  });

  return { success: true };
}

/**
 * Lista histórico de aceite de termos.
 */
export async function getConsentHistory(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("navor_consent_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
