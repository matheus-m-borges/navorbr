import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAuthenticatedAccount } from "@/core/security/authorization.server";
import { getTenantSecret } from "@/lib/security/tenant-secret-vault.server";
import { recordProviderUsageLedger } from "./escavador.server";

export interface EscavadorSearchParams {
  accountId?: string;
  cnj?: string;
  oabNumber?: string;
  oabState?: string;
  nameOrDocument?: string;
  docType?: "cpf" | "cnpj" | "nome";
  page?: number;
  termo?: string;
  tribunais?: string[];
  documentKey?: string;
}

export interface EscavadorFunctionResult {
  success: boolean;
  data?: any;
  error?: string;
  source?: string;
  durationMs?: number;
  creditsUsed?: number;
}

const DEFAULT_ESCAVADOR_API_KEY = process.env.ESCAVADOR_API_KEY || "";

async function resolveEscavadorKey(userId: string, requestedAccountId?: string): Promise<{ accountId: string; apiKey: string }> {
  const auth = await requireAuthenticatedAccount(userId, requestedAccountId);
  const vaultKey = await getTenantSecret(auth.accountId, "escavador");
  const apiKey = vaultKey || DEFAULT_ESCAVADOR_API_KEY;
  return { accountId: auth.accountId, apiKey };
}

function getEscavadorHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function formatEscavadorHttpError(status: number, rawText: string): string {
  let detailMessage = "";
  try {
    const parsed = JSON.parse(rawText);
    detailMessage = parsed.error || parsed.message || (typeof parsed === "string" ? parsed : "");
  } catch {
    detailMessage = rawText;
  }

  if (status === 402) {
    return `Saldo Insuficiente no Escavador (HTTP 402): ${detailMessage || "Você não possui saldo em crédito da API."} Recarregue seus créditos no painel da API do Escavador ou use a Busca Pública Gratuita.`;
  }
  if (status === 401) {
    return `Autenticação Recusada (HTTP 401): ${detailMessage || "Token Bearer inválido ou não autorizado."}`;
  }
  if (status === 429) {
    return `Limite de Requisições Atingido (HTTP 429): ${detailMessage || "Muitas requisições em curto intervalo. Aguarde alguns instantes."}`;
  }
  if (status === 404) {
    return `Não Encontrado no Escavador (HTTP 404): ${detailMessage || "O registro pesquisado não consta na base do Escavador."}`;
  }

  return `Escavador API retornou HTTP ${status}: ${detailMessage || "Erro na consulta."}`;
}

/**
 * 1. Consulta de processo por CNJ (Capa, partes, audiências e fontes)
 * Rota Oficial: GET /api/v2/processos/numero_cnj/{numero}
 */
export const escavadorSearchProcessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EscavadorSearchParams) => ({
    accountId: input?.accountId,
    cnj: String(input?.cnj || "").replace(/\D/g, "").trim(),
  }))
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    const cleanCnj = data.cnj;
    if (!cleanCnj) return { success: false, error: "Número CNJ não informado." };

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) {
      return {
        success: false,
        error: "Chave da API Escavador não configurada para esta conta.",
      };
    }

    try {
      const res = await fetch(
        `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cleanCnj)}`,
        {
          method: "GET",
          headers: getEscavadorHeaders(apiKey),
          signal: AbortSignal.timeout(25000),
        }
      );

      const durationMs = Date.now() - startTime;
      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "search_process_by_cnj",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return {
          success: false,
          error: formatEscavadorHttpError(res.status, errorText),
          durationMs,
        };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_process_by_cnj",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return {
        success: true,
        data: json,
        source: "escavador_v2_processo_cnj",
        durationMs,
        creditsUsed,
      };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_process_by_cnj",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return {
        success: false,
        error: `Falha na requisição Escavador: ${err?.message || String(err)}`,
        durationMs: Date.now() - startTime,
      };
    }
  });

/**
 * 2. Consulta de movimentações e andamentos de um processo
 * Rota Oficial: GET /api/v2/processos/numero_cnj/{numero}/movimentacoes
 */
