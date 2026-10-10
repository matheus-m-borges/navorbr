import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveEmailProvider } from "@/lib/email/email-provider";
import type { EmailEventType, IEmailProvider } from "@/lib/email/email-provider";

export type QueueItem = {
  id: string;
  event_type: EmailEventType;
  recipient_email: string;
  account_id?: string | null;
  subscription_id?: string | null;
  template_data: Record<string, string | number | boolean>;
  attempts: number;
  max_attempts: number;
};

export type QueueTransitionDecision =
  | {
      action: "sent";
      status: "sent";
      provider: string;
      provider_message_id: string;
      sent_at: string;
      processed_at: string;
      send_after: null;
      error_sanitized: null;
      updated_at: string;
    }
  | {
      action: "failed";
      status: "failed";
      provider: string;
      provider_message_id: null;
      sent_at: null;
      processed_at: string;
      send_after: null;
      error_sanitized: string;
      updated_at: string;
    }
  | {
      action: "retried";
      status: "pending";
      provider: string;
      provider_message_id: null;
      sent_at: null;
      processed_at: string;
      send_after: string;
      error_sanitized: string;
      updated_at: string;
    };

export interface QueueTransitionParams {
  item: QueueItem;
  provider: {
    providerName: string;
    isActive?: boolean;
  };
  result: unknown;
  configuredProviderName?: string;
  now?: Date;
}

