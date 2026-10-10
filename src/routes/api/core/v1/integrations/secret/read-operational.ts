import { createFileRoute } from "@tanstack/react-router";
import { validateServiceToken } from "@/core/contracts/service-auth.server";
import { readCoreOperationalIntegrationSecret } from "@/core/contracts/secret-vault-service.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "@/core/contracts/types";

export const Route = createFileRoute("/api/core/v1/integrations/secret/read-operational")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const service = validateServiceToken(request);
        if (!service.valid) return service.response;
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
          const error: CoreErrorResponse = { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "VALIDATION_ERROR", message: "Payload operacional inválido." };
          return Response.json(error, { status: 400 });
        }
        const result = await readCoreOperationalIntegrationSecret({
          service: body.service,
          purpose: body.purpose,
          integration: body.integration,
          issuedAt: body.issuedAt,
          phoneNumberId: body.resource?.phoneNumberId,
        });
        return Response.json(result, { status: result.ok ? 200 : result.error === "CORE_UNAVAILABLE" ? 503 : 403 });
      },
    },
  },
});
