// ============================================================================
// NAVOR CORE CONTRACTS V1 — ACCESS CONTEXT SERVICE
// Authoritative resolution of accounts, memberships, products, subscriptions,
// modules, and capabilities. Reuses canonical Core logic.
// ============================================================================

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isPlatformAdmin } from "@/core/security/authorization.server";
import {
  CORE_CONTRACT_VERSION,
  type CoreAccessContextResponse,
  type CoreAccountListResponse,
  type CoreAccountOption,
  type CoreErrorResponse,
  type CoreModuleCheckResponse,
  type CoreProductSlug,
  type CoreUserPayload,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACCESS_ALLOWED_SUBSCRIPTION_STATUSES = [
  "active",
  "trial",
  "trialing",
  "grace_period",
] as const;

export const BLOCKED_STATUS_MESSAGES: Record<
  string,
  { title: string; description: string; action: string }
> = {
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

// ============================================================================
// BARBERHUB PERMISSIONS & CAPABILITIES
// ============================================================================
export function defaultBarberHubPermissions(role: string): Record<string, boolean> {
  if (role === "administrador" || role === "PROPRIETARIO") {
    return {
      isAdmin: true,
      accessAgenda: true,
      accessPDV: true,
      accessFinanceiro: true,
      accessEstoque: true,
      accessClientes: true,
      accessProfissionais: true,
      accessConfiguracoes: true,
      accessRelatorios: true,
    };
  }
  if (role === "GERENTE") {
    return {
      isAdmin: false,
      accessAgenda: true,
      accessPDV: true,
      accessFinanceiro: true,
      accessEstoque: true,
      accessClientes: true,
      accessProfissionais: true,
      accessConfiguracoes: false,
      accessRelatorios: true,
    };
  }
  if (role === "BARBEIRO") {
    return {
      isAdmin: false,
      accessAgenda: true,
      accessPDV: true,
      accessFinanceiro: false,
      accessEstoque: false,
      accessClientes: true,
      accessProfissionais: false,
      accessConfiguracoes: false,
      accessRelatorios: false,
    };
  }
  if (role === "RECEPCIONISTA") {
    return {
      isAdmin: false,
      accessAgenda: true,
      accessPDV: true,
      accessFinanceiro: false,
      accessEstoque: false,
      accessClientes: true,
      accessProfissionais: false,
      accessConfiguracoes: false,
      accessRelatorios: false,
    };
  }
  return {
    isAdmin: false,
    accessAgenda: false,
    accessPDV: false,
    accessFinanceiro: false,
    accessEstoque: false,
    accessClientes: false,
    accessProfissionais: false,
    accessConfiguracoes: false,
    accessRelatorios: false,
  };
}

export function buildBarberHubCapabilities(
  permissions: Record<string, boolean>,
  modules: string[],
): string[] {
  const caps = new Set<string>();
  if (permissions.isAdmin) {
    caps.add("barber.admin");
    caps.add("barber.all");
  }
  if (permissions.accessAgenda && modules.includes("agenda_profissionais")) caps.add("barber.agenda.manage");
  if (permissions.accessPDV && modules.includes("pdv_comandas")) caps.add("barber.pdv.operate");
  if (permissions.accessFinanceiro && modules.includes("financeiro")) caps.add("barber.finance.view");
  if (permissions.accessEstoque && modules.includes("estoque")) caps.add("barber.stock.manage");
  if (permissions.accessClientes && modules.includes("fidelidade_clientes")) caps.add("barber.clients.manage");
  if (permissions.accessProfissionais) caps.add("barber.professionals.manage");
  if (permissions.accessConfiguracoes) caps.add("barber.settings.manage");
  if (permissions.accessRelatorios) caps.add("barber.reports.view");
  return Array.from(caps);
}

export function defaultLawHubPermissions(role: string): Record<string, boolean> {
  if (role === "administrador") {
    return {
      isAdmin: true,
      accessFinanceiro: true,
      accessAllProcesses: true,
      accessPublicacoes: true,
      accessCallCenter: true,
      onlyCallCenter: false,
      createProcesses: true,
      managePublications: true,
      manageAgenda: true,
      useAI: true,
      manageClients: true,
      accessLeads: true,
      accessDocumentos: true,
    };
  }
  if (role === "atendente_callcenter") {
    return {
      isAdmin: false,
      accessFinanceiro: false,
      accessAllProcesses: false,
      accessPublicacoes: false,
      accessCallCenter: true,
      onlyCallCenter: true,
      createProcesses: false,
      managePublications: false,
      manageAgenda: false,
      useAI: false,
      manageClients: false,
      accessLeads: false,
      accessDocumentos: false,
    };
  }
  if (["advogado_senior", "coordenador"].includes(role)) {
    return {
      isAdmin: false,
      accessFinanceiro: true,
      accessAllProcesses: true,
      accessPublicacoes: true,
      accessCallCenter: false,
      onlyCallCenter: false,
      createProcesses: true,
      managePublications: true,
      manageAgenda: true,
      useAI: true,
      manageClients: true,
      accessLeads: true,
      accessDocumentos: true,
    };
  }
  if (["advogado_associado", "advogado_autonomia"].includes(role)) {
    return {
      isAdmin: false,
      accessFinanceiro: false,
      accessAllProcesses: false,
      accessPublicacoes: true,
      accessCallCenter: false,
      onlyCallCenter: false,
      createProcesses: true,
      managePublications: true,
      manageAgenda: true,
      useAI: true,
      manageClients: true,
      accessLeads: true,
      accessDocumentos: true,
    };
  }
  return {
    isAdmin: false,
    accessFinanceiro: false,
    accessAllProcesses: false,
    accessPublicacoes: false,
    accessCallCenter: false,
    onlyCallCenter: false,
    createProcesses: false,
    managePublications: false,
    manageAgenda: true,
    useAI: false,
    manageClients: false,
    accessLeads: false,
    accessDocumentos: false,
  };
}

export function buildCapabilities(
  permissions: Record<string, boolean>,
  modules: string[],
): string[] {
  const caps = new Set<string>();
  if (permissions.isAdmin) {
    caps.add("law.admin");
    caps.add("law.all");
    caps.add("core.tenant.settings.manage");
  }
  if (permissions.accessFinanceiro) caps.add("law.finance.view");
  if (permissions.accessAllProcesses) caps.add("law.processes.view");
  if (permissions.createProcesses) caps.add("law.processes.create");
  if (permissions.accessPublicacoes) caps.add("law.publications.view");
  if (permissions.managePublications) caps.add("law.publications.manage");
  if (permissions.manageAgenda) caps.add("law.agenda.manage");
  if (permissions.manageClients) caps.add("law.clients.manage");
  if (permissions.accessLeads) caps.add("law.leads.view");
  if (permissions.accessDocumentos) caps.add("law.documents.view");
  if (permissions.useAI) caps.add("law.ai.use");

  // Call Center capability ONLY if module is active on the account
  const hasCallCenterModule =
    modules.includes("call_center") || modules.includes("atendimento_whatsapp");
  if (permissions.accessCallCenter && hasCallCenterModule) {
    caps.add("law.callcenter.view");
  }

  return Array.from(caps);
}

/**
 * Consulta a seleção de conta persistida via RPC.
 * Em caso de erro de banco, timeout ou resposta malformada, lança erro para Fail-Closed (FASE 19).
 */
export async function getStrictPersistedUserAccountContext(userId: string): Promise<{
  has_context: boolean;
  account_id: string | null;
  is_valid: boolean;
}> {
  const { data, error } = await (supabaseAdmin as any).rpc("get_user_account_context", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`RPC_FAILURE: ${error.message}`);
  }
  if (!data || typeof data !== "object") {
    throw new Error("RPC_FAILURE: invalid context schema returned");
  }

  const hasContext = Boolean(data.has_context);
  const accountId =
    typeof data.account_id === "string" && UUID_PATTERN.test(data.account_id)
      ? data.account_id
      : null;
  const isValid = Boolean(data.is_valid);
  return { has_context: hasContext, account_id: accountId, is_valid: isValid };
}

export async function fetchAccountModules(accountId: string): Promise<string[]> {
  const modules = new Set<string>();

    // 1. Módulos diretos da conta
    const { data: directRows, error: directError } = await supabaseAdmin
      .from("account_modules")
      .select("module_id, system_modules!inner(key, is_active)")
      .eq("account_id", accountId)
      .eq("system_modules.is_active", true);
    if (directError) throw new Error(`MODULES_QUERY_FAILED: ${directError.message}`);

    if (Array.isArray(directRows)) {
      for (const row of directRows as any[]) {
        if (row?.system_modules?.key) {
          modules.add(row.system_modules.key);
        }
      }
    }

    // 2. Módulos via plano da assinatura
    const { data: subRows, error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select(`
        status,
        plans!inner (
          id,
          plan_modules!inner (
            system_modules!inner (key, is_active)
          )
        )
      `)
      .eq("account_id", accountId)
      .in("status", ACCESS_ALLOWED_SUBSCRIPTION_STATUSES as any);
    if (subscriptionError) throw new Error(`PLAN_MODULES_QUERY_FAILED: ${subscriptionError.message}`);

    if (Array.isArray(subRows)) {
      for (const subRow of subRows as any[]) {
        const planMods = subRow?.plans?.plan_modules;
        if (Array.isArray(planMods)) {
          for (const pm of planMods) {
            if (pm?.system_modules?.key && pm.system_modules.is_active) {
              modules.add(pm.system_modules.key);
            }
          }
        }
      }
    }
  return Array.from(modules);
}

export async function resolveCoreAccessContext(params: {
  user: CoreUserPayload;
  product: CoreProductSlug;
  requestedAccountId?: string | null;
}): Promise<CoreAccessContextResponse> {
  const { user, product, requestedAccountId } = params;

  // Multi-product support: validate against known slugs
  const VALID_PRODUCTS: CoreProductSlug[] = ["lawhub", "rephub", "enghub", "barberhub", "pethub"];
  if (!VALID_PRODUCTS.includes(product)) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "PRODUCT_DISABLED",
      message: `Produto '${product}' não suportado neste contrato.`,
    };
  }

  let platformAdmin = false;
  try {
    platformAdmin = await isPlatformAdmin(user.id);
  } catch (err: any) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "RPC_FAILURE",
      message: `Falha ao validar privilégio de plataforma: ${err?.message || "erro desconhecido"}`,
    };
  }

  // Buscar memberships com contas, produtos e assinaturas
  const { data: memberships, error: memError } = await supabaseAdmin
    .from("account_members")
    .select(
      "account_id, role, product_role, permissions, accounts(id, name, product_id, products(id, slug, name), subscriptions(id, status, plan_id))",
    )
    .eq("user_id", user.id);

  if (memError) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "RPC_FAILURE",
      message: `Falha ao consultar memberships: ${memError.message}`,
    };
  }

  const allMemberships = (memberships ?? []) as any[];

  // Filtrar memberships que correspondem ao produto lawhub
  const productMemberships = allMemberships.filter((row) => {
    const acc = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    const prod = Array.isArray(acc?.products) ? acc?.products[0] : acc?.products;
    return prod?.slug === product;
  });

  const requested = requestedAccountId?.trim() || null;
  if (requested && !UUID_PATTERN.test(requested)) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "ACCESS_DENIED",
      message: "Formato de accountId solicitado inválido.",
    };
  }

  // 1. Se accountId for explicitamente solicitado
  if (requested) {
    const matched = productMemberships.find((m) => m.account_id === requested);
    if (!matched) {
      // REGRA NAVOR: Platform Admin NUNCA herda autoridade sobre conta de cliente sem membership explícita.
      return {
        contractVersion: CORE_CONTRACT_VERSION,
        ok: false,
        error: "ACCESS_DENIED",
        message: "Usuário não possui vínculo autorizado com a conta solicitada.",
      };
    }

    return buildSuccessfulContext(user, matched, platformAdmin);
  }

  // 2. Sem accountId solicitado e sem memberships para este produto
  if (productMemberships.length === 0) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "ACCESS_DENIED",
      message: "Usuário não possui vínculo com nenhuma conta do produto.",
    };
  }

  // 3. Consultar contexto persistido via RPC estrita
  let persistedContext;
  try {
    persistedContext = await getStrictPersistedUserAccountContext(user.id);
  } catch (err: any) {
    // FAIL-CLOSED em falha de RPC (FASE 19)
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "RPC_FAILURE",
      message: `Falha na verificação de contexto persistido: ${err?.message || "erro de RPC"}`,
    };
  }

  if (persistedContext.has_context) {
    const selectedMembership = persistedContext.account_id
      ? productMemberships.find((m) => m.account_id === persistedContext.account_id)
      : null;

    if (!selectedMembership) {
      // Se a conta anterior pertencia a outro produto (ex: RepHub vs LawHub),
      // e o usuário possui EXATAMENTE 1 conta neste produto, auto-seleciona com segurança!
      if (productMemberships.length === 1) {
        return buildSuccessfulContext(user, productMemberships[0], platformAdmin);
      }
      return {
        contractVersion: CORE_CONTRACT_VERSION,
        ok: false,
        error: "ACCOUNT_SELECTION_REQUIRED",
        message: "Usuário possui múltiplos escritórios. Selecione uma conta para continuar.",
        requiresAccountSelection: true,
      };
    }

    return buildSuccessfulContext(user, selectedMembership, platformAdmin);
  }

  // 4. Sem contexto prévio
  // Se possuir exatamente 1 membership para o produto, auto-resolver
  if (productMemberships.length === 1) {
    return buildSuccessfulContext(user, productMemberships[0], platformAdmin);
  }

  // Múltiplas memberships sem seleção -> seleção obrigatória
  return {
    contractVersion: CORE_CONTRACT_VERSION,
    ok: false,
    error: "ACCOUNT_SELECTION_REQUIRED",
    message: "Usuário possui múltiplos escritórios. Selecione uma conta para continuar.",
    requiresAccountSelection: true,
  };
}

