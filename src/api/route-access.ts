import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Inclui todos os produtos do ecossistema NAVOR
export type ProductSlug = "rephub" | "lawhub" | "enghub" | "barberhub" | "pethub";
export const SUPPORTED_PRODUCT_SLUGS: readonly ProductSlug[] = [
  "rephub",
  "lawhub",
  "enghub",
  "barberhub",
  "pethub",
];
type LawHubPermissions = Record<string, boolean>;

/** Status de assinatura que permitem acesso ao produto */
const ACCESS_ALLOWED_STATUSES = ["active", "trial", "grace_period"] as const;

/** Mensagens por status de bloqueio — exibidas na página /acesso-bloqueado */
export const BLOCKED_STATUS_MESSAGES: Record<string, { title: string; description: string; action: string }> = {
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
};

function defaultLawHubPermissions(role: string): LawHubPermissions {
  if (role === "administrador") {
    return {
      isAdmin: true, accessFinanceiro: true, accessAllProcesses: true,
      accessPublicacoes: true, accessCallCenter: true, onlyCallCenter: false,
      createProcesses: true, managePublications: true, manageAgenda: true,
      useAI: true, manageClients: true, accessLeads: true, accessDocumentos: true,
    };
  }
  if (role === "atendente_callcenter") {
    return {
      isAdmin: false, accessFinanceiro: false, accessAllProcesses: false,
      accessPublicacoes: false, accessCallCenter: true, onlyCallCenter: true,
      createProcesses: false, managePublications: false, manageAgenda: false,
      useAI: false, manageClients: false, accessLeads: false, accessDocumentos: false,
    };
  }
  if (["advogado_senior", "coordenador"].includes(role)) {
    return {
      isAdmin: false, accessFinanceiro: true, accessAllProcesses: true,
      accessPublicacoes: true, accessCallCenter: false, onlyCallCenter: false,
      createProcesses: true, managePublications: true, manageAgenda: true,
      useAI: true, manageClients: true, accessLeads: true, accessDocumentos: true,
    };
  }
  if (["advogado_associado", "advogado_autonomia"].includes(role)) {
    return {
      isAdmin: false, accessFinanceiro: false, accessAllProcesses: false,
      accessPublicacoes: true, accessCallCenter: false, onlyCallCenter: false,
      createProcesses: true, managePublications: true, manageAgenda: true,
      useAI: true, manageClients: true, accessLeads: true, accessDocumentos: true,
    };
  }
  return {
    isAdmin: false, accessFinanceiro: false, accessAllProcesses: false,
    accessPublicacoes: false, accessCallCenter: false, onlyCallCenter: false,
    createProcesses: false, managePublications: false, manageAgenda: true,
    useAI: false, manageClients: false, accessLeads: false, accessDocumentos: false,
  };
}

function lawHubRouteDecision(
  role: string,
  storedPermissions: unknown,
  pathname: string,
): { routeAllowed: boolean; redirectRoute?: string } {
  const overrides =
    storedPermissions && typeof storedPermissions === "object" && !Array.isArray(storedPermissions)
      ? Object.fromEntries(
          Object.entries(storedPermissions).filter((entry): entry is [string, boolean] =>
            typeof entry[1] === "boolean",
          ),
        )
      : {};
  const p = { ...defaultLawHubPermissions(role), ...overrides };
  const fallback = p.onlyCallCenter ? "/lawhub/atendimentos" : "/lawhub/dashboard";
  const deny = () => ({ routeAllowed: false, redirectRoute: fallback });

  if (p.onlyCallCenter || role === "atendente_callcenter") {
    return pathname.startsWith("/lawhub/atendimentos")
      ? { routeAllowed: true }
      : deny();
  }
  if (pathname.startsWith("/lawhub/configuracoes") || pathname.startsWith("/lawhub/equipe"))
    return p.isAdmin ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/financeiro"))
    return p.accessFinanceiro ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/atendimentos"))
    return p.accessCallCenter ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/leads"))
    return p.accessLeads ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/processos"))
    return p.accessAllProcesses || p.createProcesses ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/agenda"))
    return p.manageAgenda || p.accessAllProcesses ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/clientes"))
    return p.manageClients ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/publicacoes"))
    return p.accessPublicacoes || p.managePublications ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/calculadora"))
    return p.accessAllProcesses || p.accessFinanceiro ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/modelos") || pathname.startsWith("/lawhub/ia"))
    return p.useAI || p.accessAllProcesses ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/documentos"))
    return p.accessAllProcesses || p.accessDocumentos ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/workflows"))
    return p.isAdmin || p.accessAllProcesses ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/relatorios") || pathname.startsWith("/lawhub/indicadores"))
    return p.isAdmin || p.accessFinanceiro || p.accessAllProcesses ? { routeAllowed: true } : deny();
  if (pathname.startsWith("/lawhub/alertas"))
    return p.isAdmin || p.accessPublicacoes || p.accessAllProcesses ? { routeAllowed: true } : deny();
  return { routeAllowed: true };
}

