/**
 * NAVOR SaaS — Interface EmailProvider
 *
 * Define o contrato que qualquer provedor de e-mail deve implementar.
 * O provedor ativo é controlado pela variável de ambiente NAVOR_EMAIL_PROVIDER.
 *
 * SEGURANÇA:
 * - Nunca passar tokens, senhas ou links de ativação nos campos de template.
 * - Links de ativação devem ser gerados via Supabase Auth e enviados por lá,
 *   ou referenciados apenas por ID de convite — nunca em texto claro nos logs.
 * - Este arquivo NÃO deve ser importado em contexto de browser.
 */

export type EmailProviderName = "dev" | "resend";

export type EmailFailureCode =
  | "EMAIL_PROVIDER_NOT_CONFIGURED"
  | "EMAIL_PROVIDER_TEMPORARY_ERROR"
  | "EMAIL_PROVIDER_REJECTED";

export type EmailEventType =
  | "welcome"
  | "account_activation"
  | "trial_started"
  | "trial_ending_soon"
  | "charge_created"
  | "payment_approved"
  | "charge_overdue"
  | "access_suspended"
  | "access_reactivated"
  | "subscription_canceled"
  | "password_reset";

export interface EmailMessage {
  /** Tipo do evento — mapeia para um template */
  eventType: EmailEventType;
  /** E-mail do destinatário */
  to: string;
  /** Dados do template (nunca incluir senhas, tokens ou links privados) */
  templateData: Record<string, string | number | boolean>;
  /** ID da conta NAVOR para rastreio */
  accountId?: string;
  /** ID da assinatura para rastreio */
  subscriptionId?: string;
}

export type EmailSendSuccess = {
  success: true;
  /** ID da mensagem retornado e confirmado pelo provedor real (obrigatório em sucesso) */
  providerMessageId: string;
  errorSanitized?: undefined;
  failureCode?: undefined;
  retryable?: undefined;
};

export type EmailSendFailure = {
  success: false;
  providerMessageId?: undefined;
  /** Erro sanitizado (sem dados sensíveis) */
  errorSanitized: string;
  /** Código operacional para decidir se a fila deve tentar novamente. */
  failureCode: EmailFailureCode;
  /** Apenas erros transitórios podem voltar para pending. */
  retryable: boolean;
};

export type EmailSendResult = EmailSendSuccess | EmailSendFailure;

/**
 * Contrato central que qualquer EmailProvider deve implementar.
 */
export interface IEmailProvider {
  readonly providerName: EmailProviderName;
  readonly isActive: boolean;

  /** Envia um e-mail transacional */
  send(message: EmailMessage): Promise<EmailSendResult>;

  /** Verifica se o provedor está configurado e operacional */
  checkHealth(): Promise<{ healthy: boolean; message: string }>;
}

/**
 * Retorna o provedor ativo com base em NAVOR_EMAIL_PROVIDER.
 * Padrão seguro: 'dev' — apenas loga sem enviar.
 */
export async function getActiveEmailProvider(): Promise<IEmailProvider> {
  const providerName = (process.env["NAVOR_EMAIL_PROVIDER"] ?? "dev") as EmailProviderName;

  if (providerName === "resend") {
    const { ResendEmailProvider } = await import("./resend-email-provider");
    return new ResendEmailProvider();
  }

  const { DevelopmentEmailProvider } = await import("./dev-email-provider");
  return new DevelopmentEmailProvider();
}

/**
 * Mapeia cada tipo de evento para a chave de template correspondente.
 * Centralizado aqui para que todos os providers usem os mesmos identificadores.
 */
export const EMAIL_TEMPLATES: Record<EmailEventType, string> = {
  welcome:               "navor-welcome",
  account_activation:    "navor-account-activation",
  trial_started:         "navor-trial-started",
  trial_ending_soon:     "navor-trial-ending-soon",
  charge_created:        "navor-charge-created",
  payment_approved:      "navor-payment-approved",
  charge_overdue:        "navor-charge-overdue",
  access_suspended:      "navor-access-suspended",
  access_reactivated:    "navor-access-reactivated",
  subscription_canceled: "navor-subscription-canceled",
  password_reset:        "navor-password-reset",
};
