import OpenAI from 'openai';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { sendWhatsAppTextMessage } from '@/lib/whatsable/client';

const AI_MODEL = process.env['AGENT_AI_MODEL'] || 'google/gemini-3.8-flash';

const getDirectAI = () => {
  const openAiKey = process.env['OPENAI_API_KEY'];
  if (openAiKey) {
    return {
      client: new OpenAI({ apiKey: openAiKey }),
      model: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
    };
  }
  const geminiKey = process.env['GEMINI_API_KEY'];
  if (geminiKey) {
    return {
      client: new OpenAI({
        apiKey: geminiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      }),
      model: process.env['GEMINI_MODEL'] || 'gemini-1.5-flash',
    };
  }
  return null;
};

export const processWhatsAppMessage = async (
  phoneNumber: string,
  messageText: string,
  messageId?: string,
  simulationContext?: { accountId?: string; userId?: string }
): Promise<string> => {
  const isSimulation = phoneNumber.startsWith('sim-') || !!simulationContext;
  const cleanPhone = isSimulation ? phoneNumber : phoneNumber.replace(/\D/g, '');
  const cleanMsg = messageText.trim();
  const lowerMsg = cleanMsg.toLowerCase();

  // Função resiliente para telefones brasileiros (lida com 55, DDD e presença/ausência do 9º dígito)
  const matchBrazilianPhone = (phoneA: string, phoneB: string): boolean => {
    const a = (phoneA || '').replace(/\D/g, '');
    const b = (phoneB || '').replace(/\D/g, '');
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.endsWith(b) || b.endsWith(a)) return true;

    const last8A = a.slice(-8);
    const last8B = b.slice(-8);
    if (last8A.length === 8 && last8A === last8B) {
      const wA = a.slice(0, -8).replace(/^55/, '');
      const wB = b.slice(0, -8).replace(/^55/, '');
      const dddA = wA.length === 3 ? wA.slice(0, 2) : wA;
      const dddB = wB.length === 3 ? wB.slice(0, 2) : wB;
      if (!dddA || !dddB || dddA === dddB) return true;
    }
    return false;
  };

  let sessionPhone: string = cleanPhone;
  let accountId: string | null = simulationContext?.accountId ?? null;
  let userId: string | null = simulationContext?.userId ?? null;

  if (isSimulation) {
    if (accountId && !userId) {
      const { data: member } = await (supabaseAdmin as any)
        .from('account_members')
        .select('user_id')
        .eq('account_id', accountId)
        .order('role', { ascending: true })
        .limit(1)
        .maybeSingle();
      userId = member?.user_id ?? null;
    }
    if (!accountId || !userId) {
      return 'Nenhuma conta de assinante configurada para executar a simulação.';
    }

    // Garante que o número de simulação exista em whatsapp_bot_numbers
    // para satisfazer a foreign key whatsapp_bot_sessions_phone_number_fkey,
    // mas com active: false para NÃO consumir os limites do assinante
    try {
      await (supabaseAdmin as any)
        .from('whatsapp_bot_numbers')
        .upsert({
          phone_number: sessionPhone,
          account_id: accountId,
          user_id: userId,
          active: false,
        }, { onConflict: 'phone_number' });
    } catch (_) {}
  } else {
    // 1. Identificar número e autorização com join do tenant (account_id)
    const { data: allNumbers } = await (supabaseAdmin as any)
      .from('whatsapp_bot_numbers')
      .select('phone_number, user_id, account_id, active')
      .eq('active', true);

    // Priorizar match com account_id associado (evita colidir com números legados sem conta)
    let botNumber = (allNumbers || []).find((n: any) => n.phone_number === cleanPhone && n.account_id) ||
                    (allNumbers || []).find((n: any) => matchBrazilianPhone(n.phone_number, cleanPhone) && n.account_id) ||
                    (allNumbers || []).find((n: any) => n.phone_number === cleanPhone) ||
                    (allNumbers || []).find((n: any) => matchBrazilianPhone(n.phone_number, cleanPhone)) ||
                    null;

    if (!botNumber || !botNumber.active) {
      const unauthReply = 'Olá! Este número de WhatsApp não possui autorização para operar no Navor RepHub.';
      await sendWhatsAppTextMessage(cleanPhone, unauthReply);
      return unauthReply;
    }

    sessionPhone = botNumber.phone_number;
    accountId = botNumber.account_id ?? null;
    userId = botNumber.user_id ?? null;

    // Se a linha casada não tem account_id, busca em registros irmãos com mesmo telefone
    if (!accountId) {
      const sibling = (allNumbers || []).find((n: any) => matchBrazilianPhone(n.phone_number, cleanPhone) && n.account_id);
      if (sibling?.account_id) {
        accountId = sibling.account_id;
        if (!userId) userId = sibling.user_id;
      }
    }

    if (userId && !accountId) {
      const { data: memberships } = await (supabaseAdmin as any)
        .from('account_members')
        .select('account_id')
        .eq('user_id', userId);
      if ((memberships || []).length === 1) accountId = memberships[0].account_id ?? null;
    }

    // Se user_id não estiver vinculado ao número, obtém usuário principal da conta
    if (accountId && !userId) {
      const { data: member } = await (supabaseAdmin as any)
        .from('account_members')
        .select('user_id')
        .eq('account_id', accountId)
        .order('role', { ascending: true })
        .limit(1)
        .maybeSingle();
      userId = member?.user_id ?? null;
    }

    if (!accountId || !userId) {
      const unauthReply = 'Olá! Este número de WhatsApp não possui uma conta de assinante associada no Navor RepHub.';
      await sendWhatsAppTextMessage(cleanPhone, unauthReply);
      return unauthReply;
    }

    // Auto-cura: atualiza registros legados sem conta para evitar futuras colisões
    try {
      await (supabaseAdmin as any)
        .from('whatsapp_bot_numbers')
        .update({ account_id: accountId, user_id: userId })
        .is('account_id', null)
        .eq('active', true);
    } catch (_) {}
  }

  // 2. Carregar configurações do bot do tenant (quando houver conta)
  const { data: botSettings } = accountId
    ? await (supabaseAdmin as any)
        .from('whatsapp_bot_settings')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle()
    : { data: null };

  if (botSettings?.is_active === false) {
    const pauseReply = 'O assistente de IA via WhatsApp está temporariamente pausado para esta conta. Contate o administrador.';
    await sendWhatsAppTextMessage(cleanPhone, pauseReply);
    return pauseReply;
  }

  const botName = botSettings?.bot_name || 'Assistente RepHub';
  const botPersonality = botSettings?.bot_personality || 'Ágil, profissional e focado em vendas';
  const customSystemPrompt = botSettings?.custom_system_prompt || '';

  // 3. Obter ou criar sessão ativa
  let { data: session } = await (supabaseAdmin as any)
    .from('whatsapp_bot_sessions')
    .select('*')
    .eq('phone_number', sessionPhone)
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    const { data: newSession, error: sErr } = await (supabaseAdmin as any)
      .from('whatsapp_bot_sessions')
      .insert({
        account_id: accountId,
        phone_number: sessionPhone,
        user_id: userId,
        status: 'active',
        collected: {},
        context: {},
      })
      .select('*')
      .single();

    if (sErr || !newSession) throw new Error('Erro ao inicializar sessão: ' + sErr?.message);
    session = newSession;
  }

  // 4. Salvar mensagem recebida
  await (supabaseAdmin as any).from('whatsapp_bot_messages').insert({
    account_id: accountId,
    user_id: userId,
    phone_number: cleanPhone,
    session_id: session.id,
    direction: 'inbound',
    wa_message_id: messageId ?? null,
    body: cleanMsg,
  });

  let reply = '';

  // ==========================================
  // ATALHOS DETERMINÍSTICOS
  // ==========================================

  // Cancelamento
  if (['cancelar', 'cancel', 'desisto', 'sair', 'parar'].includes(lowerMsg)) {
    await (supabaseAdmin as any)
      .from('whatsapp_bot_sessions')
      .update({
        pending_action: null,
        pending_confirmation: false,
        collected: {},
        context: {},
        intent: null,
      })
      .eq('id', session.id);

    reply = 'Operação cancelada. Nenhuma alteração foi realizada.';
    await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
    return reply;
  }

  // Ajuda / Menu
  if (['ajuda', 'menu', 'o que posso fazer?', 'comandos', 'help'].includes(lowerMsg)) {
    reply = `*${botName} — Posso te ajudar a:*\n\n1. *Criar Pedido* (ex: "Inclua pedido Loja ABC de R$ 13.500 com 110 peças")\n2. *Cadastrar Cliente* (ex: "Cadastre a Loja Nova Esperança")\n3. *Criar Lead* (ex: "Crie lead Loja Central para marca Alphabeto")\n4. *Lançar Despesa* (ex: "Lance despesa de R$ 350 combustível")\n5. *Consultas* (ex: "Qual o último pedido da Loja ABC?")\n6. *Cancelar* (digite "cancelar" a qualquer momento)`;
    await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
    return reply;
  }

  // Confirmação pendente
  if (session.pending_confirmation && session.pending_action) {
    const isYes = ['1', 'sim', 's', 'confirmar', 'confirmo', 'pode criar', 'ok'].includes(lowerMsg);
    const isNo = ['2', 'nao', 'não', 'n', 'cancelar'].includes(lowerMsg);

    if (isYes) {
      let actionObj: any = null;
      try {
        actionObj = typeof session.pending_action === 'string'
          ? JSON.parse(session.pending_action)
          : session.pending_action;
      } catch (_) {
        actionObj = null;
      }

      if (!actionObj || !actionObj.type) {
        reply = 'Houve um problema com a ação pendente. Por favor, reinicie a operação.';
      } else {
        reply = await executeServerAction(accountId, userId, cleanPhone, actionObj);
      }

      await (supabaseAdmin as any)
        .from('whatsapp_bot_sessions')
        .update({ pending_confirmation: false, pending_action: null, collected: {}, context: {} })
        .eq('id', session.id);

      await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
      return reply;
    } else if (isNo) {
      await (supabaseAdmin as any)
        .from('whatsapp_bot_sessions')
        .update({ pending_confirmation: false, pending_action: null, collected: {}, context: {} })
        .eq('id', session.id);

      reply = 'Operação cancelada. O que mais posso fazer por você?';
      await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
      return reply;
    } else {
      reply = 'Por favor, responda com *1* para Confirmar ou *2* para Cancelar.';
      await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
      return reply;
    }
  }

  // Resolução de escolhas ativas (ex: cliente ou coleção ambígua)
  const sessionContext = session.context || {};
  if (sessionContext.awaiting_choice && Array.isArray(sessionContext.choice_options)) {
    const choiceIdx = parseInt(lowerMsg, 10);
    if (!isNaN(choiceIdx) && choiceIdx >= 1 && choiceIdx <= sessionContext.choice_options.length) {
      const selected = sessionContext.choice_options[choiceIdx - 1];
      const currentCollected = session.collected || {};

      if (sessionContext.awaiting_choice === 'client') {
        currentCollected.client_id = selected.id;
        currentCollected.client_name = selected.name;
      } else if (sessionContext.awaiting_choice === 'brand') {
        currentCollected.brand_id = selected.id;
        currentCollected.brand_name = selected.name;
      } else if (sessionContext.awaiting_choice === 'collection') {
        currentCollected.collection_id = selected.collection_id || selected.id;
        currentCollected.brand_collection_id = selected.id;
        currentCollected.collection_name = selected.name;
      }

      const nextContext = { ...sessionContext };
      delete nextContext.awaiting_choice;
      delete nextContext.choice_options;

      await (supabaseAdmin as any)
        .from('whatsapp_bot_sessions')
        .update({ collected: currentCollected, context: nextContext })
        .eq('id', session.id);

      reply = await continueOrderPipeline(session.id, accountId, userId, currentCollected);
      await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
      return reply;
    }
  }

  // ==========================================
  // INTELIGÊNCIA ARTIFICIAL (LOVABLE AI)
  // ==========================================
  const { data: tenantBrands } = await (supabaseAdmin as any)
    .from('brands')
    .select('id, brand, company_name, trade_name')
    .eq('account_id', accountId)
    .limit(20);

  const { data: recentMsgs } = await (supabaseAdmin as any)
    .from('whatsapp_bot_messages')
    .select('direction, body')
    .eq('session_id', session.id)
    .order('created_at', { ascending: false })
    .limit(6);

  const historyFormatted = (recentMsgs || []).reverse().map((m: any) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.body,
  }));

  const currentDate = new Date().toLocaleDateString('pt-BR');

  const systemPrompt = `Você é ${botName}, agente operacional do Navor RepHub (CRM de Representação Comercial).
Personalidade: ${botPersonality}.
Data de hoje: ${currentDate}.
${customSystemPrompt ? `Instruções específicas do assinante:\n${customSystemPrompt}\n` : ''}

Marcas disponíveis no RepHub:
${(tenantBrands || []).map((b: any) => `- ${b.brand || b.trade_name || b.company_name} (id: ${b.id})`).join('\n')}

Dados já coletados na sessão atual:
${JSON.stringify(session.collected || {})}

REGRAS DE COMUNICAÇÃO (OBRIGATÓRIAS — cada mensagem enviada tem custo):
1. Responda em JSON estrito, sem texto fora do JSON.
2. "reply_text" deve ser DIRETO: no máximo 2 linhas curtas, sem saudações ("Olá", "Tudo bem"), sem agradecimentos, sem "aguarde", sem "estou verificando", sem repetir o menu, sem emojis decorativos.
3. NUNCA repita o menu de ajuda a não ser que o usuário peça "ajuda".
4. Se faltar UM dado para executar, pergunte SOMENTE esse dado, em uma única frase curta.
5. NUNCA invente clientes, marcas, coleções, valores ou resultados. Dados vêm sempre do sistema.
6. Nunca exclua nada e nunca prometa excluir.
7. Pedido: identifique cliente, marca, coleção, peças e valor.
8. Consultas: classifique em "query" e preencha "query_type" corretamente; não escreva números você mesmo — o sistema busca no banco e responde.

SCHEMA JSON DE RESPOSTA:
{
  "intent": "create_order" | "create_client" | "create_lead" | "create_expense" | "query" | "general_chat",
  "query_type": "last_order" | "client_orders" | "sales_summary" | "client_info" | "top_clients" | "pending_orders" | null,
  "extracted": {
    "client_name": string | null,
    "client_id": string | null,
    "brand_name": string | null,
    "brand_id": string | null,
    "collection_name": string | null,
    "total_pieces": number | null,
    "total_value": number | null,
    "expense_description": string | null,
    "expense_value": number | null,
    "lead_company": string | null,
    "period": "hoje" | "semana" | "mes" | "ano" | null
  },
  "reply_text": string
}`;

  let aiResult: any = null;

  // 1. Tentar IA Direta (OpenAI ou Gemini)
  const directAI = getDirectAI();
  if (directAI) {
    try {
      const completion = await directAI.client.chat.completions.create({
        model: directAI.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyFormatted,
          { role: 'user', content: cleanMsg },
        ],
        temperature: 0.1,
      });

      const raw = completion.choices[0]?.message?.content;
      if (raw) aiResult = JSON.parse(raw);
    } catch (err: any) {
      console.warn('[AI call failed]:', err.message);
    }
  }

  // 2. Fallback para Google Gemini
  const geminiApiKey = process.env['GEMINI_API_KEY'];
  if (!aiResult && geminiApiKey) {
    try {
      const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${geminiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-1.5-flash',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyFormatted,
            { role: 'user', content: cleanMsg },
          ],
          temperature: 0.1,
        }),
      });

      if (geminiRes.ok) {
        const gemJson = await geminiRes.json();
        const content = gemJson.choices?.[0]?.message?.content;
        if (content) aiResult = JSON.parse(content);
      }
    } catch (gemErr: any) {
      console.error('[Gemini AI Fallback Error]:', gemErr.message);
    }
  }

  if (!aiResult) {
    reply = 'Não consegui processar a solicitação no momento. Digite *ajuda* para ver as opções.';
    await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
    return reply;
  }

  const collected = {
    ...(session.collected || {}),
    ...(Object.fromEntries(
      Object.entries(aiResult.extracted || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')
    )),
  };

  // FLUXO DE PEDIDO
  if (aiResult.intent === 'create_order') {
    if (collected.client_name && !collected.client_id) {
      const clientSearch = collected.client_name.trim();
      const matchedClients = await searchTenantClients(accountId, clientSearch);

      if (!matchedClients || matchedClients.length === 0) {
        reply = `Não encontrei o cliente "${clientSearch}" no RepHub.\n\nDeseja cadastrar esse cliente agora?\n1. Sim, cadastrar\n2. Não, cancelar`;
        await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
        return reply;
      }

      if (matchedClients.length === 1) {
        collected.client_id = matchedClients[0].id;
        collected.client_name = matchedClients[0].trade_name || matchedClients[0].legal_name;
      } else {
        const options = matchedClients.map((c: any) => ({
          id: c.id,
          name: `${c.trade_name || c.legal_name} — ${c.city || ''}/${c.state || ''}`,
        }));

        await (supabaseAdmin as any)
          .from('whatsapp_bot_sessions')
          .update({
            collected,
            context: { awaiting_choice: 'client', choice_options: options },
          })
          .eq('id', session.id);

        reply = `Encontrei mais de um cliente com esse nome:\n\n${options.map((opt: any, i: number) => `${i + 1}. ${opt.name}`).join('\n')}\n\nQual cliente deseja utilizar? (Responda com o número)`;
        await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
        return reply;
      }
    }

    reply = await continueOrderPipeline(session.id, accountId, userId, collected);
    await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
    return reply;
  }

  // FLUXO DE DESPESA
  if (aiResult.intent === 'create_expense') {
    const desc = collected.expense_description;
    const val = collected.expense_value;

    if (!desc) {
      reply = 'Qual é a descrição da despesa? (ex: Combustível, Hotel)';
    } else if (!val || Number(val) <= 0) {
      reply = `Qual o valor da despesa "${desc}"?`;
    } else {
      const pendingAction = {
        type: 'CREATE_EXPENSE',
        payload: { description: desc, amount: Number(val) },
      };

      await (supabaseAdmin as any)
        .from('whatsapp_bot_sessions')
        .update({
          pending_action: JSON.stringify(pendingAction),
          pending_confirmation: true,
          collected,
        })
        .eq('id', session.id);

      reply = `*Confirmação de Despesa:*\n\nDescrição: ${desc}\nValor: R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nDeseja confirmar o lançamento?\n1. Sim\n2. Cancelar`;
    }

    await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
    return reply;
  }

  // FLUXO DE CADASTRO DE CLIENTE
  if (aiResult.intent === 'create_client') {
    const name = collected.client_name;
    if (!name) {
      reply = 'Qual é a Razão Social ou Nome Fantasia do cliente?';
    } else {
      const pendingAction = {
        type: 'CREATE_CLIENT',
        payload: { legal_name: name, trade_name: name },
      };

      await (supabaseAdmin as any)
        .from('whatsapp_bot_sessions')
        .update({
          pending_action: JSON.stringify(pendingAction),
          pending_confirmation: true,
          collected,
        })
        .eq('id', session.id);

      reply = `*Confirmação de Cadastro de Cliente:*\n\nNome: ${name}\nStatus: Ativo\n\nDeseja confirmar o cadastro?\n1. Sim\n2. Cancelar`;
    }

    await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
    return reply;
  }

  // FLUXO DE CONSULTA (dados sempre reais, resposta em uma única mensagem)
  if (aiResult.intent === 'query') {
    reply = await runTenantQuery(accountId, aiResult.query_type, collected);
    await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
    return reply;
  }

  // Resposta padrão
  reply = aiResult.reply_text || 'Não entendi. Digite *ajuda* para ver os comandos.';
  await finishAndSendReply(session.id, accountId, userId, cleanPhone, reply);
  return reply;
};

