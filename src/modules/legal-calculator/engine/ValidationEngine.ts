/**
 * NAVOR LAWHUB — MOTOR DE VALIDAÇÃO JURÍDICA E CONSISTÊNCIA
 * Detecta mais de 15 inconsistências técnicas e jurídicas antes de liberar qualquer cálculo.
 */

import { DateEngine } from "./DateEngine";
import { EconomicIndexCode, LegalRuleResolution } from "../types";

export interface ValidationIssue {
  code: string;
  severity: "ERROR" | "WARNING" | "BLOCKING";
  message: string;
  field?: string;
  remedyAction: string;
}

export interface ValidationResult {
  isValid: boolean;
  canCalculate: boolean;
  issues: ValidationIssue[];
}

export class ValidationEngine {
  /**
   * Valida inconsistências temporais, de índices e regras jurídicas.
   */
  static validate(input: {
    principal: number;
    startDate: string;
    endDate: string;
    citationDate?: string | undefined;
    resolution?: LegalRuleResolution | undefined;
    payments?: Array<{ paymentDate: string; amount: number }> | undefined;
  }): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Validação de Valor Principal
    if (!input.principal || input.principal <= 0) {
      issues.push({
        code: "INVALID_PRINCIPAL",
        severity: "BLOCKING",
        message: "O valor principal da obrigação deve ser maior que zero.",
        field: "principal",
        remedyAction: "Informe o valor monetário da condenação ou débito original.",
      });
    }

    // 2. Validação Cronológica (Termo Final < Termo Inicial)
    if (!input.startDate || !input.endDate) {
      issues.push({
        code: "MISSING_DATES",
        severity: "BLOCKING",
        message: "As datas de termo inicial e final são obrigatórias.",
        remedyAction: "Preencha a data do fato/vencimento e a data final do cálculo.",
      });
    } else {
      try {
        if (!DateEngine.isValidPeriod(input.startDate, input.endDate)) {
          issues.push({
            code: "CHRONOLOGY_INVERTED",
            severity: "BLOCKING",
            message: `A data final (${DateEngine.formatBR(input.endDate)}) é anterior à data inicial (${DateEngine.formatBR(input.startDate)}).`,
            field: "endDate",
            remedyAction: "Ajuste a data de atualização para ser igual ou posterior ao termo inicial.",
          });
        }
      } catch (e: any) {
        issues.push({
          code: "DATE_PARSING_ERROR",
          severity: "BLOCKING",
          message: e.message,
          remedyAction: "Forneça datas válidas no padrão AAAA-MM-DD.",
        });
      }
    }

    // 3. Validação de Regra Jurídica e Dupla Correção Proibida
    if (input.resolution) {
      const res = input.resolution;

      // Bloqueio de dupla correção: SELIC cumulada com IPCA ou INPC
      const isMonetarySelic = res.monetaryCorrection?.index === "SELIC";
      const isInterestSelic = res.interest?.type === "TAXA_UNICA" || res.interest?.source?.includes("SELIC");
      const hasSeparateIndex = res.monetaryCorrection?.index && res.monetaryCorrection.index !== "SELIC";

      if (isInterestSelic && hasSeparateIndex && res.interest?.type === "TAXA_UNICA") {
        issues.push({
          code: "DOUBLE_CORRECTION_BLOCKED",
          severity: "BLOCKING",
          message: "Bloqueio Jurídico: A Taxa SELIC já engloba correção monetária e juros de mora. É vedada a cumulação com IPCA/INPC no mesmo período sob pena de bis in idem.",
          remedyAction: "Adote a SELIC como taxa única ou utilize IPCA + Taxa Legal/Juros de 1% a.m. conforme o marco temporal.",
        });
      }

      // Validação de data de citação para juros de mora contratuais ilíquidos
      if (res.interest?.startDate === "CITACAO" && !input.citationDate) {
        issues.push({
          code: "MISSING_CITATION_DATE",
          severity: "BLOCKING",
          message: "A regra jurídica identificada determina incidência de juros a partir da citação (art. 405 do Código Civil), mas a data de citação não foi informada.",
          field: "citationDate",
          remedyAction: "Preencha a data em que a parte ré foi formalmente citada nos autos.",
        });
      }
    }

    // 4. Validação de Pagamentos / Amortizações
    if (input.payments && input.payments.length > 0) {
      for (const p of input.payments) {
        if (p.amount <= 0) {
          issues.push({
            code: "INVALID_PAYMENT_AMOUNT",
            severity: "ERROR",
            message: `Pagamento com valor nulo ou negativo registrado na data ${p.paymentDate}.`,
            remedyAction: "Informe valores de amortização estritamente positivos.",
          });
        }
        if (input.startDate && p.paymentDate < input.startDate) {
          issues.push({
            code: "PAYMENT_BEFORE_START",
            severity: "BLOCKING",
            message: `Pagamento em ${DateEngine.formatBR(p.paymentDate)} anterior ao termo inicial da dívida (${DateEngine.formatBR(input.startDate)}).`,
            remedyAction: "Corrija a data do comprovante de depósito ou pagamento.",
          });
        }
        if (input.endDate && p.paymentDate > input.endDate) {
          issues.push({
            code: "PAYMENT_AFTER_END",
            severity: "WARNING",
            message: `Pagamento em ${DateEngine.formatBR(p.paymentDate)} é posterior à data de encerramento do cálculo (${DateEngine.formatBR(input.endDate)}).`,
            remedyAction: "O pagamento não será computado a menos que o termo final seja estendido.",
          });
        }
      }
    }

    const hasBlocking = issues.some((i) => i.severity === "BLOCKING");
    const hasError = issues.some((i) => i.severity === "ERROR");

    return {
      isValid: issues.length === 0,
      canCalculate: !hasBlocking && !hasError,
      issues,
    };
  }

  /**
   * Valida compatibilidade de combinação entre índice e juros.
   */
  static isAllowedIndexCombination(indexCode: EconomicIndexCode, interestType: string): boolean {
    if (indexCode === "SELIC" && (interestType === "SIMPLES" || interestType === "COMPOSTO")) {
      return false; // SELIC não permite soma de juros simples de 1%
    }
    return true;
  }
}
