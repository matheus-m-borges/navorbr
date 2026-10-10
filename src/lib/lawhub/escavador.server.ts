import { requireAuthenticatedAccount } from "@/core/security/authorization.server";
import { getTenantSecret } from "@/lib/security/tenant-secret-vault.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EscavadorServerResult =
  | { status: "FOUND"; data: any; provider: "escavador"; accountId: string; creditsUsed?: number }
  | { status: "CONFIGURATION_REQUIRED" | "NOT_FOUND" | "SOURCE_UNAVAILABLE" | "INVALID_RESPONSE"; message: string };

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" };
}

export async function recordProviderUsageLedger(input: {
  accountId: string;
  provider: string;
  operation: string;
  externalRequestId?: string | null;
  credits?: number;
  status: "completed" | "failed" | "reserved" | "reconciled";
  failureCode?: string | null;
  createdAt?: string;
  completedAt?: string;
}): Promise<void> {
  try {
    const idempotencyKey = crypto.randomUUID();
    await (supabaseAdmin as any).from("law_provider_usage_ledger").insert({
      account_id: input.accountId,
      provider: input.provider,
      operation: input.operation,
      external_request_id: input.externalRequestId || null,
      idempotency_key: idempotencyKey,
      credits: input.credits ?? 0,
      status: input.status,
      failure_code: input.failureCode || null,
      created_at: input.createdAt || new Date().toISOString(),
      completed_at: input.completedAt || new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[UsageLedger] Falha ao registrar log de consumo no ledger:", err);
  }
}

export async function searchEscavadorProcessServer(input: {
  userId: string;
  accountId?: string;
  cnj: string;
}): Promise<EscavadorServerResult> {
  const cnj = input.cnj.replace(/\D/g, "");
  if (cnj.length !== 20) return { status: "INVALID_RESPONSE", message: "Número CNJ inválido." };
  const { accountId } = await requireAuthenticatedAccount(input.userId, input.accountId);
  const apiKey = (await getTenantSecret(accountId, "escavador")) || process.env.ESCAVADOR_API_KEY || "";
  if (!apiKey) return { status: "CONFIGURATION_REQUIRED", message: "Credencial Escavador não configurada para a conta ativa." };

  const startTime = new Date().toISOString();
  try {
    const response = await fetch(`https://api.escavador.com/api/v2/processos/numero_cnj/${cnj}`, {
      headers: headers(apiKey),
      signal: AbortSignal.timeout(25000),
    });
    const completedTime = new Date().toISOString();
    const rawCredits = response.headers.get("Creditos-Utilizados");
    const creditsUsed = rawCredits && Number.isFinite(Number(rawCredits)) ? Number(rawCredits) : undefined;
    const externalRequestId = response.headers.get("x-request-id") || response.headers.get("cf-ray") || null;

    if (response.status === 404) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_process_by_cnj",
        externalRequestId,
        credits: creditsUsed,
        status: "completed",
        failureCode: "404_NOT_FOUND",
        createdAt: startTime,
        completedAt: completedTime,
      });
      return { status: "NOT_FOUND", message: "Processo não localizado no Escavador." };
    }

    if (!response.ok) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_process_by_cnj",
        externalRequestId,
        credits: creditsUsed,
        status: "failed",
        failureCode: `HTTP_${response.status}`,
        createdAt: startTime,
        completedAt: completedTime,
      });
      return { status: "SOURCE_UNAVAILABLE", message: `Escavador retornou HTTP ${response.status}.` };
    }

    const data = await response.json();
    if (!data || typeof data !== "object") {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_process_by_cnj",
        externalRequestId,
        credits: creditsUsed,
        status: "failed",
        failureCode: "INVALID_JSON_RESPONSE",
        createdAt: startTime,
        completedAt: completedTime,
      });
      return { status: "INVALID_RESPONSE", message: "Resposta Escavador inválida." };
    }

    await recordProviderUsageLedger({
      accountId,
      provider: "escavador",
      operation: "search_process_by_cnj",
      externalRequestId,
      credits: creditsUsed,
      status: "completed",
      failureCode: null,
      createdAt: startTime,
      completedAt: completedTime,
    });

    return { status: "FOUND", data, provider: "escavador", accountId, creditsUsed };
  } catch (error) {
    await recordProviderUsageLedger({
      accountId,
      provider: "escavador",
      operation: "search_process_by_cnj",
      status: "failed",
      failureCode: error instanceof Error ? error.message : "TIMEOUT_OR_NETWORK",
      createdAt: startTime,
      completedAt: new Date().toISOString(),
    });
    return { status: "SOURCE_UNAVAILABLE", message: error instanceof Error ? error.message : "Falha ao consultar o Escavador." };
  }
}

export { escavadorSearchProcessServerFn } from "./escavador.functions";
