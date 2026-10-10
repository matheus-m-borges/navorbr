/**
 * NAVOR SaaS — DisabledBillingProvider
 *
 * Provedor de pagamento desabilitado. Usado quando NAVOR_BILLING_PROVIDER=disabled
 * (padrão de segurança) ou quando nenhuma variável está configurada.
 *
 * Permite desenvolver e testar todas as telas, fluxos e estados de assinatura
 * sem cobrar ninguém e sem precisar de credenciais de gateway.
 *
 * Cada método lança um erro descritivo indicando que o provedor não está ativo,
 * exceto validateWebhook que retorna inválido por segurança.
 */

import type {
  IBillingProvider,
  BillingCustomer,
  BillingSubscriptionInput,
  BillingChargeResult,
  BillingWebhookValidation,
} from "./billing-provider";

export class DisabledBillingProvider implements IBillingProvider {
  readonly providerName = "disabled" as const;
  readonly isActive = false;

  private notConfigured(operation: string): never {
    throw new Error(
      `[BillingProvider] Provedor de pagamento não configurado. ` +
      `Operação "${operation}" requer que NAVOR_BILLING_PROVIDER seja definido como "asaas" ` +
      `e que as credenciais estejam configuradas no ambiente do servidor.`
    );
  }

  async createOrUpdateCustomer(_customer: BillingCustomer): Promise<{ gatewayCustomerId: string }> {
    this.notConfigured("createOrUpdateCustomer");
  }

  async createSubscription(_input: BillingSubscriptionInput): Promise<{ gatewaySubscriptionId: string; firstCharge?: BillingChargeResult }> {
    this.notConfigured("createSubscription");
  }

  async cancelSubscription(_gatewaySubscriptionId: string): Promise<void> {
    this.notConfigured("cancelSubscription");
  }

  async getCharge(_gatewayChargeId: string): Promise<BillingChargeResult | null> {
    this.notConfigured("getCharge");
  }

  async validateWebhook(_rawBody: string, _signature: string): Promise<BillingWebhookValidation> {
    // Webhooks nunca são válidos quando o provedor está desabilitado
    return { valid: false };
  }

  async getUpdatePaymentUrl(_gatewayCustomerId: string): Promise<string | null> {
    this.notConfigured("getUpdatePaymentUrl");
  }
}
