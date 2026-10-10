// @ts-nocheck — tipos legados do LawHub em migração
/**
 * Calculadora de Prazos Processuais do LawHub
 * Em conformidade com o Código de Processo Civil (CPC/2015), CLT e CPP.
 * Regra do Art. 224:
 *   D0 = Data de Disponibilização no DJe/DJEN
 *   D1 = Data da Publicação (1º dia útil seguinte à disponibilização)
 *   D2 = Início da Contagem (1º dia útil seguinte à publicação)
 *   Art. 219: Contagem em dias úteis para prazos processuais civis.
 *   Art. 220: Suspensão no recesso forense (20 de dezembro a 20 de janeiro).
 */

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

// Feriados Nacionais Fixos do Brasil
export const NATIONAL_HOLIDAYS_FIXED: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "Confraternização Universal (Ano Novo)" },
  { month: 4, day: 21, name: "Tiradentes" },
  { month: 5, day: 1, name: "Dia Mundial do Trabalho" },
  { month: 9, day: 7, name: "Independência do Brasil" },
  { month: 10, day: 12, name: "Nossa Senhora Aparecida (Padroeira do Brasil)" },
  { month: 11, day: 2, name: "Finados" },
  { month: 11, day: 15, name: "Proclamação da República" },
  { month: 11, day: 20, name: "Dia da Consciência Negra" },
  { month: 12, day: 25, name: "Natal" },
];

/**
 * Calcula a Páscoa pelo algoritmo de Meeus/Jones/Butcher
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Retorna os feriados móveis nacionais para um dado ano (Carnaval, Sexta-feira Santa, Corpus Christi)
 */
export function getMobileHolidays(year: number): Holiday[] {
  const easter = getEasterSunday(year);
  const holidays: Holiday[] = [];

  // Carnaval: 47 dias antes da Páscoa (Segunda e Terça)
  const carnivalTuesday = new Date(easter);
  carnivalTuesday.setDate(easter.getDate() - 47);
  holidays.push({
    date: carnivalTuesday.toISOString().slice(0, 10),
    name: "Carnaval",
  });

  const carnivalMonday = new Date(easter);
  carnivalMonday.setDate(easter.getDate() - 48);
  holidays.push({
    date: carnivalMonday.toISOString().slice(0, 10),
    name: "Carnaval (Segunda-feira)",
  });

  // Sexta-feira Santa: 2 dias antes da Páscoa
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({
    date: goodFriday.toISOString().slice(0, 10),
    name: "Sexta-feira da Paixão",
  });

  // Corpus Christi: 60 dias após a Páscoa
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.push({
    date: corpusChristi.toISOString().slice(0, 10),
    name: "Corpus Christi",
  });

  return holidays;
}

/**
 * Verifica se uma data é feriado nacional ou judiciário conhecido
 */
export function checkIsHoliday(date: Date): { isHoliday: boolean; name?: string } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Feriados fixos
  const fixed = NATIONAL_HOLIDAYS_FIXED.find((h) => h.month === month && h.day === day);
  if (fixed) return { isHoliday: true, name: fixed.name };

  // Feriados da Justiça / Dia do Advogado (11 de Agosto)
  if (month === 8 && day === 11) {
    return { isHoliday: true, name: "Dia da Criação dos Cursos Jurídicos / Dia do Advogado" };
  }
  // Dia da Justiça (8 de Dezembro)
  if (month === 12 && day === 8) {
    return { isHoliday: true, name: "Dia da Justiça (Feriado Forense)" };
  }

  // Feriados móveis
  const mobiles = getMobileHolidays(year);
  const mobileFound = mobiles.find((h) => h.date === dateStr);
  if (mobileFound) return { isHoliday: true, name: mobileFound.name };

  return { isHoliday: false };
}

/**
 * Verifica se a data está no período de suspensão do recesso forense (20/dez a 20/jan - Art. 220 CPC)
 */
export function isForenseRecess(date: Date): boolean {
  const month = date.getMonth() + 1; // 1 to 12
  const day = date.getDate();

  // De 20 de dezembro até 31 de dezembro
  if (month === 12 && day >= 20) return true;
  // De 1º de janeiro até 20 de janeiro
  if (month === 1 && day <= 20) return true;

  return false;
}

/**
 * Verifica se um dia é dia útil processual (não é sábado, domingo, feriado nem recesso se ativo)
 */
export function isBusinessDay(date: Date, checkRecess = true): { isBusiness: boolean; reason?: string } {
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0) return { isBusiness: false, reason: "Domingo" };
  if (dayOfWeek === 6) return { isBusiness: false, reason: "Sábado" };

  if (checkRecess && isForenseRecess(date)) {
    return { isBusiness: false, reason: "Recesso Forense (Art. 220 CPC)" };
  }

  const holidayCheck = checkIsHoliday(date);
  if (holidayCheck.isHoliday) {
    return { isBusiness: false, reason: `Feriado: ${holidayCheck.name}` };
  }

  return { isBusiness: true };
}

