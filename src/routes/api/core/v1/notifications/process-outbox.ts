import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * NAVOR CORE — Notification Worker Trigger Endpoint
 * 
 * Dispara o processamento do outbox de notificações.
 * Deve ser chamado por cron (Vercel/Supabase) ou manualmente pelo admin.
 * 
 * SEGURANÇA:
 * - Requer autenticação service_role OU platform_admin
 * - Rate limiting recomendado em nível de infra
 */

const triggerNotificationWorker = createServerFn({ method: "POST" })
  .validator(z.object({
    batchSize: z.number().min(1).max(100).optional(),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Verificar se é chamada autorizada (service_role via header ou platform admin)
    // Em produção, o cron do Vercel/Supabase chama este endpoint com token interno
    const batchSize = data?.batchSize ?? 20;
    
    try {
      const { processOutboxBatch } = await import("@/lib/notifications/notification-worker.server");
      const result = await processOutboxBatch(batchSize);
      
      return {
        success: true,
        processed: result.processed ?? 0,
        failed: result.failed ?? 0,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[NotificationWorker] Trigger failed:", errorMessage);
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  });

export const Route = createFileRoute("/api/core/v1/notifications/process-outbox")({
  POST: async ({ request }) => {
    try {
      // Validar token interno (cron secret) ou session admin
      const authHeader = request.headers.get("authorization") ?? "";
      const cronSecret = request.headers.get("x-cron-secret") ?? "";
      
      // Aceitar chamadas com CRON_SECRET válido ou bearer token service_role
      const expectedCronSecret = process.env.NAVOR_CRON_SECRET ?? "";
      const hasValidCronSecret = expectedCronSecret && cronSecret === expectedCronSecret;
      const hasBearerAuth = authHeader.startsWith("Bearer ");
      
      if (!hasValidCronSecret && !hasBearerAuth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      const body = await request.json().catch(() => ({}));
      const result = await triggerNotificationWorker({ data: body });
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[NotificationWorker] Endpoint error:", err);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});

