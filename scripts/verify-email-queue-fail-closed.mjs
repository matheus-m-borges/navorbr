import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CARREGAMENTO E TRANSPILAÇÃO EM MEMÓRIA DO MÓDULO FAIL-CLOSED
// ─────────────────────────────────────────────────────────────────────────────

const queueSource = fs.readFileSync("src/lib/email/email-queue.server.ts", "utf8");

// Mock isolado dos imports Supabase/Provider para execução limpa sem rede ou banco
const transformedSource = queueSource
  .replace(
    /import\s+\{\s*supabaseAdmin\s*\}\s+from\s+["'][^"']+["'];?/,
    'export const supabaseAdmin = {};'
  )
  .replace(
    /import\s+\{\s*getActiveEmailProvider\s*\}\s+from\s+["'][^"']+["'];?/,
    'export const getActiveEmailProvider = async () => ({ providerName: "dev", isActive: false, send: async () => ({ success: false, errorSanitized: "EMAIL_PROVIDER_NOT_CONFIGURED", failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED", retryable: false }) });'
  );

const transpiled = ts.transpileModule(transformedSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
  },
}).outputText;

const dataUri = "data:text/javascript;base64," + Buffer.from(transpiled).toString("base64");
const queueModule = await import(dataUri);
const { decideEmailQueueTransition, processEmailQueue } = queueModule;

assert.equal(typeof decideEmailQueueTransition, "function", "decideEmailQueueTransition deve ser exportada");
assert.equal(typeof processEmailQueue, "function", "processEmailQueue deve ser exportada");

const baseItem = {
  id: "queue-item-12345",
  event_type: "welcome",
  recipient_email: "cliente@exemplo.com.br",
  account_id: "acc-111",
  subscription_id: "sub-222",
  template_data: { recipientName: "Cliente Teste" },
  attempts: 1,
  max_attempts: 3,
};

const fixedNow = new Date("2026-10-05T12:00:00.000Z");

// ─────────────────────────────────────────────────────────────────────────────
// 2. OS 12 TESTES OBRIGATÓRIOS DO BLOCO
// ─────────────────────────────────────────────────────────────────────────────

// Teste 1: provider dev nunca gera sent
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem },
    provider: { providerName: "dev", isActive: false },
    result: {
      success: false,
      errorSanitized: "EMAIL_PROVIDER_NOT_CONFIGURED",
      failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
      retryable: false,
    },
    configuredProviderName: "dev",
    now: fixedNow,
  });

  assert.notEqual(decision.status, "sent", "1. provider dev nunca pode gerar sent");
  assert.equal(decision.status, "failed", "1. provider dev deve finalizar com status failed");
  assert.equal(decision.action, "failed", "1. provider dev deve ter ação failed");
  assert.equal(decision.sent_at, null, "1. sent_at deve ser null para dev");
  assert.equal(decision.provider_message_id, null, "1. provider_message_id deve ser null para dev");
  assert.equal(decision.send_after, null, "1. send_after deve ser null para dev (não reagendar)");
}

// Teste 2: NOT_CONFIGURED termina como failed e não é reagendado
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem, attempts: 1, max_attempts: 5 },
    provider: { providerName: "resend", isActive: false },
    result: {
      success: false,
      errorSanitized: "EMAIL_PROVIDER_NOT_CONFIGURED",
      failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
      retryable: false,
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.equal(decision.status, "failed", "2. NOT_CONFIGURED deve ter status failed");
  assert.equal(decision.action, "failed", "2. NOT_CONFIGURED deve ter ação failed");
  assert.equal(decision.send_after, null, "2. NOT_CONFIGURED não pode ser reagendado (send_after = null)");
  assert.equal(decision.sent_at, null, "2. NOT_CONFIGURED sent_at deve ser null");
  assert.equal(decision.provider_message_id, null, "2. NOT_CONFIGURED provider_message_id deve ser null");
}

// Teste 3: TEMPORARY_ERROR retorna para pending enquanto houver tentativas
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem, attempts: 1, max_attempts: 3 },
    provider: { providerName: "resend", isActive: true },
    result: {
      success: false,
      errorSanitized: "HTTP 503 Service Unavailable",
      failureCode: "EMAIL_PROVIDER_TEMPORARY_ERROR",
      retryable: true,
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.equal(decision.status, "pending", "3. TEMPORARY_ERROR deve voltar para pending quando attempts < max_attempts");
  assert.equal(decision.action, "retried", "3. TEMPORARY_ERROR ação deve ser retried");
  assert.ok(decision.send_after, "3. TEMPORARY_ERROR deve calcular send_after com backoff");
  assert.equal(decision.sent_at, null, "3. TEMPORARY_ERROR sent_at deve ser null");
  assert.equal(decision.provider_message_id, null, "3. TEMPORARY_ERROR provider_message_id deve ser null");
}

