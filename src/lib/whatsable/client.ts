import {
  WhatsAbleSendResponse,
  WhatsAbleRecipient
} from './types';

/**
 * Cliente oficial WhatsAble / Notifyer Systems
 * Base URL: https://api.insightssystem.com
 *
 * Fonte: skills oficiais https://github.com/Whatsable/whatsapp-business-agent-skills
 * e https://docs.whatsable.app/guides/notifyer-system/agent-skills/platforms/lovable
 *
 * Auth modes:
 * - CONSOLE (templates, bots, broadcasts, webhooks): Authorization: Bearer <token>
 *     Origin: https://console.notifyer-systems.com
 * - CHAT (recipients, mensagens, labels): Authorization: <token> (token cru, SEM Bearer)
 *     Origin: https://chat.notifyer-systems.com
 *
 * Grupos:
 * - Templates: /api:AFRA_QCy/
 * - Bots: /api:ox_LN9zX/
 * - Broadcasts: /api:Mk_r6mq0/
 * - Chat (recipients/mensagens): /api:bVXsw_FD/
 * - Logs / Analytics: /api:qh9OQ3OW/
 * - Webhooks: /api:0hqyGRIz/
 * - Login / auth: /api:-4GSCDHb/
 */

const getBaseUrl = (): string => {
  const envUrl = typeof process !== 'undefined' ? process.env?.['NOTIFYER_API_BASE_URL'] : undefined;
  const url = envUrl || 'https://api.insightssystem.com';
  return url.replace(/\/+$/, '');
};

const getToken = (): string | null => {
  return (typeof process !== 'undefined' ? process.env?.['NOTIFYER_API_TOKEN'] : undefined) || null;
};

/**
 * Headers para a Console API (Templates, Bots, Broadcasts, Webhooks, Login)
 * Utiliza 'Authorization: Bearer <token>'
 */
/**
 * Headers para a Console API (Templates, Bots, Broadcasts, Webhooks, Login)
 * Utiliza 'Authorization: Bearer <token>'
 */
const getConsoleHeaders = (): HeadersInit => {
  const token = getToken();
  const cleanToken = token ? token.replace(/^Bearer\s+/i, '').trim() : '';
  return {
    'Content-Type': 'application/json',
    'Origin': 'https://console.notifyer-systems.com',
    ...(cleanToken ? { 'Authorization': `Bearer ${cleanToken}` } : {})
  };
};

/**
 * Headers para a Chat API (Mensagens, Recipients, Conversas)
 * REGRA OFICIAL: Authorization recebe o token CRU, sem prefixo Bearer.
 */
const getChatHeaders = (): HeadersInit => {
  const token = getToken();
  const cleanToken = token ? token.replace(/^Bearer\s+/i, '').trim() : '';
  return {
    'Content-Type': 'application/json',
    'Origin': 'https://chat.notifyer-systems.com',
    ...(cleanToken ? { 'Authorization': cleanToken } : {})
  };
};

/**
 * Converte para digits puros (com 55 se necessário)
 */
export function toDigitsPhone(phone: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    digits = `55${digits}`;
  }
  return digits;
}

/**
 * Converte para o formato internacional com '+' exigido pela API Notifier oficial (+55...)
 */
export function toInternationalPhoneWithPlus(phone: string): string {
  const digits = toDigitsPhone(phone);
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function toInternationalPhone(phone: string): string {
  return toDigitsPhone(phone);
}

/**
 * Helper para registrar envio externo em audit_logs (assíncrono e não-bloqueante)
 */
async function logOutboundAttempt(details: {
  toPhone: string;
  endpoint: string;
  status: number;
  success: boolean;
  responseBody?: string;
  error?: string;
}) {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await (supabaseAdmin as any).from('audit_logs').insert({
      entity_type: 'whatsapp_webhook',
      action: details.success ? 'WHATSABLE_SENT' : 'WHATSABLE_SEND_ERROR',
      description: `WhatsAble ${details.success ? 'Enviado com sucesso' : 'Falha no envio'} para ${details.toPhone} | Status: ${details.status} | Endpoint: ${details.endpoint}`,
      after_data: {
        toPhone: details.toPhone,
        endpoint: details.endpoint,
        status: details.status,
        success: details.success,
        response: details.responseBody?.substring(0, 500),
        error: details.error,
      },
      user_name: 'WhatsAble Client',
    });
  } catch (logErr) {
    console.warn('[WhatsAble Client] Falha ao gravar audit_log de envio:', logErr);
  }
}

