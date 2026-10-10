import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LawHubServiceKind = "callcenter_ai" | "pieces_ai" | "legal_data";

export type LawHubServiceConfig = {
  provider: "lovable" | "openai" | "gemini" | "escavador" | "datajud";
  model?: string;
  monthlyQuota?: number;
  reviewRequired?: boolean;
  receptionMode?: "bot" | "ai" | "hybrid" | "human";
  leadRule?: "instant" | "qualified" | "immediate" | "manual";
};

const defaults: Record<LawHubServiceKind, LawHubServiceConfig> = {
  callcenter_ai: {
    provider: "lovable",
    model: "google/gemini-2.5-flash",
    monthlyQuota: 0,
    receptionMode: "hybrid",
    leadRule: "qualified",
  },
  pieces_ai: {
    provider: "lovable",
    model: "openai/gpt-4o",
    monthlyQuota: 0,
    reviewRequired: true,
  },
  legal_data: {
    // DataJud/DJEN é a fonte-base contínua. O Escavador é complementar,
    // acionado somente em processos e publicações selecionados.
    provider: "datajud",
    monthlyQuota: 150,
  },
};

/**
 * Lê somente as escolhas operacionais da plataforma. Segredos de fornecedores
 * são resolvidos exclusivamente por variáveis de ambiente do servidor.
 */
export async function getLawHubServiceConfig(
  accountId: string | undefined,
  service: LawHubServiceKind,
): Promise<LawHubServiceConfig> {
  const fallback = defaults[service];
  if (!accountId) return fallback;

  try {
    const { data } = await (supabaseAdmin as any)
      .from("app_settings")
      .select("value")
      .eq("key", `lawhub_${service}_config`)
      .eq("account_id", accountId)
      .maybeSingle();
    const value = data?.value;
    if (!value || typeof value !== "object") return fallback;

    return {
      provider: value.provider || fallback.provider,
      model: typeof value.model === "string" ? value.model : fallback.model,
      monthlyQuota: Number.isFinite(value.monthlyQuota) ? value.monthlyQuota : fallback.monthlyQuota,
      reviewRequired: typeof value.reviewRequired === "boolean" ? value.reviewRequired : fallback.reviewRequired,
      receptionMode: typeof value.receptionMode === "string" ? value.receptionMode : fallback.receptionMode,
      leadRule: typeof value.leadRule === "string" ? value.leadRule : fallback.leadRule,
    };
  } catch (error) {
    console.warn(`[LawHub] Configuração ${service} indisponível; usando padrão NAVOR.`, error);
    return fallback;
  }
}
