import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Portal do Cliente — todo o acesso a dados passa por estas funções de servidor.
 * O vínculo usuário → cliente é resolvido no backend; nada é confiado ao navegador.
 */

export interface PortalSession {
  clientId: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  username: string | null;
  status: string;
  permissions: string[];
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

export interface PortalBrand {
  id: string;
  brand: string;
  company_name: string;
  logo_url: string | null;
  segment: string | null;
  information: string | null;
  states: string[];
  authorized_at: string;
  collections: number;
  orders: number;
  total_value: number;
}

export interface PortalCatalog {
  id: string;
  name: string;
}

export interface PortalCollection {
  id: string;
  name: string;
  code: string | null;
  brand: string;
  brand_logo: string | null;
  season: string | null;
  year: number | null;
  description: string | null;
  cover_url: string | null;
  sales_start: string | null;
  sales_end: string | null;
  status: string;
  catalogs: PortalCatalog[];
  photos_link: string | null;
  allow_download: boolean;
}

export interface PortalOrderDoc {
  id: string;
  file_name: string;
  category: string;
  created_at: string;
  mime_type: string | null;
  size_bytes: number | null;
}

export interface PortalOrderItem {
  id: string;
  description: string;
  reference: string | null;
  quantity: number;
  unit_price: number;
  total_value: number;
}

export interface PortalOrder {
  id: string;
  internal_number: string;
  factory_order_number: string | null;
  order_date: string;
  total_value: number;
  total_pieces: number;
  status: string;
  notes: string | null;
  brand: string;
  brand_logo: string | null;
  collection: string | null;
  items: PortalOrderItem[];
  documents: PortalOrderDoc[];
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const DENIED = "Acesso não autorizado.";

async function resolvePortal(userId: string) {
  const db = await getAdmin();
  const { data } = await db
    .from("client_portal_users")
    .select("*, clients(*)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error(DENIED);
  if (data.status !== "Ativo") throw new Error("Seu acesso está bloqueado. Fale com a representação.");
  const client = (data as unknown as { clients: Record<string, string | null> | null }).clients;
  if (!client) throw new Error(DENIED);
  return { db, portal: data, client };
}

async function authorizedBrandIds(
  db: Awaited<ReturnType<typeof getAdmin>>,
  clientId: string,
): Promise<string[]> {
  const { data } = await db
    .from("client_brand_access")
    .select("brand_id, status")
    .eq("client_id", clientId);
  return (data ?? []).filter((r) => r.status === "Ativa").map((r) => r.brand_id);
}

/** Marcas de uma coleção: vínculos da coleção geral + marca única legada. */
function collectionBrandIds(col: unknown): string[] {
  const c = col as {
    brand_id?: string | null;
    brand_collections?: { brand_id: string }[] | null;
  };
  const ids = (c.brand_collections ?? []).map((b) => b.brand_id);
  if (c.brand_id) ids.push(c.brand_id);
  return ids;
}

// No collectionBrandLabel function anymore

async function logPortal(
  db: Awaited<ReturnType<typeof getAdmin>>,
  entry: {
    clientId: string;
    portalUserId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    description?: string;
  },
) {
  await db.from("client_portal_logs").insert({
    client_id: entry.clientId,
    portal_user_id: entry.portalUserId,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    description: entry.description ?? null,
  });
}

function toSession(portal: Record<string, unknown>, client: Record<string, unknown>): PortalSession {
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    clientId: String(client["id"]),
    legalName: String(client["legal_name"] ?? ""),
    tradeName: s(client["trade_name"]),
    cnpj: s(client["cnpj"]),
    city: s(client["city"]),
    state: s(client["state"]),
    phone: s(client["phone"]),
    email: s(client["email"]),
    contactName: s(client["contact_name"]),
    username: s(portal["username"]),
    status: String(portal["status"]),
    permissions: Array.isArray(portal["permissions"]) ? (portal["permissions"] as string[]) : [],
    lastLoginAt: s(portal["last_login_at"]),
    mustChangePassword: portal["must_change_password"] === true,
  };
}

/** Sessão do portal: valida o vínculo do usuário logado com um cliente. */
export const getPortalSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { portal, client } = await resolvePortal(context.userId);
    return toSession(portal as Record<string, unknown>, client as Record<string, unknown>);
  });

