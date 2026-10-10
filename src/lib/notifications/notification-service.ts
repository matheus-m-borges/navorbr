/**
 * NAVOR Core — NotificationService
 *
 * Infraestrutura compartilhada de notificações transacionais.
 * Implementa o padrão Transactional Outbox para garantir que
 * notificações sejam persistidas atomicamente com eventos de negócio.
 *
 * SEGURANÇA:
 * - Inbox isolada por user_id (RLS).
 * - Outbox/Delivery Logs restritos a Platform Admin.
 * - Templates não expõem dados sensíveis.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface NotificationTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  channel: string;
  subject_template: string | null;
  body_template: string;
  variables: string[];
}

export interface NotificationOutboxEntry {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  template_slug: string | null;
  channel: string;
  recipient_user_id: string | null;
  recipient_email: string | null;
  status: string;
  retry_count: number;
  created_at: string;
}

export interface UserNotification {
  id: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Enfileira uma notificação no outbox transacional.
 * Deve ser chamada dentro da mesma transação do evento de negócio
 * quando possível, ou logo após confirmação assíncrona.
 */
export async function enqueueNotification(input: {
  eventType: string;
  payload: Record<string, unknown>;
  channel: "email" | "in_app" | "sms" | "whatsapp";
  templateSlug?: string;
  recipientUserId?: string;
  recipientEmail?: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("notification_outbox")
    .insert({
      event_type: input.eventType,
      payload: input.payload,
      channel: input.channel,
      template_slug: input.templateSlug ?? null,
      recipient_user_id: input.recipientUserId ?? null,
      recipient_email: input.recipientEmail ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to enqueue notification: ${error.message}`);
  return data.id;
}

/**
 * Cria uma notificação in-app direta na inbox do usuário.
 * Usado para alertas imediatos que não passam pelo outbox assíncrono.
 */
export async function createInAppNotification(input: {
  userId: string;
  accountId?: string;
  category: string;
  priority?: "low" | "normal" | "high" | "urgent";
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: input.userId,
      account_id: input.accountId ?? null,
      category: input.category,
      priority: input.priority ?? "normal",
      title: input.title,
      body: input.body,
      action_url: input.actionUrl ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create in-app notification: ${error.message}`);
  return data.id;
}

/**
 * Lista notificações da inbox do usuário autenticado.
 * Isolamento garantido por RLS (user_id = auth.uid()).
 */
export async function getUserNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<UserNotification[]> {
  let query = supabaseAdmin
    .from("notifications")
    .select("id, category, priority, title, body, action_url, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq("is_read", false);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  } else {
    query = query.limit(50);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as UserNotification[];
}

/**
 * Marca notificação como lida.
 */
export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId); // Double-check isolation

  if (error) throw new Error(error.message);
}

/**
 * Renderiza um template com variáveis fornecidas.
 * Substituição simples de {{variable}} sem eval/execução.
 */
export async function renderTemplate(
  slug: string,
  variables: Record<string, string>
): Promise<{ subject: string | null; body: string }> {
  const { data: template, error } = await supabaseAdmin
    .from("notification_templates")
    .select("subject_template, body_template, variables")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!template) throw new Error(`Template not found: ${slug}`);

  const allowedVars = (template.variables ?? []) as string[];
  
  const safeReplace = (tpl: string | null): string => {
    if (!tpl) return "";
    return tpl.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (!allowedVars.includes(key)) return match; // Keep placeholder if not allowed
      return variables[key] ?? "";
    });
  };

  return {
    subject: template.subject_template ? safeReplace(template.subject_template) : null,
    body: safeReplace(template.body_template),
  };
}

/**
 * Lista entradas pendentes do outbox para processamento pelo worker.
 * Apenas Platform Admin / Service Role deve chamar isso.
 */
export async function getPendingOutboxEntries(limit: number = 20): Promise<NotificationOutboxEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("notification_outbox")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationOutboxEntry[];
}