export function sanitizeError(error: unknown): string {
  if (!error) return "Falha não especificada no provedor";
  let message = typeof error === "string" ? error : (error as any)?.message ?? String(error);
  // Redação de segredos e normalização de espaços/quebras
  message = message
    .replace(/re_[A-Za-z0-9_]+/g, "[REDACTED_API_KEY]")
    .replace(/ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return message.slice(0, 240) || "Falha não especificada no provedor";
}

const ALLOWED_REAL_PROVIDERS = new Set(["resend"]);

export function decideEmailQueueTransition(params: QueueTransitionParams): QueueTransitionDecision {
  const { item, provider, result } = params;
  const now = params.now ?? new Date();
  const isoNow = now.toISOString();
  const configuredProvider =
    params.configuredProviderName ?? process.env["NAVOR_EMAIL_PROVIDER"] ?? "dev";

  const getSanitizedError = (fallback: string): string => {
    if (result && typeof result === "object") {
      const err = (result as any).errorSanitized;
      if (typeof err === "string" && err.trim().length > 0) {
        return sanitizeError(err);
      }
    }
    return sanitizeError(fallback);
  };

  const calculateBackoff = (attempts: number): string => {
    const delayMs = Math.min(60 * 60_000, Math.pow(2, attempts) * 60_000);
    return new Date(now.getTime() + delayMs).toISOString();
  };

  const isObjectResult = typeof result === "object" && result !== null;
  const rawSuccess = isObjectResult && (result as any).success === true;
  const rawProviderMessageId =
    isObjectResult && typeof (result as any).providerMessageId === "string"
      ? (result as any).providerMessageId.trim()
      : "";
  const rawFailureCode = isObjectResult ? (result as any).failureCode : undefined;
  const rawRetryable = isObjectResult ? (result as any).retryable : undefined;

  // Condições estritas para Sucesso Real (Matriz A)
  const isRealProvider =
    Boolean(provider?.providerName) &&
    ALLOWED_REAL_PROVIDERS.has(provider.providerName) &&
    provider.providerName !== "dev" &&
    provider.isActive === true;

  const isProviderCoherent =
    isRealProvider &&
    provider.providerName === configuredProvider;

  const hasValidMessageId = rawProviderMessageId.length > 0;
  const hasNoFailureCode = rawFailureCode === undefined;
  const hasNoRetryable = rawRetryable === undefined || rawRetryable === false;

  const isRealSuccess =
    rawSuccess &&
    isRealProvider &&
    isProviderCoherent &&
    hasValidMessageId &&
    hasNoFailureCode &&
    hasNoRetryable;

  if (isRealSuccess) {
    return {
      action: "sent",
      status: "sent",
      provider: provider.providerName,
      provider_message_id: rawProviderMessageId,
      sent_at: isoNow,
      processed_at: isoNow,
      send_after: null,
      error_sanitized: null,
      updated_at: isoNow,
    };
  }

  // --- MATRIZ FAIL-CLOSED ---

  // Matriz B: Provider não configurado, inativo ou dev
  const isNotConfigured =
    provider?.providerName === "dev" ||
    provider?.isActive !== true ||
    configuredProvider === "dev" ||
    !isRealProvider ||
    rawFailureCode === "EMAIL_PROVIDER_NOT_CONFIGURED" ||
    (isObjectResult && (result as any).errorSanitized === "EMAIL_PROVIDER_NOT_CONFIGURED");

  if (isNotConfigured) {
    return {
      action: "failed",
      status: "failed",
      provider: provider?.providerName ?? "dev",
      provider_message_id: null,
      sent_at: null,
      processed_at: isoNow,
      send_after: null,
      error_sanitized: getSanitizedError("EMAIL_PROVIDER_NOT_CONFIGURED"),
      updated_at: isoNow,
    };
  }

  // Matriz E: Retorno incoerente ou contraditório do adapter
  // Ex: success true sem providerMessageId, ou success true com failureCode, ou retorno não-objeto
  const isContradictory =
    (rawSuccess && !hasValidMessageId) ||
    (rawSuccess && !hasNoFailureCode) ||
    !isObjectResult;

  if (isContradictory) {
    return {
      action: "failed",
      status: "failed",
      provider: provider.providerName,
      provider_message_id: null,
      sent_at: null,
      processed_at: isoNow,
      send_after: null,
      error_sanitized: getSanitizedError("Retorno incoerente do provedor de e-mail"),
      updated_at: isoNow,
    };
  }

  // Matriz C: Erro Temporário (retryable)
  const isTemporary =
    rawFailureCode === "EMAIL_PROVIDER_TEMPORARY_ERROR" ||
    rawRetryable === true;

  if (isTemporary) {
    const exhausted = item.attempts >= item.max_attempts;
    if (exhausted) {
      return {
        action: "failed",
        status: "failed",
        provider: provider.providerName,
        provider_message_id: null,
        sent_at: null,
        processed_at: isoNow,
        send_after: null,
        error_sanitized: getSanitizedError("Número máximo de tentativas excedido"),
        updated_at: isoNow,
      };
    }

    return {
      action: "retried",
      status: "pending",
      provider: provider.providerName,
      provider_message_id: null,
      sent_at: null,
      processed_at: isoNow,
      send_after: calculateBackoff(item.attempts),
      error_sanitized: getSanitizedError("Erro temporário no provedor de e-mail"),
      updated_at: isoNow,
    };
  }

  // Matriz D: Rejeição ou Falha Não-Retryable (EMAIL_PROVIDER_REJECTED / retryable false)
  return {
    action: "failed",
    status: "failed",
    provider: provider.providerName,
    provider_message_id: null,
    sent_at: null,
    processed_at: isoNow,
    send_after: null,
    error_sanitized: getSanitizedError("Envio rejeitado pelo provedor de e-mail"),
    updated_at: isoNow,
  };
}

export async function processEmailQueue(
  limit = 25,
  deps?: {
    client?: any;
    provider?: IEmailProvider;
  }
): Promise<{ claimed: number; sent: number; failed: number; retried: number }> {
  const client = deps?.client ?? (supabaseAdmin as any);
  const { data, error } = await client.rpc("claim_email_queue_batch", { p_limit: limit });
  if (error) throw new Error(`Falha ao reservar fila de e-mails: ${error.message}`);

  const items = (data ?? []) as QueueItem[];
  const provider = deps?.provider ?? (await getActiveEmailProvider());
  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const item of items) {
    let result: unknown;
    try {
      result = await provider.send({
        eventType: item.event_type,
        to: item.recipient_email,
        accountId: item.account_id ?? undefined,
        subscriptionId: item.subscription_id ?? undefined,
        templateData: item.template_data,
      });
    } catch (err) {
      result = {
        success: false,
        errorSanitized: sanitizeError(err instanceof Error ? err.message : "Falha ao executar provedor de e-mail"),
        retryable: false,
      };
    }

    const decision = decideEmailQueueTransition({
      item,
      provider,
      result,
    });

    const updatePayload = {
      status: decision.status,
      provider: decision.provider,
      provider_message_id: decision.provider_message_id,
      sent_at: decision.sent_at,
      processed_at: decision.processed_at,
      send_after: decision.send_after,
      error_sanitized: decision.error_sanitized,
      updated_at: decision.updated_at,
    };

    const { data: updatedRows, error: updateError } = await client
      .from("email_queue")
      .update(updatePayload)
      .eq("id", item.id)
      .eq("status", "processing")
      .select("id");

    if (updateError) {
      console.error(`[EmailQueue] Falha ao persistir transição para item ${item.id}:`, updateError.message);
      continue;
    }

    if (!updatedRows || (Array.isArray(updatedRows) && updatedRows.length === 0)) {
      console.error(`[EmailQueue] Nenhuma linha atualizada para item ${item.id} com status processing.`);
      continue;
    }

    // Contadores são incrementados SOMENTE após confirmação da persistência
    if (decision.action === "sent") {
      sent += 1;
    } else if (decision.action === "retried") {
      retried += 1;
    } else if (decision.action === "failed") {
      failed += 1;
    }
  }

  return { claimed: items.length, sent, failed, retried };
}