// Teste 4: TEMPORARY_ERROR vira failed quando max_attempts é atingido
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem, attempts: 3, max_attempts: 3 },
    provider: { providerName: "resend", isActive: true },
    result: {
      success: false,
      errorSanitized: "HTTP 503 Service Unavailable",
      failureCode: "EMAIL_PROVIDER_TEMPORARY_ERROR",
      retryable: true,
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.equal(decision.status, "failed", "4. TEMPORARY_ERROR com tentativas esgotadas deve virar failed");
  assert.equal(decision.action, "failed", "4. TEMPORARY_ERROR com tentativas esgotadas deve ter ação failed");
  assert.equal(decision.send_after, null, "4. Não deve haver reagendamento após max_attempts atingido");
  assert.equal(decision.sent_at, null, "4. sent_at deve ser null");
  assert.equal(decision.provider_message_id, null, "4. provider_message_id deve ser null");
}

// Teste 5: REJECTED vira failed e não é reagendado
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem, attempts: 1, max_attempts: 5 },
    provider: { providerName: "resend", isActive: true },
    result: {
      success: false,
      errorSanitized: "HTTP 403 Forbidden - sender domain unverified",
      failureCode: "EMAIL_PROVIDER_REJECTED",
      retryable: false,
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.equal(decision.status, "failed", "5. REJECTED deve virar failed imediatamente");
  assert.equal(decision.action, "failed", "5. REJECTED ação deve ser failed");
  assert.equal(decision.send_after, null, "5. REJECTED nunca deve ser reagendado (send_after = null)");
  assert.equal(decision.sent_at, null, "5. REJECTED sent_at deve ser null");
  assert.equal(decision.provider_message_id, null, "5. REJECTED provider_message_id deve ser null");
}

// Teste 6: success true sem providerMessageId não gera sent
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem },
    provider: { providerName: "resend", isActive: true },
    result: {
      success: true,
      providerMessageId: "   ", // ID vazio após trim
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.notEqual(decision.status, "sent", "6. success true sem providerMessageId não pode gerar sent");
  assert.equal(decision.status, "failed", "6. success true sem providerMessageId deve falhar terminalmente (fail-closed)");
  assert.equal(decision.sent_at, null, "6. sent_at deve ser null");
  assert.equal(decision.provider_message_id, null, "6. provider_message_id deve ser null");
}

// Teste 7: success true com provider dev não gera sent
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem },
    provider: { providerName: "dev", isActive: false },
    result: {
      success: true,
      providerMessageId: "msg_fake_dev_123",
    },
    configuredProviderName: "dev",
    now: fixedNow,
  });

  assert.notEqual(decision.status, "sent", "7. provider dev com success true nunca pode gerar sent");
  assert.equal(decision.status, "failed", "7. provider dev com success true deve ser terminal failed");
  assert.equal(decision.sent_at, null, "7. sent_at deve ser null");
  assert.equal(decision.provider_message_id, null, "7. provider_message_id deve ser null");
  assert.equal(decision.send_after, null, "7. send_after deve ser null");
}

// Teste 8: retorno contraditório não gera sent
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem },
    provider: { providerName: "resend", isActive: true },
    result: {
      success: true,
      providerMessageId: "msg_resend_999",
      failureCode: "EMAIL_PROVIDER_TEMPORARY_ERROR", // Contradição: success com failureCode
      retryable: true,
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.notEqual(decision.status, "sent", "8. Retorno contraditório não pode gerar sent");
  assert.equal(decision.status, "failed", "8. Retorno contraditório deve operar fail-closed como failed");
  assert.equal(decision.sent_at, null, "8. sent_at deve ser null");
  assert.equal(decision.provider_message_id, null, "8. provider_message_id deve ser null");
}

