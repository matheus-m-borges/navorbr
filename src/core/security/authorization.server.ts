import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuthorizationErrorCode = "ACCOUNT_SELECTION_REQUIRED" | "ACCOUNT_ACCESS_DENIED";

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;

  constructor(code: AuthorizationErrorCode, message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestedUuid(value?: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao validar administrador da plataforma: ${error.message}`);
  return Boolean(data);
}

type Membership = { account_id: string; role: string };

/**
 * Consulta a seleção de conta persistida em private.user_account_context
 * via RPC segura exclusiva para service_role. Retorna null se não houver seleção ou em caso de erro.
 */
export type PersistedAccountContext = {
  has_context: boolean;
  account_id: string | null;
  is_valid: boolean;
};

/**
 * Consulta a seleção de conta persistida em private.user_account_context
 * via RPC segura exclusiva para service_role. Distingue NO_CONTEXT, VALID_CONTEXT e STALE_CONTEXT.
 */
export async function getPersistedUserAccountContext(userId: string): Promise<PersistedAccountContext> {
  try {
    const { data, error } = await (supabaseAdmin as any).rpc("get_user_account_context", {
      p_user_id: userId,
    });
    if (error || !data || typeof data !== "object") {
      return { has_context: false, account_id: null, is_valid: false };
    }
    const hasContext = Boolean(data.has_context);
    const accountId = typeof data.account_id === "string" && UUID_PATTERN.test(data.account_id)
      ? data.account_id
      : null;
    const isValid = Boolean(data.is_valid);
    return { has_context: hasContext, account_id: accountId, is_valid: isValid };
  } catch {
    return { has_context: false, account_id: null, is_valid: false };
  }
}

export async function resolveAuthorizedAccount(
  userId: string,
  accountId?: string | null,
  requiredRoles?: readonly string[],
  allowPlatformAdminTarget = false,
): Promise<{ membership: Membership | null; isPlatformAdmin: boolean }> {
  const requested = accountId?.trim() || null;
  if (accountId && !requestedUuid(accountId)) {
    throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
  }

  const platformAdmin = await isPlatformAdmin(userId);
  const { data, error } = await supabaseAdmin
    .from("account_members")
    .select("account_id, role")
    .eq("user_id", userId);
  if (error) throw new Error(`Falha ao validar vínculo com a conta: ${error.message}`);

  const memberships = (data ?? []) as Membership[];

  // 1. accountId explícito: validar contra memberships atuais
  if (requested) {
    const membership = memberships.find((row) => row.account_id === requested);
    if (membership) {
      if (requiredRoles && !requiredRoles.includes(membership.role)) {
        throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
      }
      return { membership, isPlatformAdmin: platformAdmin };
    }

    // REGRA NAVOR: Platform Admin NUNCA herda autoridade sobre dados de cliente sem membership explícita!
    throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
  }

  // 2. Sem accountId explícito e sem memberships -> ACCOUNT_ACCESS_DENIED
  if (memberships.length === 0) {
    throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
  }

  // 3. Sem accountId explícito: avaliar contexto persistido
  const persistedContext = await getPersistedUserAccountContext(userId);

  if (persistedContext.has_context) {
    const selectedMembership = persistedContext.account_id
      ? memberships.find((row) => row.account_id === persistedContext.account_id)
      : null;

    if (!selectedMembership) {
      // CONTEXTO STALE / REVOGADO:
      // Usuário tinha contexto A, mas A foi revogado.
      // Mesmo que agora reste apenas 1 membership (B) ou múltiplas,
      // NUNCA selecionar B automaticamente! Exigir seleção explícita.
      throw new AuthorizationError("ACCOUNT_SELECTION_REQUIRED", "ACCOUNT_SELECTION_REQUIRED");
    }

    if (requiredRoles && !requiredRoles.includes(selectedMembership.role)) {
      throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
    }

    return { membership: selectedMembership, isPlatformAdmin: platformAdmin };
  }

  // 4. Sem contexto persistido (usuário nunca selecionou contexto):
  // Se possuir exatamente 1 membership, auto-resolver com segurança
  if (memberships.length === 1) {
    const single = memberships[0];
    if (!single || (requiredRoles && !requiredRoles.includes(single.role))) {
      throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
    }
    return { membership: single, isPlatformAdmin: platformAdmin };
  }

  // Múltiplas memberships sem seleção prévia -> ACCOUNT_SELECTION_REQUIRED
  throw new AuthorizationError("ACCOUNT_SELECTION_REQUIRED", "ACCOUNT_SELECTION_REQUIRED");
}

export async function requireAuthenticatedAccount(
  userId: string,
  requestedAccountId?: string | null,
): Promise<{ accountId: string; isPlatformAdmin: boolean }> {
  const result = await resolveAuthorizedAccount(userId, requestedAccountId, undefined, false);
  if (!result.membership) {
    throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
  }
  return {
    accountId: result.membership.account_id,
    isPlatformAdmin: result.isPlatformAdmin,
  };
}

export async function requireTenantAdmin(
  userId: string,
  requestedAccountId?: string | null,
): Promise<{ accountId: string; isPlatformAdmin: boolean }> {
  const result = await resolveAuthorizedAccount(userId, requestedAccountId, ["owner", "admin"], false);
  if (!result.membership) {
    throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
  }
  return {
    accountId: result.membership.account_id,
    isPlatformAdmin: result.isPlatformAdmin,
  };
}

export async function requireAdministrativeSettingsAccount(
  userId: string,
): Promise<{ accountId: string; isPlatformAdmin: boolean }> {
  try {
    const result = await resolveAuthorizedAccount(userId, null, ["owner", "admin"], false);
    if (result.membership) {
      return { accountId: result.membership.account_id, isPlatformAdmin: result.isPlatformAdmin };
    }
  } catch (error) {
    if (!(error instanceof AuthorizationError) || error.code !== "ACCOUNT_ACCESS_DENIED") throw error;
  }

  if (await isPlatformAdmin(userId)) {
    return { accountId: "00000000-0000-0000-0000-000000000000", isPlatformAdmin: true };
  }
  throw new AuthorizationError("ACCOUNT_ACCESS_DENIED", "ACCOUNT_ACCESS_DENIED");
}
