/**
 * NAVOR LAWHUB — MOTOR DE ARREDONDAMENTO JUDICIAL
 * Padronização conforme ABNT NBR 5891 e práticas dos manuais de cálculo da Justiça Federal/Estadual.
 */

import { Decimal, RoundingMode } from "./Decimal";

export class RoundingEngine {
  /**
   * Arredonda valor financeiro final para 2 casas decimais (Centavos).
   * Padrão oficial: HALF_EVEN (evita viés estatístico de acumulação).
   */
  static roundCurrency(amount: Decimal | number | string, mode: RoundingMode = "HALF_EVEN"): Decimal {
    const d = amount instanceof Decimal ? amount : new Decimal(amount);
    return d.round(2, mode);
  }

  /**
   * Arredonda fatores de correção acumulados.
   * Os tribunais e o CJF recomendam preservar de 6 a 8 casas decimais nos fatores intermediários.
   */
  static roundFactor(factor: Decimal | number | string, decimals = 8, mode: RoundingMode = "HALF_EVEN"): Decimal {
    const d = factor instanceof Decimal ? factor : new Decimal(factor);
    return d.round(decimals, mode);
  }

  /**
   * Arredonda taxas percentuais mensais ou anuais (ex: 1.00%, 0.9412%).
   */
  static roundRate(rate: Decimal | number | string, decimals = 6): Decimal {
    const d = rate instanceof Decimal ? rate : new Decimal(rate);
    return d.round(decimals, "HALF_EVEN");
  }

  /**
   * Formata número para moeda brasileira (R$ 1.234,56).
   */
  static formatBRL(amount: Decimal | number | string): string {
    const d = amount instanceof Decimal ? amount : new Decimal(amount);
    return d.toCurrency();
  }
}