async function buildSuccessfulContext(
  user: CoreUserPayload,
  membershipRow: any,
  isPlatformAdmin: boolean,
): Promise<CoreAccessContextResponse> {
  const account = Array.isArray(membershipRow.accounts)
    ? membershipRow.accounts[0]
    : membershipRow.accounts;
  const product = Array.isArray(account?.products)
    ? account.products[0]
    : account?.products;
  const subscriptions = Array.isArray(account?.subscriptions)
    ? account.subscriptions
    : account?.subscriptions
      ? [account.subscriptions]
      : [];

  const activeSub = subscriptions.find((s: any) =>
    (ACCESS_ALLOWED_SUBSCRIPTION_STATUSES as readonly string[]).includes(s.status),
  );

  if (!activeSub) {
    const blockedStatus = subscriptions[0]?.status as string | undefined;
    const blockedInfo = blockedStatus ? BLOCKED_STATUS_MESSAGES[blockedStatus] : undefined;
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "SUBSCRIPTION_INACTIVE",
      subscriptionStatus: blockedStatus ?? null,
      message:
        blockedInfo?.description ??
        "Sua conta não possui uma assinatura ativa para este produto.",
      blockedTitle: blockedInfo?.title,
      blockedAction: blockedInfo?.action,
    };
  }

  const role = membershipRow.role;
  const productRole =
    membershipRow.product_role ||
    (["owner", "admin"].includes(role) ? "administrador" : "colaborador");

  // Multi-product: select product-specific permission builder
  const productSlug = (product as any)?.slug ?? "lawhub";
  const defaultPerms = productSlug === "barberhub"
    ? defaultBarberHubPermissions(productRole)
    : defaultLawHubPermissions(productRole);
  const customPerms =
    membershipRow.permissions && typeof membershipRow.permissions === "object"
      ? membershipRow.permissions
      : {};
  const resolvedPermissions = { ...defaultPerms, ...customPerms };

  let modules: string[];
  try { modules = await fetchAccountModules(membershipRow.account_id); } catch (err: any) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "CORE_UNAVAILABLE", message: err?.message || "Falha ao resolver módulos." };
  }
  const capabilities = productSlug === "barberhub"
    ? buildBarberHubCapabilities(resolvedPermissions, modules)
    : buildCapabilities(resolvedPermissions, modules);

  return {
    contractVersion: CORE_CONTRACT_VERSION,
    ok: true,
    user,
    account: {
      id: account.id,
      name: account.name ?? "Escritório Jurídico",
    },
    membership: {
      role,
      productRole,
    },
    product: {
      id: product?.id ?? "",
      key: "lawhub",
      name: product?.name ?? "Navor LawHub",
    },
    subscription: {
      id: activeSub.id,
      status: activeSub.status,
      planId: activeSub.plan_id ?? null,
    },
    modules,
    capabilities,
    productRole,
    permissions: resolvedPermissions,
    isPlatformAdmin,
    requiresAccountSelection: false,
  };
}

