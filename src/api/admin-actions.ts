import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { setCookie, getCookie } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin as serviceSupabase } from "@/integrations/supabase/client.server";
import { randomUUID, timingSafeEqual } from "node:crypto";
function getAdminTokenSecret(): string {
  const secret = process.env["ADMIN_SESSION_SECRET"];
  if (!secret) throw new Error("ADMIN_SESSION_SECRET não configurado.");
  if (secret.length < 32) throw new Error("ADMIN_SESSION_SECRET deve ter no mínimo 32 caracteres.");
  return secret;
}

function normalizePublicProductUrl(value: string | null | undefined, label: string): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error();
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${label} deve usar uma URL HTTPS válida, sem credenciais.`);
  }
}

// Implementação pura de SHA-256 para portabilidade total (compatível com Node, browser e Vite)
function pureSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  let k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let padded = ascii + "\x80";
  while (padded.length % 64 !== 56) padded += "\x00";
  for (i = 0; i < padded.length; i++) {
    j = padded.charCodeAt(i);
    const wordIdx = i >> 2;
    words[wordIdx] = (words[wordIdx] ?? 0) | (j << ((3 - (i % 4)) * 8));
  }
  words.push((asciiBitLength / maxWord) | 0);
  words.push(asciiBitLength | 0);

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const a = hash[0] ?? 0;
      const e = hash[4] ?? 0;
      const temp1 =
        (hash[7] ?? 0) +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & (hash[5] ?? 0)) ^ (~e & (hash[6] ?? 0))) +
        (k[i] ?? 0) +
        ((w[i] =
          i < 16
            ? (w[i] ?? 0)
            : ((w[i - 16] ?? 0) +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                (w[i - 7] ?? 0) +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0) | 0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & (hash[1] ?? 0)) ^ (a & (hash[2] ?? 0)) ^ ((hash[1] ?? 0) & (hash[2] ?? 0)));

      hash = [((temp1 + temp2) | 0)].concat(hash);
      hash[4] = ((hash[4] ?? 0) + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = ((hash[i] ?? 0) + (oldHash[i] ?? 0)) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = ((hash[i] ?? 0) >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

function pureHmacSha256(key: string, message: string): string {
  if (key.length > 64) key = pureSha256(key);
  while (key.length < 64) key += "\x00";
  let oKeyPad = "";
  let iKeyPad = "";
  for (let i = 0; i < 64; i++) {
    oKeyPad += String.fromCharCode(key.charCodeAt(i) ^ 0x5c);
    iKeyPad += String.fromCharCode(key.charCodeAt(i) ^ 0x36);
  }
  return pureSha256(oKeyPad + pureSha256(iKeyPad + message));
}

function encodeBase64Url(str: string): string {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(str, "utf-8").toString("base64url");
    }
  } catch {}
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(b64url: string): string {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(b64url, "base64url").toString("utf-8");
    }
  } catch {}
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return decodeURIComponent(escape(atob(b64)));
}

type AdminSessionRecord = {
  token: string;
  jti: string;
  expiresAt: Date;
};

function createAdminSessionRecord(userId: string, email: string): AdminSessionRecord {
  const secret = getAdminTokenSecret();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
  const jti = randomUUID();
  const payload = `${userId}:${email.toLowerCase()}:${expiresAt.getTime()}:${jti}`;
  const hmac = pureHmacSha256(secret, payload);
  return {
    token: `${encodeBase64Url(payload)}.${hmac}`,
    jti,
    expiresAt,
  };
}

export function createAdminSessionToken(userId: string, email: string): string {
  return createAdminSessionRecord(userId, email).token;
}

export function verifyAdminSessionToken(token: string | undefined | null): { valid: boolean; userId?: string; email?: string; jti?: string } {
  if (!token || typeof token !== "string") return { valid: false };
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };

  try {
    const [payloadB64, signature] = parts;
    if (!payloadB64 || !signature) return { valid: false };
    const payload = decodeBase64Url(payloadB64);
    const [userId, email, expiresAtStr, jti] = payload.split(":");
    if (!userId || !email || !expiresAtStr || !jti) return { valid: false };
    if (!/^[0-9a-f-]{36}$/i.test(jti)) return { valid: false };

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return { valid: false };

    const secret = getAdminTokenSecret();
    const expectedHmac = pureHmacSha256(secret, payload);

    const provided = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedHmac, "utf8");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return { valid: false };
    }

    return { valid: true, userId, email, jti };
  } catch {
    return { valid: false };
  }
}

export const requireAdminSession = createServerOnlyFn(async () => {
  const cookie = getCookie("admin_unlocked");
  const auth = verifyAdminSessionToken(cookie);
  if (!auth.valid || !auth.jti) {
    throw new Error("Acesso negado: Administrador não autenticado ou sessão expirada.");
  }
  const adminStore = serviceSupabase as any;
  const [{ data: session, error: sessionError }, { data: data, error }] = await Promise.all([
    adminStore
      .from("admin_sessions")
      .select("jti")
      .eq("jti", auth.jti)
      .eq("user_id", auth.userId!)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
    serviceSupabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", auth.userId!)
      .maybeSingle(),
  ]);
  if (sessionError || !session || error || !data) {
    throw new Error("Acesso negado: administrador removido ou desativado.");
  }
  return auth;
});

export const unlockAdminPanel = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  email: string;
  password: string;
}) => data)
  .handler(async ({ data }) => {
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;
  const emailClean = (data.email || "").trim().toLowerCase();
  const passClean = (data.password || "").trim();

  if (!emailClean || !passClean) {
    throw new Error("Informe o e-mail de administrador e a senha de acesso.");
  }

  let isAuthenticated = false;
  let resolvedUserId: string | null = null;

  // 1. Tentativa de autenticação formal via Supabase Auth
  try {
    const { data: authData, error } = await supabaseAdmin.auth.signInWithPassword({
      email: emailClean,
      password: passClean,
    });

    if (!error && authData?.user) {
      resolvedUserId = authData.user.id;
      const { data: adminRow } = await supabaseAdmin
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (adminRow) isAuthenticated = true;
    }
  } catch {}

  if (!isAuthenticated || !resolvedUserId) {
    throw new Error("Credenciais inválidas. Verifique o e-mail de administrador e a senha.");
  }

  // Gera token assinado com HMAC-SHA256
  const session = createAdminSessionRecord(resolvedUserId, emailClean);
  const { error: sessionInsertError } = await (serviceSupabase as any)
    .from("admin_sessions")
    .insert({
      jti: session.jti,
      user_id: resolvedUserId,
      expires_at: session.expiresAt.toISOString(),
    });
  if (sessionInsertError) {
    throw new Error("Não foi possível iniciar a sessão administrativa.");
  }

  // Grava cookie seguro com o token criptografado
  setCookie("admin_unlocked", session.token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 horas
  });

  return { success: true, email: emailClean };
});

export const checkAdminUnlock = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    await requireAdminSession();
    return true;
  } catch {
    return false;
  }
});

export const getAdminSessionInfo = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAdminSession();
  return { email: session.email || "", userId: session.userId || "" };
});

export const getAdminErrorStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { since: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    const parsed = new Date(data.since);
    if (Number.isNaN(parsed.getTime())) throw new Error("Data de referência inválida.");
    const { count, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("entity_type", "error")
      .gt("created_at", parsed.toISOString());
    if (error) throw error;
    return { hasNewErrors: (count || 0) > 0 };
  });

export const lockAdminPanel = createServerFn({ method: 'POST' }).handler(async () => {
  const token = getCookie("admin_unlocked");
  const auth = verifyAdminSessionToken(token);
  if (auth.jti) {
    const { error } = await (serviceSupabase as any)
      .from("admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("jti", auth.jti)
      .is("revoked_at", null);
    if (error) {
      throw new Error("Não foi possível revogar a sessão administrativa.");
    }
  }
  setCookie("admin_unlocked", "", {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return { success: true };
});

export const saveMasterSecuritySettings = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    primaryEmail: string;
    recoveryEmail?: string;
  }) => data)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

    const cleanPrimary = (data.primaryEmail || "").trim().toLowerCase();
    const cleanRecovery = (data.recoveryEmail || "").trim().toLowerCase();

    if (!cleanPrimary || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanPrimary)) {
      throw new Error("Informe um e-mail principal válido.");
    }
    if (cleanRecovery && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanRecovery)) {
      throw new Error("Informe um e-mail de recuperação válido.");
    }

    const config = {
      primary_email: cleanPrimary,
      recovery_email: cleanRecovery,
      updated_at: new Date().toISOString(),
    };

    // Salva na tabela app_settings para persistência na nuvem
    const { error: upsertErr } = await supabaseAdmin.from("app_settings").upsert(
      {
        key: "navor_master_security_config",
        account_id: "00000000-0000-0000-0000-000000000000",
        value: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key,account_id" }
    );

    if (upsertErr) {
      console.warn("Aviso ao salvar app_settings:", upsertErr);
    }

    return { success: true };
  });

export const getMasterSecuritySettings = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requireAdminSession();
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) return null;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

    try {
      const { data } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "navor_master_security_config")
        .maybeSingle();

      if (data?.value) {
        return {
          primary_email: data.value.primary_email || "",
          recovery_email: data.value.recovery_email || "",
          master_password: "",
        };
      }
    } catch {}
    return null;
  });

/** Gera uma senha provisória forte e legível para entregar ao assinante. */
function generateProvisionalPassword(prefix = "Navor") {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) =>
    Array.from(
      { length: n },
      () => set[Math.floor(Math.random() * set.length)] as string,
    ).join("");
  return `${prefix}${pick(letters, 2)}${pick(lower, 3)}${pick(digits, 4)}!`;
}

/** Endereço técnico único por produto. O cliente continua usando o e-mail real na tela. */
function productAuthEmail(productSlug: string, email: string) {
  return `${productSlug}.${pureSha256(`${productSlug}:${email.trim().toLowerCase()}`).slice(0, 40)}@login.navor.internal`;
}

async function requireAdminClient() {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  return createClient(supabaseUrl, supabaseServiceKey) as any;
}

/** Resolve o endereço técnico do Auth sem expor a mudança ao cliente. */
export const resolveProductLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; product?: string }) => data)
  .handler(async ({ data }) => {
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) return { authEmail: null };
    const admin = createClient(supabaseUrl, supabaseServiceKey) as any;
    const slug = (data.product || "rephub").trim().toLowerCase();
    const email = data.email.trim().toLowerCase();
    const { data: product } = await admin.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!product?.id) return { authEmail: null };
    const { data: identity } = await admin
      .from("product_login_identities")
      .select("auth_user_id")
      .eq("product_id", product.id)
      .eq("login_email", email)
      .maybeSingle();
    return { authEmail: identity?.auth_user_id ? productAuthEmail(slug, email) : null };
  });

/**
 * Garante de forma canônica, idempotente e não destrutiva que os produtos oficiais
 * da plataforma NAVOR (RepHub, EngHub, LawHub, BarberHub e PetHub), seus módulos e planos
 * estejam devidamente gravados no banco Supabase de produção.
 */
let _canonicalSyncDone = false;
export async function ensureCanonicalProductsAndPetHub(supabaseAdmin: any) {
  if (_canonicalSyncDone) return;
  try {
    // 1. Assegurar PetHub na tabela products
    const { data: pethubRow } = await supabaseAdmin
      .from("products")
      .select("id, slug, status")
      .eq("slug", "pethub")
      .maybeSingle();

    let pethubId = pethubRow?.id;

    if (!pethubId) {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("products")
        .upsert(
          {
            name: "PetHub",
            slug: "pethub",
            description: "Plataforma integrada para administrar vendas, banho e tosa, clientes, pets, estoque, financeiro, fiscal, equipe, franquias e vendas online.",
            short_description: "Gestão integrada para pet shops, do caixa ao e-commerce.",
            tag_line: "Gestão inteligente para pet shops.",
            status: "coming_soon",
            is_public: true,
            trial_eligible: false,
            target_audience: "Pet shops, clínicas veterinárias, centros de estética animal, daycare e hotéis pet.",
            benefits: [
              "PDV e frente de caixa com modo offline",
              "Agenda, banho e tosa e prontuário",
              "Estoque, XML e e-commerce integrado",
            ],
            display_order: 5,
            admin_app_url: "https://app.pethub.navorbr.com",
            client_portal_url: "https://pethub.navorbr.com",
          },
          { onConflict: "slug" }
        )
        .select("id")
        .maybeSingle();

      if (!insertErr && inserted?.id) {
        pethubId = inserted.id;
      }
    }

    if (pethubId) {
      // 2. 15 Módulos Canônicos do PetHub
      const pethubModules = [
        { key: "pdv_frente_caixa", name: "PDV e Frente de Caixa", description: "Frente de caixa rápida, vendas, comandas e sangrias", is_beta: true },
        { key: "fiscal", name: "Fiscal", description: "Emissão de NFC-e, NF-e, contingência offline e transmissão", is_beta: false },
        { key: "estoque_compras", name: "Estoque e Compras", description: "Controle de estoque por loja, saldo mínimo, perdas e inventário", is_beta: true },
        { key: "importacao_xml", name: "Importação de XML", description: "Entrada de notas fiscais por XML, vínculo de fornecedor e custo", is_beta: true },
        { key: "agenda_banho_tosa", name: "Agenda, Banho e Tosa", description: "Grade de horários por profissional, baia e status de atendimento", is_beta: true },
        { key: "clientes_pets_fidelidade", name: "Clientes, Pets e Fidelidade", description: "Ficha cadastral do pet, carteira de vacinas e programa de fidelidade", is_beta: true },
        { key: "financeiro", name: "Financeiro", description: "Contas a pagar, a receber, fluxo de caixa e conciliação bancária", is_beta: true },
        { key: "funcionarios_permissoes", name: "Funcionários e Permissões", description: "Gestão de equipes, comissões e permissões granulares por cargo", is_beta: true },
        { key: "multilojas_franquias", name: "Multi-lojas e Franquias", description: "Visão unificada da rede, tabelas centralizadas e estoques independentes", is_beta: false },
        { key: "site_institucional", name: "Site Institucional", description: "Site público e institucional para cada unidade", is_beta: true },
        { key: "ecommerce", name: "E-commerce", description: "Loja virtual integrada com reserva de estoque e checkout", is_beta: true },
        { key: "whatsapp_comunicacao", name: "WhatsApp e Comunicação", description: "Notificações de atendimento, aviso de pet pronto e lembretes de vacina", is_beta: false },
        { key: "taxi_dog", name: "Taxi Dog", description: "Agendamento e rotas de transporte e busca de animais", is_beta: false },
        { key: "hotel_creche", name: "Hotel e Creche", description: "Controle de diárias, baias, medicação e check-in/out de hospedagem", is_beta: false },
        { key: "clinica_veterinaria", name: "Clínica Veterinária", description: "Prontuário veterinário, anamnese, receituário e exames", is_beta: true },
      ];

      for (const m of pethubModules) {
        await supabaseAdmin.from("system_modules").upsert(
          {
            key: m.key,
            name: m.name,
            description: m.description,
            product_id: pethubId,
            is_active: true,
            is_beta: m.is_beta,
          },
          { onConflict: "key" }
        );
      }

      // 3. 3 Planos Canônicos do PetHub
      const { data: dbMods } = await supabaseAdmin
        .from("system_modules")
        .select("id, key")
        .eq("product_id", pethubId);
      const modMap = new Map((dbMods || []).map((x: any) => [x.key, x.id]));

      const pethubPlans = [
        {
          name: "Pet Gestão",
          description: "Gestão física sem e-commerce.",
          amount: 149.90,
          is_active: false,
          is_public: false,
          trial_eligible: false,
          display_order: 1,
          moduleKeys: ["pdv_frente_caixa", "fiscal", "estoque_compras", "importacao_xml", "agenda_banho_tosa", "clientes_pets_fidelidade", "financeiro", "funcionarios_permissoes", "whatsapp_comunicacao"],
        },
        {
          name: "Pet Gestão + E-commerce",
          description: "Gestão física com site e loja virtual integrada.",
          amount: 279.90,
          is_active: false,
          is_public: false,
          trial_eligible: false,
          display_order: 2,
          is_featured: true,
          moduleKeys: ["pdv_frente_caixa", "fiscal", "estoque_compras", "importacao_xml", "agenda_banho_tosa", "clientes_pets_fidelidade", "financeiro", "funcionarios_permissoes", "whatsapp_comunicacao", "site_institucional", "ecommerce", "clinica_veterinaria"],
        },
        {
          name: "Rede Pet",
          description: "Multi-lojas e franquias, com visão consolidada.",
          amount: 499.90,
          is_active: false,
          is_public: false,
          trial_eligible: false,
          display_order: 3,
          moduleKeys: pethubModules.map((x) => x.key),
        },
      ];

      for (const plan of pethubPlans) {
        const { data: existingPlan } = await supabaseAdmin
          .from("plans")
          .select("id")
          .eq("name", plan.name)
          .eq("product_id", pethubId)
          .maybeSingle();

        let planId = existingPlan?.id;
        if (!planId) {
          const { data: createdPlan } = await supabaseAdmin
            .from("plans")
            .insert({
              name: plan.name,
              description: plan.description,
              amount: plan.amount,
              product_id: pethubId,
              is_active: plan.is_active,
              is_public: plan.is_public,
              trial_eligible: plan.trial_eligible,
              display_order: plan.display_order,
              is_featured: (plan as any).is_featured || false,
            })
            .select("id")
            .maybeSingle();
          planId = createdPlan?.id;
        }

        if (planId) {
          const rows = plan.moduleKeys
            .map((k) => modMap.get(k))
            .filter(Boolean)
            .map((module_id) => ({ plan_id: planId, module_id }));
          if (rows.length > 0) {
            await supabaseAdmin.from("plan_modules").upsert(rows, { onConflict: "plan_id,module_id" });
          }
        }
      }
    }
    _canonicalSyncDone = true;
  } catch (err) {
    console.error("[ensureCanonicalProductsAndPetHub] Erro:", err);
  }
}

export const getAdminProducts = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  await ensureCanonicalProductsAndPetHub(supabaseAdmin);
  const { data: productsData } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });
    
  let list = productsData || [];
  if (!list.some((p: any) => p.slug === "pethub")) {
    list.push({
      id: "pethub-canonical-temp",
      name: "PetHub",
      slug: "pethub",
      description: "Plataforma integrada para administrar vendas, banho e tosa, clientes, pets, estoque, financeiro, fiscal, equipe, franquias e vendas online.",
      short_description: "Gestão integrada para pet shops, do caixa ao e-commerce.",
      tag_line: "Gestão inteligente para pet shops.",
      status: "coming_soon",
      is_public: true,
      trial_eligible: false,
      display_order: 5,
      admin_app_url: "https://app.pethub.navorbr.com",
      client_portal_url: "https://pethub.navorbr.com",
    });
  }

  const enrichedProducts = await Promise.all(list.map(async (prod: any) => {
    const { count: accountsCount } = await supabaseAdmin
      .from("accounts")
      .select("*", { count: 'exact', head: true })
      .eq("product_id", prod.id);

    return {
      ...prod,
      accounts_count: accountsCount || 0,
    };
  }));

  return enrichedProducts;
});

export const getAdminAccountsList = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select(`
      *,
      products (id, name, slug),
      subscriptions (
        id,
        status,
        amount,
        due_date,
        plan_id,
        plans (id, name, amount, product_id)
      ),
      account_modules (module_id)
    `)
    .order("created_at", { ascending: false });

  return accounts || [];
});

export const getAdminAccountDetail = createServerFn({ method: "GET" })
  .inputValidator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    const [accountRes, modulesRes, allModulesRes] = await Promise.all([
      supabaseAdmin
        .from("accounts")
        .select(`
          id, name, created_at, contact_email, contact_phone, document, responsible_name, whatsapp_number_limit, product_id, account_type, is_billable,
          products(id, name, slug),
          subscriptions (id, status, amount, due_date, plan_id, plans(id, name, amount, product_id, products(id, name, slug), plan_modules(system_modules(*))))
        `)
        .eq("id", data.accountId)
        .maybeSingle(),
      supabaseAdmin.from("account_modules").select("module_id, created_at").eq("account_id", data.accountId),
      supabaseAdmin.from("system_modules").select("*, products(name, slug)"),
    ]);

    if (accountRes.error) throw accountRes.error;
    const account = accountRes.data;
    const sub = account?.subscriptions
      ? Array.isArray(account.subscriptions)
        ? account.subscriptions[0]
        : account.subscriptions
      : null;

    let charges: any[] = [];
    if (sub?.id) {
      const { data: c } = await supabaseAdmin
        .from("subscription_charges")
        .select("*")
        .eq("subscription_id", sub.id)
        .order("created_at", { ascending: false });
      charges = c || [];
    }

    return {
      account,
      sub,
      accountModules: modulesRes.data || [],
      allModules: allModulesRes.data || [],
      charges,
    };
  });


export const getAdminPlansData = createServerFn({ method: "GET" })
  .inputValidator((data?: { productSlug?: string }) => data || {})
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    await ensureCanonicalProductsAndPetHub(supabaseAdmin);
    
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name, slug")
      .order("created_at", { ascending: true });

    let prodsList = products || [];
    if (!prodsList.some((p: any) => p.slug === "pethub")) {
      prodsList.push({ id: "pethub-canonical-temp", name: "PetHub", slug: "pethub" });
    }

    const targetSlug = data?.productSlug || "rephub";
    const currentProduct = prodsList.find((p: any) => p.slug === targetSlug);

    let modules: any[] = [];
    let plans: any[] = [];

    if (currentProduct?.id) {
      const { data: mods } = await supabaseAdmin
        .from("system_modules")
        .select("*, products(name, slug)")
        .eq("product_id", currentProduct.id)
        .order("name");
      modules = mods || [];

      const { data: pls } = await supabaseAdmin
        .from("plans")
        .select(`
          *,
          products (name, slug),
          plan_modules (module_id, system_modules (id, key, name))
        `)
        .eq("product_id", currentProduct.id)
        .order("amount");
      plans = pls || [];
    }

    return {
      products: prodsList,
      currentProduct: currentProduct || null,
      modules,
      plans,
    };
  });

export const getAdminDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  const [accountsRes, subsRes, settingsRes] = await Promise.all([
    supabaseAdmin.from("accounts").select("id, name, created_at, account_type, is_billable"),
    supabaseAdmin.from("subscriptions").select("account_id, status, amount, due_date"),
    supabaseAdmin.from("platform_settings").select("billing_alert_days").limit(1).maybeSingle(),
  ]);
  
  const allAccounts = accountsRes.data || [];
  // Excluir contas DEMO e NÃO FATURÁVEIS das métricas comerciais (MRR, ARR, inadimplência, conversão)
  const commercialAccounts = allAccounts.filter((a: any) => a.account_type !== 'demo' && a.is_billable !== false);
  const demoAccounts = allAccounts.filter((a: any) => a.account_type === 'demo' || a.is_billable === false);

  const commercialAccountIds = new Set(commercialAccounts.map((a: any) => a.id));
  const subscriptions = (subsRes.data || []).filter((s: any) => commercialAccountIds.has(s.account_id));
  const alertDays = settingsRes.data?.billing_alert_days || 5;
  
  const totalAccounts = commercialAccounts.length;
  const demoAccountsCount = demoAccounts.length;
  const activeAccounts = subscriptions.filter((s: any) => s.status === 'active' || s.status === 'trial').length;
  const mrr = subscriptions.filter((s: any) => s.status === 'active').reduce((acc: any, sub: any) => acc + Number(sub.amount || 0), 0);
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  let overdueAccounts = 0;
  let nearingAccounts = 0;
  
  subscriptions.forEach((sub: any) => {
    if (!sub.due_date || sub.status === 'suspended') return;
    const dueDate = new Date(sub.due_date);
    dueDate.setHours(0,0,0,0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0 && sub.status === 'active') {
      overdueAccounts++;
    } else if (diffDays >= 0 && diffDays <= alertDays && sub.status === 'active') {
      nearingAccounts++;
    }
  });
  
  const recent = [...commercialAccounts].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  return { totalAccounts, activeAccounts, overdueAccounts, nearingAccounts, mrr, recent, demoAccountsCount };
});

export const getAdminAnalyticsData = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  const [logsResult, accountsResult] = await Promise.all([
    supabaseAdmin
      .from("audit_logs")
      .select("id, description, created_at, account_id")
      .eq("entity_type", "page_view")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabaseAdmin.from("accounts").select("id, name, product_id, products(id, name, slug)"),
  ]);
  if (logsResult.error) throw logsResult.error;
  if (accountsResult.error) throw accountsResult.error;
  return { logs: logsResult.data || [], accounts: accountsResult.data || [] };
});

export const getAdminErrorLogs = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .eq("entity_type", "error")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
});

export const getAdminPlatformSettings = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || { billing_alert_days: 5 };
});

export const getAdminAccountOptions = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  const [plansResult, productsResult] = await Promise.all([
    supabaseAdmin.from("plans").select("*, products(id, name, slug)").order("amount"),
    supabaseAdmin.from("products").select("id, name, slug").order("name"),
  ]);
  if (plansResult.error) throw plansResult.error;
  if (productsResult.error) throw productsResult.error;
  return { plans: plansResult.data || [], products: productsResult.data || [] };
});

export const getAdminAiAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
});

/**
 * Define uma nova senha provisória para o administrador de uma conta assinante.
 * Se o login foi apagado, recria o login com o e-mail da conta e revincula.
 */
export const resetTenantPassword = createServerFn({ method: 'POST' })
  .inputValidator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();

  const { data: account } = await supabaseAdmin
    .from("accounts")
    .select("id, name, contact_email, products(slug)")
    .eq("id", data.accountId)
    .maybeSingle();
  if (!account) throw new Error("Conta não encontrada.");

  const { data: member } = await supabaseAdmin
    .from("account_members")
    .select("user_id")
    .eq("account_id", data.accountId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const product = Array.isArray(account.products) ? account.products[0] : account.products;
  const password = generateProvisionalPassword(product?.slug === "barberhub" ? "Barber" : "Navor");

  const applyProvisionalPassword = async (userId: string) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });
    if (!error) return;

    // Alguns registros legados podem ser lidos pelo banco, mas falhar no
    // carregamento interno do GoTrue. A RPC usa o mesmo hash suportado pelo
    // Supabase e preserva o UUID, perfil e todas as assinaturas do login.
    if (!/database error loading user/i.test(error.message || "")) {
      throw new Error(`Erro ao redefinir senha: ${error.message}`);
    }

    const { error: repairError } = await supabaseAdmin.rpc("reset_auth_password_safely", {
      target_user_id: userId,
      temporary_password: password,
    });
    if (repairError) {
      throw new Error(`Erro ao recuperar senha provisória: ${repairError.message}`);
    }
  };

  let authExists = false;
  if (member?.user_id) {
    const { data: existing, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
    if (lookupError) {
      // Vínculos antigos podem manter um UUID de auth.users que já não existe.
      // Não bloqueie o atendimento: o fluxo abaixo reencontra (ou recria) o login
      // pelo e-mail da conta e substitui o vínculo inválido.
      console.warn("[resetTenantPassword] Vínculo de autenticação inválido", {
        accountId: data.accountId,
        userId: member.user_id,
        error: lookupError.message,
      });
    } else {
      authExists = Boolean(existing?.user);
    }
  }

  if (authExists && member?.user_id) {
    await applyProvisionalPassword(member.user_id);
    return { success: true, password, recreated: false };
  }

  // Login ausente: recria a partir do e-mail da conta
  if (!account.contact_email)
    throw new Error("Esta conta não tem e-mail de acesso. Informe o e-mail antes de recriar o login.");

  const { describeEmailUsage } = await import("@/lib/usuarios.functions");
  const usage = await describeEmailUsage(supabaseAdmin, account.contact_email);

  let userId: string;
  if (usage.inUse && usage.userId) {
    userId = usage.userId;
    await applyProvisionalPassword(userId);
  } else {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: account.contact_email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Erro ao recriar login: ${error.message}`);
    userId = created.user.id;
  }

  if (member?.user_id !== userId) {
    const { error: unlinkError } = await supabaseAdmin
      .from("account_members")
      .delete()
      .eq("account_id", data.accountId)
      .eq("role", "admin");
    if (unlinkError) throw new Error(`Erro ao reparar vínculo de acesso: ${unlinkError.message}`);

    const { error: linkError } = await supabaseAdmin
      .from("account_members")
      .insert([{ account_id: data.accountId, user_id: userId, role: "admin" }]);
    if (linkError) throw new Error(`Erro ao recriar vínculo de acesso: ${linkError.message}`);
  }

  return { success: true, password, recreated: true };
});

