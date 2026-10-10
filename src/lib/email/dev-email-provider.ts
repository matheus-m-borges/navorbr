/**
 * NAVOR SaaS — DevelopmentEmailProvider
 *
 * Provedor de e-mail para desenvolvimento. Usado quando NAVOR_EMAIL_PROVIDER=dev
 * (padrão seguro) ou quando nenhuma variável está configurada.
 *
 * COMPORTAMENTO:
 * - Registra o evento de e-mail nos logs do servidor (sem dados sensíveis).
 * - Nunca envia e-mail real.
 * - Nunca loga tokens, senhas, links de ativação ou dados de pagamento.
 * - Nunca retorna sucesso simulado: sem um provedor real, o envio não ocorreu.
 *
 * Útil para desenvolvimento e para que a fila email_queue seja populada
 * sem necessidade de Resend configurado.
 */

import type { IEmailProvider, EmailMessage, EmailSendResult } from "./email-provider";
import { EMAIL_TEMPLATES } from "./email-provider";

// Campos que NUNCA devem aparecer em logs — removidos preventivamente
const SENSITIVE_KEYS = [
  "password", "senha", "token", "secret", "key", "activation_link",
  "reset_link", "card", "cvv", "cardNumber", "cpf", "cnpj", "document",
];

function sanitizeTemplateData(data: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
    sanitized[key] = isSensitive ? "[REDACTED]" : value;
  }
  return sanitized;
}

export class DevelopmentEmailProvider implements IEmailProvider {
  readonly providerName = "dev" as const;
  readonly isActive = false;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const templateKey = EMAIL_TEMPLATES[message.eventType];
    const safeData = sanitizeTemplateData(message.templateData);

    // Log estruturado — sem dados sensíveis
    console.info("[EmailProvider:dev] E-mail registrado (não enviado):", {
      eventType: message.eventType,
      templateKey,
      to: message.to.replace(/(.{2}).*(@.*)/, "$1***$2"), // mascara o e-mail
      accountId: message.accountId,
      subscriptionId: message.subscriptionId,
      templateData: safeData,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      errorSanitized: "EMAIL_PROVIDER_NOT_CONFIGURED",
      failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
      retryable: false,
    };
  }

  async checkHealth(): Promise<{ healthy: boolean; message: string }> {
    return {
      healthy: false,
      message: "Nenhum provedor real de e-mail está configurado. " +
               "Configure NAVOR_EMAIL_PROVIDER=resend e RESEND_API_KEY para ativar envio real.",
    };
  }
}
