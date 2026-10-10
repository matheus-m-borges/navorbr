import type { LawPublication } from "./types";

export interface ComunicaPJeItem {
  id: number;
  data_disponibilizacao?: string;
  datadisponibilizacao?: string;
  siglaTribunal?: string;
  tipoComunicacao?: string;
  nomeOrgao?: string;
  texto?: string;
  numero_processo?: string;
  numeroprocessocommascara?: string;
  link?: string;
  tipoDocumento?: string;
  nomeClasse?: string;
  destinatarios?: Array<{ nome: string; polo?: string }>;
  destinatarioadvogados?: Array<{ id: number; advogado_id?: number }>;
}

export interface ComunicaPJeResponse {
  status: string;
  message?: string;
  count?: number;
  items?: ComunicaPJeItem[];
}

export class ComunicaPJeQueryError extends Error {
  constructor(readonly userMessage: string, cause?: unknown) {
    super(userMessage, { cause });
    this.name = "ComunicaPJeQueryError";
  }
}

const COMUNICA_BASE_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  // Janela retroativa de 35 dias para capturar tudo do mês corrente e do dia de hoje
  const past = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
  const pastYear = past.getFullYear();
  const pastMonth = String(past.getMonth() + 1).padStart(2, "0");
  const pastDay = String(past.getDate()).padStart(2, "0");
  const pastStr = `${pastYear}-${pastMonth}-${pastDay}`;

  return { start: pastStr, end: todayStr };
}

/**
 * Conector Oficial ao Diário de Justiça Eletrônico Nacional (DJEN / ComunicaPJe - CNJ).
 * Realiza requisições HTTP reais aos servidores do CNJ sem necessidade de autenticação privada.
 */
