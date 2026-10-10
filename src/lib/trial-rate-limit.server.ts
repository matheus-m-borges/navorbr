/**
 * NAVOR SaaS — Rate Limit de Teste Gratuito (servidor)
 *
 * Implementa proteção contra abuso na jornada de trial.
 * Persistência via tabela `trial_rate_limit` no Supabase.
 *
 * REGRAS:
 * - Máximo 3 tentativas por IP por hora
 * - Máximo 1 teste por e-mail por produto (lifetime)
 * - Máximo 1 teste por CPF/CNPJ por produto (lifetime)
 * - Máximo 1 teste ativo por empresa (document) no produto
 *
 * SEGURANÇA:
 * - Respostas sempre genéricas — nunca revela se e-mail/CPF/CNPJ já existe
 * - IP nunca é armazenado em texto claro (HMAC-SHA-256)
 * - E-mail e CPF/CNPJ são normalizados antes de checar
 * - Tentativas suspeitas são registradas em auditoria sanitizada
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import * as crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitCheckInput {
  ip: string;
  email: string;
  cpfCnpj: string;
  productId: string;
  productSlug: string;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Mensagem genérica para o usuário — nunca revela a causa real */
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZAÇÃO (idempotente)
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeCpfCnpj(doc: string): string {
  return doc.replace(/\D/g, "");
}

export function normalizePhone(phone: string): string {
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, "");
  // Adiciona +55 se for número BR sem código de país
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.length >= 12 && digits.startsWith("55")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function sanitizeName(value: string): string {
  return value
    .trim()
    .replace(/<[^>]*>/g, "") // remove tags HTML
    .replace(/['"`;\\]/g, "") // remove chars perigosos
    .slice(0, 200);
}

function hashSensitiveValue(value: string): string {
  // Chave configurável própria; enquanto ela não existir, usa a chave de serviço
  // apenas como fallback de servidor, com separação de domínio. Nunca há salt
  // público/previsível no código ou no navegador.
  const key = process.env["NAVOR_RATE_LIMIT_HMAC_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) {
    throw new Error("NAVOR_RATE_LIMIT_HMAC_KEY ou SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return crypto
    .createHmac("sha256", key)
    .update(`navor:trial-rate-limit:v1:${value}`)
    .digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKS DE RATE LIMIT
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_BLOCK_MESSAGE = "Não foi possível completar o cadastro. Tente novamente mais tarde ou entre em contato com a NAVOR.";

/**
 * Verifica todos os limites de rate limit para uma tentativa de trial.
 * Retorna allowed=false com mensagem genérica se qualquer limite for atingido.
 */
export async function checkTrialRateLimit(
  input: RateLimitCheckInput,
): Promise<RateLimitResult> {
  const emailNorm = normalizeEmail(input.email);
  const cpfCnpjNorm = normalizeCpfCnpj(input.cpfCnpj);
  const ipHash = hashSensitiveValue(input.ip);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // 1. LIMITE POR IP: máximo 3 tentativas por hora
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: ipCount, error: ipErr } = await (supabaseAdmin as any)
    .from("trial_rate_limit")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("attempted_at", oneHourAgo);

  if (ipErr) {
    console.error("[RateLimit] Erro ao verificar IP:", ipErr.message);
    // Em caso de erro de DB, permite o acesso (fail-open controlado)
    // mas loga para monitoramento
  } else if ((ipCount ?? 0) >= 3) {
    console.warn(`[RateLimit] IP bloqueado: hash=${ipHash.slice(0, 8)}... — ${ipCount} tentativas na última hora`);
    return { allowed: false, message: GENERIC_BLOCK_MESSAGE };
  }

  // 2. LIMITE POR E-MAIL + PRODUTO: máximo 1 trial lifetime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: emailCount, error: emailErr } = await (supabaseAdmin as any)
    .from("trial_rate_limit")
    .select("id", { count: "exact", head: true })
    .eq("email_hash", hashSensitiveValue(emailNorm))
    .eq("product_id", input.productId)
    .eq("outcome", "provisioned");

  if (!emailErr && (emailCount ?? 0) >= 1) {
    console.warn(`[RateLimit] E-mail já teve trial no produto ${input.productSlug}`);
    // Mensagem neutra — não confirma se e-mail existe
    return { allowed: false, message: GENERIC_BLOCK_MESSAGE };
  }

  // 3. LIMITE POR CPF/CNPJ + PRODUTO: máximo 1 trial lifetime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: docCount, error: docErr } = await (supabaseAdmin as any)
    .from("trial_rate_limit")
    .select("id", { count: "exact", head: true })
    .eq("document_hash", hashSensitiveValue(cpfCnpjNorm))
    .eq("product_id", input.productId)
    .eq("outcome", "provisioned");

  if (!docErr && (docCount ?? 0) >= 1) {
    console.warn(`[RateLimit] CPF/CNPJ já teve trial no produto ${input.productSlug}`);
    return { allowed: false, message: GENERIC_BLOCK_MESSAGE };
  }

  return { allowed: true };
}

/**
 * Registra uma tentativa de trial (seja bloqueada ou bem-sucedida).
 * Nunca armazena e-mail, CPF/CNPJ ou IP em texto claro.
 */
export async function recordTrialAttempt(
  input: RateLimitCheckInput & {
    outcome: "provisioned" | "blocked" | "duplicate" | "error";
    accountId?: string;
  },
): Promise<void> {
  const emailNorm = normalizeEmail(input.email);
  const cpfCnpjNorm = normalizeCpfCnpj(input.cpfCnpj);

  try {
    await (supabaseAdmin as any).from("trial_rate_limit").insert({
      ip_hash: hashSensitiveValue(input.ip),
      email_hash: hashSensitiveValue(emailNorm),
      document_hash: hashSensitiveValue(cpfCnpjNorm),
      product_id: input.productId,
      outcome: input.outcome,
      account_id: input.accountId ?? null,
      attempted_at: new Date().toISOString(),
    });
  } catch (err) {
    // Não falha o fluxo principal — log de auditoria é best-effort
    console.error("[RateLimit] Falha ao registrar tentativa:", err);
  }
}
