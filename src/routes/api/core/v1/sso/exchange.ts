import { createFileRoute } from "@tanstack/react-router";
import { validateServiceToken } from "@/core/contracts/service-auth.server";
import { consumeLawHubSsoTicket } from "@/core/contracts/sso-service.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "@/core/contracts/types";

export const Route = createFileRoute("/api/core/v1/sso/exchange")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const service = validateServiceToken(request);
        if (!service.valid) return service.response;
        try {
          const body = await request.json().catch(() => ({}));
          const result = await consumeLawHubSsoTicket({
            ticket: typeof body.ticket === "string" ? body.ticket : "",
            returnOrigin: typeof body.returnOrigin === "string" ? body.returnOrigin : "",
          });
          if (!result.ok) {
            const response: CoreErrorResponse = {
              contractVersion: CORE_CONTRACT_VERSION,
              ok: false,
              error: result.error as any,
              message: "SSO ticket is invalid, expired, consumed, or unauthorized.",
            };
            return Response.json(response, { status: 401 });
          }
          return Response.json(result, { status: 200 });
        } catch {
          return Response.json(
            { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "INTERNAL_ERROR", message: "Unable to exchange SSO ticket." },
            { status: 500 },
          );
        }
      },
    },
  },
});