export async function listCoreAccountsForProduct(params: {
  userId: string;
  product?: CoreProductSlug;
}): Promise<CoreAccountListResponse> {
  const { userId, product = "lawhub" } = params;

  const { data: rows, error } = await supabaseAdmin
    .from("account_members")
    .select(
      "account_id, role, accounts(id, name, product_id, products(slug, name), subscriptions(status))",
    )
    .eq("user_id", userId);

  if (error) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "RPC_FAILURE",
      message: `Não foi possível carregar contas: ${error.message}`,
    };
  }

  const accounts: CoreAccountOption[] = [];

  for (const row of (rows ?? []) as any[]) {
    const acc = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    const prod = Array.isArray(acc?.products) ? acc.products[0] : acc?.products;
    const subs = Array.isArray(acc?.subscriptions)
      ? acc.subscriptions
      : acc?.subscriptions
        ? [acc.subscriptions]
        : [];

    const activeSub = subs.find((s: any) =>
      (ACCESS_ALLOWED_SUBSCRIPTION_STATUSES as readonly string[]).includes(s.status),
    );

    if (!acc?.id || !activeSub) continue;
    if (product && prod?.slug !== product) continue;

    accounts.push({
      accountId: acc.id,
      accountName: acc.name ?? "Conta sem nome",
      productSlug: prod?.slug ?? null,
      productName: prod?.name ?? null,
      role: row.role,
      subscriptionStatus: activeSub.status,
    });
  }

  return {
    contractVersion: CORE_CONTRACT_VERSION,
    ok: true,
    accounts,
  };
}