// ==========================================
// CONSULTAS REAIS NO REPHUB (escopo do assinante)
// ==========================================
const brl = (v: any) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateBR = (v: any) => (v ? new Date(String(v) + 'T12:00:00').toLocaleDateString('pt-BR') : '—');

async function getTenantUserIds(accountId: string | null): Promise<string[]> {
  if (!accountId) return [];
  const { data } = await (supabaseAdmin as any)
    .from('account_members')
    .select('user_id')
    .eq('account_id', accountId);
  return (data || []).map((m: any) => m.user_id).filter(Boolean);
}

async function searchTenantClients(accountId: string | null, term: string): Promise<any[]> {
  const ids = await getTenantUserIds(accountId);
  let q = (supabaseAdmin as any)
    .from('clients')
    .select('id, legal_name, trade_name, city, state, status, owner_id, created_by')
    .or(`legal_name.ilike.%${term}%,trade_name.ilike.%${term}%`)
    .limit(8);
  if (ids.length > 0) {
    q = q.or(`owner_id.in.(${ids.join(',')}),created_by.in.(${ids.join(',')})`);
  }
  const { data } = await q;
  return data || [];
}

function periodStart(period?: string | null): string | null {
  const now = new Date();
  if (period === 'hoje') return now.toISOString().slice(0, 10);
  if (period === 'semana') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }
  if (period === 'mes') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  if (period === 'ano') return `${now.getFullYear()}-01-01`;
  return null;
}

