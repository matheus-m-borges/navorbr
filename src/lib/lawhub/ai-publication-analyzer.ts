/**
 * Analisador Inteligente de Publicações e Intimações Judiciais do LawHub
 * Processa o inteiro teor de publicações e intimações oficiais do DJEN/DJe/PJe,
 * sugerindo automaticamente o tipo de ato a praticar, prazo legal (dias úteis),
 * fundamentação no CPC/CLT e dados de audiências (NAVOR LawHub Intelligence).
 */

export interface PublicationAiAnalysis {
  communicationType: string; // Ex: "Intimação para Contrarrazões de Apelação"
  category: "prazo" | "audiencia" | "tarefa" | "informativo";
  suggestedTitle: string;
  suggestedDays: number;
  countMode: "dias_uteis" | "dias_corridos";
  legalArticle: string;
  urgency: "fatal" | "urgente" | "normal";
  summary: string;
  recommendedAction: string;
  hearingData?: {
    date: string;
    time: string;
    type: "conciliacao" | "instrucao" | "julgamento" | "una" | "pericial";
    isVirtual: boolean;
    virtualLink?: string;
    location?: string;
  };
}

export function analyzePublicationText(fullText: string): PublicationAiAnalysis {
  const text = (fullText || "").toLowerCase();

  // 1. Detecção de Audiência
  const hasAudiencia = text.includes("audiência") || text.includes("audiencia") || text.includes("designada audiência") || text.includes("designo audiência");
  if (hasAudiencia) {
    let hearingType: "conciliacao" | "instrucao" | "julgamento" | "una" | "pericial" = "conciliacao";
    if (text.includes("instrução") || text.includes("instrucao")) hearingType = "instrucao";
    if (text.includes("julgamento")) hearingType = "julgamento";
    if (text.includes("una")) hearingType = "una";
    if (text.includes("pericial") || text.includes("perícia")) hearingType = "pericial";

    const isVirtual = text.includes("telepresencial") || text.includes("virtual") || text.includes("teams") || text.includes("zoom") || text.includes("meet") || text.includes("videoconferência");

    // Tentativa de extrair data (ex: 28/10/2026 ou 28 de outubro)
    const dateMatch = fullText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    const timeMatch = fullText.match(/(\d{1,2})[h:](\d{2})/i);

    let extractedDate = "";
    let extractedTime = "14:00";

    if (dateMatch) {
      extractedDate = `${dateMatch[3]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[1]).padStart(2, "0")}`;
    }
    if (timeMatch) {
      extractedTime = `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}`;
    }

    return {
      communicationType: "Designação de Audiência Judicial",
      category: "audiencia",
      suggestedTitle: `Audiência de ${hearingType.toUpperCase()} ${isVirtual ? "(Telepresencial)" : "(Presencial)"}`,
      suggestedDays: 0,
      countMode: "dias_uteis",
      legalArticle: "Art. 334 / Art. 358 do CPC",
      urgency: "urgente",
      summary: "O juízo designou data para a realização de ato solene de audiência. Registre na pauta e intime a parte cliente com antecedência.",
      recommendedAction: "Agendar audiência na agenda e preparar rol de testemunhas / orientar cliente.",
      hearingData: {
        date: extractedDate || new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
        time: extractedTime,
        type: hearingType,
        isVirtual,
        location: isVirtual ? "Sala Virtual (Teams / Zoom PJecorr)" : "Fórum Central / Sala de Audiências da Vara",
      },
    };
  }

  // 2. Apelação / Contrarrazões (Art. 1.010 CPC)
  if (text.includes("1.010") || text.includes("1010") || text.includes("apelação") || text.includes("apelante") || text.includes("contrarrazões")) {
    return {
      communicationType: "Intimação para Apelação / Contrarrazões",
      category: "prazo",
      suggestedTitle: "Apresentar Contrarrazões de Apelação",
      suggestedDays: 15,
      countMode: "dias_uteis",
      legalArticle: "Art. 1.010, § 1º, do CPC (Prazo de 15 dias úteis)",
      urgency: "fatal",
      summary: "Abertura de prazo para apresentar contrarrazões ao recurso de apelação interposto pela parte adversa.",
      recommendedAction: "Elaborar minuta de Contrarrazões rebatendo os pontos do recurso e protocolar tempestivamente.",
    };
  }

  // 3. Sentença Proferida (Embargos de Declaração ou Apelação)
  if (text.includes("sentença") || text.includes("julgo procedente") || text.includes("julgo improcedente") || text.includes("dispositivo:")) {
    return {
      communicationType: "Publicação de Sentença de Mérito",
      category: "prazo",
      suggestedTitle: "Prazo para Embargos de Declaração ou Apelação",
      suggestedDays: 15,
      countMode: "dias_uteis",
      legalArticle: "Art. 1.003, § 5º e Art. 1.023 do CPC (5 dias para Embargos / 15 dias para Apelação)",
      urgency: "fatal",
      summary: "Sentença disponibilizada nos autos. Verifique a existência de omissão/obscuridade para embargos (5 dias) ou prepare o recurso de apelação (15 dias).",
      recommendedAction: "Analisar o dispositivo da sentença com o cliente e alinhar estratégia recursal.",
    };
  }

  // 4. Embargos de Declaração
  if (text.includes("embargos de declaração") || text.includes("embargos declaratórios") || text.includes("1.023")) {
    return {
      communicationType: "Intimação de Embargos de Declaração",
      category: "prazo",
      suggestedTitle: "Manifestação sobre Embargos de Declaração",
      suggestedDays: 5,
      countMode: "dias_uteis",
      legalArticle: "Art. 1.023, § 2º, do CPC (Prazo de 5 dias úteis)",
      urgency: "fatal",
      summary: "Intimação do embargado para manifestar-se sobre os embargos com potencial efeito infringente.",
      recommendedAction: "Apresentar resposta aos embargos demonstrando a ausência de vícios na decisão embargada.",
    };
  }

  // 5. Acórdão / Turma Recursal / Tribunal
  if (text.includes("acórdão") || text.includes("acordao") || text.includes("turma recursal") || text.includes("câmara cível")) {
    return {
      communicationType: "Publicação de Acórdão Colegiado",
      category: "prazo",
      suggestedTitle: "Análise de Acórdão e Prazos Recursais",
      suggestedDays: 15,
      countMode: "dias_uteis",
      legalArticle: "Art. 1.003, § 5º, do CPC (Prazo de 15 dias úteis)",
      urgency: "fatal",
      summary: "Acórdão publicado pelo colegiado do Tribunal. Início do prazo para Embargos de Declaração ou Recursos aos Tribunais Superiores (STJ/STF).",
      recommendedAction: "Estudar cabimento de Recurso Especial / Extraordinário ou providenciar cumprimento de julgado.",
    };
  }

  // 6. Laudo Pericial (Art. 477 CPC)
  if (text.includes("pericial") || text.includes("laudo pericial") || text.includes("perito") || text.includes("perícia")) {
    return {
      communicationType: "Intimação sobre Laudo Pericial",
      category: "prazo",
      suggestedTitle: "Manifestação sobre Laudo Pericial",
      suggestedDays: 15,
      countMode: "dias_uteis",
      legalArticle: "Art. 477, § 1º, do CPC (Prazo de 15 dias úteis)",
      urgency: "urgente",
      summary: "Juntada de laudo pelo perito judicial. Prazo para os assistentes técnicos e advogados formularem pareceres ou impugnações.",
      recommendedAction: "Encaminhar laudo ao assistente técnico do cliente e redigir manifestação circunstanciada.",
    };
  }

  // 7. Cumprimento de Sentença / Execução (Art. 523 / 525 CPC)
  if (text.includes("cumprimento de sentença") || text.includes("art. 523") || text.includes("art. 525") || text.includes("pagamento voluntário")) {
    return {
      communicationType: "Intimação de Cumprimento de Sentença",
      category: "prazo",
      suggestedTitle: "Prazo para Pagamento Voluntário ou Impugnação",
      suggestedDays: 15,
      countMode: "dias_uteis",
      legalArticle: "Art. 523 / 525 do CPC (15 dias para pagamento + 15 dias para impugnação)",
      urgency: "fatal",
      summary: "Início da fase executiva. Evite a multa de 10% e honorários de 10% do art. 523, § 1º, ou prepare a impugnação ao cumprimento de sentença.",
      recommendedAction: "Notificar o cliente para providenciar o depósito voluntário ou apresentar impugnação com garantia do juízo.",
    };
  }

  // 8. Contestação (Art. 335 CPC)
  if (text.includes("contestar") || text.includes("contestação") || text.includes("art. 335")) {
    return {
      communicationType: "Citação / Intimação para Contestação",
      category: "prazo",
      suggestedTitle: "Elaborar e Protocolar Contestação",
      suggestedDays: 15,
      countMode: "dias_uteis",
      legalArticle: "Art. 335 do CPC (Prazo de 15 dias úteis)",
      urgency: "fatal",
      summary: "Prazo para apresentação de defesa com arguição de preliminares e mérito, sob pena de revelia.",
      recommendedAction: "Reunir subsídios fáticos e documentais com o cliente para a peça de bloqueio.",
    };
  }

  // 9. Réplica (Art. 350 / 351 CPC)
  if (text.includes("réplica") || text.includes("impugnação à contestação") || text.includes("manifestar sobre a contestação")) {
    return {
      communicationType: "Intimação para Réplica à Contestação",
      category: "prazo",
      suggestedTitle: "Apresentar Réplica à Contestação",
      suggestedDays: 15,
      countMode: "dias_uteis",
      legalArticle: "Art. 350 e 351 do CPC (Prazo de 15 dias úteis)",
      urgency: "urgente",
      summary: "Abertura de prazo para impugnar documentos e preliminares trazidas pela defesa.",
      recommendedAction: "Elaborar Réplica ratificando os termos da exordial e rebatendo preliminares.",
    };
  }

  // 10. Despacho Ordinatório / Padrão (Art. 218 § 3º CPC)
  return {
    communicationType: "Despacho Judicial de Expediente",
    category: "prazo",
    suggestedTitle: "Manifestação sobre Despacho Judicial",
    suggestedDays: 5,
    countMode: "dias_uteis",
    legalArticle: "Art. 218, § 3º, do CPC (Prazo supletivo de 5 dias úteis)",
    urgency: "normal",
    summary: "Despacho sem prazo expressamente fixado pela legislação ou pelo magistrado. Aplica-se a regra geral supletiva de 5 dias úteis.",
    recommendedAction: "Examinar o teor do despacho e dar cumprimento à determinação judicial no prazo.",
  };
}
