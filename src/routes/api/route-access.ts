import { createFileRoute } from "@tanstack/react-router";
import { validateServiceToken } from "@/core/contracts/service-auth.server";
import { validateUserBearer } from "@/core/contracts/user-auth.server";
import { resolveCoreAccessContext } from "@/core/contracts/access-context-service.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "@/core/contracts/types";

export const Route = createFileRoute("/api/route-access")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // 1. Service authentication (X-Navor-Service-Token)
        const srvCheck = validateServiceToken(request);
        if (!srvCheck.valid) return srvCheck.response;

        // 2. User authentication (Authorization: Bearer)
        const usrCheck = await validateUserBearer(request);
        if (!usrCheck.valid) return usrCheck.response;

        try {
          const body = await request.json().catch(() => ({}));
          const product = body.product || "barberhub";
          const accountId = body.accountId || null;

          const result = await resolveCoreAccessContext({
            user: usrCheck.user,
            product,
            requestedAccountId: accountId,
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
