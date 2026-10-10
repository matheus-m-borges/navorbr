/**
 * NAVOR SaaS — SimulatorBillingProvider
 *
 * Provedor de billing para testes locais e desenvolvimento.
 * Simula o comportamento de um gateway real SEM fazer chamadas externas.
 *
 * SEGURANÇA:
 * - Este provedor NUNCA deve ser usado em produção.
 * - Ativar apenas com NAVOR_BILLING_PROVIDER=simulator e NODE_ENV !== 'production'.
 * - Gera IDs determinísticos baseados em timestamp para facilitar debugging.
 * - Webhooks simulados são sempre válidos (assinatura fixa "simulator-secret").
 */

import type {
  IBillingProvider,
  BillingCustomer,
  BillingSubscriptionInput,
  BillingChargeResult,
  BillingWebhookValidation,
} from "./billing-provider";

const SIMULATOR_WEBHOOK_SECRET = "simulator-webhook-secret-dev-only";

export class SimulatorBillingProvider implements IBillingProvider {
  readonly providerName = "simulator" as const;
  readonly isActive: boolean;

  constructor() {
    const isDev = process.env["NODE_ENV"] !== "production";
    this.isActive = isDev;
    if (!isDev) {
      console.warn(
        "[SimulatorBillingProvider] ATENÇÃO: Simulator ativado fora de ambiente de desenvolvimento. " +
        "Isso é inseguro e não deve ocorrer em produção."
      );
    }
  }

  async createOrUpdateCustomer(customer: BillingCustomer): Promise<{ gatewayCustomerId: string }> {
    // ID determinístico baseado no accountId para consistência entre reinícios
    const gatewayCustomerId = `sim_cust_${customer.accountId.replace(/-/g, "").slice(0, 12)}`;
    console.log(`[SimulatorBillingProvider] createOrUpdateCustomer: ${gatewayCustomerId} para account ${customer.accountId}`);
    return { gatewayCustomerId };
  }

  async createSubscription(input: BillingSubscriptionInput): Promise<{
    gatewaySubscriptionId: string;
    firstCharge?: BillingChargeResult;
  }> {
    const ts = Date.now();
    const gatewaySubscriptionId = `sim_sub_${ts}`;
    const gatewayChargeId = `sim_chg_${ts}`;

    console.log(`[SimulatorBillingProvider] createSubscription: ${gatewaySubscriptionId} para customer ${input.gatewayCustomerId}`);

    const firstCharge: BillingChargeResult = {
      gatewayChargeId,
      status: "pending",
      paymentUrl: `http://localhost:5173/simulator/checkout/${gatewayChargeId}`,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 dias
    };

    return { gatewaySubscriptionId, firstCharge };
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    console.log(`[SimulatorBillingProvider] cancelSubscription: ${gatewaySubscriptionId}`);
    // No-op no simulador — apenas log
  }

  async getCharge(gatewayChargeId: string): Promise<BillingChargeResult | null> {
    // Retorna um charge confirmado para qualquer ID válido do simulador
    if (!gatewayChargeId.startsWith("sim_chg_")) {
      return null;
    }
    return {
      gatewayChargeId,
      status: "confirmed",
      dueDate: new Date(),
    };
  }

  async validateWebhook(rawBody: string, signature: string): Promise<BillingWebhookValidation> {
    if (signature !== SIMULATOR_WEBHOOK_SECRET) {
      return { valid: false };
    }

    try {
      const payload = JSON.parse(rawBody) as Record<string, unknown>;
      const eventId = typeof payload.id === "string" ? payload.id : `sim_evt_${Date.now()}`;
      const eventType = typeof payload.event === "string" ? payload.event : "PAYMENT_CONFIRMED";

      return {
        valid: true,
        eventId,
        eventType,
        sanitizedPayload: {
          event: eventType,
          id: eventId,
          payment: payload.payment ?? {},
        },
      };
    } catch {
      return { valid: false };
    }
  }

  async getUpdatePaymentUrl(gatewayCustomerId: string): Promise<string | null> {
    return `http://localhost:5173/simulator/update-payment/${gatewayCustomerId}`;
  }
}

