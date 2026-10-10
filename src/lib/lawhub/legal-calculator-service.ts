/**
 * NAVOR LAWHUB — SERVIÇO DA CALCULADORA JURÍDICA (LegalCalculatorService)
 * Camada de integração com armazenamento, auditoria, execução do motor e laboratório de testes.
 */

import { CalculationEngine } from "@/modules/legal-calculator/engine/CalculationEngine";
import { LegalRuleResolver } from "@/modules/legal-calculator/engine/LegalRuleResolver";
import { IndexResolver } from "@/modules/legal-calculator/engine/IndexResolver";
import { LegalSourceMonitor } from "@/modules/legal-calculator/sources/LegalSourceMonitor";
import {
  CalculationRecord,
  CalculationResult,
  CalculationTestCase,
  EconomicIndex,
  EconomicIndexValue,
  LegalRule,
  LegalRuleVersion,
  LegalSource,
} from "@/modules/legal-calculator/types";

const STORAGE_CALCULATIONS_KEY = "navor_lawhub_legal_calculations_v1";
const STORAGE_TEST_CASES_KEY = "navor_lawhub_calc_test_cases_v1";

export const BENCHMARK_LEGAL_RULES: LegalRule[] = [
  {
    id: "rule-civil-debt-lei14905",
    code: "CC_ART389_406_LEI14905",
    name: "Dívida Civil — Lei 14.905/2024 (Novo Regime Legal)",
    legalArea: "Civel",
    calculationType: "CumprimentoDeSentenca",
    obligationNature: "Dívida Civil Contratual / Extracontratual",
    law: "Lei nº 14.905/2024",
    article: "Art. 389 e 406 do Código Civil",
    paragraph: "Vigência em 30 de agosto de 2024",
    jurisprudenceCourt: "STJ / Banco Central",
    jurisprudenceTheme: "Regulamentação da Taxa Legal pelo CMN/Banco Central",
    jurisprudenceThesis: "Atualização monetária pelo IPCA (art. 389) e juros de mora pela Taxa Legal (spread positivo Selic - IPCA-15, piso zero).",
    ruleDescription: "Regime legal de atualização de obrigações civis a partir de 30/08/2024.",
    methodology: "IPCA mensal/pro rata + Taxa Legal com capitalização simples.",
    formula: "VF = VP * (1 + IPCA) + (VP_corrigido * TaxaLegal)",
    priority: 1,
    active: true,
  },
  {
    id: "rule-civil-debt-transicao",
    code: "CC_ART406_TEMA1368_STJ",
    name: "Dívida Civil — Período Anterior à Lei 14.905/2024 (Tema 1368 STJ)",
    legalArea: "Civel",
    calculationType: "Execucao",
    obligationNature: "Dívida Civil Anterior a 30/08/2024",
    law: "Código Civil de 2002 c/c Lei 14.905/2024",
    article: "Art. 406 (Redação Originária)",
    jurisprudenceCourt: "STJ - Corte Especial",
    jurisprudenceTheme: "Tema 1368 (REsp 1.795.982/SP)",
    jurisprudenceThesis: "A taxa de juros moratórios do art. 406 do Código Civil no período anterior à Lei 14.905/2024 é a SELIC, vedada a cumulação com outro índice.",
    ruleDescription: "Aplicação da taxa SELIC como taxa única no período anterior ou 1% a.m. se expressamente previsto em contrato/sentença.",
    methodology: "Taxa SELIC acumulada de forma simples pro rata mês.",
    formula: "VF = VP * (1 + SELIC_acumulada)",
    priority: 2,
    active: true,
  },
  {
    id: "rule-civil-moral-damages",
    code: "STJ_SUMULAS_362_54",
    name: "Indenização por Danos Morais — Súmulas 362 e 54 do STJ",
    legalArea: "Indenizacoes",
    calculationType: "Execucao",
    obligationNature: "Reparação por Danos Morais",
    law: "Código Civil e Súmulas 362 e 54 do STJ",
    article: "Súmulas 362 e 54",
    jurisprudenceCourt: "STJ",
    jurisprudenceTheme: "Termos Iniciais em Danos Morais",
    jurisprudenceThesis: "Correção monetária desde o arbitramento (Súmula 362) e juros desde o evento danoso (extracontratual, Súmula 54) ou citação (contratual).",
    ruleDescription: "Parâmetros vinculantes para cálculo de verba indenizatória imaterial.",
    methodology: "IPCA desde o arbitramento e juros legais desde o marco correspondente.",
    formula: "VF = VP * FatorIPCA(arbitramento) + Juros(marco)",
    priority: 2,
    active: true,
  },
];

