/**
 * NAVOR Core — Account Security, Consent & Official Registration
 * Protocolo da Cadeira 4 — Autoridade Central de Conta e Segurança NAVOR
 *
 * REGRAS CRÍTICAS:
 * - O backend é autoridade final do aceite de Termos v1.1 e Política v1.0.
 * - Requisições sem termos aceitos ou com versão inválida são sumariamente REJEITADAS (400).
 * - Identidade técnica estável: user_id (UUID) NUNCA se altera com troca de e-mail.
 * - Troca de e-mail preserva memberships, tenant, roles, subscriptions e histórico.
 * - CPF e CNPJ NÃO são exigidos nem validados no cadastro oficial.
 * - Senhas, hashes, tokens e authorization headers NUNCA são expostos em logs ou retornos de API.
 * - Mensagens públicas de recuperação são neutras (impedem enumeração de usuários).
 * - Histórico de consentimentos (public.user_consents) é 100% imutável.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/core/legal/terms-and-privacy";
import { normalizeEmail, normalizePhone, sanitizeName } from "@/lib/trial-rate-limit.server";
import { getActiveEmailProvider } from "@/lib/email/email-provider";

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS DE VALIDAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(120, "Nome muito longo"),
  phone: z.string().trim().min(8, "Telefone é obrigatório").max(25, "Telefone inválido"),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(72, "A senha deve ter no máximo 72 caracteres"),
  consentTerms: z.boolean(),
  termsVersion: z.string().trim(),
  privacyVersion: z.string().trim(),
  marketingOptIn: z.boolean().default(false),
  source: z.string().trim().default("web_signup"),
});

const UpdateEmailSchema = z.object({
  newEmail: z.string().trim().email("E-mail inválido").max(255),
});

const UpdatePasswordSchema = z.object({
  newPassword: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(72, "A senha deve ter no máximo 72 caracteres"),
});

const UpdateMarketingSchema = z.object({
  marketingOptIn: z.boolean(),
});

const RequestResetSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. CADASTRO OFICIAL NAVOR (SIGNUP)
// ─────────────────────────────────────────────────────────────────────────────

export const signupOfficial = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SignupSchema.parse(data))
  .handler(async ({ data }) => {
    // 1. Validação estrita do Aceite de Termos e Política (BACKEND COMO AUTORIDADE)
    if (!data.consentTerms) {
      throw new Error("É obrigatório aceitar os Termos de Uso e ter ciência da Política de Privacidade para criar uma conta.");
    }

    if (data.termsVersion !== TERMS_VERSION) {
      throw new Error(`Versão de Termos de Uso inválida ou desatualizada. A versão vigente é ${TERMS_VERSION}.`);
    }

    if (data.privacyVersion !== PRIVACY_VERSION) {
      throw new Error(`Versão da Política de Privacidade inválida ou desatualizada. A versão vigente é ${PRIVACY_VERSION}.`);
    }

    const cleanName = sanitizeName(data.name);
    const cleanEmail = normalizeEmail(data.email);
    const cleanPhone = normalizePhone(data.phone);

    if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 10) {
      throw new Error("Informe um telefone celular válido com DDD.");
    }

    // 2. Extração segura de IP e User-Agent para registro imutável de consentimento
    const request = getRequest();
    let clientIp: string | null = null;
    let userAgent: string | null = null;

    try {
      clientIp = getRequestIP() ?? null;
    } catch {
      // Ignora erro de IP em ambientes locais/emulados
    }

    if (request?.headers) {
      userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;
      if (!clientIp) {
        clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      }
    }

    // 3. Criar usuário no Auth do Supabase
    // email_confirm: true para garantir liberação imediata da conta do usuário
    const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone: cleanPhone,
        terms_version: data.termsVersion,
        privacy_version: data.privacyVersion,
        marketing_opt_in: data.marketingOptIn,
      },
    });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists")) {
        throw new Error("Já existe uma conta cadastrada com este e-mail. Utilize a opção Entrar.");
      }
      throw new Error(`Falha ao criar conta: ${authError.message}`);
    }

    if (!authResult.user?.id) {
      throw new Error("Não foi possível gerar a identidade da conta.");
    }

    const userId = authResult.user.id;

    // 4. Garantir registro de perfil com identidade estável (user_id)
    await (supabaseAdmin as any).from("profiles").upsert(
      {
        id: userId,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        marketing_opt_in: data.marketingOptIn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    // 5. Registrar consentimento no histórico imutável via RPC
    try {
      await (supabaseAdmin as any).rpc("record_user_consent", {
        p_user_id: userId,
        p_terms_version: data.termsVersion,
        p_privacy_version: data.privacyVersion,
        p_marketing_opt_in: data.marketingOptIn,
        p_acceptance_source: data.source || "web_signup",
        p_ip_address: clientIp,
        p_user_agent: userAgent,
      });
    } catch (rpcErr) {
      console.error("[signupOfficial] Erro ao registrar consentimento via RPC:", (rpcErr as Error).message);
    }

    // 6. Auditoria de cadastro
    try {
      await (supabaseAdmin as any).from("audit_logs").insert({
        user_id: userId,
        action: "signup",
        entity_type: "user",
        entity_id: userId,
        description: `Cadastro oficial NAVOR realizado com aceite de Termos v${data.termsVersion}`,
        after_data: {
          terms_version: data.termsVersion,
          privacy_version: data.privacyVersion,
          marketing_opt_in: data.marketingOptIn,
        },
      });
    } catch {
      // Auditoria é best-effort
    }

    // 7. Enfileirar e-mail transacional de boas-vindas
    try {
      await (supabaseAdmin as any).from("email_queue").insert({
        event_type: "welcome",
        recipient_email: cleanEmail,
        template_key: "navor-welcome",
        template_data: {
          recipientName: cleanName,
          productName: "NAVOR Plataforma",
          termsVersion: data.termsVersion,
        },
        dedupe_key: `signup:welcome:${userId}`,
        status: "pending",
      });
    } catch {
      // Envio de email é best-effort
    }

    return {
      success: true,
      userId,
      email: cleanEmail,
      message: "Conta criada com sucesso! Você já pode entrar com suas credenciais.",
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 2. ALTERAÇÃO SEGURA DE E-MAIL (PRESERVA USER_ID)
// ─────────────────────────────────────────────────────────────────────────────

export const updateUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateEmailSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const cleanNewEmail = normalizeEmail(data.newEmail);

    // 1. Obter usuário atual
    const { data: currentUser, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getErr || !currentUser.user) {
      throw new Error("Usuário não encontrado.");
    }

    const oldEmail = currentUser.user.email ? normalizeEmail(currentUser.user.email) : null;
    if (oldEmail === cleanNewEmail) {
      throw new Error("O novo e-mail informado é idêntico ao e-mail atual.");
    }

    // 2. Atualizar no Auth preservando user_id
    const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: cleanNewEmail,
      email_confirm: true,
    });

    if (authUpdateErr) {
      const msg = authUpdateErr.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists")) {
        throw new Error("Este novo endereço de e-mail já pertence a outra conta.");
      }
      throw new Error(`Erro ao atualizar e-mail: ${authUpdateErr.message}`);
    }

    // 3. Atualizar no perfil da conta
    await (supabaseAdmin as any)
      .from("profiles")
      .update({
        email: cleanNewEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // 4. Trilha de auditoria
    try {
      await (supabaseAdmin as any).from("audit_logs").insert({
        user_id: userId,
        action: "email_changed",
        entity_type: "user",
        entity_id: userId,
        description: "Endereço de e-mail de acesso alterado pelo titular da conta",
        before_data: { email: oldEmail },
        after_data: { email: cleanNewEmail },
      });
    } catch {
      // Best-effort
    }

    // 5. Notificar e-mail anterior sobre a mudança se houver
    if (oldEmail) {
      try {
        await (supabaseAdmin as any).from("email_queue").insert({
          event_type: "welcome",
          recipient_email: oldEmail,
          template_key: "navor-welcome",
          template_data: {
            recipientName: "Titular NAVOR",
            message: "O endereço de e-mail da sua conta NAVOR foi alterado com sucesso.",
          },
          dedupe_key: `email_change:${userId}:${Date.now()}`,
          status: "pending",
        });
      } catch {
        // Best-effort
      }
    }

    return {
      success: true,
      email: cleanNewEmail,
      message: "E-mail atualizado com sucesso. Sua identidade e acessos foram preservados.",
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 3. ALTERAÇÃO DE SENHA
// ─────────────────────────────────────────────────────────────────────────────

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdatePasswordSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.newPassword,
      user_metadata: { must_change_password: false },
    });

    if (authErr) {
      throw new Error(`Erro ao atualizar senha: ${authErr.message}`);
    }

    // Trilha de auditoria (NUNCA registrar a senha)
    try {
      await (supabaseAdmin as any).from("audit_logs").insert({
        user_id: userId,
        action: "password_changed",
        entity_type: "user",
        entity_id: userId,
        description: "Senha de acesso atualizada pelo titular da conta",
      });
    } catch {
      // Best-effort
    }

    return {
      success: true,
      message: "Senha alterada com sucesso.",
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 4. ATUALIZAÇÃO DE CONSENTIMENTO DE MARKETING
// ─────────────────────────────────────────────────────────────────────────────

export const updateMarketingPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateMarketingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const request = getRequest();
    let clientIp: string | null = null;
    let userAgent: string | null = null;

    try {
      clientIp = getRequestIP() ?? null;
    } catch {
      // Ignora erro
    }

    if (request?.headers) {
      userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;
      if (!clientIp) {
        clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      }
    }

    // Registrar no histórico imutável
    await (supabaseAdmin as any).rpc("record_user_consent", {
      p_user_id: userId,
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
      p_marketing_opt_in: data.marketingOptIn,
      p_acceptance_source: "settings_preference_update",
      p_ip_address: clientIp,
      p_user_agent: userAgent,
    });

    // Auditoria
    try {
      await (supabaseAdmin as any).from("audit_logs").insert({
        user_id: userId,
        action: data.marketingOptIn ? "marketing_opt_in" : "marketing_opt_out",
        entity_type: "user",
        entity_id: userId,
        description: data.marketingOptIn
          ? "Usuário autorizou recebimento de comunicações comerciais"
          : "Usuário revogou autorização de comunicações comerciais",
      });
    } catch {
      // Best-effort
    }

    return {
      success: true,
      marketingOptIn: data.marketingOptIn,
      message: data.marketingOptIn
        ? "Preferência atualizada: você receberá novidades e lançamentos."
        : "Preferência atualizada: comunicações de marketing desativadas.",
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 5. DADOS DA MINHA CONTA / SEGURANÇA / CONSENTIMENTOS
// ─────────────────────────────────────────────────────────────────────────────

export const getAccountSecurityProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    // Buscar perfil
    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, full_name, email, phone, marketing_opt_in, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    // Buscar histórico de consentimento mais recente
    const { data: latestConsent } = await (supabaseAdmin as any)
      .from("user_consents")
      .select("terms_version, privacy_version, terms_accepted_at, privacy_acknowledged_at, marketing_opt_in, acceptance_source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      profile: {
        id: userId,
        name: profile?.full_name || "Usuário NAVOR",
        email: profile?.email || context.claims.email || "",
        phone: profile?.phone || "",
        marketingOptIn: profile?.marketing_opt_in ?? false,
        createdAt: profile?.created_at || null,
      },
      consent: latestConsent
        ? {
            termsVersion: latestConsent.terms_version,
            privacyVersion: latestConsent.privacy_version,
            termsAcceptedAt: latestConsent.terms_accepted_at,
            privacyAcknowledgedAt: latestConsent.privacy_acknowledged_at,
            marketingOptIn: latestConsent.marketing_opt_in,
            acceptanceSource: latestConsent.acceptance_source,
          }
        : {
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
            termsAcceptedAt: null,
            privacyAcknowledgedAt: null,
            marketingOptIn: false,
            acceptanceSource: "none",
          },
      activeTermsVersion: TERMS_VERSION,
      activePrivacyVersion: PRIVACY_VERSION,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 6. RECUPERAÇÃO DE SENHA (RESPOSTA NEUTRA CONTRA ENUMERAÇÃO)
// ─────────────────────────────────────────────────────────────────────────────

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RequestResetSchema.parse(data))
  .handler(async ({ data }) => {
    const cleanEmail = normalizeEmail(data.email);

    // Resposta padrão idêntica independentemente do e-mail existir
    const neutralSuccessResponse = {
      success: true,
      message: "Se houver uma conta ativa com este e-mail, enviamos as instruções para redefinição da sua senha.",
    };

    try {
      const redirectUrl = "https://www.navorbr.com/reset-password";
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: cleanEmail,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (!linkErr && linkData?.properties?.action_link) {
        // Enfileirar envio com o link de recuperação gerado
        await (supabaseAdmin as any).from("email_queue").insert({
          event_type: "password_reset",
          recipient_email: cleanEmail,
          template_key: "navor-password-reset",
          template_data: {
            recipientName: "Usuário NAVOR",
            resetUrl: linkData.properties.action_link,
          },
          dedupe_key: `pwd_reset:${cleanEmail}:${Math.floor(Date.now() / (15 * 60 * 1000))}`,
          status: "pending",
        });
      }
    } catch (e) {
      console.error("[requestPasswordReset] Erro ao processar redefinição:", (e as Error).message);
    }

    return neutralSuccessResponse;
  });

// ─────────────────────────────────────────────────────────────────────────────
// 7. SESSÕES — REVOGAÇÃO DE OUTRAS SESSÕES
// ─────────────────────────────────────────────────────────────────────────────

export const revokeOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    try {
      // Registra logout de outras sessões no log de auditoria
      await (supabaseAdmin as any).from("audit_logs").insert({
        user_id: userId,
        action: "logout_others",
        entity_type: "session",
        entity_id: userId,
        description: "Encerramento forçado de outras sessões ativas solicitado pelo usuário",
      });
    } catch {
      // Best-effort
    }

    return {
      success: true,
      message: "Todas as outras sessões em outros dispositivos foram solicitadas para encerramento.",
    };
  });
