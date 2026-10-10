// ============================================================================
// NAVOR INTEGRATION CORE — CAMADA DE ABSTRAÇÃO DE PAGAMENTOS
// ============================================================================
// Desacoplamento total: O LawHub interage apenas com PaymentProvider.
// Todas as chaves secretas, endpoints e tokens residem exclusivamente
// no backend / Edge Functions do Supabase e na Retaguarda NAVOR.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export interface CreateCustomerDTO {
  name: string;
  document: string; // CPF ou CNPJ
  email?: string;
  phone?: string;
  mobile?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
}

export interface CreateChargeDTO {
  customerExternalId?: string;
  customerData?: CreateCustomerDTO;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  externalReference?: string; // ID da Parcela no LawHub
  split?: Array<{
    walletId: string;
    fixedValue?: number;
    percentualValue?: number;
  }>;
}

export interface PaymentProviderResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  provider: string;
}

export interface ChargeResult {
  chargeId: string;
  status: string;
  paymentUrl?: string;
  invoiceUrl?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  bankSlipBarcode?: string;
  bankSlipIdentificationField?: string;
}

/**
 * Interface de Provedor de Pagamento da NAVOR
 */
export interface IPaymentProvider {
  createCustomer(data: CreateCustomerDTO): Promise<PaymentProviderResponse<{ customerId: string }>>;
  createCharge(data: CreateChargeDTO): Promise<PaymentProviderResponse<ChargeResult>>;
  cancelCharge(chargeId: string): Promise<PaymentProviderResponse<{ cancelled: boolean }>>;
  getCharge(chargeId: string): Promise<PaymentProviderResponse<any>>;
  testConnection(): Promise<PaymentProviderResponse<{ connected: boolean; environment: string }>>;
}

/**
 * Provedor Asaas via Edge Functions Seguras (sem segredos no cliente)
 */
class AsaasPaymentProvider implements IPaymentProvider {
  readonly providerName = 'asaas';

  private withAccountContext<T extends object>(data: T): T & { accountId?: string } {
    const accountId = typeof window !== 'undefined' ? window.localStorage.getItem('navor.active_account_id') : null;
    return accountId ? { ...data, accountId } : data;
  }

  async createCustomer(data: CreateCustomerDTO): Promise<PaymentProviderResponse<{ customerId: string }>> {
    try {
      const { data: res, error } = await supabase.functions.invoke('create-asaas-customer', {
        body: this.withAccountContext(data),
      });

      if (error) throw error;
      return { success: true, data: res, provider: this.providerName };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao comunicar com provedor Asaas', provider: this.providerName };
    }
  }

  async createCharge(data: CreateChargeDTO): Promise<PaymentProviderResponse<ChargeResult>> {
    try {
      const { data: res, error } = await supabase.functions.invoke('create-asaas-charge', {
        body: this.withAccountContext(data),
      });

      if (error) throw error;
      return { success: true, data: res, provider: this.providerName };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao gerar cobrança no Asaas', provider: this.providerName };
    }
  }

  async cancelCharge(chargeId: string): Promise<PaymentProviderResponse<{ cancelled: boolean }>> {
    try {
      const { data: res, error } = await supabase.functions.invoke('cancel-asaas-charge', {
        body: this.withAccountContext({ chargeId }),
      });

      if (error) throw error;
      return { success: true, data: res, provider: this.providerName };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao cancelar cobrança', provider: this.providerName };
    }
  }

  async getCharge(chargeId: string): Promise<PaymentProviderResponse<any>> {
    try {
      const { data: res, error } = await supabase.functions.invoke('sync-asaas-payment', {
        body: this.withAccountContext({ chargeId }),
      });

      if (error) throw error;
      return { success: true, data: res, provider: this.providerName };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao consultar cobrança', provider: this.providerName };
    }
  }

  async testConnection(): Promise<PaymentProviderResponse<{ connected: boolean; environment: string }>> {
    try {
      const { data: res, error } = await supabase.functions.invoke('test-asaas-connection');
      if (error) throw error;
      return { success: true, data: res, provider: this.providerName };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro no teste de conectividade', provider: this.providerName };
    }
  }
}

/**
 * Singleton Navor Integration Core
 */
class NavorIntegrationCoreManager {
  private activeProvider: IPaymentProvider;

  constructor() {
    // Por padrão na Retaguarda NAVOR, Asaas é o provedor ativo
    this.activeProvider = new AsaasPaymentProvider();
  }

  get provider(): IPaymentProvider {
    return this.activeProvider;
  }

  setProvider(provider: IPaymentProvider) {
    this.activeProvider = provider;
  }
}

export const NavorPaymentCore = new NavorIntegrationCoreManager();
