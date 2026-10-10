// ============================================================================
// NAVOR CORE CONTRACTS V1 — SECRET VAULT SERVICE
// Authoritative encryption, storage, and retrieval of tenant integration secrets
// Reuses canonical Source tenant-secret-vault.server implementation.
// ============================================================================

import {
  getTenantSecret,
  getTenantSecretStatus,
  putTenantSecret,
  secretLastFour,
  type TenantIntegration,
} from "@/lib/security/tenant-secret-vault.server";
import { requireTenantAdmin } from "@/core/security/authorization.server";
import { resolveCoreAccessContext } from "./access-context-service.server";
import type { CoreUserPayload } from "./types";
import {
  CORE_CONTRACT_VERSION,
  type CoreIntegrationType,
  type CoreProductSlug,
  type CoreOperationalPurpose,
  type CoreOperationalSecretReadResponse,
  type CoreSecretReadResponse,
  type CoreSecretWriteResponse,
} from "./types";

const ALLOWED_INTEGRATIONS = new Set<CoreIntegrationType>([
  "meta_whatsapp",
  "openai",
  "gemini",
  "escavador",
  "resend",
  "datajud",
]);

const OPERATIONAL_PURPOSE_INTEGRATIONS: Readonly<Record<CoreOperationalPurpose, readonly CoreIntegrationType[]>> = {
  "meta.webhook": ["meta_whatsapp"],
};

export function isOperationalSecretCombinationAllowed(
  purpose: string,
  integration: string,
): purpose is CoreOperationalPurpose {
  return Object.prototype.hasOwnProperty.call(OPERATIONAL_PURPOSE_INTEGRATIONS, purpose)
    && (OPERATIONAL_PURPOSE_INTEGRATIONS[purpose as CoreOperationalPurpose] as readonly string[]).includes(integration);
}

function isFreshOperationalRequest(issuedAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(issuedAt);
  return Number.isFinite(timestamp) && Math.abs(now - timestamp) <= 60_000;
}

export async function readCoreOperationalIntegrationSecret(params: {
  service: string;
  purpose: string;
  integration: string;
  issuedAt: string;
  phoneNumberId?: string;
}): Promise<CoreOperationalSecretReadResponse> {
  const { service, purpose, integration, issuedAt, phoneNumberId } = params;
  if (service !== "lawhub") {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "ACCESS_DENIED", message: "Serviço operacional não autorizado." };
  }
  if (!isOperationalSecretCombinationAllowed(purpose, integration)) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "ACCESS_DENIED", message: "Purpose e integração não autorizados para leitura operacional." };
  }
  if (!isFreshOperationalRequest(issuedAt)) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "ACCESS_DENIED", message: "Contexto operacional expirado ou inválido." };
  }
  if (purpose !== "meta.webhook" || !phoneNumberId || !/^\d{8,30}$/.test(phoneNumberId)) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "VALIDATION_ERROR", message: "Identificador operacional Meta inválido." };
  }

  const { data: whatsappAccount, error: accountLookupError } = await (await import("@/integrations/supabase/client.server")).supabaseAdmin
    .from("law_whatsapp_accounts")
    .select("account_id, status, phone_number_id")
    .eq("phone_number_id", phoneNumberId)
    .eq("status", "connected")
    .maybeSingle();
  if (accountLookupError) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "CORE_UNAVAILABLE", message: `Falha ao validar contexto Meta: ${accountLookupError.message}` };
  }
  if (!whatsappAccount?.account_id || whatsappAccount.phone_number_id !== phoneNumberId) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "ACCESS_DENIED", message: "Contexto Meta não corresponde a uma integração conectada." };
  }

  const { checkCoreModuleAccess } = await import("./access-context-service.server");
  const primaryModule = await checkCoreModuleAccess({ accountId: whatsappAccount.account_id, product: "lawhub", module: "atendimento_whatsapp" });
  if (!primaryModule.ok) return primaryModule;
  if (!primaryModule.allowed) {
    const legacyModule = await checkCoreModuleAccess({ accountId: whatsappAccount.account_id, product: "lawhub", module: "call_center" });
    if (!legacyModule.ok) return legacyModule;
    if (!legacyModule.allowed) {
      return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "MODULE_DISABLED", message: "Módulo de atendimento WhatsApp não está habilitado." };
    }
  }

  try {
    const [decryptedValue, meta] = await Promise.all([
      getTenantSecret(whatsappAccount.account_id, "meta_whatsapp"),
      getTenantSecretStatus(whatsappAccount.account_id, "meta_whatsapp"),
    ]);
    if (!decryptedValue || !meta) {
      return { contractVersion: CORE_CONTRACT_VERSION, ok: true, value: null, status: "not_configured", lastFour: "••••", verifiedAt: null };
    }
    return { contractVersion: CORE_CONTRACT_VERSION, ok: true, value: decryptedValue, status: meta.status, lastFour: meta.last_four || secretLastFour(decryptedValue), verifiedAt: meta.verified_at };
  } catch (err: any) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "CORE_UNAVAILABLE", message: `Falha ao acessar cofre seguro do Core: ${err?.message || "erro interno"}` };
  }
}

