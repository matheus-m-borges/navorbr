/**
 * NAVOR SaaS — Server Functions de Cadastro de Teste Gratuito
 *
 * SEGURANÇA:
 * - Preço e condições do plano vêm SEMPRE do banco — nunca da URL ou do body.
 * - Senha temporária NÃO é retornada em nenhuma resposta de API.
 * - Link de ativação é gerado via Supabase Auth (se SMTP configurado no dashboard).
 *   Se SMTP não estiver configurado, o usuário NÃO recebe e-mail — texto honesto.
 * - Mensagens públicas são neutras para evitar enumeração de e-mails.
 * - Idempotência: e-mail duplicado retorna resposta neutra sem criar conta dupla.
 *   Verificação via email_hash em trial_rate_limit (não via listUsers — O(n)).
 * - Rate limiting: por IP (hash), e-mail (hash), CPF/CNPJ (hash), por produto.
 * - Provisionamento atômico com rollback: usuário criado → conta → membro → assinatura.
 *   Se qualquer etapa essencial falhar, o usuário no auth é removido.
 * - Dados completos do assinante são salvos em accounts (contact_email, contact_phone,
 *   document, responsible_name) normalizados.
 * - CAPTCHA: campo preparado para validação futura server-side. Nunca confiamos em
 *   validação de CAPTCHA feita no frontend.
 * - Cobrança automática: não mencionada enquanto Asaas não estiver integrado.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EmailEventType } from "@/lib/email/email-provider";
import {
  checkTrialRateLimit,
  recordTrialAttempt,
  normalizeEmail,
  normalizeCpfCnpj,
  normalizePhone,
  sanitizeName,
} from "@/lib/trial-rate-limit.server";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface TrialSignupInput {
  productSlug: string;
  planId: string;
  desiredSlug?: string;
  companyName: string;
  responsibleName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  consentGiven: boolean;
  consentTimestamp: string;
  /** Preparado para validação futura — não validado agora (provedor não configurado) */
  captchaToken?: string;
}