async function runTenantQuery(
  accountId: string | null,
  queryType: string | null | undefined,
  collected: any
): Promise<string> {
  const clientName: string | null = collected?.client_name || null;
  let clientIds: string[] | null = null;
  let clientLabel = '';

  if (clientName) {
    const matches = await searchTenantClients(accountId, clientName.trim());
    if (matches.length === 0) {
      return `Cliente "${clientName}" não encontrado no RepHub.`;
    }
    if (matches.length > 1 && queryType !== 'client_orders') {
      return `Encontrei ${matches.length} clientes com "${clientName}":\n${matches
        .map((c: any, i: number) => `${i + 1}. ${c.trade_name || c.legal_name} — ${c.city || ''}/${c.state || ''}`)
        .join('\n')}\nInforme o nome completo.`;
    }
    clientIds = matches.map((c: any) => c.id);
    clientLabel = matches[0].trade_name || matches[0].legal_name;
  }

  const ownerIds = await getTenantUserIds(accountId);
  const scopeOrders = (q: any) => (ownerIds.length > 0 ? q.in('created_by', ownerIds) : q);

  // Último pedido
  if (queryType === 'last_order' || (!queryType && clientIds)) {
    let q = (supabaseAdmin as any)
      .from('orders')
      .select('id, internal_number, order_date, total_pieces, total_value, status, client_id, brand_id')
      .order('order_date', { ascending: false })
      .limit(1);
    if (clientIds) q = q.in('client_id', clientIds);
    const { data } = await scopeOrders(q);
    const o = (data || [])[0];
    if (!o) return clientLabel ? `Nenhum pedido registrado para ${clientLabel}.` : 'Nenhum pedido registrado.';
    return `*Último pedido${clientLabel ? ` — ${clientLabel}` : ''}*\nNº ${o.internal_number || o.id.slice(0, 8)} | ${dateBR(o.order_date)}\nPeças: ${o.total_pieces || 0} | ${brl(o.total_value)}\nStatus: ${o.status || '—'}`;
  }

  // Pedidos do cliente
  if (queryType === 'client_orders' && clientIds) {
    const { data } = await scopeOrders(
      (supabaseAdmin as any)
        .from('orders')
        .select('internal_number, order_date, total_value, total_pieces, status')
        .in('client_id', clientIds)
        .order('order_date', { ascending: false })
        .limit(5)
    );
    if (!data || data.length === 0) return `Nenhum pedido registrado para ${clientLabel}.`;
    const total = data.reduce((s: number, o: any) => s + Number(o.total_value || 0), 0);
    return `*${clientLabel} — últimos ${data.length} pedidos*\n${data
      .map((o: any) => `• ${dateBR(o.order_date)} | Nº ${o.internal_number || '—'} | ${brl(o.total_value)} | ${o.status || '—'}`)
      .join('\n')}\nTotal listado: ${brl(total)}`;
  }

  // Pedidos pendentes
  if (queryType === 'pending_orders') {
    const { data } = await scopeOrders(
      (supabaseAdmin as any)
        .from('orders')
        .select('internal_number, order_date, total_value, status')
        .not('status', 'in', '("Faturado","Cancelado")')
        .order('order_date', { ascending: false })
        .limit(8)
    );
    if (!data || data.length === 0) return 'Nenhum pedido pendente.';
    return `*Pedidos pendentes (${data.length})*\n${data
      .map((o: any) => `• Nº ${o.internal_number || '—'} | ${dateBR(o.order_date)} | ${brl(o.total_value)} | ${o.status || '—'}`)
      .join('\n')}`;
  }

  // Maiores clientes
  if (queryType === 'top_clients') {
    const { data } = await scopeOrders(
      (supabaseAdmin as any).from('orders').select('client_id, total_value').limit(1000)
    );
    const byClient = new Map<string, number>();
    (data || []).forEach((o: any) => {
      if (!o.client_id) return;
      byClient.set(o.client_id, (byClient.get(o.client_id) || 0) + Number(o.total_value || 0));
    });
    const top = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length === 0) return 'Nenhum pedido registrado para ranquear clientes.';
    const { data: names } = await (supabaseAdmin as any)
      .from('clients')
      .select('id, legal_name, trade_name')
      .in('id', top.map(([id]) => id));
    const nameOf = (id: string) => {
      const c = (names || []).find((x: any) => x.id === id);
      return c ? c.trade_name || c.legal_name : id.slice(0, 8);
    };
    return `*Maiores clientes por faturamento*\n${top
      .map(([id, v], i) => `${i + 1}. ${nameOf(id)} — ${brl(v)}`)
      .join('\n')}`;
  }

  // Informações do cliente
  if (queryType === 'client_info' && clientIds) {
    const { data: c } = await (supabaseAdmin as any)
      .from('clients')
      .select('legal_name, trade_name, city, state, status')
      .eq('id', clientIds[0])
      .maybeSingle();
    if (!c) return `Cliente "${clientName}" não encontrado.`;
    return `*${c.trade_name || c.legal_name}*\nRazão social: ${c.legal_name || '—'}\nCidade: ${c.city || '—'}/${c.state || '—'}\nSituação: ${c.status || '—'}`;
  }

  // Resumo de vendas
  const start = periodStart(collected?.period) || periodStart('mes');
  let q = (supahelperOrders() as any)
    .select('total_value, total_pieces')
    .gte('order_date', start)
    .limit(2000);
  if (clientIds) q = q.in('client_id', clientIds);
  const { data: rows } = await scopeOrders(q);
  const list = rows || [];
  const totalValue = list.reduce((s: number, o: any) => s + Number(o.total_value || 0), 0);
  const totalPieces = list.reduce((s: number, o: any) => s + Number(o.total_pieces || 0), 0);
  const label = collected?.period === 'ano' ? 'no ano' : collected?.period === 'semana' ? 'nos últimos 7 dias' : collected?.period === 'hoje' ? 'hoje' : 'no mês';
  if (list.length === 0) return `Nenhum pedido ${label}${clientLabel ? ` para ${clientLabel}` : ''}.`;
  return `*Vendas ${label}${clientLabel ? ` — ${clientLabel}` : ''}*\nPedidos: ${list.length}\nPeças: ${totalPieces}\nTotal: ${brl(totalValue)}`;
}

