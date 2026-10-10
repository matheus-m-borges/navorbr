import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export interface ServerFirstAccessToken {
  token: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  officeId: string;
  officeName: string;
  status: "pendente" | "utilizado" | "expirado";
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
  createdBy?: string;
}

type InviteRow = {
  id: string;
  account_id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  office_name: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRole(value?: string): string {
  const role = value?.trim() || "atendente_callcenter";
  if (!ALLOWED_LAWHUB_ROLES.has(role)) throw new Error("Cargo do colaborador inválido.");
  return role;
}

function generateSecureToken(): string {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Gerador criptográfico indisponível.");
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `fa_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function hashToken(token: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Serviço criptográfico indisponível.");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function statusFor(row: InviteRow): ServerFirstAccessToken["status"] {
  if (row.used_at) return "utilizado";
  if (row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return "expirado";
  return "pendente";
}

function publicTokenData(row: InviteRow): ServerFirstAccessToken {
  return {
    token: "",
    userId: "",
    userEmail: row.user_email,
    userName: row.user_name,
    userRole: row.user_role,
    officeId: row.account_id,
    officeName: row.office_name,
    status: statusFor(row),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdBy: row.created_by,
  };
}

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => normalizeEmail(user.email || "") === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  throw new Error("Limite de busca de usuários excedido.");
}

export const serverValidateFirstAccessToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const rawToken = data.token?.trim();
    if (!rawToken) return { valid: false, error: "Token de acesso não informado." };

    const { data: row, error } = await supabaseAdmin
      .from("first_access_invites")
      .select("*")
      .eq("token_hash", await hashToken(rawToken))
      .maybeSingle();

    if (error) throw new Error(`Não foi possível validar o convite: ${error.message}`);
    if (!row || row.revoked_at) {
      return { valid: false, error: "Link de primeiro acesso inválido ou revogado." };
    }

    const invite = row as InviteRow;
    if (invite.used_at) {
      return { valid: false, error: "Este link de primeiro acesso já foi utilizado." };
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return { valid: false, error: "Este link de primeiro acesso expirou. Solicite um novo convite." };
    }

    return { valid: true, tokenData: publicTokenData(invite) };
  });

export const serverCreateFirstAccessInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    userEmail: string;
    userName?: string;
    userRole?: string;
    officeId?: string;
    officeName?: string;
  }) => data)
  .handler(async ({ data, context }) => {
    const email = normalizeEmail(data.userEmail || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("E-mail de colaborador inválido.");
    }

    const { requireTenantAdmin } = await import("@/lib/security/authorization.server");
    const { accountId } = await requireTenantAdmin(context.userId, data.officeId);
    const role = normalizeRole(data.userRole);
    const userName = data.userName?.trim() || "Colaborador(a)";
    if (await findAuthUserByEmail(email)) {
      throw new Error(
        "Este e-mail já possui uma conta. Use o fluxo de recuperação ou vinculação de usuário existente.",
      );
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("name")
      .eq("id", accountId)
      .single();
    if (accountError) throw new Error(`Não foi possível carregar a conta: ${accountError.message}`);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const rawToken = generateSecureToken();

    const { error: revokeError } = await supabaseAdmin
      .from("first_access_invites")
      .update({ revoked_at: now.toISOString() })
      .eq("account_id", accountId)
      .eq("user_email", email)
      .is("used_at", null)
      .is("revoked_at", null);
    if (revokeError) throw new Error(`Não foi possível revogar convites anteriores: ${revokeError.message}`);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("first_access_invites")
      .insert({
        token_hash: await hashToken(rawToken),
        account_id: accountId,
        user_email: email,
        user_name: userName,
        user_role: role,
        office_name: account?.name || data.officeName?.trim() || "Escritório",
        created_by: context.userId,
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (insertError || !inserted) {
      throw new Error(`Não foi possível criar o convite: ${insertError?.message || "erro desconhecido"}`);
    }

    return {
      token: rawToken,
      expiresAt,
      tokenData: { ...publicTokenData(inserted as InviteRow), token: rawToken },
    };
  });

export const serverConsumeFirstAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; password: string }) => data)
  .handler(async ({ data }) => {
    const rawToken = data.token?.trim();
    const password = data.password || "";
    if (!rawToken) return { success: false, error: "Token de acesso não informado." };
    if (password.length < 8) {
      return { success: false, error: "A senha deve ter no mínimo 8 caracteres." };
    }

    const now = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("first_access_invites")
      .update({ used_at: now })
      .eq("token_hash", await hashToken(rawToken))
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .select("*")
      .maybeSingle();

    if (claimError) return { success: false, error: `Falha ao validar convite: ${claimError.message}` };
    if (!claimed) return { success: false, error: "Convite inválido, expirado, revogado ou já utilizado." };

    const invite = claimed as InviteRow;
    let createdUserId: string | null = null;
    try {
      const existing = await findAuthUserByEmail(invite.user_email);
      if (existing) {
        throw new Error("O e-mail já possui uma conta e não pode usar um convite de primeiro acesso.");
      }
      const metadata = {
        full_name: invite.user_name,
        role: invite.user_role,
        office_id: invite.account_id,
      };

      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: invite.user_email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error || !created.user) throw error || new Error("Falha ao criar usuário.");
      const userId = created.user.id;
      createdUserId = userId;

      const membershipRole = invite.user_role === "administrador" ? "admin" : "vendedor";
      const operations = await Promise.all([
        supabaseAdmin.from("profiles").upsert({
          id: userId,
          full_name: invite.user_name,
          email: invite.user_email,
          active: true,
          must_change_password: false,
        }),
        supabaseAdmin.from("account_members").upsert(
          {
            account_id: invite.account_id,
            user_id: userId,
            role: membershipRole,
            product_role: invite.user_role,
          },
          { onConflict: "account_id,user_id" },
        ),
      ]);
      const operationError = operations.find((result) => result.error)?.error;
      if (operationError) throw operationError;

      return { success: true, userEmail: invite.user_email, userRole: invite.user_role };
    } catch (error) {
      console.error("[first-access] Falha ao provisionar usuário:", error);
      if (createdUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
      }
      try {
        await supabaseAdmin
          .from("first_access_invites")
          .update({ used_at: null })
          .eq("id", invite.id)
          .eq("used_at", now);
      } catch {}
      return {
        success: false,
        error: "Não foi possível ativar a conta. Solicite um novo convite ao administrador.",
      };
    }
  });