/**
 * Envia mensagem de texto via WhatsAble:
 * 1. Tenta a Chat API (/api:bVXsw_FD/web/send/text) com token cru e Origin chat.notifyer-systems.com
 *    (Conecta diretamente ao espelho de conversas e suporte do WhatsAble)
 * 2. Em caso de falha, tenta a API oficial Notifier (POST /api:-GWQv5aM/send com Bearer)
 */
export async function sendWhatsAppTextMessage(
  toPhone: string,
  message: string,
  options?: {
    attachmentUrl?: string;
    filename?: string;
  }
): Promise<WhatsAbleSendResponse> {
  const token = getToken();
  if (!token) {
    console.warn('[WhatsAble] NOTIFYER_API_TOKEN não está configurado nos Secrets. Mensagem não enviada à API externa.');
    return {
      success: false,
      error: 'NOTIFYER_API_TOKEN não configurado.'
    };
  }

  const baseUrl = getBaseUrl();
  const phoneDigits = toDigitsPhone(toPhone);
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const phoneNumber = parseInt(phoneDigits, 10);

  // =========================================================================
  // 1. TENTATIVA PRINCIPAL: Chat API (/api:bVXsw_FD/web/send/text ou /document)
  // Oficial para conversas ativas no WhatsAble (chat.notifyer-systems.com)
  // =========================================================================
  if (Number.isFinite(phoneNumber)) {
    const chatEndpoint = options?.attachmentUrl
      ? `${baseUrl}/api:bVXsw_FD/web/send/document`
      : `${baseUrl}/api:bVXsw_FD/web/send/text`;

    const chatPayload: Record<string, unknown> = options?.attachmentUrl
      ? {
          phone_number: phoneNumber,
          type: 'document',
          document: {
            link: options.attachmentUrl,
            ...(options.filename ? { filename: options.filename } : {})
          },
          text: message
        }
      : {
          phone_number: phoneNumber,
          text: message
        };

    try {
      console.log(`[WhatsAble Client] Enviando via Chat API para ${phoneNumber}...`);
      const chatRes = await fetch(chatEndpoint, {
        method: 'POST',
        headers: getChatHeaders(),
        body: JSON.stringify(chatPayload)
      });

      const chatRaw = await chatRes.text();
      let chatData: any = null;
      try { chatData = chatRaw ? JSON.parse(chatRaw) : null; } catch (_) { chatData = { raw: chatRaw }; }

      const chatHasError = !chatRes.ok || (chatData && typeof chatData === 'object' && (
        chatData.success === false ||
        chatData.status === 'error' ||
        chatData.status === 'failed' ||
        (chatData.code && String(chatData.code).toUpperCase().includes('ERROR')) ||
        (chatData.error && typeof chatData.error === 'string')
      ));

      if (!chatHasError) {
        console.log('[WhatsAble Client] Mensagem entregue com sucesso via Chat API:', chatData);
        await logOutboundAttempt({
          toPhone,
          endpoint: '/api:bVXsw_FD/web/send/text',
          status: chatRes.status,
          success: true,
          responseBody: chatRaw,
        });
        return {
          success: true,
          status_code: chatRes.status,
          message_id: chatData?.message_id || chatData?.id || chatData?.chat_log_id || 'sent',
          data: chatData
        };
      }

      console.warn(`[WhatsAble Client] Chat API retornou erro (${chatRes.status}): ${chatRaw}. Tentando Notifier API...`);
      await logOutboundAttempt({
        toPhone,
        endpoint: '/api:bVXsw_FD/web/send/text',
        status: chatRes.status,
        success: false,
        responseBody: chatRaw,
        error: chatData?.error || chatData?.message || `Status ${chatRes.status}`,
      });
    } catch (err: any) {
      console.warn('[WhatsAble Client] Exceção na Chat API:', err.message, 'Tentando Notifier API...');
    }
  }

  // =========================================================================
  // 2. FALLBACK: Notifier API (POST /api:-GWQv5aM/send com Bearer)
  // =========================================================================
  const phoneWithPlus = toInternationalPhoneWithPlus(toPhone);
  const notifierEndpoint = `${baseUrl}/api:-GWQv5aM/send`;
  const notifierPayload: Record<string, unknown> = {
    phone: phoneWithPlus,
    text: message,
    ...(options?.attachmentUrl
      ? { attachment: options.attachmentUrl, filename: options.filename || 'arquivo' }
      : {})
  };

  try {
    console.log(`[WhatsAble Client] Tentando fallback via Notifier API para ${phoneWithPlus}...`);
    const notifierRes = await fetch(notifierEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://console.notifyer-systems.com',
        'Authorization': `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(notifierPayload)
    });

    const notifierRaw = await notifierRes.text();
    let notifierData: any = null;
    try { notifierData = notifierRaw ? JSON.parse(notifierRaw) : null; } catch (_) { notifierData = { raw: notifierRaw }; }

    const notifierHasError = !notifierRes.ok || (notifierData && typeof notifierData === 'object' && (
      notifierData.success === false ||
      notifierData.status === 'error' ||
      notifierData.status === 'failed' ||
      (notifierData.code && String(notifierData.code).toUpperCase().includes('ERROR')) ||
      (notifierData.error && typeof notifierData.error === 'string')
    ));

    if (!notifierHasError) {
      console.log('[WhatsAble Client] Mensagem entregue com sucesso via Notifier API fallback.');
      await logOutboundAttempt({
        toPhone,
        endpoint: '/api:-GWQv5aM/send',
        status: notifierRes.status,
        success: true,
        responseBody: notifierRaw,
      });
      return {
        success: true,
        status_code: notifierRes.status,
        message_id: notifierData?.message_id || notifierData?.id || 'sent',
        data: notifierData
      };
    }

    console.error(`[WhatsAble Client] Notifier API também falhou (${notifierRes.status}):`, notifierRaw);
    await logOutboundAttempt({
      toPhone,
      endpoint: '/api:-GWQv5aM/send',
      status: notifierRes.status,
      success: false,
      responseBody: notifierRaw,
      error: notifierData?.error || notifierData?.message || `Status ${notifierRes.status}`,
    });

    return {
      success: false,
      status_code: notifierRes.status,
      error: `WhatsAble recusou o envio em ambas APIs: ${notifierRaw}`,
      data: notifierData
    };
  } catch (error: any) {
    console.error('[WhatsAble Client] Erro de rede ao conectar à WhatsAble:', error.message);
    await logOutboundAttempt({
      toPhone,
      endpoint: '/api:-GWQv5aM/send',
      status: 0,
      success: false,
      error: error.message,
    });
    return {
      success: false,
      error: 'Erro de conexão com WhatsAble: ' + error.message
    };
  }
}

/**
 * Envia mensagem via template pré-aprovado da WhatsAble (janela de 24h fechada).
 * Oficial: POST /api:bVXsw_FD/web/send/template
 * Body: { phone_number, name (ou template_id), variables, scheduled_time: 0 = imediato }
 */
export async function sendWhatsAppTemplateMessage(
  toPhone: string,
  templateId: string,
  variables: Record<string, string> = {},
  options?: {
    scheduleTimestamp?: number;
    globalLabels?: string[];
  }
): Promise<WhatsAbleSendResponse> {
  const token = getToken();
  if (!token) {
    return { success: false, error: 'NOTIFYER_API_TOKEN não configurado.' };
  }

  const baseUrl = getBaseUrl();
  const phoneNumber = parseInt(toInternationalPhone(toPhone), 10);
  const endpoint = `${baseUrl}/api:bVXsw_FD/web/send/template`;

  const payload = {
    phone_number: phoneNumber,
    name: templateId,
    template_id: templateId,
    variables,
    scheduled_time: options?.scheduleTimestamp ?? 0
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: getChatHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[WhatsAble] Erro ao enviar template (${res.status}):`, errText);
      return { success: false, status_code: res.status, error: `Falha no envio do template (status ${res.status}): ${errText}` };
    }

    const data = await res.json();
    return {
      success: true,
      status_code: res.status,
      message_id: data?.message_id || data?.id || data?.chat_log_id,
      data
    };
  } catch (error: any) {
    return { success: false, error: 'Erro de rede ao enviar template.' };
  }
}