/**
 * Avança a data para o próximo dia útil subsequente
 */
export function getNextBusinessDay(date: Date, checkRecess = true): Date {
  const next = new Date(date);
  do {
    next.setDate(next.getDate() + 1);
  } while (!isBusinessDay(next, checkRecess).isBusiness);
  return next;
}

export interface LegalCalculationInput {
  baseDate: string; // YYYY-MM-DD ou DD/MM/YYYY
  baseType: "disponibilizacao" | "publicacao" | "intimacao_direta";
  days: number;
  countMode: "dias_uteis" | "dias_corridos";
  includeForenseRecess?: boolean;
}

export interface LegalCalculationResult {
  disponibilizacaoDate?: string; // DD/MM/YYYY
  publicacaoDate: string; // DD/MM/YYYY
  inicioContagemDate: string; // DD/MM/YYYY
  fatalDate: string; // DD/MM/YYYY
  fatalDateIso: string; // YYYY-MM-DD
  daysCounted: number;
  mode: "dias_uteis" | "dias_corridos";
  auditSteps: Array<{
    dayNumber?: number;
    dateFormatted: string;
    dayOfWeek: string;
    type: "marco_inicial" | "dia_util" | "sabado" | "domingo" | "feriado" | "recesso" | "vencimento";
    description: string;
  }>;
}

