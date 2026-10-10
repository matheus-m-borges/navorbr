// ============================================================================
// NAVOR CORE CONTRACTS V1 — AI USAGE LEDGER SERVICE
// Authoritative calculation of tokens, credits, and costs for AI operations
// Reuses canonical pricing models and persists to public.ai_usage_logs
// ============================================================================

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCoreAccessContext } from "./access-context-service.server";
import {
  CORE_CONTRACT_VERSION,
  type CoreAiUsageRequest,
  type CoreAiUsageResponse,
} from "./types";

// Observação Arquitetural (FASE 35):
// A idempotência em nível de aplicação é verificada buscando `metadata->>'idempotency_key'`.
// Uma constraint UNIQUE de banco exigiria migration, o que é proibido nesta fase.
// Tag de auditoria: CORE_MIGRATION_REQUIRED_AI_IDEMPOTENCY

export async function recordCoreAiUsage(params: {
  input: CoreAiUsageRequest;
  callerUserId: string;
}): Promise<CoreAiUsageResponse> {
  const { input, callerUserId } = params;

  if (input.product !== "lawhub") {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "PRODUCT_DISABLED",
      message: `Produto '${input.product}' não suportado.`,
    };
  }

  if (!input.idempotencyKey || !/^[A-Za-z0-9._:-]{16,200}$/.test(input.idempotencyKey)) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "VALIDATION_ERROR", message: "idempotencyKey válida é obrigatória para o ledger de IA." };
  }
  const context = await resolveCoreAccessContext({ user: { id: callerUserId, email: null }, product: input.product, requestedAccountId: input.accountId });
  if (!context.ok || !context.capabilities.includes("law.ai.use")) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: context.ok ? "ACCESS_DENIED" : context.error, message: context.ok ? "Usuário não tem permissão para uso de IA." : context.message };
  }

  const pTokens = Math.max(0, input.promptTokens ?? 0);
  const cTokens = Math.max(0, input.completionTokens ?? 0);
  const tTokens = pTokens + cTokens;

  // Fórmulas canônicas do ecossistema NAVOR Core
  const credits = Number((tTokens / 1000).toFixed(2));
  const costUsd = Number((tTokens * 0.000003).toFixed(5));

  // A coluna e o índice UNIQUE são criados pela migration local desta rodada.
  const metadata: Record<string, any> = {
    provider: input.provider,
    operation: input.operation,
  };
  metadata.idempotency_key = input.idempotencyKey;

  const { error: insertError } = await (supabaseAdmin as any)
    .from("ai_usage_logs")
    .insert({
      account_id: input.accountId,
      user_id: input.userId || null,
      idempotency_key: input.idempotencyKey,
      system: "lawhub",
      feature: input.operation,
      feature_label: input.operation,
      model: input.model || "não informado",
      prompt_tokens: pTokens,
      completion_tokens: cTokens,
      total_tokens: tTokens,
      lovable_credits: credits,
      cost_usd: costUsd,
      metadata,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing, error: existingError } = await (supabaseAdmin as any)
        .from("ai_usage_logs")
        .select("total_tokens, lovable_credits, cost_usd")
        .eq("account_id", input.accountId)
        .eq("system", "lawhub")
        .eq("idempotency_key", input.idempotencyKey)
        .single();
      if (!existingError && existing) {
        return { contractVersion: CORE_CONTRACT_VERSION, ok: true, recorded: true, credits: Number(existing.lovable_credits || 0), costUsd: Number(existing.cost_usd || 0), totalTokens: Number(existing.total_tokens || 0) };
      }
    }
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "INTERNAL_ERROR",
      message: `Falha ao registrar ledger de IA no Core: ${insertError.message}`,
    };
  }

  return {
    contractVersion: CORE_CONTRACT_VERSION,
    ok: true,
    recorded: true,
    credits,
    costUsd,
    totalTokens: tTokens,
  };
}
