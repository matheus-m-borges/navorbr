/**
 * NAVOR SaaS — Webhook Endpoint (Billing)
 * 
 * SEGURANÇA: Validação de assinatura obrigatória (fail-closed).
 * IDEMPOTÊNCIA: Processamento seguro com suporte a concorrência, retries e reconciliação.
 * 
 * NOTA DE BUILD: Usamos createServerFn com dynamic import para que o plugin
 * import-protection do TanStack Start isole completamente o backend da compilação do cliente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const processWebhookFn = createServerFn({ method: "POST" })
  .validator(z.object({ rawBody: z.string(), signature: z.string() }))
  .handler(async ({ data }) => {
    const { processBillingWebhookCore } = await import("@/lib/billing/billing-webhook-service");
    return processBillingWebhookCore(data);
  });

export const Route = createFileRoute("/api/core/v1/billing/webhook")({
  POST: async ({ request }) => {
    try {
      const rawBody = await request.text();
      const signature =
        request.headers.get("asaas-access-token") ??
        request.headers.get("x-simulator-signature") ??
        request.headers.get("x-webhook-signature") ??
        "";

      if (!signature) {
        console.warn("[BillingWebhook] Requisição sem assinatura recebida.");
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await processWebhookFn({ data: { rawBody, signature } });

      if (result.error === "Invalid signature") {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[BillingWebhook] Unexpected error:", err);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
