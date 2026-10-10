/**
 * NAVOR LAWHUB — RESOLVEDOR DE REGRAS JURÍDICAS (LegalRuleResolver)
 * Determina com base na hierarquia oficial de fontes qual é o fundamento legal,
 * jurisprudencial, índice e termo aplicáveis ao caso concreto.
 */

import { LegalRuleResolverInput, LegalRuleResolution } from "../types";

export class LegalRuleResolver {
  /**
   * Resolve a regra jurídica aplicável observando estritamente os fatos e a hierarquia legal.
   */
  static resolve(input: LegalRuleResolverInput): LegalRuleResolution {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = input.dueDate || input.eventDate || input.citationDate || "2024-01-01";
    const endDate = input.paymentDate || today;

    // Caso 1: Havendo determinação judicial expressa na sentença/acórdão (Prioridade 5 da decisão do processo)
    if (input.judgmentParameters?.hasCourtOrder && input.judgmentParameters.specifiedIndex) {
      return {
        status: "RESOLVED",
        legalRuleId: "rule-court-order",
        legalRuleVersionId: "v-court-order-1",
        legalRuleName: "Determinação Judicial Específica dos Autos",
        legislation: {
          law: "Código de Processo Civil (Lei 13.105/2015)",
          article: "Art. 502",
          paragraph: "Coisa Julgada Material",
        },
        monetaryCorrection: {
          index: input.judgmentParameters.specifiedIndex,
          source: "Sentença / Acórdão Judicial Transitado em Julgado",
          methodology: "Aplicação direta dos parâmetros fixados no dispositivo da decisão judicial.",
          startDate: input.judgmentParameters.correctionStartDate || startDate,
        },
        interest: {
          type: "SIMPLES",
          rate: input.judgmentParameters.specifiedInterestRate || 1.0,
          source: "Fixação Judicial Expressa",
          methodology: "Juros moratórios nos exatos termos deferidos pelo magistrado.",
          startDate: input.judgmentParameters.interestStartDate || input.citationDate || startDate,
        },
        startDate,
        endDate,
        confidence: "HIGH",
        explanation: "O cálculo observará a determinação contida no título executivo judicial, prevalecendo a ordem judicial expressa sobre índices genéricos.",
      };
    }

    // Caso 2: Obrigações Cíveis Gerais / Dívida Civil Contratual e Extracontratual
    if (input.legalArea === "Civel" || input.obligationNature?.toLowerCase().includes("civil") || input.obligationNature?.toLowerCase().includes("contratual")) {
      return this.resolveCivilDebtRule(input, startDate, endDate);
    }

    // Caso 3: Indenizações por Danos Morais (Súmula 362 e 54 do STJ)
    if (input.obligationNature?.toLowerCase().includes("dano moral") || input.obligationNature?.toLowerCase().includes("indeniz")) {
      return {
        status: "RESOLVED",
        legalRuleId: "rule-civil-moral-damages",
        legalRuleVersionId: "v-moral-damages-2024",
        legalRuleName: "Indenização por Danos Morais — Súmulas 362 e 54 do STJ",
        legislation: {
          law: "Código Civil e Súmulas Vinculantes do STJ",
          article: "Súmula 362 e 54",
          paragraph: "Jurisprudência Qualificada",
        },
        jurisprudence: {
          court: "STJ",
          theme: "Termo Inicial de Correção e Juros em Danos Morais",
          thesis: "A correção monetária incide desde a data do arbitramento (Súmula 362/STJ). Os juros moratórios fluem a partir do evento danoso na responsabilidade extracontratual (Súmula 54/STJ) ou da citação na contratual.",
        },
        monetaryCorrection: {
          index: "IPCA",
          source: "IBGE / Lei 14.905/2024",
          methodology: "IPCA acumulado a partir da data de fixação da indenização.",
          startDate: input.judgmentDate || startDate,
        },
        interest: {
          type: "TAXA_LEGAL",
          source: "Banco Central do Brasil / Art. 406 CC",
          methodology: "Taxa Legal apurada pela variação da Taxa Selic deduzida do IPCA-15.",
          startDate: input.citationDate || startDate,
        },
        startDate,
        endDate,
        confidence: "HIGH",
        explanation: "Aplicação da Súmula 362 do STJ (correção monetária a partir do arbitramento) e art. 405 do Código Civil (juros a partir da citação).",
      };
    }

    // Caso 4: Relações de Consumo (Código de Defesa do Consumidor - CDC)
    if (input.legalArea === "Consumidor") {
      return {
        status: "RESOLVED",
        legalRuleId: "rule-consumer-debt",
        legalRuleVersionId: "v-cdc-2024",
        legalRuleName: "Repetição de Indébito e Danos ao Consumidor (CDC)",
        legislation: {
          law: "Lei nº 8.078/1990 (Código de Defesa do Consumidor)",
          article: "Art. 42, Parágrafo único",
          paragraph: "Repetição do Indébito",
        },
        monetaryCorrection: {
          index: "IPCA",
          source: "IBGE / Art. 389 CC",
          methodology: "Atualização monetária desde a data de cada desembolso indevido.",
          startDate,
        },
        interest: {
          type: "TAXA_LEGAL",
          source: "Art. 406 do CC c/c Lei 14.905/2024",
          methodology: "Taxa Legal a partir da citação judicial.",
          startDate: input.citationDate || startDate,
        },
        startDate,
        endDate,
        confidence: "HIGH",
        explanation: "Correção monetária desde cada desembolso (Súmula 43/STJ) e juros legais moratórios a contar da citação.",
      };
    }

    // Caso 5: Se faltarem elementos essenciais para identificar o marco de juros
    if (!input.citationDate && !input.dueDate && !input.eventDate) {
      return {
        status: "NEEDS_CONFIRMATION",
        startDate,
        endDate,
        confidence: "LOW",
        requiredUserConfirmation: ["Data de Vencimento da Obrigação", "Data de Citação da Parte Ré"],
        explanation: "Não foi possível determinar automaticamente o termo inicial dos juros e da correção sem o vencimento do título ou a data de citação.",
      };
    }

    // Regra residual geral de obrigações civis com IPCA e Taxa Legal
    return this.resolveCivilDebtRule(input, startDate, endDate);
  }