// Teste 9: sucesso real do provider Resend com ID válido permite sent
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem },
    provider: { providerName: "resend", isActive: true },
    result: {
      success: true,
      providerMessageId: "msg_resend_valid_7890",
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.equal(decision.status, "sent", "9. Sucesso real deve gerar status sent");
  assert.equal(decision.action, "sent", "9. Sucesso real deve ter ação sent");
  assert.equal(decision.provider_message_id, "msg_resend_valid_7890", "9. provider_message_id deve ser preservado");
  assert.equal(decision.sent_at, fixedNow.toISOString(), "9. sent_at deve ser preenchido com timestamp");
  assert.equal(decision.processed_at, fixedNow.toISOString(), "9. processed_at deve ser preenchido com timestamp");
  assert.equal(decision.updated_at, fixedNow.toISOString(), "9. updated_at deve compartilhar o mesmo timestamp");
  assert.equal(decision.error_sanitized, null, "9. error_sanitized deve ser limpo para null");
  assert.equal(decision.send_after, null, "9. send_after deve ser null");
}

// Teste 9B: Resend com isActive: false NUNCA gera sent (tratado como não configurado)
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem },
    provider: { providerName: "resend", isActive: false },
    result: {
      success: true,
      providerMessageId: "msg_resend_apparent_valid_123",
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.notEqual(decision.status, "sent", "Resend inativo (isActive: false) nunca pode gerar sent");
  assert.equal(decision.status, "failed", "Resend inativo deve ser finalizado como status failed");
  assert.equal(decision.action, "failed", "Resend inativo deve ter ação failed");
  assert.equal(decision.sent_at, null, "Resend inativo deve ter sent_at null");
  assert.equal(decision.provider_message_id, null, "Resend inativo deve ter provider_message_id null");
  assert.equal(decision.send_after, null, "Resend inativo deve ter send_after null (não reagendar)");
}

// Teste 9C: Resend com isActive: true, configuração coerente e ID válido gera sent
{
  const decision = decideEmailQueueTransition({
    item: { ...baseItem },
    provider: { providerName: "resend", isActive: true },
    result: {
      success: true,
      providerMessageId: "msg_resend_active_valid_456",
    },
    configuredProviderName: "resend",
    now: fixedNow,
  });

  assert.equal(decision.status, "sent", "Resend ativo (isActive: true) com ID válido deve gerar sent");
  assert.equal(decision.action, "sent", "Ação deve ser sent");
  assert.equal(decision.provider_message_id, "msg_resend_active_valid_456", "provider_message_id deve ser preenchido");
  assert.equal(decision.sent_at, fixedNow.toISOString(), "sent_at deve ser preenchido com timestamp");
  assert.equal(decision.processed_at, fixedNow.toISOString(), "processed_at deve ser preenchido com timestamp");
  assert.equal(decision.updated_at, fixedNow.toISOString(), "updated_at deve compartilhar o mesmo timestamp");
  assert.equal(decision.send_after, null, "send_after deve ser null em sucesso");
  assert.equal(decision.error_sanitized, null, "error_sanitized deve ser null em sucesso");
}

// Teste 10: falha de update não incrementa contador de sucesso
{
  const mockClaimedItem = { ...baseItem, id: "item-fail-update-1" };
  let updateAttempted = false;

  const mockClientFailedUpdate = {
    rpc: async (fn, params) => {
      assert.equal(fn, "claim_email_queue_batch");
      return { data: [mockClaimedItem], error: null };
    },
    from: (table) => {
      assert.equal(table, "email_queue");
      return {
        update: (payload) => {
          updateAttempted = true;
          return {
            eq: (col1, val1) => ({
              eq: (col2, val2) => ({
                select: async (cols) => {
                  // Simula erro de persistência no Supabase
                  return { data: null, error: { message: "Simulated DB network failure" } };
                },
              }),
            }),
          };
        },
      };
    },
  };

  const mockResendProvider = {
    providerName: "resend",
    isActive: true,
    send: async () => ({
      success: true,
      providerMessageId: "msg_valid_but_update_will_fail",
    }),
    checkHealth: async () => ({ healthy: true, message: "ok" }),
  };

  const originalEnv = process.env["NAVOR_EMAIL_PROVIDER"];
  process.env["NAVOR_EMAIL_PROVIDER"] = "resend";

  const result = await processEmailQueue(10, {
    client: mockClientFailedUpdate,
    provider: mockResendProvider,
  });

  process.env["NAVOR_EMAIL_PROVIDER"] = originalEnv;

  assert.equal(updateAttempted, true, "10. Update deve ter sido tentado");
  assert.equal(result.claimed, 1, "10. Item foi reservado");
  assert.equal(result.sent, 0, "10. sent NÃO pode ser incrementado se o update falhar");
  assert.equal(result.failed, 0, "10. failed NÃO pode ser incrementado se o update falhar");
  assert.equal(result.retried, 0, "10. retried NÃO pode ser incrementado se o update falhar");
}