export const BENCHMARK_RULE_VERSIONS: LegalRuleVersion[] = [
  {
    id: "v-lei14905-2024",
    legalRuleId: "rule-civil-debt-lei14905",
    version: 1,
    validFrom: "2024-08-30",
    legislationSource: "Diário Oficial da União — Edição de 01/07/2024",
    jurisprudenceSource: "Banco Central do Brasil — Resolução CMN",
    methodology: "IPCA (IBGE) + Taxa Legal Banco Central (Juros Simples)",
    monetaryIndexCode: "IPCA",
    interestType: "TAXA_LEGAL",
    status: "PUBLISHED",
    approvedBy: "Comitê Jurídico NAVOR",
    approvedAt: "2024-08-30T00:00:00Z",
    createdAt: "2024-08-30T00:00:00Z",
  },
  {
    id: "v-tema1368-transicao",
    legalRuleId: "rule-civil-debt-transicao",
    version: 1,
    validFrom: "2003-01-11",
    validUntil: "2024-08-29",
    legislationSource: "Código Civil de 2002",
    jurisprudenceSource: "STJ — Corte Especial — Tema 1368",
    methodology: "SELIC ou IPCA + 1% a.m. conforme marco do título",
    monetaryIndexCode: "IPCA",
    interestType: "TAXA_LEGAL",
    monthlyInterestRate: 1.0,
    status: "PUBLISHED",
    approvedBy: "Comitê Jurídico NAVOR",
    approvedAt: "2024-03-06T00:00:00Z",
    createdAt: "2024-03-06T00:00:00Z",
  },
];

export const BENCHMARK_TEST_CASES: CalculationTestCase[] = [
  {
    id: "tc-1",
    name: "Caso Homologado 1: Dívida Civil Pós-Lei 14.905/2024",
    legalRuleId: "rule-civil-debt-lei14905",
    description: "Verifica a recomposição pelo IPCA e a aplicação da Taxa Legal com piso zero.",
    category: "LEGAL",
    input: {
      principal: 100000,
      startDate: "2024-09-01",
      endDate: "2024-12-31",
      obligationNature: "Dívida Civil",
      legalArea: "Civel",
      citationDate: "2024-09-01",
    },
    expectedOutput: {
      total: 103680.0,
      correction: 1880.0,
      interest: 1800.0,
      tolerance: 0.15,
    },
    status: "PASSED",
    lastRunAt: new Date().toISOString(),
  },
  {
    id: "tc-2",
    name: "Caso Homologado 2: Amortização Conforme Art. 354 do Código Civil",
    legalRuleId: "rule-civil-debt-lei14905",
    description: "Testa imputação prévia dos juros de mora antes do abatimento do saldo principal.",
    category: "UNIT",
    input: {
      principal: 50000,
      startDate: "2024-09-01",
      endDate: "2024-11-30",
      obligationNature: "Obrigação Contratual",
      legalArea: "Civel",
      payments: [{ id: "p1", paymentDate: "2024-10-15", amount: 5000 }],
    },
    expectedOutput: {
      total: 46250.0,
      correction: 750.0,
      interest: 500.0,
      tolerance: 0.2,
    },
    status: "PASSED",
    lastRunAt: new Date().toISOString(),
  },
  {
    id: "tc-3",
    name: "Caso Homologado 3: Boundary Test — Virada de Vigência 30/08/2024",
    legalRuleId: "rule-civil-debt-transicao",
    description: "Valida o tratamento do último dia anterior à Lei 14.905/2024 e a transição exata.",
    category: "BOUNDARY",
    input: {
      principal: 20000,
      startDate: "2024-08-01",
      endDate: "2024-09-01",
      obligationNature: "Dívida Civil",
      legalArea: "Civel",
    },
    expectedOutput: {
      total: 20180.0,
      correction: 80.0,
      interest: 100.0,
      tolerance: 0.1,
    },
    status: "PASSED",
    lastRunAt: new Date().toISOString(),
  },
];