/** Registra o login do cliente e atualiza o último acesso. */
export const registerPortalLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, portal, client } = await resolvePortal(context.userId);
    await db
      .from("client_portal_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", portal.id);
    await logPortal(db, {
      clientId: String(client["id"]),
      portalUserId: portal.id,
      action: "login",
      description: "Entrada no portal do cliente.",
    });
    return { ok: true };
  });

/** Marcas autorizadas para o cliente, com resumo de compras. */
export const getPortalBrands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalBrand[]> => {
    const { db, client } = await resolvePortal(context.userId);
    const clientId = String(client["id"]);
    const { data: access } = await db
      .from("client_brand_access")
      .select("brand_id, authorized_at, status, brands(id, brand, company_name, logo_url, segment, notes, states)")
      .eq("client_id", clientId);
    const rows = (access ?? []).filter((r) => r.status === "Ativa");
    const ids = rows.map((r) => r.brand_id);
    if (ids.length === 0) return [];

    const [{ data: cols }, { data: orders }] = await Promise.all([
      db.from("collections").select("id, brand_id, portal_scope, brand_collections(brand_id)"),
      db
        .from("orders")
        .select("id, brand_id, total_value, status")
        .eq("client_id", clientId)
        .in("brand_id", ids),
    ]);

    return rows.map((r) => {
      const brand = (r as unknown as { brands: Record<string, string | null> | null }).brands;
      const bOrders = (orders ?? []).filter((o) => o.brand_id === r.brand_id && o.status !== "Cancelado");
      return {
        id: r.brand_id,
        brand: String(brand?.["brand"] ?? "—"),
        company_name: String(brand?.["company_name"] ?? ""),
        logo_url: brand?.["logo_url"] ?? null,
        segment: (brand?.["segment"] as string | null) ?? null,
        information: (brand?.["notes"] as string | null) ?? null,
        states: Array.isArray(brand?.["states"]) ? (brand?.["states"] as unknown as string[]) : [],
        authorized_at: String(r.authorized_at),
        collections: (cols ?? []).filter(
          (c) => collectionBrandIds(c).includes(r.brand_id) && c.portal_scope !== "ninguem",
        ).length,
        orders: bOrders.length,
        total_value: bOrders.reduce((acc, o) => acc + Number(o.total_value ?? 0), 0),
      };
    });
  });

/** Coleções liberadas: marca autorizada + publicação da coleção. */
export const getPortalCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalCollection[]> => {
    const { db, client } = await resolvePortal(context.userId);
    const clientId = String(client["id"]);
    const brandIds = await authorizedBrandIds(db, clientId);
    if (brandIds.length === 0) return [];

    const [{ data: brandCols }, { data: picked }] = await Promise.all([
      db
        .from("brand_collections")
        .select("*, collections(portal_scope, season, year, cover_url), brands(id, brand, logo_url)")
        .in("brand_id", brandIds)
        .order("start_date", { ascending: false }),
      db.from("client_collection_access").select("collection_id").eq("client_id", clientId),
    ]);
    const allowed = new Set((picked ?? []).map((p) => p.collection_id));
    
    const visibleBrandCols = (brandCols ?? []).filter((bc) => {
      const scope = (bc as any).collections?.portal_scope;
      return scope === "marca" || (scope === "selecionados" && allowed.has(bc.collection_id));
    });
    
    const bcIds = visibleBrandCols.map(bc => bc.id);
    const { data: docs } = bcIds.length > 0 
      ? await db.from("documents").select("id, entity_id, file_name").eq("entity_type", "brand_collection").eq("category", "Catálogo").in("entity_id", bcIds)
      : { data: [] };

    return visibleBrandCols.map((bc) => {
      const col = (bc as any).collections;
      const brand = (bc as any).brands;
      const bcDocs = (docs ?? []).filter(d => d.entity_id === bc.id);
      
      return {
        id: bc.id,
        name: bc.name,
        code: bc.brand_code,
        brand: brand?.brand ?? "—",
        brand_logo: brand?.logo_url ?? null,
        season: col?.season ?? null,
        year: col?.year ?? null,
        description: bc.description ?? null,
        cover_url: col?.cover_url ?? null,
        sales_start: bc.start_date ?? null,
        sales_end: bc.end_date ?? null,
        status: bc.status,
        catalogs: bcDocs.map(d => ({ id: d.id, name: d.file_name })),
        photos_link: bc.photos_link ?? null,
        allow_download: bc.allow_download ?? true,
      };
    });
  });

