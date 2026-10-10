import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/** Administração do Portal do Cliente — somente administradores da representação. */

type AdminCtx = { supabase: SupabaseClient<Database>; userId: string };

async function requireAdmin(context: AdminCtx) {
  const { requireTenantAdmin } = await import("@/lib/security/authorization.server");
  return requireTenantAdmin(context.userId);
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type TenantScope = { accountId: string; isPlatformAdmin: boolean };

async function requireClientInScope(
  db: Awaited<ReturnType<typeof getAdmin>>,
  clientId: string,
  scope: TenantScope,
) {
  const { data, error } = await db
    .from("clients")
    .select("id, account_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.account_id !== scope.accountId) {
    throw new Error("Cliente não pertence à conta autenticada.");
  }
}

async function requireCollectionInScope(
  db: Awaited<ReturnType<typeof getAdmin>>,
  collectionId: string,
  scope: TenantScope,
) {
  const { data, error } = await db
    .from("collections")
    .select("id, account_id")
    .eq("id", collectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.account_id !== scope.accountId) {
    throw new Error("Coleção não pertence à conta autenticada.");
  }
}

async function requireBrandsInScope(
  db: Awaited<ReturnType<typeof getAdmin>>,
  brandIds: string[],
  scope: TenantScope,
) {
  if (brandIds.length === 0) return;
  const { data, error } = await db.from("brands").select("id").in("id", brandIds).eq("account_id", scope.accountId);
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== new Set(brandIds).size) {
    throw new Error("Uma ou mais marcas não pertencem à conta autenticada.");
  }
}

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

const DEFAULT_PERMISSIONS = [
  "pedidos",
  "catalogos",
  "materiais",
  "novidades",
  "suporte",
  "perfil",
  "download",
];

/** Cria o acesso do cliente ao portal e devolve a senha temporária. */
export const createPortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        email: z.string().email(),
        username: z.string().max(80).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireClientInScope(db, data.clientId, scope);

    const { data: existing } = await db
      .from("client_portal_users")
      .select("id")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (existing) throw new Error("Este cliente já possui acesso ao portal.");

    const password = tempPassword();
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { portal_client_id: data.clientId, full_name: data.username || data.email },
    });
    if (error || !created.user)
      throw new Error(error?.message ?? "Não foi possível criar o acesso do cliente.");

    const userId = created.user.id;
    // O usuário do portal não faz parte da equipe: remove perfil/role criados por gatilho.
    await db.from("user_roles").delete().eq("user_id", userId);
    await db.from("profiles").delete().eq("id", userId);

    const { error: insErr } = await db.from("client_portal_users").insert({
      client_id: data.clientId,
      user_id: userId,
      email: data.email,
      username: data.username || null,
      status: "Ativo",
      must_change_password: true,
      permissions: DEFAULT_PERMISSIONS,
      created_by: context.userId,
    });
    if (insErr) throw new Error(insErr.message);

    await db.from("client_portal_logs").insert({
      client_id: data.clientId,
      portal_user_id: null,
      admin_user_id: context.userId,
      action: "acesso_criado",
      description: `Acesso ao portal criado para ${data.email}.`,
    });

    return { email: data.email, password };
  });

/** Gera nova senha temporária para o acesso do cliente. */
export const resetPortalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireClientInScope(db, data.clientId, scope);
    const { data: row } = await db
      .from("client_portal_users")
      .select("id, user_id, email")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) throw new Error("Este cliente ainda não possui acesso ao portal.");

    const password = tempPassword();
    const { error } = await db.auth.admin.updateUserById(row.user_id, { password });
    if (error) throw new Error(error.message);
    await db.from("client_portal_users").update({ must_change_password: true }).eq("id", row.id);

    await db.from("client_portal_logs").insert({
      client_id: data.clientId,
      admin_user_id: context.userId,
      action: "senha_redefinida",
      description: "Senha temporária gerada pelo administrador.",
    });
    return { email: row.email, password };
  });

/** Altera a situação do acesso: Ativo, Bloqueado ou Suspenso. */
export const setPortalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        status: z.enum(["Ativo", "Bloqueado", "Suspenso"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireClientInScope(db, data.clientId, scope);
    const { error } = await db
      .from("client_portal_users")
      .update({ status: data.status })
      .eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    await db.from("client_portal_logs").insert({
      client_id: data.clientId,
      admin_user_id: context.userId,
      action: "situacao_alterada",
      description: `Situação do acesso alterada para ${data.status}.`,
    });
    return { ok: true };
  });

/** Remove por completo o acesso do cliente ao portal. */
export const removePortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireClientInScope(db, data.clientId, scope);
    const { data: row } = await db
      .from("client_portal_users")
      .select("id, user_id")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) return { ok: true };
    await db.from("client_portal_users").delete().eq("id", row.id);
    await db.auth.admin.deleteUser(row.user_id);
    await db.from("client_portal_logs").insert({
      client_id: data.clientId,
      admin_user_id: context.userId,
      action: "acesso_removido",
      description: "Acesso ao portal removido.",
    });
    return { ok: true };
  });

export interface PortalAccessInfo {
  hasAccess: boolean;
  email: string | null;
  username: string | null;
  status: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  brandIds: string[];
}

