/**
 * NAVOR SaaS — Endpoint de Cron para Reconciliação de Assinaturas
 *
 * SEGURANÇA:
 * - Aceita apenas método POST.
 * - Valida `Authorization: Bearer <CRON_SECRET>` usando comparação segura (timingSafeEqual).
 * - Rejeita toda requisição sem header ou com segredo inválido.
 * - CRON_SECRET nunca deve estar em variável VITE_* ou exposta ao browser.
 * - Não executa se CRON_SECRET estiver ausente no ambiente (mínimo 32 chars).
 * - Resposta nunca inclui detalhes internos — apenas contadores sanitizados.
 * - Auditoria técnica registrada no servidor (não exposta ao chamador).
 *
 * USO:
 * POST /api/navor/cron-reconciliation
 * Authorization: Bearer <NAVOR_CRON_SECRET>
 *
 * CONFIGURAÇÃO:
 * Adicionar ao .env (servidor apenas — nunca VITE_*):
 *   NAVOR_CRON_SECRET=<segredo-aleatório-de-pelo-menos-32-chars>
 */

import { createFileRoute } from "@tanstack/react-router";
import { runReconciliationForCron } from "@/api/subscription-reconciliation";
import * as crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// COMPARAÇÃO SEGURA (previne timing attacks)
// ─────────────────────────────────────────────────────────────────────────────

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Executa a comparação dummy para não vazar o tamanho via timing
    try { crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a)); } catch { /* noop */ }
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER HTTP
// ─────────────────────────────────────────────────────────────────────────────

async function handleCronPost(request: Request): Promise<Response> {
  const startedAt = Date.now();

  // 1. VERIFICAR SE CRON_SECRET ESTÁ CONFIGURADO
  const cronSecret = process.env["NAVOR_CRON_SECRET"];
  if (!cronSecret || cronSecret.length < 32) {
    console.error("[CronReconciliation] NAVOR_CRON_SECRET não configurado ou fraco. Cron bloqueado.");
    return new Response(JSON.stringify({ error: "Service unavailable." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. VALIDAR AUTHORIZATION HEADER
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!bearerToken || !timingSafeCompare(bearerToken, cronSecret)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    console.warn(`[CronReconciliation] Tentativa com token inválido. IP=${ip}`);
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. EXECUTAR RECONCILIAÇÃO
  try {
    console.info("[CronReconciliation] Iniciando reconciliação via cron...");
    const result = await runReconciliationForCron();
    const elapsed = Date.now() - startedAt;

    console.info(
      `[CronReconciliation] Concluída em ${elapsed}ms — ` +
      `${result.processed} processadas, ${result.transitioned} transições, ${result.errors} erros.`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        processed: result.processed,
        transitioned: result.transitioned,
        errors: result.errors,
        elapsedMs: elapsed,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    console.error(`[CronReconciliation] Erro na execução (${elapsed}ms):`, err);
    return new Response(JSON.stringify({ error: "Internal error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function handleCronGet(): Response {
  return new Response(JSON.stringify({ error: "Method not allowed." }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: "POST" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTA TANSTACK START
// ─────────────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/navor/cron-reconciliation")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        return handleCronPost(request);
      },
      GET: async () => {
        return handleCronGet();
      },
    },
  },
});