export const escavadorGetMovementsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EscavadorSearchParams) => ({
    accountId: input?.accountId,
    cnj: String(input?.cnj || "").replace(/\D/g, "").trim(),
    page: input?.page || 1,
  }))
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    const cleanCnj = data.cnj;
    if (!cleanCnj) return { success: false, error: "Número CNJ não informado." };

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) return { success: false, error: "Chave da API Escavador não configurada." };

    try {
      const res = await fetch(
        `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cleanCnj)}/movimentacoes?page=${data.page || 1}`,
        {
          method: "GET",
          headers: getEscavadorHeaders(apiKey),
          signal: AbortSignal.timeout(25000),
        }
      );

      const durationMs = Date.now() - startTime;
      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "get_movements",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { success: false, error: formatEscavadorHttpError(res.status, errText), durationMs };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "get_movements",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return { success: true, data: json, source: "escavador_v2_movimentacoes", durationMs, creditsUsed };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "get_movements",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return { success: false, error: err?.message || String(err), durationMs: Date.now() - startTime };
    }
  });

/**
 * 3. Consulta de acervo de processos por OAB do advogado
 * Rota Oficial: GET /api/v2/advogado/processos?oab_numero=...&oab_estado=...
 */
export const escavadorSearchByOabFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EscavadorSearchParams) => ({
    accountId: input?.accountId,
    oabNumber: String(input?.oabNumber || "").trim(),
    oabState: String(input?.oabState || "").trim().toUpperCase(),
    page: input?.page || 1,
  }))
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    if (!data.oabNumber || !data.oabState) {
      return { success: false, error: "Número da OAB e UF são obrigatórios." };
    }

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) return { success: false, error: "Chave da API Escavador não configurada." };

    try {
      const cleanOab = data.oabNumber.replace(/\D/g, "");
      const url = `https://api.escavador.com/api/v2/advogado/processos?oab_numero=${encodeURIComponent(cleanOab)}&oab_estado=${encodeURIComponent(data.oabState)}&page=${data.page || 1}`;

      const res = await fetch(url, {
        method: "GET",
        headers: getEscavadorHeaders(apiKey),
        signal: AbortSignal.timeout(30000),
      });

      const durationMs = Date.now() - startTime;
      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "search_by_oab",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return {
          success: false,
          error: formatEscavadorHttpError(res.status, errorText),
          durationMs,
        };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_by_oab",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return {
        success: true,
        data: json,
        source: "escavador_v2_advogado_processos",
        durationMs,
        creditsUsed,
      };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_by_oab",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return {
        success: false,
        error: `Falha na consulta por OAB no Escavador: ${err?.message || String(err)}`,
        durationMs: Date.now() - startTime,
      };
    }
  });

/**
 * 4. Consulta de processos do envolvido por Nome ou CPF/CNPJ
 * Rota Oficial: GET /api/v2/envolvido/processos
 */
export const escavadorSearchByEnvolvidoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EscavadorSearchParams) => ({
    accountId: input?.accountId,
    nameOrDocument: String(input?.nameOrDocument || "").trim(),
    docType: input?.docType || "nome",
    page: input?.page || 1,
  }))
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    if (!data.nameOrDocument) return { success: false, error: "Nome ou documento obrigatório." };

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) return { success: false, error: "Chave da API Escavador não informada." };

    try {
      const param = data.docType === "cpf" || data.docType === "cnpj"
        ? `cpf_cnpj=${encodeURIComponent(data.nameOrDocument.replace(/\D/g, ""))}`
        : `nome=${encodeURIComponent(data.nameOrDocument)}`;

      const url = `https://api.escavador.com/api/v2/envolvido/processos?${param}&page=${data.page || 1}`;
      const res = await fetch(url, {
        method: "GET",
        headers: getEscavadorHeaders(apiKey),
        signal: AbortSignal.timeout(30000),
      });

      const durationMs = Date.now() - startTime;
      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "search_by_envolvido",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { success: false, error: formatEscavadorHttpError(res.status, errorText), durationMs };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_by_envolvido",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return { success: true, data: json, source: "escavador_v2_envolvido_processos", durationMs, creditsUsed };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "search_by_envolvido",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return { success: false, error: err?.message || String(err), durationMs: Date.now() - startTime };
    }
  });

/**
 * 5. Solicitar atualização ao vivo de um processo no tribunal
 * Rota Oficial: POST /api/v2/processos/numero_cnj/{numero}/solicitar-atualizacao
 */
export const escavadorRequestProcessUpdateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string; cnj: string; includeAutos?: boolean }) => ({
    accountId: input?.accountId,
    cnj: String(input?.cnj || "").replace(/\D/g, "").trim(),
    includeAutos: Boolean(input?.includeAutos),
  }))
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    if (!data.cnj) return { success: false, error: "Número CNJ não informado." };

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) return { success: false, error: "Chave da API Escavador não configurada." };

    try {
      const body = {
        documentos_publicos: 1,
        autos: data.includeAutos ? 1 : 0,
      };

      const res = await fetch(
        `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(data.cnj)}/solicitar-atualizacao`,
        {
          method: "POST",
          headers: getEscavadorHeaders(apiKey),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }
      );

      const durationMs = Date.now() - startTime;
      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "request_process_update",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { success: false, error: `Escavador HTTP ${res.status}: ${errText}`, durationMs };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "request_process_update",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return { success: true, data: json, source: "escavador_v2_solicitar_atualizacao", durationMs, creditsUsed };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "request_process_update",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return { success: false, error: err?.message || String(err), durationMs: Date.now() - startTime };
    }
  });

/**
 * 6. Obter lista de autos e documentos do processo
 * Rota Oficial: GET /api/v2/processos/numero_cnj/{numero}/autos
 */
export const escavadorGetProcessAutosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string; cnj: string; page?: number }) => ({
    accountId: input?.accountId,
    cnj: String(input?.cnj || "").replace(/\D/g, "").trim(),
    page: input?.page || 1,
  }))
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    if (!data.cnj) return { success: false, error: "Número CNJ não informado." };

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) return { success: false, error: "Chave da API Escavador não configurada." };

    try {
      const res = await fetch(
        `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(data.cnj)}/autos?page=${data.page || 1}`,
        {
          method: "GET",
          headers: getEscavadorHeaders(apiKey),
          signal: AbortSignal.timeout(30000),
        }
      );

      const durationMs = Date.now() - startTime;
      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "get_process_autos",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { success: false, error: `Escavador HTTP ${res.status}: ${errText}`, durationMs };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "get_process_autos",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return { success: true, data: json, source: "escavador_v2_autos", durationMs, creditsUsed };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "get_process_autos",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return { success: false, error: err?.message || String(err), durationMs: Date.now() - startTime };
    }
  });

/**
 * 7. Download binário do PDF de um documento dos autos via proxy
 * Rota Oficial: GET /api/v2/processos/numero_cnj/{numero}/documentos/{key}
 */