export const verifyProductRouteAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { product: ProductSlug; pathname?: string; accountId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!SUPPORTED_PRODUCT_SLUGS.includes(data.product)) {
      return { allowed: false, reason: "Produto inválido." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isPlatformAdmin } = await import("@/lib/security/authorization.server");
    const platformAdmin = await isPlatformAdmin(context.userId);

    const { data: memberships, error } = await supabaseAdmin
      .from("account_members")
      .select("account_id, role, product_role, permissions, accounts(id, product_id, products(slug), subscriptions(status))")
      .eq("user_id", context.userId);
    if (error) throw new Error(`Não foi possível validar o produto contratado: ${error.message}`);

    const productMemberships = (memberships ?? []).filter((row) => {
      const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
      const product = Array.isArray(account?.products) ? account?.products[0] : account?.products;
      const subscriptions = Array.isArray(account?.subscriptions)
        ? account.subscriptions
        : account?.subscriptions
          ? [account.subscriptions]
          : [];
      return (
        product?.slug === data.product &&
        subscriptions.some((subscription: { status: string }) =>
          (ACCESS_ALLOWED_STATUSES as readonly string[]).includes(subscription.status),
        )
      );
    });

    const requestedAccountId = data.accountId?.trim() || null;
    if (requestedAccountId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedAccountId)) {
      return { allowed: false, reason: "ACCOUNT_ACCESS_DENIED", routeAllowed: false };
    }
    if (requestedAccountId && !productMemberships.some((row) => row.account_id === requestedAccountId)) {
      return { allowed: false, reason: "ACCOUNT_ACCESS_DENIED", routeAllowed: false };
    }

    let scopedProductMemberships = productMemberships;
    if (requestedAccountId) {
      scopedProductMemberships = productMemberships.filter((row) => row.account_id === requestedAccountId);
    } else if (productMemberships.length > 0) {
      const { getPersistedUserAccountContext } = await import("@/core/security/authorization.server");
      const persistedContext = await getPersistedUserAccountContext(context.userId);
      if (persistedContext.has_context) {
        if (
          persistedContext.account_id &&
          productMemberships.some((row) => row.account_id === persistedContext.account_id)
        ) {
          scopedProductMemberships = productMemberships.filter(
            (row) => row.account_id === persistedContext.account_id,
          );
        } else {
          return { allowed: false, reason: "ACCOUNT_SELECTION_REQUIRED", routeAllowed: false };
        }
      } else if (productMemberships.length > 1) {
        return { allowed: false, reason: "ACCOUNT_SELECTION_REQUIRED", routeAllowed: false };
      }
    }

    if (scopedProductMemberships.length > 1) {
      return {
        allowed: false,
        reason: "ACCOUNT_SELECTION_REQUIRED",
        routeAllowed: false,
      };
    }

    const membership = scopedProductMemberships[0];

    if (!membership) {
      // Tentar encontrar assinatura bloqueada para fornecer motivo específico
      const blockedMembership = (memberships ?? []).find((row) => {
        const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
        const product = Array.isArray(account?.products) ? account?.products[0] : account?.products;
        return product?.slug === data.product;
      });

      const blockedAccount = blockedMembership
        ? (Array.isArray(blockedMembership.accounts) ? blockedMembership.accounts[0] : blockedMembership.accounts)
        : null;
      const blockedSubs = blockedAccount?.subscriptions
        ? Array.isArray(blockedAccount.subscriptions) ? blockedAccount.subscriptions : [blockedAccount.subscriptions]
        : [];
      const blockedStatus = blockedSubs[0]?.status as string | undefined;

      const blockedMsg = blockedStatus ? BLOCKED_STATUS_MESSAGES[blockedStatus] : undefined;
      return {
        allowed: false,
        subscriptionStatus: blockedStatus ?? null,
        reason: blockedMsg?.description ?? "Sua conta não possui uma assinatura ativa para este produto.",
        blockedTitle: blockedMsg?.title,
        blockedAction: blockedMsg?.action,
      };
    }

    const productRole =
      membership.product_role ||
      (["owner", "admin"].includes(membership.role) ? "administrador" : "colaborador");
    const routeDecision =
      data.product === "lawhub" && data.pathname
        ? lawHubRouteDecision(productRole, membership.permissions, data.pathname)
        : { routeAllowed: true };

   // CADEIRA 4.6 — Entitlement enforcement for admin routes
   // Platform admins bypass capability checks but NOT tenant isolation
   let entitlementDenied = false;
   let requiredCapability: string | null = null;
   if (!platformAdmin && data.pathname) {
     requiredCapability = getRequiredCapability(data.pathname);
     if (requiredCapability) {
       try {
         const check = await checkEntitlement(membership.account_id, requiredCapability);
         entitlementDenied = !check.allowed;
       } catch {
         // Fail-closed: if resolution fails, deny access
         entitlementDenied = true;
       }
     }
   }

    return {
    // CADEIRA 4.6 — DENY-first composition: any single denial blocks access.
    // routeDecision.allowed is combined with entitlement check; neither can override the other.
    allowed: !entitlementDenied && (routeDecision?.routeAllowed ?? true),
    accountId: membership.account_id,
    platformAdmin,
    productRole,
    requiredCapability,
    entitlementDenied,
    routeAllowed: routeDecision?.routeAllowed ?? true,
    redirectRoute: routeDecision?.redirectRoute,
    };
  });