export const sendRecoveryLink = createServerFn({ method: 'POST' })
  .inputValidator((data: { accountId: string; origin?: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();

    const { data: member } = await supabaseAdmin
      .from("account_members")
      .select("user_id")
      .eq("account_id", data.accountId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    let email: string | null = null;
    if (member?.user_id) {
      const { data: existing } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      email = existing?.user?.email ?? null;
    }
    if (!email) {
      const { data: account } = await supabaseAdmin
        .from("accounts")
        .select("contact_email")
        .eq("id", data.accountId)
        .maybeSingle();
      email = account?.contact_email ?? null;
    }
    if (!email) throw new Error("Esta conta não tem e-mail de acesso cadastrado.");

    const origin = data.origin || "https://navorbr.com";
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) throw new Error(`Erro ao enviar o link de redefinição: ${error.message}`);

    return { success: true, email };
  });

/** Altera o e-mail de acesso de uma conta assinante (cadastro + login). */
export const updateTenantEmail = createServerFn({ method: 'POST' })
  .inputValidator((data: { accountId: string; email: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
  const email = data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");

  const { data: account } = await supabaseAdmin
    .from("accounts")
    .select("id, contact_email")
    .eq("id", data.accountId)
    .maybeSingle();
  if (!account) throw new Error("Conta não encontrada.");
  if ((account.contact_email ?? "").toLowerCase() === email)
    return { success: true, notice: "O e-mail informado já é o e-mail atual da conta." };

  const { describeEmailUsage } = await import("@/lib/usuarios.functions");
  const usage = await describeEmailUsage(supabaseAdmin, email);
  if (usage.inUse) throw new Error(usage.message ?? "Este e-mail já está cadastrado.");

  const { data: member } = await supabaseAdmin
    .from("account_members")
    .select("user_id")
    .eq("account_id", data.accountId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (member?.user_id) {
    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
    if (existing?.user) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(member.user_id, {
        email,
        email_confirm: true,
      });
      if (error) throw new Error(`Erro ao atualizar o login: ${error.message}`);
    }
  }

  const { error: accErr } = await supabaseAdmin
    .from("accounts")
    .update({ contact_email: email })
    .eq("id", data.accountId);
  if (accErr) throw new Error(`Erro ao atualizar a conta: ${accErr.message}`);

  return { success: true, notice: null as string | null };
});


export const checkEmailSubscriptions = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  const email = (data.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { exists: false, accounts: [], message: null };
  }

  // Buscar todas as contas que utilizam este contact_email
  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select(`
      id,
      name,
      contact_email,
      product_id,
      products (id, name, slug),
      subscriptions (
        id,
        status,
        amount,
        due_date,
        plans (id, name, amount)
      )
    `)
    .ilike("contact_email", email);

  if (accounts && accounts.length > 0) {
    const summaryList = accounts.map((acc: any) => {
      const sub = Array.isArray(acc.subscriptions) ? acc.subscriptions[0] : acc.subscriptions;
      const prodName = acc.products?.name || (acc.product_id ? "Sistema NAVOR" : "RepHub");
      const prodSlug = acc.products?.slug || "rephub";
      const planName = sub?.plans?.name || "Plano personalizado";
      const amount = sub?.amount ? Number(sub.amount) : null;
      return {
        id: acc.id,
        name: acc.name,
        productSlug: prodSlug,
        productName: prodName,
        planName,
        amount,
        status: sub?.status || "active",
      };
    });

    const prodsFormatted = summaryList.map((a: any) => `"${a.name}" (${a.productName} - Plano: ${a.planName})`).join(", ");
    return {
      exists: true,
      accounts: summaryList,
      message: `Este e-mail já possui ${summaryList.length} assinatura(s) ativa(s): ${prodsFormatted}.`,
    };
  }

  // Verificar também se o e-mail existe em auth.users
  try {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
    const found = (list?.users ?? []).find((u: any) => (u.email || "").toLowerCase() === email);
    if (found) {
      return {
        exists: true,
        accounts: [],
        message: "Este e-mail já possui um login de acesso cadastrado na plataforma NAVOR.",
      };
    }
  } catch {}

  return { exists: false, accounts: [], message: null };
});

