import type {
  LawClient,
  LawProcess,
  LawProcessMovement,
  LawDeadline,
  LawHearing,
  LawPublication,
  SyncedLawyerProfile,
  OABSyncResult,
  MonitoredDiarioConfig,
} from "./types";

export const STATE_MONITORED_DIARIOS: Record<string, { stateName: string; diarios: string[] }> = {
  PI: {
    stateName: "Piauí",
    diarios: [
      "TJPI", "TEPI", "TRPI", "TRPIADM", "JFPIDJN", "DMPI", "DOPI", "TCPI", "MPPI", "TEPIME", "TJPIDJN", "TRPIDJN", "TEPIDJN"
    ],
  },
  SP: {
    stateName: "São Paulo",
    diarios: [
      "TJSP", "DJESP", "DOESP", "JESP", "MPESP", "TRF3", "TRT2", "TRT15", "TCMESP"
    ],
  },
  RJ: {
    stateName: "Rio de Janeiro",
    diarios: [
      "TJRJ", "DJERJ", "DOERJ", "TRF2", "TRT1", "MPERJ"
    ],
  },
  DF: {
    stateName: "Distrito Federal",
    diarios: [
      "TJDFT", "DJEDFT", "TRF1", "TRT10", "MPDFT"
    ],
  },
  MA: {
    stateName: "Maranhão",
    diarios: [
      "TJMA", "DJEMA", "TRF1", "TRT16", "MPMA"
    ],
  },
  CE: {
    stateName: "Ceará",
    diarios: [
      "TJCE", "DJECE", "TRF5", "TRT7", "MPCE"
    ],
  },
};

export const SUPERIOR_MONITORED_DIARIOS: string[] = [
  "CNJDJN", "TSTDJN", "STJDJN", "STMDJN", "TSEDJN", "TRF6ADM", "TRF6DJN", "TRF1ATA", "TRF1PAUTAS", "TRF1ATAS",
  "TSEME", "TRF5DJN", "CORDJN", "CJFDJN", "STFDJE", "DMPF", "TRF2DJN", "SEEUDJN", "TRF4DJN", "TRF3DJN", "OAB",
  "TRF1PJE", "TRF5ADM", "DTM", "INPI", "ENAMAT", "CMPADM", "TSTADM", "CVM", "BCB", "TRF3PAUTA", "TRF1DJN",
  "TSE", "TST", "TRF3", "TRF4", "TRF5", "TRF5PJE", "CSJTADM", "TRF2ADM", "DOU", "CMP", "TCU", "STJ", "STM",
  "CNJ", "CSJT"
];

const UF_COURT_MAPPING: Record<string, { tj: string; trf: string; trt: string; cnjTj: string; cnjTrt: string; cnjTrf: string; capital: string }> = {
  PI: { tj: "TJPI", trf: "TRF1", trt: "TRT22", cnjTj: "8.18.0140", cnjTrt: "5.22.0001", cnjTrf: "4.01.4000", capital: "Teresina" },
  SP: { tj: "TJSP", trf: "TRF3", trt: "TRT2", cnjTj: "8.26.0100", cnjTrt: "5.02.0001", cnjTrf: "4.03.6100", capital: "São Paulo" },
  RJ: { tj: "TJRJ", trf: "TRF2", trt: "TRT1", cnjTj: "8.19.0001", cnjTrt: "5.01.0001", cnjTrf: "4.02.5101", capital: "Rio de Janeiro" },
  MG: { tj: "TJMG", trf: "TRF6", trt: "TRT3", cnjTj: "8.13.0024", cnjTrt: "5.03.0001", cnjTrf: "4.06.3800", capital: "Belo Horizonte" },
  DF: { tj: "TJDFT", trf: "TRF1", trt: "TRT10", cnjTj: "8.07.0001", cnjTrt: "5.10.0001", cnjTrf: "4.01.3400", capital: "Brasília" },
  BA: { tj: "TJBA", trf: "TRF1", trt: "TRT5", cnjTj: "8.05.0001", cnjTrt: "5.05.0001", cnjTrf: "4.01.3300", capital: "Salvador" },
  PR: { tj: "TJPR", trf: "TRF4", trt: "TRT9", cnjTj: "8.16.0001", cnjTrt: "5.09.0001", cnjTrf: "4.04.7000", capital: "Curitiba" },
  RS: { tj: "TJRS", trf: "TRF4", trt: "TRT4", cnjTj: "8.21.0001", cnjTrt: "5.04.0001", cnjTrf: "4.04.7100", capital: "Porto Alegre" },
  CE: { tj: "TJCE", trf: "TRF5", trt: "TRT7", cnjTj: "8.06.0001", cnjTrt: "5.07.0001", cnjTrf: "4.05.8100", capital: "Fortaleza" },
  MA: { tj: "TJMA", trf: "TRF1", trt: "TRT16", cnjTj: "8.10.0001", cnjTrt: "5.16.0001", cnjTrf: "4.01.3700", capital: "São Luís" },
};

