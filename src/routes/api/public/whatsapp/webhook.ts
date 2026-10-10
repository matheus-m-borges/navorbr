import { createFileRoute } from '@tanstack/react-router';
import { processWhatsAppMessage } from '@/lib/agent/agent.server';
import { verifyWebhookChallenge, verifyWebhookSignature } from '@/lib/security/webhook.server';

export const Route = createFileRoute('/api/public/whatsapp/webhook')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const challenge = url.searchParams.get('hub.challenge') || url.searchParams.get('challenge');

        if (challenge && verifyWebhookChallenge(request)) {
          return new Response(challenge, { status: 200 });
        }
        return new Response('Forbidden', { status: 403 });
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          const bodyText = await request.text();
          if (!bodyText) return new Response('Empty body', { status: 400 });
          if (!(await verifyWebhookSignature(request, bodyText))) {
            return new Response('Unauthorized', { status: 401 });
          }

          const body = JSON.parse(bodyText);
          const dataObj = body.data || body;

          // Ignorar mensagens de saída da própria empresa/bot (evita loops)
          if (dataObj.incoming_message === false || body.incoming_message === false) {
            return new Response(JSON.stringify({ status: 'ignored_outgoing_event' }), { status: 200 });
          }

          // ID único da mensagem (evita usar dataObj.id / body.id pois representam o contato na WhatsAble)
          let messageId =
            dataObj.message_id ||
            dataObj.wa_message_id ||
            dataObj.message?.id ||
            dataObj.key?.id ||
            body.message_id ||
            null;

          // Telefone do remetente
          let rawPhone =
            dataObj.phone_number ||
            dataObj.phone ||
            dataObj.recipient_phone ||
            dataObj.sender_phone ||
            dataObj.from ||
            dataObj.sender ||
            dataObj.recipient ||
            dataObj.contact?.phone ||
            dataObj.contact?.phone_number ||
            dataObj.message?.from ||
            body.phone_number ||
            body.phone ||
            body.recipient_phone ||
            body.sender_phone ||
            body.from ||
            body.sender;

          if (!rawPhone && dataObj.key?.remoteJid) {
            rawPhone = String(dataObj.key.remoteJid).replace(/@.*$/, '');
          }

          // Se veio aninhado no formato webhook Meta
          if (!rawPhone && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msg = body.entry[0].changes[0].value.messages[0];
            rawPhone = msg.from;
            if (!messageId && msg.id) messageId = msg.id;
          }

          // Extração resiliente de texto.
          // IMPORTANTE: a WhatsAble envia "last_messages" com a mensagem MAIS RECENTE na posição [0]
          // e também expõe "last_message_of_user". Priorizamos esses campos para nunca reprocessar
          // uma mensagem antiga do histórico.
          const pickText = (item: any): string | null => {
            if (!item) return null;
            if (typeof item === 'string') return item.trim() || null;
            if (typeof item === 'object') {
              const t = item.content || item.text || item.body || item.message || item.caption;
              if (typeof t === 'string' && t.trim()) return t.trim();
            }
            return null;
          };

          const parseMaybeJson = (val: any): any => {
            if (typeof val === 'string') {
              const trimmed = val.trim();
              if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try {
                  return JSON.parse(trimmed);
                } catch (_) {
                  return val;
                }
              }
            }
            return val;
          };

          let extractedText: string | null = null;

          // 1) Campo direto com a última mensagem do usuário
          extractedText =
            pickText(parseMaybeJson(dataObj.last_message_of_user)) ||
            pickText(parseMaybeJson(body.last_message_of_user));

          // 2) Array last_messages — a mais recente está em [0]
          if (!extractedText) {
            const listRaw = parseMaybeJson(dataObj.last_messages ?? body.last_messages);
            if (Array.isArray(listRaw)) {
              for (const item of listRaw) {
                const t = pickText(item);
                if (t) {
                  extractedText = t;
                  if (!messageId && item && typeof item === 'object' && (item.id || item.timestamp)) {
                    messageId = String(item.id || item.timestamp);
                  }
                  break;
                }
              }
            } else {
              const t = pickText(listRaw);
              if (t) extractedText = t;
            }
          }

          // 3) Demais formatos (Meta Cloud API e variações simples)
          if (!extractedText) {
            const fallbackCandidates = [
              body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body,
              dataObj.last_message,
              dataObj.text,
              dataObj.body,
              dataObj.message,
              dataObj.caption,
              dataObj.content,
              body.last_message,
              body.text,
              body.body,
              body.message,
              body.caption,
              body.content,
            ];
            for (const candidate of fallbackCandidates) {
              const t = pickText(parseMaybeJson(candidate));
              if (t) {
                extractedText = t;
                break;
              }
            }
          }

          const phoneNumber = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
          const messageText = extractedText;

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

          // Registrar recebimento do webhook em audit_logs para rastreamento no Admin
          try {
            await (supabaseAdmin as any).from('audit_logs').insert({
              entity_type: 'whatsapp_webhook',
              action: 'RECEIVE',
              description: 'Webhook de WhatsApp autenticado recebido.',
              after_data: { messageId, hasPhone: Boolean(phoneNumber), hasText: Boolean(messageText) },
              user_name: 'WhatsAble Webhook',
            });
          } catch (logErr) {
            console.warn('[Webhook Log Warning]:', logErr);
          }

          if (phoneNumber && messageText) {
            // Deduplicação segura com wa_message_id (apenas se for ID real de mensagem)
            if (messageId && typeof messageId === 'string' && messageId.length > 5) {
              const { data: existingEvent } = await (supabaseAdmin as any)
                .from('whatsapp_bot_events')
                .select('wa_message_id')
                .eq('wa_message_id', messageId)
                .maybeSingle();

              if (existingEvent) {
                console.log(`[Webhook Idempotency] Mensagem ${messageId} já processada.`);
                try {
                  await (supabaseAdmin as any).from('audit_logs').insert({
                    entity_type: 'whatsapp_webhook',
                    action: 'DEDUP_IGNORED',
                    description: `Mensagem repetida ignorada (ID: ${messageId}) para ${phoneNumber}`,
                    after_data: { messageId, phoneNumber, messageText },
                    user_name: 'Webhook Idempotência',
                  });
                } catch (_) {}
                return new Response('Already processed', { status: 200 });
              }

              await (supabaseAdmin as any).from('whatsapp_bot_events').insert({ wa_message_id: messageId });
            }

            // Processar mensagem e aguardar envio da resposta antes de encerrar request
            try {
              console.log(`[Webhook Inbound] Processando mensagem de ${phoneNumber}: "${messageText}"`);
              const reply = await processWhatsAppMessage(phoneNumber, messageText, messageId);
              console.log(`[Webhook Inbound] Resposta processada e enviada via WhatsAble: "${reply?.substring(0, 50)}..."`);

              try {
                await (supabaseAdmin as any).from('audit_logs').insert({
                  entity_type: 'whatsapp_webhook',
                  action: 'REPLY',
                  description: `Resposta IA enviada para ${phoneNumber}: ${reply?.substring(0, 120)}`,
                  after_data: { reply, messageId, messageText },
                  user_name: 'Assistente RepHub IA',
                });
              } catch (_) {}
            } catch (err: any) {
              console.error('[Webhook Inbound Error]:', err);
              try {
                await (supabaseAdmin as any).from('audit_logs').insert({
                  entity_type: 'error',
                  action: 'WHATSAPP_INBOUND_ERROR',
                  description: `Erro ao processar mensagem de ${phoneNumber}: ${err.message}`,
                  after_data: { error: err.message, stack: err.stack, phoneNumber, messageText },
                  user_name: 'Sistema WhatsApp',
                });
              } catch (_) {}
            }
          } else {
            console.log(`[Webhook] Evento recebido sem número ou texto válidos. Telefone: ${phoneNumber}, Texto: ${messageText}`);
          }

          return new Response('OK', { status: 200 });
        } catch (e: any) {
          console.error('Webhook processing error:', e);
          try {
            const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
            await (supabaseAdmin as any).from('audit_logs').insert({
              entity_type: 'error',
              action: 'WHATSAPP_WEBHOOK_FATAL',
              description: `Erro fatal no processamento do webhook: ${e.message}`,
              user_name: 'Sistema Webhook',
            });
          } catch (_) {}
          return new Response('Internal Server Error', { status: 500 });
        }
      },
    },
  },
});
