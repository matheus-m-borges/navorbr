import { createServerFn } from "@tanstack/react-start";
import OpenAI from "openai";
import { AiLegalDrafter } from "./ai-legal-drafter";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLawHubServiceConfig } from "./platform-service-config.server";

export interface GeneratePieceParams {
  pieceType: string;
  userPrompt: string; // O que o advogado pede para a IA fazer
  fullPdfText?: string; // O texto lido na íntegra da peça do PDF
  fileName?: string;
  court?: string;
  clientName?: string;
  oppositeParty?: string;
  cnj?: string;
  caseValue?: number;
  userApiKey?: string;
  apiProvider?: "openai" | "gemini" | "lovable" | "claude";
  model?: string;
}

export interface GeneratePieceResult {
  success: boolean;
  draft: string;
  source: "lovable_ai" | "gemini_ai" | "openai" | "legal_engine_structured";
  modelUsed?: string;
  error?: string;
}

const getAIClient = (
  userApiKey?: string,
  apiProvider?: "openai" | "gemini",
  customModel?: string
): { client: OpenAI; model: string; source: "gemini_ai" | "openai" } | null => {
  const key = userApiKey ? userApiKey.trim() : "";

  // 3. Provedor Google Gemini
  if (apiProvider === "gemini" || key.startsWith("AIza")) {
    const geminiKey = key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      return {
        client: new OpenAI({
          apiKey: geminiKey,
          baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        }),
        model: customModel || "gemini-2.0-flash",
        source: "gemini_ai",
      };
    }
  }

  // 4. Provedor OpenAI (GPT-4o)
  if (apiProvider === "openai" || key.startsWith("sk-")) {
    const openAiKey = key || process.env.OPENAI_API_KEY;
    if (openAiKey) {
      return {
        client: new OpenAI({ apiKey: openAiKey }),
        model: customModel || "gpt-4o",
        source: "openai",
      };
    }
  }

  // 5. Se o usuário forneceu qualquer chave válida sem provider explícito
  if (key && key.length > 10) {
    if (key.startsWith("AIza")) {
      return {
        client: new OpenAI({
          apiKey: key,
          baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        }),
        model: customModel || "gemini-2.0-flash",
        source: "gemini_ai",
      };
    }
    return {
      client: new OpenAI({ apiKey: key }),
      model: customModel || "gpt-4o",
      source: "openai",
    };
  }

  // 2. Chaves de variáveis de ambiente do servidor
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return {
      client: new OpenAI({ apiKey: openAiKey }),
      model: process.env.OPENAI_MODEL || "gpt-4o",
      source: "openai",
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    return {
      client: new OpenAI({
        apiKey: geminiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      source: "gemini_ai",
    };
  }



  return null;
};

/**
 * Server Function: Lê a íntegra da peça processual em PDF e gera petição formal jurídica completa
 */
export const generateLegalPieceFromPdfFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GeneratePieceParams) => ({
    pieceType: String(input?.pieceType || "Contestação Cível").trim(),
    userPrompt: String(input?.userPrompt || "").trim(),
    fullPdfText: String(input?.fullPdfText || "").trim(),
    fileName: input?.fileName ? String(input.fileName) : undefined,
    court: input?.court ? String(input.court) : undefined,
    clientName: input?.clientName ? String(input.clientName) : undefined,
    oppositeParty: input?.oppositeParty ? String(input.oppositeParty) : undefined,
    cnj: input?.cnj ? String(input.cnj) : undefined,
    caseValue: input?.caseValue ? Number(input.caseValue) : undefined,
    // A escolha e a credencial são centralizadas pela NAVOR. Valores recebidos
    // do navegador não podem trocar o provedor nem transportar uma chave.
  }))
  .handler(async ({ data, context }): Promise<GeneratePieceResult> => {
    const {
      pieceType,
      userPrompt,
      fullPdfText,
      fileName,
      court,
      clientName,
      oppositeParty,
      cnj,
      caseValue,
    } = data;

    let activeKey: string | undefined;
    let activeProvider: "openai" | "gemini" | "lovable" | "claude" | undefined = "lovable";
    let activeModel: string | undefined = "google/gemini-2.5-flash";
    try {
      const { requireAuthenticatedAccount } = await import("@/lib/security/authorization.server");
      const { accountId } = await requireAuthenticatedAccount(context.userId);
      const config = await getLawHubServiceConfig(accountId, "pieces_ai");
      activeProvider = config.provider === "openai" || config.provider === "gemini" || config.provider === "lovable"
        ? config.provider
        : "lovable";
      activeModel = config.model || activeModel;
    } catch (err) {
      console.warn("[LawHub AI Generator] Configuração de peças indisponível; usando padrão NAVOR.", err);
    }

    // Proteção de segurança contra erro humano: se o provedor ativo não for lovable mas a chave estiver vazia,
    // reverte automaticamente para Lovable AI Gateway para que as peças NUNCA falhem
    if (activeProvider && activeProvider !== "lovable" && (!activeKey || activeKey.trim().length < 10)) {
      console.warn(`[LawHub AI Generator] Provedor '${activeProvider}' sem chave configurada. Revertendo automaticamente para Lovable AI Gateway.`);
      activeProvider = "lovable";
      activeKey = undefined;
      activeModel = "google/gemini-2.5-flash";
    }

    // Filtra lixo binário caso o texto cru ainda contenha marcas de arquivo corrompido
    const sanitizedPdfText = (fullPdfText || "")
      .replace(/%PDF[\s\S]{1,1000}?(?=\n\n|$)/g, "")
      .replace(/\/BitsPerComponent[\s\S]{1,1000}?(?=\n\n|$)/g, "")
      .replace(/stream[\s\S]{1,1000}?endstream/g, "")
      .trim();

    const hasPdf = sanitizedPdfText.length > 50;

    const systemPrompt = `Você é um Advogado Sênior, Doutor em Direito Processual Civil e Procurador altamente experiente no Brasil.

SUA MISSÃO:
Elaborar uma peça processual JUDICIALMENTE IMPECÁVEL, COMPLETA E EXTENSA (nível petição real pronta para protocolo no PJe/e-SAJ, com parágrafos encadeados, densidade de fundamentação e sem qualquer resumo ou esqueleto incompleto).

DIRETRIZES FUNDAMENTAIS DE QUALIDADE:
1. NUNCA faça resumos preguiçosos, tópicos abreviados ou placeholders como "[descrever fatos]". Redija todos os fatos, argumentos e fundamentos por extenso.
2. ESTRUTURA FORENSE OBRIGATÓRIA:
   - ENDEREÇAMENTO FORMAL ao Juízo competente (ex: EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA...);
   - QUALIFICAÇÃO COMPLETA DAS PARTES com os nomes, papéis processuais e dados extraídos das instruções do advogado;
   - NOME DA PEÇA em caixa alta e com indicação dos dispositivos legais cabíveis (ex: PEDIDO DE ALVARÁ JUDICIAL PARA AQUISIÇÃO DE VEÍCULO AUTOMOTOR MEDIANTE FINANCIAMENTO, CONTESTAÇÃO CÍVEL, PETIÇÃO INICIAL);
   - I. DOS FATOS: Narrativa cronológica, clara e detalhada em múltiplos parágrafos bem redigidos;
   - II. DO DIREITO / DA NECESSIDADE DE AUTORIZAÇÃO / DAS PRELIMINARES: Doutrina, análise sistemática da lei e CITAÇÃO INTEGRAL dos artigos de lei cabíveis (Código de Processo Civil, Código Civil, Constituição Federal, Estatuto da Pessoa com Deficiência se for o caso);
   - JURISPRUDÊNCIA: Citação de precedentes judiciais com transcrição de EMENTAS REAIS de Tribunais de Justiça (TJ-MG, TJ-SP, STJ), devidamente identificadas por número de processo, relator e data de julgamento;
   - SALVAGUARDAS PATRIMONIAIS OU TUTELAS DE URGÊNCIA quando aplicáveis;
   - MANIFESTAÇÃO DO MINISTÉRIO PÚBLICO (se envolver incapaz, curatelado ou menor - CPC art. 178);
   - DOS PEDIDOS: Rol exaustivo de pedidos com alíneas de "a" até "j", requerendo todas as providências, intimações, expedições e condenações cabíveis;
   - VALOR DA CAUSA, FECHO FORENSE ("Termos em que, pede deferimento."), LOCALIDADE, DATA ATUAL e ASSINATURA com OAB do Advogado.
3. Se o advogado solicitou ALVARÁ JUDICIAL DE CURATELA PARA AQUISIÇÃO DE VEÍCULO:
   - Ressalte enfaticamente que o financiamento será pago com recursos exclusivos de terceiro (ex: Ana Karla), figurando como avalista, SEM qualquer ônus ao curatelado (Jean), gerando vantagem patrimonial real ao incapaz com isenções de PcD.`;

    const userMessage = `COMANDO E DIRETRIZES DO ADVOGADO:
"${userPrompt}"

TIPO DE PEÇA SOLICITADA:
${pieceType}

DADOS PROCESSUAIS IDENTIFICADOS:
- Juízo: ${court || "Juízo Cível / de Família Competente"}
- Parte Requerente / Autora / Curadoras: ${oppositeParty || "Conforme instruções"}
- Parte Requerida / Curatelado / Cliente: ${clientName || "Conforme instruções"}
- Número do Processo (CNJ): ${cnj || "A distribuir / Em trâmite"}
- Valor da Causa: ${caseValue ? `R$ ${caseValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Conforme indicado nos autos"}
- Nome do Arquivo em Anexo: ${fileName || "Documentos dos Autos"}

================================================================================
CONTEÚDO DA PEÇA PROCESSUAL EM ANEXO:
================================================================================
${hasPdf ? sanitizedPdfText : "[Sem documento adicional anexo. Elaborar com base rigorosa no comando do advogado acima.]"}
================================================================================

Por favor, elabore agora a peça jurídica completa, pronta para protocolo, com redação forense de excelência.`;

    // 1. Tentar chamada via AI Client (Lovable Gateway padrão / OpenAI / Gemini / Claude)
    try {
      const compatibleProvider = activeProvider === "openai" || activeProvider === "gemini"
        ? activeProvider
        : undefined;
      const ai = getAIClient(activeKey, compatibleProvider, activeModel);
      if (ai) {
        const completion = await ai.client.chat.completions.create({
          model: ai.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.25,
          max_tokens: 4500,
        });

        const content = completion.choices[0]?.message?.content;
        if (content && content.trim().length > 300) {
          return {
            success: true,
            draft: content.trim(),
            source: ai.source,
            modelUsed: ai.model,
          };
        }
      }
    } catch (apiErr: any) {
      console.warn("[AI Gateway Call Warning - Falling back to Structured Drafter]:", apiErr.message);
    }

    // 2. Fallback de alta fidelidade: AiLegalDrafter estruturado com processamento integral
    try {
      const structuredResult = await AiLegalDrafter.generateDraft({
        pieceType,
        userPrompt,
        court,
        clientName,
        oppositeParty,
        cnj,
        caseValue,
        pdfData: hasPdf
          ? {
              fileName: fileName || "Peça Processual.pdf",
              fileSize: "Autos Completos",
              pageCount: 1,
              extractedText: sanitizedPdfText,
              detectedCnj: cnj,
              detectedCourt: court,
              detectedAuthor: oppositeParty,
              detectedDefendant: clientName,
              detectedValue: caseValue,
              summary: sanitizedPdfText.slice(0, 800),
            }
          : null,
      });

      return {
        success: true,
        draft: structuredResult.draft,
        source: "legal_engine_structured",
        modelUsed: "Motor Jurídico Especializado CPC/15",
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        draft: "",
        source: "legal_engine_structured",
        error: fallbackErr.message || "Falha na geração da peça.",
      };
    }
  });
