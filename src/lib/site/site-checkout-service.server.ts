/**
 * NAVOR Core — SiteCheckoutService (Server-Only)
 *
 * Gerencia o fluxo comercial público: catálogo dinâmico, sessões de checkout,
 * termos de uso e criação segura de assinaturas.
 *
 * SEGURANÇA:
 * - Preços validados exclusivamente no servidor (catálogo real).
 * - Checkout sessions possuem token seguro e expiração.
 * - Termos versionados e aceite auditável.
 * - Nenhum dado sensível exposto em rotas públicas.
 *
 * TANSTACK START COMPATIBILITY:
 * - This file MUST be named .server.ts to prevent import-protection violations.
 * - Route files must use createServerFn() and dynamically import this module.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SiteProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  plans: SitePlan[];
}

export interface SitePlan {
  id: string;
  name: string;
  price_cents: number;
  billing_cycle: "monthly" | "yearly";
  features: string[];
  is_active: boolean;
}

export interface CheckoutSession {
  id: string;
  session_token: string;
  status: string;
  product_id: string | null;
  plan_id: string | null;
  billing_cycle: string | null;
  company_name: string | null;
  email: string | null;
  expires_at: string;
  terms_version: string | null;
  terms_accepted_at: string | null;
}

/**
 * Lista produtos ativos com seus planos para o site público.
 * Dados vêm do catálogo real da Core (Cadeira 4.6).
 */
export async function getPublicCatalog(): Promise<SiteProduct[]> {
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, slug, name, description, status, is_public")
    .eq("status", "active")
    .eq("is_public", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const result: SiteProduct[] = [];
  for (const prod of products ?? []) {
    const { data: plans } = await supabaseAdmin
      .from("plans")
      .select("id, name, amount, billing_cycle, is_active")
      .eq("product_id", prod.id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    result.push({
      id: prod.id,
      slug: prod.slug,
      name: prod.name,
      description: prod.description,
      is_active: prod.status === "active",
      plans: (plans ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price_cents: p.amount ? Math.round(Number(p.amount) * 100) : 0,
        billing_cycle: p.billing_cycle ?? "monthly",
        features: [],
        is_active: Boolean(p.is_active),
      })),
    });
  }
  return result;
}

/**
 * Cria uma nova sessão de checkout com token seguro.
 */
export async function createCheckoutSession(input: {
  productId: string;
  planId: string;
  billingCycle: "monthly" | "yearly";
}): Promise<CheckoutSession> {
  // IDEMPOTENCY / DOUBLE-SUBMIT PROTECTION:
  // If a pending/active session already exists for this plan+product, return it
  // instead of creating duplicates. Prevents race conditions from rapid clicks.
  const { data: existingSession } = await supabaseAdmin
    .from("checkout_sessions")
    .select("*")
    .eq("product_id", input.productId)
    .eq("plan_id", input.planId)
    .eq("billing_cycle", input.billingCycle)
    .in("status", ["started", "data_filled", "terms_accepted"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSession) {
    return existingSession as CheckoutSession;
  }

  const { data: plan, error: planErr } = await supabaseAdmin
    .from("plans")
    .select("id, product_id, amount, billing_cycle, is_active")
    .eq("id", input.planId)
    .eq("product_id", input.productId)
    .eq("is_active", true)
    .maybeSingle();

  if (planErr || !plan) {
    throw new Error("Plano inválido ou indisponível");
  }

  const sessionToken = crypto.randomUUID();

  const { data, error } = await supabaseAdmin
    .from("checkout_sessions")
    .insert({
      session_token: sessionToken,
      status: "started",
      product_id: input.productId,
      plan_id: input.planId,
      billing_cycle: input.billingCycle,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as CheckoutSession;
}

/**
 * Recupera sessão de checkout por token público.
 */
export async function getCheckoutSession(token: string): Promise<CheckoutSession | null> {
  const { data, error } = await supabaseAdmin
    .from("checkout_sessions")
    .select("*")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CheckoutSession | null;
}

/**
 * Atualiza dados do assinante na sessão de checkout.
 */
export async function updateCheckoutData(token: string, input: {
  companyName: string;
  responsibleName: string;
  email: string;
  phone?: string;
  document?: string;
}): Promise<CheckoutSession> {
  const { data, error } = await supabaseAdmin
    .from("checkout_sessions")
    .update({
      company_name: input.companyName,
      responsible_name: input.responsibleName,
      email: input.email,
      phone: input.phone ?? null,
      document: input.document ?? null,
      status: "data_filled",
      updated_at: new Date().toISOString(),
    })
    .eq("session_token", token)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as CheckoutSession;
}

/**
 * Registra aceite de termos na sessão de checkout.
 */
export async function acceptTerms(token: string, input: {
  legalDocumentId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const session = await getCheckoutSession(token);
  if (!session) throw new Error("Sessão inválida ou expirada");

  const { data: legalDoc } = await supabaseAdmin
    .from("legal_documents")
    .select("version")
    .eq("id", input.legalDocumentId)
    .eq("is_active", true)
    .maybeSingle();

  if (!legalDoc) throw new Error("Documento legal não encontrado");

  await supabaseAdmin.from("legal_acceptances").insert({
    legal_document_id: input.legalDocumentId,
    checkout_session_id: session.id,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });

  await supabaseAdmin
    .from("checkout_sessions")
    .update({
      terms_version: legalDoc.version,
      terms_accepted_at: new Date().toISOString(),
      status: "terms_accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("session_token", token);
}

/**
 * Obtém documentos legais ativos para exibição pública.
 */
export async function getActiveLegalDocuments(): Promise<Array<{
  id: string;
  type: string;
  version: string;
  title: string;
  content: string;
  summary: string | null;
}>> {
  const { data, error } = await supabaseAdmin
    .from("legal_documents")
    .select("id, type, version, title, content, summary")
    .eq("is_active", true)
    .order("type", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    type: string;
    version: string;
    title: string;
    content: string;
    summary: string | null;
  }>;
}