/** Pedidos do próprio cliente, com os documentos anexados pelo representante. */
export const getPortalOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalOrder[]> => {
    const { db, client } = await resolvePortal(context.userId);
    const clientId = String(client["id"]);
    const { data: orders } = await db
      .from("orders")
      .select("*, brands(id, brand, logo_url), collections(id, name)")
      .eq("client_id", clientId)
      .order("order_date", { ascending: false });
    const ids = (orders ?? []).map((o) => o.id);
    const { data: docs } = ids.length
      ? await db
          .from("documents")
          .select("id, entity_id, file_name, category, created_at, mime_type, size_bytes")
          .eq("entity_type", "order")
          .in("entity_id", ids)
      : { data: [] };
    const { data: items } = ids.length
      ? await db
          .from("order_items")
          .select("id, order_id, description, reference, quantity, unit_price, total_value")
          .in("order_id", ids)
      : { data: [] };


    return (orders ?? []).map((o) => {
      const rel = o as unknown as {
        brands: Record<string, string | null> | null;
        collections: Record<string, string | null> | null;
      };
      return {
        id: o.id,
        internal_number: o.internal_number,
        factory_order_number: o.factory_order_number,
        order_date: o.order_date,
        total_value: Number(o.total_value ?? 0),
        total_pieces: Number(o.total_pieces ?? 0),
        status: o.status,
        notes: o.notes,
        brand: String(rel.brands?.["brand"] ?? "—"),
        brand_logo: rel.brands?.["logo_url"] ?? null,
        collection: rel.collections?.["name"] ?? null,
        items: (items ?? [])
          .filter((it) => it.order_id === o.id)
          .map((it) => ({
            id: it.id,
            description: it.description,
            reference: it.reference,
            quantity: Number(it.quantity ?? 0),
            unit_price: Number(it.unit_price ?? 0),
            total_value: Number(it.total_value ?? 0),
          })),
        documents: (docs ?? [])
          .filter((d) => d.entity_id === o.id)
          .map((d) => ({
            id: d.id,
            file_name: d.file_name,
            category: d.category,
            created_at: d.created_at,
            mime_type: d.mime_type,
            size_bytes: d.size_bytes,
          })),
      };
    });
  });

/** Resumo do painel inicial do cliente. */
export const getPortalHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, portal, client } = await resolvePortal(context.userId);
    const clientId = String(client["id"]);
    const brandIds = await authorizedBrandIds(db, clientId);

    const [{ data: orders }, { data: brandCols }, { data: picked }] = await Promise.all([
      db.from("orders").select("id, total_value, total_pieces, status, order_date").eq("client_id", clientId),
      brandIds.length
        ? db
            .from("brand_collections")
            .select(
              "id, name, brand_id, created_at, collections(portal_scope), brands(brand)"
            )
            .in("brand_id", brandIds)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as never[] }),
      db.from("client_collection_access").select("collection_id").eq("client_id", clientId),
    ]);
    const allowed = new Set((picked ?? []).map((p) => p.collection_id));
    const visible = (brandCols ?? [])
      .filter(
        (bc) => {
          const scope = (bc as any).collections?.portal_scope;
          return scope === "marca" || (scope === "selecionados" && allowed.has((bc as any).collections?.id));
        }
      );
    const valid = (orders ?? []).filter((o) => o.status !== "Cancelado");
    
    const bcIds = visible.map(bc => bc.id);
    const { count: docCount } = await db
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("entity_type", "order")
      .in("entity_id", (orders ?? []).map((o) => o.id).length ? (orders ?? []).map((o) => o.id) : ["00000000-0000-0000-0000-000000000000"]);
    
    const { count: catalogCount } = await db
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("entity_type", "brand_collection")
      .eq("category", "Catálogo")
      .in("entity_id", bcIds.length ? bcIds : ["00000000-0000-0000-0000-000000000000"]);

    return {
      session: toSession(portal as Record<string, unknown>, client as Record<string, unknown>),
      brands: brandIds.length,
      collections: visible.length,
      catalogs: catalogCount ?? 0,
      orders: valid.length,
      pieces: valid.reduce((a, o) => a + Number(o.total_pieces ?? 0), 0),
      totalValue: valid.reduce((a, o) => a + Number(o.total_value ?? 0), 0),
      documents: docCount ?? 0,
      lastOrderDate: valid.map((o) => o.order_date).sort().at(-1) ?? null,
      news: visible.slice(0, 4).map((bc) => ({
        id: bc.id,
        title: `${String((bc as unknown as { brands: { brand: string } | null }).brands?.brand ?? "")} — ${bc.name}`,
        hasCatalog: false,
        createdAt: bc.created_at,
      })),
    };
  });

