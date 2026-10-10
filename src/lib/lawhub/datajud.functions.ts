import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAuthenticatedAccount } from "@/core/security/authorization.server";
import { getTenantSecret } from "@/lib/security/tenant-secret-vault.server";

const DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br";

const ALIASES: Record<string, string> = {
  "818": "api_publica_tjpi",
  "826": "api_publica_tjsp",
  "819": "api_publica_tjrj",
  "522": "api_publica_trt22",
  "401": "api_publica_trf1",
};

export type DataJudServerResult =
  | { status: "FOUND"; process: Record<string, any>; provenance: { provider: "datajud"; alias: string; accountId: string } }
  | { status: "NOT_FOUND" | "CONFIGURATION_REQUIRED" | "UNSUPPORTED_SOURCE" | "SOURCE_UNAVAILABLE" | "INVALID_RESPONSE"; message: string };

function aliasFor(cnj: string): string | null {
  const clean = cnj.replace(/\D/g, "");
  return clean.length === 20 ? ALIASES[clean.slice(13, 16)] ?? null : null;
}

export const datajudSearchProcessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cnj?: string; accountId?: string }) => ({
    cnj: String(input?.cnj || "").replace(/\D/g, ""),
    accountId: input?.accountId || null,
  }))
  .handler(async ({ data, context }): Promise<DataJudServerResult> => {
    if (data.cnj.length !== 20) return { status: "UNSUPPORTED_SOURCE", message: "Número CNJ inválido." };
    const { accountId } = await requireAuthenticatedAccount(context.userId, data.accountId);
    const alias = aliasFor(data.cnj);
    if (!alias) return { status: "UNSUPPORTED_SOURCE", message: "Tribunal sem alias DataJud configurado." };

    const apiKey = await getTenantSecret(accountId, "datajud");
    if (!apiKey) return { status: "CONFIGURATION_REQUIRED", message: "Credencial DataJud não configurada para a conta ativa." };

    try {
      const response = await fetch(`${DATAJUD_BASE_URL}/${alias}/_search`, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: { match: { numeroProcesso: data.cnj } } }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return { status: "SOURCE_UNAVAILABLE", message: `DataJud retornou HTTP ${response.status}.` };
      const payload = await response.json();
      if (!Array.isArray(payload?.hits?.hits)) return { status: "INVALID_RESPONSE", message: "Resposta DataJud sem estrutura de resultados válida." };
      const source = payload.hits.hits[0]?._source;
      if (!source) return { status: "NOT_FOUND", message: "Processo não localizado no DataJud." };
      const movements = Array.isArray(source.movimentos)
        ? source.movimentos.map((movement: any) => ({
            id: `datajud-${movement.codigo ?? "unknown"}-${movement.dataHora ?? "unknown"}-${movement.nome ?? "unknown"}`,
            date: movement.dataHora || "",
            text: movement.nome || "",
            instance: source.grau || "",
          }))
        : [];
      return {
        status: "FOUND",
        process: {
          cnj_number: data.cnj,
          court: source.tribunal || "",
          judicial_branch: source.orgaoJulgador?.nome || "",
          procedural_class: source.classe?.nome || "",
          subject: source.assuntos?.[0]?.nome || "",
          distribution_date: source.dataAjuizamento?.slice?.(0, 10),
          movements,
          last_movement: movements[0]?.text || "",
        },
        provenance: { provider: "datajud", alias, accountId },
      };
    } catch (error) {
      const message = error instanceof DOMException && error.name === "TimeoutError"
        ? "Tempo limite excedido ao consultar o DataJud."
        : error instanceof Error ? error.message : "Falha ao consultar o DataJud.";
      return { status: "SOURCE_UNAVAILABLE", message };
    }
  });
