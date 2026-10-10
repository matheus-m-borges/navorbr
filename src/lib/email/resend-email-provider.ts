/**
 * NAVOR SaaS — ResendEmailProvider
 *
 * Esqueleto de implementação do provedor Resend.
 * NÃO envia e-mails reais enquanto RESEND_API_KEY não estiver configurada.
 *
 * SEGURANÇA CRÍTICA:
 * - A chave RESEND_API_KEY deve existir APENAS em process.env do servidor.
 * - NUNCA em variáveis VITE_*, banco de dados, logs ou respostas de API.
 * - NUNCA incluir tokens de ativação, senhas ou links privados nos templateData.
 * - Links de ativação devem ser gerados via Supabase Auth e enviados separadamente.
 * - Este arquivo NÃO deve ser importado em contexto de browser.
 *
 * Para ativar: definir NAVOR_EMAIL_PROVIDER=resend e RESEND_API_KEY no servidor.
 */

import type { IEmailProvider, EmailMessage, EmailSendResult } from "./email-provider";
import { EMAIL_TEMPLATES } from "./email-provider";

const RESEND_API_URL = "https://api.resend.com/emails";

function getResendConfig(): { apiKey: string; fromEmail: string } {
  const rawKey = process.env["RESEND_API_KEY"];
  const apiKey = typeof rawKey === "string" ? rawKey.trim() : "";
  const rawFrom = process.env["RESEND_FROM_EMAIL"];
  const fromEmail = typeof rawFrom === "string" && rawFrom.trim().length > 0
    ? rawFrom.trim()
    : "NAVOR Sistemas <contato@navorbr.com>";

  if (!apiKey) {
    throw new Error(
      "[ResendEmailProvider] RESEND_API_KEY não está configurada no ambiente do servidor. " +
      "Configure a chave e defina NAVOR_EMAIL_PROVIDER=resend para ativar o envio."
    );
  }

  return { apiKey, fromEmail };
}

/**
 * Mapeamento de template_key para assunto padrão do e-mail.
 * Quando o Resend for configurado com templates reativos, o assunto vem do template.
 */
const EMAIL_SUBJECTS: Record<string, string> = {
  "navor-welcome":               "Bem-vindo à NAVOR! 🎉",
  "navor-account-activation":    "Ative sua conta NAVOR",
  "navor-trial-started":         "Seu período de teste começou!",
  "navor-trial-ending-soon":     "Seu teste encerra em 3 dias",
  "navor-charge-created":        "Nova cobrança gerada — NAVOR",
  "navor-payment-approved":      "Pagamento confirmado — NAVOR",
  "navor-charge-overdue":        "Cobrança vencida — NAVOR",
  "navor-access-suspended":      "Acesso temporariamente suspenso — NAVOR",
  "navor-access-reactivated":    "Acesso reativado — NAVOR",
  "navor-subscription-canceled": "Assinatura cancelada — NAVOR",
  "navor-password-reset":        "Redefinição de senha — NAVOR",
};

export class ResendEmailProvider implements IEmailProvider {
  readonly providerName = "resend" as const;
  readonly isActive: boolean;

