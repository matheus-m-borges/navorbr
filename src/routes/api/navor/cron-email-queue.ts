import { createFileRoute } from "@tanstack/react-router";
import { processEmailQueue } from "@/lib/email/email-queue.server";
import * as crypto from "node:crypto";

function validSecret(token: string, expected: string): boolean {
  if (!token || token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

async function handlePost(request: Request): Promise<Response> {
  const secret = process.env["NAVOR_CRON_SECRET"] ?? process.env["CRON_SECRET"];
  if (!secret || secret.length < 32) return Response.json({ error: "Service unavailable." }, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!validSecret(token, secret)) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const result = await processEmailQueue();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[CronEmailQueue] Falha ao processar fila:", error);
    return Response.json({ error: "Internal error." }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/navor/cron-email-queue")({
  server: { handlers: {
    POST: async ({ request }: { request: Request }) => handlePost(request),
    // Vercel Cron invoca endpoints por GET e envia CRON_SECRET no Authorization.
    GET: async ({ request }: { request: Request }) => handlePost(request),
  } },
});
