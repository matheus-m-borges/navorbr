import { createFileRoute } from "@tanstack/react-router";
import { validateServiceToken } from "@/core/contracts/service-auth.server";
import { validateUserBearer } from "@/core/contracts/user-auth.server";
import { recordCoreAiUsage } from "@/core/contracts/ai-usage-service.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "@/core/contracts/types";

export const Route = createFileRoute("/api/core/v1/usage/ai")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const srvCheck = validateServiceToken(request);
        if (!srvCheck.valid) return srvCheck.response;
        const usrCheck = await validateUserBearer(request);
        if (!usrCheck.valid) return usrCheck.response;

        try {
          const body = await request.json().catch(() => ({}));
          const {
            accountId,
            product = "lawhub",
            provider = "openai",
            model = "não informado",
            operation,
            promptTokens = 0,
            completionTokens = 0,
            idempotencyKey,
          } = body;

          if (!accountId || !operation) {
            const errResp: CoreErrorResponse = {
              contractVersion: CORE_CONTRACT_VERSION,
              ok: false,
              error: "VALIDATION_ERROR",
              message: "accountId e operation são obrigatórios.",
            };
            return Response.json(errResp, { status: 400 });
          }

          const result = await recordCoreAiUsage({
            input: {
              accountId,
              product,
              provider,
              model,
              operation,
              promptTokens,
              completionTokens,
              idempotencyKey,
              userId: usrCheck.user.id,
            },
            callerUserId: usrCheck.user.id,
          });

          return Response.json(result, { status: result.ok ? 200 : 400 });
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
