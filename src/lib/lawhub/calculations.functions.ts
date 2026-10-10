/**
 * NAVOR LAWHUB — PERSISTÊNCIA DOS CÁLCULOS JURÍDICOS
 * Server functions que gravam e leem os cálculos nas tabelas oficiais
 * (calculations, calculation_items, calculation_payments, calculation_parameters,
 * calculation_audits), sempre isolados por conta e usuário.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CalculationRecord } from "@/modules/legal-calculator/types";
import { requireAuthenticatedAccount } from "@/core/security/authorization.server";

const DOCUMENT_PARAM = "__decision_document_text__";

type AnyClient = any;

/**
 * Resolve uma conta autorizada sem escolher uma membership implicitamente.
 * Um platform admin sem membership só pode operar quando a conta-alvo é
 * informada explicitamente e validada pelo resolvedor central.
 */
async function resolveScope(userSupabase: AnyClient, userId: string, requestedAccountId?: string | null) {
  const scope = await requireAuthenticatedAccount(userId, requestedAccountId);
  return { accountId: scope.accountId, db: userSupabase as AnyClient };
}

function toDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.slice(0, 10);
}

/** Lista os cálculos da conta do usuário logado, com itens, pagamentos e parâmetros. */
export const listCalculations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { accountId?: string | null }) => input ?? {})
  .handler(async ({ data, context }): Promise<CalculationRecord[]> => {
    const { accountId, db } = await resolveScope(context.supabase, context.userId, data.accountId);

    const { data: rows, error } = await db
      .from("calculations")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    const ids = rows.map((r: any) => r.id as string);

    const [{ data: items }, { data: payments }, { data: params }] = await Promise.all([
      db.from("calculation_items").select("*").in("calculation_id", ids),
      db.from("calculation_payments").select("*").in("calculation_id", ids),
      db.from("calculation_parameters").select("*").in("calculation_id", ids),
    ]);

    return rows.map((row: any) => {
      const rowItems = (items ?? []).filter((i: any) => i.calculation_id === row.id);
      const rowPayments = (payments ?? []).filter((p: any) => p.calculation_id === row.id);
      const rowParams = (params ?? []).filter((p: any) => p.calculation_id === row.id);

      const confirmedParameters: Record<string, any> = {};
      let extractedDocumentText: string | undefined;
      const extractedParameters: NonNullable<CalculationRecord["extractedParameters"]> = [];

      for (const p of rowParams) {
        if (p.parameter_name === DOCUMENT_PARAM) {
          extractedDocumentText = typeof p.parameter_value === "string" ? p.parameter_value : undefined;
          continue;
        }
        if (p.source === "AI") {
          const v = (p.parameter_value ?? {}) as any;
          extractedParameters.push({
            key: p.parameter_name,
            label: v.label ?? p.parameter_name,
            suggestedValue: v.suggestedValue,
            status: v.status ?? "PENDING",
            confidence: v.confidence ?? "MEDIUM",
            rationale: v.rationale ?? "",
          });
        } else {
          confirmedParameters[p.parameter_name] = p.parameter_value;
        }
      }

      const record: CalculationRecord = {
        id: row.id,
        tenantId: row.account_id,
        userId: row.user_id,
        ...(row.client_id ? { clientId: row.client_id as string } : {}),
        ...(row.client_name ? { clientName: row.client_name as string } : {}),
        processNumber: row.process_number,
        calculationName: row.calculation_name,
        legalArea: row.legal_area,
        calculationType: row.calculation_type,
        obligationNature: row.obligation_nature,
        tribunal: row.tribunal,
        state: row.state,
        ...(row.city ? { city: row.city as string } : {}),
        status: row.status,
        validationStatus: row.validation_status,
        originalAmount: Number(row.original_amount ?? 0),
        ...(row.total_result === null || row.total_result === undefined
          ? {}
          : { totalResult: Number(row.total_result) }),
        engineVersion: row.engine_version,
        ...(row.deterministic_hash ? { deterministicHash: row.deterministic_hash as string } : {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: rowItems.map((i: any) => ({
          id: i.id,
          description: i.description,
          originalAmount: Number(i.original_amount ?? 0),
          referenceDate: i.reference_date,
          ...(i.due_date ? { dueDate: i.due_date } : {}),
          ...(i.correction_start ? { correctionStart: i.correction_start } : {}),
          ...(i.interest_start ? { interestStart: i.interest_start } : {}),
          ...(i.final_date ? { finalDate: i.final_date } : {}),
        })),
        payments: rowPayments.map((p: any) => ({
          id: p.id,
          paymentDate: p.payment_date,
          amount: Number(p.amount ?? 0),
          ...(p.description ? { description: p.description } : {}),
        })),
        confirmedParameters,
        ...(extractedDocumentText ? { extractedDocumentText } : {}),
        ...(extractedParameters.length > 0 ? { extractedParameters } : {}),
        ...(row.resolution_snapshot ? { resolution: row.resolution_snapshot } : {}),
        ...(row.result_snapshot ? { result: row.result_snapshot } : {}),
      };

      return record;
    });
  });

/** Grava (ou atualiza) um cálculo completo na conta do usuário logado. */
export const saveCalculation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { record: CalculationRecord }) => {
    if (!input?.record?.id) throw new Error("Cálculo inválido.");
    return input;
  })
  .handler(async ({ data, context }): Promise<CalculationRecord[]> => {
    const { accountId, db } = await resolveScope(context.supabase, context.userId, data.record.tenantId);
    const calc = data.record;
    const now = new Date().toISOString();

    const { error: upsertError } = await db.from("calculations").upsert(
      {
        id: calc.id,
        account_id: accountId,
        user_id: context.userId,
        client_id: calc.clientId ?? null,
        client_name: calc.clientName ?? null,
        process_number: calc.processNumber,
        calculation_name: calc.calculationName,
        legal_area: calc.legalArea,
        calculation_type: calc.calculationType,
        obligation_nature: calc.obligationNature,
        tribunal: calc.tribunal,
        state: calc.state,
        city: calc.city ?? null,
        status: calc.status,
        validation_status: calc.validationStatus,
        original_amount: calc.originalAmount,
        total_result: calc.totalResult ?? null,
        engine_version: calc.engineVersion,
        deterministic_hash: calc.deterministicHash ?? null,
        resolution_snapshot: calc.resolution ?? null,
        result_snapshot: calc.result ?? null,
        updated_at: now,
      },
      { onConflict: "id" }
    );
    if (upsertError) throw new Error(upsertError.message);

    // Reescreve os filhos do cálculo para manter a memória de cálculo coerente.
    await Promise.all([
      db.from("calculation_items").delete().eq("calculation_id", calc.id),
      db.from("calculation_payments").delete().eq("calculation_id", calc.id),
      db.from("calculation_parameters").delete().eq("calculation_id", calc.id),
    ]);

    const itemRows = (calc.items ?? []).map((item, index) => {
      const detail = calc.result?.items?.find((r: any) => r.description === item.description);
      return {
        id: item.id ?? `${calc.id}-item-${index + 1}`,
        calculation_id: calc.id,
        description: item.description,
        original_amount: item.originalAmount,
        reference_date: toDate(item.referenceDate),
        due_date: toDate((item as any).dueDate),
        correction_start: toDate((item as any).correctionStart),
        interest_start: toDate((item as any).interestStart),
        final_date: toDate((item as any).finalDate),
        principal: detail?.principal ?? item.originalAmount,
        correction: detail?.correction ?? 0,
        interest: detail?.interest ?? 0,
        penalty: detail?.penalty ?? 0,
        honorary: detail?.honorary ?? 0,
        payments: detail?.payments ?? 0,
        final_amount: detail?.finalAmount ?? item.originalAmount,
      };
    });
    if (itemRows.length > 0) {
      const { error } = await db.from("calculation_items").insert(itemRows);
      if (error) throw new Error(error.message);
    }

    const paymentRows = (calc.payments ?? []).map((p, index) => ({
      id: p.id ?? `${calc.id}-pay-${index + 1}`,
      calculation_id: calc.id,
      payment_date: toDate(p.paymentDate),
      amount: p.amount,
      description: (p as any).description ?? null,
    }));
    if (paymentRows.length > 0) {
      const { error } = await db.from("calculation_payments").insert(paymentRows);
      if (error) throw new Error(error.message);
    }

    const paramRows: any[] = Object.entries(calc.confirmedParameters ?? {}).map(([key, value]) => ({
      id: `${calc.id}-cp-${key}`,
      calculation_id: calc.id,
      parameter_name: key,
      parameter_value: value ?? null,
      source: "MANUAL",
      confirmed_by_user: true,
      confirmed_at: now,
    }));

    for (const p of calc.extractedParameters ?? []) {
      paramRows.push({
        id: `${calc.id}-ai-${p.key}`,
        calculation_id: calc.id,
        parameter_name: p.key,
        parameter_value: {
          label: p.label,
          suggestedValue: p.suggestedValue,
          status: p.status,
          confidence: p.confidence,
          rationale: p.rationale,
        },
        source: "AI",
        confirmed_by_user: p.status === "CONFIRMED",
        confirmed_at: p.status === "CONFIRMED" ? now : null,
      });
    }

    if (calc.extractedDocumentText) {
      paramRows.push({
        id: `${calc.id}-doc`,
        calculation_id: calc.id,
        parameter_name: DOCUMENT_PARAM,
        parameter_value: calc.extractedDocumentText,
        source: "DOCUMENT",
        confirmed_by_user: false,
      });
    }

    if (paramRows.length > 0) {
      const { error } = await db.from("calculation_parameters").insert(paramRows);
      if (error) throw new Error(error.message);
    }

    await db.from("calculation_audits").insert({
      id: `${calc.id}-audit-${Date.now()}`,
      calculation_id: calc.id,
      account_id: accountId,
      user_id: context.userId,
      user_name: (context.claims?.["email"] as string | undefined) ?? "",
      action: "CALCULATED",
      parameters_snapshot: {
        originalAmount: calc.originalAmount,
        totalResult: calc.totalResult ?? null,
        confirmedParameters: calc.confirmedParameters ?? {},
      },
      rule_version_id: calc.resolution?.legalRuleId ?? null,
      engine_version: calc.engineVersion,
      deterministic_hash: calc.deterministicHash ?? "",
    });

    return await listCalculations({ data: { accountId } });
  });