// Teste 11: falha nunca preenche sent_at
{
  const failureScenarios = [
    { name: "dev mode", provider: { providerName: "dev" }, result: { success: false, failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED" } },
    { name: "not configured", provider: { providerName: "resend" }, result: { success: false, failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED" } },
    { name: "temporary error", provider: { providerName: "resend" }, result: { success: false, failureCode: "EMAIL_PROVIDER_TEMPORARY_ERROR", retryable: true } },
    { name: "rejected", provider: { providerName: "resend" }, result: { success: false, failureCode: "EMAIL_PROVIDER_REJECTED", retryable: false } },
    { name: "exception", provider: { providerName: "resend" }, result: null },
    { name: "success without id", provider: { providerName: "resend" }, result: { success: true } },
  ];

  for (const s of failureScenarios) {
    const decision = decideEmailQueueTransition({
      item: { ...baseItem },
      provider: s.provider,
      result: s.result,
      configuredProviderName: "resend",
      now: fixedNow,
    });

    assert.equal(decision.sent_at, null, `11. ${s.name}: falha nunca pode preencher sent_at`);
  }
}

// Teste 12: falha nunca mantém ou inventa provider_message_id
{
  const fabricatedScenarios = [
    { name: "dev with fabricated id", provider: { providerName: "dev" }, result: { success: true, providerMessageId: "fabricated_dev_id" } },
    { name: "not configured with residual id", provider: { providerName: "resend" }, result: { success: false, providerMessageId: "leftover_id", failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED" } },
    { name: "rejected with id", provider: { providerName: "resend" }, result: { success: false, providerMessageId: "rejected_id", failureCode: "EMAIL_PROVIDER_REJECTED", retryable: false } },
    { name: "temporary with id", provider: { providerName: "resend" }, result: { success: false, providerMessageId: "temp_id", failureCode: "EMAIL_PROVIDER_TEMPORARY_ERROR", retryable: true } },
  ];

  for (const s of fabricatedScenarios) {
    const decision = decideEmailQueueTransition({
      item: { ...baseItem },
      provider: s.provider,
      result: s.result,
      configuredProviderName: "resend",
      now: fixedNow,
    });

    assert.equal(decision.provider_message_id, null, `12. ${s.name}: falha nunca pode manter ou inventar provider_message_id`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. VERIFICAÇÕES ESTRUTURAIS DE CÓDIGO
// ─────────────────────────────────────────────────────────────────────────────

const providerSource = fs.readFileSync("src/lib/email/email-provider.ts", "utf8");
const resendSource = fs.readFileSync("src/lib/email/resend-email-provider.ts", "utf8");
const devSource = fs.readFileSync("src/lib/email/dev-email-provider.ts", "utf8");

assert.match(providerSource, /export type EmailSendSuccess\s*=\s*\{[\s\S]*providerMessageId:\s*string/, "EmailSendSuccess deve exigir providerMessageId string");
assert.match(providerSource, /export type EmailSendFailure\s*=\s*\{[\s\S]*failureCode:\s*EmailFailureCode/, "EmailSendFailure deve conter failureCode");
assert.match(providerSource, /export type EmailSendResult\s*=\s*EmailSendSuccess\s*\|\s*EmailSendFailure/, "EmailSendResult deve ser união discriminada");

assert.match(resendSource, /Resposta HTTP 2xx do Resend sem ID válido/, "ResendEmailProvider deve rejeitar 2xx sem ID");
assert.match(devSource, /failureCode:\s*"EMAIL_PROVIDER_NOT_CONFIGURED"/, "dev provider deve ter failureCode NOT_CONFIGURED");
assert.match(devSource, /retryable:\s*false/, "dev provider deve ser retryable false");

assert.match(queueSource, /\.eq\(["']id["'],\s*item\.id\)\s*\.eq\(["']status["'],\s*["']processing["']\)/, "worker deve manter condição id + status processing");
assert.match(queueSource, /ALLOWED_REAL_PROVIDERS/, "worker deve restringir providers permitidos para entrega real");
assert.match(queueSource, /provider\.isActive\s*===\s*true/, "worker deve exigir provider.isActive === true para sucesso real");
assert.doesNotMatch(queueSource, /\.delete\(/, "worker nunca pode deletar linhas de email_queue");

console.log("All 12 email queue fail-closed checks and structural verifications passed successfully.");
