// Domínio de representação comercial: constantes e cálculos financeiros.
// Regra: todo cálculo de comissão oficial é feito no banco (função recalc_commission).
// Aqui só há agregações de exibição, sempre em centavos inteiros para evitar
// erros de ponto flutuante.

export const COMMISSION_MODES = ["Faturamento", "Liquidez", "Mista"] as const;
export type CommissionMode = (typeof COMMISSION_MODES)[number];

export const COLLECTION_STATUSES = [
  "Planejada",
  "Em preparação",
  "Aberta para vendas",
  "Em vendas",
  "Encerrada",
  "Cancelada",
] as const;

export const ORDER_STATUSES = [
  "Pré-pedido",
  "Pedido lançado",
  "Enviado para fábrica",
  "Aceito pela fábrica",
  "Em produção",
  "Faturamento parcial",
  "Faturado",
  "Cancelado",
  "Finalizado",
] as const;

export const INSTALLMENT_STATUSES = [
  "Em aberto",
  "Pago",
  "Pago parcialmente",
  "Em atraso",
  "Cancelado",
] as const;

export const COMMISSION_STATUSES = [
  "Prevista",
  "A receber",
  "Parcialmente recebida",
  "Recebida",
] as const;

export const FACTORY_STATUSES = ["Ativa", "Inativa"] as const;

export const DOCUMENT_CATEGORIES = [
  "Pedido",
  "Espelho do pedido",
  "Nota fiscal",
  "Contrato",
  "Cadastro",
  "Comprovante",
  "Comercial",
  "Outros",
] as const;

export const collectionTone: Record<string, "brand" | "cyan" | "violet" | "amber" | "rose" | "muted"> = {
  Planejada: "muted",
  "Em preparação": "amber",
  "Aberta para vendas": "cyan",
  "Em vendas": "brand",
  Encerrada: "muted",
  Cancelada: "rose",
};

export const orderTone: Record<string, "brand" | "cyan" | "violet" | "amber" | "rose" | "muted"> = {
  "Pré-pedido": "muted",
  "Pedido lançado": "cyan",
  "Enviado para fábrica": "cyan",
  "Aceito pela fábrica": "violet",
  "Em produção": "amber",
  "Faturamento parcial": "amber",
  Faturado: "brand",
  Cancelado: "rose",
  Finalizado: "brand",
};

export const commissionTone: Record<string, "brand" | "cyan" | "violet" | "amber" | "rose" | "muted"> = {
  Prevista: "muted",
  "A receber": "amber",
  "Parcialmente recebida": "cyan",
  Recebida: "brand",
};

export const installmentTone: Record<string, "brand" | "cyan" | "violet" | "amber" | "rose" | "muted"> = {
  "Em aberto": "cyan",
  Pago: "brand",
  "Pago parcialmente": "amber",
  "Em atraso": "rose",
  Cancelado: "muted",
};

/** Converte reais (number vindo do banco) para centavos inteiros. */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Soma precisa de uma lista de valores monetários. */
export function sumMoney<T>(rows: T[], pick: (row: T) => number | string | null | undefined): number {
  return fromCents(rows.reduce((acc, row) => acc + toCents(pick(row)), 0));
}

/** Percentual com uma casa, protegido contra divisão por zero. */
export function pct(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

export function ticket(total: number, count: number): number {
  if (!count) return 0;
  return fromCents(Math.round((toCents(total) / count) * 1) / 1) / 1;
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T12:00:00`).getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

export function onlyDigitsCnpj(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Descreve a regra de comissão aplicada (marca sobrepõe fábrica). */
export function describeRule(mode: string, pctInvoice: number, pctSettlement: number): string {
  if (mode === "Mista") {
    return `Mista — ${pctInvoice}% no faturamento + ${pctSettlement}% na liquidez`;
  }
  if (mode === "Liquidez") return `Liquidez — ${pctSettlement}%`;
  return `Faturamento — ${pctInvoice}%`;
}

export function resolveRule(
  brand: {
    commission_mode: string | null;
    commission_pct_invoice: number | null;
    commission_pct_settlement: number | null;
  } | null,
  factory: {
    commission_mode: string;
    commission_pct_invoice: number;
    commission_pct_settlement: number;
  } | null,
): { mode: string; pctInvoice: number; pctSettlement: number; source: "Marca" | "Fábrica" } {
  if (brand?.commission_mode) {
    return {
      mode: brand.commission_mode,
      pctInvoice: brand.commission_pct_invoice ?? 0,
      pctSettlement: brand.commission_pct_settlement ?? 0,
      source: "Marca",
    };
  }
  return {
    mode: factory?.commission_mode ?? "Faturamento",
    pctInvoice: factory?.commission_pct_invoice ?? 0,
    pctSettlement: factory?.commission_pct_settlement ?? 0,
    source: "Fábrica",
  };
}
