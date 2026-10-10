// ============================================================================
// NAVOR CORE CONTRACTS V1 — SERVICE AUTHENTICATION
// Validates X-Navor-Service-Token server-to-server header with constant-time equality
// ============================================================================

import * as crypto from "node:crypto";
import { CORE_CONTRACT_VERSION, type CoreErrorResponse } from "./types";

export function constantTimeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function validateServiceToken(request: Request): { valid: true } | { valid: false; response: Response } {
  const serviceToken = request.headers.get("x-navor-service-token")?.trim();
  const configuredTokens = [
    process.env.NAVOR_CORE_LAWHUB_SERVICE_TOKEN?.trim(),
    process.env.NAVOR_CORE_BARBERHUB_SERVICE_TOKEN?.trim(),
    process.env.NAVOR_S2S_SERVICE_TOKEN?.trim(),
  ].filter((t): t is string => Boolean(t && t.length >= 16));

  if (configuredTokens.length === 0) {
    // If no service token is configured in environment, fail-closed
    const err: CoreErrorResponse = {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "CORE_UNAVAILABLE",
      message: "Service authentication not configured on Core.",
    };
    return { valid: false, response: Response.json(err, { status: 503 }) };
  }

  if (!serviceToken) {
    const err: CoreErrorResponse = {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "INVALID_SERVICE_TOKEN",
      message: "Missing X-Navor-Service-Token header.",
    };
    return { valid: false, response: Response.json(err, { status: 401 }) };
  }

  const matchesAny = configuredTokens.some((expected) => constantTimeCompare(serviceToken, expected));
  if (!matchesAny) {
    const err: CoreErrorResponse = {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "INVALID_SERVICE_TOKEN",
      message: "Invalid X-Navor-Service-Token header.",
    };
    return { valid: false, response: Response.json(err, { status: 401 }) };
  }

  return { valid: true };
}