function supahelperOrders() {
  return (supabaseAdmin as any).from('orders');
}

// Funções auxiliares
async function continueOrderPipeline(
  sessionId: string,
  accountId: string | null,
  userId: string,
  collected: any
): Promise<string> {
  if (!collected.client_id) {
    return 'Para qual cliente é o pedido? (Informe o nome da loja)';
  }

  if (!collected.total_pieces || Number(collected.total_pieces) <= 0) {
    await (supabaseAdmin as any).from('whatsapp_bot_sessions').update({ collected }).eq('id', sessionId);
    return `Encontrei o cliente *${collected.client_name}*. Quantas peças foram vendidas?`;
  }

  if (!collected.total_value || Number(collected.total_value) <= 0) {
    await (supabaseAdmin as any).from('whatsapp_bot_sessions').update({ collected }).eq('id', sessionId);
    return `Qual é o valor total do pedido para ${collected.total_pieces} peças?`;
  }

  let brandId = collected.brand_id;
  let brandName = collected.brand_name;

  if (!brandId) {
    const { data: brands } = await (supabaseAdmin as any)
      .from('brands')
      .select('id, brand, company_name, trade_name')
      .eq('account_id', accountId);

    if (!brands || brands.length === 0) {
      return 'Nenhuma marca cadastrada para sua conta no RepHub.';
    }

    if (brands.length === 1) {
      brandId = brands[0].id;
      brandName = brands[0].brand || brands[0].trade_name || brands[0].company_name;
      collected.brand_id = brandId;
      collected.brand_name = brandName;
    } else {
      const options = brands.map((b: any) => ({
        id: b.id,
        name: b.brand || b.trade_name || b.company_name,
      }));

      await (supabaseAdmin as any)
        .from('whatsapp_bot_sessions')
        .update({
          collected,
          context: { awaiting_choice: 'brand', choice_options: options },
        })
        .eq('id', sessionId);

      return `Para qual marca é este pedido?\n\n${options.map((opt: any, i: number) => `${i + 1}. ${opt.name}`).join('\n')}\n\nResponda com o número.`;
    }
  }

  let collectionId = collected.collection_id;
  let brandCollectionId = collected.brand_collection_id;
  let collectionName = collected.collection_name;

  if (!brandCollectionId) {
    const { data: bcs } = await (supabaseAdmin as any)
      .from('brand_collections')
      .select('id, collection_id, name, status')
      .eq('brand_id', brandId)
      .eq('status', 'Ativa');

    if (!bcs || bcs.length === 0) {
      const { data: anyBcs } = await (supabaseAdmin as any)
        .from('brand_collections')
        .select('id, collection_id, name, status')
        .eq('brand_id', brandId)
        .limit(5);

      if (!anyBcs || anyBcs.length === 0) {
        return `A marca ${brandName} não possui coleção cadastrada. Cadastre uma coleção no RepHub primeiro.`;
      }

      if (anyBcs.length === 1) {
        brandCollectionId = anyBcs[0].id;
        collectionId = anyBcs[0].collection_id;
        collectionName = anyBcs[0].name;
      } else {
        const options = anyBcs.map((c: any) => ({
          id: c.id,
          collection_id: c.collection_id,
          name: `${c.name} (${c.status})`,
        }));

        await (supabaseAdmin as any)
          .from('whatsapp_bot_sessions')
          .update({
            collected,
            context: { awaiting_choice: 'collection', choice_options: options },
          })
          .eq('id', sessionId);

        return `Qual coleção devo utilizar para ${brandName}?\n\n${options.map((opt: any, i: number) => `${i + 1}. ${opt.name}`).join('\n')}\n\nResponda com o número.`;
      }
    } else if (bcs.length === 1) {
      brandCollectionId = bcs[0].id;
      collectionId = bcs[0].collection_id;
      collectionName = bcs[0].name;
    } else {
      const options = bcs.map((c: any) => ({
        id: c.id,
        collection_id: c.collection_id,
        name: c.name,
      }));

      await (supabaseAdmin as any)
        .from('whatsapp_bot_sessions')
        .update({
          collected,
          context: { awaiting_choice: 'collection', choice_options: options },
        })
        .eq('id', sessionId);

      return `Para a marca ${brandName}, há mais de uma coleção ativa:\n\n${options.map((opt: any, i: number) => `${i + 1}. ${opt.name}`).join('\n')}\n\nQual deseja utilizar? (Responda com o número)`;
    }

    collected.collection_id = collectionId;
    collected.brand_collection_id = brandCollectionId;
    collected.collection_name = collectionName;
  }

  const pendingPayload = {
    client_id: collected.client_id,
    brand_id: collected.brand_id,
    collection_id: collected.collection_id,
    brand_collection_id: collected.brand_collection_id,
    total_pieces: Number(collected.total_pieces),
    total_value: Number(collected.total_value),
  };

  await (supabaseAdmin as any)
    .from('whatsapp_bot_sessions')
    .update({
      pending_action: JSON.stringify({ type: 'CREATE_ORDER', payload: pendingPayload }),
      pending_confirmation: true,
      collected,
    })
    .eq('id', sessionId);

  return `*Resumo do Pedido para Confirmação:*\n\n` +
    `• Cliente: *${collected.client_name}*\n` +
    `• Marca: *${collected.brand_name}*\n` +
    `• Coleção: *${collected.collection_name}*\n` +
    `• Peças: *${collected.total_pieces}*\n` +
    `• Valor: *R$ ${Number(collected.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n` +
    `Confirmar criação do pedido?\n1. Sim, criar pedido\n2. Não, cancelar`;
}

