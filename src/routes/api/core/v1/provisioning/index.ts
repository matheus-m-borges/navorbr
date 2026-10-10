/**
 * NAVOR Core — Provisioning API Endpoint
 *
 * Endpoint S2S para disparar provisionamento de contas.
 * Autenticado via service token (não JWT de usuário).
 *
 * NOTA DE BUILD: Usamos createServerFn com dynamic imports porque o plugin
 * import-protection do TanStack Start bloqueia qualquer import estático de
 * *.server.* em arquivos de rota, mesmo para endpoints de API server-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const provisionAccountFn = createServerFn({ method: "POST" })
  .validator(z.object({
    accountId: z.string(),
    subscriptionId: z.string(),
    productSlug: z.string(),
    planId: z.string(),
    adminUserId: z.string(),
    adminEmail: z.string(),
    companyName: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }))
  .handler(async ({ data }) => {
    const { provisionAccount } = await import("@/lib/provisioning/provisioning-service");
    return provisionAccount({
      accountId: data.accountId,
      subscriptionId: data.subscriptionId,
      productSlug: data.productSlug as any,
      planId: data.planId,
      adminUserId: data.adminUserId,
      adminEmail: data.adminEmail,
      companyName: data.companyName,
      metadata: data.metadata,
    });
  });

export const Route = createFileRoute("/api/core/v1/provisioning/")({
  POST: async ({ request }) => {
    try {
      // Validar service token
      const authHeader = request.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      const expectedToken = process.env["NAVOR_S2S_SERVICE_TOKEN"];
      if (!expectedToken || token !== expectedToken) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: invalid service token" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const body = await request.json();

      if (
        !body.accountId ||
        !body.subscriptionId ||
        !body.productSlug ||
        !body.planId ||
        !body.adminUserId ||
        !body.adminEmail ||
        !body.companyName
      ) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: accountId, subscriptionId, productSlug, planId, adminUserId, adminEmail, companyName",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await provisionAccountFn({ data: body });

      const statusCode = result.success ? 200 : 502;
      return new Response(JSON.stringify(result), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[ProvisioningAPI] Erro inesperado:", err);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
});
