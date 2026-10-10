export const LEAD_STATUSES = [
  "Novo Lead",
  "Primeiro contato pendente",
  "Contato realizado",
  "Catálogo a enviar",
  "Catálogo enviado",
  "Aguardando retorno",
  "Em negociação",
  "Positivado",
  "Não quis",
  "Sem retorno",
  "Perdido",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const FUNNEL_STAGES: LeadStatus[] = [
  "Novo Lead",
  "Contato realizado",
  "Catálogo enviado",
  "Aguardando retorno",
  "Em negociação",
  "Positivado",
];

export const LOST_STATUSES: LeadStatus[] = ["Não quis", "Sem retorno", "Perdido"];

export const CLIENT_STATUSES = [
  "Prospect",
  "Lead",
  "Em negociação",
  "Cliente ativo",
  "Cliente inativo",
  "Cliente perdido",
] as const;

/** Nomes antigos de situação de cliente que ainda existem em registros salvos. */
const LEGACY_CLIENT_STATUS: Record<string, (typeof CLIENT_STATUSES)[number]> = {
  Ativo: "Cliente ativo",
  Inativo: "Cliente inativo",
  Perdido: "Cliente perdido",
  Negociação: "Em negociação",
  Negociacao: "Em negociação",
};

/** Converte qualquer situação gravada para a situação oficial correspondente. */
export function normalizeClientStatus(status?: string | null): string {
  const value = (status ?? "").trim();
  if (!value) return "Prospect";
  return LEGACY_CLIENT_STATUS[value] ?? value;
}

export const CONTACT_TYPES = [
  "WhatsApp",
  "Ligação",
  "SMS",
  "E-mail",
  "Instagram",
  "Visita",
  "Reunião",
  "Outro",
] as const;

export const CATALOG_CHANNELS = ["WhatsApp", "E-mail", "Link", "Presencial", "Outro"] as const;

export const POSITIVADO_OPTIONS = ["Sim", "Não", "Em negociação", "Aguardando pedido"] as const;

export const TASK_PRIORITIES = ["Baixa", "Normal", "Alta", "Urgente"] as const;

export const TASK_TYPES = [
  "Primeiro contato",
  "Follow-up",
  "Envio de catálogo",
  "Ligação",
  "Visita",
  "Reunião",
  "Proposta",
  "Outro",
] as const;

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export const statusTone: Record<string, "brand" | "cyan" | "violet" | "amber" | "rose" | "muted"> = {
  "Novo Lead": "cyan",
  "Primeiro contato pendente": "cyan",
  "Contato realizado": "violet",
  "Catálogo a enviar": "amber",
  "Catálogo enviado": "violet",
  "Aguardando retorno": "amber",
  "Em negociação": "brand",
  Positivado: "brand",
  "Não quis": "rose",
  "Sem retorno": "rose",
  Perdido: "muted",
};

export const toneClasses: Record<string, string> = {
  brand: "bg-brand/15 text-brand border-brand/25",
  cyan: "bg-cyan/15 text-cyan border-cyan/25",
  violet: "bg-violet/15 text-violet border-violet/25",
  amber: "bg-amber/15 text-amber border-amber/25",
  rose: "bg-rose/15 text-rose border-rose/25",
  muted: "bg-muted text-muted-foreground border-border",
};

export function currency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean);
  if (match && !clean.includes("T")) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Monta o link oficial do WhatsApp (wa.me) com mensagem pré-preenchida. */
export function whatsappLink(phone: string | null | undefined, message: string): string {
  let digits = onlyDigits(phone);
  if (!digits) return "";
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function smsLink(phone: string | null | undefined, message: string): string {
  const digits = onlyDigits(phone);
  if (!digits) return "";
  return `sms:${digits}?&body=${encodeURIComponent(message)}`;
}

export function fillTemplate(
  template: string,
  vars: { NOME?: string | null; MARCA?: string | null; EMPRESA?: string | null },
): string {
  return template
    .replace(/\{NOME\}/g, vars.NOME ?? "")
    .replace(/\{MARCA\}/g, vars.MARCA ?? "sua coleção")
    .replace(/\{EMPRESA\}/g, vars.EMPRESA ?? "");
}

export const DEFAULT_WHATSAPP_TEMPLATE =
  "Olá, {NOME}. Tudo bem?\n\nEstou entrando em contato para saber se conseguiu analisar o catálogo da {MARCA}.\n\nFico à disposição para apresentar melhor a coleção e as condições comerciais.\n\nAbraço!";

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "US";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