export async function selectCoreAccountContext(params: {
  userId: string;
  userBearerToken: string;
  accountId: string;
  product?: CoreProductSlug;
}): Promise<CoreAccessContextResponse> {
  const { userId, userBearerToken, accountId, product = "lawhub" } = params;

  if (!UUID_PATTERN.test(accountId)) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Formato de accountId inválido.",
    };
  }

  // Validar se o usuário possui membership nessa conta ou é platform admin
  const admin = await isPlatformAdmin(userId);
  const { data: mem } = await supabaseAdmin
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (!mem && !admin) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "ACCESS_DENIED",
      message: "Usuário não possui acesso à conta selecionada.",
    };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "CORE_UNAVAILABLE", message: "Cliente autenticado para persistir contexto não está configurado." };
  }
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${userBearerToken}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { error: persistError } = await userClient.rpc("set_current_account_id", { p_account_id: accountId });
  if (persistError) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "RPC_FAILURE", message: `Não foi possível persistir a conta selecionada: ${persistError.message}` };
  }
  try {
    const persisted = await getStrictPersistedUserAccountContext(userId);
    if (!persisted.has_context || persisted.account_id !== accountId || !persisted.is_valid) {
      return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "RPC_FAILURE", message: "O contexto selecionado não foi confirmado após a persistência." };
    }
  } catch (err: any) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "RPC_FAILURE", message: err?.message || "Falha ao confirmar contexto persistido." };
  }

  // Retornar novo contexto atualizado
  return resolveCoreAccessContext({
    user: { id: userId, email: null },
    product,
    requestedAccountId: accountId,
  });
}