function parseDateInput(str: string): Date {
  if (!str) return new Date();
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
  }
  const parsed = new Date(str + "T12:00:00");
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function formatDateBr(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const WEEKDAYS_BR = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/**
 * Motor Principal de Contagem de Prazos Processuais
 */
export function calculateLegalDeadline(input: LegalCalculationInput): LegalCalculationResult {
  const checkRecess = input.includeForenseRecess !== false;
  const auditSteps: LegalCalculationResult["auditSteps"] = [];
  const base = parseDateInput(input.baseDate);

  let dDisponibilizacao: Date | undefined;
  let dPublicacao: Date;
  let dInicioContagem: Date;

  if (input.baseType === "disponibilizacao") {
    dDisponibilizacao = new Date(base);
    auditSteps.push({
      dateFormatted: formatDateBr(dDisponibilizacao),
      dayOfWeek: WEEKDAYS_BR[dDisponibilizacao.getDay()],
      type: "marco_inicial",
      description: "Disponibilização no Diário de Justiça Eletrônico (D0)",
    });

    // Publicação é o primeiro dia útil seguinte à disponibilização
    dPublicacao = getNextBusinessDay(dDisponibilizacao, checkRecess);
    auditSteps.push({
      dateFormatted: formatDateBr(dPublicacao),
      dayOfWeek: WEEKDAYS_BR[dPublicacao.getDay()],
      type: "marco_inicial",
      description: "Considera-se Publicado (1º dia útil subsequente - Art. 224, caput, CPC)",
    });

    // Início da contagem é o 1º dia útil seguinte à publicação
    dInicioContagem = getNextBusinessDay(dPublicacao, checkRecess);
    auditSteps.push({
      dateFormatted: formatDateBr(dInicioContagem),
      dayOfWeek: WEEKDAYS_BR[dInicioContagem.getDay()],
      type: "marco_inicial",
      description: "Início da contagem do prazo (1º dia útil subsequente à publicação - Art. 224, § 2º, CPC)",
    });
  } else if (input.baseType === "publicacao") {
    dPublicacao = new Date(base);
    auditSteps.push({
      dateFormatted: formatDateBr(dPublicacao),
      dayOfWeek: WEEKDAYS_BR[dPublicacao.getDay()],
      type: "marco_inicial",
      description: "Data da Publicação nos autos",
    });

    dInicioContagem = getNextBusinessDay(dPublicacao, checkRecess);
    auditSteps.push({
      dateFormatted: formatDateBr(dInicioContagem),
      dayOfWeek: WEEKDAYS_BR[dInicioContagem.getDay()],
      type: "marco_inicial",
      description: "Início da contagem do prazo (1º dia útil subsequente)",
    });
  } else {
    // Intimação direta (Portal PJe ou citação pessoal)
    dPublicacao = new Date(base);
    dInicioContagem = getNextBusinessDay(dPublicacao, checkRecess);
    auditSteps.push({
      dateFormatted: formatDateBr(dPublicacao),
      dayOfWeek: WEEKDAYS_BR[dPublicacao.getDay()],
      type: "marco_inicial",
      description: "Data da Ciência / Intimação eletrônica",
    });
    auditSteps.push({
      dateFormatted: formatDateBr(dInicioContagem),
      dayOfWeek: WEEKDAYS_BR[dInicioContagem.getDay()],
      type: "marco_inicial",
      description: "Início da contagem (1º dia útil subsequente)",
    });
  }

  // Execução da contagem dos dias
  const current = new Date(dInicioContagem);
  let daysAdded = 0;
  const totalDays = Math.max(1, input.days);

  while (daysAdded < totalDays) {
    const check = isBusinessDay(current, checkRecess);
    const dateFormatted = formatDateBr(current);
    const dayOfWeek = WEEKDAYS_BR[current.getDay()];

    if (input.countMode === "dias_uteis") {
      if (check.isBusiness) {
        daysAdded++;
        auditSteps.push({
          dayNumber: daysAdded,
          dateFormatted,
          dayOfWeek,
          type: daysAdded === totalDays ? "vencimento" : "dia_util",
          description: `Dia útil ${daysAdded} de ${totalDays}${daysAdded === totalDays ? " (Termo Final)" : ""}`,
        });
      } else {
        const isSat = current.getDay() === 6;
        const isSun = current.getDay() === 0;
        auditSteps.push({
          dateFormatted,
          dayOfWeek,
          type: isSat ? "sabado" : isSun ? "domingo" : check.reason?.includes("Recesso") ? "recesso" : "feriado",
          description: `Suspenso: ${check.reason || "Não útil"}`,
        });
      }
    } else {
      // Dias corridos
      daysAdded++;
      const isLast = daysAdded === totalDays;
      auditSteps.push({
        dayNumber: daysAdded,
        dateFormatted,
        dayOfWeek,
        type: isLast ? "vencimento" : "dia_util",
        description: `Dia corrido ${daysAdded} de ${totalDays}`,
      });

      // Se o último dia corrido cair em dia não útil, prorroga-se até o primeiro dia útil seguinte (§ 1º do art. 224 do CPC)
      if (isLast && !check.isBusiness) {
        const prorrogaNext = getNextBusinessDay(current, checkRecess);
        auditSteps.push({
          dateFormatted: formatDateBr(prorrogaNext),
          dayOfWeek: WEEKDAYS_BR[prorrogaNext.getDay()],
          type: "vencimento",
          description: `Prorrogação de vencimento: término recaiu em ${check.reason}. Prorrogado para o 1º dia útil (Art. 224 § 1º CPC)`,
        });
        current.setTime(prorrogaNext.getTime());
        break;
      }
    }

    if (daysAdded < totalDays) {
      current.setDate(current.getDate() + 1);
    }
  }

  const fatalDateIso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

  return {
    disponibilizacaoDate: dDisponibilizacao ? formatDateBr(dDisponibilizacao) : undefined,
    publicacaoDate: formatDateBr(dPublicacao),
    inicioContagemDate: formatDateBr(dInicioContagem),
    fatalDate: formatDateBr(current),
    fatalDateIso,
    daysCounted: totalDays,
    mode: input.countMode,
    auditSteps,
  };
}

/**
 * Calcula a contagem regressiva em dias úteis processuais a partir de hoje
 */
export function getRemainingBusinessDays(targetDateStr: string): {
  remainingBusinessDays: number;
  totalCalendarDays: number;
  isOverdue: boolean;
  isToday: boolean;
  urgency: "vencido" | "fatal_hoje" | "critico" | "urgente" | "normal";
  label: string;
} {
  if (!targetDateStr) {
    return {
      remainingBusinessDays: 0,
      totalCalendarDays: 0,
      isOverdue: false,
      isToday: false,
      urgency: "normal",
      label: "Sem data",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = parseDateInput(targetDateStr);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const totalCalendarDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (totalCalendarDays < 0) {
    return {
      remainingBusinessDays: 0,
      totalCalendarDays,
      isOverdue: true,
      isToday: false,
      urgency: "vencido",
      label: `Vencido há ${Math.abs(totalCalendarDays)} dia(s)`,
    };
  }

  if (totalCalendarDays === 0) {
    return {
      remainingBusinessDays: 0,
      totalCalendarDays: 0,
      isOverdue: false,
      isToday: true,
      urgency: "fatal_hoje",
      label: "Prazo Fatal HOJE",
    };
  }

  // Conta dias úteis entre amanhã e a data alvo
  let businessDays = 0;
  const curr = new Date(today);
  curr.setDate(curr.getDate() + 1);

  while (curr.getTime() <= target.getTime()) {
    if (isBusinessDay(curr).isBusiness) {
      businessDays++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  let urgency: "vencido" | "fatal_hoje" | "critico" | "urgente" | "normal" = "normal";
  if (businessDays <= 1) {
    urgency = "critico";
  } else if (businessDays <= 3) {
    urgency = "urgente";
  }

  const label =
    businessDays === 1
      ? "Expira em 1 dia útil"
      : `Expira em ${businessDays} dias úteis`;

  return {
    remainingBusinessDays: businessDays,
    totalCalendarDays,
    isOverdue: false,
    isToday: false,
    urgency,
    label,
  };
}