export const ComunicaPJEService = {
  /**
   * Busca publicações e intimações reais pelo número da OAB e UF
   */
  async fetchByOAB(params: {
    numeroOab: string;
    ufOab: string;
    pagina?: number;
    itensPorPagina?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<LawPublication[]> {
    const cleanOab = params.numeroOab.replace(/\D/g, "");
    const uf = params.ufOab.trim().toUpperCase();
    const pagina = params.pagina || 1;
    const itens = params.itensPorPagina || 20;
    const dateRange = getDefaultDateRange();
    const dataInicio = params.dataInicio ?? dateRange.start;
    const dataFim = params.dataFim ?? dateRange.end;

    let url = `${COMUNICA_BASE_URL}?numeroOab=${cleanOab}&ufOab=${uf}&pagina=${pagina}&itensPorPagina=${itens}`;
    if (dataInicio && dataFim) {
      url += `&dataDisponibilizacaoInicio=${dataInicio}&dataDisponibilizacaoFim=${dataFim}`;
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) throw new ComunicaPJeQueryError("O DJEN não está disponível para consulta neste momento.");

      const json: ComunicaPJeResponse = await res.json();
      if (!json || typeof json !== "object" || !Array.isArray(json.items)) {
        throw new ComunicaPJeQueryError("A resposta do DJEN não pôde ser validada.");
      }

      return json.items.flatMap((item) => {
        const publication = this.mapItemToPublication(item, `OAB/${uf} ${cleanOab}`);
        return publication ? [publication] : [];
      });
    } catch (error) {
      if (error instanceof ComunicaPJeQueryError) throw error;
      throw new ComunicaPJeQueryError("Não foi possível consultar o DJEN neste momento.", error);
    }
  },

  /**
   * Busca publicações e intimações reais por Nome do Advogado (campo destinatarioadvogados)
   */
  async fetchByLawyerName(params: {
    nomeAdvogado: string;
    pagina?: number;
    itensPorPagina?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<LawPublication[]> {
    const pagina = params.pagina || 1;
    const itens = params.itensPorPagina || 20;
    const encodedName = encodeURIComponent(params.nomeAdvogado.trim());
    const dateRange = getDefaultDateRange();
    const dataInicio = params.dataInicio ?? dateRange.start;
    const dataFim = params.dataFim ?? dateRange.end;

    let url = `${COMUNICA_BASE_URL}?nomeAdvogado=${encodedName}&pagina=${pagina}&itensPorPagina=${itens}`;
    if (dataInicio && dataFim) {
      url += `&dataDisponibilizacaoInicio=${dataInicio}&dataDisponibilizacaoFim=${dataFim}`;
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ComunicaPJeResponse = await res.json();
      if (!json.items || !Array.isArray(json.items)) return [];

      return json.items.flatMap((item) => { const publication = this.mapItemToPublication(item, params.nomeAdvogado); return publication ? [publication] : []; });
    } catch (error) {
      console.warn("ComunicaPJEService by name failed:", error);
      return [];
    }
  },

  /**
   * Busca publicações e intimações reais por Nome da Parte / Termo Envolvido (campo destinatarios)
   * ESSENCIAL: Cartórios e secretarias frequentemente publicam o advogado no polo/parte ou em causa própria
   * sem vincular a OAB no array destinatarioadvogados da API.
   */
  async fetchByPartyName(params: {
    nomeParte: string;
    pagina?: number;
    itensPorPagina?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<LawPublication[]> {
    const pagina = params.pagina || 1;
    const itens = params.itensPorPagina || 20;
    const encodedName = encodeURIComponent(params.nomeParte.trim());
    const dateRange = getDefaultDateRange();
    const dataInicio = params.dataInicio ?? dateRange.start;
    const dataFim = params.dataFim ?? dateRange.end;

    let url = `${COMUNICA_BASE_URL}?nomeParte=${encodedName}&pagina=${pagina}&itensPorPagina=${itens}`;
    if (dataInicio && dataFim) {
      url += `&dataDisponibilizacaoInicio=${dataInicio}&dataDisponibilizacaoFim=${dataFim}`;
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ComunicaPJeResponse = await res.json();
      if (!json.items || !Array.isArray(json.items)) return [];

      return json.items.flatMap((item) => { const publication = this.mapItemToPublication(item, params.nomeParte); return publication ? [publication] : []; });
    } catch (error) {
      console.warn("ComunicaPJEService by party name failed:", error);
      return [];
    }
  },

  /**
   * Busca publicações e intimações no INTEIRO TEOR da peça / decisão / despacho (parâmetro ?texto=)
   * FUNDAMENTAL: Pega citações do nome ou termo mesmo quando ele está no meio do texto da sentença,
   * acórdão, intimação ou ata, sem constar no cabeçalho ou metadados de polo/advogado.
   */
  async fetchByTextContent(params: {
    termoTexto: string;
    pagina?: number;
    itensPorPagina?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<LawPublication[]> {
    const pagina = params.pagina || 1;
    const itens = params.itensPorPagina || 20;
    const encodedTerm = encodeURIComponent(params.termoTexto.trim());
    const dateRange = getDefaultDateRange();
    const dataInicio = params.dataInicio ?? dateRange.start;
    const dataFim = params.dataFim ?? dateRange.end;

    let url = `${COMUNICA_BASE_URL}?texto=${encodedTerm}&pagina=${pagina}&itensPorPagina=${itens}`;
    if (dataInicio && dataFim) {
      url += `&dataDisponibilizacaoInicio=${dataInicio}&dataDisponibilizacaoFim=${dataFim}`;
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ComunicaPJeResponse = await res.json();
      if (!json.items || !Array.isArray(json.items)) return [];

      return json.items.flatMap((item) => { const publication = this.mapItemToPublication(item, params.termoTexto); return publication ? [publication] : []; });
    } catch (error) {
      console.warn("ComunicaPJEService by text content failed:", error);
      return [];
    }
  },

  /**
   * Busca publicações e decisões reais pelo número CNJ do Processo
   */
  async fetchByProcessCNJ(cnjNumber: string): Promise<LawPublication[]> {
    const cleanCnj = cnjNumber.replace(/\D/g, "");
    const url = `${COMUNICA_BASE_URL}?numeroProcesso=${cleanCnj}&pagina=1&itensPorPagina=15`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ComunicaPJeResponse = await res.json();
      if (!json.items || !Array.isArray(json.items)) return [];

      return json.items.flatMap((item) => { const publication = this.mapItemToPublication(item, "Processo " + cnjNumber); return publication ? [publication] : []; });
    } catch (error) {
      console.warn("ComunicaPJEService by process failed:", error);
      return [];
    }
  },

  /**
   * Executa varredura inteligente multicritério unificada (OAB + NomeAdvogado + NomeParte + Termos no Texto + Processos)
   * Idêntico à arquitetura de robôs como Astrea e Kurier
   */
  async fetchMultiCriteria(params: {
    oabs?: Array<{ numeroOab: string; ufOab: string }>;
    lawyerNames?: string[];
    partyNames?: string[];
    bodyTerms?: string[];
    processes?: string[];
  }): Promise<LawPublication[]> {
    const promises: Promise<LawPublication[]>[] = [];

    // 1. OABs
    if (params.oabs && params.oabs.length > 0) {
      for (const oab of params.oabs) {
        if (oab.numeroOab) {
          promises.push(this.fetchByOAB({ numeroOab: oab.numeroOab, ufOab: oab.ufOab || "PI" }));
        }
      }
    }

    // 2. Nomes como Advogado (destinatarioadvogados)
    if (params.lawyerNames && params.lawyerNames.length > 0) {
      for (const name of params.lawyerNames) {
        if (name && name.trim().length > 3) {
          promises.push(this.fetchByLawyerName({ nomeAdvogado: name }));
        }
      }
    }

    // 3. Nomes como Parte / Interessado (destinatarios)
    if (params.partyNames && params.partyNames.length > 0) {
      for (const name of params.partyNames) {
        if (name && name.trim().length > 3) {
          promises.push(this.fetchByPartyName({ nomeParte: name }));
        }
      }
    }

    // 4. Termos e nomes no INTEIRO TEOR / CORPO DA PEÇA (parâmetro ?texto= da ComunicaAPI)
    const termsToSearchInText = params.bodyTerms || params.lawyerNames || [];
    for (const term of termsToSearchInText) {
      if (term && term.trim().length > 3) {
        promises.push(this.fetchByTextContent({ termoTexto: term }));
      }
    }

    // 5. Processos específicos
    if (params.processes && params.processes.length > 0) {
      for (const proc of params.processes) {
        if (proc && proc.replace(/\D/g, "").length >= 15) {
          promises.push(this.fetchByProcessCNJ(proc));
        }
      }
    }

    const settled = await Promise.allSettled(promises);
    const allPubs: LawPublication[] = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();

    for (const result of settled) {
      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        for (const pub of result.value) {
          const key = `${pub.process_cnj}-${pub.publication_date}`;
          if (!seenIds.has(pub.id) && !seenKeys.has(key)) {
            seenIds.add(pub.id);
            seenKeys.add(key);
            allPubs.push(pub);
          }
        }
      }
    }

    return allPubs;
  },

  /**
   * Converte o item retornado pela API do CNJ para o padrão LawPublication do LawHub
   */
  mapItemToPublication(item: ComunicaPJeItem, lawyerIdentifier: string): LawPublication | null {
    const sourceId = Number.isInteger(item.id) && item.id > 0 ? String(item.id) : null;
    const publicationDate = this.formatSourceDate(item.datadisponibilizacao ?? item.data_disponibilizacao);
    const processNumber = item.numeroprocessocommascara ?? this.formatCnj(item.numero_processo);
    const tribunal = item.siglaTribunal?.trim();
    const orgao = item.nomeOrgao?.trim();
    const cleanText = (item.texto || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!sourceId || !publicationDate || !processNumber || !tribunal || !orgao || !cleanText) return null;

    return {
      id: `djen-${sourceId}`,
      process_cnj: processNumber,
      court: tribunal,
      gazette_name: `Diário de Justiça Eletrônico Nacional (${tribunal})`,
      vara: orgao,
      edition_number: sourceId,
      release_date: publicationDate,
      publication_date: publicationDate,
      searched_name: lawyerIdentifier,
      lawyer_oab: lawyerIdentifier,
      status: "pendente",
      dispatch_summary: cleanText.length > 200 ? `${cleanText.slice(0, 200)}...` : cleanText,
      full_text: cleanText,
      source_url: item.link || undefined,
      is_linked: false,
    };
  },

  formatSourceDate(value: string | undefined): string | null {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
  },

  formatCnj(value: string | undefined): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 20) return null;
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
  },
};
