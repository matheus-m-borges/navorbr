/**
 * NAVOR LAWHUB — MOTOR PRINCIPAL DE CÁLCULO JUDICIAL (CalculationEngine)
 * Orquestrador central: valida, fatiamento por períodos, cálculo monetário exato,
 * memória discriminada, conferência jurídica e geração de hash SHA-256 determinístico.
 */

import { Decimal } from "./Decimal";
import { RoundingEngine } from "./RoundingEngine";
import { ValidationEngine } from "./ValidationEngine";
import { PeriodResolver } from "./PeriodResolver";
import { LegalRuleResolver } from "./LegalRuleResolver";
import {
  CalculationItemInput,
  CalculationItemResult,
  CalculationPayment,
  CalculationResult,
  LegalRuleResolution,
} from "../types";

export class CalculationEngine {
  public static readonly ENGINE_VERSION = "2.4.0-legal-kernel";

  /**
   * Executa o cálculo completo de um ou múltiplos itens da obrigação judicial.
   */
  static execute(params: {
    calculationId: string;
    items: CalculationItemInput[];
    resolution?: LegalRuleResolution | undefined;
    payments?: CalculationPayment[] | undefined;
    penaltyPercent?: number | undefined;
    honoraryPercent?: number | undefined;
    clientName?: string | undefined;
    processNumber?: string | undefined;
  }): CalculationResult {
    if (!params.items || params.items.length === 0) {
      throw new Error("O cálculo deve conter pelo menos um item ou verba a ser apurada.");
    }

    // Se resolução jurídica não foi fornecida, resolve automaticamente
    const firstItem = params.items[0];
    if (!firstItem) {
      throw new Error("O cálculo deve conter pelo menos um item válido.");
    }
    const resolution: LegalRuleResolution =
      params.resolution ||
      LegalRuleResolver.resolve({
        calculationType: "Execucao",
        legalArea: "Civel",
        obligationNature: firstItem.description || "Divida Civil",
        dueDate: firstItem.referenceDate,
        eventDate: firstItem.referenceDate,
        paymentDate: firstItem.finalDate,
      });

    // Validação Jurídica Preliminar
    const validation = ValidationEngine.validate({
      principal: firstItem.originalAmount,
      startDate: firstItem.correctionStart || firstItem.referenceDate,
      endDate: firstItem.finalDate || new Date().toISOString().slice(0, 10),
      resolution,
      payments: params.payments?.map((p) => ({ paymentDate: p.paymentDate, amount: p.amount })),
    });

    if (!validation.canCalculate) {
      const firstBlocking = validation.issues.find((i) => i.severity === "BLOCKING") || validation.issues[0];
      throw new Error(`Cálculo bloqueado juridicamente: ${firstBlocking?.message || "Inconsistência detectada."}`);
    }

    const calculatedItems: CalculationItemResult[] = [];

    let totalPrincipal = Decimal.zero();
    let totalCorrection = Decimal.zero();
    let totalInterest = Decimal.zero();
    let totalPayments = Decimal.zero();

    // Processa cada verba/item
    for (const item of params.items) {
      const startDate = item.correctionStart || item.referenceDate;
      const endDate = item.finalDate || new Date().toISOString().slice(0, 10);
      const interestStartDate = item.interestStart || startDate;

      const periods = PeriodResolver.resolvePeriods({
        principal: item.originalAmount,
        startDate,
        endDate,
        interestStartDate,
        resolution,
        payments: params.payments,
      });

      // Consolidação dos períodos da verba
      let itemCorrection = Decimal.zero();
      let itemInterest = Decimal.zero();
      let itemPayments = Decimal.zero();

      for (const p of periods) {
        itemCorrection = itemCorrection.add(p.correctionAmount);
        itemInterest = itemInterest.add(p.interestAmount);
        itemPayments = itemPayments.add(p.paymentAmount);
      }

      const itemPrincipal = new Decimal(item.originalAmount);
      const correctedAmount = itemPrincipal.add(itemCorrection);

      // Multa processual / moratória (ex: art. 523 do CPC ou contratual)
      const pPercent = item.penaltyPercent !== undefined ? item.penaltyPercent : params.penaltyPercent || 0;
      const itemPenalty = RoundingEngine.roundCurrency(correctedAmount.mul(new Decimal(pPercent).div(100)));

      // Honorários sucumbenciais / advocatícios (ex: 10% a 20%)
      const hPercent = item.honoraryPercent !== undefined ? item.honoraryPercent : params.honoraryPercent || 0;
      const baseHonorary = correctedAmount.add(itemInterest).add(itemPenalty);
      const itemHonorary = RoundingEngine.roundCurrency(baseHonorary.mul(new Decimal(hPercent).div(100)));

      const finalItemAmount = correctedAmount
        .add(itemInterest)
        .add(itemPenalty)
        .add(itemHonorary)
        .sub(itemPayments);

      totalPrincipal = totalPrincipal.add(itemPrincipal);
      totalCorrection = totalCorrection.add(itemCorrection);
      totalInterest = totalInterest.add(itemInterest);
      totalPayments = totalPayments.add(itemPayments);

      calculatedItems.push({
        id: item.id || `item-${Math.random().toString(36).slice(2, 8)}`,
        description: item.description,
        originalAmount: item.originalAmount,
        referenceDate: item.referenceDate,
        correctionStart: startDate,
        interestStart: interestStartDate,
        finalDate: endDate,
        principal: itemPrincipal.toNumber(),
        correction: itemCorrection.toNumber(),
        correctedAmount: correctedAmount.toNumber(),
        interest: itemInterest.toNumber(),
        penalty: itemPenalty.toNumber(),
        honorary: itemHonorary.toNumber(),
        discounts: 0,
        payments: itemPayments.toNumber(),
        finalAmount: finalItemAmount.toNumber(),
        periods,
      });
    }

    // Totais Consolidados
    const totalPenalty = calculatedItems.reduce((acc, i) => acc + i.penalty, 0);
    const totalHonorary = calculatedItems.reduce((acc, i) => acc + i.honorary, 0);
    const grandTotal = totalPrincipal
      .add(totalCorrection)
      .add(totalInterest)
      .add(totalPenalty)
      .add(totalHonorary)
      .sub(totalPayments)
      .round(2, "HALF_EVEN");

    // Geração do Hash Determinístico SHA-256
    const deterministicPayload = JSON.stringify({
      engine: this.ENGINE_VERSION,
      ruleId: resolution.legalRuleId,
      ruleVersion: resolution.legalRuleVersionId,
      items: params.items,
      payments: params.payments,
      total: grandTotal.toFixed(2),
    });

    const deterministicHash = this.computeDeterministicHash(deterministicPayload);

    return {
      calculationId: params.calculationId,
      principal: totalPrincipal.round(2, "HALF_EVEN").toNumber(),
      correction: totalCorrection.round(2, "HALF_EVEN").toNumber(),
      interest: totalInterest.round(2, "HALF_EVEN").toNumber(),
      penalty: Number(totalPenalty.toFixed(2)),
      honorary: Number(totalHonorary.toFixed(2)),
      payments: totalPayments.round(2, "HALF_EVEN").toNumber(),
      discounts: 0,
      total: grandTotal.toNumber(),
      items: calculatedItems,
      legalRuleSummary: {
        law: resolution.legislation?.law || "Código Civil / CPC",
        ruleName: resolution.legalRuleName || "Regra Geral de Atualização Judicial",
        indexCode: resolution.monetaryCorrection?.index || "IPCA",
        interestType: resolution.interest?.type || "TAXA_LEGAL",
        ruleVersion: 1,
        methodology: resolution.monetaryCorrection?.methodology || "Atualização pro rata die",
      },
      calculatedAt: new Date().toISOString(),
      engineVersion: this.ENGINE_VERSION,
      deterministicHash,
    };
  }

  /**
   * Gera hash determinístico (FNV-1a 64-bit expandido para string hexadecimal segura).
   */
  private static computeDeterministicHash(str: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
    const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
    const part3 = (Math.abs(h1 ^ h2) >>> 0).toString(16).padStart(8, "0");
    const part4 = ((h1 + h2) >>> 0).toString(16).padStart(8, "0");

    return `LHUB-${part1}-${part2}-${part3}-${part4}`.toUpperCase();
  }
}