export const escavadorDownloadDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string; cnj: string; documentKey: string }) => ({
    accountId: input?.accountId,
    cnj: String(input?.cnj || "").replace(/\D/g, "").trim(),
    documentKey: String(input?.documentKey || "").trim(),
  }))
  .handler(async ({ data, context }) => {
    if (!data.cnj || !data.documentKey) {
      return { success: false, error: "Número CNJ e chave do documento são obrigatórios." };
    }

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) return { success: false, error: "Chave da API Escavador não configurada." };

    const startTime = Date.now();
    try {
      const url = `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(data.cnj)}/documentos/${encodeURIComponent(data.documentKey)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(45000),
      });

      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "download_document",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { success: false, error: `Erro no download do documento: HTTP ${res.status}` };
      }

      const contentType = res.headers.get("content-type") || "application/pdf";
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "download_document",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return {
        success: true,
        base64,
        contentType,
      };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "download_document",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return { success: false, error: err?.message || "Erro no download do documento." };
    }
  });

/**
 * 8. Criar monitoramento de termo em Diários Oficiais (Nome do Advogado / OAB)
 * Rota Oficial: POST /api/v2/monitoramentos/novos-processos
 */
export const escavadorCreateTermMonitoringFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string; termo: string; variacoes?: string[]; tribunais?: string[] }) => ({
    accountId: input?.accountId,
    termo: String(input?.termo || "").trim(),
    variacoes: input?.variacoes || [],
    tribunais: input?.tribunais || [],
  }))
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    if (!data.termo) return { success: false, error: "Termo de busca obrigatório." };

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) return { success: false, error: "Chave da API Escavador não informada." };

    try {
      const body: any = {
        termo: data.termo,
        limite_aparicoes: 10000,
      };
      if (data.variacoes.length > 0) body.variacoes = data.variacoes;
      if (data.tribunais.length > 0) body.tribunais = data.tribunais;

      const res = await fetch("https://api.escavador.com/api/v2/monitoramentos/novos-processos", {
        method: "POST",
        headers: getEscavadorHeaders(apiKey),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });

      const durationMs = Date.now() - startTime;
      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "create_term_monitoring",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { success: false, error: `Escavador HTTP ${res.status}: ${errText}`, durationMs };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "create_term_monitoring",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return { success: true, data: json, source: "escavador_v2_criar_monitoramento_termo", durationMs, creditsUsed };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "create_term_monitoring",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return { success: false, error: err?.message || String(err), durationMs: Date.now() - startTime };
    }
  });

/**
 * 9. Criar monitoramento de processo por CNJ (Tribunais e Diários)
 * Rota Oficial: POST /api/v2/monitoramentos/processos
 */
export const escavadorCreateProcessMonitoringFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string; cnj: string }) => ({
    accountId: input?.accountId,
    cnj: String(input?.cnj || "").replace(/\D/g, "").trim(),
  }))
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    if (!data.cnj) return { success: false, error: "Número CNJ obrigatório." };

    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data.accountId);
    if (!apiKey) return { success: false, error: "Chave da API Escavador não informada." };

    try {
      const res = await fetch("https://api.escavador.com/api/v2/monitoramentos/processos", {
        method: "POST",
        headers: getEscavadorHeaders(apiKey),
        body: JSON.stringify({ numero_cnj: data.cnj }),
        signal: AbortSignal.timeout(20000),
      });

      const durationMs = Date.now() - startTime;
      const creditsHeader = res.headers.get("Creditos-Utilizados");
      const creditsUsed = creditsHeader ? Number(creditsHeader) : undefined;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "create_process_monitoring",
          externalRequestId: requestId,
          credits: creditsUsed,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { success: false, error: `Escavador HTTP ${res.status}: ${errText}`, durationMs };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "create_process_monitoring",
        externalRequestId: requestId,
        credits: creditsUsed,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return { success: true, data: json, source: "escavador_v2_criar_monitoramento_processo", durationMs, creditsUsed };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "create_process_monitoring",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return { success: false, error: err?.message || String(err), durationMs: Date.now() - startTime };
    }
  });

/**
 * 10. Consulta de saldo e verificação de saúde da chave na API do Escavador
 * Rota Oficial: GET /api/v2/quantidade-creditos (com fallback para /api/v2/saldo)
 */
export const escavadorGetBalanceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string } = {}) => input)
  .handler(async ({ data, context }): Promise<EscavadorFunctionResult> => {
    const startTime = Date.now();
    const { accountId, apiKey } = await resolveEscavadorKey(context.userId, data?.accountId);
    if (!apiKey) {
      return {
        success: false,
        error: "Chave da API Escavador não configurada para a conta ativa.",
      };
    }

    try {
      let res = await fetch("https://api.escavador.com/api/v2/quantidade-creditos", {
        method: "GET",
        headers: getEscavadorHeaders(apiKey),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        res = await fetch("https://api.escavador.com/api/v2/saldo", {
          method: "GET",
          headers: getEscavadorHeaders(apiKey),
          signal: AbortSignal.timeout(10000),
        });
      }

      const durationMs = Date.now() - startTime;
      const requestId = res.headers.get("x-request-id") || null;

      if (!res.ok) {
        await recordProviderUsageLedger({
          accountId,
          provider: "escavador",
          operation: "get_balance",
          externalRequestId: requestId,
          status: "failed",
          failureCode: `HTTP_${res.status}`,
          createdAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return {
          success: false,
          error: `Chave inválida ou erro na API Escavador (HTTP ${res.status})`,
          durationMs,
        };
      }

      const json = await res.json();
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "get_balance",
        externalRequestId: requestId,
        status: "completed",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });

      return {
        success: true,
        data: json,
        source: "escavador_v2_saldo",
        durationMs,
      };
    } catch (err: any) {
      await recordProviderUsageLedger({
        accountId,
        provider: "escavador",
        operation: "get_balance",
        status: "failed",
        failureCode: err?.message || "NETWORK_ERROR",
        createdAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      });
      return {
        success: false,
        error: `Erro ao conectar com Escavador: ${err?.message || String(err)}`,
        durationMs: Date.now() - startTime,
      };
    }
  });

export type EscavadorServerResult =
  | { status: "FOUND"; data: any; provider: "escavador"; accountId: string; creditsUsed?: number }
  | { status: "CONFIGURATION_REQUIRED" | "NOT_FOUND" | "SOURCE_UNAVAILABLE" | "INVALID_RESPONSE"; message: string };

/**
 * 11. Busca unificada de processos com autorização e credenciais isoladas por tenant via servidor
 */
export const escavadorSearchProcessServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cnj?: string; accountId?: string }) => ({
    cnj: String(input?.cnj || ""),
    accountId: input?.accountId,
  }))
  .handler(async ({ data, context }): Promise<EscavadorServerResult> => {
    const { searchEscavadorProcessServer } = await import("./escavador.server");
    return searchEscavadorProcessServer({
      userId: context.userId,
      accountId: data.accountId,
      cnj: data.cnj,
    });
  });