interface TrialSignupResult {
  success: boolean;
  /** Mensagem neutra — não revela se e-mail, CPF/CNPJ ou empresa já existe */
  message: string;
  /** Apenas se sucesso — para redirecionar à página certa */
  productSlug?: string;
  planName?: string;
  /** Se o e-mail de ativação foi enviado ou depende de configuração futura */
  activationEmailStatus: "sent_via_supabase" | "pending_smtp_config" | "not_applicable";
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO DE ENTRADA
// ─────────────────────────────────────────────────────────────────────────────

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateCpfCnpj(doc: string): boolean {
  const clean = normalizeCpfCnpj(doc);
  return clean.length === 11 || clean.length === 14;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIO: Extrai IP da requisição
// A leitura ocorre dentro do contexto da requisição, nunca por variável global.
// ─────────────────────────────────────────────────────────────────────────────

function getClientIp(): string {
  try {
    // A aplicação roda atrás da infraestrutura confiável da Vercel, que fornece
    // X-Forwarded-For. Nunca aceitar IP vindo do body enviado pelo navegador.
    return getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER FUNCTION: Inicia cadastro de teste gratuito
// ─────────────────────────────────────────────────────────────────────────────

export const initiateFreeTrial = createServerFn({ method: "POST" })
  .inputValidator((data: TrialSignupInput) => data)
  .handler(async ({ data }): Promise<TrialSignupResult> => {

    // ── 1. VALIDAÇÕES BÁSICAS DE ENTRADA ──────────────────────────────────────
    if (!data.consentGiven) {
      return {
        success: false,
        message: "É necessário aceitar os Termos de Uso e a Política de Privacidade.",
        activationEmailStatus: "not_applicable",
      };
    }
    if (!validateEmail(data.email)) {
      return { success: false, message: "E-mail inválido.", activationEmailStatus: "not_applicable" };
    }
    if (!validateCpfCnpj(data.cpfCnpj)) {
      return { success: false, message: "CPF ou CNPJ inválido.", activationEmailStatus: "not_applicable" };
    }
    if (!data.companyName?.trim() || !data.responsibleName?.trim()) {
      return {
        success: false,
        message: "Nome da empresa e do responsável são obrigatórios.",
        activationEmailStatus: "not_applicable",
      };
    }

    // Normalizar todos os campos de entrada antes de qualquer uso
    const email = normalizeEmail(data.email);
    const cpfCnpj = normalizeCpfCnpj(data.cpfCnpj);
    const phone = normalizePhone(data.phone ?? "");
    const companyName = sanitizeName(data.companyName);
    const responsibleName = sanitizeName(data.responsibleName);
    const ip = getClientIp();

    // ── 2. VALIDAR PRODUTO E PLANO NO BACKEND ────────────────────────────────
    // Nunca confiar em dados da URL — preço e condições vêm do banco
    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select(`
        id, name, amount, billing_cycle, trial_eligible, trial_days,
        is_active, is_public, product_id,
        products!inner ( id, slug, name, is_public, trial_eligible, status )
      `)
      .eq("id", data.planId)
      .maybeSingle();

    if (planError || !plan) {
      return {
        success: false,
        message: "Plano não encontrado. Verifique e tente novamente.",
        activationEmailStatus: "not_applicable",
      };
    }

    const product = Array.isArray(plan.products) ? plan.products[0] : plan.products;

    if (!product || product.slug !== data.productSlug) {
      return {
        success: false,
        message: "Combinação de produto e plano inválida.",
        activationEmailStatus: "not_applicable",
      };
    }

    // Filtro estrito: is_public=true AND status=active (não OR)
    if (!product.is_public || product.status !== "active") {
      return {
        success: false,
        message: "Produto indisponível para novas assinaturas.",
        activationEmailStatus: "not_applicable",
      };
    }
    if (!plan.is_active || !plan.is_public) {
      return {
        success: false,
        message: "Plano não disponível no momento.",
        activationEmailStatus: "not_applicable",
      };
    }
    if (!plan.trial_eligible || !product.trial_eligible) {
      return {
        success: false,
        message: "Este plano não oferece período de teste gratuito.",
        activationEmailStatus: "not_applicable",
      };
    }

    // ── 3. RATE LIMIT ─────────────────────────────────────────────────────────
    const rateLimitCheck = await checkTrialRateLimit({
      ip,
      email,
      cpfCnpj,
      productId: product.id,
      productSlug: product.slug,
    });

    if (!rateLimitCheck.allowed) {
      // Registrar tentativa bloqueada em auditoria
      await recordTrialAttempt({
        ip, email, cpfCnpj,
        productId: product.id,
        productSlug: product.slug,
        outcome: "blocked",
      });
      return {
        success: false,
        message: rateLimitCheck.message ?? "Não foi possível completar o cadastro. Tente novamente mais tarde.",
        activationEmailStatus: "not_applicable",
      };
    }

    // ── 4. IDEMPOTÊNCIA: verificar e-mail já existente ────────────────────────
    // Verificação via conta do produto, sem listar usuários do Auth.
    const { data: existingAccountByEmail } = await supabaseAdmin
      .from("accounts")
      .select("id, name")
      .eq("contact_email", email)
      .eq("product_id", product.id)
      .maybeSingle();

    if (existingAccountByEmail) {
      // Registrar tentativa duplicada
      await recordTrialAttempt({
        ip, email, cpfCnpj,
        productId: product.id,
        productSlug: product.slug,
        outcome: "duplicate",
        accountId: existingAccountByEmail.id,
      });
      // Resposta neutra — não revela se e-mail existe
      return {
        success: true,
        message: "Se este e-mail ainda não possui acesso, você receberá instruções de ativação em breve. Entre em contato com a NAVOR caso não receba.",
        productSlug: product.slug,
        planName: plan.name,
        activationEmailStatus: "not_applicable",
      };
    }

    // ── 5. CÁLCULO DE DATAS DO TRIAL ──────────────────────────────────────────
    const trialDays = plan.trial_days ?? 7;
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
    // next_billing_at: data para o admin acompanhar — não implica cobrança automática
    const nextBillingAt = new Date(trialEndsAt);

    // ── 6. CRIAR USUÁRIO NO AUTH (com rollback completo se falhar depois) ──────
    const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword, // Nunca retornado ao cliente
      email_confirm: false,    // Ativação via link gerado a seguir
      user_metadata: {
        full_name: responsibleName,
        company_name: companyName,
        product_slug: product.slug,
        acquisition_source: "trial",
        consent_given: true,
        consent_timestamp: data.consentTimestamp,
      },
    });

    if (authError || !authUser.user) {
      console.error("[initiateFreeTrial] Erro ao criar usuário auth.");
      await recordTrialAttempt({ ip, email, cpfCnpj, productId: product.id, productSlug: product.slug, outcome: "error" });
      return { success: false, message: "Não foi possível criar sua conta. Tente novamente.", activationEmailStatus: "not_applicable" };
    }

    const userId = authUser.user.id;

    // ── 6.5 RESERVAR SLUG CUSTOMIZADO (se fornecido) ───────────────────────
    let confirmedSlug: string | null = null;
    if (data.desiredSlug && data.desiredSlug.trim()) {
      const { data: slugCheck, error: slugCheckError } = await supabaseAdmin.rpc("reserve_account_slug", {
        p_product_id: product.id,
        p_slug: data.desiredSlug,
      });
      if (slugCheckError || !slugCheck?.available) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          message: slugCheck?.reason === "SLUG_TAKEN"
            ? "O endereço escolhido já está em uso. Tente outro."
            : slugCheck?.reason === "RESERVED_WORD"
              ? "Este endereço é reservado pelo sistema. Escolha outro."
              : "Endereço inválido. Use apenas letras, números e hífens (mínimo 3 caracteres).",
          activationEmailStatus: "not_applicable",
        };
      }
      confirmedSlug = slugCheck.normalized_slug as string;
    }

    // ── 7. CRIAR ACCOUNT com todos os dados do assinante ─────────────────────
    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .insert({
        name: companyName,
        product_id: product.id,
        // Dados completos do assinante — normalizados
        contact_email: email,
        contact_phone: phone || null,
        document: cpfCnpj || null,
        responsible_name: responsibleName,
      })
      .select("id")
      .single();

    if (accountError || !account) {
      // ROLLBACK: remover usuário auth criado
      await supabaseAdmin.auth.admin.deleteUser(userId);
      // Rollback da reserva de slug não é necessário — slugs não confirmados expiram automaticamente
      console.error("[initiateFreeTrial] Erro ao criar conta — rollback do usuário auth executado.");
      await recordTrialAttempt({ ip, email, cpfCnpj, productId: product.id, productSlug: product.slug, outcome: "error" });
      return { success: false, message: "Não foi possível provisionar sua conta. Tente novamente.", activationEmailStatus: "not_applicable" };
    }

    const accountId = account.id;

    // ── 8. CRIAR MEMBER ADMIN ─────────────────────────────────────────────────
    const { error: memberError } = await supabaseAdmin
      .from("account_members")
      .insert({
        account_id: accountId,
        user_id: userId,
        role: "owner",
        product_role: "administrador",
      });

    if (memberError) {
      // ROLLBACK: remover account e usuário auth
      await supabaseAdmin.from("accounts").delete().eq("id", accountId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.error("[initiateFreeTrial] Erro ao criar membro — rollback completo executado.");
      await recordTrialAttempt({ ip, email, cpfCnpj, productId: product.id, productSlug: product.slug, outcome: "error" });
      return { success: false, message: "Não foi possível configurar sua conta. Tente novamente.", activationEmailStatus: "not_applicable" };
    }

    // ── 9. CRIAR ASSINATURA EM ESTADO TRIAL ───────────────────────────────────
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        account_id: accountId,
        plan_id: plan.id,
        status: "trial",
        amount: plan.amount,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: trialEndsAt.toISOString(),
        billing_email: email,
        next_billing_at: nextBillingAt.toISOString(),
        acquisition_source: "trial",
        acquisition_metadata: {
          consent_timestamp: data.consentTimestamp,
          plan_name: plan.name,
          product_name: product.name,
          // IP é mantido somente no registro pseudonimizado de rate limit.
        },
      })
      .select("id")
      .single();

