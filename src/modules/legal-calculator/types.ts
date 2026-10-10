/**
 * NAVOR LAWHUB — MÓDULO CALCULADORA JURÍDICA
 * Definições de Tipos e Contratos do Motor Jurídico de Cálculos
 */

export type CalculationStatus =
  | "DRAFT"
  | "ANALYZING"
  | "WAITING_CONFIRMATION"
  | "READY"
  | "CALCULATING"
  | "VALIDATING"
  | "VALIDATED"
  | "BLOCKED"
  | "ERROR"
  | "ARCHIVED";

export type ValidationStatus = "VALIDATED" | "RESOLVED" | "NEEDS_CONFIRMATION" | "BLOCKED";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type LegalArea =
  | "Civel"
  | "Trabalhista"
  | "Previdenciario"
  | "Tributario"
  | "Bancario"
  | "Consumidor"
  | "Familia"
  | "Empresarial"
  | "Contratual"
  | "Indenizacoes"
  | "Execucao"
  | "CumprimentoDeSentenca"
  | "Outros";

export type RuleApprovalStatus = "DRAFT" | "TESTING" | "REVIEW" | "APPROVED" | "PUBLISHED";

export type EconomicIndexCode =
  | "IPCA"
  | "INPC"
  | "IPCA_15"
  | "IPCA_E"
  | "IGP_M"
  | "IGP_DI"
  | "TR"
  | "SELIC"
  | "CDI"
  | "TAXA_LEGAL";

export interface EconomicIndex {
  id: string;
  code: EconomicIndexCode;
  name: string;
  institution: string;
  description: string;
  frequency: "DIARIA" | "MENSAL" | "ANUAL";
  unit: "%" | "FATOR" | "INDICE";
  officialUrl: string;
  active: boolean;
  sourceId: string;
}

export interface EconomicIndexValue {
  id: string;
  indexCode: EconomicIndexCode;
  referenceDate: string; // YYYY-MM ou YYYY-MM-DD
  value: number; // Taxa no período em %
  accumulatedFactor?: number;
  sourceId: string;
  sourceDocument?: string;
  publishedAt: string;
  checksum: string;
  status: "VALIDATED" | "PENDING" | "CORRECTED" | "INVALIDATED";
}

export interface LegalSource {
  id: string;
  institution: string;
  sourceType: "API" | "OPEN_DATA" | "OFFICIAL_FILE" | "OFFICIAL_PAGE" | "MANUAL_IMPORT";
  name: string;
  baseUrl: string;
  endpoint?: string;
  active: boolean;
  reliabilityLevel: "OFFICIAL_PRIMARY" | "OFFICIAL_SECONDARY" | "REFERENCE";
  lastSuccess?: string;
  lastFailure?: string;
  lastChecked?: string;
  healthStatus: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs?: number;
}

export interface LegalRule {
  id: string;
  code: string;
  name: string;
  legalArea: LegalArea;
  calculationType: string;
  obligationNature: string;
  law?: string | undefined;
  article?: string | undefined;
  paragraph?: string | undefined;
  item?: string | undefined;
  jurisprudenceCourt?: string | undefined;
  jurisprudenceTheme?: string | undefined;
  jurisprudenceCaseNumber?: string | undefined;
  jurisprudenceThesis?: string | undefined;
  legislation?: {
    law: string;
    article: string;
    paragraph?: string | undefined;
    item?: string | undefined;
  } | undefined;
  jurisprudence?: {
    court: string;
    theme?: string | undefined;
    caseNumber?: string | undefined;
    thesis?: string | undefined;
  } | undefined;
  ruleDescription: string;
  methodology: string;
  formula: string;
  priority: number;
  active: boolean;
}