/**
 * PATCH DE RECIPIENT — Regra Obrigatória WhatsAble:
 * 1. Executar GET do registro completo
 * 2. Recuperar todos os campos existentes
 * 3. Alterar somente o necessário
 * 4. Enviar o registro completo no PATCH
 */
export async function updateRecipientSafely(
  recipientId: string,
  updates: Partial<WhatsAbleRecipient>
): Promise<{ success: boolean; data?: any; error?: string }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api:bVXsw_FD/web/recipient/${recipientId}`;

  try {
    // Passo 1 & 2: GET do registro completo
    const getRes = await fetch(url, {
      method: 'GET',
      headers: getChatHeaders()
    });

    if (!getRes.ok) {
      return { success: false, error: `Falha ao obter recipient: status ${getRes.status}` };
    }

    const currentRecipient = await getRes.json();

    // Passo 3: Mesclar campos mantendo dados intactos
    const completeMergedRecord = {
      ...currentRecipient,
      ...updates,
      // Garantir que labels permaneçam array de strings
      global_label: Array.isArray(updates.global_label)
        ? updates.global_label
        : (Array.isArray(currentRecipient.global_label) ? currentRecipient.global_label : [])
    };

    // Passo 4: Enviar o registro completo no PATCH
    const patchRes = await fetch(url, {
      method: 'PATCH',
      headers: getChatHeaders(),
      body: JSON.stringify(completeMergedRecord)
    });

    if (!patchRes.ok) {
      return { success: false, error: `Falha ao atualizar recipient: status ${patchRes.status}` };
    }

    const updatedData = await patchRes.json();
    return { success: true, data: updatedData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Testa conectividade com a API da WhatsAble.
 * Usa o endpoint oficial de identidade /api:-4GSCDHb/auth/me (Console, Bearer).
 * Retorna a mensagem original da WhatsAble em caso de falha, para diagnóstico.
 */
export async function testWhatsAbleConnection(): Promise<{ success: boolean; message: string }> {
  const token = getToken();
  if (!token) {
    return {
      success: false,
      message: 'NOTIFYER_API_TOKEN não está configurado nos Secrets.'
    };
  }

  const baseUrl = getBaseUrl();
  const testUrl = `${baseUrl}/api:-4GSCDHb/auth/me`;

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: getConsoleHeaders()
    });

    if (!res.ok) {
      const body = await res.text();
      let apiMessage = body;
      try {
        apiMessage = JSON.parse(body)?.message || body;
      } catch (_) { /* mantém texto cru */ }

      if (apiMessage.includes('different object type')) {
        return {
          success: false,
          message: 'Token recusado: pertence a outro objeto da plataforma. Use a chave de API do painel do Notifier (Settings → API).'
        };
      }
      return {
        success: false,
        message: `Token recusado pela WhatsAble (status ${res.status}): ${apiMessage}`
      };
    }

    const data = await res.json().catch(() => null);
    const who = data?.name ? ` (conectado como ${data.name})` : '';
    return {
      success: true,
      message: `Conexão com a WhatsAble estabelecida com sucesso!${who}`
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Erro de rede ao conectar à WhatsAble: ' + err.message
    };
  }
}
