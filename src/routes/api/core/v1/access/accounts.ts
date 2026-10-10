import { createFileRoute } from "@tanstack/react-router";
import { validateServiceToken } from "@/core/contracts/service-auth.server";
import { validateUserBearer } from "@/core/contracts/user-auth.server";
import { listCoreAccountsForProduct } from "@/core/contracts/access-context-service.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "@/core/contracts/types";

async function handleAccounts(request: Request): Promise<Response> {
  const srvCheck = validateServiceToken(request);
  if (!srvCheck.valid) return srvCheck.response;

  const usrCheck = await validateUserBearer(request);
  if (!usrCheck.valid) return usrCheck.response;

  try {
    const url = new URL(request.url);
    const productParam = url.searchParams.get("product") as any;
    let bodyProduct: any = null;
    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      bodyProduct = body.product;
    }
    const product = bodyProduct || productParam || "lawhub";

    const result = await listCoreAccountsForProduct({
      userId: usrCheck.user.id,
      product,
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
}

export const Route = createFileRoute("/api/core/v1/access/accounts")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleAccounts(request),
      POST: async ({ request }: { request: Request }) => handleAccounts(request),
    },
  },
});
