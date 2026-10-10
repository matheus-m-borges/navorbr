/**
 * NAVOR LawHub — Módulo de Inteligência de Numeração Única CNJ
 * Resolução e identificação de tribunais, ramos de justiça e sistemas judiciais brasileiros.
 */

export interface CourtDetectionResult {
  cnjFormatted: string;
  cleanDigits: string;
  isValidLength: boolean;
  courtCode: string;
  courtName: string;
  courtInitials: string;
  justiceBranch: "estadual" | "federal" | "trabalhista" | "militar" | "eleitoral" | "superior";
  defaultSystem: "pje" | "esaj" | "eproc" | "projudi" | "balcao_virtual" | "outro";
  systemDisplayName: string;
  recommendedSearchMode: "cnj" | "tribunal_orgao";
  tips: string;
}

// Mapeamento dos códigos da Justiça Estadual (J = 8)
const ESTADUAIS: Record<string, { initials: string; name: string; system: "pje" | "esaj" | "eproc" | "projudi" | "outro" }> = {
  "01": { initials: "TJAC", name: "Tribunal de Justiça do Acre", system: "esaj" },
  "02": { initials: "TJAL", name: "Tribunal de Justiça de Alagoas", system: "esaj" },
  "03": { initials: "TJAP", name: "Tribunal de Justiça do Amapá", system: "pje" },
  "04": { initials: "TJAM", name: "Tribunal de Justiça do Amazonas", system: "esaj" },
  "05": { initials: "TJBA", name: "Tribunal de Justiça da Bahia", system: "pje" },
  "06": { initials: "TJCE", name: "Tribunal de Justiça do Ceará", system: "esaj" },
  "07": { initials: "TJDFT", name: "Tribunal de Justiça do Distrito Federal e Territórios", system: "pje" },
  "08": { initials: "TJES", name: "Tribunal de Justiça do Espírito Santo", system: "pje" },
  "09": { initials: "TJGO", name: "Tribunal de Justiça de Goiás", system: "pje" },
  "10": { initials: "TJMA", name: "Tribunal de Justiça do Maranhão", system: "pje" },
  "11": { initials: "TJMT", name: "Tribunal de Justiça do Mato Grosso", system: "pje" },
  "12": { initials: "TJMS", name: "Tribunal de Justiça do Mato Grosso do Sul", system: "esaj" },
  "13": { initials: "TJMG", name: "Tribunal de Justiça de Minas Gerais", system: "pje" },
  "14": { initials: "TJPA", name: "Tribunal de Justiça do Pará", system: "pje" },
  "15": { initials: "TJPB", name: "Tribunal de Justiça da Paraíba", system: "pje" },
  "16": { initials: "TJPR", name: "Tribunal de Justiça do Paraná", system: "projudi" },
  "17": { initials: "TJPE", name: "Tribunal de Justiça de Pernambuco", system: "pje" },
  "18": { initials: "TJPI", name: "Tribunal de Justiça do Piauí", system: "pje" },
  "19": { initials: "TJRJ", name: "Tribunal de Justiça do Rio de Janeiro", system: "pje" },
  "20": { initials: "TJRN", name: "Tribunal de Justiça do Rio Grande do Norte", system: "pje" },
  "21": { initials: "TJRS", name: "Tribunal de Justiça do Rio Grande do Sul", system: "eproc" },
  "22": { initials: "TJRO", name: "Tribunal de Justiça de Rondônia", system: "pje" },
  "23": { initials: "TJRR", name: "Tribunal de Justiça de Roraima", system: "projudi" },
  "24": { initials: "TJSC", name: "Tribunal de Justiça de Santa Catarina", system: "eproc" },
  "25": { initials: "TJSE", name: "Tribunal de Justiça de Sergipe", system: "pje" },
  "26": { initials: "TJSP", name: "Tribunal de Justiça de São Paulo", system: "esaj" },
  "27": { initials: "TJTO", name: "Tribunal de Justiça do Tocantins", system: "eproc" },
};

