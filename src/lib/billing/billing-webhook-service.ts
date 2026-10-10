/**
 * NAVOR SaaS — Serviço Central de Processamento de Webhooks de Billing
 * 
 * Camada oficial de negócio para recepção e reconciliação idempotente de webhooks
 * de provedores de faturamento (Asaas, Simulador, etc.).
 * 
 * SEGURANÇA:
 * - Validação estrita de assinatura pelo provedor ativo (fail-closed).
 * - Identificação determinística de assinaturas por gateway_sub_id, gateway_charge_id, externalReference.
 * - Idempotência em 3 níveis:
 *   1. Verificação prévia de eventos já processados (processing_status === 'processed').
 *   2. Tratamento de concorrência simultânea via banco / unique constraint (23505).
 *   3. UPSERT em subscription_payments com constraint única anti-duplicação.
 * - Transição de status atômica (transition_subscription_atomic).
 */

export interface WebhookProcessResult {
  processed: boolean;
  duplicate: boolean;
  eventId: string | null;
  error?: string;
}

/**
 * Processa um payload bruto de webhook de billing de forma segura e idempotente.
 */
export async function processBillingWebhookCore(data: {
  rawBody: string;
  signature: string;
}): Promise<WebhookProcessResult> {
  const { rawBody, signature } = data;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getActiveBillingProvider } = await import("@/lib/billing/billing-provider");
  const provider = await getActiveBillingProvider();
  const validation = await provider.validateWebhook(rawBody, signature);

  if (!validation.valid || !validation.eventId) {
    return { processed: false, duplicate: false, eventId: null, error: "Invalid signature" };
  }

  const { eventId, eventType, sanitizedPayload } = validation;

  // 1. Extrair identificadores do gateway
  const payment = (sanitizedPayload?.payment ?? {}) as Record<string, unknown>;
  const gatewayChargeId =
    typeof payment.id === "string"
      ? payment.id
      : typeof sanitizedPayload?.id === "string"
      ? sanitizedPayload.id
      : null;
  const gatewaySubId = typeof payment.subscription === "string" ? payment.subscription : null;
  const gatewayCustomerId = typeof payment.customer === "string" ? payment.customer : null;
  const externalRef = typeof payment.externalReference === "string" ? payment.externalReference : null;

  // 2. Resolver subscription_id e account_id
  let targetSubscriptionId: string | null = null;
  let targetAccountId: string | null = null;

  if (gatewaySubId) {
    const { data: sub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("id, account_id")
      .eq("gateway_subscription_id", gatewaySubId)
      .maybeSingle();
    if (sub) {
      targetSubscriptionId = sub.id;
      targetAccountId = sub.account_id;
    }
  }

  if (!targetSubscriptionId && gatewayChargeId) {
    const { data: sub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("id, account_id")
      .eq("gateway_charge_id", gatewayChargeId)
      .maybeSingle();
    if (sub) {
      targetSubscriptionId = sub.id;
      targetAccountId = sub.account_id;
    }
  }

  if (!targetSubscriptionId && externalRef) {
    const { data: subById } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("id, account_id")
      .eq("id", externalRef)
      .maybeSingle();
    if (subById) {
      targetSubscriptionId = subById.id;
      targetAccountId = subById.account_id;
    } else {
      const { data: subByAcc } = await (supabaseAdmin as any)
        .from("subscriptions")
        .select("id, account_id")
        .eq("account_id", externalRef)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subByAcc) {
        targetSubscriptionId = subByAcc.id;
        targetAccountId = subByAcc.account_id;
      }
    }
  }

  if (!targetSubscriptionId && gatewayCustomerId) {
    const { data: subByCust } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("id, account_id")
      .eq("gateway_customer_id", gatewayCustomerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subByCust) {
      targetSubscriptionId = subByCust.id;
      targetAccountId = subByCust.account_id;
    }
  }

  // 3. IDEMPOTÊNCIA: Checar se o evento já existe
  const { data: existingEvent } = await (supabaseAdmin as any)
    .from("billing_events")
    .select("id, subscription_id, account_id, processing_status")
    .eq("gateway_provider", provider.providerName)
    .eq("gateway_event_id", eventId)
    .maybeSingle();

  if (existingEvent && existingEvent.processing_status === "processed") {
    return { processed: false, duplicate: true, eventId };
  }

  let eventDbId = existingEvent?.id;

  if (existingEvent) {
    // Retry de evento pendente ou com falha prévia: atualiza registro sem tentar insert duplicado
    const { error: updateErr } = await (supabaseAdmin as any)
      .from("billing_events")
      .update({
        processing_status: "pending",
        received_at: new Date().toISOString(),
        payload_sanitized: sanitizedPayload ?? {},
        subscription_id: targetSubscriptionId ?? existingEvent.subscription_id,
        account_id: targetAccountId ?? existingEvent.account_id,
        error_sanitized: null,
      })
      .eq("id", existingEvent.id);

    if (updateErr) {
      console.error("[BillingWebhook] Erro ao atualizar evento existente:", updateErr.message);
      return { processed: false, duplicate: false, eventId, error: updateErr.message };
    }
  } else {
    // Inserir novo evento com status 'pending' (válido no check constraint)
    const { data: inserted, error: insertError } = await (supabaseAdmin as any)
      .from("billing_events")
      .insert({
        gateway_event_id: eventId,
        event_type: eventType ?? "UNKNOWN",
        gateway_provider: provider.providerName,
        payload_sanitized: sanitizedPayload ?? {},
        signature_valid: true,
        processing_status: "pending",
        received_at: new Date().toISOString(),
        subscription_id: targetSubscriptionId,
        account_id: targetAccountId,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      const isUniqueViolation =
        insertError.code === "23505" ||
        insertError.message?.includes("duplicate key") ||
        insertError.message?.includes("23505");

      if (isUniqueViolation) {
        // Concorrência: outro worker inseriu no mesmo instante.
        // Aguarda a convergência do worker ativo para confirmar status processed
        for (let attempt = 0; attempt < 6; attempt++) {
          await new Promise((r) => setTimeout(r, 150));
          const { data: concurrentEvent } = await (supabaseAdmin as any)
            .from("billing_events")
            .select("id, processing_status")
            .eq("gateway_provider", provider.providerName)
            .eq("gateway_event_id", eventId)
            .maybeSingle();

          if (concurrentEvent?.processing_status === "processed") {
            return { processed: false, duplicate: true, eventId };
          }
        }
        // Se ainda não transicionou, outro worker assumiu a execução concorrente
        return { processed: false, duplicate: true, eventId };
      }
      console.error("[BillingWebhook] Erro ao registrar evento:", insertError.message);
      return { processed: false, duplicate: false, eventId, error: insertError.message };
    }

    eventDbId = inserted?.id;
  }

  // 4. Execução da regra de negócio por tipo de evento
  try {
    const isPaymentConfirmed =
      eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED";

    if (isPaymentConfirmed) {
      if (!targetSubscriptionId || !targetAccountId) {
        // Evento financeiro não vinculado a nenhuma conta conhecida
        await (supabaseAdmin as any)
          .from("billing_events")
          .update({
            processing_status: "ignored",
            error_sanitized: "Unmatched subscription or account for payment event",
            processed_at: new Date().toISOString(),
          })
          .eq("gateway_provider", provider.providerName)
          .eq("gateway_event_id", eventId);

        return {
          processed: false,
          duplicate: false,
          eventId,
          error: "Unmatched subscription or account",
        };
      }

      const amountCents =
        typeof payment.value === "number" ? Math.round(payment.value * 100) : 0;
      const amountUnits = amountCents / 100;
      const chargeRef = gatewayChargeId || eventId;

      // 4.1 Tentar RPC atômico se disponível no schema cache
      let bridgeCompleted = false;
      try {
        const bridgeResult = await (supabaseAdmin as any).rpc("process_billing_event_atomic", {
          p_event_id: eventDbId,
          p_gateway_charge_id: chargeRef,
          p_subscription_id: targetSubscriptionId,
          p_account_id: targetAccountId,
          p_amount_cents: amountCents,
          p_currency: "BRL",
          p_event_type: eventType,
          p_paid_at: new Date().toISOString(),
        });
        if (!bridgeResult.error) {
          bridgeCompleted = true;
        }
      } catch {
        bridgeCompleted = false;
      }

      // 4.2 Fallback resiliente: registrar em subscription_payments (com índice único anti-duplicação)
      if (!bridgeCompleted) {
        const { data: existingPayment } = await (supabaseAdmin as any)
          .from("subscription_payments")
          .select("id")
          .eq("provider", provider.providerName)
          .eq("provider_reference", chargeRef)
          .maybeSingle();

        if (!existingPayment) {
          const { error: payErr } = await (supabaseAdmin as any)
            .from("subscription_payments")
            .insert({
              subscription_id: targetSubscriptionId,
              account_id: targetAccountId,
              amount: amountUnits,
              currency: "BRL",
              status: "confirmed",
              provider: provider.providerName,
              provider_reference: chargeRef,
              source: "PROVIDER",
              paid_at: new Date().toISOString(),
            });

          if (payErr && !payErr.message.includes("duplicate") && payErr.code !== "23505") {
            throw new Error(`Failed to record subscription payment: ${payErr.message}`);
          }
        }
      }

      // 4.3 Atualizar status da assinatura para active
      await (supabaseAdmin as any).rpc("transition_subscription_atomic", {
        p_subscription_id: targetSubscriptionId,
        p_new_status: "active",
        p_event_type: eventType,
      });

      // 4.4 Atualizar timestamps e charge na própria assinatura
      await (supabaseAdmin as any)
        .from("subscriptions")
        .update({
          status: "active",
          last_payment_status: "confirmed",
          gateway_charge_id: chargeRef,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetSubscriptionId);
    } else if (eventType === "PAYMENT_OVERDUE") {
      if (targetSubscriptionId) {
        await (supabaseAdmin as any).rpc("transition_subscription_atomic", {
          p_subscription_id: targetSubscriptionId,
          p_new_status: "past_due",
          p_event_type: eventType,
        });
      }
    } else if (
      eventType === "PAYMENT_DELETED" ||
      eventType === "SUBSCRIPTION_DELETED" ||
      eventType === "SUBSCRIPTION_CANCELED"
    ) {
      if (targetSubscriptionId) {
        await (supabaseAdmin as any).rpc("transition_subscription_atomic", {
          p_subscription_id: targetSubscriptionId,
          p_new_status: "canceled",
          p_event_type: eventType,
        });
      }
    }

    // 5. Marcar evento como processado
    await (supabaseAdmin as any)
      .from("billing_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        error_sanitized: null,
      })
      .eq("gateway_provider", provider.providerName)
      .eq("gateway_event_id", eventId);

    return { processed: true, duplicate: false, eventId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[BillingWebhook] Falha ao processar evento ${eventId}:`, errorMessage);

    await (supabaseAdmin as any)
      .from("billing_events")
      .update({
        processing_status: "failed",
        error_sanitized: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq("gateway_provider", provider.providerName)
      .eq("gateway_event_id", eventId);

    return { processed: false, duplicate: false, eventId, error: errorMessage };
  }
}
