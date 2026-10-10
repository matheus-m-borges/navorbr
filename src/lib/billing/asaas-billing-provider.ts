/**
 * NAVOR SaaS — AsaasBillingProvider
 *
 * Esqueleto de implementação do provedor Asaas.
 * NÃO realiza chamadas reais enquanto ASAAS_API_KEY não estiver configurada.
 *
 * SEGURANÇA CRÍTICA:
 * - A chave ASAAS_API_KEY deve existir APENAS em process.env do servidor.
 * - NUNCA em variáveis VITE_*, banco de dados, logs ou respostas de API.
 * - Este arquivo NÃO deve ser importado em contexto de browser.
 * - Dados de cartão NUNCA devem passar pelo servidor NAVOR —
 *   usar checkout hospedado ou tokenização oficial do Asaas.
 *
 * Para ativar: definir NAVOR_BILLING_PROVIDER=asaas no ambiente do servidor
 * e configurar ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN.
 */

import type {
  IBillingProvider,
  BillingCustomer,
  BillingSubscriptionInput,
  BillingChargeResult,
  BillingWebhookValidation,
} from "./billing-provider";

const ASAAS_SANDBOX_URL = "https://sandbox.asaas.com/api/v3";
const ASAAS_PRODUCTION_URL = "https://api.asaas.com/v3";

function getAsaasConfig(): { apiKey: string; baseUrl: string; webhookToken: string } {
  const apiKey = process.env["ASAAS_API_KEY"];
  const webhookToken = process.env["ASAAS_WEBHOOK_TOKEN"];
  const isSandbox = process.env["ASAAS_ENVIRONMENT"] !== "production";

  if (!apiKey) {
    throw new Error(
      "[AsaasBillingProvider] ASAAS_API_KEY não está configurada no ambiente do servidor. " +
      "Configure a chave e defina NAVOR_BILLING_PROVIDER=asaas para ativar o provedor."
    );
  }

  if (!webhookToken) {
    throw new Error(
      "[AsaasBillingProvider] ASAAS_WEBHOOK_TOKEN não está configurado. " +
      "Necessário para validar webhooks com segurança."
    );
  }

  return {
    apiKey,
    webhookToken,
    baseUrl: isSandbox ? ASAAS_SANDBOX_URL : ASAAS_PRODUCTION_URL,
  };
}

/**
 * Sanitiza o payload do webhook removendo campos sensíveis
 * antes de armazenar na tabela billing_events.
 */
function sanitizeWebhookPayload(payload: Record<string, unknown>): Record<string, unknown> {
  // Allowlist em vez de copiar um payload desconhecido do gateway. Assim, um
  // campo novo com dados pessoais/cartão não é persistido por acidente.
  const event = typeof payload.event === "string" ? payload.event : undefined;
  const payment = payload.payment as Record<string, unknown> | undefined;
  return {
    ...(event ? { event } : {}),
    ...(typeof payload.id === "string" ? { id: payload.id } : {}),
    ...(payment && typeof payment.id === "string"
      ? {
          payment: {
            id: payment.id,
            status: typeof payment.status === "string" ? payment.status : undefined,
            value: typeof payment.value === "number" ? payment.value : undefined,
            dueDate: typeof payment.dueDate === "string" ? payment.dueDate : undefined,
            subscription: typeof payment.subscription === "string" ? payment.subscription : undefined,
          },
        }
      : {}),
  };
}

export class AsaasBillingProvider implements IBillingProvider {
  readonly providerName = "asaas" as const;
  readonly isActive: boolean;

  constructor() {
    // Verifica se as credenciais estão disponíveis (sem lançar erro no constructor)
    this.isActive = Boolean(process.env["ASAAS_API_KEY"] && process.env["ASAAS_WEBHOOK_TOKEN"]);
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const { apiKey, baseUrl } = getAsaasConfig();

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "access_token": apiKey,
        "Content-Type": "application/json",
        "User-Agent": "NAVOR-SaaS/1.0",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Erro desconhecido");
      // Log sanitizado — sem expor a chave
      console.error(`[AsaasBillingProvider] Erro HTTP ${response.status} em ${method} ${path}`);
      throw new Error(`[AsaasBillingProvider] Erro ao comunicar com Asaas: HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async createOrUpdateCustomer(customer: BillingCustomer): Promise<{ gatewayCustomerId: string }> {
    // TODO: Implementar busca por e-mail antes de criar para evitar duplicatas
    const data = await this.request<{ id: string }>("POST", "/customers", {
      name: customer.name,
      email: customer.email,
      cpfCnpj: customer.document,
      phone: customer.phone,
      // externalReference: customer.accountId — para reconciliação futura
    });

    return { gatewayCustomerId: data.id };
  }

  async createSubscription(input: BillingSubscriptionInput): Promise<{
    gatewaySubscriptionId: string;
    firstCharge?: BillingChargeResult;
  }> {
    void input;
    // Intencionalmente desativado: uma assinatura por cartão só pode ser criada
    // após Checkout hospedado/tokenização oficial, nunca recebendo cartão no NAVOR.
    throw new Error("Assinaturas Asaas aguardam a implementação do Checkout hospedado seguro.");
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    await this.request("DELETE", `/subscriptions/${gatewaySubscriptionId}`);
  }

  async getCharge(gatewayChargeId: string): Promise<BillingChargeResult | null> {
    try {
      const data = await this.request<{
        id: string;
        status: string;
        dueDate?: string;
        invoiceUrl?: string;
      }>("GET", `/payments/${gatewayChargeId}`);

      const statusMap: Record<string, BillingChargeResult["status"]> = {
        PENDING: "pending",
        RECEIVED: "confirmed",
        CONFIRMED: "confirmed",
        OVERDUE: "overdue",
        REFUNDED: "failed",
        CHARGEBACK_REQUESTED: "failed",
        CHARGEBACK_DISPUTE: "failed",
      };

      return {
        gatewayChargeId: data.id,
        status: statusMap[data.status] ?? "pending",
        paymentUrl: data.invoiceUrl,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      };
    } catch {
      return null;
    }
  }

  async validateWebhook(rawBody: string, signature: string): Promise<BillingWebhookValidation> {
    const { webhookToken } = getAsaasConfig();

    // Asaas envia o token configurado no header asaas-access-token
    if (!signature || signature !== webhookToken) {
      console.warn("[AsaasBillingProvider] Webhook com assinatura inválida rejeitado.");
      return { valid: false };
    }

    try {
      const payload = JSON.parse(rawBody) as Record<string, unknown>;
      const event = payload as { id?: string; event?: string };

      return {
        valid: true,
        eventId: typeof event.id === "string" ? event.id : undefined,
        eventType: typeof event.event === "string" ? event.event : undefined,
        sanitizedPayload: sanitizeWebhookPayload(payload),
      };
    } catch {
      console.error("[AsaasBillingProvider] Falha ao parsear payload do webhook.");
      return { valid: false };
    }
  }

  async getUpdatePaymentUrl(gatewayCustomerId: string): Promise<string | null> {
    // TODO: Asaas possui link de atualização de cartão — implementar quando ativo
    void gatewayCustomerId;
    return null;
  }
}