export interface LegalRuleVersion {
  id: string;
  legalRuleId: string;
  version: number;
  validFrom: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD
  legislationSource: string;
  jurisprudenceSource?: string;
  methodology: string;
  monetaryIndexCode?: EconomicIndexCode;
  interestType: "SIMPLES" | "COMPOSTO" | "TAXA_UNICA" | "PRO_RATA" | "TAXA_LEGAL" | "NENHUM";
  monthlyInterestRate?: number;
  exceptions?: string[];
  status: RuleApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface LegalRuleResolverInput {
  calculationType: string;
  legalArea: LegalArea;
  obligationNature: string;
  eventDate?: string | undefined;
  dueDate?: string | undefined;
  citationDate?: string | undefined;
  judgmentDate?: string | undefined;
  paymentDate?: string | undefined;
  tribunal?: string | undefined;
  state?: string | undefined;
  city?: string | undefined;
  contractDate?: string | undefined;
  legislationContext?: string | undefined;
  judgmentParameters?: {
    specifiedIndex?: EconomicIndexCode | undefined;
    specifiedInterestRate?: number | undefined;
    interestStartDate?: string | undefined;
    correctionStartDate?: string | undefined;
    hasCourtOrder?: boolean | undefined;
    hasContractualClause?: boolean | undefined;
    contractualIndex?: EconomicIndexCode | undefined;
    contractualInterestRate?: number | undefined;
  };
}

export interface LegalRuleResolution {
  status: ValidationStatus;
  legalRuleId?: string;
  legalRuleVersionId?: string;
  legalRuleName?: string;
  legislation?: {
    law: string;
    article: string;
    paragraph?: string;
    item?: string;
  };
  jurisprudence?: {
    court: string;
    theme?: string;
    caseNumber?: string;
    thesis?: string;
  };
  monetaryCorrection?: {
    index: EconomicIndexCode;
    source: string;
    methodology: string;
    startDate: string;
  };
  interest?: {
    type: string;
    rate?: number;
    source: string;
    methodology: string;
    startDate: string;
  };
  startDate: string;
  endDate: string;
  exceptions?: string[];
  confidence: ConfidenceLevel;
  requiredUserConfirmation?: string[];
  explanation: string;
}

export interface CalculationPayment {
  id: string;
  paymentDate: string;
  amount: number;
  description?: string;
}

export interface CalculationPeriodDetail {
  periodIndex: number;
  periodLabel: string; // MM/YYYY
  startDate: string;
  endDate: string;
  daysCount: number;
  openingPrincipal: number;
  indexCode?: EconomicIndexCode;
  indexRatePercent: number;
  correctionFactor: number;
  correctionAmount: number;
  interestType: string;
  interestRatePercent: number;
  interestAmount: number;
  amortizedInterest: number;
  amortizedPrincipal: number;
  paymentAmount: number;
  closingPrincipal: number;
  closingBalance: number;
}

export interface CalculationItemInput {
  id?: string | undefined;
  description: string;
  originalAmount: number;
  referenceDate: string; // Data do fato/vencimento
  dueDate?: string | undefined;
  correctionStart?: string | undefined;
  interestStart?: string | undefined;
  finalDate?: string | undefined;
  penaltyPercent?: number | undefined;
  honoraryPercent?: number | undefined;
}

export interface CalculationItemResult {
  id: string;
  description: string;
  originalAmount: number;
  referenceDate: string;
  correctionStart: string;
  interestStart: string;
  finalDate: string;
  principal: number;
  correction: number;
  correctedAmount: number;
  interest: number;
  penalty: number;
  honorary: number;
  discounts: number;
  payments: number;
  finalAmount: number;
  periods: CalculationPeriodDetail[];
}

export interface CalculationResult {
  calculationId: string;
  principal: number;
  correction: number;
  interest: number;
  penalty: number;
  honorary: number;
  payments: number;
  discounts: number;
  total: number;
  items: CalculationItemResult[];
  legalRuleSummary: {
    law: string;
    ruleName: string;
    indexCode: string;
    interestType: string;
    ruleVersion: number;
    methodology: string;
  };
  calculatedAt: string;
  engineVersion: string;
  deterministicHash: string;
}

export interface CalculationAudit {
  id: string;
  calculationId: string;
  userId: string;
  userName: string;
  tenantId: string;
  action: "CREATED" | "CALCULATED" | "PARAMETER_CONFIRMED" | "VERSIONED" | "REPRODUCED" | "PRINTED";
  parametersSnapshot: Record<string, any>;
  ruleVersionId: string;
  engineVersion: string;
  deterministicHash: string;
  createdAt: string;
}

export interface CalculationSnapshot {
  id: string;
  calculationId: string;
  versionNumber: number;
  inputSnapshot: any;
  ruleSnapshot: any;
  indexSnapshot: any;
  sourceSnapshot: any;
  resultSnapshot: CalculationResult;
  engineVersion: string;
  deterministicHash: string;
  createdAt: string;
}

export interface CalculationRecord {
  id: string;
  tenantId: string;
  userId: string;
  clientId?: string;
  clientName?: string;
  processNumber: string;
  calculationName: string;
  legalArea: LegalArea;
  calculationType: string;
  obligationNature: string;
  tribunal: string;
  state: string;
  city?: string;
  status: CalculationStatus;
  validationStatus: ValidationStatus;
  originalAmount: number;
  totalResult?: number;
  lastCalculatedAt?: string;
  engineVersion: string;
  deterministicHash?: string;
  createdAt: string;
  updatedAt: string;
  items: CalculationItemInput[];
  payments: CalculationPayment[];
  confirmedParameters: Record<string, any>;
  extractedDocumentText?: string;
  extractedParameters?: Array<{
    key: string;
    label: string;
    suggestedValue: any;
    status: "CONFIRMED" | "EDITED" | "IGNORED" | "PENDING";
    confidence: ConfidenceLevel;
    rationale: string;
  }>;
  resolution?: LegalRuleResolution;
  result?: CalculationResult;
}

export interface CalculationTestCase {
  id: string;
  name: string;
  legalRuleId: string;
  description: string;
  category: "UNIT" | "INTEGRATION" | "REGRESSION" | "LEGAL" | "HISTORICAL" | "BOUNDARY";
  input: {
    principal: number;
    startDate: string;
    endDate: string;
    obligationNature: string;
    legalArea: LegalArea;
    citationDate?: string;
    payments?: CalculationPayment[];
    judgmentParameters?: any;
  };
  expectedOutput: {
    total: number;
    correction: number;
    interest: number;
    tolerance: number; // Ex: 0.05
  };
  status: "PASSED" | "FAILED" | "PENDING";
  lastRunAt?: string;
  lastExecutionError?: string;
}
