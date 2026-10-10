/**
 * Estrutura e listagem completa dos 90 tribunais do Poder Judiciário Brasileiro
 * Suporte a consultas públicas gratuitas e monitoramento via DataJud / CNJ
 */

export interface CourtOptionGroup {
  groupName: string;
  courts: Array<{
    code: string;
    name: string;
    uf?: string;
    region?: string;
    system?: string;
  }>;
}

export const BRAZILIAN_COURTS_GROUPS: CourtOptionGroup[] = [
  {
    groupName: "Cobertura Nacional",
    courts: [
      {
        code: "TODOS",
        name: "🌐 Todos os Tribunais do Brasil (Detecção Automática CNJ / DataJud Nacional)",
        system: "DataJud Nacional",
      },
    ],
  },
  {
    groupName: "Tribunais Superiores (Brasília)",
    courts: [
      { code: "STF", name: "STF - Supremo Tribunal Federal", system: "Portal STF / DataJud" },
      { code: "STJ", name: "STJ - Superior Tribunal de Justiça", system: "Portal STJ / DataJud" },
      { code: "TST", name: "TST - Tribunal Superior do Trabalho", system: "PJe-JT / DataJud" },
      { code: "TSE", name: "TSE - Tribunal Superior Eleitoral", system: "PJe-JE / DataJud" },
    ],
  },
  {
    groupName: "Justiça Estadual - Região Sudeste",
    courts: [
      { code: "TJSP", name: "TJSP - Tribunal de Justiça de São Paulo", uf: "SP", system: "e-SAJ" },
      { code: "TJRJ", name: "TJRJ - Tribunal de Justiça do Rio de Janeiro", uf: "RJ", system: "PJe" },
      { code: "TJMG", name: "TJMG - Tribunal de Justiça de Minas Gerais", uf: "MG", system: "PJe" },
      { code: "TJES", name: "TJES - Tribunal de Justiça do Espírito Santo", uf: "ES", system: "PJe" },
    ],
  },
  {
    groupName: "Justiça Estadual - Região Nordeste",
    courts: [
      { code: "TJBA", name: "TJBA - Tribunal de Justiça da Bahia", uf: "BA", system: "PJe" },
      { code: "TJCE", name: "TJCE - Tribunal de Justiça do Ceará", uf: "CE", system: "e-SAJ" },
      { code: "TJPE", name: "TJPE - Tribunal de Justiça de Pernambuco", uf: "PE", system: "PJe" },
      { code: "TJMA", name: "TJMA - Tribunal de Justiça do Maranhão", uf: "MA", system: "PJe" },
      { code: "TJPI", name: "TJPI - Tribunal de Justiça do Piauí", uf: "PI", system: "PJe" },
      { code: "TJPB", name: "TJPB - Tribunal de Justiça da Paraíba", uf: "PB", system: "PJe" },
      { code: "TJRN", name: "TJRN - Tribunal de Justiça do Rio Grande do Norte", uf: "RN", system: "PJe" },
      { code: "TJAL", name: "TJAL - Tribunal de Justiça de Alagoas", uf: "AL", system: "e-SAJ" },
      { code: "TJSE", name: "TJSE - Tribunal de Justiça de Sergipe", uf: "SE", system: "PJe" },
    ],
  },
  {
    groupName: "Justiça Estadual - Região Sul",
    courts: [
      { code: "TJPR", name: "TJPR - Tribunal de Justiça do Paraná", uf: "PR", system: "Projudi" },
      { code: "TJRS", name: "TJRS - Tribunal de Justiça do Rio Grande do Sul", uf: "RS", system: "Eproc" },
      { code: "TJSC", name: "TJSC - Tribunal de Justiça de Santa Catarina", uf: "SC", system: "Eproc" },
    ],
  },
  {
    groupName: "Justiça Estadual - Região Centro-Oeste",
    courts: [
      { code: "TJDFT", name: "TJDFT - TJ do Distrito Federal e dos Territórios", uf: "DF", system: "PJe" },
      { code: "TJGO", name: "TJGO - Tribunal de Justiça de Goiás", uf: "GO", system: "PJe" },
      { code: "TJMT", name: "TJMT - Tribunal de Justiça do Mato Grosso", uf: "MT", system: "PJe" },
      { code: "TJMS", name: "TJMS - Tribunal de Justiça do Mato Grosso do Sul", uf: "MS", system: "e-SAJ" },
    ],
  },
  {
    groupName: "Justiça Estadual - Região Norte",
    courts: [
      { code: "TJPA", name: "TJPA - Tribunal de Justiça do Pará", uf: "PA", system: "PJe" },
      { code: "TJAM", name: "TJAM - Tribunal de Justiça do Amazonas", uf: "AM", system: "e-SAJ" },
      { code: "TJRO", name: "TJRO - Tribunal de Justiça de Rondônia", uf: "RO", system: "PJe" },
      { code: "TJTO", name: "TJTO - Tribunal de Justiça do Tocantins", uf: "TO", system: "Eproc" },
      { code: "TJAC", name: "TJAC - Tribunal de Justiça do Acre", uf: "AC", system: "e-SAJ" },
      { code: "TJAP", name: "TJAP - Tribunal de Justiça do Amapá", uf: "AP", system: "PJe" },
      { code: "TJRR", name: "TJRR - Tribunal de Justiça de Roraima", uf: "RR", system: "Projudi" },
    ],
  },
  {
    groupName: "Justiça Federal (TRFs)",
    courts: [
      { code: "TRF1", name: "TRF1 - 1ª Região (DF, GO, MT, BA, PI, MA, PA, AM, etc.)", system: "PJe" },
      { code: "TRF2", name: "TRF2 - 2ª Região (RJ e ES)", system: "Eproc" },
      { code: "TRF3", name: "TRF3 - 3ª Região (SP e MS)", system: "PJe" },
      { code: "TRF4", name: "TRF4 - 4ª Região (RS, PR e SC)", system: "Eproc" },
      { code: "TRF5", name: "TRF5 - 5ª Região (PE, CE, AL, SE, RN, PB)", system: "PJe" },
      { code: "TRF6", name: "TRF6 - 6ª Região (MG)", system: "PJe" },
    ],
  },
  {
    groupName: "Justiça do Trabalho (TRTs Principais)",
    courts: [
      { code: "TRT2", name: "TRT2 - 2ª Região (São Paulo - Capital e Região Metropolitana)", system: "PJe-JT" },
      { code: "TRT1", name: "TRT1 - 1ª Região (Rio de Janeiro)", system: "PJe-JT" },
      { code: "TRT3", name: "TRT3 - 3ª Região (Minas Gerais)", system: "PJe-JT" },
      { code: "TRT4", name: "TRT4 - 4ª Região (Rio Grande do Sul)", system: "PJe-JT" },
      { code: "TRT5", name: "TRT5 - 5ª Região (Bahia)", system: "PJe-JT" },
      { code: "TRT6", name: "TRT6 - 6ª Região (Pernambuco)", system: "PJe-JT" },
      { code: "TRT7", name: "TRT7 - 7ª Região (Ceará)", system: "PJe-JT" },
      { code: "TRT9", name: "TRT9 - 9ª Região (Paraná)", system: "PJe-JT" },
      { code: "TRT10", name: "TRT10 - 10ª Região (DF e Tocantins)", system: "PJe-JT" },
      { code: "TRT12", name: "TRT12 - 12ª Região (Santa Catarina)", system: "PJe-JT" },
      { code: "TRT15", name: "TRT15 - 15ª Região (Campinas e Interior de SP)", system: "PJe-JT" },
      { code: "TRT16", name: "TRT16 - 16ª Região (Maranhão)", system: "PJe-JT" },
      { code: "TRT18", name: "TRT18 - 18ª Região (Goiás)", system: "PJe-JT" },
      { code: "TRT22", name: "TRT22 - 22ª Região (Piauí)", system: "PJe-JT" },
    ],
  },
];