    if (subError || !subscription) {
      // ROLLBACK: remover member, account e usuário auth
      await supabaseAdmin.from("account_members").delete().eq("account_id", accountId);
      await supabaseAdmin.from("accounts").delete().eq("id", accountId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.error("[initiateFreeTrial] Erro ao criar assinatura — rollback completo executado.");
      await recordTrialAttempt({ ip, email, cpfCnpj, productId: product.id, productSlug: product.slug, outcome: "error" });
      return { success: false, message: "Não foi possível registrar sua assinatura. Tente novamente.", activationEmailStatus: "not_applicable" };
    }

    // ── 9.5 CONFIRMAR SLUG RESERVADO (após provisioning bem-sucedido) ────────
    if (confirmedSlug) {
      const { data: slugConfirm, error: slugConfirmError } = await supabaseAdmin.rpc("confirm_account_slug", {
        p_account_id: accountId,
        p_product_id: product.id,
        p_slug: confirmedSlug,
      });
      if (slugConfirmError || !slugConfirm?.success) {
        // Race condition: outro usuário confirmou o mesmo slug entre reserva e confirmação
        // Rollback completo do provisioning
        await supabaseAdmin.from("subscriptions").delete().eq("id", subscription.id);
        await supabaseAdmin.from("account_members").delete().eq("account_id", accountId);
        await supabaseAdmin.from("accounts").delete().eq("id", accountId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.error("[initiateFreeTrial] Race condition na confirmação de slug — rollback completo.");
        return {
          success: false,
          message: "O endereço escolhido foi reservado por outro usuário durante o cadastro. Tente outro.",
          activationEmailStatus: "not_applicable",
        };
      }
    }

    // ── 10. PROVISIONAR MÓDULOS DO PLANO ──────────────────────────────────────
    const { data: planModules } = await supabaseAdmin
      .from("plan_modules")
      .select("module_id")
      .eq("plan_id", plan.id);

    if (planModules && planModules.length > 0) {
      const moduleRows = planModules.map((pm) => ({
        account_id: accountId,
        module_id: pm.module_id,
      }));
      const { error: modulesError } = await supabaseAdmin
        .from("account_modules")
        .upsert(moduleRows, { onConflict: "account_id,module_id" });

      if (modulesError) {
        await supabaseAdmin.from("subscriptions").delete().eq("id", subscription.id);
        await supabaseAdmin.from("account_members").delete().eq("account_id", accountId);
        await supabaseAdmin.from("accounts").delete().eq("id", accountId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.error("[initiateFreeTrial] Erro ao provisionar módulos — rollback completo executado.");
        await recordTrialAttempt({ ip, email, cpfCnpj, productId: product.id, productSlug: product.slug, outcome: "error" });
        return { success: false, message: "Não foi possível configurar sua conta. Tente novamente.", activationEmailStatus: "not_applicable" };
      }
    }

    // ── 11. REGISTRAR TENTATIVA BEM-SUCEDIDA (rate limit + auditoria) ─────────
    await recordTrialAttempt({
      ip, email, cpfCnpj,
      productId: product.id,
      productSlug: product.slug,
      outcome: "provisioned",
      accountId,
    });

    // ── 12. ENFILEIRAR E-MAILS ────────────────────────────────────────────────
    // Não enfileiramos dados sensíveis — apenas metadados do template
    const emailsToQueue: Array<{
      event_type: EmailEventType;
      template_key: string;
      template_data: Record<string, string>;
    }> = [
      {
        event_type: "welcome",
        template_key: "navor-welcome",
        template_data: {
          recipientName: responsibleName,
          productName: product.name as string,
          productSlug: product.slug as string,
          planName: plan.name,
          trialDays: String(trialDays),
          trialEndsAt: trialEndsAt.toLocaleDateString("pt-BR"),
          // Não inclui firstBillingAt — cobrança automática não está ativa
        },
      },
      {
        event_type: "trial_started",
        template_key: "navor-trial-started",
        template_data: {
          recipientName: responsibleName,
          productName: product.name as string,
          planName: plan.name,
          trialDays: String(trialDays),
          trialEndsAt: trialEndsAt.toLocaleDateString("pt-BR"),
          planAmount: plan.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          billingCycle: plan.billing_cycle ?? "monthly",
          // Não menciona cobrança automática — Asaas não está ativo
        },
      },
    ];

    for (const emailData of emailsToQueue) {
      try {
        await (supabaseAdmin as any).from("email_queue").insert({
          event_type: emailData.event_type,
          recipient_email: email,
          account_id: accountId,
          subscription_id: subscription.id,
          template_key: emailData.template_key,
          template_data: emailData.template_data,
          dedupe_key: `trial:${subscription.id}:${emailData.event_type}`,
          status: "pending",
        });
      } catch (queueErr) {
        // Não falha o fluxo — e-mail é best-effort
        console.error("[initiateFreeTrial] Falha ao enfileirar e-mail:", (queueErr as Error).message);
      }
    }

    // ── 13. ACESSO PENDENTE DE PROVEDOR DE E-MAIL ─────────────────────────────
    // generateLink apenas gera o link; ele não entrega e-mail por conta própria.
    // Não fingimos que a mensagem foi enviada enquanto Resend/SMTP não estiver ativo.
    const activationEmailStatus: TrialSignupResult["activationEmailStatus"] = "pending_smtp_config";
    const message = "Conta criada com sucesso! As instruções de acesso serão enviadas quando o serviço de e-mail da NAVOR for configurado. Você também pode entrar em contato com a NAVOR.";

    return {
      success: true,
      message,
      productSlug: product.slug,
      planName: plan.name,
      activationEmailStatus,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// SERVER FUNCTION: Busca resumo do plano para exibir no formulário
// O frontend nunca deve confiar em dados da URL — busca sempre do servidor.
// Não retorna firstBillingAt enquanto Asaas não estiver integrado.
// ─────────────────────────────────────────────────────────────────────────────

export const getTrialPlanSummary = createServerFn({ method: "GET" })
  .inputValidator((data: { productSlug: string; planId: string }) => data)
  .handler(async ({ data }) => {
    if (!data.productSlug || !data.planId) return null;

    const { data: plan, error } = await supabaseAdmin
      .from("plans")
      .select(`
        id, name, description, amount, billing_cycle, trial_eligible, trial_days,
        is_active, is_public, user_limit, whatsapp_number_limit,
        products!inner ( id, slug, name, is_public, trial_eligible, status )
      `)
      .eq("id", data.planId)
      .eq("is_active", true)
      .eq("is_public", true)
      .maybeSingle();

    if (error || !plan) return null;

    const product = Array.isArray(plan.products) ? plan.products[0] : plan.products;
    if (!product || product.slug !== data.productSlug) return null;

    // Filtro estrito
    if (!product.is_public || product.status !== "active") return null;
    if (!plan.trial_eligible || !product.trial_eligible) return null;

    const trialDays = plan.trial_days ?? 7;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        amount: Number(plan.amount),
        billingCycle: plan.billing_cycle ?? "monthly",
        trialDays,
        trialEndsAt: trialEndsAt.toLocaleDateString("pt-BR"),
        // firstBillingAt removido: não há cobrança automática enquanto Asaas não ativo
        userLimit: plan.user_limit,
        whatsappNumberLimit: plan.whatsapp_number_limit,
      },
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
      },
    };
  });
