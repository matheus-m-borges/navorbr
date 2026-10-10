import { createFileRoute } from "@tanstack/react-router";
import { validateServiceToken } from "@/core/contracts/service-auth.server";
import { validateUserBearer } from "@/core/contracts/user-auth.server";
import { writeCoreIntegrationSecret } from "@/core/contracts/secret-vault-service.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "@/core/contracts/types";

export const Route = createFileRoute("/api/core/v1/integrations/secret/write")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const srvCheck = validateServiceToken(request);
        if (!srvCheck.valid) return srvCheck.response;

        const usrCheck = await validateUserBearer(request);
        if (!usrCheck.valid) return usrCheck.response;

        try {
          const body = await request.json().catch(() => ({}));
          const { accountId, product = "lawhub", integration, value, status, verifiedAt } = body;

          if (!accountId || !integration || !value) {
            const errResp: CoreErrorResponse = {
              contractVersion: CORE_CONTRACT_VERSION,
              ok: false,
              error: "VALIDATION_ERROR",
              message: "accountId, integration e value são obrigatórios.",
            };
            return Response.json(errResp, { status: 400 });
          }

          const result = await writeCoreIntegrationSecret({
            callerUserId: usrCheck.user.id,
            accountId,
            product,
            integration,
            value,
            status,
            verifiedAt,
          });

          return Response.json(result, { status: result.ok ? 200 : 403 });
        } catch (err: any) {
          const errorResp: CoreErrorResponse = {
            contractVersion: CORE_CONTRACT_VERSION,
            ok: false,
            error: "INTERNAL_ERROR",
            message: err?.message || "Internal server error.",
          };
          return Response.json(errorResp, { status: 500 });
        }
      },
    },
  },
});