  constructor() {
    this.isActive = Boolean(process.env["RESEND_API_KEY"]?.trim());
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let config: { apiKey: string; fromEmail: string };
    try {
      config = getResendConfig();
    } catch {
      return {
        success: false,
        errorSanitized: "EMAIL_PROVIDER_NOT_CONFIGURED",
        failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
        retryable: false,
      };
    }
    const { apiKey, fromEmail } = config;
    const templateKey = EMAIL_TEMPLATES[message.eventType];
    const subject = EMAIL_SUBJECTS[templateKey] ?? "Notificação NAVOR";

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [message.to],
          subject,
          html: buildFallbackHtml(message.eventType, message.templateData),
        }),
      });

      if (!response.ok) {
        console.error(`[ResendEmailProvider] Erro HTTP ${response.status} ao enviar ${message.eventType}`);
        const isTemporary = response.status >= 500 || response.status === 429;
        return {
          success: false,
          errorSanitized: `HTTP ${response.status}`,
          failureCode: isTemporary
            ? "EMAIL_PROVIDER_TEMPORARY_ERROR"
            : "EMAIL_PROVIDER_REJECTED",
          retryable: isTemporary,
        };
      }

      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        return {
          success: false,
          errorSanitized: "Resposta JSON inválida do Resend",
          failureCode: "EMAIL_PROVIDER_TEMPORARY_ERROR",
          retryable: true,
        };
      }

      const id = typeof (parsed as any)?.id === "string" ? (parsed as any).id.trim() : "";
      if (!id) {
        return {
          success: false,
          errorSanitized: "Resposta HTTP 2xx do Resend sem ID válido",
          failureCode: "EMAIL_PROVIDER_REJECTED",
          retryable: false,
        };
      }

      return {
        success: true,
        providerMessageId: id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[ResendEmailProvider] Falha ao enviar e-mail:", message);
      return {
        success: false,
        errorSanitized: "Falha de rede ao comunicar com Resend",
        failureCode: "EMAIL_PROVIDER_TEMPORARY_ERROR",
        retryable: true,
      };
    }
  }

  async checkHealth(): Promise<{ healthy: boolean; message: string }> {
    if (!this.isActive) {
      return { healthy: false, message: "RESEND_API_KEY não configurada." };
    }
    try {
      const response = await fetch("https://api.resend.com/domains", {
        headers: { "Authorization": `Bearer ${process.env["RESEND_API_KEY"]}` },
      });
      if (!response.ok) return { healthy: false, message: `Resend respondeu HTTP ${response.status}.` };
      return { healthy: true, message: "Resend configurado e acessível." };
    } catch {
      return { healthy: false, message: "Não foi possível acessar o Resend." };
    }
  }
}

/**
 * Template HTML de fallback para quando não há template React configurado.
 * Nunca incluir dados sensíveis — apenas informações institucionais.
 */
function buildFallbackHtml(
  eventType: string,
  data: Record<string, string | number | boolean>,
): string {
  const name = String(data["recipientName"] ?? "Cliente");
  const product = String(data["productName"] ?? "NAVOR");
  const actionUrl = String(data["resetUrl"] || data["actionUrl"] || "https://www.navorbr.com");
  const actionButtonText = data["resetUrl"] ? "Redefinir Minha Senha" : "Acessar Plataforma";

  const bodyMessages: Record<string, string> = {
    welcome: `Olá, ${name}! Sua conta no ${product} foi criada com sucesso. Acesse a plataforma para começar.`,
    account_activation: `Olá, ${name}! Sua conta na NAVOR foi criada com sucesso. Clique no botão abaixo para confirmar seu acesso.`,
    password_reset: `Olá, ${name}! Recebemos uma solicitação de redefinição de senha para sua conta na NAVOR. Clique no botão abaixo para definir sua nova credencial de acesso com segurança. Se você não solicitou, desconsidere esta mensagem.`,
    trial_started: `Olá, ${name}! Seu período de teste no ${product} foi iniciado. Aproveite ${String(data["trialDays"] ?? 7)} dias gratuitos!`,
    trial_ending_soon: `Olá, ${name}! Seu período de teste no ${product} encerra em breve. Assine para continuar com acesso completo.`,
    payment_approved: `Olá, ${name}! Seu pagamento foi confirmado. Seu acesso ao ${product} está ativo.`,
    charge_overdue: `Olá, ${name}! Identificamos uma cobrança em atraso no ${product}. Regularize para manter o acesso.`,
    access_suspended: `Olá, ${name}! Seu acesso ao ${product} foi temporariamente suspenso. Entre em contato com o suporte.`,
    access_reactivated: `Olá, ${name}! Seu acesso ao ${product} foi reativado. Bem-vindo de volta!`,
    subscription_canceled: `Olá, ${name}! Sua assinatura do ${product} foi cancelada. Sentiremos sua falta!`,
  };

  const body = bodyMessages[eventType] ?? `Olá, ${name}! Você tem uma notificação do ${product}.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>NAVOR</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <img src="https://www.navorbr.com/logo.png" alt="NAVOR" style="height: 40px; margin-bottom: 24px;" />
  <p>${body}</p>
  <p style="margin-top: 24px;">
    <a href="${actionUrl}" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
      ${actionButtonText}
    </a>
  </p>
  <p style="color: #64748b; font-size: 12px; margin-top: 32px;">
    NAVOR Sistemas · <a href="https://www.navorbr.com">navorbr.com</a> · Este é um e-mail transacional oficial.
  </p>
</body>
</html>`;
}
