import * as crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCoreAccessContext } from "./access-context-service.server";
import { CORE_CONTRACT_VERSION, type CoreUserPayload } from "./types";
import { getConfiguredSsoOrigins, isAllowedSsoOrigin, normalizeLawHubReturnPath, normalizeSsoOrigin } from "./sso-policy";

const TICKET_TTL_SECONDS = 60;

function configuredOrigins(): string[] {
  return getConfiguredSsoOrigins(process.env.NAVOR_LAWHUB_SSO_RETURN_ORIGINS);
}

export function getLawHubSsoTargetOrigin(): string {
  const origin = normalizeSsoOrigin(process.env.NAVOR_LAWHUB_SSO_TARGET_ORIGIN);
  if (!origin || !isAllowedSsoOrigin(origin, configuredOrigins())) {
    throw new Error("SSO_NOT_CONFIGURED");
  }
  return origin;
}

export function assertLawHubReturnPath(value: unknown): string {
  const path = normalizeLawHubReturnPath(value);
  if (!path) throw new Error("INVALID_RETURN_URL");
  return path;
}

function hashTicket(rawTicket: string): string {
  return crypto.createHash("sha256").update(rawTicket, "utf8").digest("hex");
}

export async function issueLawHubSsoTicket(params: {
  user: CoreUserPayload;
  requestedAccountId?: string | null;
  returnPath: string;
}) {
  const targetOrigin = getLawHubSsoTargetOrigin();
  const returnPath = assertLawHubReturnPath(params.returnPath);
  const context = await resolveCoreAccessContext({
    user: params.user,
    product: "lawhub",
    requestedAccountId: params.requestedAccountId ?? null,
  });
  if (!context.ok) return context;

  const rawTicket = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TICKET_TTL_SECONDS * 1000);
  const { error } = await (supabaseAdmin as any).from("lawhub_sso_tickets").insert({
    ticket_hash: hashTicket(rawTicket),
    user_id: context.user.id,
    account_id: context.account.id,
    product: "lawhub",
    return_origin: targetOrigin,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`SSO_TICKET_CREATE_FAILED: ${error.message}`);

  return {
    contractVersion: CORE_CONTRACT_VERSION,
    ok: true as const,
    ticket: rawTicket,
    targetOrigin,
    returnPath,
    expiresAt: expiresAt.toISOString(),
    accountId: context.account.id,
  };
}

export async function consumeLawHubSsoTicket(params: { ticket: string; returnOrigin: string }) {
  const returnOrigin = normalizeSsoOrigin(params.returnOrigin);
  if (!returnOrigin || !isAllowedSsoOrigin(returnOrigin, configuredOrigins())) {
    return { ok: false as const, error: "INVALID_RETURN_URL" };
  }
  if (!/^[A-Za-z0-9_-]{40,}$/.test(params.ticket)) {
    return { ok: false as const, error: "INVALID_SSO_TICKET" };
  }

  const now = new Date().toISOString();
  const { data: ticket, error } = await (supabaseAdmin as any)
    .from("lawhub_sso_tickets")
    .update({ consumed_at: now })
    .eq("ticket_hash", hashTicket(params.ticket))
    .eq("product", "lawhub")
    .eq("return_origin", returnOrigin)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("user_id,account_id,product,return_origin")
    .maybeSingle();

  if (error) throw new Error(`SSO_TICKET_CONSUME_FAILED: ${error.message}`);
  if (!ticket?.user_id) return { ok: false as const, error: "INVALID_SSO_TICKET" };

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(ticket.user_id);
  if (authError || !authData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const context = await resolveCoreAccessContext({
    user: {
      id: authData.user.id,
      email: authData.user.email ?? null,
      name: (authData.user.user_metadata as any)?.full_name ?? authData.user.email?.split("@")[0] ?? "Usuário",
    },
    product: "lawhub",
    requestedAccountId: ticket.account_id,
  });
  if (!context.ok) return context;

  return { ...context, ssoUserId: authData.user.id, accountId: ticket.account_id };
}