export const createTenantAccount = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  companyName: string;
  email: string;
  phone?: string;
  document?: string;
  responsibleName?: string;
  planId: string;
  productId?: string;
  amount: number;
  dueDate: string;
  allowMultipleSubscriptions?: boolean;
  accountType?: "customer" | "trial" | "beta" | "demo" | "internal";
  isBillable?: boolean;
}) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  // 1. Determina o produto antes de provisionar a identidade de acesso.
  let targetProductId = data.productId;
  if (!targetProductId && data.planId) {
    const { data: planData } = await supabaseAdmin
      .from("plans")
      .select("product_id")
      .eq("id", data.planId)
      .maybeSingle();
    targetProductId = planData?.product_id;
  }

  if (!targetProductId) {
    // Fallback to rephub if no product determined
    const { data: defaultProd } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("slug", "rephub")
      .maybeSingle();
    targetProductId = defaultProd?.id;
  }

  if (!targetProductId) throw new Error("Não foi possível identificar o produto da assinatura.");

  const { data: targetProduct } = await supabaseAdmin
    .from("products")
    .select("id, slug")
    .eq("id", targetProductId)
    .maybeSingle();
  if (!targetProduct?.slug) throw new Error("Produto da assinatura não encontrado.");

  // 2. Uma identidade de autenticação por produto: o mesmo e-mail pode ter
  // senhas independentes em produtos diferentes, sem duplicar o e-mail real.
  const normalizedEmail = data.email.trim().toLowerCase();
  const { data: identity } = await supabaseAdmin
    .from("product_login_identities")
    .select("auth_user_id")
    .eq("product_id", targetProductId)
    .eq("login_email", normalizedEmail)
    .maybeSingle();

  let userId: string;
  let createdNewUser = false;
  let createdIdentity = false;
  let reuseNotice: string | null = null;
  let provisionalPassword: string | null = null;

  if (identity?.auth_user_id) {
    userId = identity.auth_user_id;
    reuseNotice = `Nova assinatura vinculada ao acesso existente de ${data.email} para ${targetProduct.slug}.`;
  } else {
    provisionalPassword = generateProvisionalPassword(targetProduct.slug === "barberhub" ? "Barber" : "Navor");
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: productAuthEmail(targetProduct.slug, normalizedEmail),
      password: provisionalPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true, login_email: normalizedEmail, product_slug: targetProduct.slug },
    });
    if (userError || !userData?.user) throw new Error(`Erro ao criar acesso do produto: ${userError?.message}`);
    userId = userData.user.id;
    createdNewUser = true;

    const { error: identityError } = await supabaseAdmin.from("product_login_identities").insert({
      product_id: targetProductId,
      login_email: normalizedEmail,
      auth_user_id: userId,
    });
    if (identityError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Erro ao registrar acesso do produto: ${identityError.message}`);
    }
    createdIdentity = true;
  }

  // 2. Create Account
  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .insert([{ 
      name: data.companyName, 
      contact_email: data.email,
      contact_phone: data.phone || null,
      document: data.document || null,
      responsible_name: data.responsibleName || null,
      product_id: targetProductId,
      account_type: data.accountType || "customer",
      is_billable: data.isBillable !== undefined ? data.isBillable : (data.accountType === "demo" ? false : true),
    }])
    .select()
    .single();

  if (accountError || !account) {
    if (createdIdentity) await supabaseAdmin.from("product_login_identities").delete().eq("auth_user_id", userId);
    if (createdNewUser) await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(`Erro ao criar conta: ${accountError?.message}`);
  }

  // 3. Link User to Account
  const { error: memberError } = await supabaseAdmin.from("account_members").insert([
    { account_id: account.id, user_id: userId, role: "admin" }
  ]);
  if (memberError) {
    await supabaseAdmin.from("accounts").delete().eq("id", account.id);
    if (createdIdentity) await supabaseAdmin.from("product_login_identities").delete().eq("auth_user_id", userId);
    if (createdNewUser) await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(`Erro ao vincular o administrador da conta: ${memberError.message}`);
  }

  // 4. Create Subscription
  const { error: subscriptionError } = await supabaseAdmin.from("subscriptions").insert([
    { 
      account_id: account.id, 
      plan_id: data.planId, 
      status: "active",
      amount: data.amount,
      due_date: data.dueDate || null
    }
  ]);
  if (subscriptionError) {
    await supabaseAdmin.from("account_members").delete().eq("account_id", account.id);
    await supabaseAdmin.from("accounts").delete().eq("id", account.id);
    if (createdIdentity) await supabaseAdmin.from("product_login_identities").delete().eq("auth_user_id", userId);
    if (createdNewUser) await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(`Erro ao criar a assinatura: ${subscriptionError.message}`);
  }

  // 5. Apply the plan modules (blocks) to the account automatically
  const { data: planModules } = await supabaseAdmin
    .from("plan_modules")
    .select("module_id")
    .eq("plan_id", data.planId);

  if (planModules && planModules.length > 0) {
    await supabaseAdmin.from("account_modules").upsert(
      planModules.map((pm: any) => ({ account_id: account.id, module_id: pm.module_id })),
      { onConflict: "account_id,module_id" },
    );
  }


  return {
    success: true,
    accountId: account.id,
    userId,
    notice: reuseNotice,
    password: provisionalPassword,
  };
});

export const updateSubscriptionStatus = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  accountId: string;
  status: string;
}) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const validStatuses = ["pending_checkout", "trial", "active", "past_due", "grace_period", "suspended", "canceled", "expired"];
  if (!validStatuses.includes(data.status)) throw new Error("Status de assinatura inválido.");
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  const { error } = await supabaseAdmin.from("subscriptions").update({ status: data.status }).eq("account_id", data.accountId);
  if (error) throw new Error(error.message);
  return { success: true };
});

export const registerPayment = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  subscriptionId: string;
  amount: number;
  referenceMonth: string;
  notes?: string;
}) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  const { error } = await supabaseAdmin.from("subscription_charges").insert({ 
    subscription_id: data.subscriptionId,
    amount: data.amount,
    reference_month: data.referenceMonth,
    paid_at: new Date().toISOString(),
    notes: data.notes
  });
  
  if (error) throw new Error(error.message);
  
  await supabaseAdmin.from("subscriptions").update({ status: 'active' }).eq("id", data.subscriptionId).eq("status", "past_due");
  return { success: true };
});

export const createPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  name: string;
  description: string;
  amount: number;
  whatsappNumberLimit?: number;
  productId: string;
  modules: string[]; // array of module IDs
}) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  const { data: plan, error } = await supabaseAdmin.from("plans").insert({
    name: data.name,
    description: data.description,
    amount: data.amount,
    whatsapp_number_limit: data.whatsappNumberLimit ?? 3,
    product_id: data.productId
  }).select().single();

  if (error || !plan) throw new Error(error?.message || "Erro ao criar plano");

  if (data.modules && data.modules.length > 0) {
    const planModules = data.modules.map(modId => ({
      plan_id: plan.id,
      module_id: modId
    }));
    await supabaseAdmin.from("plan_modules").insert(planModules);
  }

  return { success: true };
});

export const updatePlan = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  id: string;
  name: string;
  description: string;
  amount: number;
  whatsappNumberLimit?: number;
  productId: string;
  modules: string[]; // array de IDs de módulos
}) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  const { error: updateError } = await supabaseAdmin
    .from("plans")
    .update({
      name: data.name,
      description: data.description,
      amount: data.amount,
      whatsapp_number_limit: data.whatsappNumberLimit ?? 3,
      product_id: data.productId,
    })
    .eq("id", data.id);

  if (updateError) throw new Error(updateError.message);

  // Atualiza módulos vinculados a este plano
  await supabaseAdmin.from("plan_modules").delete().eq("plan_id", data.id);

  if (data.modules && data.modules.length > 0) {
    const planModules = data.modules.map((modId) => ({
      plan_id: data.id,
      module_id: modId,
    }));
    await supabaseAdmin.from("plan_modules").insert(planModules);
  }

  return { success: true };
});

export const deletePlan = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  // 1. Verificar se existem assinaturas vinculadas a este plano
  const { data: subs, count } = await supabaseAdmin
    .from("subscriptions")
    .select("id, account_id, accounts(name)", { count: "exact" })
    .eq("plan_id", data.id);

  if (count && count > 0) {
    const sampleNames = (subs || [])
      .map((s: any) => s.accounts?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    throw new Error(
      `Não é possível excluir este plano pois existem ${count} assinatura(s) ativa(s) vinculada(s) a ele (${sampleNames}). Migre os assinantes para outro plano antes de excluir.`
    );
  }

  // 2. Remover vínculos em plan_modules
  await supabaseAdmin.from("plan_modules").delete().eq("plan_id", data.id);

  // 3. Excluir o plano
  const { error } = await supabaseAdmin.from("plans").delete().eq("id", data.id);
  if (error) throw new Error(error.message);

  return { success: true };
});

export const syncCanonicalProductsModulesPlans = createServerFn({ method: 'POST' })
  .inputValidator((data?: { systemSlug?: "lawhub" | "rephub" | "enghub" | "barberhub" | "pethub" | "all" }) => data || {})
  .handler(async ({ data }) => {
  await requireAdminSession();
  const targetSlug = data?.systemSlug || "all";
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  // 1. Assegurar os produtos que possuem catálogo oficial no banco.
  const defaultProducts = [
    { slug: "rephub", name: "Navor RepHub", description: "Sistema de CRM e gestão para representantes comerciais." },
    { slug: "enghub", name: "Navor EngHub", description: "Sistema completo de gestão empresarial e de obras para construção civil." },
    { slug: "lawhub", name: "Navor LawHub", description: "Sistema de gestão jurídica de alta performance para escritórios de advocacia, advogados autônomos e departamentos jurídicos." },
    { slug: "barberhub", name: "Navor BarberHub", description: "Gestão completa para barbearias: agenda, PDV, comissões, estoque e fidelidade." },
    { slug: "pethub", name: "PetHub", description: "Gestão integrada para pet shops, do caixa ao e-commerce." },
  ];

  for (const prod of defaultProducts) {
    await supabaseAdmin.from("products").upsert(
      { slug: prod.slug, name: prod.name, description: prod.description, status: "active" },
      { onConflict: "slug" }
    );
  }

  const { data: allProds } = await supabaseAdmin.from("products").select("id, slug");
  const prodMap = new Map((allProds || []).map((p: any) => [p.slug, p.id]));

  const lawhubId = prodMap.get("lawhub");
  const rephubId = prodMap.get("rephub");
  const enghubId = prodMap.get("enghub");
  const barberhubId = prodMap.get("barberhub");

  // Assegurar que planos legados pertençam ao RepHub
  if (rephubId) {
    await supabaseAdmin.from("plans").update({ product_id: rephubId }).in("name", ["Básico", "Completo", "RepHub Inicial", "RepHub Comercial Pro", "RepHub Enterprise AI"]);
    await supabaseAdmin.from("plans").update({ product_id: rephubId }).is("product_id", null);
  }

  // 2. Módulos canônicos do LawHub
  if (lawhubId && (targetSlug === "lawhub" || targetSlug === "all")) {
    const lawhubModules = [
      { key: "processos_casos", name: "Processos e Casos", description: "Sincronização automática de processos judiciais via OAB" },
      { key: "publicacoes_djen", name: "Publicações e Diários (DJEN)", description: "Captura de intimações nos diários com prazo fatal" },
      { key: "financeiro_juridico", name: "Financeiro & Honorários", description: "Separação de contas do escritório vs honorários de clientes" },
      { key: "ia_modelos", name: "Criação de Peças com IA", description: "Assistente inteligente para elaboração de petições e recursos" },
      { key: "jurisprudencia_ia", name: "Jurisprudência & Precedentes", description: "Pesquisa inteligente em tribunais estaduais e superiores" },
      { key: "agenda_audiencias", name: "Agenda & Audiências", description: "Controle de pautas, audiências virtuais e compromissos" },
      { key: "portal_cliente_juridico", name: "Portal do Cliente", description: "Área exclusiva para clientes acompanharem o processo" },
      { key: "equipe_escritorio", name: "Equipe & Associados", description: "Gestão de sócios, advogados associados e estagiários" },
      { key: "calculadora_juridica", name: "Calculadora Jurídica", description: "Cálculos judiciais, rescisórios, juros e demonstrativos" },
      { key: "atendimento_whatsapp", name: "CallCenter (WhatsApp & Filas)", description: "Central unificada de conversas CallCenter com setores, filas, triagem por Bot/IA e transferências" },
      { key: "atendimento_ia", name: "IA de Atendimento & Triagem", description: "Inteligência artificial para triagem em linguagem natural, qualificação e handoff" },
    ];

    for (const m of lawhubModules) {
      await supabaseAdmin.from("system_modules").upsert(
        { key: m.key, name: m.name, description: m.description, product_id: lawhubId, is_active: true },
        { onConflict: "key" }
      );
    }

    // Buscar IDs dos módulos do LawHub
    const { data: dbLawModules } = await supabaseAdmin.from("system_modules").select("id, key").eq("product_id", lawhubId);
    const modKeyMap = new Map((dbLawModules || []).map((m: any) => [m.key, m.id]));

    // Planos canônicos LawHub
    const defaultLawPlans = [
      {
        name: "LawHub Escritório Ágil",
        description: "Para advogados autônomos e pequenas bancas de advocacia",
        amount: 129.90,
        whatsapp_number_limit: 1,
        moduleKeys: ["processos_casos", "publicacoes_djen", "financeiro_juridico", "agenda_audiencias", "calculadora_juridica"],
      },
      {
        name: "LawHub Contencioso Pro",
        description: "Controle total do contencioso com IA Jurídica e Calculadora inclusa",
        amount: 249.90,
        whatsapp_number_limit: 3,
        moduleKeys: [
          "processos_casos",
          "publicacoes_djen",
          "financeiro_juridico",
          "ia_modelos",
          "jurisprudencia_ia",
          "agenda_audiencias",
          "calculadora_juridica",
          "atendimento_whatsapp",
        ],
      },
      {
        name: "LawHub Full Law Enterprise",
        description: "Ecossistema jurídico completo com Portal do Cliente, IA e suporte prioritário",
        amount: 449.90,
        whatsapp_number_limit: 5,
        moduleKeys: [
          "processos_casos",
          "publicacoes_djen",
          "financeiro_juridico",
          "ia_modelos",
          "jurisprudencia_ia",
          "agenda_audiencias",
          "portal_cliente_juridico",
          "equipe_escritorio",
          "calculadora_juridica",
          "atendimento_whatsapp",
          "atendimento_ia",
        ],
      },
    ];

    for (const lp of defaultLawPlans) {
      const { data: existingPlan } = await supabaseAdmin.from("plans").select("id").eq("name", lp.name).eq("product_id", lawhubId).maybeSingle();
      let planId = existingPlan?.id;
      if (!planId) {
        const { data: inserted } = await supabaseAdmin.from("plans").insert({
          name: lp.name,
          description: lp.description,
          amount: lp.amount,
          whatsapp_number_limit: lp.whatsapp_number_limit,
          product_id: lawhubId,
        }).select("id").single();
        planId = inserted?.id;
      }

      if (planId) {
        const planMods = lp.moduleKeys.map((k) => modKeyMap.get(k)).filter(Boolean).map((modId) => ({
          plan_id: planId,
          module_id: modId,
        }));
        await supabaseAdmin.from("plan_modules").upsert(planMods, { onConflict: "plan_id,module_id" });
      }
    }

    // Reparo Arthur Advogados
    const { data: arthurAcc } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .ilike("name", "%Arthur%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (arthurAcc) {
      await supabaseAdmin.from("accounts").update({ product_id: lawhubId }).eq("id", arthurAcc.id);
      const { data: defaultProPlan } = await supabaseAdmin.from("plans").select("id").eq("name", "LawHub Contencioso Pro").eq("product_id", lawhubId).maybeSingle();
      if (defaultProPlan) {
        await supabaseAdmin.from("subscriptions").update({ plan_id: defaultProPlan.id }).eq("account_id", arthurAcc.id);
      }
      // Associar módulos canônicos do LawHub
      const allLawModIds = (dbLawModules || []).map((m: any) => ({
        account_id: arthurAcc.id,
        module_id: m.id,
      }));
      if (allLawModIds.length > 0) {
        await supabaseAdmin.from("account_modules").delete().eq("account_id", arthurAcc.id);
        await supabaseAdmin.from("account_modules").insert(allLawModIds);
      }
    }
  }

  if (barberhubId && (targetSlug === "barberhub" || targetSlug === "all")) {
    const barberModules = [
      { key: "agenda_profissionais", name: "Agenda e Profissionais", description: "Agenda por profissional, serviços e disponibilidade." },
      { key: "pdv_comandas", name: "PDV e Comandas", description: "Abertura, lançamentos e fechamento de comandas." },
      { key: "comissoes_barbeiros", name: "Comissões", description: "Cálculo e acompanhamento de comissões da equipe." },
      { key: "estoque_insumos", name: "Estoque e Insumos", description: "Controle de produtos, insumos e reposição." },
      { key: "fidelidade_clientes", name: "Fidelidade e Clientes", description: "Cadastro, histórico e programa de fidelidade." },
    ];
    for (const module of barberModules) {
      const { error } = await supabaseAdmin.from("system_modules").upsert(
        { ...module, product_id: barberhubId, is_active: true },
        { onConflict: "key" },
      );
      if (error) throw new Error(`Erro ao sincronizar módulo do BarberHub: ${error.message}`);
    }

    const { data: dbModules, error: modulesError } = await supabaseAdmin
      .from("system_modules").select("id, key").eq("product_id", barberhubId);
    if (modulesError) throw new Error(`Erro ao carregar módulos do BarberHub: ${modulesError.message}`);
    const idsByKey = new Map((dbModules || []).map((module: any) => [module.key, module.id]));
    const barberPlans = [
      { name: "BarberHub Essencial", description: "Agenda, clientes e operação da barbearia.", amount: 149.9, whatsapp_number_limit: 1, moduleKeys: ["agenda_profissionais", "pdv_comandas", "fidelidade_clientes"] },
      { name: "BarberHub Elite & Redes", description: "Gestão completa com PDV, comissões, estoque e fidelidade.", amount: 299.9, whatsapp_number_limit: 1, moduleKeys: barberModules.map((module) => module.key) },
    ];
    for (const plan of barberPlans) {
      const { data: existing } = await supabaseAdmin.from("plans").select("id").eq("name", plan.name).eq("product_id", barberhubId).maybeSingle();
      let planId = existing?.id;
      if (!planId) {
        const { data: created, error } = await supabaseAdmin.from("plans").insert({
          name: plan.name, description: plan.description, amount: plan.amount,
          whatsapp_number_limit: plan.whatsapp_number_limit, product_id: barberhubId,
        }).select("id").single();
        if (error) throw new Error(`Erro ao criar plano do BarberHub: ${error.message}`);
        planId = created.id;
      }
      const rows = plan.moduleKeys.map((key) => idsByKey.get(key)).filter(Boolean).map((module_id) => ({ plan_id: planId, module_id }));
      if (rows.length) {
        const { error } = await supabaseAdmin.from("plan_modules").upsert(rows, { onConflict: "plan_id,module_id" });
        if (error) throw new Error(`Erro ao vincular módulos ao plano do BarberHub: ${error.message}`);
      }
    }
  }

    const pethubId = prodMap.get("pethub");
  if (pethubId && (targetSlug === "pethub" || targetSlug === "all")) {
    const pethubModules = [
      { key: "pdv_frente_caixa", name: "PDV e Frente de Caixa", description: "Frente de caixa rápida, vendas, comandas e sangrias" },
      { key: "fiscal", name: "Fiscal", description: "Emissão de NFC-e, NF-e, contingência offline e transmissão" },
      { key: "estoque_compras", name: "Estoque e Compras", description: "Controle de estoque por loja, saldo mínimo, perdas e inventário" },
      { key: "importacao_xml", name: "Importação de XML", description: "Entrada de notas fiscais por XML, vínculo de fornecedor e custo" },
      { key: "agenda_banho_tosa", name: "Agenda, Banho e Tosa", description: "Grade de horários por profissional, baia e status de atendimento" },
      { key: "clientes_pets_fidelidade", name: "Clientes, Pets e Fidelidade", description: "Ficha cadastral do pet, carteira de vacinas e programa de fidelidade" },
      { key: "financeiro", name: "Financeiro", description: "Contas a pagar, a receber, fluxo de caixa e conciliação bancária" },
      { key: "funcionarios_permissoes", name: "Funcionários e Permissões", description: "Gestão de equipes, comissões e permissões granulares por cargo" },
      { key: "multilojas_franquias", name: "Multi-lojas e Franquias", description: "Visão unificada da rede, tabelas centralizadas e estoques independentes" },
      { key: "site_institucional", name: "Site Institucional", description: "Site público e institucional para cada unidade" },
      { key: "ecommerce", name: "E-commerce", description: "Loja virtual integrada com reserva de estoque e checkout" },
      { key: "whatsapp_comunicacao", name: "WhatsApp e Comunicação", description: "Notificações de atendimento, aviso de pet pronto e lembretes de vacina" },
      { key: "taxi_dog", name: "Taxi Dog", description: "Agendamento e rotas de transporte e busca de animais" },
      { key: "hotel_creche", name: "Hotel e Creche", description: "Controle de diárias, baias, medicação e check-in/out de hospedagem" },
      { key: "clinica_veterinaria", name: "Clínica Veterinária", description: "Prontuário veterinário, anamnese, receituário e exames" },
    ];
    for (const module of pethubModules) {
      const { error } = await supabaseAdmin.from("system_modules").upsert(
        { ...module, product_id: pethubId, is_active: true },
        { onConflict: "key" },
      );
      if (error) throw new Error(`Erro ao sincronizar módulo do PetHub: ${error.message}`);
    }

    const { data: dbModules, error: modulesError } = await supabaseAdmin
      .from("system_modules").select("id, key").eq("product_id", pethubId);
    if (modulesError) throw new Error(`Erro ao carregar módulos do PetHub: ${modulesError.message}`);
    const idsByKey = new Map((dbModules || []).map((module: any) => [module.key, module.id]));
    const pethubPlans = [
      { name: "Pet Gestão", description: "Gestão física sem e-commerce.", amount: 149.9, whatsapp_number_limit: 1, moduleKeys: ["pdv_frente_caixa", "fiscal", "estoque_compras", "importacao_xml", "agenda_banho_tosa", "clientes_pets_fidelidade", "financeiro", "funcionarios_permissoes", "whatsapp_comunicacao"] },
      { name: "Pet Gestão + E-commerce", description: "Gestão física com site e loja virtual integrada.", amount: 279.9, whatsapp_number_limit: 2, moduleKeys: ["pdv_frente_caixa", "fiscal", "estoque_compras", "importacao_xml", "agenda_banho_tosa", "clientes_pets_fidelidade", "financeiro", "funcionarios_permissoes", "whatsapp_comunicacao", "site_institucional", "ecommerce", "clinica_veterinaria"] },
      { name: "Rede Pet", description: "Multi-lojas e franquias, com visão consolidada.", amount: 499.9, whatsapp_number_limit: 5, moduleKeys: pethubModules.map((m) => m.key) },
    ];
    for (const plan of pethubPlans) {
      const { data: existing } = await supabaseAdmin.from("plans").select("id").eq("name", plan.name).eq("product_id", pethubId).maybeSingle();
      let planId = existing?.id;
      if (!planId) {
        const { data: created, error } = await supabaseAdmin.from("plans").insert({
          name: plan.name, description: plan.description, amount: plan.amount,
          whatsapp_number_limit: plan.whatsapp_number_limit, product_id: pethubId,
          is_active: false, is_public: false, trial_eligible: false,
        }).select("id").single();
        if (error) throw new Error(`Erro ao criar plano do PetHub: ${error.message}`);
        planId = created.id;
      }
      const rows = plan.moduleKeys.map((key) => idsByKey.get(key)).filter(Boolean).map((module_id) => ({ plan_id: planId, module_id }));
      if (rows.length) {
        const { error } = await supabaseAdmin.from("plan_modules").upsert(rows, { onConflict: "plan_id,module_id" });
        if (error) throw new Error(`Erro ao vincular módulos ao plano do PetHub: ${error.message}`);
      }
    }
  }

  return { success: true };
});

export const createSystemModule = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  key: string;
  name: string;
  description: string;
  productId: string;
}) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  const { error } = await supabaseAdmin.from("system_modules").insert({
    key: data.key,
    name: data.name,
    description: data.description,
    product_id: data.productId,
    is_active: true
  });

  if (error) throw new Error(error.message);
  return { success: true };
});

export const rolloutModule = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  moduleId: string;
  releaseNotes: string;
}) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  const { error: rolloutError } = await supabaseAdmin.from("feature_rollouts").insert({
    module_id: data.moduleId,
    release_notes: data.releaseNotes
  });
  if (rolloutError) throw new Error(rolloutError.message);

  const { data: planModules } = await supabaseAdmin.from("plan_modules").select("plan_id").eq("module_id", data.moduleId);
  if (!planModules || planModules.length === 0) return { success: true, count: 0 };
  
  const planIds = planModules.map((pm: any) => pm.plan_id);
  const { data: subs } = await supabaseAdmin.from("subscriptions").select("account_id").in("plan_id", planIds);
  if (!subs || subs.length === 0) return { success: true, count: 0 };

  const accountIds = subs.map((s: any) => s.account_id);
  const accountModules = accountIds.map((accId: any) => ({
    account_id: accId,
    module_id: data.moduleId
  }));

  const { error: accModError } = await supabaseAdmin.from("account_modules").upsert(accountModules, { onConflict: 'account_id,module_id' });
  if (accModError) throw new Error(accModError.message);

  return { success: true, count: accountIds.length };
});

export const updatePlatformSettings = createServerFn({ method: 'POST' })
  .inputValidator((data: {
  billingAlertDays: number;
}) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

  const { data: settings } = await supabaseAdmin.from("platform_settings").select("id").limit(1).single();
  if (settings) {
    await supabaseAdmin.from("platform_settings").update({ billing_alert_days: data.billingAlertDays }).eq("id", settings.id);
  } else {
    await supabaseAdmin.from("platform_settings").insert({ billing_alert_days: data.billingAlertDays });
  }

  return { success: true };
});

export const updateTenantAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { 
    accountId: string; 
    newName: string;
    document?: string;
    responsibleName?: string;
    phone?: string;
    email?: string;
    dueDate?: string;
    amount?: number;
    planId?: string;
    whatsappNumberLimit?: number | null;
    productId?: string;
    syncModules?: boolean;
    accountType?: "customer" | "trial" | "beta" | "demo" | "internal";
    isBillable?: boolean;
  }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    
    // 1. Atualizar dados cadastrais e produto da conta
    const { error: accErr } = await supabaseAdmin
      .from("accounts")
      .update({ 
        name: data.newName,
        document: data.document || null,
        responsible_name: data.responsibleName || null,
        contact_phone: data.phone || null,
        contact_email: data.email || null,
        whatsapp_number_limit: data.whatsappNumberLimit !== undefined ? data.whatsappNumberLimit : null,
        ...(data.productId && { product_id: data.productId }),
        ...(data.accountType && { account_type: data.accountType }),
        ...(data.isBillable !== undefined && { is_billable: data.isBillable })
      })
      .eq("id", data.accountId);
      
    if (accErr) throw new Error(`Erro ao atualizar conta: ${accErr.message}`);
    
    // 2. Atualizar ou vincular assinatura (plano, valor e vencimento)
    const { data: existingSub, error: existingSubError } = await supabaseAdmin
      .from("subscriptions")
      .select("id, plan_id, amount, due_date")
      .eq("account_id", data.accountId)
      .maybeSingle();
    if (existingSubError) throw new Error(`Erro ao consultar assinatura: ${existingSubError.message}`);

    if (data.planId) {
      const { error: atomicPlanError } = await (supabaseAdmin as any).rpc("set_subscription_plan_and_modules", {
        p_account_id: data.accountId,
        p_plan_id: data.planId,
        p_amount: data.amount ?? null,
        p_due_date: data.dueDate || null,
      });
      if (atomicPlanError) throw new Error(`Erro ao atualizar plano e módulos: ${atomicPlanError.message}`);
    } else if (existingSub) {
      const subUpdate: any = {};
      if (data.dueDate !== undefined) subUpdate.due_date = data.dueDate || null;
      if (data.amount !== undefined) subUpdate.amount = data.amount;

      if (Object.keys(subUpdate).length > 0) {
        const { error: subscriptionUpdateError } = await supabaseAdmin
          .from("subscriptions")
          .update(subUpdate)
          .eq("id", existingSub.id);
        if (subscriptionUpdateError) throw new Error(`Erro ao atualizar assinatura: ${subscriptionUpdateError.message}`);
      }
    }
    
    // 3. Sincronizar módulos sem troca de plano, quando solicitado.
    if (data.syncModules && !data.planId && existingSub?.plan_id) {
      const { error: reconcileError } = await (supabaseAdmin as any).rpc("reconcile_account_modules", {
        p_account_id: data.accountId,
        p_plan_id: existingSub.plan_id,
      });
      if (reconcileError) throw new Error(`Erro ao sincronizar módulos: ${reconcileError.message}`);
    }

    // 4. Sincroniza o e-mail de acesso (login) quando ele muda
    let loginUpdated = false;
    if (data.email) {
      const { data: member } = await supabaseAdmin
        .from("account_members")
        .select("user_id")
        .eq("account_id", data.accountId)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      if (member?.user_id) {
        const { data: existing } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
        const currentEmail = existing?.user?.email ?? "";
        if (currentEmail.toLowerCase() !== data.email.toLowerCase()) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const taken = (list?.users || []).find(
            (u: any) => u.email?.toLowerCase() === data.email!.toLowerCase() && u.id !== member.user_id,
          );
          if (taken) throw new Error("Este e-mail já está em uso por outro login do sistema.");

          const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(member.user_id, {
            email: data.email,
            email_confirm: true,
          });
          if (authErr) throw new Error(`Erro ao atualizar o e-mail de acesso: ${authErr.message}`);
          await supabaseAdmin.from("profiles").update({ email: data.email }).eq("id", member.user_id);
          loginUpdated = true;
        }
      }
    }

    return { success: true, loginUpdated };
  });

/**
 * Sincroniza os módulos da conta com os módulos do produto ou plano selecionado.
 * Limpa módulos órfãos de outros produtos e garante a liberação correta.
 */
export const syncTenantModules = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string; productId: string; planId?: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();

    // 1. Atualizar o produto da conta caso divirja
    await supabaseAdmin
      .from("accounts")
      .update({ product_id: data.productId })
      .eq("id", data.accountId);

    // 2. Localizar módulos do plano ou do produto
    if (data.planId) {
      const { error: reconcileError } = await (supabaseAdmin as any).rpc("reconcile_account_modules", {
        p_account_id: data.accountId,
        p_plan_id: data.planId,
      });
      if (reconcileError) throw new Error(`Erro ao sincronizar módulos: ${reconcileError.message}`);
      return { success: true, count: 0 };
    }

    let moduleIds: string[] = [];

    if (moduleIds.length === 0) {
      const { data: pModules } = await supabaseAdmin
        .from("system_modules")
        .select("id")
        .eq("product_id", data.productId);
      moduleIds = (pModules || []).map((m: any) => m.id);
    }

    // 3. Limpa módulos antigos da conta e recria com os novos
    await supabaseAdmin.from("account_modules").delete().eq("account_id", data.accountId);

    const rows = moduleIds.map((mid) => ({
      account_id: data.accountId,
      module_id: mid,
    }));

    const { error: insertErr } = await supabaseAdmin
      .from("account_modules")
      .upsert(rows, { onConflict: "account_id,module_id" });

    if (insertErr) throw new Error(`Erro ao sincronizar módulos: ${insertErr.message}`);

    return { success: true, count: moduleIds.length };
  });

/**
 * Ativa ou desativa individualmente um módulo para uma conta assinante.
 */
export const toggleAccountModule = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string; moduleId: string; active: boolean }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();

    if (data.active) {
      await supabaseAdmin.from("account_modules").upsert(
        { account_id: data.accountId, module_id: data.moduleId },
        { onConflict: "account_id,module_id" }
      );
    } else {
      await supabaseAdmin
        .from("account_modules")
        .delete()
        .eq("account_id", data.accountId)
        .eq("module_id", data.moduleId);
    }

    return { success: true };
  });


/**
 * Consulta histórico e métricas de consumo de IA Lovable por conta assinante e por sistema específico.
 */
export const getAccountAiUsage = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string; days?: number; system?: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    const days = data.days || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      // 1. Identificar o produto e dados do assinante da conta
      const { data: acc } = await supabaseAdmin
        .from("accounts")
        .select("id, name, contact_email, responsible_name, product_id, products(id, slug, name)")
        .eq("id", data.accountId)
        .maybeSingle();

      const accountSystem = data.system || acc?.products?.slug || "rephub";
      const systemName = acc?.products?.name || (accountSystem === "lawhub" ? "Navor LawHub" : accountSystem === "enghub" ? "Navor EngHub" : "Navor RepHub");
      const clientDisplayName = acc?.responsible_name || acc?.name || acc?.contact_email || "Assinante";

      // 2. Buscar registros em ai_usage_logs ESTRITAMENTE para esta conta e este sistema
      let { data: logs, error } = await supabaseAdmin
        .from("ai_usage_logs")
        .select("*")
        .eq("account_id", data.accountId)
        .eq("system", accountSystem)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      // Se não houver logs (ex: RepHub sem uso de IA ou EngHub sem uso):
      if (!logs || logs.length === 0) {
        return {
          logs: [],
          system: accountSystem,
          systemName,
          clientName: clientDisplayName,
          summary: {
            totalCalls: 0,
            totalCredits: 0,
            totalTokens: 0,
            totalCostUsd: 0,
            totalCostBrl: 0,
            periodDays: days,
          },
          isSimulated: false,
        };
      }

      const totalCredits = logs.reduce((acc: number, l: any) => acc + Number(l.lovable_credits || 0), 0);
      const totalTokens = logs.reduce((acc: number, l: any) => acc + Number(l.total_tokens || 0), 0);
      const totalCostUsd = logs.reduce((acc: number, l: any) => acc + Number(l.cost_usd || 0), 0);

      return {
        logs,
        system: accountSystem,
        systemName,
        clientName: clientDisplayName,
        summary: {
          totalCalls: logs.length,
          totalCredits: Number(totalCredits.toFixed(2)),
          totalTokens,
          totalCostUsd: Number(totalCostUsd.toFixed(4)),
          totalCostBrl: Number((totalCostUsd * 5.65).toFixed(2)),
          periodDays: days,
        },
        isSimulated: false,
      };
    } catch {
      return {
        logs: [],
        system: "rephub",
        systemName: "Navor RepHub",
        clientName: "Assinante",
        summary: {
          totalCalls: 0,
          totalCredits: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          totalCostBrl: 0,
          periodDays: days,
        },
        isSimulated: false,
      };
    }
  });

/**
 * Sincroniza e consolida o histórico de uso de IA no banco de dados para a conta e sistema selecionados.
 */
export const syncAccountAiUsage = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string; system?: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();

    const { data: acc } = await supabaseAdmin
      .from("accounts")
      .select("id, name, contact_email, responsible_name, product_id, products(id, slug, name)")
      .eq("id", data.accountId)
      .maybeSingle();

    const accountSystem = data.system || acc?.products?.slug || "rephub";
    const clientDisplayName = acc?.responsible_name || acc?.name || acc?.contact_email || "Assinante";

    return { success: true, system: accountSystem };
  });

/**
 * Registra uma chamada de IA jurídica em tempo real no banco Supabase.
 */
export const recordLawHubAiCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    accountId?: string;
    feature: string;
    featureLabel: string;
    promptTokens?: number;
    completionTokens?: number;
    model?: string;
  }) => data)
  .handler(async ({ data, context }) => {
    const { requireAuthenticatedAccount } = await import("@/lib/security/authorization.server");
    const { accountId } = await requireAuthenticatedAccount(context.userId, data.accountId);

    const pTokens = Math.max(0, data.promptTokens ?? 0);
    const cTokens = Math.max(0, data.completionTokens ?? 0);
    const tTokens = pTokens + cTokens;
    const credits = Number((tTokens / 1000).toFixed(2));
    const costUsd = Number((tTokens * 0.000003).toFixed(5));

    try {
      await (serviceSupabase as any).from("ai_usage_logs").insert({
        account_id: accountId,
        system: "lawhub",
        feature: data.feature,
        feature_label: data.featureLabel,
        model: data.model || "não informado",
        prompt_tokens: pTokens,
        completion_tokens: cTokens,
        total_tokens: tTokens,
        lovable_credits: credits,
        cost_usd: costUsd,
      });
    } catch {}

    return { success: true, credits };
  });

/**
 * Registra dados de consumo de IA para testes ou auditoria vinculados estritamente à conta e sistema correto.
 */
export const seedAccountAiUsage = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string; system?: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();

    const { data: acc } = await supabaseAdmin
      .from("accounts")
      .select("id, name, contact_email, responsible_name, product_id, products(slug, name)")
      .eq("id", data.accountId)
      .maybeSingle();

    if (!acc) throw new Error("Conta não encontrada");

    const system = data.system || acc.products?.slug || "rephub";
    const clientName = acc.responsible_name || acc.name || acc.contact_email || "Assinante";

    // Cria amostras personalizadas de acordo com o sistema específico da conta
    const rephubSamples = [
      {
        feature: "whatsapp_crm_bot",
        feature_label: "Assistente WhatsApp CRM: Follow-up Automático de Pedido",
        model: "gemini-1.5-flash (Lovable Gateway)",
        prompt_tokens: 850,
        completion_tokens: 280,
        total_tokens: 1130,
        lovable_credits: 0.55,
        cost_usd: 0.0015,
        created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        feature: "proposta_comercial_ia",
        feature_label: "Geração de Proposta Comercial Inteligente",
        model: "gemini-1.5-pro (Lovable Gateway)",
        prompt_tokens: 1600,
        completion_tokens: 720,
        total_tokens: 2320,
        lovable_credits: 2.32,
        cost_usd: 0.007,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      },
      {
        feature: "analise_cliente_crm",
        feature_label: "Diagnóstico de Perfil de Cliente & Histórico de Compras",
        model: "gemini-1.5-flash (Lovable Gateway)",
        prompt_tokens: 1100,
        completion_tokens: 390,
        total_tokens: 1490,
        lovable_credits: 0.74,
        cost_usd: 0.002,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      },
    ];

    const lawhubSamples = [
      {
        feature: "criacao_pecas",
        feature_label: "Minuta de Petição Inicial Cível",
        model: "gemini-1.5-pro (Lovable Gateway)",
        prompt_tokens: 2100,
        completion_tokens: 950,
        total_tokens: 3050,
        lovable_credits: 3.05,
        cost_usd: 0.009,
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        feature: "jurisprudencia_ia",
        feature_label: "Pesquisa STJ: Tema Repetitivo 1.010",
        model: "gemini-1.5-flash (Lovable Gateway)",
        prompt_tokens: 1300,
        completion_tokens: 420,
        total_tokens: 1720,
        lovable_credits: 0.86,
        cost_usd: 0.0022,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      },
      {
        feature: "calculadora_juridica",
        feature_label: "Memória de Cálculo: Liquidação Trabalhista",
        model: "gemini-1.5-pro (Lovable Gateway)",
        prompt_tokens: 1150,
        completion_tokens: 480,
        total_tokens: 1630,
        lovable_credits: 1.63,
        cost_usd: 0.005,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
      },
    ];

    const enghubSamples = [
      {
        feature: "orcamento_obras_ia",
        feature_label: "Estimativa Paramétrica de Custo de Obra Residencial",
        model: "gemini-1.5-pro (Lovable Gateway)",
        prompt_tokens: 1900,
        completion_tokens: 880,
        total_tokens: 2780,
        lovable_credits: 2.78,
        cost_usd: 0.0085,
        created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      },
      {
        feature: "diario_obras_ia",
        feature_label: "Resumo Inteligente de Diário de Obras Semanal",
        model: "gemini-1.5-flash (Lovable Gateway)",
        prompt_tokens: 1050,
        completion_tokens: 350,
        total_tokens: 1400,
        lovable_credits: 0.70,
        cost_usd: 0.0018,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      },
    ];

    const chosenSamples = system === "lawhub" ? lawhubSamples : system === "enghub" ? enghubSamples : rephubSamples;

    const rowsToInsert = chosenSamples.map((s) => ({
      account_id: data.accountId,
      user_name: clientName,
      system,
      feature: s.feature,
      feature_label: s.feature_label,
      model: s.model,
      prompt_tokens: s.prompt_tokens,
      completion_tokens: s.completion_tokens,
      total_tokens: s.total_tokens,
      lovable_credits: s.lovable_credits,
      cost_usd: s.cost_usd,
      created_at: s.created_at,
    }));

    try {
      await supabaseAdmin.from("ai_usage_logs").insert(rowsToInsert);
    } catch {
      // Caso a tabela ainda não exista fisicamente, o app não quebra
    }

    return { success: true, count: rowsToInsert.length, system };
  });

/**
 * Limpa o histórico de auditoria de IA para uma conta específica.
 */
export const clearAccountAiUsage = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    try {
      await supabaseAdmin.from("ai_usage_logs").delete().eq("account_id", data.accountId);
    } catch {}
    return { success: true };
  });

/**
 * Limpa todos os logs de erros da tabela audit_logs.
 */
export const clearAdminErrorLogs = createServerFn({ method: "POST" })
  .handler(async () => {
    await requireAdminSession();
    const supabaseAdmin = await requireAdminClient();
    const { error } = await supabaseAdmin
      .from("audit_logs")
      .delete()
      .eq("entity_type", "error");
    if (error) throw new Error(`Erro ao limpar logs: ${error.message}`);
    return { success: true };
  });

export const deleteTenantAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    
    // First fetch the admin user ID so we can potentially delete the auth user
    const { data: members } = await supabaseAdmin
      .from("account_members")
      .select("user_id, role")
      .eq("account_id", data.accountId);
      
    // Delete all linked records first to respect FK if cascade is not present
    await supabaseAdmin.from("account_modules").delete().eq("account_id", data.accountId);
    
    const { data: subs } = await supabaseAdmin.from("subscriptions").select("id").eq("account_id", data.accountId);
    if (subs && subs.length > 0) {
      const subIds = subs.map((s: {id: string}) => s.id);
      await supabaseAdmin.from("subscription_charges").delete().in("subscription_id", subIds);
      await supabaseAdmin.from("subscriptions").delete().eq("account_id", data.accountId);
    }
    
    await supabaseAdmin.from("account_members").delete().eq("account_id", data.accountId);
    
    // Finally delete the account
    const { error } = await supabaseAdmin.from("accounts").delete().eq("id", data.accountId);
    if (error) throw new Error(`Erro ao excluir conta: ${error.message}`);
    
    // Attempt to clean up auth users if they are only in this account
    if (members && members.length > 0) {
        for (const member of members) {
            if (member.user_id) {
                // Check if user belongs to any other account
                const { data: otherAccounts } = await supabaseAdmin
                  .from("account_members")
                  .select("id")
                  .eq("user_id", member.user_id)
                  .limit(1);
                  
                if (!otherAccounts || otherAccounts.length === 0) {
                    await supabaseAdmin.auth.admin.deleteUser(member.user_id);
                }
            }
        }
    }
    
    return { success: true };
  });

export const createProduct = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    name: string;
    slug: string;
    description: string;
    adminAppUrl?: string | null;
    clientPortalUrl?: string | null;
  }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    const adminAppUrl = normalizePublicProductUrl(data.adminAppUrl, "Acesso administrativo");
    const clientPortalUrl = normalizePublicProductUrl(data.clientPortalUrl, "Portal do cliente");
    
    const { error } = await supabaseAdmin.from("products").insert({
      name: data.name,
      slug: data.slug,
      description: data.description,
      admin_app_url: adminAppUrl,
      client_portal_url: clientPortalUrl,
      status: 'active'
    });
    
    if (error) throw new Error(`Erro ao criar produto: ${error.message}`);
    return { success: true };
  });

export const updateProduct = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    id: string;
    name: string;
    slug: string;
    description: string;
    status?: string;
    adminAppUrl?: string | null;
    clientPortalUrl?: string | null;
  }) => data)
  .handler(async ({ data }) => {
  const supabaseAdmin = await requireAdminClient();
    const adminAppUrl = normalizePublicProductUrl(data.adminAppUrl, "Acesso administrativo");
    const clientPortalUrl = normalizePublicProductUrl(data.clientPortalUrl, "Portal do cliente");
    
    const { error } = await supabaseAdmin.from("products").update({
      name: data.name,
      slug: data.slug,
      description: data.description,
      status: data.status || 'active',
      admin_app_url: adminAppUrl,
      client_portal_url: clientPortalUrl,
      updated_at: new Date().toISOString()
    }).eq("id", data.id);
    
    if (error) throw new Error(`Erro ao atualizar produto: ${error.message}`);
    return { success: true };
  });

export const deleteProduct = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const supabaseAdmin = await requireAdminClient();
    
    // 1. Verificar se tem contas associadas
    const { count: accCount } = await supabaseAdmin
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("product_id", data.id);
      
    if (accCount && accCount > 0) {
      throw new Error(`Não é possível excluir este produto pois existem ${accCount} empresa(s) vinculada(s) a ele.`);
    }

    // 2. Limpar módulos órfãos e planos vinculados
    await supabaseAdmin.from("system_modules").delete().eq("product_id", data.id);
    await supabaseAdmin.from("plans").delete().eq("product_id", data.id);

    // 3. Excluir o produto
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(`Erro ao excluir produto: ${error.message}`);
    
    return { success: true };
  });

export const updateMyPassword = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data, context }) => {
    // Requires standard authentication but doesn't require admin_unlocked cookie
    // because this is for the user to change their OWN password.
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
      user_metadata: { must_change_password: false },
    });

    if (error) throw new Error(`Erro ao atualizar senha: ${error.message}`);
    return { success: true };
  });

/**
 * Diagnóstico em tempo real da saúde das tabelas e produtos do banco Supabase.
 */
export const getDatabaseHealth = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireAdminSession();
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

    const checks: Array<{ name: string; status: "ok" | "warning" | "error"; details: string }> = [];

    // 1. Produtos
    const { data: prods, error: prodErr } = await supabaseAdmin.from("products").select("id, slug, name, status");
    if (prodErr) {
      checks.push({ name: "Tabela products", status: "error", details: `Falha: ${prodErr.message}` });
    } else {
      const slugs = (prods || []).map((p: any) => p.slug);
      const hasRep = slugs.includes("rephub");
      const hasEng = slugs.includes("enghub");
      const hasLaw = slugs.includes("lawhub");
      if (hasRep && hasEng && hasLaw) {
        checks.push({ name: "Produtos NAVOR", status: "ok", details: "Todos os 3 produtos cadastrados (RepHub, EngHub, LawHub)" });
      } else {
        checks.push({
          name: "Produtos NAVOR",
          status: "warning",
          details: `Faltando: ${[!hasRep && "rephub", !hasEng && "enghub", !hasLaw && "lawhub"].filter(Boolean).join(", ")}`,
        });
      }
    }

    // 2. Módulos
    const { data: mods, error: modErr } = await supabaseAdmin.from("system_modules").select("id, key, product_id");
    const lawProd = (prods || []).find((p: any) => p.slug === "lawhub");
    const lawMods = (mods || []).filter((m: any) => m.product_id === lawProd?.id);

    if (modErr) {
      checks.push({ name: "Tabela system_modules", status: "error", details: modErr.message });
    } else {
      checks.push({
        name: "Módulos do Sistema",
        status: lawMods.length >= 8 ? "ok" : "warning",
        details: `Total: ${mods?.length || 0} módulos cadastrados (${lawMods.length} vinculados ao LawHub)`,
      });
    }

    // 3. Planos
    const { data: plans, error: planErr } = await supabaseAdmin.from("plans").select("id, name, product_id, amount");
    const lawPlans = (plans || []).filter((p: any) => p.product_id === lawProd?.id);

    if (planErr) {
      checks.push({ name: "Tabela plans", status: "error", details: planErr.message });
    } else {
      checks.push({
        name: "Planos Comerciais",
        status: lawPlans.length >= 2 ? "ok" : "warning",
        details: `Total: ${plans?.length || 0} planos (${lawPlans.length} no LawHub)`,
      });
    }

    // 4. Contas
    const { data: accounts, error: accErr } = await supabaseAdmin.from("accounts").select("id, name, product_id, contact_email");
    const unassigned = (accounts || []).filter((a: any) => !a.product_id);

    if (accErr) {
      checks.push({ name: "Contas de Assinantes", status: "error", details: accErr.message });
    } else {
      checks.push({
        name: "Contas e Vínculos Multi-Tenant",
        status: unassigned.length === 0 ? "ok" : "warning",
        details: `${accounts?.length || 0} assinantes registrados (${unassigned.length} sem produto atribuído)`,
      });
    }

    // 5. Tabelas de suporte
    const { error: aiErr } = await supabaseAdmin.from("ai_usage_logs").select("id").limit(1);
    checks.push({
      name: "Tabela ai_usage_logs (Auditoria de IA)",
      status: aiErr && (aiErr.code === "42P01" || aiErr.message?.includes("does not exist")) ? "warning" : "ok",
      details: aiErr && (aiErr.code === "42P01" || aiErr.message?.includes("does not exist")) ? "Tabela aguardando criação ou primeira chamada" : "Tabela ativa e pronta para auditoria",
    });

    const { error: calcErr } = await supabaseAdmin.from("legal_calculations").select("id").limit(1);
    checks.push({
      name: "Tabela legal_calculations (Calculadora Jurídica)",
      status: calcErr && (calcErr.code === "42P01" || calcErr.message?.includes("does not exist")) ? "warning" : "ok",
      details: calcErr && (calcErr.code === "42P01" || calcErr.message?.includes("does not exist")) ? "Tabela aguardando criação ou primeiro cálculo" : "Tabela ativa e pronta",
    });

    return {
      success: true,
      checks,
      summary: {
        productsCount: prods?.length || 0,
        modulesCount: mods?.length || 0,
        plansCount: plans?.length || 0,
        accountsCount: accounts?.length || 0,
        unassignedAccounts: unassigned.length,
      },
    };
  });

/**
 * Auto-reparo e sincronização total do banco de dados em 1 clique.
 */
export const repairAndSyncDatabase = createServerFn({ method: "POST" })
  .handler(async () => {
  await requireAdminSession();
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

    const log: string[] = [];

    // 1. Sincronizar produtos canônicos
    const defaultProducts = [
      { slug: "rephub", name: "Navor RepHub", description: "Sistema de CRM e gestão para representantes comerciais." },
      { slug: "enghub", name: "Navor EngHub", description: "Sistema completo de gestão empresarial e de obras para construção civil." },
      { slug: "lawhub", name: "Navor LawHub", description: "Sistema de gestão jurídica de alta performance para escritórios de advocacia, advogados autônomos e departamentos jurídicos." },
      {
        slug: "pethub",
        name: "PetHub",
        description: "Gestão integrada para pet shops, do caixa ao e-commerce.",
        status: "coming_soon",
        is_public: true,
        trial_eligible: false,
        tag_line: "Gestão integrada para pet shops, do caixa ao e-commerce.",
        short_description: "Gestão integrada para pet shops, do caixa ao e-commerce.",
        target_audience: "Pet shops, clínicas veterinárias, centros de estética animal, daycare e hotéis pet.",
        benefits: [
          "PDV e frente de caixa com modo offline",
          "Agenda, banho e tosa e prontuário",
          "Estoque, XML e e-commerce integrado",
        ],
        display_order: 5,
        admin_app_url: "https://app.pethub.navorbr.com",
        client_portal_url: "https://pethub.navorbr.com",
      },
    ];

    for (const p of defaultProducts) {
      await supabaseAdmin.from("products").upsert(
        {
          slug: p.slug,
          name: p.name,
          description: p.description,
          status: p.status ?? "active",
          is_public: (p as any).is_public ?? true,
          trial_eligible: (p as any).trial_eligible ?? true,
          tag_line: (p as any).tag_line,
          short_description: (p as any).short_description,
          target_audience: (p as any).target_audience,
          benefits: (p as any).benefits,
          display_order: (p as any).display_order,
          admin_app_url: (p as any).admin_app_url,
          client_portal_url: (p as any).client_portal_url,
        },
        { onConflict: "slug" }
      );
    }
    log.push("Produtos RepHub, EngHub, LawHub e PetHub sincronizados.");

    const { data: allProds } = await supabaseAdmin.from("products").select("id, slug");
    const prodMap = new Map((allProds || []).map((p: any) => [p.slug, p.id]));
    const lawhubId = prodMap.get("lawhub");
    const rephubId = prodMap.get("rephub");
    const pethubId = prodMap.get("pethub");

    // 2. Módulos canônicos PetHub
    if (pethubId) {
      const pethubModules = [
        { key: "pdv_frente_caixa", name: "PDV e Frente de Caixa", description: "Frente de caixa rápida, vendas, comandas e sangrias" },
        { key: "fiscal", name: "Fiscal", description: "Emissão de NFC-e, NF-e, contingência offline e transmissão" },
        { key: "estoque_compras", name: "Estoque e Compras", description: "Controle de estoque por loja, saldo mínimo, perdas e inventário" },
        { key: "importacao_xml", name: "Importação de XML", description: "Entrada de notas fiscais por XML, vínculo de fornecedor e custo" },
        { key: "agenda_banho_tosa", name: "Agenda, Banho e Tosa", description: "Grade de horários por profissional, baia e status de atendimento" },
        { key: "clientes_pets_fidelidade", name: "Clientes, Pets e Fidelidade", description: "Ficha cadastral do pet, carteira de vacinas e programa de fidelidade" },
        { key: "financeiro", name: "Financeiro", description: "Contas a pagar, a receber, fluxo de caixa e conciliação bancária" },
        { key: "funcionarios_permissoes", name: "Funcionários e Permissões", description: "Gestão de equipes, comissões e permissões granulares por cargo" },
        { key: "multilojas_franquias", name: "Multi-lojas e Franquias", description: "Visão unificada da rede, tabelas centralizadas e estoques independentes" },
        { key: "site_institucional", name: "Site Institucional", description: "Site público e institucional para cada unidade" },
        { key: "ecommerce", name: "E-commerce", description: "Loja virtual integrada com reserva de estoque e checkout" },
        { key: "whatsapp_comunicacao", name: "WhatsApp e Comunicação", description: "Notificações de atendimento, aviso de pet pronto e lembretes de vacina" },
        { key: "taxi_dog", name: "Taxi Dog", description: "Agendamento e rotas de transporte e busca de animais" },
        { key: "hotel_creche", name: "Hotel e Creche", description: "Controle de diárias, baias, medicação e check-in/out de hospedagem" },
        { key: "clinica_veterinaria", name: "Clínica Veterinária", description: "Prontuário veterinário, anamnese, receituário e exames" },
      ];

      for (const m of pethubModules) {
        await supabaseAdmin.from("system_modules").upsert(
          { key: m.key, name: m.name, description: m.description, product_id: pethubId, is_active: true },
          { onConflict: "key" }
        );
      }
      log.push("15 módulos canônicos do PetHub cadastrados.");

      const { data: dbPetMods } = await supabaseAdmin.from("system_modules").select("id, key").eq("product_id", pethubId);
      const petModKeyMap = new Map((dbPetMods || []).map((m: any) => [m.key, m.id]));

      const defaultPetPlans = [
        {
          name: "Pet Gestão",
          description: "Gestão essencial para pet shops, banho e tosa e clínica",
          amount: 149.90,
          moduleKeys: ["pdv_frente_caixa", "fiscal", "estoque_compras", "importacao_xml", "agenda_banho_tosa", "clientes_pets_fidelidade", "financeiro", "funcionarios_permissoes", "whatsapp_comunicacao"],
        },
        {
          name: "Pet Gestão + E-commerce",
          description: "Gestão completa com loja virtual integrada e catálogo online",
          amount: 249.90,
          moduleKeys: ["pdv_frente_caixa", "fiscal", "estoque_compras", "importacao_xml", "agenda_banho_tosa", "clientes_pets_fidelidade", "financeiro", "funcionarios_permissoes", "whatsapp_comunicacao", "site_institucional", "ecommerce"],
        },
        {
          name: "Rede Pet",
          description: "Para redes de pet shops, franquias e operações avançadas",
          amount: 499.90,
          moduleKeys: [
            "pdv_frente_caixa", "fiscal", "estoque_compras", "importacao_xml",
            "agenda_banho_tosa", "clientes_pets_fidelidade", "financeiro", "funcionarios_permissoes",
            "multilojas_franquias", "site_institucional", "ecommerce", "whatsapp_comunicacao",
            "taxi_dog", "hotel_creche", "clinica_veterinaria"
          ],
        },
      ];

      for (const pp of defaultPetPlans) {
        const { data: existingPlan } = await supabaseAdmin.from("plans").select("id").eq("name", pp.name).eq("product_id", pethubId).maybeSingle();
        let planId = existingPlan?.id;
        if (!planId) {
          const { data: inserted } = await supabaseAdmin.from("plans").insert({
            name: pp.name,
            description: pp.description,
            amount: pp.amount,
            product_id: pethubId,
            is_active: true,
            is_public: true,
            trial_eligible: false,
          }).select("id").single();
          planId = inserted?.id;
        }

        if (planId) {
          const planMods = pp.moduleKeys.map((k) => petModKeyMap.get(k)).filter(Boolean).map((modId) => ({
            plan_id: planId,
            module_id: modId,
          }));
          if (planMods.length > 0) {
            await supabaseAdmin.from("plan_modules").upsert(planMods, { onConflict: "plan_id,module_id" });
          }
        }
      }
      log.push("3 planos canônicos do PetHub cadastrados.");
    }

    // 3. Módulos canônicos LawHub
    if (lawhubId) {
      const lawhubModules = [
        { key: "processos_casos", name: "Processos e Casos", description: "Sincronização automática de processos judiciais via OAB" },
        { key: "publicacoes_djen", name: "Publicações e Diários (DJEN)", description: "Captura de intimações nos diários com prazo fatal" },
        { key: "financeiro_juridico", name: "Financeiro & Honorários", description: "Separação de contas do escritório vs honorários de clientes" },
        { key: "ia_modelos", name: "Criação de Peças com IA", description: "Assistente inteligente para elaboração de petições e recursos" },
        { key: "jurisprudencia_ia", name: "Jurisprudência & Precedentes", description: "Pesquisa inteligente em tribunais estaduais e superiores" },
        { key: "agenda_audiencias", name: "Agenda & Audiências", description: "Controle de pautas, audiências virtuais e compromissos" },
        { key: "portal_cliente_juridico", name: "Portal do Cliente", description: "Área exclusiva para clientes acompanharem o processo" },
        { key: "equipe_escritorio", name: "Equipe & Associados", description: "Gestão de sócios, advogados associados e estagiários" },
        { key: "calculadora_juridica", name: "Calculadora Jurídica", description: "Cálculos judiciais, rescisórios, juros e demonstrativos" },
        { key: "atendimento_whatsapp", name: "CallCenter (WhatsApp & Filas)", description: "Central unificada de conversas CallCenter com setores, filas, triagem por Bot/IA e transferências" },
        { key: "atendimento_ia", name: "IA de Atendimento & Triagem", description: "Inteligência artificial para triagem em linguagem natural, qualificação e handoff" },
      ];

      for (const m of lawhubModules) {
        await supabaseAdmin.from("system_modules").upsert(
          { key: m.key, name: m.name, description: m.description, product_id: lawhubId, is_active: true },
          { onConflict: "key" }
        );
      }
      log.push("11 módulos canônicos do LawHub cadastrados.");

      // Planos LawHub
      const { data: dbLawMods } = await supabaseAdmin.from("system_modules").select("id, key").eq("product_id", lawhubId);
      const modKeyMap = new Map((dbLawMods || []).map((m: any) => [m.key, m.id]));

      const defaultLawPlans = [
        {
          name: "LawHub Escritório Ágil",
          description: "Para advogados autônomos e pequenas bancas de advocacia",
          amount: 129.90,
          whatsapp_number_limit: 1,
          moduleKeys: ["processos_casos", "publicacoes_djen", "financeiro_juridico", "agenda_audiencias", "calculadora_juridica"],
        },
        {
          name: "LawHub Contencioso Pro",
          description: "Controle total do contencioso com IA Jurídica e Calculadora inclusa",
          amount: 249.90,
          whatsapp_number_limit: 3,
          moduleKeys: [
            "processos_casos",
            "publicacoes_djen",
            "financeiro_juridico",
            "ia_modelos",
            "jurisprudencia_ia",
            "agenda_audiencias",
            "calculadora_juridica",
            "atendimento_whatsapp",
          ],
        },
        {
          name: "LawHub Full Law Enterprise",
          description: "Ecossistema jurídico completo com Portal do Cliente, IA e suporte prioritário",
          amount: 449.90,
          whatsapp_number_limit: 5,
          moduleKeys: [
            "processos_casos",
            "publicacoes_djen",
            "financeiro_juridico",
            "ia_modelos",
            "jurisprudencia_ia",
            "agenda_audiencias",
            "portal_cliente_juridico",
            "equipe_escritorio",
            "calculadora_juridica",
            "atendimento_whatsapp",
            "atendimento_ia",
          ],
        },
      ];

      for (const lp of defaultLawPlans) {
        const { data: existingPlan } = await supabaseAdmin.from("plans").select("id").eq("name", lp.name).eq("product_id", lawhubId).maybeSingle();
        let planId = existingPlan?.id;
        if (!planId) {
          const { data: inserted } = await supabaseAdmin.from("plans").insert({
            name: lp.name,
            description: lp.description,
            amount: lp.amount,
            whatsapp_number_limit: lp.whatsapp_number_limit,
            product_id: lawhubId,
          }).select("id").single();
          planId = inserted?.id;
        }

        if (planId) {
          const planMods = lp.moduleKeys.map((k) => modKeyMap.get(k)).filter(Boolean).map((modId) => ({
            plan_id: planId,
            module_id: modId,
          }));
          await supabaseAdmin.from("plan_modules").upsert(planMods, { onConflict: "plan_id,module_id" });
        }
      }
      log.push("Planos comerciais do LawHub alinhados.");

      // 3. Corrigir contas órfãs ou Arthur Advogados
      const { data: arthur } = await supabaseAdmin.from("accounts").select("id").ilike("name", "%Arthur%").limit(1).maybeSingle();
      if (arthur) {
        await supabaseAdmin.from("accounts").update({ product_id: lawhubId }).eq("id", arthur.id);
        const { data: proPlan } = await supabaseAdmin.from("plans").select("id").eq("name", "LawHub Contencioso Pro").eq("product_id", lawhubId).maybeSingle();
        if (proPlan) {
          await supabaseAdmin.from("subscriptions").update({ plan_id: proPlan.id }).eq("account_id", arthur.id);
        }
        const lawModIds = (dbLawMods || []).map((m: any) => ({
          account_id: arthur.id,
          module_id: m.id,
        }));
        await supabaseAdmin.from("account_modules").delete().eq("account_id", arthur.id);
        await supabaseAdmin.from("account_modules").insert(lawModIds);
        log.push("Conta Arthur Advogados reparada para LawHub com módulos jurídicos.");
      }

      // Reassociar contas com product_id nulo para RepHub por padrão
      if (rephubId) {
        await supabaseAdmin.from("accounts").update({ product_id: rephubId }).is("product_id", null);
        await supabaseAdmin.from("plans").update({ product_id: rephubId }).is("product_id", null);
        log.push("Contas e planos sem produto associados ao RepHub.");
      }

      // 4. Remover produto duplicado/fantasma 'Navor - LawHub' ou com slug contendo barra
      const { data: ghostProds } = await supabaseAdmin
        .from("products")
        .select("id, name, slug");

      for (const gp of ghostProds || []) {
        const isDuplicateLaw = (gp.slug?.includes("/") || gp.slug?.toUpperCase() === "/LAWHUB/" || gp.name === "Navor - LawHub") && gp.id !== lawhubId;
        if (isDuplicateLaw) {
          // Migra eventuais contas associadas para o lawhubId canônico
          await supabaseAdmin.from("accounts").update({ product_id: lawhubId }).eq("product_id", gp.id);
          await supabaseAdmin.from("system_modules").delete().eq("product_id", gp.id);
          await supabaseAdmin.from("plans").delete().eq("product_id", gp.id);
          await supabaseAdmin.from("products").delete().eq("id", gp.id);
          log.push(`Produto duplicado '${gp.name}' (${gp.slug}) removido com sucesso.`);
        }
      }

      // 5. Limpar erros antigos da tabela audit_logs para apagar a notificação vermelha
      try {
        await supabaseAdmin.from("audit_logs").delete().eq("entity_type", "error");
        log.push("Logs de erros anteriores limpos na base de dados.");
      } catch {}
    }

    return { success: true, log };
  });

/**
 * Consulta a lista de migrações do sistema e o status de presença das tabelas no Supabase.
 */
export const getMigrationsList = createServerFn({ method: "GET" })
  .handler(async () => {
  await requireAdminSession();
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

    // 1. Tentar ler histórico de execuções auditadas de migrações
    let historyRows: any[] = [];
    try {
      const { data: hist } = await supabaseAdmin
        .from("system_migrations_history")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(200);
      if (Array.isArray(hist)) historyRows = hist;
    } catch {}

    const historyByMigration: Record<string, any> = {};
    for (const h of historyRows) {
      if (!historyByMigration[h.migration_id]) {
        historyByMigration[h.migration_id] = h;
      }
    }

    // Checar presença das tabelas no banco para validação ativa
    const { error: aiErr } = await supabaseAdmin.from("ai_usage_logs").select("id").limit(1);
    const aiExists = !aiErr || !aiErr.message?.includes("does not exist");

    const { error: calcErr } = await supabaseAdmin.from("calculations").select("id").limit(1);
    const calcExists = !calcErr || !calcErr.message?.includes("does not exist");

    const { error: ruleErr } = await supabaseAdmin.from("legal_rules").select("id").limit(1);
    const rulesExist = !ruleErr || !ruleErr.message?.includes("does not exist");

    const { error: lawProcErr } = await supabaseAdmin.from("law_cases").select("id").limit(1);
    const lawCasesExist = !lawProcErr || !lawProcErr.message?.includes("does not exist");

    const { error: lawLeadsErr } = await supabaseAdmin.from("law_leads").select("id").limit(1);
    const lawLeadsExist = !lawLeadsErr || !lawLeadsErr.message?.includes("does not exist");

    const { error: lawFeeContractsErr } = await supabaseAdmin.from("law_fee_contracts").select("id").limit(1);
    const lawFeeContractsExist = !lawFeeContractsErr || !lawFeeContractsErr.message?.includes("does not exist");

    const { error: atendErr } = await supabaseAdmin.from("law_atendimento_settings").select("id").limit(1);
    const atendimentoExists = !atendErr || !atendErr.message?.includes("does not exist");

    const { error: futureErr } = await supabaseAdmin.from("law_lead_pipeline_stages").select("pipeline_id").limit(1);
    const futurePipeExists = !futureErr || (!futureErr.message?.includes("does not exist") && !futureErr.message?.includes("pipeline_id"));

    const { data: prods } = await supabaseAdmin.from("products").select("id, slug");
    const { data: mods } = await supabaseAdmin.from("system_modules").select("id");
    const { data: plans } = await supabaseAdmin.from("plans").select("id");
    const canonicalSynced = (prods?.length || 0) >= 3 && (mods?.length || 0) >= 9 && (plans?.length || 0) >= 3;

    // Checar se a função RPC exec_sql existe no Postgres
    let rpcSupported = false;
    try {
      const { error: rpcErr } = await supabaseAdmin.rpc("exec_sql", { sql_query: "SELECT 1;" });
      if (!rpcErr || !rpcErr.message?.includes("could not find function")) {
        rpcSupported = true;
      }
    } catch {
      rpcSupported = false;
    }

    const computeStatus = (migId: string, isDbActive: boolean) => {
      const record = historyByMigration[migId];
      if (record) {
        if (record.status === "COM ERRO") return "COM ERRO";
        if (record.status === "EXECUTADA") return "EXECUTADA";
        if (record.status === "INCOMPATIVEL") return "INCOMPATIVEL";
      }
      return isDbActive ? "EXECUTADA" : "PENDENTE";
    };

    const migrations = [
      {
        id: "20260926_create_lead_future_pipeline",
        title: "LawHub Dual Pipeline (Principal vs Futuros) & Auditoria",
        description: "Suporte a pipeline de Leads Futuros com agendamento obrigatório de retorno, etapas configuráveis, tabela de histórico de migrações e índices de alta performance.",
        applied: computeStatus("20260926_create_lead_future_pipeline", futurePipeExists) === "EXECUTADA",
        status: computeStatus("20260926_create_lead_future_pipeline", futurePipeExists),
        category: "Estrutura (DDL)",
        isNative: false,
        file: "supabase/migrations/20260926_create_lead_future_pipeline.sql",
        lastExecutedAt: historyByMigration["20260926_create_lead_future_pipeline"]?.executed_at || null,
        errorMessage: historyByMigration["20260926_create_lead_future_pipeline"]?.error_message || null,
        sqlSnippet: `-- Criação do histórico de migrações e expansão para Dual Pipeline (Leads Futuros)
CREATE TABLE IF NOT EXISTS public.system_migrations_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('EXECUTADA', 'PENDENTE', 'COM ERRO', 'INCOMPATIVEL', 'DESCONHECIDA')),
    executed_at timestamptz NOT NULL DEFAULT now(),
    executed_by text NOT NULL DEFAULT 'Administrador',
    execution_time_ms integer NOT NULL DEFAULT 0,
    error_message text,
    details jsonb DEFAULT '{}'::jsonb
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'law_lead_pipeline_stages' AND column_name = 'pipeline_id') THEN
        ALTER TABLE public.law_lead_pipeline_stages ADD COLUMN pipeline_id text NOT NULL DEFAULT 'pipe-principal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'law_leads' AND column_name = 'pipeline_id') THEN
        ALTER TABLE public.law_leads ADD COLUMN pipeline_id text NOT NULL DEFAULT 'pipe-principal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'law_leads' AND column_name = 'lead_type') THEN
        ALTER TABLE public.law_leads ADD COLUMN lead_type text NOT NULL DEFAULT 'imediato';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'law_leads' AND column_name = 'future_contact_date') THEN
        ALTER TABLE public.law_leads ADD COLUMN future_contact_date date;
    END IF;
