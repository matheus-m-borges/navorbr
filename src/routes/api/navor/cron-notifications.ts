import { createFileRoute } from "@tanstack/react-router";
import * as crypto from "node:crypto";
import { processTimeBasedEvents } from "@/core/notifications/scheduler";
import { processPendingDeliveries } from "@/core/notifications/delivery-service";

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    try { crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a)); } catch { /* noop */ }
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

async function handleCronPost(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const cronSecret = process.env["NAVOR_CRON_SECRET"];
  if (!cronSecret || cronSecret.length < 32) {
    console.error("[CronNotifications] NAVOR_CRON_SECRET não configurado ou fraco.");
    return new Response(JSON.stringify({ error: "Service unavailable." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!bearerToken || !timingSafeCompare(bearerToken, cronSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const schedulerResult = await processTimeBasedEvents();
    const deliveryResult = await processPendingDeliveries(50);
    const elapsed = Date.now() - startedAt;

    console.info(
      `[CronNotifications] Concluído em ${elapsed}ms — events=${schedulerResult.eventsGenerated}, deliveries=${deliveryResult.processed}`
    );

    // FIX P0#3: Return HTTP status coherent with actual scheduler result.
    // 200 = success, 207 = partial, 500 = failed.
    const httpStatus = schedulerResult.status === "success" ? 200 : schedulerResult.status === "partial" ? 207 : 500;
    const body = {
      ok: schedulerResult.status !== "failed",
      scheduler: schedulerResult,
      deliveries: deliveryResult,
      elapsedMs: elapsed,
    };

    if (httpStatus >= 500) {
      console.error(`[CronNotifications] Scheduler failed — returning HTTP ${httpStatus}`, schedulerResult.errors);
    }

    return new Response(JSON.stringify(body), {
      status: httpStatus,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    console.error(`[CronNotifications] Erro (${elapsed}ms):`, err);
    return new Response(JSON.stringify({ error: "Internal error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/navor/cron-notifications")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => handleCronPost(request),
      GET: async ({ request }: { request: Request }) => handleCronPost(request),
    },
  },
});
