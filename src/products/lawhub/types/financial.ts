// ============================================================================
// NAVOR LAWHUB — TIPOS DO MOTOR FINANCEIRO JURÍDICO 2.0 (ENTERPRISE)
// ============================================================================

export type ContractType =
  | 'fixo'
  | 'parcelado'
  | 'mensal_retainer'
  | 'por_fase'
  | 'exito'
  | 'sucumbencia'
  | 'misto';

export type ContractStatus =
  | 'rascunho'
  | 'em_revisao'
  | 'enviado'
  | 'aguardando_assinatura'
  | 'assinado'
  | 'ativo'
  | 'suspenso'
  | 'encerrado'
  | 'cancelado';

export interface LawContractTemplate {
  id: string;
  account_id: string;
  title: string;
  legal_area: string;
  content: string;
  variables: string[];
  is_system_template: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LawFeeContract {
  id: string;
  account_id: string;
  client_id: string;
  client_name?: string;
  process_id?: string;
  process_cnj?: string;
  lead_id?: string;
  template_id?: string;
  contract_number: string;
  title: string;
  contract_type: ContractType;
  status: ContractStatus;
  total_amount: number;
  entry_amount: number;
  installments_count: number;
  monthly_amount: number;
  contingency_percentage: number;
  sucumbence_percentage: number;
  due_day: number;
  start_date: string;
  end_date?: string;
  responsible_lawyer_id?: string;
  responsible_lawyer_name?: string;
  captor_lawyer_id?: string;
  captor_lawyer_name?: string;
  content?: string;
  variables?: Record<string, string>;
  signed_at?: string;
  signed_document_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type ReceivableStatus =
  | 'aberta'
  | 'parcialmente_paga'
  | 'paga'
  | 'vencida'
  | 'cancelada'
  | 'estornada'
  | 'em_negociacao';

export interface LawAccountReceivable {
  id: string;
  account_id: string;
  client_id: string;
  client_name?: string;
  contract_id?: string;
  contract_number?: string;
  process_id?: string;
  process_cnj?: string;
  description: string;
  category: string;
  original_amount: number;
  discount_amount: number;
  interest_amount: number;
  fine_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  due_date: string;
  competence_date: string;
  status: ReceivableStatus;
  notes?: string;
  installments?: LawReceivableInstallment[];
  created_at: string;
  updated_at: string;
}

export type InstallmentStatus =
  | 'aberta'
  | 'parcialmente_paga'
  | 'paga'
  | 'vencida'
  | 'cancelada'
  | 'estornada';

export interface LawReceivableInstallment {
  id: string;
  account_id: string;
  receivable_id: string;
  contract_id?: string;
  client_id: string;
  client_name?: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  discount_amount: number;
  interest_amount: number;
  fine_amount: number;
  total_due: number;
  paid_amount: number;
  due_date: string;
  payment_date?: string;
  payment_method?: string;
  status: InstallmentStatus;
  billing?: LawBillingCharge;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'TED' | 'DINHEIRO';

export interface LawBillingCharge {
  id: string;
  account_id: string;
  receivable_id?: string;
  installment_id?: string;
  client_id: string;
  provider: 'asaas' | 'manual';
  provider_charge_id?: string;
  provider_status?: string;
  payment_method: PaymentMethod;
  amount: number;
  due_date: string;
  payment_url?: string;
  invoice_url?: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  bank_slip_barcode?: string;
  bank_slip_identification_field?: string;
  status: 'gerada' | 'paga' | 'vencida' | 'cancelada' | 'estornada';
  created_at: string;
}

export interface LawPayment {
  id: string;
  account_id: string;
  receivable_id: string;
  installment_id?: string;
  billing_id?: string;
  client_id: string;
  client_name?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  provider: string;
  provider_payment_id?: string;
  status: 'confirmado' | 'estornado';
  is_partial: boolean;
  receipt_number?: string;
  receipt_url?: string;
  destination_account_id?: string;
  notes?: string;
  created_at: string;
}

export type PayableStatus = 'aberta' | 'paga' | 'vencida' | 'cancelada';

export interface LawAccountPayable {
  id: string;
  account_id: string;
  supplier_name: string;
  supplier_document?: string;
  category: string;
  cost_center?: string;
  description: string;
  amount: number;
  due_date: string;
  competence_date: string;
  payment_date?: string;
  payment_account_id?: string;
  payment_method?: string;
  status: PayableStatus;
  document_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type CostStatus =
  | 'pendente'
  | 'adiantada_pelo_cliente'
  | 'paga_pelo_escritorio'
  | 'reembolso_pendente'
  | 'reembolsada'
  | 'cancelada';

export interface LawProcessCost {
  id: string;
  account_id: string;
  process_id: string;
  process_cnj?: string;
  client_id: string;
  client_name?: string;
  cost_type: string;
  description: string;
  amount: number;
  receipt_date: string;
  receipt_url?: string;
  advanced_by: 'escritorio' | 'cliente';
  status: CostStatus;
  responsible_user_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LawJudicialRelease {
  id: string;
  account_id: string;
  process_id: string;
  process_cnj?: string;
  client_id: string;
  client_name?: string;
  contract_id?: string;
  release_type: 'alvara' | 'acordo' | 'rpv' | 'precatorio' | 'deposito_judicial';
  gross_amount: number;
  contract_fee_amount: number;
  sucumbence_fee_amount: number;
  costs_deducted_amount: number;
  client_net_amount: number;
  release_date: string;
  transfer_date?: string;
  transfer_receipt_url?: string;
  status: 'recebido_pendente_repasse' | 'repassado_ao_cliente' | 'prestacao_concluida';
  report_pdf_url?: string;
  notes?: string;
  created_at: string;
}

export type JudicialRequisitionType =
  | 'precatorio_alimentar'
  | 'precatorio_comum'
  | 'rpv_federal'
  | 'rpv_estadual_municipal'
  | 'alvara_levantamento'
  | 'deposito_judicial';

export type JudicialRequisitionStatus =
  | 'autuado'
  | 'inscrito_orcamento'
  | 'aguardando_liberacao_bancaria'
  | 'alvara_expedido'
  | 'honorarios_destacados'
  | 'repassado_cliente'
  | 'concluido';

export type JudicialCourtType =
  | 'TRF1'
  | 'TRF2'
  | 'TRF3'
  | 'TRF4'
  | 'TRF5'
  | 'TRF6'
  | 'TJPI'
  | 'TJMA'
  | 'TJCE'
  | 'TRT22'
  | 'STJ'
  | 'STF'
  | 'OUTRO';

export type JudicialDepositaryBank = 'CEF' | 'BANCO_DO_BRASIL' | 'BANCO_DE_BRASILIA' | 'OUTRO';

export interface LawPrecatórioRpvRequisition {
  id: string;
  account_id: string;
  process_id: string;
  process_cnj: string;
  client_id: string;
  client_name: string;
  client_document?: string;
  requisition_number: string;
  court: JudicialCourtType;
  court_unit?: string;
  requisition_type: JudicialRequisitionType;
  depositary_bank: JudicialDepositaryBank;
  agency?: string;
  account_number?: string;
  gross_amount: number;
  contract_fee_percentage: number;
  contract_fee_amount: number;
  sucumbence_fee_amount: number;
  costs_deducted_amount: number;
  client_net_amount: number;
  budget_year?: number;
  issuance_date: string;
  expected_payment_date?: string;
  payment_date?: string;
  transfer_date?: string;
  status: JudicialRequisitionStatus;
  has_fee_retention_order: boolean;
  reconciled_with_financial: boolean;
  receivable_id?: string;
  receipt_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LawFeeDistribution {
  id: string;
  account_id: string;
  payment_id: string;
  lawyer_id: string;
  lawyer_name?: string;
  role_type: 'captador' | 'responsavel' | 'executor' | 'correspondente' | 'socio';
  percentage: number;
  amount: number;
  status: 'pendente' | 'pago' | 'retido';
  paid_date?: string;
  notes?: string;
  created_at: string;
}

export interface LawFinancialAccount {
  id: string;
  account_id: string;
  name: string;
  institution: string;
  account_type: 'corrente' | 'digital' | 'poupanca' | 'caixa_fisico';
  agency?: string;
  account_number?: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  is_default: boolean;
  currency: string;
  created_at: string;
}

export interface LawFinancialTransaction {
  id: string;
  account_id: string;
  financial_account_id: string;
  account_name?: string;
  transaction_type: 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA' | 'ESTORNO' | 'AJUSTE';
  amount: number;
  transaction_date: string;
  description: string;
  origin_type: string;
  origin_id?: string;
  reconciled: boolean;
  created_at: string;
}

export interface LawIntegrationProviderStatus {
  provider_name: string;
  is_active: boolean;
  environment: 'sandbox' | 'production';
  connection_status: 'conectado' | 'desconectado' | 'erro';
  last_sync_at?: string;
  webhook_status: string;
  features: {
    pix: boolean;
    boleto: boolean;
    credit_card: boolean;
    auto_split: boolean;
  };
}

export interface FinancialDashboardMetrics {
  totalBalance: number;
  receivedToday: number;
  receivedThisMonth: number;
  receivableTotal: number;
  overdueTotal: number;
  payableTotal: number;
  expensesThisMonth: number;
  operatingResult: number;
  contractedFeesTotal: number;
  receivedFeesTotal: number;
  inadimplenciaRate: number;
}

export interface LawFinancialCategory {
  id: string;
  name: string;
  color: string;
  type: "receita" | "despesa" | "ambos";
  allows_entry: boolean;
  status: "ativo" | "inativo";
}

export interface LawCostCenter {
  id: string;
  name: string;
  status: "ativo" | "inativo";
}

