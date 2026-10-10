import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Todas as permissões possíveis dentro do sistema. */
export const PERMISSIONS = [
  "leads",
  "clientes",
  "marcas",
  "colecoes",
  "pedidos",
  "faturamento",
  "comissoes",
  "financeiro",
  "documentos",
  "relatorios",
  "usuarios",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  leads: "Leads e follow-ups",
  clientes: "Clientes",
  marcas: "Fábricas e marcas",
  colecoes: "Coleções",
  pedidos: "Pedidos",
  faturamento: "Faturamento e liquidez",
  comissoes: "Comissões",
  financeiro: "Financeiro e despesas",
  documentos: "Documentos",
  relatorios: "Relatórios",
  usuarios: "Usuários e permissões",
};

const userInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  role: z.enum(["admin", "vendedor"]),
  phone: z.string().optional().default(""),
  document: z.string().optional().default(""),
  role_title: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  permissions: z.array(z.string()).default([]),
});


export type EmailUsage = {
  inUse: boolean;
  scope: "equipe" | "portal_cliente" | "conta_assinante" | "auth" | null;
  message: string | null;
  userId: string | null;
};

type TenantScope = { accountId: string; isPlatformAdmin: boolean };

async function requireTeamAdmin(userId: string): Promise<TenantScope> {
  const { requireTenantAdmin } = await import("@/lib/security/authorization.server");
  return requireTenantAdmin(userId);
}

async function requireUserInScope(
  admin: {
    from: (table: string) => any;
  },
  userId: string,
  scope: TenantScope,
) {
  const { data, error } = await admin
    .from("account_members")
    .select("user_id")
    .eq("account_id", scope.accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário não pertence à conta autenticada.");
}

/**
 * Descobre se um e-mail já está em uso e em qual função (equipe, portal do
 * cliente ou responsável por conta assinante). Somente administradores.
 */
export const lookupEmailUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data, context }): Promise<EmailUsage> => {
    await requireTeamAdmin(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await describeEmailUsage(supabaseAdmin, data.email);
  });

/** Helper compartilhado: identifica onde um e-mail já está cadastrado. */
export async function describeEmailUsage(
  admin: {
    from: (t: string) => any;
    auth: { admin: { listUsers: (o: any) => Promise<any> } };
  },
  emailRaw: string,
): Promise<EmailUsage> {
  const email = emailRaw.trim().toLowerCase();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle();
  if (profile) {
    const { data: r } = await admin.from("user_roles").select("role").eq("user_id", profile.id);
    const role = (r ?? []).some((x: { role: string }) => x.role === "admin")
      ? "Administrador"
      : "Vendedor";
    return {
      inUse: true,
      scope: "equipe",
      userId: profile.id as string,
      message: `Este e-mail já é usuário da equipe (${profile.full_name ?? email} — ${role}).`,
    };
  }

  const { data: portal } = await admin
    .from("client_portal_users")
    .select("user_id, email, clients(legal_name, trade_name)")
    .ilike("email", email)
    .maybeSingle();
  if (portal) {
    const c = portal.clients as { legal_name?: string; trade_name?: string } | null;
    const nome = c?.trade_name || c?.legal_name || "cliente";
    return {
      inUse: true,
      scope: "portal_cliente",
      userId: (portal.user_id as string) ?? null,
      message: `Este e-mail já é acesso de portal do cliente (${nome}).`,
    };
  }

  const { data: acc } = await admin
    .from("accounts")
    .select("id, name, contact_email")
    .ilike("contact_email", email)
    .maybeSingle();
  if (acc) {
    let resolvedUserId: string | null = null;
    const { data: member } = await admin
      .from("account_members")
      .select("user_id")
      .eq("account_id", acc.id)
      .limit(1)
      .maybeSingle();
    if (member?.user_id) {
      resolvedUserId = member.user_id;
    } else {
      try {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = (list?.users ?? []).find(
          (u: { id: string; email?: string }) => (u.email ?? "").toLowerCase() === email,
        );
        if (found) resolvedUserId = found.id;
      } catch {}
    }

    return {
      inUse: true,
      scope: "conta_assinante",
      userId: resolvedUserId,
      message: `Este e-mail já é responsável por uma conta assinante (${acc.name}).`,
    };
  }

  try {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = (list?.users ?? []).find(
      (u: { id: string; email?: string }) => (u.email ?? "").toLowerCase() === email,
    );
    if (found) {
      return {
        inUse: true,
        scope: "auth",
        userId: found.id,
        message:
          "Este e-mail já possui login no sistema, mas não está vinculado a nenhum cadastro visível.",
      };
    }
  } catch {
    // Se a listagem falhar, seguimos sem bloquear.
  }

  return { inUse: false, scope: null, message: null, userId: null };
}