// Mapeamento dos códigos da Justiça Federal (J = 4)
const FEDERAIS: Record<string, { initials: string; name: string; system: "pje" | "eproc" }> = {
  "01": { initials: "TRF1", name: "Tribunal Regional Federal da 1ª Região", system: "pje" },
  "02": { initials: "TRF2", name: "Tribunal Regional Federal da 2ª Região", system: "eproc" },
  "03": { initials: "TRF3", name: "Tribunal Regional Federal da 3ª Região", system: "pje" },
  "04": { initials: "TRF4", name: "Tribunal Regional Federal da 4ª Região", system: "eproc" },
  "05": { initials: "TRF5", name: "Tribunal Regional Federal da 5ª Região", system: "pje" },
  "06": { initials: "TRF6", name: "Tribunal Regional Federal da 6ª Região", system: "pje" },
};

// Mapeamento da Justiça do Trabalho (J = 5)
const TRABALHISTAS: Record<string, { initials: string; name: string }> = {
  "01": { initials: "TRT1", name: "TRT da 1ª Região (RJ)" },
  "02": { initials: "TRT2", name: "TRT da 2ª Região (SP)" },
  "03": { initials: "TRT3", name: "TRT da 3ª Região (MG)" },
  "04": { initials: "TRT4", name: "TRT da 4ª Região (RS)" },
  "05": { initials: "TRT5", name: "TRT da 5ª Região (BA)" },
  "06": { initials: "TRT6", name: "TRT da 6ª Região (PE)" },
  "07": { initials: "TRT7", name: "TRT da 7ª Região (CE)" },
  "08": { initials: "TRT8", name: "TRT da 8ª Região (PA/AP)" },
  "09": { initials: "TRT9", name: "TRT da 9ª Região (PR)" },
  "10": { initials: "TRT10", name: "TRT da 10ª Região (DF/TO)" },
  "11": { initials: "TRT11", name: "TRT da 11ª Região (AM/RR)" },
  "12": { initials: "TRT12", name: "TRT da 12ª Região (SC)" },
  "13": { initials: "TRT13", name: "TRT da 13ª Região (PB)" },
  "14": { initials: "TRT14", name: "TRT da 14ª Região (RO/AC)" },
  "15": { initials: "TRT15", name: "TRT da 15ª Região (Campinas/SP)" },
  "16": { initials: "TRT16", name: "TRT da 16ª Região (MA)" },
  "17": { initials: "TRT17", name: "TRT da 17ª Região (ES)" },
  "18": { initials: "TRT18", name: "TRT da 18ª Região (GO)" },
  "19": { initials: "TRT19", name: "TRT da 19ª Região (AL)" },
  "20": { initials: "TRT20", name: "TRT da 20ª Região (SE)" },
  "21": { initials: "TRT21", name: "TRT da 21ª Região (RN)" },
  "22": { initials: "TRT22", name: "TRT da 22ª Região (PI)" },
  "23": { initials: "TRT23", name: "TRT da 23ª Região (MT)" },
  "24": { initials: "TRT24", name: "TRT da 24ª Região (MS)" },
};

/**
 * Aplica máscara padrão CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
 */
