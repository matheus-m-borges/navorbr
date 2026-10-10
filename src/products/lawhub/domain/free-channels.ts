/**
 * Especificação e Documentação Oficial dos Canais Gratuitos de Busca e Monitoramento do LawHub
 * 
 * Todos os canais listados abaixo são 100% gratuitos (0 créditos de IA),
 * operando sobre bases públicas governamentais e sistemas judiciais abertos.
 */

export interface FreeChannelDefinition {
  id: string;
  name: string;
  shortName: string;
  fullName: string;
  institution: string;
  badge: string;
  coverage: string;
  whatItTracks: string;
  description: string;
  frequency: string;
  cost: string; // Ex: "0 Créditos de IA (Gratuito)"
  isFree: boolean;
  legalBasis?: string;
  iconName: "Database" | "FileText" | "Scale" | "ShieldCheck" | "Building";
  accentColor: string;
  tagline: string;
}

export const CANAIS_GRATUITOS_MONITORAMENTO: FreeChannelDefinition[] = [
  {
    id: "datajud",
    name: "DataJud (CNJ)",
    shortName: "DataJud",
    fullName: "Base Nacional de Dados do Poder Judiciário",
    institution: "Conselho Nacional de Justiça (CNJ)",
    badge: "Oficial CNJ",
    coverage: "Todos os 90 tribunais do Brasil (TJs, TRFs, TRTs, STJ, TST, STM, STF)",
    whatItTracks: "Metadados de processos, capas, polos ativo/passivo, classe, assunto e movimentações padronizadas (TPU).",
    description: "Criado pela Resolução CNJ nº 331/2020, o DataJud é a fonte pública centralizada que unifica os dados processuais de toda a Justiça brasileira.",
    frequency: "Varredura contínua e periódica automatizada",
    cost: "0 Créditos de IA (100% Gratuito)",
    isFree: true,
    legalBasis: "Resolução CNJ nº 331/2020",
    iconName: "Database",
    accentColor: "blue",
    tagline: "Unificação de 90 tribunais brasileiros",
  },
  {
    id: "djen",
    name: "DJEN (CNJ)",
    shortName: "DJEN",
    fullName: "Diário de Justiça Eletrônico Nacional",
    institution: "Conselho Nacional de Justiça (CNJ)",
    badge: "Oficial CNJ",
    coverage: "Publicações judiciais oficiais de todos os ramos da Justiça",
    whatItTracks: "Despachos, intimações, sentenças, acórdãos e editais publicados em nome do advogado ou das partes.",
    description: "O diário oficial único do Poder Judiciário (Resolução CNJ nº 455/2022). O bot monitora todas as edições diárias para capturar publicações do seu número de OAB.",
    frequency: "Sincronização diária a cada nova edição",
    cost: "0 Créditos de IA (100% Gratuito)",
    isFree: true,
    legalBasis: "Resolução CNJ nº 455/2022",
    iconName: "FileText",
    accentColor: "emerald",
    tagline: "Publicações e intimações oficiais em tempo real",
  },
  {
    id: "comunicapje",
    name: "ComunicaPJe (CNJ)",
    shortName: "ComunicaPJe",
    fullName: "Comunicação Processual e Domicílio Judicial Eletrônico",
    institution: "CNJ / PDPJ-Br",
    badge: "Oficial CNJ",
    coverage: "Comunicações de atos processuais dos sistemas PJe de todo o território nacional",
    whatItTracks: "Citações e intimações eletrônicas expedidas, permitindo ciência antecipada de prazos processuais.",
    description: "Plataforma oficial de integração e comunicação processual do CNJ para intimações eletrônicas com validade legal.",
    frequency: "Monitoramento contínuo em tempo real",
    cost: "0 Créditos de IA (100% Gratuito)",
    isFree: true,
    legalBasis: "Resolução CNJ nº 234/2016 e Portaria CNJ nº 140/2023",
    iconName: "ShieldCheck",
    accentColor: "indigo",
    tagline: "Central nacional de intimações e prazos",
  },
  {
    id: "tribunais_pje",
    name: "Portais dos 27 Tribunais Estaduais e Federais (PJe / e-SAJ / Eproc / Projudi)",
    shortName: "27 TJs Estaduais, TRFs & TRTs",
    fullName: "Sistemas Eletrônicos de Todos os Estados (TJSP, TJRJ, TJMG, TJBA, TJPR, TJRS, TJPI, etc.) e TRFs 1 a 6",
    institution: "Tribunais de Justiça dos 27 Estados, TRFs e TRTs",
    badge: "Público dos Tribunais (Nacional)",
    coverage: "Varas cíveis, de família, criminais, federais e trabalhistas de todo o território brasileiro",
    whatItTracks: "Andamentos processuais em 1º e 2º grau, conclusões ao juiz, juntada de petições e certidões.",
    description: "Conexão direta aos web services de consulta pública dos portais de tribunais de todos os estados do Brasil cadastrados no seu acervo, sem qualquer restrição ao Piauí.",
    frequency: "Ciclos automáticos a cada 75 segundos",
    cost: "0 Créditos de IA (100% Gratuito)",
    isFree: true,
    legalBasis: "Lei Federal nº 11.419/2006 (Informatização do Processo Judicial)",
    iconName: "Scale",
    accentColor: "sky",
    tagline: "Cobertura nacional em todos os 27 estados",
  },
  {
    id: "cna_oab",
    name: "CNA / OAB Nacional",
    shortName: "CNA / OAB",
    fullName: "Cadastro Nacional dos Advogados (CFOAB)",
    institution: "Conselho Federal da Ordem dos Advogados do Brasil",
    badge: "Oficial OAB",
    coverage: "Todas as 27 seccionais estaduais da OAB (OAB/PI, OAB/SP, OAB/DF, etc.)",
    whatItTracks: "Localização de processos associados à sua inscrição OAB para importação e migração direta para o acervo.",
    description: "Consulta pública para validação de inscrição, situação cadastral e busca unificada de processos em que o advogado atua como patrono.",
    frequency: "Busca inicial de acervo e sincronizações periódicas",
    cost: "0 Créditos de IA (100% Gratuito)",
    isFree: true,
    legalBasis: "Estatuto da Advocacia e da OAB (Lei 8.906/1994)",
    iconName: "Building",
    accentColor: "purple",
    tagline: "Localização unificada de acervo por OAB",
  },
];
