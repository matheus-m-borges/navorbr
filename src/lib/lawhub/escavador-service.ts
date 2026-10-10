// @ts-nocheck — tipos legados do LawHub em migração
import {
  escavadorSearchProcessFn,
  escavadorGetMovementsFn,
  escavadorSearchByOabFn,
  escavadorSearchByEnvolvidoFn,
  escavadorRequestProcessUpdateFn,
  escavadorGetProcessAutosFn,
  escavadorDownloadDocumentFn,
  escavadorCreateTermMonitoringFn,
  escavadorCreateProcessMonitoringFn,
  escavadorGetBalanceFn,
} from "./escavador.functions";
import { classifyMovement } from "./ai-movement-classifier";
import type { LawProcess, ProcessMovementEntry } from "./types";

export interface EscavadorProcessoRaw {
  numero_cnj: string;
  titulo?: string;
  ano_inicio?: number;
  data_inicio?: string;
  data_ultima_movimentacao?: string;
  quantidade_movimentacoes?: number;
  fontes?: Array<{
    nome?: string;
    sigla?: string;
    tipo?: string;
    grau?: number;
    tribunal?: {
      nome?: string;
      sigla?: string;
    };
    unidade?: {
      nome?: string;
    };
    capa?: {
      classe?: string;
      assunto?: string;
      area?: string;
      valor_causa?: {
        valor?: number;
        moeda?: string;
      };
    };
    envolvidos?: Array<{
      nome: string;
      tipo?: string;
      polo?: "ATIVO" | "PASSIVO" | "OUTRO" | string;
      documento?: string;
      oabs?: Array<{
        numero: string;
        uf: string;
      }>;
      advogados?: Array<{
        nome: string;
        oab?: string;
      }>;
    }>;
    movimentacoes?: Array<{
      id?: string;
      data: string;
      conteudo: string;
      tipo?: string;
    }>;
  }>;
}