export function formatCNJ(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 20);
  if (digits.length <= 7) return digits;
  if (digits.length <= 9) return `${digits.slice(0, 7)}-${digits.slice(7)}`;
  if (digits.length <= 13) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9)}`;
  if (digits.length <= 14) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13)}`;
  if (digits.length <= 16) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14)}`;
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
}

/**
 * Analisa uma numeração CNJ e identifica o tribunal e sistema processual.
 */
export function detectCourtFromCNJ(rawInput: string): CourtDetectionResult | null {
  const clean = (rawInput || "").replace(/\D/g, "");
  if (clean.length < 14) return null;

  const formatted = formatCNJ(clean);

  // A numeração é: NNNNNNN (7) + DD (2) + AAAA (4) + J (1) + TR (2) + OOOO (4) = 20 dígitos
  // J está na posição de índice 13 (0-indexed)
  // TR está nos índices 14 e 15
  const jDigit = clean.slice(13, 14);
  const trDigits = clean.slice(14, 16);

  let courtInitials = "Tribunal Judicial";
  let courtName = "Tribunal da Justiça Brasileira";
  let justiceBranch: CourtDetectionResult["justiceBranch"] = "estadual";
  let defaultSystem: CourtDetectionResult["defaultSystem"] = "pje";
  let systemDisplayName = "PJe Nacional";
  let tips = "Consulta pública padrão em primeiro grau.";

  if (jDigit === "8") {
    // Justiça Estadual
    justiceBranch = "estadual";
    const found = ESTADUAIS[trDigits];
    if (found) {
      courtInitials = found.initials;
      courtName = found.name;
      defaultSystem = found.system;
      systemDisplayName =
        found.system === "esaj"
          ? "e-SAJ (Tribunal Estadual)"
          : found.system === "eproc"
          ? "Eproc Estadual"
          : found.system === "projudi"
          ? "Projudi"
          : "PJe Eletrônico";
      tips =
        found.system === "esaj"
          ? "Tribunal operando no sistema e-SAJ. Para autos em segredo de justiça, utilize Certificado Digital A1 ou senha do Balcão Virtual."
          : found.system === "eproc"
          ? "Tribunal em plataforma Eproc. Para processos restritos, utilize autenticação de 2 fatores (2FA)."
          : found.system === "projudi"
          ? "Tribunal com Projudi. Consulta por OAB ou CPF com senha do advogado."
          : "Tribunal integrado ao PJe. Processos em segredo de justiça exigem 2FA SEED ou CPF e senha.";
    }
  } else if (jDigit === "4") {
    // Justiça Federal
    justiceBranch = "federal";
    const found = FEDERAIS[trDigits];
    if (found) {
      courtInitials = found.initials;
      courtName = found.name;
      defaultSystem = found.system;
      systemDisplayName = found.system === "eproc" ? "Eproc Federal" : "PJe Federal";
      tips = "Justiça Federal. Consultas em 1º e 2º graus com monitoramento automático.";
    } else {
      courtInitials = `TRF (${trDigits}ª Região)`;
      courtName = `Tribunal Regional Federal`;
      defaultSystem = "pje";
      systemDisplayName = "PJe Federal";
    }
  } else if (jDigit === "5") {
    // Justiça do Trabalho
    justiceBranch = "trabalhista";
    const found = TRABALHISTAS[trDigits];
    if (found) {
      courtInitials = found.initials;
      courtName = found.name;
      defaultSystem = "pje";
      systemDisplayName = "PJe-JT (Justiça do Trabalho)";
      tips = "Processo Trabalhista (PJe-JT). Suporte a audiências e intimações do DJEN.";
    } else if (trDigits === "00") {
      courtInitials = "TST";
      courtName = "Tribunal Superior do Trabalho";
      justiceBranch = "superior";
      defaultSystem = "pje";
      systemDisplayName = "PJe-TST";
      tips = "Instância Superior Trabalhista.";
    }
  } else if (jDigit === "1") {
    courtInitials = "STF";
    courtName = "Supremo Tribunal Federal";
    justiceBranch = "superior";
    defaultSystem = "outro";
    systemDisplayName = "Portal Eletrônico STF";
    tips = "Instância Máxima Constitucional.";
  } else if (jDigit === "3") {
    courtInitials = "STJ";
    courtName = "Superior Tribunal de Justiça";
    justiceBranch = "superior";
    defaultSystem = "pje";
    systemDisplayName = "PJe / Consulta STJ";
    tips = "Instância Especial Superior (Precedentes e Recursos Especiais).";
  }

  return {
    cnjFormatted: formatted,
    cleanDigits: clean,
    isValidLength: clean.length === 20,
    courtCode: `${jDigit}.${trDigits}`,
    courtName,
    courtInitials,
    justiceBranch,
    defaultSystem,
    systemDisplayName,
    recommendedSearchMode: "cnj",
    tips,
  };
}