/** Cria um novo usuário da equipe. Somente administradores. */
export const createTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userInput.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await requireTeamAdmin(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const usage = await describeEmailUsage(supabaseAdmin as any, data.email);
    if (usage.inUse) throw new Error(usage.message ?? "Este e-mail já está cadastrado.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Não foi possível criar o acesso.");

    const newId = created.user.id;
    const permissions = data.permissions;

    await supabaseAdmin.from("profiles").upsert({
      id: newId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || null,
      document: data.document || null,
      role_title: data.role_title || null,
      city: data.city || null,
      state: data.state || null,
      notes: data.notes || null,
      active: true,
      permissions,
    });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role });
    await supabaseAdmin.from("account_members").upsert(
      {
        account_id: scope.accountId,
        user_id: newId,
        role: data.role === "admin" ? "admin" : "vendedor",
      },
      { onConflict: "account_id,user_id" },
    );

    return { id: newId, permissionsApplied: permissions.length > 0 };
  });

/** Atualiza permissões de um usuário. Somente o administrador principal. */
export const setUserPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), permissions: z.array(z.string()) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireTeamAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireUserInScope(supabaseAdmin as any, data.userId, scope);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ permissions: data.permissions })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ativa ou desativa um usuário. Somente administradores. */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireTeamAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireUserInScope(supabaseAdmin as any, data.userId, scope);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateInput = z.object({
  userId: z.string().uuid(),
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  document: z.string().optional().default(""),
  role_title: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

/** Edita dados de um usuário da equipe. Somente administradores. */
export const updateTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await requireTeamAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireUserInScope(supabaseAdmin as any, data.userId, scope);

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_primary_admin")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("Usuário não encontrado.");
    if (target.is_primary_admin && target.id !== context.userId)
      throw new Error("O administrador principal só pode editar o próprio cadastro.");

    const emailChanged = (target.email ?? "").toLowerCase() !== data.email.trim().toLowerCase();
    if (emailChanged) {
      const usage = await describeEmailUsage(supabaseAdmin as any, data.email);
      if (usage.inUse && usage.userId !== data.userId)
        throw new Error(usage.message ?? "Este e-mail já está cadastrado.");
    }

    if (emailChanged || (data.password && data.password.length >= 8)) {
      const payload: { email?: string; password?: string; email_confirm?: boolean } = {};
      if (emailChanged) {
        payload.email = data.email;
        payload.email_confirm = true;
      }
      if (data.password && data.password.length >= 8) payload.password = data.password;
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        data.userId,
        payload,
      );
      if (authError) throw new Error(authError.message);
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        document: data.document || null,
        role_title: data.role_title || null,
        city: data.city || null,
        state: data.state || null,
        notes: data.notes || null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Exclui um usuário da equipe, mantendo os registros históricos. Somente administradores. */
export const deleteTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const scope = await requireTeamAdmin(context.userId);
    if (data.userId === context.userId)
      throw new Error("Você não pode excluir a sua própria conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireUserInScope(supabaseAdmin as any, data.userId, scope);
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, is_primary_admin")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("Usuário não encontrado.");
    if (target.is_primary_admin)
      throw new Error("O administrador principal não pode ser excluído.");

    // Mantém o histórico: apenas desvincula o responsável dos registros.
    let unlinked = 0;
    for (const table of ["leads", "clients", "expenses", "tasks", "trips"] as const) {
      const { data: rows } = await (supabaseAdmin as any)
        .from(table)
        .update({ owner_id: null })
        .eq("owner_id", data.userId)
        .eq("account_id", scope.accountId)
        .select("id");
      unlinked += (rows ?? []).length;
    }

    await supabaseAdmin
      .from("account_members")
      .delete()
      .eq("account_id", scope.accountId)
      .eq("user_id", data.userId);

    // Se o mesmo login também é usado por uma conta assinante ou pelo portal do
    // cliente, o login precisa continuar existindo — removemos apenas o acesso ao CRM.
    const { data: tenant } = await (supabaseAdmin as any)
      .from("account_members")
      .select("account_id, accounts(name)")
      .eq("user_id", data.userId)
      .limit(1)
      .maybeSingle();
    const { data: portalUser } = await (supabaseAdmin as any)
      .from("client_portal_users")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (tenant || portalUser) {
      const where = tenant
        ? `conta assinante "${tenant.accounts?.name ?? "assinante"}"`
        : "portal do cliente";
      return {
        ok: true,
        unlinked,
        notice: `Acesso ao CRM removido. O login foi mantido porque também é usado na ${where}.`,
      };
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true, unlinked, notice: null as string | null };
  });