END $$;`,
      },
      {
        id: "20260925211500_lawhub_atendimento_core",
        title: "LawHub Atendimento Omnichannel, Chat WhatsApp e Triagem",
        description: "Central unificada de conversas WhatsApp, triagem inteligente de leads, gestão de operadores, filas, histórico auditável de mensagens e vinculação de contatos ao CRM.",
        applied: computeStatus("20260925211500_lawhub_atendimento_core", atendimentoExists) === "EXECUTADA",
        status: computeStatus("20260925211500_lawhub_atendimento_core", atendimentoExists),
        category: "Estrutura (DDL)",
        isNative: false,
        file: "supabase/migrations/20260925211500_lawhub_atendimento_core.sql",
        lastExecutedAt: historyByMigration["20260925211500_lawhub_atendimento_core"]?.executed_at || null,
        errorMessage: historyByMigration["20260925211500_lawhub_atendimento_core"]?.error_message || null,
        sqlSnippet: `-- Criação das tabelas do Atendimento e WhatsApp
CREATE TABLE IF NOT EXISTS public.law_atendimento_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    business_hours jsonb DEFAULT '{"enabled": true, "start": "08:00", "end": "18:00", "days": [1,2,3,4,5]}'::jsonb,
    ai_triage_enabled boolean NOT NULL DEFAULT true,
    routing_mode text NOT NULL DEFAULT 'round_robin',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_atendimento_settings_account UNIQUE (account_id)
);
CREATE TABLE IF NOT EXISTS public.law_atendimento_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    remote_jid text NOT NULL,
    channel text NOT NULL DEFAULT 'whatsapp',
    contact_name text,
    contact_phone text,
    status text NOT NULL DEFAULT 'open',
    lead_id uuid REFERENCES public.law_leads(id) ON DELETE SET NULL,
    campaign_code text,
    traffic_source text,
    created_at timestamptz NOT NULL DEFAULT now()
);`,
      },
      {
        id: "20260924_law_financial_engine_2",
        title: "LawHub Motor Financeiro Jurídico 2.0 (Asaas & Enterprise)",
        description: "Arquitetura financeira autônoma completa: Contratos de Honorários com variáveis, Contas a Receber/Pagar, Parcelas, Billing Asaas, Custas Processuais, Reembolsos, Alvarás/Prestação de Contas, Rateios de Equipe, Webhook Idempotente e Auditoria.",
        applied: computeStatus("20260924_law_financial_engine_2", lawFeeContractsExist) === "EXECUTADA",
        status: computeStatus("20260924_law_financial_engine_2", lawFeeContractsExist),
        category: "Estrutura (DDL)",
        isNative: false,
        file: "supabase/migrations/20260924_law_financial_engine_2.sql",
        lastExecutedAt: historyByMigration["20260924_law_financial_engine_2"]?.executed_at || null,
        errorMessage: historyByMigration["20260924_law_financial_engine_2"]?.error_message || null,
        sqlSnippet: `-- Criação de Contratos de Honorários e Contas a Receber
