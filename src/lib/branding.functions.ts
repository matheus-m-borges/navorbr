import { createServerFn } from "@tanstack/react-start";
import {
  GLOBAL_ACCOUNT_ID,
  parseRepresentation,
  REPRESENTATION_KEY,
  type Representation,
} from "./branding";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAuthenticatedAccount } from "@/lib/security/authorization.server";

const BRANDING_BUCKET = "branding";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 dias

/** Resolve somente a conta autorizada do usuário; ambiguidade falha fechada. */
async function resolveAccount(admin: any, userId: string) {
  const { accountId } = await requireAuthenticatedAccount(userId);
  const { data: account, error } = await admin
    .from("accounts")
    .select("name")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao validar conta: ${error.message}`);

  return {
    accountId,
    accountName: (account?.name as string | undefined) ?? "",
  };
}

async function signIfNeeded(admin: any, path: string): Promise<string> {
  if (!path) return "";
  const { data } = await admin.storage.from(BRANDING_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? "";
}

/**
 * Identidade global da plataforma (NAVOR), exibida nas telas públicas de
 * entrada. Não exige login — lê apenas a configuração da conta global.
 */
export const getGlobalRepresentation = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", REPRESENTATION_KEY)
    .eq("account_id", GLOBAL_ACCOUNT_ID)
    .maybeSingle();

  const rep = parseRepresentation((data as { value?: unknown } | null)?.value);
  if (rep.icon_path) rep.icon_url = await signIfNeeded(admin, rep.icon_path);
  if (rep.banner_path) rep.banner_url = await signIfNeeded(admin, rep.banner_path);
  return rep;
});

/**
 * Identidade da representação (nome, slogan, ícone, imagem de topo) da conta
 * assinante do usuário logado. Cada assinante tem a sua, sem afetar as outras.
 */
export const getMyRepresentation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { accountId, accountName } = await resolveAccount(admin, context.userId);

    let { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", REPRESENTATION_KEY)
      .eq("account_id", accountId)
      .maybeSingle();

    // Removido fallback para configurações globais a pedido do usuário (isolamento completo de tenants)

    const rep = parseRepresentation((data as { value?: unknown } | null)?.value);
    if (!rep.name && accountName) rep.name = accountName;
    if (rep.icon_path) rep.icon_url = await signIfNeeded(admin, rep.icon_path);
    if (rep.banner_path) rep.banner_url = await signIfNeeded(admin, rep.banner_path);
    return rep;
  });

export const saveMyRepresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Representation) => data)
  .handler(async ({ data: form, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { accountId } = await resolveAccount(admin, context.userId);

    // Imagens guardadas em arquivo não precisam do endereço temporário salvo.
    const value = {
      ...form,
      icon_url: form.icon_path ? "" : form.icon_url,
      banner_url: form.banner_path ? "" : form.banner_url,
    };

    const { error } = await admin
      .from("app_settings")
      .upsert(
        { key: REPRESENTATION_KEY, account_id: accountId, value, updated_at: new Date().toISOString() },
        { onConflict: "key,account_id" },
      );
    if (error) throw new Error(`Erro ao salvar identidade: ${error.message}`);

    return { success: true };
  });

/** Recebe o ícone ou a imagem de topo e guarda como arquivo da conta. */
export const uploadBrandingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: "icon" | "banner"; dataUrl: string }) => data)
  .handler(async ({ data, context }) => {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("Formato de imagem não reconhecido. Envie um arquivo de imagem.");
    const mime = match[1] as string;
    const base64 = match[2] as string;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { accountId } = await resolveAccount(admin, context.userId);

    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 10 * 1024 * 1024)
      throw new Error("Imagem muito grande. Envie uma imagem de até 10 MB.");

    const ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg");
    const path = `${accountId}/${data.kind}-${Date.now()}.${ext}`;

    const { error } = await admin.storage
      .from(BRANDING_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) throw new Error(`Erro ao enviar a imagem: ${error.message}`);

    const url = await signIfNeeded(admin, path);
    return { path, url };
  });

export const saveMySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { settings: { key: string; value: string }[] }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { accountId } = await resolveAccount(admin, context.userId);

    for (const { key, value } of data.settings) {
      const { error } = await admin
        .from("app_settings")
        .upsert(
          { key, account_id: accountId, value, updated_at: new Date().toISOString() },
          { onConflict: "key,account_id" },
        );
      if (error) throw new Error(`Erro ao salvar configuração (${key}): ${error.message}`);
    }

    return { success: true };
  });
