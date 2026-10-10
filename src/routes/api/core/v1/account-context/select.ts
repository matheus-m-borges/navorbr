import { createFileRoute } from "@tanstack/react-router";
import { validateServiceToken } from "@/core/contracts/service-auth.server";
import { validateUserBearer } from "@/core/contracts/user-auth.server";
import { selectCoreAccountContext } from "@/core/contracts/access-context-service.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "@/core/contracts/types";

export const Route = createFileRoute("/api/core/v1/account-context/select")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const srvCheck = validateServiceToken(request);
        if (!srvCheck.valid) return srvCheck.response;

        const usrCheck = await validateUserBearer(request);
        if (!usrCheck.valid) return usrCheck.response;

        try {
          const body = await request.json().catch(() => ({}));
          const accountId = body.accountId;
          const product = body.product || "lawhub";

          if (!accountId) {
            const errResp: CoreErrorResponse = {
              contractVersion: CORE_CONTRACT_VERSION,
              ok: false,
              error: "VALIDATION_ERROR",
              message: "accountId é obrigatório.",
            };
            return Response.json(errResp, { status: 400 });
          }

          const result = await selectCoreAccountContext({
            userId: usrCheck.user.id,
            userBearerToken: usrCheck.token,
            accountId,
            product,
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