async function executeServerAction(
  accountId: string | null,
  userId: string,
  phoneNumber: string,
  actionObj: { type: string; payload: any }
): Promise<string> {
  const { type, payload } = actionObj;

  if (type === 'CREATE_ORDER') {
    const { data: order, error } = await (supabaseAdmin as any)
      .from('orders')
      .insert({
        client_id: payload.client_id,
        brand_id: payload.brand_id,
        collection_id: payload.collection_id,
        brand_collection_id: payload.brand_collection_id,
        order_date: new Date().toISOString().split('T')[0],
        total_pieces: Number(payload.total_pieces),
        total_value: Number(payload.total_value),
        status: 'Pedido lançado',
        created_by: userId,
      })
      .select('id, internal_number')
      .single();

    if (error || !order) throw new Error(error?.message || 'Falha ao criar pedido.');

    await (supabaseAdmin as any).from('whatsapp_bot_operations').insert({
      account_id: accountId,
      user_id: userId,
      phone_number: phoneNumber,
      intent: 'CREATE_ORDER',
      tool: 'CREATE_ORDER',
      input: payload,
      result: order,
      success: true,
      entity_type: 'order',
      entity_id: order.id,
    });

    return `Pedido *${order.internal_number}* criado com sucesso no RepHub! ✅`;
  }

  if (type === 'CREATE_CLIENT') {
    const { data: client, error } = await (supabaseAdmin as any)
      .from('clients')
      .insert({
        legal_name: payload.legal_name,
        trade_name: payload.trade_name || payload.legal_name,
        status: 'Ativo',
        owner_id: userId,
        created_by: userId,
      })
      .select('id, legal_name, trade_name')
      .single();

    if (error || !client) throw new Error(error?.message || 'Falha ao cadastrar cliente.');

    await (supabaseAdmin as any).from('whatsapp_bot_operations').insert({
      account_id: accountId,
      user_id: userId,
      phone_number: phoneNumber,
      intent: 'CREATE_CLIENT',
      tool: 'CREATE_CLIENT',
      input: payload,
      result: client,
      success: true,
      entity_type: 'client',
      entity_id: client.id,
    });

    return `Cliente *${client.trade_name || client.legal_name}* cadastrado com sucesso! ✅`;
  }

  if (type === 'CREATE_EXPENSE') {
    const { data: exp, error } = await (supabaseAdmin as any)
      .from('expenses')
      .insert({
        account_id: accountId,
        description: payload.description,
        amount: Number(payload.amount),
        expense_date: new Date().toISOString().split('T')[0],
        status: 'Pendente',
        created_by: userId,
      })
      .select('id, description, amount')
      .single();

    if (error || !exp) throw new Error(error?.message || 'Falha ao lançar despesa.');

    await (supabaseAdmin as any).from('whatsapp_bot_operations').insert({
      account_id: accountId,
      user_id: userId,
      phone_number: phoneNumber,
      intent: 'CREATE_EXPENSE',
      tool: 'CREATE_EXPENSE',
      input: payload,
      result: exp,
      success: true,
      entity_type: 'expense',
      entity_id: exp.id,
    });

    return `Despesa de *R$ ${Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* ("${exp.description}") lançada com sucesso! ✅`;
  }

  return 'Ação concluída.';
}

