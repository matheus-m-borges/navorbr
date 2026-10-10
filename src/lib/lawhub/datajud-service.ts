import type { LawProcess, LawProcessMovement } from "./types";

export interface DataJudHit {
  _index: string;
  _id: string;
  _source: {
    numeroProcesso: string;
    classe?: { codigo?: number; nome?: string };
    sistema?: { codigo?: number; nome?: string };
    tribunal?: string;
    grau?: string;
    dataAjuizamento?: string;
    orgaoJulgador?: { codigo?: number; nome?: string; codigoMunicipioIBGE?: number };
    assuntos?: Array<{ codigo?: number; nome?: string }>;
    movimentos?: Array<{
      codigo?: number;
      nome?: string;
      dataHora?: string;
      complementosTabelados?: Array<{ nome?: string; descricao?: string }>;
    }>;
  };
}

const DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br";

export const DataJudService = {
  /** Secrets are server-side only; browser storage is never authoritative. */
  getApiKey(): string {
    return "";
  },

  setApiKey(key: string): void {
    void key;
    throw new Error("A chave DataJud deve ser configurada server-side por tenant.");
  },

  /**
   * Mapeia código do CNJ (ex: 8.18 -> TJPI) para o alias do DataJud
   */
  detectTribunalAlias(cnjNumber: string): string | null {
    const clean = cnjNumber.replace(/\D/g, "");
    if (clean.length === 20) {
      const jtr = clean.substring(13, 16); // J.TR
      if (jtr === "818") return "api_publica_tjpi";
      if (jtr === "826") return "api_publica_tjsp";
      if (jtr === "819") return "api_publica_tjrj";
      if (jtr === "522") return "api_publica_trt22";
      if (jtr === "401") return "api_publica_trf1";
    }
    return null;
  },

  /**
   * Consulta um processo no DataJud do CNJ
   */
  async searchProcess(cnjNumber: string): Promise<Partial<LawProcess> | null> {
    const cleanNumber = cnjNumber.replace(/\D/g, "");
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    const alias = this.detectTribunalAlias(cnjNumber);
    if (!alias) return null;
    const url = `${DATAJUD_BASE_URL}/${alias}/_search`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            match: {
              numeroProcesso: cleanNumber,
            },
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`DataJud API HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json || !Array.isArray(json?.hits?.hits)) {
        throw new Error("Resposta DataJud inválida.");
      }
      const hits: DataJudHit[] = json.hits.hits;

      if (hits.length === 0) {
        return null;
      }

      const src = hits[0]?._source;
      if (!src) {
        return null;
      }
      const movements: Array<{ id: string; date: string; text: string; instance: string }> = (
        src.movimentos || []
      )
        .sort((a, b) => (b.dataHora || "").localeCompare(a.dataHora || ""))
        .map((m) => ({
          id: `datajud-mov-${m.codigo ?? "unknown"}-${m.dataHora ?? "unknown"}-${m.nome ?? "unknown"}`,
          date: m.dataHora ? new Date(m.dataHora).toLocaleDateString("pt-BR") : "",
          text: m.nome || "",
          instance: src.grau || "",
        }));

      return {
        cnj_number: cnjNumber,
        court: src.tribunal || "",
        judicial_branch: src.orgaoJulgador?.nome || "",
        procedural_class: src.classe?.nome || "",
        subject: src.assuntos?.[0]?.nome || "",
        distribution_date: src.dataAjuizamento ? src.dataAjuizamento.slice(0, 10) : undefined,
        movements,
        last_movement: movements[0]?.text,
      };
    } catch (error) {
      console.warn("DataJudService: consulta direta indisponível ou requer chave adicional:", error);
      return null;
    }
  },
};
