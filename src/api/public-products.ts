/**
 * NAVOR SaaS — Server Functions Públicas de Produtos e Planos
 *
 * Estas funções são acessíveis SEM autenticação (rota pública).
 * Retornam somente dados seguros para exibição na vitrine e na jornada de trial.
 *
 * REGRA CENTRAL: O backend é a única fonte de verdade para preços, planos,
 * módulos e elegibilidade de teste. O frontend não pode confiar em nenhum
 * valor enviado por URL ou formulário para determinar condições comerciais.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS DE RETORNO
// ─────────────────────────────────────────────────────────────────────────────

export interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  billingCycle: string;
  trialEligible: boolean;
  trialDays: number;
  isFeatured: boolean;
  displayOrder: number;
  userLimit: number | null;
  whatsappNumberLimit: number | null;
  modules: { key: string; name: string; description: string | null }[];
}

export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  status: string;
  isPublic: boolean;
  trialEligible: boolean;
  tagLine: string | null;
  shortDescription: string | null;
  targetAudience: string | null;
  benefits: string[] | null;
  displayOrder: number;
  plans: PublicPlan[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER FUNCTION: Lista todos os produtos públicos com seus planos
// ─────────────────────────────────────────────────────────────────────────────

export const getPublicProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicProduct[]> => {
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select(`
        id, slug, name, status, is_public, trial_eligible,
        tag_line, short_description, target_audience, benefits, display_order,
        plans (
          id, name, description, amount, billing_cycle, trial_eligible, trial_days,
          is_featured, display_order, user_limit, whatsapp_number_limit, is_active, is_public,
          plan_modules (
            system_modules ( key, name, description )
          )
        )
      `)
      .eq("is_public", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("[getPublicProducts] Erro ao buscar produtos:", error.message);
      return [];
    }

    return (products ?? []).map((p) => mapProductToPublic(p));
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// SERVER FUNCTION: Busca produto público por slug com planos detalhados
// ─────────────────────────────────────────────────────────────────────────────

export const getPublicProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<PublicProduct | null> => {
    if (!data.slug || typeof data.slug !== "string" || data.slug.length > 64) {
      return null;
    }

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select(`
        id, slug, name, status, is_public, trial_eligible,
        tag_line, short_description, target_audience, benefits, display_order,
        plans (
          id, name, description, amount, billing_cycle, trial_eligible, trial_days,
          is_featured, display_order, user_limit, whatsapp_number_limit, is_active, is_public,
          plan_modules (
            system_modules ( key, name, description )
          )
        )
      `)
      .eq("slug", data.slug)
      .eq("is_public", true)
      .maybeSingle();

    if (error) {
      console.error("[getPublicProductBySlug] Erro:", error.message);
      return null;
    }

    if (!product) return null;
    return mapProductToPublic(product);
  });

// ─────────────────────────────────────────────────────────────────────────────
// SERVER FUNCTION: Valida elegibilidade de plano para trial
// Usado pela jornada de /teste-gratis para confirmar no backend
// ─────────────────────────────────────────────────────────────────────────────

export const validateTrialEligibility = createServerFn({ method: "POST" })
  .inputValidator((data: { productSlug: string; planId: string }) => data)
  .handler(async ({ data }): Promise<{
    eligible: boolean;
    reason?: string;
    plan?: Pick<PublicPlan, "id" | "name" | "amount" | "trialDays" | "billingCycle">;
    product?: Pick<PublicProduct, "id" | "slug" | "name">;
  }> => {
    if (!data.productSlug || !data.planId) {
      return { eligible: false, reason: "Produto ou plano não informado." };
    }

    const { data: plan, error } = await supabaseAdmin
      .from("plans")
      .select(`
        id, name, amount, billing_cycle, trial_eligible, trial_days,
        is_active, is_public, product_id,
        products!inner ( id, slug, name, is_public, trial_eligible, status )
      `)
      .eq("id", data.planId)
      .maybeSingle();

    if (error || !plan) {
      return { eligible: false, reason: "Plano não encontrado." };
    }

    const product = Array.isArray(plan.products) ? plan.products[0] : plan.products;

    // Validações de segurança — tudo no servidor
    if (!product || product.slug !== data.productSlug) {
      return { eligible: false, reason: "O plano não pertence ao produto informado." };
    }
    if (!product.is_public || product.status !== "active") {
      return { eligible: false, reason: "Produto indisponível para contratação." };
    }
    if (!plan.is_active || !plan.is_public) {
      return { eligible: false, reason: "Plano não disponível para novas assinaturas." };
    }
    if (!plan.trial_eligible) {
      return { eligible: false, reason: "Este plano não oferece período de teste gratuito." };
    }
    if (!product.trial_eligible) {
      return { eligible: false, reason: "Este produto não oferece período de teste gratuito." };
    }

    return {
      eligible: true,
      plan: {
        id: plan.id,
        name: plan.name,
        amount: plan.amount,
        trialDays: plan.trial_days ?? 7,
        billingCycle: plan.billing_cycle ?? "monthly",
      },
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
      },
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Mapeia produto do banco para tipo público seguro
// ─────────────────────────────────────────────────────────────────────────────

function mapProductToPublic(p: any): PublicProduct {
  const plans: PublicPlan[] = ((p.plans as any[]) ?? [])
    .filter((plan: any) => plan.is_active && plan.is_public)
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description ?? null,
      amount: Number(plan.amount ?? 0),
      billingCycle: plan.billing_cycle ?? "monthly",
      trialEligible: Boolean(plan.trial_eligible),
      trialDays: plan.trial_days ?? 7,
      isFeatured: Boolean(plan.is_featured),
      displayOrder: plan.display_order ?? 0,
      userLimit: plan.user_limit ?? null,
      whatsappNumberLimit: plan.whatsapp_number_limit ?? null,
      modules: ((plan.plan_modules as any[]) ?? []).map((pm: any) => {
        const mod = Array.isArray(pm.system_modules) ? pm.system_modules[0] : pm.system_modules;
        return {
          key: mod?.key ?? "",
          name: mod?.name ?? "",
          description: mod?.description ?? null,
        };
      }),
    }));

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status ?? "active",
    isPublic: Boolean(p.is_public),
    trialEligible: Boolean(p.trial_eligible),
    tagLine: p.tag_line ?? null,
    shortDescription: p.short_description ?? null,
    targetAudience: p.target_audience ?? null,
    benefits: Array.isArray(p.benefits) ? p.benefits : null,
    displayOrder: p.display_order ?? 0,
    plans,
  };
}