async function finishAndSendReply(
  sessionId: string,
  accountId: string | null,
  userId: string,
  phoneNumber: string,
  replyText: string
) {
  // 1. Salvar no banco
  await (supabaseAdmin as any).from('whatsapp_bot_messages').insert({
    account_id: accountId,
    user_id: userId,
    phone_number: phoneNumber,
    session_id: sessionId,
    direction: 'outbound',
    body: replyText,
  });

  // 2. Enviar via WhatsAble apenas se NÃO for número de simulação
  if (!phoneNumber.startsWith('sim-')) {
    try {
      const sendRes = await sendWhatsAppTextMessage(phoneNumber, replyText);
      console.log(`[WhatsAble Outbound Send] Resultado para ${phoneNumber}:`, sendRes);

      if (!sendRes.success) {
        await (supabaseAdmin as any).from('audit_logs').insert({
          entity_type: 'error',
          action: 'WHATSABLE_SEND_ERROR',
          description: `Falha ao entregar resposta no WhatsApp de ${phoneNumber}: ${sendRes.error}`,
          after_data: sendRes,
          user_name: 'WhatsAble Client',
        });
      }
    } catch (sendErr: any) {
      console.error(`[WhatsAble Outbound Exception]:`, sendErr);
      await (supabaseAdmin as any).from('audit_logs').insert({
        entity_type: 'error',
        action: 'WHATSABLE_SEND_EXCEPTION',
        description: `Exceção de rede ao enviar resposta para ${phoneNumber}: ${sendErr.message}`,
        user_name: 'WhatsAble Client',
      });
    }
  }
}
