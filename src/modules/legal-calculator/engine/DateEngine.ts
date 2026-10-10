/**
 * NAVOR LAWHUB — MOTOR DE DATAS E PRAZOS PROCESSUAIS
 * Trata contagens de dias corridos, dias úteis, competências mensais,
 * frações pro rata e transições temporais de legislação.
 */

export interface DateDifference {
  totalDays: number;
  totalMonths: number;
  remainingDays: number;
  isNegative: boolean;
}

export class DateEngine {
  /**
   * Converte string YYYY-MM-DD ou Date para objeto Date UTC seguro.
   */
  static parse(dateStrOrDate: string | Date): Date {
    if (dateStrOrDate instanceof Date) {
      return new Date(Date.UTC(dateStrOrDate.getFullYear(), dateStrOrDate.getMonth(), dateStrOrDate.getDate()));
    }
    const clean = String(dateStrOrDate).trim().slice(0, 10);
    const [year, month, day] = clean.split("-").map(Number);
    if (!year || !month || !day) {
      throw new Error(`Data inválida fornecida ao motor de cálculo: ${dateStrOrDate}`);
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  static formatISO(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  static formatBR(dateStrOrDate: string | Date): string {
    const d = typeof dateStrOrDate === "string" ? this.parse(dateStrOrDate) : dateStrOrDate;
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  static formatCompetencia(dateStrOrDate: string | Date): string {
    const d = typeof dateStrOrDate === "string" ? this.parse(dateStrOrDate) : dateStrOrDate;
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${month}/${year}`;
  }

  /**
   * Diferença em dias corridos entre duas datas.
   */
  static diffDays(start: string | Date, end: string | Date): number {
    const d1 = typeof start === "string" ? this.parse(start) : start;
    const d2 = typeof end === "string" ? this.parse(end) : end;
    const msPerDay = 86400000;
    return Math.round((d2.getTime() - d1.getTime()) / msPerDay);
  }

  /**
   * Verifica se a data fim é posterior ou igual à data início.
   */
  static isValidPeriod(start: string | Date, end: string | Date): boolean {
    const d1 = typeof start === "string" ? this.parse(start) : start;
    const d2 = typeof end === "string" ? this.parse(end) : end;
    return d2.getTime() >= d1.getTime();
  }

  /**
   * Retorna o primeiro dia do mês de uma data.
   */
  static startOfMonth(dateStrOrDate: string | Date): Date {
    const d = typeof dateStrOrDate === "string" ? this.parse(dateStrOrDate) : dateStrOrDate;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  /**
   * Retorna o último dia do mês de uma data.
   */
  static endOfMonth(dateStrOrDate: string | Date): Date {
    const d = typeof dateStrOrDate === "string" ? this.parse(dateStrOrDate) : dateStrOrDate;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  }

  /**
   * Quantidade de dias no mês da data fornecida.
   */
  static daysInMonth(dateStrOrDate: string | Date): number {
    const end = this.endOfMonth(dateStrOrDate);
    return end.getUTCDate();
  }

  /**
   * Gera a lista de competências mensais (MM/YYYY) e os limites de cada fatia entre start e end.
   */
  static getMonthlyIntervals(startStr: string, endStr: string): Array<{
    competence: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    isPartial: boolean;
  }> {
    const start = this.parse(startStr);
    const end = this.parse(endStr);

    if (end.getTime() < start.getTime()) {
      throw new Error("Data final não pode ser anterior à data inicial.");
    }

    const intervals: Array<{
      competence: string;
      startDate: string;
      endDate: string;
      daysCount: number;
      isPartial: boolean;
    }> = [];

    let current = new Date(start.getTime());

    while (current.getTime() <= end.getTime()) {
      const monthStart = this.startOfMonth(current);
      const monthEnd = this.endOfMonth(current);

      const sliceStart = current.getTime() > monthStart.getTime() ? current : monthStart;
      const sliceEnd = end.getTime() < monthEnd.getTime() ? end : monthEnd;

      const daysCount = this.diffDays(sliceStart, sliceEnd) + 1; // Inclusivo
      const totalMonthDays = this.daysInMonth(current);
      const isPartial = daysCount < totalMonthDays;

      intervals.push({
        competence: this.formatCompetencia(sliceStart),
        startDate: this.formatISO(sliceStart),
        endDate: this.formatISO(sliceEnd),
        daysCount,
        isPartial,
      });

      // Avança para o primeiro dia do próximo mês
      current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
    }

    return intervals;
  }

  /**
   * Adiciona dias corridos a uma data.
   */
  static addDays(dateStrOrDate: string | Date, days: number): Date {
    const d = typeof dateStrOrDate === "string" ? this.parse(dateStrOrDate) : dateStrOrDate;
    return new Date(d.getTime() + days * 86400000);
  }

  /**
   * Verifica se o ano é bissexto.
   */
  static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }
}
