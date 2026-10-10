// ============================================================================
// NAVOR CORE CONTRACTS V1 — USER AUTHENTICATION
// Validates Bearer token against Supabase Auth without trusting client-sent identity
// ============================================================================

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse, type CoreUserPayload } from "./types";

export async function validateUserBearer(
  request: Request,
): Promise<{ valid: true; user: CoreUserPayload; token: string } | { valid: false; response: Response }> {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err: CoreErrorResponse = {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "UNAUTHENTICATED",
      message: "Authorization Bearer token is required.",
    };
    return { valid: false, response: Response.json(err, { status: 401 }) };
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.split(".").length !== 3) {
    const err: CoreErrorResponse = {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "UNAUTHENTICATED",
      message: "Malformed Bearer token.",
    };
    return { valid: false, response: Response.json(err, { status: 401 }) };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      const err: CoreErrorResponse = {
        contractVersion: CORE_CONTRACT_VERSION,
        ok: false,
        error: "UNAUTHENTICATED",
        message: "Invalid or expired session token.",
      };
      return { valid: false, response: Response.json(err, { status: 401 }) };
    }

    return {
      valid: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        name: (data.user.user_metadata as any)?.full_name ?? data.user.email?.split("@")[0] ?? "Usuário",
      },
      token,
    };
  } catch (cause) {
    const err: CoreErrorResponse = {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "CORE_UNAVAILABLE",
      message: cause instanceof Error ? cause.message : "Authentication service failure.",
    };
    return { valid: false, response: Response.json(err, { status: 503 }) };
  }
}
