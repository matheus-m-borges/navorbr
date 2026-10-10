import OpenAI from "openai";
import { getLawHubServiceConfig } from "./platform-service-config.server";

/**
 * Motor de IA para Recepção e Triagem Jurídica do LawHub Atendimento.
 * Utiliza o Lovable AI Gateway com Google Gemini (padrão de alta velocidade e raciocínio jurídico)
 * com fallback transparente para API própria caso configurado pelo administrador da NAVOR.
 */

const getAIClient = async (accountId?: string) => {
  // O escritório escolhe apenas o modo/modelo. As chaves pertencem à NAVOR e
  // permanecem nos secrets do ambiente de execução, nunca no navegador.
  const configured = await getLawHubServiceConfig(accountId, "callcenter_ai");
  const configuredProvider = configured.provider;
  const configuredModel = configured.model;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // A configuração aponta o provedor, mas não transporta credenciais do cliente.
  if (configuredProvider === "openai" && openaiKey) {
    return { client: new OpenAI({ apiKey: openaiKey }), model: configuredModel || process.env.OPENAI_MODEL || "gpt-4o-mini" };
  }
  if (configuredProvider === "gemini" && geminiKey) {
    return {
      client: new OpenAI({ apiKey: geminiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" }),
      model: configuredModel || "gemini-2.0-flash",
    };
  }

  // 2. Google Gemini Nativo via compatibilidade OpenAI
  if (geminiKey) {
    return {
      client: new OpenAI({
        apiKey: geminiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
      model: "gemini-2.0-flash",
    };
  }

  // 3. OpenAI
  if (openaiKey) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: "gpt-4o-mini",
    };
  }

  return null;
};

export interface AITriageResult {
  replyText: string;
  detectedArea: string;
  detectedUrgency: "baixa" | "media" | "alta";
  aiSummary: string;
  targetDepartmentSlug: "trabalhista" | "civel" | "previdenciario" | "financeiro" | "comercial";
  shouldHandoff: boolean;
}

export async function processAITriageForConversation(params: {
  contactName: string;
  contactPhone: string;
  messageText: string;
  historySnippet?: string;
  officeName?: string;
  botName?: string;
  customPrompt?: string;
  accountId?: string;
}): Promise<AITriageResult> {
  const ai = await getAIClient(params.accountId);

  const office = params.officeName || "Borges & Advogados Associados";
  const bot = params.botName || "Sofia (Assistente Jurídica)";

  // Se não houver chave configurada, retorna resposta padrão de triagem segura
  if (!ai) {
    return {
      replyText: `Olá, ${params.contactName}! Sou a ${bot} do escritório ${office}. Recebi sua mensagem e estou encaminhando para o advogado responsável pelo seu caso. Como podemos ajudá-lo com mais detalhes?`,
      detectedArea: "Geral",
      detectedUrgency: "media",
      aiSummary: `Contato inicial de ${params.contactName} (${params.contactPhone}). Mensagem: "${params.messageText}"`,
      targetDepartmentSlug: "comercial",
      shouldHandoff: false,
    };
  }

  const systemPrompt = `Você é ${bot}, a assistente virtual e recepcionista jurídica inteligente do escritório "${office}".
Seu objetivo é acolher o cliente via WhatsApp com empatia, discrição e profissionalismo, entender a demanda em linguagem natural (NUNCA force menus numéricos como "digite 1 ou 2"), extrair a área do direito e gerar um resumo executivo para o advogado assumir o caso.

Limites obrigatórios de segurança jurídica:
- Você NÃO decide, promete ou sugere que a pessoa tem ou não tem direito, chance de êxito, valor de indenização ou prazo legal.
- Sua função é somente coletar fatos mínimos e encaminhar. Em caso de dúvida, encaminhe para análise humana.
- Não descarte um caso pela falta de documento, informação incompleta ou relato confuso.
- Faça uma pergunta curta por vez. Não explique regras jurídicas nem dê orientação jurídica individualizada.
- Se houver risco imediato, prazo muito próximo, ameaça, prisão, violência, saúde ou outra urgência, informe que a equipe será avisada com prioridade e marque a urgência como alta.

Diretrizes:
1. Seja educada, acolhedora e objetiva.
2. Identifique a área do direito entre:
   - "trabalhista" (demissões, horas extras, rescisão, FGTS, acidente de trabalho)
   - "civel" (indenizações, contratos imobiliários, dívidas, danos morais, consumidor, família)
   - "previdenciario" (aposentadoria, auxílio-doença, BPC/LOAS, pensão INSS)
   - "financeiro" (honorários, boletos, segunda via, pagamento, recibo)
   - "comercial" (novos clientes, dúvidas gerais, prospecção)
3. Avalie o grau de urgência:
   - "alta" (mandado de prisão, audiência amanhã, prazo de 24h, despejo iminente, demissão recente)
   - "media" (consultas gerais, análise de documentos)
   - "baixa" (pedidos de informação cadastral, boletos de rotina)
4. Você deve responder OBRIGATORIAMENTE em formato JSON com as chaves:
{
  "replyText": "Mensagem que será enviada para o cliente no WhatsApp",
  "detectedArea": "Nome da área (Ex: Trabalhista, Cível, Previdenciário)",
  "detectedUrgency": "baixa" | "media" | "alta",
  "aiSummary": "Resumo fático e executivo em 2 a 3 frases para o advogado responsável ler em 5 segundos antes de atender",
  "targetDepartmentSlug": "trabalhista" | "civel" | "previdenciario" | "financeiro" | "comercial",
  "shouldHandoff": boolean (true se houver dados mínimos para encaminhar, pedido expresso de pessoa humana, urgência, mídia/documento para análise ou qualquer dúvida sobre a elegibilidade)
}
${params.customPrompt ? `Instruções adicionais do escritório:\n${params.customPrompt}` : ""}`;

  const userContent = `Cliente: ${params.contactName}
Telefone: ${params.contactPhone}
Histórico prévio da conversa:
${params.historySnippet || "Nenhum histórico anterior."}

Nova mensagem recebida do cliente:
"${params.messageText}"`;

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

    return {
      replyText: parsed.replyText || `Olá ${params.contactName}! Recebemos sua mensagem e já estamos analisando sua situação.`,
      detectedArea: parsed.detectedArea || "Jurídico",
      detectedUrgency: parsed.detectedUrgency || "media",
      aiSummary: parsed.aiSummary || `Mensagem de ${params.contactName}: "${params.messageText}"`,
      targetDepartmentSlug: parsed.targetDepartmentSlug || "comercial",
      shouldHandoff: parsed.shouldHandoff ?? false,
    };
  } catch (err: any) {
    console.error("Erro na triagem de IA do WhatsApp:", err);
    return {
      replyText: `Olá, ${params.contactName}! Recebemos sua mensagem no escritório ${office} e já a encaminhamos para nossa equipe jurídica especializada. Em breve um de nossos advogados entrará em contato.`,
      detectedArea: "Geral",
      detectedUrgency: "media",
      aiSummary: `Contato de ${params.contactName}. Mensagem: "${params.messageText}".`,
      targetDepartmentSlug: "comercial",
      shouldHandoff: true,
    };
  }
}