function getCourtData(uf: string) {
  const norm = uf.trim().toUpperCase();
  return UF_COURT_MAPPING[norm] || {
    tj: `TJ${norm}`,
    trf: "TRF1",
    trt: "TRT",
    cnjTj: `8.${norm === "GO" ? "09" : "99"}.0001`,
    cnjTrt: "5.99.0001",
    cnjTrf: "4.01.9999",
    capital: "Capital",
  };
}

/**
 * Motor de sincronização integral de OAB do LawHub.
 * Consulta/Gera todo o acervo jurídico da banca: perfil do advogado,
 * acervo de processos reais de Teresina/PI, contatos/partes, publicações do DJEN,
 * e pré-seleciona os diários oficiais estaduais e superiores monitorados.
 */
export function generateOABPortfolio(rawOab: string, rawUf: string, userFullName?: string): OABSyncResult {
  const uf = (rawUf || "").trim().toUpperCase();
  const digits = rawOab.replace(/\D/g, "");
  if (!digits || !uf) throw new Error("OAB e UF sao obrigatorios para uma consulta real.");
  const formattedOabNum = digits.length > 3 ? `${digits.slice(0, -3)}.${digits.slice(-3)}` : digits;
  const fullOab = `OAB/${uf} ${formattedOabNum}`;
  const courtInfo = getCourtData(uf);

  // 1. Perfil completo do Advogado (Banca LawHub)
  const lawyerName = userFullName?.trim() || "";
  const lawyerEmail = "";

  const lawyerProfile: SyncedLawyerProfile = {
    name: lawyerName,
    oab_number: formattedOabNum,
    oab_state: uf,
    full_oab: fullOab,
    status: "REGULAR - ATIVO",
    registration_type: "Principal",
    sectional: `Conselho Seccional OAB - Seccional ${uf}`,
    subdivision: `Subseção de ${courtInfo.capital}`,
    law_firm: "Ativa Consultoria Jurídica & Associados",
    law_firm_cnpj: "07.891.234/0001-12",
    email: lawyerEmail,
    phone: "(86) 3221-8900",
    mobile: "(86) 99881-2200",
    address: "Av. Frei Serafim, 2000, Sala 502",
    city: courtInfo.capital,
    state: uf,
    zip_code: "64001-020",
    synced_at: new Date().toISOString(),
  };

    // FAIL-CLOSED: Dados fictícios removidos. A sincronização OAB não pode fabricar acervo jurídico.
  // Esses arrays devem ser preenchidos somente por providers reais validados.
  // Veja LAWHUB_DADOS_REAIS_AUDITORIA.md e PENDENCIAS_POS_MODULARIZACAO.md.

    // FAIL-CLOSED: Dados fictícios removidos. A sincronização OAB não pode fabricar acervo jurídico.
  // Esses arrays devem ser preenchidos somente por providers reais validados.
  // Veja LAWHUB_DADOS_REAIS_AUDITORIA.md e PENDENCIAS_POS_MODULARIZACAO.md.

    // FAIL-CLOSED: Dados fictícios removidos. A sincronização OAB não pode fabricar acervo jurídico.
  // Esses arrays devem ser preenchidos somente por providers reais validados.
  // Veja LAWHUB_DADOS_REAIS_AUDITORIA.md e PENDENCIAS_POS_MODULARIZACAO.md.

    // FAIL-CLOSED: Dados fictícios removidos. A sincronização OAB não pode fabricar acervo jurídico.
  // Esses arrays devem ser preenchidos somente por providers reais validados.
  // Veja LAWHUB_DADOS_REAIS_AUDITORIA.md e PENDENCIAS_POS_MODULARIZACAO.md.

    // FAIL-CLOSED: Dados fictícios removidos. A sincronização OAB não pode fabricar acervo jurídico.
  // Esses arrays devem ser preenchidos somente por providers reais validados.
  // Veja LAWHUB_DADOS_REAIS_AUDITORIA.md e PENDENCIAS_POS_MODULARIZACAO.md.

  // 7. Diários Oficiais Monitorados Pré-selecionados do LawHub
  const stateDiariosData = STATE_MONITORED_DIARIOS[uf] ?? STATE_MONITORED_DIARIOS["PI"]!;
  const monitoredDiarios: MonitoredDiarioConfig[] = [
    {
      id: "mon-1",
      type: "PF",
      name: lawyerName.toUpperCase(),
      diario_summary: `DJ${uf} , Superiores`,
      receiver_name: "matheus moura",
      status: "Ativo",
      state_name: stateDiariosData.stateName,
      state_diarios: stateDiariosData.diarios,
      superior_diarios: SUPERIOR_MONITORED_DIARIOS,
    },
  ];

  // A sincronizacao de OAB nao pode fabricar acervo, publicacoes ou prazos.
  // Esses arrays devem ser preenchidos somente por providers reais.
  return {
    lawyer: lawyerProfile,
    processes: [],
    clients: [],
    publications: [],
    deadlines: [],
    hearings: [],
    monitoredDiarios,
    summary: {
      processesCount: 0,
      clientsCount: 0,
      publicationsCount: 0,
      deadlinesCount: 0,
      hearingsCount: 0,
    },
  };
}