/** Link temporário e validado para abrir um arquivo liberado ao cliente. */
export const getPortalFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        kind: z.enum(["order-document", "brand-collection-catalog"]),
        id: z.string().uuid(),
        download: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { db, portal, client } = await resolvePortal(context.userId);
    const clientId = String(client["id"]);
    let path: string | null = null;
    let allowDownload = true;

    if (data.kind === "order-document") {
      const { data: doc } = await db
        .from("documents")
        .select("id, file_path, entity_id, entity_type")
        .eq("id", data.id)
        .maybeSingle();
      if (!doc || doc.entity_type !== "order") throw new Error(DENIED);
      const { data: order } = await db
        .from("orders")
        .select("id, client_id")
        .eq("id", doc.entity_id)
        .maybeSingle();
      if (!order || order.client_id !== clientId) throw new Error(DENIED);
      path = doc.file_path;
    } else if (data.kind === "brand-collection-catalog") {
      const { data: doc } = await db
        .from("documents")
        .select("id, file_path, entity_id")
        .eq("id", data.id)
        .eq("entity_type", "brand_collection")
        .maybeSingle();
      if (!doc) throw new Error(DENIED);

      const { data: bc } = await db
        .from("brand_collections")
        .select("id, collection_id, brand_id, allow_download, collections(portal_scope)")
        .eq("id", doc.entity_id)
        .maybeSingle();
      if (!bc) throw new Error(DENIED);
      
      const brandIds = await authorizedBrandIds(db, clientId);
      if (!brandIds.includes(bc.brand_id)) throw new Error(DENIED);
      
      const scope = (bc as any).collections?.portal_scope;
      if (scope === "ninguem") throw new Error(DENIED);
      if (scope === "selecionados") {
        const { data: ok } = await db
          .from("client_collection_access")
          .select("id")
          .eq("collection_id", bc.collection_id)
          .eq("client_id", clientId)
          .maybeSingle();
        if (!ok) throw new Error(DENIED);
      }
      path = doc.file_path;
      allowDownload = bc.allow_download;
    }

    if (!path) throw new Error(DENIED);
    if (data.download && !allowDownload) throw new Error("Este material é apenas para visualização.");

    const { data: signed, error } = await db.storage
      .from("documentos")
      .createSignedUrl(path, 300, data.download && allowDownload ? { download: true } : undefined);
    if (error || !signed) throw new Error("Não foi possível abrir o arquivo.");

    await logPortal(db, {
      clientId,
      portalUserId: portal.id,
      action: data.download ? "download" : "visualizacao",
      entityType: data.kind,
      entityId: data.id,
    });

    return { url: signed.signedUrl };
  });

/** Alteração de senha do próprio usuário do portal. */
export const changePortalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ password: z.string().min(8).max(72) }).parse(data))
  .handler(async ({ data, context }) => {
    const { db, portal, client } = await resolvePortal(context.userId);
    const { error } = await db.auth.admin.updateUserById(context.userId, { password: data.password });
    if (error) throw new Error(error.message);
    await db.from("client_portal_users").update({ must_change_password: false }).eq("id", portal.id);
    await logPortal(db, {
      clientId: String(client["id"]),
      portalUserId: portal.id,
      action: "senha_alterada",
      description: "O cliente alterou a própria senha.",
    });
    return { ok: true };
  });

/** Obtém o histórico de acessos do assinante (logs de login) */
export const getPortalAccessLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, portal } = await resolvePortal(context.userId);
    const { data } = await db
      .from("client_portal_logs")
      .select("created_at")
      .eq("portal_user_id", portal.id)
      .eq("action", "login")
      .order("created_at", { ascending: false })
      .limit(10);
    return (data ?? []).map((l) => l.created_at);
  });