export async function readCoreIntegrationSecret(params: {
  callerUser: CoreUserPayload;
  accountId: string;
  product: CoreProductSlug;
  integration: CoreIntegrationType;
}): Promise<CoreSecretReadResponse> {
  const { callerUser, accountId, product, integration } = params;

  if (product !== "lawhub") {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "PRODUCT_DISABLED",
      message: `Produto '${product}' não suportado.`,
    };
  }

  if (!ALLOWED_INTEGRATIONS.has(integration)) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "VALIDATION_ERROR",
      message: `Integração '${integration}' não permitida.`,
    };
  }

  const context = await resolveCoreAccessContext({ user: callerUser, product, requestedAccountId: accountId });
  if (!context.ok) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: context.error, message: context.message };
  }
  if (!context.capabilities.includes("core.tenant.settings.manage")) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "ACCESS_DENIED", message: "Apenas administradores do tenant podem ler credenciais de integração." };
  }

  try {
    const [decryptedValue, meta] = await Promise.all([
      getTenantSecret(accountId, integration as TenantIntegration),
      getTenantSecretStatus(accountId, integration as TenantIntegration),
    ]);

    if (!decryptedValue || !meta) {
      return {
        contractVersion: CORE_CONTRACT_VERSION,
        ok: true,
        value: null,
        status: "not_configured",
        lastFour: "••••",
        verifiedAt: null,
      };
    }

    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: true,
      value: decryptedValue,
      status: meta.status,
      lastFour: meta.last_four || secretLastFour(decryptedValue),
      verifiedAt: meta.verified_at,
    };
  } catch (err: any) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "CORE_UNAVAILABLE",
      message: `Falha ao acessar cofre seguro do Core: ${err?.message || "erro interno"}`,
    };
  }
}

export async function writeCoreIntegrationSecret(params: {
  callerUserId: string;
  accountId: string;
  product: CoreProductSlug;
  integration: CoreIntegrationType;
  value: string;
  status?: "configured" | "verified" | "error" | "revoked";
  verifiedAt?: string | null;
}): Promise<CoreSecretWriteResponse> {
  const { callerUserId, accountId, product, integration, value, status, verifiedAt } = params;

  if (product !== "lawhub") {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "PRODUCT_DISABLED",
      message: `Produto '${product}' não suportado.`,
    };
  }

  if (!ALLOWED_INTEGRATIONS.has(integration)) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "VALIDATION_ERROR",
      message: `Integração '${integration}' não permitida.`,
    };
  }

  try {
    await requireTenantAdmin(callerUserId, accountId);
  } catch (err: any) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "ACCESS_DENIED",
      message: `Permissão insuficiente para alterar credenciais do escritório: ${err?.message || ""}`,
    };
  }

  try {
    await putTenantSecret({
      accountId,
      integration: integration as TenantIntegration,
      value,
      userId: callerUserId,
      status: status || "configured",
      verifiedAt: verifiedAt || null,
    });

    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: true,
      status: status || "configured",
      lastFour: secretLastFour(value),
    };
  } catch (err: any) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "INTERNAL_ERROR",
      message: `Falha ao gravar no cofre seguro do Core: ${err?.message || "erro desconhecido"}`,
    };
  }
}
