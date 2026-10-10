// ============================================================================
// NAVOR CORE CONTRACTS V1 — INVITATIONS SERVICE
// Authoritative creation and management of first-access onboarding invites
// ============================================================================

import * as crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireTenantAdmin } from "@/core/security/authorization.server";
import { checkCoreModuleAccess } from "./access-context-service.server";
import { createNotificationEvent } from "@/core/notifications/event-store";
import {
  CORE_CONTRACT_VERSION,
  type CoreInvitationRequest,
  type CoreInvitationResponse,
} from "./types";

const ALLOWED_LAWHUB_ROLES = new Set([
  "colaborador",
  "advogado_associado",
  "advogado_senior",
  "administrador",
  "advogado_supervisionado",
  "advogado_autonomia",
  "coordenador",
  "atendente_callcenter",
]);

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRole(value?: string): string {
  const role = value?.trim() || "atendente_callcenter";
  if (!ALLOWED_LAWHUB_ROLES.has(role)) throw new Error("Cargo do colaborador inválido.");
  return role;
}

function generateSecureToken(): string {
  const bytes = crypto.randomBytes(32);
  return `fa_${bytes.toString("hex")}`;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createCoreInvitation(params: {
  callerUserId: string;
  input: CoreInvitationRequest;
}): Promise<CoreInvitationResponse> {
  const { callerUserId, input } = params;

  if (input.product !== "lawhub") {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "PRODUCT_DISABLED", message: "Produto não suportado neste contrato." };
  }

  const email = normalizeEmail(input.email || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "VALIDATION_ERROR",
      message: "E-mail de colaborador inválido.",
    };
  }

  // Validar se o chamador é administrador ou dono do escritório
  try {
    await requireTenantAdmin(callerUserId, input.accountId);
  } catch (err: any) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "ACCESS_DENIED",
      message: `Apenas administradores do escritório podem emitir convites: ${err?.message || ""}`,
    };
  }

  const accountScope = await checkCoreModuleAccess({ accountId: input.accountId, product: "lawhub", module: "core" });
  if (!accountScope.ok) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: accountScope.error, message: accountScope.message };
  }

  let role: string;
  try {
    role = normalizeRole(input.role);
  } catch (err: any) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "VALIDATION_ERROR",
      message: err.message,
    };
  }

  // Carregar conta do Core
  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select("name")
    .eq("id", input.accountId)
    .single();

  if (accountError || !account) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Escritório não encontrado no Core.",
    };
  }

  const officeName = account.name || input.officeName || "Escritório";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  // Revogar convites pendentes anteriores para este e-mail nesta conta
  const { error: revokeError } = await supabaseAdmin
    .from("first_access_invites")
    .update({ revoked_at: now.toISOString() })
    .eq("account_id", input.accountId)
    .eq("user_email", email)
    .is("used_at", null)
    .is("revoked_at", null);
  if (revokeError) {
    return { contractVersion: CORE_CONTRACT_VERSION, ok: false, error: "INTERNAL_ERROR", message: `Não foi possível revogar convite anterior: ${revokeError.message}` };
  }

  // Inserir novo convite no banco canônico
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("first_access_invites")
    .insert({
      token_hash: tokenHash,
      account_id: input.accountId,
      user_email: email,
      user_name: input.userName?.trim() || "Colaborador(a)",
      user_role: role,
      office_name: officeName,
      created_by: callerUserId,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return {
      contractVersion: CORE_CONTRACT_VERSION,
      ok: false,
      error: "INTERNAL_ERROR",
      message: `Não foi possível gerar convite no Core: ${insertError?.message || "erro desconhecido"}`,
    };
  }

  // Emitir evento de notificação para convite criado (sem expor token)
  try {
    await createNotificationEvent({
      eventType: "INVITE_CREATED",
      accountId: input.accountId,
      userId: callerUserId,
      source: "invitations_service",
      sourceId: inserted.id,
      payload: {
        invite_id: inserted.id,
        user_email: email,
        user_role: role,
        expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error("[Invitations] Failed to emit INVITE_CREATED:", err);
  }

  const baseUrl = process.env.NAVOR_CORE_PUBLIC_URL || "https://www.navorbr.com";
  const inviteUrl = `${baseUrl.replace(/\/$/, "")}/primeiro-acesso?token=${rawToken}`;

  return {
    contractVersion: CORE_CONTRACT_VERSION,
    ok: true,
    inviteUrl,
    expiresAt,
    userEmail: email,
    userRole: role,
    officeId: input.accountId,
    officeName,
  };
}