export async function checkCoreModuleAccess(params: {
  accountId: string;
  product: CoreProductSlug;
  module: string;
}): Promise<CoreModuleCheckResponse> {
  const { accountId, product, module } = params;
  if (!UUID_PATTERN.test(accountId)) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Formato de accountId inválido.",
    };
  }

  if (product !== "lawhub") return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "PRODUCT_DISABLED", message: "Produto não suportado neste contrato." };
  const { data: account, error } = await supabaseAdmin.from("accounts").select("id, products!inner(slug), subscriptions(status)").eq("id", accountId).maybeSingle();
  if (error) return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "CORE_UNAVAILABLE", message: error.message };
  const acc: any = account;
  const accountProduct = Array.isArray(acc?.products) ? acc.products[0] : acc?.products;
  const subscriptions = Array.isArray(acc?.subscriptions) ? acc.subscriptions : acc?.subscriptions ? [acc.subscriptions] : [];
  if (!acc || accountProduct?.slug !== "lawhub" || !subscriptions.some((s: any) => (ACCESS_ALLOWED_SUBSCRIPTION_STATUSES as readonly string[]).includes(s.status))) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "SUBSCRIPTION_INACTIVE", message: "Conta LawHub sem assinatura ativa." };
  }
  let modules: string[];
  try { modules = await fetchAccountModules(accountId); } catch (err: any) { return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "CORE_UNAVAILABLE", message: err?.message || "Falha ao resolver módulos." }; }
  const allowed =
    modules.includes(module) ||
    (module === "call_center" && modules.includes("atendimento_whatsapp")) ||
    (module === "atendimento_whatsapp" && modules.includes("call_center"));

  return {
    contractVersion: CORE_CONTRACT_VERSION,
    ok: true,
    allowed,
    module,
  };
}
