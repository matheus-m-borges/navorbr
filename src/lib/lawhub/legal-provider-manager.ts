// @ts-nocheck — tipos legados do LawHub em migração
/**
 * Gerenciador Unificado de Provedores de Dados Jurídicos do SaaS NAVOR LawHub
 * 
 * Configurado oficialmente com Escavador API v2 como motor prioritário de processos,
 * diários oficiais, monitoramentos e autos, e DataJud/ComunicaPJe como provedor gratuito.
 */

import { EscavadorService } from "./escavador-service";
import { DataJudService } from "./datajud-service";
import { datajudSearchProcessFn } from "./datajud.functions";
import { escavadorSearchProcessServerFn } from "./escavador.functions";
import type { LawProcess } from "./types";

export type LegalDataProviderType = "escavador" | "datajud";

export interface LegalProviderConfig {
  activeProvider: LegalDataProviderType;
  escavadorApiKey: string;
  enableOnDemandExtraction: boolean;
  enableAttachmentDownload: boolean;
  defaultMonthlyQuotaPerTenant: number;
  environmentMode: "live" | "sandbox";
  lastTestedAt?: string;
  lastTestStatus?: "ok" | "error";
  lastTestMessage?: string;
}

export interface ProviderComparisonItem {
  id: LegalDataProviderType;
  name: string;
  badge: string;
  recommendedFor: string;
  pros: string[];
  cons: string[];
  features: {
    hotStorageSearch: boolean;
    batchOabSearch: boolean;
    attachmentDownload: boolean;
    officialGazetteMonitoring: boolean;
    tribunalCoverage: string;
    averageLatency: string;
    billingModel: string;
  };
}

const STORAGE_KEY = "navor_saas_legal_provider_config";

const DEFAULT_CONFIG: LegalProviderConfig = {
  // A base oficial contínua é DataJud/DJEN. Escavador nunca é o motor global.
  activeProvider: "datajud",
  // Campo legado mantido para compatibilidade visual. Nunca contém um token.
  escavadorApiKey: "",
  enableOnDemandExtraction: true,
  enableAttachmentDownload: true,
  defaultMonthlyQuotaPerTenant: 150,
  environmentMode: "live",
};

export const COMPARISON_MATRIX: ProviderComparisonItem[] = [
  {
    id: "escavador",
    name: "Escavador Business API v2",
    badge: "Oficial & Recomendado",
    recommendedFor: "Motor completo de dados jurídicos: monitoramento de termos em diários oficiais (DJe/DJEN), buscas consolidadas por OAB, consulta de processos e autos.",
    pros: [
      "Líder em cobertura e leitura de cadernos diários de todos os tribunais do Brasil",
      "Monitoramento por termo/OAB com push automático e entrega matinal de publicações",
      "Listagem e sincronização de acervo de processos por OAB",
      "Modelo pré-pago econômico com custo de monitoramento até 50% menor",
    ],
    cons: [
      "Atualização direta nos sistemas dos tribunais opera em fila assíncrona com callback",
    ],
    features: {
      hotStorageSearch: true,
      batchOabSearch: true,
      attachmentDownload: true,
      officialGazetteMonitoring: true,
      tribunalCoverage: "100% dos Diários Oficiais e Tribunais Brasileiros",
      averageLatency: "400ms a 1.2s",
      billingModel: "Franquia / Créditos pré-pagos por requisição",
    },
  },
  {
    id: "datajud",
    name: "DataJud Oficial (CNJ)",
    badge: "100% Gratuito Oficial",
    recommendedFor: "Consultas públicas iniciais sem custo de créditos para o cliente.",
    pros: [
      "Custo zero de consulta",
      "Base mantida diretamente pelo Conselho Nacional de Justiça",
      "Acesso público sem necessidade de contratação de API",
    ],
    cons: [
      "Não faz download de peças processuais sob segredo de justiça",
      "Não quebra captcha nos tribunais estaduais",
      "Indexação pode levar de 2 a 72 horas em alguns tribunais",
    ],
    features: {
      hotStorageSearch: true,
      batchOabSearch: false,
      attachmentDownload: false,
      officialGazetteMonitoring: false,
      tribunalCoverage: "Tribunais integrados ao PDPJ",
      averageLatency: "600ms a 2s",
      billingModel: "100% Gratuito",
    },
  },
];

export const LegalProviderManager = {
  getConfig(): LegalProviderConfig {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        }
      } catch (e) {
        console.warn("Falha ao ler config de provedor legal:", e);
      }
    }
    return DEFAULT_CONFIG;
  },

  saveConfig(partial: Partial<LegalProviderConfig>): LegalProviderConfig {
    const current = this.getConfig();
    const { escavadorApiKey: _ignoredToken, ...safePartial } = partial;
    const updated = { ...current, ...safePartial, escavadorApiKey: "" };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  },

  getActiveProvider(): LegalDataProviderType {
    return this.getConfig().activeProvider;
  },

  setActiveProvider(provider: LegalDataProviderType): LegalProviderConfig {
    return this.saveConfig({ activeProvider: provider });
  },

  /**
   * Executa busca usando exclusivamente o provedor escolhido.
   * Falha em um provider não autoriza troca silenciosa para outro provider.
   */
  async searchProcessUnified(cnj: string): Promise<{
    success: boolean;
    process?: LawProcess;
    providerUsed: LegalDataProviderType;
    error?: string;
    durationMs?: number;
    creditsUsed?: number;
  }> {
    const config = this.getConfig();
    const cleanCnj = cnj.replace(/\D/g, "");

    const startTime = Date.now();
    if (!cleanCnj) {
      return { success: false, providerUsed: config.activeProvider, error: "Número CNJ não informado.", durationMs: 0 };
    }

    if (config.activeProvider === "datajud") {
      const result = await datajudSearchProcessFn({ data: { cnj: cleanCnj } });
      return result.status === "FOUND"
        ? { success: true, process: result.process as LawProcess, providerUsed: "datajud", durationMs: Date.now() - startTime, creditsUsed: 0 }
        : { success: false, providerUsed: "datajud", error: `${result.status}: ${result.message}`, durationMs: Date.now() - startTime, creditsUsed: 0 };
    }

    const escRes = await escavadorSearchProcessServerFn({ data: { cnj: cleanCnj } });
    return escRes.status === "FOUND"
      ? { success: true, process: escRes.data as LawProcess, providerUsed: "escavador", durationMs: Date.now() - startTime, creditsUsed: escRes.creditsUsed }
      : { success: false, providerUsed: "escavador", error: `${escRes.status}: ${escRes.message}`, durationMs: Date.now() - startTime };
  },

  /**
   * Executa teste ao vivo de conexão com o Escavador
   */
  async testProviderConnection(provider: "escavador", _apiKey?: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const balanceRes = await EscavadorService.checkBalance();
      if (balanceRes.success) {
        const saldo = balanceRes.balance?.saldo || balanceRes.balance?.quantidade_creditos || "Ativo";
        return {
          success: true,
          message: `Conexão com Escavador API v2 validada! Saldo de créditos disponível: ${saldo}`,
          details: balanceRes.balance,
        };
      }
      return {
        success: false,
        message: balanceRes.error || "Chave do Escavador inválida ou não autorizada.",
      };
    } catch (err: any) {
      return { success: false, message: `Erro no teste Escavador: ${err.message}` };
    }
  },
};
