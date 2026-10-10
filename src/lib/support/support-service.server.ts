/**
 * NAVOR Core — SupportService (Server-Only)
 *
 * Gerencia tickets de suporte, SLAs e base de conhecimento.
 * SEGURANÇA: Isolamento multi-tenant via account_id + RLS.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SupportTicket {
  id: string;
  account_id: string;
  subject: string;
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  priority: number;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface TicketReply {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface SlaPolicy {
  id: string;
  name: string;
  priority: number;
  response_time_minutes: number;
  resolution_time_minutes: number;
}

export interface KbArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  tags: string[];
  is_published: boolean;
  view_count: number;
}

/**
 * Lista tickets da conta do usuário autenticado.
 */
export async function listAccountTickets(accountId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SupportTicket[];
}

/**
 * Cria novo ticket de suporte.
 */
export async function createTicket(input: {
  accountId: string;
  userId: string;
  subject: string;
  body: string;
  priority?: number;
  category?: string;
}): Promise<SupportTicket> {
  // Auto-assign SLA based on priority
  const priority = input.priority ?? 3;
  const { data: sla } = await supabaseAdmin
    .from("sla_policies")
    .select("id")
    .eq("priority", priority)
    .eq("is_active", true)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      account_id: input.accountId,
      created_by: input.userId,
      subject: input.subject,
      priority,
      category: input.category ?? "general",
      sla_policy_id: sla?.id ?? null,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Add initial message as first reply
  await supabaseAdmin.from("ticket_replies").insert({
    ticket_id: data.id,
    author_id: input.userId,
    body: input.body,
    is_internal: false,
  });

  return data as SupportTicket;
}

/**
 * Adiciona resposta a um ticket.
 */
export async function addTicketReply(input: {
  ticketId: string;
  authorId: string;
  body: string;
  isInternal?: boolean;
}): Promise<TicketReply> {
  const { data, error } = await supabaseAdmin
    .from("ticket_replies")
    .insert({
      ticket_id: input.ticketId,
      author_id: input.authorId,
      body: input.body,
      is_internal: input.isInternal ?? false,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Update ticket timestamp
  await supabaseAdmin
    .from("support_tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.ticketId);

  return data as TicketReply;
}

/**
 * Lista artigos publicados da base de conhecimento.
 */
export async function listPublishedArticles(category?: string): Promise<KbArticle[]> {
  let query = supabaseAdmin
    .from("knowledge_base_articles")
    .select("*")
    .eq("is_published", true)
    .order("view_count", { ascending: false });
  if (category) {
    query = query.eq("category", category);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as KbArticle[];
}

/**
 * Obtém artigo por slug e incrementa contador de views.
 */
export async function getArticleBySlug(slug: string): Promise<KbArticle | null> {
  const { data, error } = await supabaseAdmin
    .from("knowledge_base_articles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  // Increment view count (fire-and-forget)
  supabaseAdmin.rpc("increment_kb_view_count", { article_id: data.id }).then(() => {});

  return data as KbArticle;
}

/**
 * Lista políticas de SLA ativas.
 */
export async function listSlaPolicies(): Promise<SlaPolicy[]> {
  const { data, error } = await supabaseAdmin
    .from("sla_policies")
    .select("*")
    .eq("is_active", true)
    .order("priority");
  if (error) throw new Error(error.message);
  return (data ?? []) as SlaPolicy[];
}