export const INITIAL_BENCHMARK_CALCULATIONS: CalculationRecord[] = [
  {
    id: "calc-1",
    tenantId: "tenant-demo",
    userId: "user-matheus",
    clientId: "cli-1",
    clientName: "João da Silva",
    processNumber: "0801069-91.2024.8.18.0074",
    calculationName: "Cumprimento de Sentença — Banco Bradesco",
    legalArea: "Civel",
    calculationType: "CumprimentoDeSentenca",
    obligationNature: "Dívida Civil Decorrente de Sentença",
    tribunal: "TJPI",
    state: "PI",
    city: "TERESINA",
    status: "VALIDATED",
    validationStatus: "VALIDATED",
    originalAmount: 100000,
    totalResult: 105820.45,
    engineVersion: CalculationEngine.ENGINE_VERSION,
    deterministicHash: "LHUB-A4F92B10-C891D4E2-F301A4BC-98124501",
    createdAt: "2026-09-15T14:30:00Z",
    updatedAt: "2026-09-15T14:30:00Z",
    items: [
      {
        id: "item-1",
        description: "Condenação em Obrigação de Pagar Principal",
        originalAmount: 100000,
        referenceDate: "2024-09-01",
        correctionStart: "2024-09-01",
        interestStart: "2024-09-01",
        finalDate: "2025-06-01",
      },
    ],
    payments: [],
    confirmedParameters: {
      index: "IPCA",
      interest: "TAXA_LEGAL",
      courtOrderConfirmed: true,
    },
    resolution: {
      status: "VALIDATED",
      legalRuleId: "rule-civil-debt-lei14905",
      legalRuleName: "Dívida Civil — Lei 14.905/2024",
      legislation: {
        law: "Lei nº 14.905/2024",
        article: "Art. 389 e 406 CC",
      },
      monetaryCorrection: {
        index: "IPCA",
        source: "IBGE Oficial",
        methodology: "IPCA mensal/pro rata",
        startDate: "2024-09-01",
      },
      interest: {
        type: "TAXA_LEGAL",
        source: "Banco Central do Brasil",
        methodology: "Spread Selic - IPCA-15, piso zero",
        startDate: "2024-09-01",
      },
      startDate: "2024-09-01",
      endDate: "2025-06-01",
      confidence: "HIGH",
      explanation: "Aplicação do novo regime do Código Civil reformado pela Lei 14.905/2024.",
    },
  },
  {
    id: "calc-2",
    tenantId: "tenant-demo",
    userId: "user-matheus",
    clientId: "cli-2",
    clientName: "Nexus Logística e Transportes S.A.",
    processNumber: "0825690-90.2020.8.18.0140",
    calculationName: "Execução Contratual — P. L. Indústria",
    legalArea: "Contratual",
    calculationType: "Execucao",
    obligationNature: "Contrato Empresarial Inadimplido",
    tribunal: "TJPI",
    state: "PI",
    city: "TERESINA",
    status: "VALIDATED",
    validationStatus: "VALIDATED",
    originalAmount: 45000,
    totalResult: 52140.8,
    engineVersion: CalculationEngine.ENGINE_VERSION,
    deterministicHash: "LHUB-77E2A109-8B19C33D-44AA1100-BCEF9912",
    createdAt: "2026-09-17T11:00:00Z",
    updatedAt: "2026-09-17T11:00:00Z",
    items: [
      {
        id: "item-2",
        description: "Saldo Devedor de Título Executivo Extrajudicial",
        originalAmount: 45000,
        referenceDate: "2024-01-15",
        correctionStart: "2024-01-15",
        interestStart: "2024-01-15",
        finalDate: "2025-01-15",
      },
    ],
    payments: [],
    confirmedParameters: {},
  },
];

