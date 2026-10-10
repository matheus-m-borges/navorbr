import { createFileRoute } from "@tanstack/react-router";
import { validateServiceToken } from "@/core/contracts/service-auth.server";
import { validateUserBearer } from "@/core/contracts/user-auth.server";
import { issueLawHubSsoTicket } from "@/core/contracts/sso-service.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "@/core/contracts/types";

export const Route = createFileRoute("/api/core/v1/sso/ticket")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const service = validateServiceToken(request);
        if (!service.valid) return service.response;
        const user = await validateUserBearer(request);
        if (!user.valid) return user.response;
        try {
          const body = await request.json().catch(() => ({}));
          const result = await issueLawHubSsoTicket({
            user: user.user,
            requestedAccountId: typeof body.accountId === "string" ? body.accountId : null,
            returnPath: body.returnPath,
          });
          return Response.json(result, { status: result.ok ? 200 : 403 });
        } catch (error: any) {
          const response: CoreErrorResponse = {
            contractVersion: CORE_CONTRACT_VERSION,
            ok: false,
            error: error?.message === "INVALID_RETURN_URL" ? "INVALID_RETURN_URL" : "INTERNAL_ERROR",
            message: error?.message === "INVALID_RETURN_URL" ? "Return URL is not allowed." : "Unable to create SSO ticket.",
          };
          return Response.json(response, { status: response.error === "INVALID_RETURN_URL" ? 400 : 500 });
        }
      },
    },
  },
});