CREATE TABLE IF NOT EXISTS public.law_fee_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES public.law_clients(id) ON DELETE CASCADE,
    title text NOT NULL,
    contract_number text NOT NULL,
    contract_type text NOT NULL DEFAULT 'fixo',
    total_amount numeric(15,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'rascunho',
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.law_fee_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "law_fee_contracts_tenant_isolation" ON public.law_fee_contracts
    FOR ALL USING (account_id = private.current_account_id());`,
      },
      {
        id: "20260924_law_leads_pipeline",
        title: "LawHub Leads Kanban, Intake e Propostas Jurídicas",
        description: "Estrutura completa de funil de captação, etapas configuráveis, motor de campos dinâmicos, matriz de honorários com 7 formatos e timeline auditável.",
        applied: computeStatus("20260924_law_leads_pipeline", lawLeadsExist) === "EXECUTADA",
        status: computeStatus("20260924_law_leads_pipeline", lawLeadsExist),
        category: "Estrutura (DDL)",
        isNative: false,
        file: "supabase/migrations/20260924_law_leads_pipeline.sql",
        lastExecutedAt: historyByMigration["20260924_law_leads_pipeline"]?.executed_at || null,
        errorMessage: historyByMigration["20260924_law_leads_pipeline"]?.error_message || null,
        sqlSnippet: `-- Etapas do Funil de Atendimento e Tabela Principal de Leads
CREATE TABLE IF NOT EXISTS public.law_lead_pipeline_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL DEFAULT '#3b82f6',
    position int NOT NULL DEFAULT 0,
    is_won boolean NOT NULL DEFAULT false,
    is_lost boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.law_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    stage_id uuid NOT NULL REFERENCES public.law_lead_pipeline_stages(id),
    name text NOT NULL,
    phone text,
    source text DEFAULT 'Indicação',
    created_at timestamptz NOT NULL DEFAULT now()
);`,
      },
      {
        id: "20260919_fix_saas_products_modules_plans",
        title: "Sincronização Canônica de Produtos, Módulos e Planos",
        description: "Garante os 3 produtos (RepHub, EngHub, LawHub), 9 módulos do LawHub (com Calculadora), planos comerciais e independência do cadastro de assinantes.",
        applied: computeStatus("20260919_fix_saas_products_modules_plans", canonicalSynced) === "EXECUTADA",
        status: computeStatus("20260919_fix_saas_products_modules_plans", canonicalSynced),
        category: "Dados & Regras",
        isNative: true,
        file: "supabase/migrations/20260919_fix_saas_products_modules_plans.sql",
        lastExecutedAt: historyByMigration["20260919_fix_saas_products_modules_plans"]?.executed_at || null,
        errorMessage: historyByMigration["20260919_fix_saas_products_modules_plans"]?.error_message || null,
        sqlSnippet: `-- Sincronização Canônica NAVOR