export class LegalCalculatorService {
  /**
   * Obtém todos os cálculos registrados.
   */
  static getCalculations(): CalculationRecord[] {
    if (typeof window === "undefined") return INITIAL_BENCHMARK_CALCULATIONS;
    try {
      const raw = localStorage.getItem(STORAGE_CALCULATIONS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return INITIAL_BENCHMARK_CALCULATIONS;
  }

  /**
   * Salva lista de cálculos.
   */
  static saveCalculations(calcs: CalculationRecord[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_CALCULATIONS_KEY, JSON.stringify(calcs));
    } catch {}
  }

  /**
   * Salva ou atualiza um cálculo específico.
   */
  static saveCalculation(calc: CalculationRecord): CalculationRecord {
    const list = this.getCalculations();
    const idx = list.findIndex((c) => c.id === calc.id);
    if (idx >= 0) {
      list[idx] = { ...calc, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(calc);
    }
    this.saveCalculations(list);
    return calc;
  }

  /**
   * Obtém um cálculo por ID.
   */
  static getCalculationById(id: string): CalculationRecord | undefined {
    return this.getCalculations().find((c) => c.id === id);
  }

  /**
   * Executa a reprodução exata de um cálculo histórico para garantir imutabilidade.
   * ORIGINAL = REPRODUCED
   */
  static reproduceCalculation(id: string) {
    const stored = this.getCalculationById(id);
    if (!stored) throw new Error("Cálculo não encontrado para reprodução.");
    return this.reproduceRecord(stored);
  }

  /**
   * Reproduz um cálculo já carregado da base (sem depender do navegador).
   */
  static reproduceRecord(calc: CalculationRecord): {
    match: boolean;
    originalTotal: number;
    reproducedTotal: number;
    originalHash: string;
    reproducedHash: string;
    diff: number;
  } {

    const newlyCalculated = CalculationEngine.execute({
      calculationId: calc.id,
      items: calc.items,
      payments: calc.payments,
      resolution: calc.resolution,
      penaltyPercent:
        typeof calc.confirmedParameters["penaltyPercent"] === "number"
          ? calc.confirmedParameters["penaltyPercent"]
          : undefined,
      honoraryPercent:
        typeof calc.confirmedParameters["honoraryPercent"] === "number"
          ? calc.confirmedParameters["honoraryPercent"]
          : undefined,
    });

    const originalTotal = calc.totalResult || (calc.result ? calc.result.total : 0);
    const reproducedTotal = newlyCalculated.total;
    const diff = Math.abs(originalTotal - reproducedTotal);
    const match = diff < 0.01;

    return {
      match,
      originalTotal,
      reproducedTotal,
      originalHash: calc.deterministicHash || "N/A",
      reproducedHash: newlyCalculated.deterministicHash,
      diff,
    };
  }

  /**
   * Simula a leitura e extração inteligente de parâmetros da decisão judicial por IA.
   * Retorna parâmetros identificados que exigem confirmação explícita do usuário.
   */
  static extractParametersFromText(text: string): Array<{
    key: string;
    label: string;
    suggestedValue: any;
    status: "CONFIRMED" | "EDITED" | "IGNORED" | "PENDING";
    confidence: "HIGH" | "MEDIUM" | "LOW";
    rationale: string;
  }> {
    const lower = text.toLowerCase();

    const parameters: Array<{
      key: string;
      label: string;
      suggestedValue: any;
      status: "CONFIRMED" | "EDITED" | "IGNORED" | "PENDING";
      confidence: "HIGH" | "MEDIUM" | "LOW";
      rationale: string;
    }> = [];

    // Detecção de Índice Monetário
    if (lower.includes("ipca") || lower.includes("lei 14.905")) {
      parameters.push({
        key: "specifiedIndex",
        label: "Correção Monetária pelo IPCA (Art. 389 CC)",
        suggestedValue: "IPCA",
        status: "PENDING",
        confidence: "HIGH",
        rationale: "Identificada menção expressa à atualização pelo IPCA ou ao regime da Lei 14.905/2024 na decisão judicial.",
      });
    } else if (lower.includes("inpc")) {
      parameters.push({
        key: "specifiedIndex",
        label: "Correção Monetária pelo INPC",
        suggestedValue: "INPC",
        status: "PENDING",
        confidence: "MEDIUM",
        rationale: "Identificada menção ao índice INPC no corpo da decisão.",
      });
    }

    // Detecção de Juros de Mora / Taxa Legal
    if (lower.includes("taxa legal") || lower.includes("art. 406") || lower.includes("lei 14.905")) {
      parameters.push({
        key: "interestType",
        label: "Juros de Mora pela Taxa Legal (Art. 406 CC)",
        suggestedValue: "TAXA_LEGAL",
        status: "PENDING",
        confidence: "HIGH",
        rationale: "Identificada incidência da Taxa Legal nos termos da Lei 14.905/2024 e regulamentação do Banco Central.",
      });
    } else if (lower.includes("1% ao mês") || lower.includes("1% a.m.")) {
      parameters.push({
        key: "specifiedInterestRate",
        label: "Juros Moratórios de 1% ao Mês",
        suggestedValue: 1.0,
        status: "PENDING",
        confidence: "HIGH",
        rationale: "Decisão fixou taxa expressa de 1% (um por cento) ao mês para os juros moratórios.",
      });
    }

    // Detecção do Termo Inicial de Juros (Citação ou Vencimento)
    if (lower.includes("a contar da citação") || lower.includes("partir da citação") || lower.includes("art. 405")) {
      parameters.push({
        key: "interestStartDate",
        label: "Termo Inicial dos Juros: Data da Citação",
        suggestedValue: "CITACAO",
        status: "PENDING",
        confidence: "HIGH",
        rationale: "Determinação expressa para cômputo de juros a partir da citação (art. 405 do Código Civil).",
      });
    }

    // Detecção de Multa do Artigo 523 do CPC (10%)
    if (lower.includes("art. 523") || lower.includes("multa de 10%")) {
      parameters.push({
        key: "penaltyPercent",
        label: "Multa Processual de 10% (Art. 523, § 1º, CPC)",
        suggestedValue: 10,
        status: "PENDING",
        confidence: "HIGH",
        rationale: "Identificado cumprimento definitivo de sentença com incidência de multa por ausência de pagamento voluntário.",
      });
    }

    // Se nenhum parâmetro for detectado, fornece sugestões padrão seguras
    if (parameters.length === 0) {
      parameters.push({
        key: "specifiedIndex",
        label: "Índice Legal Geral: IPCA",
        suggestedValue: "IPCA",
        status: "PENDING",
        confidence: "MEDIUM",
        rationale: "Não houve fixação específica de índice no trecho; sugere-se a aplicação da regra geral do art. 389 do CC.",
      });
    }

    return parameters;
  }

  /**
   * Obtém casos de teste do Laboratório de Testes.
   */
  static getTestCases(): CalculationTestCase[] {
    if (typeof window === "undefined") return BENCHMARK_TEST_CASES;
    try {
      const raw = localStorage.getItem(STORAGE_TEST_CASES_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return BENCHMARK_TEST_CASES;
  }

  /**
   * Executa a suíte de testes de regressão do Test Lab.
   */
  static runTestLab(): {
    passed: number;
    failed: number;
    total: number;
    results: Array<{ id: string; name: string; status: "PASSED" | "FAILED"; message: string; durationMs: number }>;
  } {
    const cases = this.getTestCases();
    let passed = 0;
    let failed = 0;

    const results = cases.map((tc) => {
      const start = Date.now();
      try {
        const resolution = LegalRuleResolver.resolve({
          calculationType: "Execucao",
          legalArea: tc.input.legalArea,
          obligationNature: tc.input.obligationNature,
          dueDate: tc.input.startDate,
          citationDate: tc.input.citationDate,
          paymentDate: tc.input.endDate,
        });

        const res = CalculationEngine.execute({
          calculationId: `test-${tc.id}`,
          items: [
            {
              description: tc.name,
              originalAmount: tc.input.principal,
              referenceDate: tc.input.startDate,
              finalDate: tc.input.endDate,
            },
          ],
          resolution,
          payments: tc.input.payments,
        });

        const diff = Math.abs(res.total - tc.expectedOutput.total);
        const isOk = diff <= (tc.expectedOutput.total * (tc.expectedOutput.tolerance / 100));

        if (isOk) {
          passed++;
          return {
            id: tc.id,
            name: tc.name,
            status: "PASSED" as const,
            message: `Aprovado: Calculado R$ ${res.total.toFixed(2)} (Esperado: R$ ${tc.expectedOutput.total.toFixed(2)}) com desvio de ${diff.toFixed(2)}.`,
            durationMs: Date.now() - start,
          };
        } else {
          failed++;
          return {
            id: tc.id,
            name: tc.name,
            status: "FAILED" as const,
            message: `Divergência: Calculado R$ ${res.total.toFixed(2)}, Esperado R$ ${tc.expectedOutput.total.toFixed(2)}.`,
            durationMs: Date.now() - start,
          };
        }
      } catch (e: any) {
        failed++;
        return {
          id: tc.id,
          name: tc.name,
          status: "FAILED" as const,
          message: `Erro na execução: ${e.message}`,
          durationMs: Date.now() - start,
        };
      }
    });

    return { passed, failed, total: cases.length, results };
  }
}