/** Situação do acesso do cliente e marcas autorizadas. */
export const getPortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PortalAccessInfo> => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireClientInScope(db, data.clientId, scope);
    const [{ data: row }, { data: brands }] = await Promise.all([
      db
        .from("client_portal_users")
        .select("email, username, status, last_login_at, created_at")
        .eq("client_id", data.clientId)
        .maybeSingle(),
      db
        .from("client_brand_access")
        .select("brand_id, status")
        .eq("client_id", data.clientId),
    ]);
    return {
      hasAccess: Boolean(row),
      email: row?.email ?? null,
      username: row?.username ?? null,
      status: row?.status ?? null,
      lastLoginAt: row?.last_login_at ?? null,
      createdAt: row?.created_at ?? null,
      brandIds: (brands ?? []).filter((b) => b.status === "Ativa").map((b) => b.brand_id),
    };
  });

/** Define quais marcas o cliente pode ver no portal. */
export const setClientBrandAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ clientId: z.string().uuid(), brandIds: z.array(z.string().uuid()) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireClientInScope(db, data.clientId, scope);
    await requireBrandsInScope(db, data.brandIds, scope);
    await db.from("client_brand_access").delete().eq("client_id", data.clientId);
    if (data.brandIds.length) {
      const { error } = await db.from("client_brand_access").insert(
        data.brandIds.map((brand_id) => ({
          client_id: data.clientId,
          brand_id,
          status: "Ativa",
          created_by: context.userId,
        })),
      );
      if (error) throw new Error(error.message);
    }
    await db.from("client_portal_logs").insert({
      client_id: data.clientId,
      admin_user_id: context.userId,
      action: "marcas_liberadas",
      description: `${data.brandIds.length} marca(s) liberada(s) para o portal.`,
    });
    return { ok: true };
  });

/** Envia (ou substitui) o catálogo em PDF de uma coleção. Somente administradores. */
export const saveCollectionCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        collectionId: z.string().uuid(),
        fileName: z.string().min(1).max(200),
        contentBase64: z.string().min(10),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireCollectionInScope(db, data.collectionId, scope);
    const bytes = Uint8Array.from(atob(data.contentBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 200 * 1024 * 1024) throw new Error("O catálogo deve ter até 200 MB.");
    const safe = data.fileName.replace(/[^\w.\-]+/g, "-").slice(-120);
    const path = `collection/${data.collectionId}/${Date.now()}-${safe}`;

    const { data: current } = await db
      .from("collections")
      .select("catalog_path")
      .eq("id", data.collectionId)
      .maybeSingle();

    const { error: upErr } = await db.storage
      .from("documentos")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { error } = await db
      .from("collections")
      .update({ catalog_path: path, catalog_name: data.fileName })
      .eq("id", data.collectionId);
    if (error) throw new Error(error.message);

    if (current?.catalog_path) await db.storage.from("documentos").remove([current.catalog_path]);
    return { ok: true, catalogName: data.fileName };
  });

/** Remove o catálogo em PDF de uma coleção. */
export const removeCollectionCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ collectionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireCollectionInScope(db, data.collectionId, scope);
    const { data: row } = await db
      .from("collections")
      .select("catalog_path")
      .eq("id", data.collectionId)
      .maybeSingle();
    if (row?.catalog_path) await db.storage.from("documentos").remove([row.catalog_path]);
    await db
      .from("collections")
      .update({ catalog_path: null, catalog_name: null })
      .eq("id", data.collectionId);
    return { ok: true };
  });

/** Link temporário para o representante conferir o catálogo enviado. */
export const getCollectionCatalogUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ collectionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireCollectionInScope(db, data.collectionId, scope);
    const { data: row } = await db
      .from("collections")
      .select("catalog_path")
      .eq("id", data.collectionId)
      .maybeSingle();
    if (!row?.catalog_path) throw new Error("Esta coleção não tem catálogo enviado.");
    const { data: signed, error } = await db.storage
      .from("documentos")
      .createSignedUrl(row.catalog_path, 300);
    if (error || !signed) throw new Error("Não foi possível abrir o catálogo.");
    return { url: signed.signedUrl };
  });

/**
 * Gera um link temporário para o navegador enviar o PDF direto ao armazenamento.
 * Evita trafegar o arquivo pelo servidor (que falha com catálogos grandes).
 */
export const createCollectionCatalogUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ collectionId: z.string().uuid(), fileName: z.string().min(1).max(200) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireCollectionInScope(db, data.collectionId, scope);
    const safe = data.fileName.replace(/[^\w.\-]+/g, "-").slice(-120) || "catalogo.pdf";
    const path = `collection/${data.collectionId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await db.storage
      .from("documentos")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Não foi possível preparar o envio.");
    return { path, token: signed.token };
  });

/** Confirma o catálogo enviado e remove o arquivo anterior. */
export const confirmCollectionCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        collectionId: z.string().uuid(),
        path: z.string().min(5),
        fileName: z.string().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdmin(context as AdminCtx);
    const db = await getAdmin();
    await requireCollectionInScope(db, data.collectionId, scope);
    if (!data.path.startsWith(`collection/${data.collectionId}/`))
      throw new Error("Arquivo inválido para esta coleção.");

    const { data: current } = await db
      .from("collections")
      .select("catalog_path")
      .eq("id", data.collectionId)
      .maybeSingle();

    const { error } = await db
      .from("collections")
      .update({ catalog_path: data.path, catalog_name: data.fileName })
      .eq("id", data.collectionId);
    if (error) throw new Error(error.message);

    if (current?.catalog_path && current.catalog_path !== data.path)
      await db.storage.from("documentos").remove([current.catalog_path]);
    return { ok: true, catalogName: data.fileName };
  });