INSERT INTO public.products (slug, name, description, status)
VALUES 
  ('rephub', 'Navor RepHub', 'Sistema CRM e gestão para representantes comerciais', 'active'),
  ('enghub', 'Navor EngHub', 'Sistema completo de gestão empresarial e obras', 'active'),
  ('lawhub', 'Navor LawHub', 'Sistema de gestão jurídica de alta performance', 'active')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;`,
      },
      {
        id: "20260919_ai_usage_logs",
        title: "Auditoria & Métricas de IA (Lovable e Gemini)",
        description: "Tabela para registrar consumo de tokens, créditos Lovable, custo estimado e modelo utilizado por cada assinante.",
        applied: computeStatus("20260919_ai_usage_logs", aiExists) === "EXECUTADA",
        status: computeStatus("20260919_ai_usage_logs", aiExists),
        category: "Estrutura (DDL)",
        isNative: false,
        file: "supabase/migrations/20260919_ai_usage_logs.sql",
        lastExecutedAt: historyByMigration["20260919_ai_usage_logs"]?.executed_at || null,
        errorMessage: historyByMigration["20260919_ai_usage_logs"]?.error_message || null,
        sqlSnippet: `CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    feature text NOT NULL,
    model text NOT NULL DEFAULT 'gemini-1.5-pro',
    total_tokens integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);`,
      },
      {
        id: "20260919_legal_calculator_schema",
        title: "Calculadora Jurídica (Índices, Regras e Cálculos Judiciais)",
        description: "Estrutura para índices econômicos (IPCA-E, INPC, SELIC, IGP-M), regras jurídicas auditáveis, memórias de cálculo e exportação de laudos.",
        applied: computeStatus("20260919_legal_calculator_schema", calcExists && rulesExist) === "EXECUTADA",
        status: computeStatus("20260919_legal_calculator_schema", calcExists && rulesExist),
        category: "Estrutura (DDL)",
        isNative: false,
        file: "supabase/migrations/20260919_legal_calculator_schema.sql",
        lastExecutedAt: historyByMigration["20260919_legal_calculator_schema"]?.executed_at || null,
        errorMessage: historyByMigration["20260919_legal_calculator_schema"]?.error_message || null,
        sqlSnippet: `CREATE TABLE IF NOT EXISTS public.economic_indices (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.calculations (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
      },
      {
        id: "20260918110000_lawhub_core",
        title: "LawHub Core (Processos, DJEN, Honorários e Audiências)",
        description: "Módulos centrais de gestão jurídica com controle de prazos fatais e segregação financeira de contas de clientes.",
        applied: computeStatus("20260918110000_lawhub_core", lawCasesExist) === "EXECUTADA",
        status: computeStatus("20260918110000_lawhub_core", lawCasesExist),
        category: "Estrutura (DDL)",
        isNative: false,
        file: "supabase/migrations/20260918110000_lawhub_core.sql",
        lastExecutedAt: historyByMigration["20260918110000_lawhub_core"]?.executed_at || null,
        errorMessage: historyByMigration["20260918110000_lawhub_core"]?.error_message || null,
        sqlSnippet: `-- Módulos estruturais do LawHub
CREATE TABLE IF NOT EXISTS public.law_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    case_number TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
      },
    ];

    return {
      migrations,
      rpcSupported,
      history: historyRows,
      summary: {
        total: migrations.length,
        appliedCount: migrations.filter((m) => m.applied).length,
        pendingCount: migrations.filter((m) => !m.applied && m.status !== "COM ERRO").length,
        errorCount: migrations.filter((m) => m.status === "COM ERRO").length,
      },
    };
  });

/**
 * Aplica uma migração individual ou executa todas as pendentes em 1 clique de forma segura e auditada.
 */
export const executeMigration = createServerFn({ method: "POST" })
  .inputValidator((data: { migrationId: string; force?: boolean }) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

    if (data.migrationId === "20260927_strict_tenant_isolation_rls") {
      throw new Error(
        "A migração 20260927_strict_tenant_isolation_rls é histórica e foi bloqueada: sua implementação redefine current_account_id() de forma insegura. Use a migration versionada vigente no Supabase.",
      );
    }

    const sqlScripts: Record<string, string> = {
      "20260926_create_lead_future_pipeline": `
        CREATE TABLE IF NOT EXISTS public.system_migrations_history (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            migration_id text NOT NULL,
            status text NOT NULL CHECK (status IN ('EXECUTADA', 'PENDENTE', 'COM ERRO', 'INCOMPATIVEL', 'DESCONHECIDA')),
            executed_at timestamptz NOT NULL DEFAULT now(),
            executed_by text NOT NULL DEFAULT 'Administrador',
            execution_time_ms integer NOT NULL DEFAULT 0,
            error_message text,
            details jsonb DEFAULT '{}'::jsonb
        );
        CREATE INDEX IF NOT EXISTS idx_migrations_history_id ON public.system_migrations_history(migration_id, executed_at DESC);
        ALTER TABLE public.system_migrations_history ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "system_migrations_history_admin_only" ON public.system_migrations_history;
        CREATE POLICY "system_migrations_history_admin_only" ON public.system_migrations_history
            FOR ALL USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'superadmin');
        GRANT ALL ON public.system_migrations_history TO authenticated, service_role;

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'law_lead_pipeline_stages' AND column_name = 'pipeline_id') THEN
                ALTER TABLE public.law_lead_pipeline_stages ADD COLUMN pipeline_id text NOT NULL DEFAULT 'pipe-principal';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'law_leads' AND column_name = 'pipeline_id') THEN
                ALTER TABLE public.law_leads ADD COLUMN pipeline_id text NOT NULL DEFAULT 'pipe-principal';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'law_leads' AND column_name = 'lead_type') THEN
                ALTER TABLE public.law_leads ADD COLUMN lead_type text NOT NULL DEFAULT 'imediato';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'law_leads' AND column_name = 'future_contact_date') THEN
                ALTER TABLE public.law_leads ADD COLUMN future_contact_date date;
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_law_leads_pipeline_type ON public.law_leads(account_id, pipeline_id, lead_type);
        CREATE INDEX IF NOT EXISTS idx_law_leads_future_contact ON public.law_leads(account_id, future_contact_date) WHERE future_contact_date IS NOT NULL;
      `,
      "20260925211500_lawhub_atendimento_core": `
        CREATE TABLE IF NOT EXISTS public.law_atendimento_settings (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            business_hours jsonb DEFAULT '{"enabled": true, "start": "08:00", "end": "18:00", "days": [1,2,3,4,5]}'::jsonb,
            auto_reply_out_of_hours text DEFAULT 'Olá! Nosso escritório está fora do horário de atendimento no momento.',
            welcome_message text DEFAULT 'Olá! Bem-vindo ao escritório. Como podemos ajudar?',
            ai_triage_enabled boolean NOT NULL DEFAULT true,
            ai_auto_tag boolean NOT NULL DEFAULT true,
            routing_mode text NOT NULL DEFAULT 'round_robin',
            webhook_url text,
            webhook_secret text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_atendimento_settings_account UNIQUE (account_id)
        );
        ALTER TABLE public.law_atendimento_settings ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "law_atendimento_settings_tenant_isolation" ON public.law_atendimento_settings;
        CREATE POLICY "law_atendimento_settings_tenant_isolation" ON public.law_atendimento_settings
            FOR ALL USING (account_id = private.current_account_id());
        GRANT ALL ON public.law_atendimento_settings TO authenticated, service_role;

        CREATE TABLE IF NOT EXISTS public.law_atendimento_conversations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            remote_jid text NOT NULL,
            channel text NOT NULL DEFAULT 'whatsapp',
            contact_name text,
            contact_phone text,
            contact_email text,
            status text NOT NULL DEFAULT 'open',
            assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
            assigned_user_name text,
            lead_id uuid REFERENCES public.law_leads(id) ON DELETE SET NULL,
            campaign_code text,
            traffic_source text,
            last_message_text text,
            last_message_at timestamptz DEFAULT now(),
            unread_count integer NOT NULL DEFAULT 0,
            tags text[] DEFAULT ARRAY[]::text[],
            is_starred boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_atendimento_conversations_account ON public.law_atendimento_conversations(account_id, last_message_at DESC);
        CREATE INDEX IF NOT EXISTS idx_atendimento_conversations_lead ON public.law_atendimento_conversations(lead_id);
        ALTER TABLE public.law_atendimento_conversations ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "law_atendimento_conversations_tenant_isolation" ON public.law_atendimento_conversations;
        CREATE POLICY "law_atendimento_conversations_tenant_isolation" ON public.law_atendimento_conversations
            FOR ALL USING (account_id = private.current_account_id());
        GRANT ALL ON public.law_atendimento_conversations TO authenticated, service_role;
      `,
      "20260924_law_financial_engine_2": `
        CREATE TABLE IF NOT EXISTS public.law_fee_contracts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            client_id uuid NOT NULL REFERENCES public.law_clients(id) ON DELETE CASCADE,
            contract_number text NOT NULL,
            title text NOT NULL,
            contract_type text NOT NULL DEFAULT 'fixo',
            status text NOT NULL DEFAULT 'rascunho',
            total_amount numeric(15,2) NOT NULL DEFAULT 0,
            installments_count integer NOT NULL DEFAULT 1,
            contingency_percentage numeric(5,2) DEFAULT 0,
            due_day integer DEFAULT 10,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.law_fee_contracts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "law_fee_contracts_tenant_isolation" ON public.law_fee_contracts;
        CREATE POLICY "law_fee_contracts_tenant_isolation" ON public.law_fee_contracts
            FOR ALL USING (account_id = private.current_account_id());
        GRANT ALL ON public.law_fee_contracts TO authenticated, service_role;

        CREATE TABLE IF NOT EXISTS public.law_financial_accounts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            name text NOT NULL,
            institution text NOT NULL DEFAULT 'Outro',
            account_type text NOT NULL DEFAULT 'corrente',
            initial_balance numeric(15,2) NOT NULL DEFAULT 0,
            current_balance numeric(15,2) NOT NULL DEFAULT 0,
            is_active boolean NOT NULL DEFAULT true,
            is_default boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.law_financial_accounts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "law_financial_accounts_tenant_isolation" ON public.law_financial_accounts;
        CREATE POLICY "law_financial_accounts_tenant_isolation" ON public.law_financial_accounts
            FOR ALL USING (account_id = private.current_account_id());
        GRANT ALL ON public.law_financial_accounts TO authenticated, service_role;

        CREATE TABLE IF NOT EXISTS public.law_accounts_receivable (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            client_id uuid NOT NULL REFERENCES public.law_clients(id) ON DELETE CASCADE,
            contract_id uuid REFERENCES public.law_fee_contracts(id) ON DELETE SET NULL,
            description text NOT NULL,
            category text NOT NULL DEFAULT 'Honorário Contratual',
            total_amount numeric(15,2) NOT NULL DEFAULT 0,
            paid_amount numeric(15,2) NOT NULL DEFAULT 0,
            due_date date NOT NULL,
            status text NOT NULL DEFAULT 'aberta',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.law_accounts_receivable ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "law_accounts_receivable_tenant_isolation" ON public.law_accounts_receivable;
        CREATE POLICY "law_accounts_receivable_tenant_isolation" ON public.law_accounts_receivable
            FOR ALL USING (account_id = private.current_account_id());
        GRANT ALL ON public.law_accounts_receivable TO authenticated, service_role;
      `,
      "20260924_law_leads_pipeline": `
        CREATE TABLE IF NOT EXISTS public.law_lead_pipeline_stages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            name text NOT NULL,
            color text NOT NULL DEFAULT '#3b82f6',
            position int NOT NULL DEFAULT 0,
            is_won boolean NOT NULL DEFAULT false,
            is_lost boolean NOT NULL DEFAULT false,
            is_conflict boolean NOT NULL DEFAULT false,
            sla_hours int NOT NULL DEFAULT 48,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_law_lead_stages_account ON public.law_lead_pipeline_stages(account_id, position);
        ALTER TABLE public.law_lead_pipeline_stages ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "law_lead_pipeline_stages_tenant_isolation" ON public.law_lead_pipeline_stages;
        CREATE POLICY "law_lead_pipeline_stages_tenant_isolation" ON public.law_lead_pipeline_stages
            FOR ALL USING (account_id = private.current_account_id());
        GRANT ALL ON public.law_lead_pipeline_stages TO authenticated, service_role;

        CREATE TABLE IF NOT EXISTS public.law_lead_custom_fields (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            label text NOT NULL,
            field_key text NOT NULL,
            field_type text NOT NULL,
            options jsonb DEFAULT '[]'::jsonb,
            area text,
            is_required boolean NOT NULL DEFAULT false,
            position int NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.law_lead_custom_fields ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "law_lead_custom_fields_tenant_isolation" ON public.law_lead_custom_fields;
        CREATE POLICY "law_lead_custom_fields_tenant_isolation" ON public.law_lead_custom_fields
            FOR ALL USING (account_id = private.current_account_id());
        GRANT ALL ON public.law_lead_custom_fields TO authenticated, service_role;

        CREATE TABLE IF NOT EXISTS public.law_leads (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            stage_id uuid NOT NULL REFERENCES public.law_lead_pipeline_stages(id) ON DELETE RESTRICT,
            name text NOT NULL,
            document_number text,
            email text,
            phone text,
            area_direito text NOT NULL DEFAULT 'Geral',
            source text DEFAULT 'Indicação',
            estimated_value numeric(15, 2) DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.law_leads ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "law_leads_tenant_isolation" ON public.law_leads;
        CREATE POLICY "law_leads_tenant_isolation" ON public.law_leads
            FOR ALL USING (account_id = private.current_account_id());
        GRANT ALL ON public.law_leads TO authenticated, service_role;
      `,
      "20260919_ai_usage_logs": `
        CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
            user_name text,
            system text NOT NULL DEFAULT 'lawhub',
            feature text NOT NULL,
            feature_label text,
            model text NOT NULL DEFAULT 'gemini-1.5-pro',
            prompt_tokens integer NOT NULL DEFAULT 0,
            completion_tokens integer NOT NULL DEFAULT 0,
            total_tokens integer NOT NULL DEFAULT 0,
            lovable_credits numeric(10,4) NOT NULL DEFAULT 0,
            cost_usd numeric(10,6) NOT NULL DEFAULT 0,
            metadata jsonb DEFAULT '{}'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_ai_usage_account ON public.ai_usage_logs(account_id);
        ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
        GRANT ALL ON public.ai_usage_logs TO service_role;
      `,
      "20260919_legal_calculator_schema": `
        CREATE TABLE IF NOT EXISTS public.economic_indices (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            institution TEXT NOT NULL,
            description TEXT,
            frequency TEXT NOT NULL DEFAULT 'MENSAL',
            unit TEXT NOT NULL DEFAULT '%',
            active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS public.calculations (
            id TEXT PRIMARY KEY,
            tenant_id UUID NOT NULL,
            user_id UUID NOT NULL,
            title TEXT NOT NULL,
            legal_area TEXT NOT NULL,
            calculation_type TEXT NOT NULL,
            total_final NUMERIC(16, 2) NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'DRAFT',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        ALTER TABLE public.economic_indices ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;
        GRANT ALL ON public.economic_indices TO service_role;
        GRANT ALL ON public.calculations TO service_role;
      `,
      "20260918110000_lawhub_core": `
        CREATE TABLE IF NOT EXISTS public.law_cases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            case_number TEXT,
            court TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE public.law_cases ENABLE ROW LEVEL SECURITY;
        GRANT ALL ON public.law_cases TO service_role;
      `,
    };

    // Helper interno para carregar script por ID (tenta fs local ou dicionário)
    const resolveScript = async (id: string) => {
      if (id === "20260927_strict_tenant_isolation_rls") return undefined;
      let script = sqlScripts[id];
      try {
        const fs = await import("fs");
        const path = await import("path");
        const candidates = [
          path.resolve(process.cwd(), "supabase", "migrations", `${id}.sql`),
          path.resolve(process.cwd(), "supabase", "migrations", id),
        ];
        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            const fileContent = fs.readFileSync(cand, "utf-8");
            if (fileContent && fileContent.trim().length > 10) {
              script = fileContent;
              break;
            }
          }
        }
      } catch {}
      return script;
    };

    // Execução em lote: "all"
    if (data.migrationId === "all") {
      const order = [
        "20260918110000_lawhub_core",
        "20260919_ai_usage_logs",
        "20260919_legal_calculator_schema",
        "20260919_fix_saas_products_modules_plans",
        "20260924_law_financial_engine_2",
        "20260924_law_leads_pipeline",
        "20260925211500_lawhub_atendimento_core",
        "20260926_create_lead_future_pipeline",
      ];

      const executionLogs: string[] = [];
      const syncRes = await repairAndSyncDatabase();
      executionLogs.push(...(syncRes?.log || ["Sincronização canônica concluída."]));

      for (const migId of order) {
        if (migId === "20260919_fix_saas_products_modules_plans") continue;
        const script = await resolveScript(migId);
        if (!script) continue;

        const startTime = Date.now();
        try {
          const { error } = await supabaseAdmin.rpc("exec_sql", { sql_query: script });
          if (error) throw new Error(error.message);
          
          try {
            await supabaseAdmin.from("system_migrations_history").insert({
              migration_id: migId,
              status: "EXECUTADA",
              executed_at: new Date().toISOString(),
              executed_by: "Administrador",
              execution_time_ms: Date.now() - startTime,
              details: { batch: true },
            });
          } catch {}

          executionLogs.push(`✅ Migração '${migId}' aplicada com sucesso.`);
        } catch (err: any) {
          try {
            await supabaseAdmin.from("system_migrations_history").insert({
              migration_id: migId,
              status: "COM ERRO",
              executed_at: new Date().toISOString(),
              executed_by: "Administrador",
              execution_time_ms: Date.now() - startTime,
              error_message: err.message,
              details: { batch: true },
            });
          } catch {}
          executionLogs.push(`⚠️ Migração '${migId}': ${err.message}`);
        }
      }

      return {
        success: true,
        message: "Processo de sincronização e migrações concluído!",
        details: executionLogs,
      };
    }

    if (data.migrationId === "20260919_fix_saas_products_modules_plans") {
      const res = await repairAndSyncDatabase();
      return {
        success: true,
        message: "Sincronização canônica aplicada com sucesso!",
        details: res?.log || ["Produtos, módulos e planos canônicos sincronizados."],
      };
    }

    const script = await resolveScript(data.migrationId);
    if (!script) {
      throw new Error(`Migração '${data.migrationId}' não encontrada no catálogo.`);
    }

    const startTime = Date.now();
    try {
      const { error } = await supabaseAdmin.rpc("exec_sql", { sql_query: script });
      if (error) throw new Error(error.message);

      // Registrar auditoria no histórico
      try {
        await supabaseAdmin.from("system_migrations_history").insert({
          migration_id: data.migrationId,
          status: "EXECUTADA",
          executed_at: new Date().toISOString(),
          executed_by: "Administrador",
          execution_time_ms: Date.now() - startTime,
          details: { single: true },
        });
      } catch {}

      return {
        success: true,
        message: `Migração '${data.migrationId}' executada e registrada com sucesso!`,
      };
    } catch (err: any) {
      try {
        await supabaseAdmin.from("system_migrations_history").insert({
          migration_id: data.migrationId,
          status: "COM ERRO",
          executed_at: new Date().toISOString(),
          executed_by: "Administrador",
          execution_time_ms: Date.now() - startTime,
          error_message: err.message,
          details: { single: true },
        });
      } catch {}

      return {
        success: false,
        requiresManualSql: true,
        message: `Falha na execução: ${err.message}. A função 'exec_sql' pode necessitar ser ativada no PostgreSQL.`,
        script,
        helperInstruction: "Você pode copiar o script SQL abaixo e colar no SQL Editor do Supabase para aplicar diretamente na nuvem.",
      };
    }
  });

/**
 * Executa comando SQL administrativo caso a RPC exec_sql esteja ativa, ou avalia o comando.
 */
export const executeRawSql = createServerFn({ method: "POST" })
  .inputValidator((data: { sql: string }) => data)
  .handler(async ({ data }) => {
  await requireAdminSession();
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;

    if (!data.sql || !data.sql.trim()) {
      throw new Error("Comando SQL não pode estar vazio.");
    }

    const normalizedSql = data.sql.replace(/--[^\r\n]*/g, "").replace(/\s+/g, " ").toLowerCase();
    if (/\bcreate\s+(or\s+replace\s+)?function\s+private\.current_account_id\s*\(/.test(normalizedSql)) {
      throw new Error("A redefinição de private.current_account_id() é bloqueada pelo fail-closed de contas.");
    }

    try {
      const { data: result, error } = await supabaseAdmin.rpc("exec_sql", { sql_query: data.sql });
      if (error) throw new Error(error.message);
      return { success: true, result };
    } catch (err: any) {
      throw new Error(`Falha na execução: ${err.message}. Para executar DDL direto pelo painel sem restrições, configure a função exec_sql no PostgreSQL.`);
    }
  });

/**
 * Salva a configuração central de Inteligência Artificial para o LawHub no painel administrativo
 */
export const saveLawHubAdminAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    provider: "lovable" | "openai" | "gemini" | "claude";
    apiKey?: string;
    model?: string;
  }) => data)
  .handler(async ({ data, context }) => {
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials");
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;
    const { requireAdministrativeSettingsAccount } = await import("@/lib/security/authorization.server");
    const { accountId } = await requireAdministrativeSettingsAccount(context.userId);

    const effectiveProvider = data.provider || "lovable";
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "lawhub_ai_config")
      .eq("account_id", accountId)
      .maybeSingle();
    const key = data.apiKey?.trim() || existing?.value?.apiKey?.trim() || "";

    // Bloqueio rigoroso contra erro humano: se o administrador tentar selecionar provedores externos
    // (OpenAI, Gemini, Claude) sem fornecer uma chave de API válida, bloqueia o salvamento
    if (effectiveProvider !== "lovable" && (!key || key.length < 10)) {
      throw new Error(
        `Bloqueio de Segurança: Não é permitido ativar o provedor '${effectiveProvider.toUpperCase()}' sem informar uma chave de API válida. Mantenha o 'Lovable AI Gateway' selecionado ou insira a chave de API correspondente.`
      );
    }

    const payload = {
      provider: effectiveProvider,
      apiKey: key,
      model: data.model || (effectiveProvider === "openai" ? "gpt-4o" : effectiveProvider === "gemini" ? "gemini-2.0-flash" : "google/gemini-2.5-flash"),
      updatedAt: new Date().toISOString(),
    };

    try {
      await supabaseAdmin.from("app_settings").upsert(
        {
          key: "lawhub_ai_config",
          account_id: accountId,
          value: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,account_id" }
      );
    } catch (e: any) {
      console.warn("Falha ao salvar lawhub_ai_config em app_settings:", e?.message);
    }

    return {
      success: true,
      config: { ...payload, apiKey: "", hasKey: key.length > 5 },
    };
  });

/**
 * Recupera a configuração central de Inteligência Artificial para o LawHub
 */
export const getLawHubAdminAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      provider: "lovable",
      model: "google/gemini-2.5-flash",
      apiKey: "",
      hasKey: false,
    };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;
  const { requireAdministrativeSettingsAccount } = await import("@/lib/security/authorization.server");
  const { accountId } = await requireAdministrativeSettingsAccount(context.userId);

  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "lawhub_ai_config")
      .eq("account_id", accountId)
      .maybeSingle();

    if (data && data.value) {
      const cfg = data.value;
      const key = (cfg.apiKey || "").trim();
      const provider = (cfg.provider || "lovable") as string;

      // Proteção de segurança: se no banco constar provedor externo sem chave, reverte automaticamente para lovable
      if (provider !== "lovable" && key.length < 10) {
        return {
          provider: "lovable",
          model: "google/gemini-2.5-flash",
          apiKey: "",
          hasKey: false,
          updatedAt: cfg.updatedAt,
        };
      }

      return {
        provider,
        model: cfg.model || "google/gemini-2.5-flash",
        apiKey: "",
        hasKey: key.length > 5,
        updatedAt: cfg.updatedAt,
      };
    }
  } catch (e: any) {
    console.warn("Erro ao buscar lawhub_ai_config:", e?.message);
  }

  return {
    provider: "lovable",
    model: "google/gemini-2.5-flash",
    apiKey: "",
    hasKey: false,
  };
  });

/**
 * Configura os motores do LawHub por escritório sem aceitar ou persistir chaves.
 * Tokens de IA, Meta e Escavador devem existir apenas nos secrets do servidor NAVOR.
 */
export const saveLawHubServiceConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    service: "callcenter_ai" | "pieces_ai" | "legal_data";
    provider: "lovable" | "openai" | "gemini" | "escavador" | "datajud";
    model?: string;
    monthlyQuota?: number;
    reviewRequired?: boolean;
    receptionMode?: "bot" | "ai" | "hybrid" | "human";
    leadRule?: "instant" | "qualified" | "immediate" | "manual";
  }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdministrativeSettingsAccount } = await import("@/lib/security/authorization.server");
    const { accountId } = await requireAdministrativeSettingsAccount(context.userId);
    const payload = {
      provider: data.provider,
      ...(data.model ? { model: data.model } : {}),
      ...(Number.isFinite(data.monthlyQuota) ? { monthlyQuota: Math.max(0, Number(data.monthlyQuota)) } : {}),
      ...(typeof data.reviewRequired === "boolean" ? { reviewRequired: data.reviewRequired } : {}),
      ...(data.receptionMode ? { receptionMode: data.receptionMode } : {}),
      ...(data.leadRule ? { leadRule: data.leadRule } : {}),
      updatedAt: new Date().toISOString(),
    };
    await (serviceSupabase as any).from("app_settings").upsert(
      {
        key: `lawhub_${data.service}_config`,
        account_id: accountId,
        value: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key,account_id" },
    );
    return { success: true, config: payload };
  });

export const getLawHubServiceConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { service: "callcenter_ai" | "pieces_ai" | "legal_data" }) => data)
  .handler(async ({ data, context }) => {
    const { requireAdministrativeSettingsAccount } = await import("@/lib/security/authorization.server");
    const { accountId } = await requireAdministrativeSettingsAccount(context.userId);
    const { data: setting } = await (serviceSupabase as any)
      .from("app_settings")
      .select("value")
      .eq("key", `lawhub_${data.service}_config`)
      .eq("account_id", accountId)
      .maybeSingle();
    return setting?.value || null;
  });

/**
 * Salva uma nova peça no histórico em nuvem do LawHub (compartilhado entre todas as máquinas e advogados)
 */
export const saveLawHubDraftToCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { draftRecord: any }) => data)
  .handler(async ({ data, context }) => {
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) return { success: false, error: "Missing Supabase credentials" };

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;
    const { requireAuthenticatedAccount } = await import("@/lib/security/authorization.server");
    const { accountId } = await requireAuthenticatedAccount(context.userId);

    try {
      const { data: existing } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "lawhub_ai_draft_history")
        .eq("account_id", accountId)
        .maybeSingle();

      const currentList: any[] = Array.isArray(existing?.value) ? existing.value : [];
      // Remove se já existia com o mesmo ID e coloca no início
      const filtered = currentList.filter((item: any) => item.id !== data.draftRecord.id);
      const updatedList = [data.draftRecord, ...filtered].slice(0, 300); // mantém os 300 mais recentes

      await supabaseAdmin.from("app_settings").upsert(
        {
          key: "lawhub_ai_draft_history",
          account_id: accountId,
          value: updatedList,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,account_id" }
      );

      return { success: true, history: updatedList };
    } catch (e: any) {
      console.warn("Erro ao salvar histórico de peças em app_settings:", e?.message);
      return { success: false, error: e?.message };
    }
  });

/**
 * Recupera o histórico de peças geradas da nuvem
 */
export const getLawHubDraftHistoryFromCloud = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !supabaseServiceKey) return [];

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;
  const { requireAuthenticatedAccount } = await import("@/lib/security/authorization.server");
  const { accountId } = await requireAuthenticatedAccount(context.userId);

  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "lawhub_ai_draft_history")
      .eq("account_id", accountId)
      .maybeSingle();

    if (data && Array.isArray(data.value)) {
      return data.value;
    }
  } catch (e: any) {
    console.warn("Erro ao buscar lawhub_ai_draft_history:", e?.message);
  }

  return [];
  });

/**
 * Remove uma peça específica do histórico em nuvem
 */
export const deleteLawHubDraftFromCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !supabaseServiceKey) return { success: false };

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any;
    const { requireAuthenticatedAccount } = await import("@/lib/security/authorization.server");
    const { accountId } = await requireAuthenticatedAccount(context.userId);

    try {
      const { data: existing } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "lawhub_ai_draft_history")
        .eq("account_id", accountId)
        .maybeSingle();

      const currentList: any[] = Array.isArray(existing?.value) ? existing.value : [];
      const updatedList = currentList.filter((item: any) => item.id !== data.id);

      await supabaseAdmin.from("app_settings").upsert(
        {
          key: "lawhub_ai_draft_history",
          account_id: accountId,
          value: updatedList,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,account_id" }
      );

      return { success: true, history: updatedList };
    } catch (e: any) {
      console.warn("Erro ao excluir peça de lawhub_ai_draft_history:", e?.message);
      return { success: false, error: e?.message };
    }
  });


 // =============================================================================
 // CADEIRA 4.6 — RETAGUARDA ADMIN 360° (SERVER ACTIONS)
 // CRUD de entitlements, addons, overrides, blocos, capabilities e limites
 // =============================================================================

 /**
  * Verifica se o usuário autenticado é platform admin.
  * Fail-closed: lança erro se não for admin ou se a verificação falhar.
  */
 async function requirePlatformAdmin(userId: string): Promise<void> {
   const { data, error } = await serviceSupabase
     .from("platform_admins")
     .select("user_id")
     .eq("user_id", userId)
     .maybeSingle();
   if (error) throw new Error(`PLATFORM_ADMIN_CHECK_FAILURE: ${error.message}`);
   if (!data) throw new Error("PLATFORM_ADMIN_REQUIRED: acesso negado");
 }

 /**
  * Grava entrada no audit log de entitlements.
  */
 /**
 * Grava entrada no audit log de entitlements.
 * FAIL-CLOSED: lança erro se a auditoria falhar para evitar estado inconsistente.
 */
async function logEntitlementChange(params: {
  accountId: string;
  changedBy: string;
  changeType: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  const { error } = await serviceSupabase.from("entitlement_audit_log").insert({
    account_id: params.accountId,
    changed_by: params.changedBy,
    change_type: params.changeType,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
    new_value: params.newValue ? JSON.stringify(params.newValue) : null,
  });
  if (error) {
    throw new Error(`ENTITLEMENT_AUDIT_LOG_FAILURE: ${error.message}`);
  }
}

 // ---------------------------------------------------------------------------
 // SUBSCRIBER 360
 // ---------------------------------------------------------------------------

 export const getSubscriber360 = createServerFn({ method: "GET" })
   .middleware([requireSupabaseAuth])
   .inputValidator((d: { accountId: string }) => d)
   .handler(async ({ data, context }) => {
     await requirePlatformAdmin(context.userId);
     const { accountId } = data;

     const [subResult, overridesResult, addonsResult, auditResult] = await Promise.all([
       serviceSupabase
         .from("subscriptions")
         .select("*, plans!inner(id, name, amount, product_id), accounts!inner(id, name, contact_email)")
         .eq("account_id", accountId)
         .order("created_at", { ascending: false })
         .limit(1)
         .maybeSingle(),
       serviceSupabase
         .from("account_entitlement_overrides")
         .select("*, product_capabilities!inner(key, name)")
         .eq("account_id", accountId),
       serviceSupabase
         .from("account_addons")
         .select("*, plan_addons!inner(key, name, amount)")
         .eq("account_id", accountId)
         .eq("is_active", true),
       serviceSupabase
         .from("entitlement_audit_log")
         .select("*")
         .eq("account_id", accountId)
         .order("created_at", { ascending: false })
         .limit(50),
     ]);

     // Resolve capabilities via RPC
     let capabilities: any[] = [];
    const capResult = await serviceSupabase.rpc("get_account_entitlements", { p_account_id: accountId });
    if (capResult.error) {
      throw new Error(`ENTITLEMENTS_RPC_FAILURE: ${capResult.error.message}`);
    }
    if (!Array.isArray(capResult.data)) {
      throw new Error("ENTITLEMENTS_RPC_FAILURE: invalid response schema");
    }
    capabilities = capResult.data;

     // Usage limits from current plan
     let usageLimits: any[] = [];
     if (subResult.data?.plan_id) {
       const limitsResult = await serviceSupabase
         .from("plan_usage_limits")
         .select("*")
         .eq("plan_id", subResult.data.plan_id);
      if (limitsResult.error) {
        throw new Error(`USAGE_LIMITS_QUERY_FAILURE: ${limitsResult.error.message}`);
       }
      if (Array.isArray(limitsResult.data)) {
        usageLimits = limitsResult.data;
      }
     }

     return {
       subscription: subResult.data ?? null,
       capabilities,
       overrides: overridesResult.data ?? [],
       addons: addonsResult.data ?? [],
       usageLimits,
       auditLog: auditResult.data ?? [],
     };
   });

// ---------------------------------------------------------------------------
// CADEIRA 4.6 — CATÁLOGO: BLOCOS, CAPABILITIES E ADDONS (SERVER ACTIONS)
// Todas fail-closed com auditoria e autorização Platform Admin.
// ---------------------------------------------------------------------------

// ---- BLOCKS ----

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.userId);
    const { data, error } = await serviceSupabase
      .from("system_blocks")
      .select("*, system_modules!inner(id, name, key)")
      .order("display_order", { ascending: true });
    if (error) throw new Error(`LIST_BLOCKS_FAILURE: ${error.message}`);
    return data ?? [];
  });

export const upsertBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; moduleId: string; key: string; name: string; description?: string; displayOrder?: number }) => d)
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.userId);
    const payload = {
      module_id: data.moduleId,
      key: data.key,
      name: data.name,
      description: data.description ?? null,
      display_order: data.displayOrder ?? 0,
    };
    let result;
    if (data.id) {
      result = await serviceSupabase.from("system_blocks").update(payload).eq("id", data.id).select("id").single();
    } else {
      result = await serviceSupabase.from("system_blocks").insert(payload).select("id").single();
    }
    if (result.error) throw new Error(`UPSERT_BLOCK_FAILURE: ${result.error.message}`);
    await logEntitlementChange({
      accountId: "platform",
      changedBy: context.userId,
      changeType: data.id ? "block_updated" : "block_created",
      entityType: "system_block",
      entityId: result.data?.id ?? data.id,
      newValue: payload,
    });
    return result.data;
  });

export const deleteBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.userId);
    const { error } = await serviceSupabase.from("system_blocks").delete().eq("id", data.id);
    if (error) throw new Error(`DELETE_BLOCK_FAILURE: ${error.message}`);
    await logEntitlementChange({
      accountId: "platform",
      changedBy: context.userId,
      changeType: "block_deleted",
      entityType: "system_block",
      entityId: data.id,
    });
    return { success: true };
  });

// ---- CAPABILITIES ----

export const listCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.userId);
    const { data, error } = await serviceSupabase
      .from("product_capabilities")
      .select("*, products!inner(id, name, slug)")
      .order("key", { ascending: true });
    if (error) throw new Error(`LIST_CAPABILITIES_FAILURE: ${error.message}`);
    return data ?? [];
  });

export const upsertCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; productId: string; key: string; name: string; description?: string }) => d)
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.userId);
    const payload = {
      product_id: data.productId,
      key: data.key,
      name: data.name,
      description: data.description ?? null,
    };
    let result;
    if (data.id) {
      result = await serviceSupabase.from("product_capabilities").update(payload).eq("id", data.id).select("id").single();
    } else {
      result = await serviceSupabase.from("product_capabilities").insert(payload).select("id").single();
    }
    if (result.error) throw new Error(`UPSERT_CAPABILITY_FAILURE: ${result.error.message}`);
    await logEntitlementChange({
      accountId: "platform",
      changedBy: context.userId,
      changeType: data.id ? "capability_updated" : "capability_created",
      entityType: "product_capability",
      entityId: result.data?.id ?? data.id,
      newValue: payload,
    });
    return result.data;
  });

export const deleteCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.userId);
    const { error } = await serviceSupabase.from("product_capabilities").delete().eq("id", data.id);
    if (error) throw new Error(`DELETE_CAPABILITY_FAILURE: ${error.message}`);
    await logEntitlementChange({
      accountId: "platform",
      changedBy: context.userId,
      changeType: "capability_deleted",
      entityType: "product_capability",
      entityId: data.id,
    });
    return { success: true };
  });

// ---- ADDONS ----

export const listAddons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.userId);
    const { data, error } = await serviceSupabase
      .from("plan_addons")
      .select("*, products!inner(id, name, slug)")
      .order("name", { ascending: true });
    if (error) throw new Error(`LIST_ADDONS_FAILURE: ${error.message}`);
    return data ?? [];
  });

export const createAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; name: string; description?: string; amount: number; billingCycle: string; productId: string }) => d)
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.userId);
    const payload = {
      key: data.key,
      name: data.name,
      description: data.description ?? null,
      amount: data.amount,
      billing_cycle: data.billingCycle,
      product_id: data.productId,
    };
    const result = await serviceSupabase.from("plan_addons").insert(payload).select("id").single();
    if (result.error) throw new Error(`CREATE_ADDON_FAILURE: ${result.error.message}`);
    await logEntitlementChange({
      accountId: "platform",
      changedBy: context.userId,
      changeType: "addon_created",
      entityType: "plan_addon",
      entityId: result.data?.id,
      newValue: payload,
    });
    return result.data;
  });

export const updateAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; key?: string; name?: string; description?: string; amount?: number; billingCycle?: string; isActive?: boolean }) => d)
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.userId);
    const payload: Record<string, unknown> = {};
    if (data.key !== undefined) payload.key = data.key;
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.amount !== undefined) payload.amount = data.amount;
    if (data.billingCycle !== undefined) payload.billing_cycle = data.billingCycle;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    const result = await serviceSupabase.from("plan_addons").update(payload).eq("id", data.id).select("id").single();
    if (result.error) throw new Error(`UPDATE_ADDON_FAILURE: ${result.error.message}`);
    await logEntitlementChange({
      accountId: "platform",
      changedBy: context.userId,
      changeType: "addon_updated",
      entityType: "plan_addon",
      entityId: data.id,
      newValue: payload,
    });
    return result.data;
  });

export const deleteAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.userId);
    const { error } = await serviceSupabase.from("plan_addons").delete().eq("id", data.id);
    if (error) throw new Error(`DELETE_ADDON_FAILURE: ${error.message}`);
    await logEntitlementChange({
      accountId: "platform",
      changedBy: context.userId,
      changeType: "addon_deleted",
      entityType: "plan_addon",
      entityId: data.id,
    });
    return { success: true };
  });
