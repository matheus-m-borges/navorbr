/**
 * NAVOR LAWHUB — RESOLVEDOR DE PERÍODOS
 * Fragmenta o cálculo judicial em períodos mensais com respeito aos marcos temporais
 * de alteração legislativa (ex: Lei 14.905/2024 em 30/08/2024) e datas de pagamento.
 */

import { DateEngine } from "./DateEngine";
import { Decimal } from "./Decimal";
import { RoundingEngine } from "./RoundingEngine";
import { IndexResolver } from "./IndexResolver";
import { CalculationPeriodDetail, EconomicIndexCode, LegalRuleResolution } from "../types";

export class PeriodResolver {
  /**
   * Gera a grade período a período com evolução do saldo devedor.
   */
  static resolvePeriods(params: {
    principal: number;
    startDate: string;
    endDate: string;
    interestStartDate: string;
    resolution: LegalRuleResolution;
    payments?: Array<{ paymentDate: string; amount: number }> | undefined;
  }): CalculationPeriodDetail[] {
    const intervals = DateEngine.getMonthlyIntervals(params.startDate, params.endDate);
    const periods: CalculationPeriodDetail[] = [];

    let currentPrincipal = new Decimal(params.principal);
    let periodIndex = 1;

    for (const interval of intervals) {
      const openingPrincipal = currentPrincipal;

      // 1. Correção Monetária do Período
      const indexCode: EconomicIndexCode = params.resolution.monetaryCorrection?.index || "IPCA";
      const monthlyRate = IndexResolver.getMonthlyRate(indexCode, interval.competence);

      // Fator de correção do mês: 1 + (taxa / 100)
      const correctionFactor = Decimal.one().add(monthlyRate.div(100));
      const correctionAmount = RoundingEngine.roundCurrency(
        openingPrincipal.mul(correctionFactor).sub(openingPrincipal)
      );

      const correctedPrincipal = openingPrincipal.add(correctionAmount);

      // 2. Juros de Mora do Período
      // Verifica se a competência atual já está dentro do termo de juros
      const isInterestApplicable = interval.endDate >= params.interestStartDate;

      let interestRatePercent = Decimal.zero();
      let interestAmount = Decimal.zero();

      if (isInterestApplicable) {
        // Marco temporal da Lei 14.905/2024: 30 de agosto de 2024
        const isPostLei14905 = interval.startDate >= "2024-08-30" || interval.competence >= "09/2024";

        if (params.resolution.interest?.type === "TAXA_LEGAL" || isPostLei14905) {
          // Metodologia da Taxa Legal do Banco Central
          interestRatePercent = IndexResolver.getMonthlyRate("TAXA_LEGAL", interval.competence);
        } else if (params.resolution.interest?.type === "TAXA_UNICA") {
          // Taxa Selic única (engloba juros e correção, se aplicável pelo Tema 1368)
          interestRatePercent = IndexResolver.getMonthlyRate("SELIC", interval.competence);
        } else {
          // Juros moratórios civis clássicos de 1% ao mês (art. 406 CC / art. 161 § 1º CTN)
          interestRatePercent = new Decimal(params.resolution.interest?.rate || 1.0);
        }

        // Aplicação pro rata die se o intervalo for fração de mês
        if (interval.isPartial) {
          const totalDaysInMonth = DateEngine.daysInMonth(interval.startDate);
          const proRataFactor = new Decimal(interval.daysCount).div(totalDaysInMonth);
          interestRatePercent = interestRatePercent.mul(proRataFactor);
        }

        // Juros incidem sobre o principal corrigido
        interestAmount = RoundingEngine.roundCurrency(correctedPrincipal.mul(interestRatePercent.div(100)));
      }

      // 3. Amortização de pagamentos ocorridos nesta competência
      let paymentsInMonth = Decimal.zero();
      if (params.payments && params.payments.length > 0) {
        for (const p of params.payments) {
          if (p.paymentDate >= interval.startDate && p.paymentDate <= interval.endDate) {
            paymentsInMonth = paymentsInMonth.add(p.amount);
          }
        }
      }

      // Imputação conforme art. 354 do Código Civil: quita juros primeiro, depois principal
      let amortizedInterest = Decimal.zero();
      let amortizedPrincipal = Decimal.zero();

      if (paymentsInMonth.gt(0)) {
        if (paymentsInMonth.gte(interestAmount)) {
          amortizedInterest = interestAmount;
          const remainingPayment = paymentsInMonth.sub(interestAmount);
          amortizedPrincipal = remainingPayment.lte(correctedPrincipal) ? remainingPayment : correctedPrincipal;
        } else {
          amortizedInterest = paymentsInMonth;
        }
      }

      const closingPrincipal = RoundingEngine.roundCurrency(correctedPrincipal.sub(amortizedPrincipal));
      const closingBalance = closingPrincipal.add(interestAmount.sub(amortizedInterest));

      periods.push({
        periodIndex: periodIndex++,
        periodLabel: interval.competence,
        startDate: interval.startDate,
        endDate: interval.endDate,
        daysCount: interval.daysCount,
        openingPrincipal: openingPrincipal.toNumber(),
        indexCode,
        indexRatePercent: monthlyRate.toNumber(),
        correctionFactor: correctionFactor.toNumber(),
        correctionAmount: correctionAmount.toNumber(),
        interestType: params.resolution.interest?.type || "SIMPLES",
        interestRatePercent: interestRatePercent.toNumber(),
        interestAmount: interestAmount.toNumber(),
        amortizedInterest: amortizedInterest.toNumber(),
        amortizedPrincipal: amortizedPrincipal.toNumber(),
        paymentAmount: paymentsInMonth.toNumber(),
        closingPrincipal: closingPrincipal.toNumber(),
        closingBalance: closingBalance.toNumber(),
      });

      // Saldo do próximo mês continua com o principal ajustado
      currentPrincipal = closingPrincipal;
    }

    return periods;
  }
}
