/**
 * NAVOR SaaS — Interface BillingProvider
 *
 * Define o contrato que qualquer provedor de pagamento deve implementar.
 * O provedor ativo é controlado pela variável de ambiente NAVOR_BILLING_PROVIDER.
 *
 * SEGURANÇA:
 * - Nunca importar este arquivo em contexto de browser/frontend.
 * - Nunca expor chaves, tokens ou IDs de gateway no cliente.
 * - Dados de cartão NUNCA devem passar pelo servidor NAVOR.
 */

export type BillingProvider = "disabled" | "asaas" | "simulator";

export interface BillingCustomer {
  /** ID interno NAVOR (account_id) */
  accountId: string;
  name: string;
  email: string;
  /** CPF ou CNPJ — apenas para criar cliente no gateway */
  document: string;
  phone?: string;
}

export interface BillingSubscriptionInput {
  /** ID do cliente no gateway (gateway_customer_id) */
  gatewayCustomerId: string;
  /** Plano de cobrança */
  planId: string;
  /** Valor a cobrar */
  amount: number;
  /** Ciclo: monthly | quarterly | yearly */
  billingCycle: "monthly" | "quarterly" | "yearly";
  /** Descrição da assinatura */
  description?: string;
  /** Data de início (padrão: hoje) */
  startDate?: Date;
}

export interface BillingChargeResult {
  /** ID da cobrança no gateway */
  gatewayChargeId: string;
  /** Status da cobrança */
  status: "pending" | "confirmed" | "overdue" | "failed";
  /** URL de pagamento (checkout hospedado ou link) */
  paymentUrl?: string;
  /** Vencimento */
  dueDate?: Date;
}

export interface BillingWebhookValidation {
  valid: boolean;
  /** ID do evento no gateway (para idempotência) */
  eventId?: string;
  /** Tipo do evento normalizado */
  eventType?: string;
  /** Payload sanitizado (sem dados de cartão) */
  sanitizedPayload?: Record<string, unknown>;
}

/**
 * Contrato central que qualquer BillingProvider deve implementar.
 * Nenhum método deve jamais receber ou retornar dados de cartão.
 */
export interface IBillingProvider {
  readonly providerName: BillingProvider;
  readonly isActive: boolean;

  /** Cria ou recupera cliente no gateway */
  createOrUpdateCustomer(customer: BillingCustomer): Promise<{ gatewayCustomerId: string }>;

  /** Cria assinatura recorrente no gateway */
  createSubscription(input: BillingSubscriptionInput): Promise<{ gatewaySubscriptionId: string; firstCharge?: BillingChargeResult }>;

  /** Cancela assinatura no gateway */
  cancelSubscription(gatewaySubscriptionId: string, options?: { atPeriodEnd?: boolean }): Promise<void>;

  /** Consulta cobrança pelo ID do gateway */
  getCharge(gatewayChargeId: string): Promise<BillingChargeResult | null>;

  /** Valida e sanitiza um webhook recebido */
  validateWebhook(rawBody: string, signature: string): Promise<BillingWebhookValidation>;

  /** Gera URL de checkout hospedado para o cliente atualizar cartão */
  getUpdatePaymentUrl?(gatewayCustomerId: string): Promise<string | null>;
}

/**
 * Retorna o provedor ativo com base em NAVOR_BILLING_PROVIDER.
 * Padrão seguro: 'disabled' — nunca cobra ninguém sem configuração explícita.
 */
export async function getActiveBillingProvider(): Promise<IBillingProvider> {
  const providerName = (process.env["NAVOR_BILLING_PROVIDER"] ?? "disabled") as BillingProvider;

  if (providerName === "asaas") {
    const { AsaasBillingProvider } = await import("./asaas-billing-provider");
    return new AsaasBillingProvider();
  }

  if (providerName === "simulator") {
    const { SimulatorBillingProvider } = await import("./simulator-billing-provider");
    return new SimulatorBillingProvider();
  }

  const { DisabledBillingProvider } = await import("./disabled-billing-provider");
  return new DisabledBillingProvider();
}