export const EscavadorService = {
  getApiKey(): string {
    // Credenciais pertencem ao ambiente protegido do servidor. Esta função
    // permanece apenas por compatibilidade com chamadas antigas do cliente.
    return "";
  },

  setApiKey(_key: string): void {
    // Nunca persista tokens de fornecedores no navegador.
  },

  /**
   * Converte a resposta do Escavador v2 para o modelo padronizado LawProcess do LawHub
   */
  adaptEscavadorProcess(raw: EscavadorProcessoRaw): LawProcess {
    const cleanDigits = (raw.numero_cnj || "").replace(/\D/g, "");
    const primarySource = raw.fontes?.[0];
    const capa = primarySource?.capa;
    const tribunal = primarySource?.tribunal?.sigla || primarySource?.sigla || "Tribunal de Justiça";
    const vara = primarySource?.unidade?.nome || "Vara Cível";

    const activeParty = primarySource?.envolvidos?.find(
      (e) => (e.polo || "").toUpperCase() === "ATIVO" || (e.tipo || "").toLowerCase().includes("autor")
    );
    const passiveParty = primarySource?.envolvidos?.find(
      (e) => (e.polo || "").toUpperCase() === "PASSIVO" || (e.tipo || "").toLowerCase().includes("réu") || (e.tipo || "").toLowerCase().includes("reu")
    );

    const activeName = activeParty?.nome || "Parte Autora";
    const passiveName = passiveParty?.nome || "Parte Ré";
    const title = raw.titulo || `${activeName} x ${passiveName}`;

    // Mapeamento e classificação de andamentos
    const rawMovs = primarySource?.movimentacoes || [];
    const movements: ProcessMovementEntry[] = rawMovs
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      .map((mov, idx) => {
        const classification = classifyMovement(
          mov.conteudo || "Andamento processual",
          mov.tipo || ""
        );

        return {
          id: mov.id || `esc-mov-${idx}-${cleanDigits}`,
          date: mov.data ? mov.data.slice(0, 10) : new Date().toISOString().slice(0, 10),
          time: mov.data && mov.data.length > 11 ? mov.data.slice(11, 16) : "12:00",
          text: mov.conteudo || "Movimentação registrada nos autos",
          instance: primarySource?.grau ? `${primarySource.grau}º Grau` : "1º Grau",
          source: `Escavador (${tribunal})`,
          is_important: classification.is_important,
          category: classification.category,
          urgency: classification.urgency,
          classification,
        };
      });

    return {
      id: `escavador-${cleanDigits}`,
      cnj_number: raw.numero_cnj,
      title,
      client_name: activeName,
      opponent_name: passiveName,
      court: tribunal,
      judicial_branch: primarySource?.unidade?.nome || vara,
      city: "",
      state: primarySource?.sigla?.slice(-2) || "",
      instance: primarySource?.grau ? `${primarySource.grau}ª Instância` : "1ª Instância",
      action_type: capa?.classe || "Ação Judicial",
      status: "ativo",
      distribution_date: raw.data_inicio || primarySource?.movimentacoes?.[primarySource.movimentacoes.length - 1]?.data || new Date().toISOString().slice(0, 10),
      cause_value: capa?.valor_causa?.valor || 0,
      notes: `Processo importado via Escavador API v2 (${tribunal})`,
      court_sync_enabled: true,
      last_sync_at: new Date().toISOString(),
      court_sync_system: `Escavador v2 / ${tribunal}`,
      movements,
    };
  },

  /**
   * Consulta processo por CNJ via Escavador
   */
  async searchProcess(cnj: string, customApiKey?: string): Promise<{
    success: boolean;
    process?: LawProcess;
    error?: string;
    raw?: any;
    durationMs?: number;
    creditsUsed?: number;
  }> {
    const key = customApiKey || this.getApiKey();
    const res = await escavadorSearchProcessFn({
      data: {
        apiKey: key,
        cnj,
      },
    });

    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || "Não foi possível localizar o processo no Escavador.",
        raw: res.data,
        durationMs: res.durationMs,
      };
    }

    try {
      const process = this.adaptEscavadorProcess(res.data);
      return {
        success: true,
        process,
        raw: res.data,
        durationMs: res.durationMs,
        creditsUsed: res.creditsUsed,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Erro ao processar dados do Escavador: ${err.message}`,
        raw: res.data,
        durationMs: res.durationMs,
      };
    }
  },

  /**
   * Alias para searchProcess
   */
  async searchByCNJ(cnj: string, customApiKey?: string) {
    return this.searchProcess(cnj, customApiKey);
  },

  /**
   * Consulta movimentações e andamentos de um processo
   */
  async getMovements(cnj: string, page: number = 1, customApiKey?: string): Promise<{
    success: boolean;
    items: any[];
    raw?: any;
    error?: string;
    durationMs?: number;
  }> {
    const key = customApiKey || this.getApiKey();
    const res = await escavadorGetMovementsFn({
      data: {
        apiKey: key,
        cnj,
        page,
      },
    });

    if (!res.success || !res.data) {
      return {
        success: false,
        items: [],
        error: res.error || "Não foi possível obter as movimentações no Escavador.",
        raw: res.data,
        durationMs: res.durationMs,
      };
    }

    const items = res.data?.items || res.data?.movimentacoes || (Array.isArray(res.data) ? res.data : []);
    return {
      success: true,
      items,
      raw: res.data,
      durationMs: res.durationMs,
    };
  },

  /**
   * Consulta processos por OAB via Escavador
   */
  async searchByOab(oabNumber: string, oabState: string, customApiKey?: string): Promise<{
    success: boolean;
    processes: LawProcess[];
    totalCount: number;
    raw?: any;
    error?: string;
    durationMs?: number;
  }> {
    const key = customApiKey || this.getApiKey();
    const res = await escavadorSearchByOabFn({
      data: {
        apiKey: key,
        oabNumber,
        oabState,
      },
    });

    if (!res.success || !res.data) {
      return {
        success: false,
        processes: [],
        totalCount: 0,
        raw: res.data,
        error: res.error || "Falha na busca por OAB no Escavador.",
        durationMs: res.durationMs,
      };
    }

    try {
      const items = res.data?.items || res.data?.processos || (Array.isArray(res.data) ? res.data : []);
      const processes = items.map((item: any) => this.adaptEscavadorProcess(item));
      return {
        success: true,
        processes,
        totalCount: res.data?.total || processes.length,
        raw: res.data,
        durationMs: res.durationMs,
      };
    } catch (err: any) {
      return {
        success: false,
        processes: [],
        totalCount: 0,
        raw: res.data,
        error: `Erro ao mapear processos da OAB: ${err.message}`,
        durationMs: res.durationMs,
      };
    }
  },

  /**
   * Alias com suporte para grafia searchByOAB
   */
  async searchByOAB(oabNumber: string, oabState: string, customApiKey?: string) {
    return this.searchByOab(oabNumber, oabState, customApiKey);
  },

  /**
   * Consulta processos de um envolvido por Nome ou CPF/CNPJ
   */
  async searchByEnvolvido(
    queryOrParams: string | { nome?: string; cpf_cnpj?: string; documento?: string },
    docType?: "cpf" | "cnpj" | "nome",
    customApiKey?: string
  ): Promise<{
    success: boolean;
    processes: LawProcess[];
    totalCount: number;
    raw?: any;
    error?: string;
    durationMs?: number;
  }> {
    let nameOrDocument = "";
    let resolvedDocType: "cpf" | "cnpj" | "nome" = docType || "nome";

    if (typeof queryOrParams === "object" && queryOrParams !== null) {
      if (queryOrParams.cpf_cnpj) {
        nameOrDocument = queryOrParams.cpf_cnpj;
        const digits = queryOrParams.cpf_cnpj.replace(/\D/g, "");
        resolvedDocType = digits.length > 11 ? "cnpj" : "cpf";
      } else if (queryOrParams.documento) {
        nameOrDocument = queryOrParams.documento;
        const digits = queryOrParams.documento.replace(/\D/g, "");
        resolvedDocType = digits.length > 11 ? "cnpj" : "cpf";
      } else {
        nameOrDocument = queryOrParams.nome || "";
        resolvedDocType = "nome";
      }
    } else {
      nameOrDocument = String(queryOrParams || "");
    }

    const key = customApiKey || this.getApiKey();
    const res = await escavadorSearchByEnvolvidoFn({
      data: {
        apiKey: key,
        nameOrDocument,
        docType: resolvedDocType,
      },
    });

    if (!res.success || !res.data) {
      return {
        success: false,
        processes: [],
        totalCount: 0,
        raw: res.data,
        error: res.error || "Falha na busca do envolvido no Escavador.",
        durationMs: res.durationMs,
      };
    }

    try {
      const items = res.data?.items || res.data?.processos || [];
      const processes = items.map((item: any) => this.adaptEscavadorProcess(item));
      return {
        success: true,
        processes,
        totalCount: res.data?.total || processes.length,
        raw: res.data,
        durationMs: res.durationMs,
      };
    } catch (err: any) {
      return {
        success: false,
        processes: [],
        totalCount: 0,
        raw: res.data,
        error: `Erro ao processar dados do envolvido: ${err.message}`,
        durationMs: res.durationMs,
      };
    }
  },

  /**
   * Solicita atualização de processo nos tribunais (assíncrono)
   */
  async requestUpdate(cnj: string, includeAutos: boolean = false, customApiKey?: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    const key = customApiKey || this.getApiKey();
    const res = await escavadorRequestProcessUpdateFn({
      data: {
        apiKey: key,
        cnj,
        includeAutos,
      },
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    return {
      success: true,
      message: "Solicitação de atualização enviada para a fila do tribunal no Escavador.",
    };
  },

  /**
   * Baixa binário de documento em PDF
   */
  async downloadDocument(cnj: string, documentKey: string, customApiKey?: string): Promise<{
    success: boolean;
    base64?: string;
    contentType?: string;
    error?: string;
  }> {
    const key = customApiKey || this.getApiKey();
    const res = await escavadorDownloadDocumentFn({
      data: {
        apiKey: key,
        cnj,
        documentKey,
      },
    });

    return res;
  },

  /**
   * Cadastra monitoramento de termo de OAB / Nome nos diários oficiais
   */
  async createTermMonitoring(termo: string, variacoes?: string[], customApiKey?: string): Promise<{
    success: boolean;
    monitoringId?: string;
    error?: string;
  }> {
    const key = customApiKey || this.getApiKey();
    const res = await escavadorCreateTermMonitoringFn({
      data: {
        apiKey: key,
        termo,
        variacoes: variacoes || [],
      },
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    return {
      success: true,
      monitoringId: res.data?.id,
    };
  },

  /**
   * Cadastra monitoramento de processo por CNJ
   */
  async createProcessMonitoring(cnj: string, customApiKey?: string): Promise<{
    success: boolean;
    monitoringId?: string;
    error?: string;
  }> {
    const key = customApiKey || this.getApiKey();
    const res = await escavadorCreateProcessMonitoringFn({
      data: {
        apiKey: key,
        cnj,
      },
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    return {
      success: true,
      monitoringId: res.data?.id,
    };
  },

  /**
   * Consulta de saldo e status da conta Escavador
   */
  async getBalance(customApiKey?: string): Promise<{
    success: boolean;
    data?: any;
    raw?: any;
    error?: string;
  }> {
    const key = customApiKey || this.getApiKey();
    const res = await escavadorGetBalanceFn({
      data: { apiKey: key },
    });

    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || "Erro ao consultar saldo no Escavador.",
        raw: res.data,
      };
    }

    return {
      success: true,
      data: res.data,
      raw: res.data,
    };
  },

  /**
   * Alias para getBalance
   */
  async checkBalance(customApiKey?: string) {
    return this.getBalance(customApiKey);
  },
};