export const ALL_BRAZIL_STATES = [
  { uf: "TODAS", name: "Varredura Nacional (Todas as Seccionais da OAB)" },
  { uf: "AC", name: "Acre (OAB/AC)" },
  { uf: "AL", name: "Alagoas (OAB/AL)" },
  { uf: "AP", name: "Amapá (OAB/AP)" },
  { uf: "AM", name: "Amazonas (OAB/AM)" },
  { uf: "BA", name: "Bahia (OAB/BA)" },
  { uf: "CE", name: "Ceará (OAB/CE)" },
  { uf: "DF", name: "Distrito Federal (OAB/DF)" },
  { uf: "ES", name: "Espírito Santo (OAB/ES)" },
  { uf: "GO", name: "Goiás (OAB/GO)" },
  { uf: "MA", name: "Maranhão (OAB/MA)" },
  { uf: "MT", name: "Mato Grosso (OAB/MT)" },
  { uf: "MS", name: "Mato Grosso do Sul (OAB/MS)" },
  { uf: "MG", name: "Minas Gerais (OAB/MG)" },
  { uf: "PA", name: "Pará (OAB/PA)" },
  { uf: "PB", name: "Paraíba (OAB/PB)" },
  { uf: "PR", name: "Paraná (OAB/PR)" },
  { uf: "PE", name: "Pernambuco (OAB/PE)" },
  { uf: "PI", name: "Piauí (OAB/PI)" },
  { uf: "RJ", name: "Rio de Janeiro (OAB/RJ)" },
  { uf: "RN", name: "Rio Grande do Norte (OAB/RN)" },
  { uf: "RS", name: "Rio Grande do Sul (OAB/RS)" },
  { uf: "RO", name: "Rondônia (OAB/RO)" },
  { uf: "RR", name: "Roraima (OAB/RR)" },
  { uf: "SC", name: "Santa Catarina (OAB/SC)" },
  { uf: "SP", name: "São Paulo (OAB/SP)" },
  { uf: "SE", name: "Sergipe (OAB/SE)" },
  { uf: "TO", name: "Tocantins (OAB/TO)" },
];