  /**
   * Resolução da Dívida Civil com versionamento estrito (Lei 14.905/2024 e Tema 1368 STJ).
   */
  private static resolveCivilDebtRule(
    input: LegalRuleResolverInput,
    startDate: string,
    endDate: string
  ): LegalRuleResolution {
    const isPostLei14905 = startDate >= "2024-08-30";

    if (isPostLei14905) {
      return {
        status: "RESOLVED",
        legalRuleId: "rule-civil-debt-lei14905",
        legalRuleVersionId: "v-lei14905-2024",
        legalRuleName: "Dívida Civil — Lei 14.905/2024 (Novo Regime Legal)",
        legislation: {
          law: "Lei nº 14.905, de 28 de junho de 2024",
          article: "Art. 389 e Art. 406 do Código Civil",
          paragraph: "Vigência a partir de 30/08/2024",
        },
        jurisprudence: {
          court: "STJ / Banco Central",
          theme: "Regulamentação da Taxa Legal pelo Banco Central",
          thesis: "A correção monetária é realizada pelo IPCA (art. 389 CC) e os juros de mora pela Taxa Legal calculada pela diferença entre a taxa Selic e o IPCA-15 (art. 406 CC).",
        },
        monetaryCorrection: {
          index: "IPCA",
          source: "IBGE (Série Oficial)",
          methodology: "Correção monetária pelo IPCA calculada pro rata mês/die desde o vencimento.",
          startDate,
        },
        interest: {
          type: "TAXA_LEGAL",
          source: "Banco Central do Brasil / SGS",
          methodology: "Taxa Legal oficial do Banco Central (Selic deduzida do IPCA-15, piso zero).",
          startDate: input.citationDate || startDate,
        },
        startDate,
        endDate,
        confidence: "HIGH",
        explanation: "Dívida originada sob a égide da Lei 14.905/2024. Aplica-se expressamente o IPCA para recomposição da moeda e a Taxa Legal do Banco Central para juros de mora.",
      };
    }

    // Período anterior a 30/08/2024: Tema 1368 do STJ e transição legal
    return {
      status: "RESOLVED",
      legalRuleId: "rule-civil-debt-transicao",
      legalRuleVersionId: "v-tema1368-transicao",
      legalRuleName: "Dívida Civil — Período Anterior à Lei 14.905/2024 (Tema 1368/STJ)",
      legislation: {
        law: "Código Civil de 2002 c/c Lei 14.905/2024",
        article: "Art. 406 (Redação originária) e Tema 1368/STJ",
        paragraph: "Transição Temporal",
      },
      jurisprudence: {
        court: "STJ - Corte Especial",
        theme: "Tema 1368 (REsp 1.795.982/SP)",
        thesis: "Para o período anterior à Lei 14.905/2024, a taxa de juros moratórios a que se refere o art. 406 do Código Civil é a taxa referencial do Sistema Especial de Liquidação e Custódia (Selic), vedada a cumulação com qualquer outro índice de correção monetária.",
      },
      monetaryCorrection: {
        index: "IPCA",
        source: "IBGE / Lei 14.905/2024",
        methodology: "Atualização monetária pelo IPCA, com aplicação da Taxa Legal nos períodos subsequentes à reforma legal.",
        startDate,
      },
      interest: {
        type: "TAXA_LEGAL",
        rate: 1.0,
        source: "STJ Tema 1368 / Banco Central",
        methodology: "Transição: SELIC no período anterior conforme o título ou Taxa Legal pós-agosto de 2024.",
        startDate: input.citationDate || startDate,
      },
      startDate,
      endDate,
      confidence: "HIGH",
      explanation: "Obrigação civil iniciada antes de 30/08/2024. O motor divide a liquidação respeitando a tese firmada no Tema 1368 do STJ e a transição para a Lei 14.905/2024.",
    };
  }
}