export const listAccountSelectionOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { product?: ProductSlug } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("account_members")
      .select("account_id, role, accounts(id, name, product_id, products(slug, name), subscriptions(status))")
      .eq("user_id", context.userId);
    if (error) throw new Error(`Não foi possível carregar suas contas: ${error.message}`);

    return (rows ?? []).flatMap((row: any) => {
      const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
      const product = Array.isArray(account?.products) ? account.products[0] : account?.products;
      const subscriptions = Array.isArray(account?.subscriptions)
        ? account.subscriptions
        : account?.subscriptions ? [account.subscriptions] : [];
      if (!account?.id || !subscriptions.some((s: any) => (ACCESS_ALLOWED_STATUSES as readonly string[]).includes(s.status))) {
        return [];
      }
      if (data.product && product?.slug !== data.product) return [];
      return [{
        accountId: account.id,
        accountName: account.name ?? "Conta sem nome",
        productSlug: product?.slug ?? null,
        productName: product?.name ?? null,
        role: row.role,
      }];
    });
  });
 import { checkEntitlement } from "@/core/entitlements/entitlements-guard.server";

 /**
  * CADEIRA 4.6 — Entitlement enforcement map.
  * Maps route prefixes to required capability keys.
  * Platform admins bypass capability checks but NOT tenant isolation.
  */
 const ROUTE_CAPABILITY_MAP: Record<string, string> = {
   "/admin/addons": "platform.admin.addons",
   "/admin/blocos": "platform.admin.blocks",
   "/admin/capabilities": "platform.admin.capabilities",
   "/admin/planos": "platform.admin.plans",
   "/admin/produtos": "platform.admin.products",
   "/admin/contas": "platform.admin.accounts",
 };

 /**
  * Resolve required capability for a given pathname.
  * Returns null if no capability enforcement is configured.
  */
 function getRequiredCapability(pathname: string): string | null {
   for (const [prefix, cap] of Object.entries(ROUTE_CAPABILITY_MAP)) {
     if (pathname.startsWith(prefix)) return cap;
   }
   return null;
 }
