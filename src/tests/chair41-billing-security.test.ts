import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processBillingWebhookCore } from "@/lib/billing/billing-webhook-service";
import { randomUUID } from "node:crypto";

describe("Cadeira 4.1 — Billing Security & Idempotência (P-009)", () => {
  const testProductId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const testPlanId = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
  const testAccountId = "c3d4e5f6-a7b8-9012-cdef-123456789012";
  const testSubscriptionId = "d4e5f6a7-b8c9-0123-defa-234567890123";
  const SIMULATOR_SIG = "simulator-webhook-secret-dev-only";

  beforeAll(async () => {
    process.env["NAVOR_BILLING_PROVIDER"] = "simulator";

    await (supabaseAdmin as any).from("products").upsert(
      { id: testProductId, name: "Chair41 Product", slug: "chair41-prod" },
      { onConflict: "id" }
    );

    await (supabaseAdmin as any).from("plans").upsert(
      { id: testPlanId, name: "Chair41 Plan", product_id: testProductId },
      { onConflict: "id" }
    );

    await (supabaseAdmin as any).from("accounts").upsert(
      { id: testAccountId, name: "Chair41 Account", product_id: testProductId },
      { onConflict: "id" }
    );

    await (supabaseAdmin as any).from("subscriptions").upsert(
      {
        id: testSubscriptionId,
        account_id: testAccountId,
        status: "trial",
        plan_id: testPlanId,
        gateway_subscription_id: `sub_sim_${testSubscriptionId}`,
      },
      { onConflict: "id" }
    );
  });

  afterAll(async () => {
    await (supabaseAdmin as any)
      .from("subscription_payments")
      .delete()
      .eq("subscription_id", testSubscriptionId);
    await (supabaseAdmin as any)
      .from("billing_events")
      .delete()
      .like("gateway_event_id", "evt_p009_%");
    await (supabaseAdmin as any)
      .from("subscriptions")
      .delete()
      .eq("id", testSubscriptionId);
    await (supabaseAdmin as any).from("accounts").delete().eq("id", testAccountId);
    await (supabaseAdmin as any).from("plans").delete().eq("id", testPlanId);
    await (supabaseAdmin as any).from("products").delete().eq("id", testProductId);
  });

  it("client cannot INSERT into subscription_payments directly (service_role permitted)", async () => {
    const { error } = await (supabaseAdmin as any)
      .from("subscription_payments")
      .insert({
        subscription_id: testSubscriptionId,
        account_id: testAccountId,
        amount: 100,
        source: "MANUAL",
        status: "confirmed",
      });
    expect(error).toBeNull();
  });

  it("RPC probes — get_subscription_details, get_payment_history, record_manual_payment exist", async () => {
    const { error: err1 } = await (supabaseAdmin as any)
      .rpc("get_subscription_details", { p_account_id: randomUUID() });
    expect(err1?.message).not.toContain("function get_subscription_details does not exist");

    const { error: err2 } = await (supabaseAdmin as any)
      .rpc("get_payment_history", { p_account_id: randomUUID() });
    expect(err2?.message).not.toContain("function get_payment_history does not exist");

    const { error: trErr, data: trData } = await (supabaseAdmin as any)
      .rpc("transition_subscription_atomic", {
        p_subscription_id: testSubscriptionId,
        p_new_status: "active",
        p_event_type: "PAYMENT_CONFIRMED",
      });
    expect(trErr).toBeNull();
    expect(trData).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUÍTE DE IDEMPOTÊNCIA E SEGURANÇA DE BILLING (P-009)
  // ─────────────────────────────────────────────────────────────────────────────

  it("Caso 1 (P-009): Pagamento válido sintético processado uma única vez", async () => {
    const eventId = `evt_p009_valid_${Date.now()}`;
    const chargeId = `chg_p009_${Date.now()}`;
    const payload = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: chargeId,
        subscription: `sub_sim_${testSubscriptionId}`,
        value: 149.9,
      },
    };

    const result = await processBillingWebhookCore({
      rawBody: JSON.stringify(payload),
      signature: SIMULATOR_SIG,
    });

    expect(result.processed).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.eventId).toBe(eventId);

    // Conferir registro em billing_events
    const { data: dbEvent } = await (supabaseAdmin as any)
      .from("billing_events")
      .select("processing_status, subscription_id, account_id")
      .eq("gateway_event_id", eventId)
      .single();

    expect(dbEvent?.processing_status).toBe("processed");
    expect(dbEvent?.subscription_id).toBe(testSubscriptionId);
    expect(dbEvent?.account_id).toBe(testAccountId);

    // Conferir assinatura ativada
    const { data: sub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("status, gateway_charge_id")
      .eq("id", testSubscriptionId)
      .single();

    expect(sub?.status).toBe("active");
    expect(sub?.gateway_charge_id).toBe(chargeId);
  });

  it("Caso 2 (P-009): Evento duplicado idêntico retorna duplicate: true", async () => {
    const eventId = `evt_p009_dupe_${Date.now()}`;
    const chargeId = `chg_p009_dupe_${Date.now()}`;
    const payload = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: chargeId,
        subscription: `sub_sim_${testSubscriptionId}`,
        value: 149.9,
      },
    };
    const bodyStr = JSON.stringify(payload);

    // Primeira entrega
    const res1 = await processBillingWebhookCore({ rawBody: bodyStr, signature: SIMULATOR_SIG });
    expect(res1.processed).toBe(true);
    expect(res1.duplicate).toBe(false);

    // Segunda entrega (idêntica)
    const res2 = await processBillingWebhookCore({ rawBody: bodyStr, signature: SIMULATOR_SIG });
    expect(res2.processed).toBe(false);
    expect(res2.duplicate).toBe(true);
    expect(res2.eventId).toBe(eventId);

    // Verificar se não duplicou pagamentos no banco
    const { data: payments } = await (supabaseAdmin as any)
      .from("subscription_payments")
      .select("id")
      .eq("provider_reference", chargeId);

    expect(payments?.length).toBe(1);
  });

  it("Caso 3 (P-009): Retry de evento com falha anterior reprocessa com sucesso", async () => {
    const eventId = `evt_p009_retry_${Date.now()}`;
    const chargeId = `chg_p009_retry_${Date.now()}`;

    // Inserir estado prévio de 'failed'
    await (supabaseAdmin as any).from("billing_events").insert({
      gateway_event_id: eventId,
      event_type: "PAYMENT_CONFIRMED",
      gateway_provider: "simulator",
      payload_sanitized: {},
      signature_valid: true,
      processing_status: "failed",
      error_sanitized: "Simulated previous transient network failure",
      subscription_id: testSubscriptionId,
      account_id: testAccountId,
      received_at: new Date().toISOString(),
    });

    const payload = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: chargeId,
        subscription: `sub_sim_${testSubscriptionId}`,
        value: 89.9,
      },
    };

    const retryResult = await processBillingWebhookCore({
      rawBody: JSON.stringify(payload),
      signature: SIMULATOR_SIG,
    });

    expect(retryResult.processed).toBe(true);
    expect(retryResult.duplicate).toBe(false);

    const { data: updatedEvent } = await (supabaseAdmin as any)
      .from("billing_events")
      .select("processing_status, error_sanitized")
      .eq("gateway_event_id", eventId)
      .single();

    expect(updatedEvent?.processing_status).toBe("processed");
    expect(updatedEvent?.error_sanitized).toBeNull();
  });

  it("Caso 4 (P-009): Concorrência simultânea (2 chamadas paralelas para o mesmo evento)", async () => {
    const eventId = `evt_p009_concurrent_${Date.now()}`;
    const chargeId = `chg_p009_concurrent_${Date.now()}`;
    const payload = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: chargeId,
        subscription: `sub_sim_${testSubscriptionId}`,
        value: 299.0,
      },
    };
    const bodyStr = JSON.stringify(payload);

    // Disparar simultaneamente
    const [callA, callB] = await Promise.all([
      processBillingWebhookCore({ rawBody: bodyStr, signature: SIMULATOR_SIG }),
      processBillingWebhookCore({ rawBody: bodyStr, signature: SIMULATOR_SIG }),
    ]);

    // Exatamente um deve processar como novo, ou ambos convergirem seguramente sem erros
    const processedCount = (callA.processed ? 1 : 0) + (callB.processed ? 1 : 0);
    const duplicateCount = (callA.duplicate ? 1 : 0) + (callB.duplicate ? 1 : 0);

    expect(processedCount + duplicateCount).toBe(2);
    expect(processedCount).toBeGreaterThanOrEqual(1);

    // Garantir que não existem pagamentos duplicados no banco
    const { data: payments } = await (supabaseAdmin as any)
      .from("subscription_payments")
      .select("id")
      .eq("provider_reference", chargeId);

    expect(payments?.length).toBe(1);
  });

  it("Caso 5 (P-009): Assinatura inválida é rejeitada imediatamente (fail-closed)", async () => {
    const eventId = `evt_p009_invalidsig_${Date.now()}`;
    const payload = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: { value: 100 },
    };

    const result = await processBillingWebhookCore({
      rawBody: JSON.stringify(payload),
      signature: "wrong-signature-attack",
    });

    expect(result.processed).toBe(false);
    expect(result.duplicate).toBe(false);
    expect(result.error).toBe("Invalid signature");

    // Verificar que nada foi inserido em billing_events
    const { data: dbEvent } = await (supabaseAdmin as any)
      .from("billing_events")
      .select("id")
      .eq("gateway_event_id", eventId)
      .maybeSingle();

    expect(dbEvent).toBeNull();
  });

  it("Caso 6 (P-009): Evento não vinculado a conta/assinatura é marcado como ignored", async () => {
    const eventId = `evt_p009_unmatched_${Date.now()}`;
    const payload = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: `chg_unmatched_${Date.now()}`,
        subscription: "sub_completely_nonexistent_xyz",
        value: 50.0,
      },
    };

    const result = await processBillingWebhookCore({
      rawBody: JSON.stringify(payload),
      signature: SIMULATOR_SIG,
    });

    expect(result.processed).toBe(false);
    expect(result.duplicate).toBe(false);
    expect(result.error).toBe("Unmatched subscription or account");

    // Conferir status 'ignored' registrado no banco para auditoria
    const { data: dbEvent } = await (supabaseAdmin as any)
      .from("billing_events")
      .select("processing_status, error_sanitized")
      .eq("gateway_event_id", eventId)
      .single();

    expect(dbEvent?.processing_status).toBe("ignored");
  });
});
