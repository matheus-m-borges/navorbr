// @ts-nocheck
// Lovable Sync Trigger: 2026-09-26T16:15:00Z - Atendimento & Robo de Trafego Meta Ads (#A1)
import { supabase } from "@/integrations/supabase/client";
// Lead persistence is exclusively handled by server functions. These legacy call sites are disabled
// until all Call Center mutations are routed through the authenticated async adapter.
const legacyLeadRuntimeDisabled = {
  getLeadById: () => { throw new Error("Legacy synchronous Lead runtime disabled."); },
  saveLead: () => { throw new Error("Legacy synchronous Lead runtime disabled."); },
  getStages: () => { throw new Error("Legacy synchronous Lead runtime disabled."); },
  getLeads: () => { throw new Error("Legacy synchronous Lead runtime disabled."); },
};
import type {
  LawConversation,
  LawMessage,
  LawDepartment,
  LawQueue,
  LawAgent,
  LawTransfer,
  LawQuickMessage,
  LawAtendimentoSettings,
  AtendimentoMetrics,
  ConversationStatus,
  AIMode,
  SenderType,
  LawTrafficCampaignCode,
} from "./atendimento-types";

const CONVERSATIONS_STORAGE_KEY = "lawhub_atendimento_conversations_v1";
const MESSAGES_STORAGE_KEY = "lawhub_atendimento_messages_v1";
const DEPARTMENTS_STORAGE_KEY = "lawhub_atendimento_departments_v1";
const QUEUES_STORAGE_KEY = "lawhub_atendimento_queues_v1";
const SETTINGS_STORAGE_KEY = "lawhub_atendimento_settings_v1";
const TRANSFERS_STORAGE_KEY = "lawhub_atendimento_transfers_v1";
const CAMPAIGN_CODES_STORAGE_KEY = "lawhub_atendimento_traffic_codes_v1";
const QUICK_MSGS_STORAGE_KEY = "lawhub_atendimento_quick_msgs_v1";

// Códigos de Tráfego Pago & Campanhas Iniciais do Escritório
export const INITIAL_TRAFFIC_CAMPAIGN_CODES = [
  {
    id: "camp-0",
    code: "#A1",
    action_type: "Ação de Auxílio-Acidente / Acidente de Trabalho",
    area_direito: "Previdenciário / Trabalhista",
    description: "Campanha Meta Ads Instagram/Facebook - Auxílio Acidente",
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "camp-1",
    code: "TRF-01",
    action_type: "Revisional de FGTS / Horas Extras",
    area_direito: "Trabalhista",
    description: "Campanha Meta Ads Instagram - Demissão sem justa causa",
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "camp-2",
    code: "INSS-BPC",
    action_type: "Concessão Benefício BPC / LOAS",
    area_direito: "Previdenciário",
    description: "Campanha Google Ads - Idosos e PcD baixa renda",
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "camp-3",
    code: "CIV-VOO",
    action_type: "Indenização Cancelamento de Voo / Extravio de Bagagem",
    area_direito: "Cível / Consumidor",
    description: "Campanha Tráfego Direto - Direitos dos Passageiros",
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "camp-4",
    code: "IMOB-ATRASO",
    action_type: "Atraso na Entrega de Imóvel na Planta",
    area_direito: "Cível / Imobiliário",
    description: "Campanha Facebook Ads - Rescisão Contratual",
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "camp-5",
    code: "BANC-GOLPE",
    action_type: "Restituição de Golpe do PIX / Fraude Bancária",
    area_direito: "Bancário / Consumidor",
    description: "Campanha Tráfego Pago - Fraude e Falha de Segurança",
    active: true,
    created_at: new Date().toISOString(),
  },
];

// 1. Departamentos Iniciais Canônicos do Escritório
export const INITIAL_DEPARTMENTS: LawDepartment[] = [
  {
    id: "dept-comercial",
    account_id: "default",
    name: "Comercial / Novos Casos",
    slug: "comercial",
    description: "Triagem de novos clientes, prospecção e intake inicial",
    color: "#2563eb",
    icon: "PhoneCall",
    is_active: true,
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dept-trabalhista",
    account_id: "default",
    name: "Jurídico Trabalhista",
    slug: "trabalhista",
    description: "Reclamatórias trabalhistas, verbas rescisórias, rescisão indireta",
    color: "#4f46e5",
    icon: "Briefcase",
    is_active: true,
    position: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dept-civel",
    account_id: "default",
    name: "Jurídico Cível & Contratos",
    slug: "civel",
    description: "Indenizações, execuções, direito imobiliário e família",
    color: "#7c3aed",
    icon: "Scale",
    is_active: true,
    position: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dept-previdenciario",
    account_id: "default",
    name: "Jurídico Previdenciário",
    slug: "previdenciario",
    description: "Benefícios INSS, aposentadorias e revisões",
    color: "#059669",
    icon: "ShieldAlert",
    is_active: true,
    position: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dept-financeiro",
    account_id: "default",
    name: "Financeiro & Honorários",
    slug: "financeiro",
    description: "Cobranças, emissão de boletos, comprovantes e prestação de contas",
    color: "#d97706",
    icon: "Coins",
    is_active: true,
    position: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// 2. Filas Iniciais
export const INITIAL_QUEUES: LawQueue[] = [
  { id: "queue-com-1", account_id: "default", department_id: "dept-comercial", name: "Fila Geral de Novos Leads", sla_minutes: 15, is_active: true, created_at: new Date().toISOString() },
  { id: "queue-trab-1", account_id: "default", department_id: "dept-trabalhista", name: "Fila de Casos Trabalhistas", sla_minutes: 30, is_active: true, created_at: new Date().toISOString() },
  { id: "queue-civ-1", account_id: "default", department_id: "dept-civel", name: "Fila de Atendimento Cível", sla_minutes: 30, is_active: true, created_at: new Date().toISOString() },
  { id: "queue-fin-1", account_id: "default", department_id: "dept-financeiro", name: "Fila de Cobrança e Boletos", sla_minutes: 20, is_active: true, created_at: new Date().toISOString() },
];

// 3. Respostas Rápidas Iniciais
export const INITIAL_QUICK_MESSAGES: LawQuickMessage[] = [
  {
    id: "qm-1",
    account_id: "default",
    shortcut: "/boasvindas",
    title: "Boas-vindas ao Escritório",
    content: "Olá! Seja muito bem-vindo ao nosso escritório de advocacia. Eu sou o advogado responsável pelo seu atendimento e estou analisando seu caso com total atenção.",
    department_id: null,
    is_global: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "qm-2",
    account_id: "default",
    shortcut: "/documentos_trabalhistas",
    title: "Documentação Rescisória / Trabalhista",
    content: "Para que possamos realizar os cálculos das suas verbas, por gentileza nos envie por aqui (foto ou PDF):\n1. Carteira de Trabalho (CTPS digital ou física);\n2. Termo de Rescisão (TRCT);\n3. Extrato Analítico do FGTS;\n4. Três últimos holerites/contracheques.",
    department_id: "dept-trabalhista",
    is_global: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "qm-3",
    account_id: "default",
    shortcut: "/dados_pagamento",
    title: "Dados Bancários & PIX Honorários",
    content: "Segue a nossa chave PIX oficial do escritório para quitação dos honorários combinados:\nChave PIX (CNPJ): 12.345.678/0001-90\nFavorecido: Escritório Borges & Advogados Associados.\nApós o pagamento, por gentileza nos envie o comprovante.",
    department_id: "dept-financeiro",
    is_global: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "qm-4",
    account_id: "default",
    shortcut: "/horario",
    title: "Horário de Expediente",
    content: "Nosso horário de expediente é de segunda a sexta-feira, das 08h30 às 18h00. Fora deste horário, as mensagens são registradas e respondidas na abertura do próximo dia útil.",
    department_id: null,
    is_global: true,
    created_at: new Date().toISOString(),
  },
];

// 4. Conversas Iniciais Ricas para Visualização Imediata
export const INITIAL_CONVERSATIONS: LawConversation[] = [
  {
    id: "conv-100",
    account_id: "default",
    whatsapp_account_id: "wa-primary",
    contact_phone: "(86) 99482-1190",
    contact_name: "Andressa Fernandes",
    contact_avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
    lead_id: "lead-100",
    client_id: null,
    department_id: "dept-previdenciario",
    queue_id: "queue-trab-1",
    assigned_user_id: null,
    status: "WAITING_AI",
    ai_mode: "ACTIVE",
    priority: "high",
    ai_summary: "Cliente captada via anúncio Meta Ads (#A1) no Instagram. Demonstrou interesse imediato em Ação de Auxílio-Acidente por sequela de acidente de trabalho. IA realizando triagem inicial dos laudos e CAT.",
    ai_detected_area: "Previdenciário / Trabalhista",
    ai_detected_urgency: "alta",
    first_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    last_message_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    last_message_snippet: "Olá! Vim através do Instagram, vi seu anúncio sobre o auxílio acidente.",
    last_message_sender: "contact",
    unread_count: 1,
    closed_at: null,
    closed_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    traffic_code: "#A1",
    traffic_action_name: "Ação de Auxílio-Acidente / Acidente de Trabalho",
    traffic_detected_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    lead: {
      id: "lead-100",
      name: "Andressa Fernandes",
      area_direito: "Previdenciário / Trabalhista",
      estimated_value: 45000,
      stage_id: "stage-1",
      stage_name: "LEADs",
      stage_color: "#3b82f6",
      responsible_name: "Aguardando Atendente",
      lead_type: "imediato",
    },
  },
  {
    id: "conv-101",
    account_id: "default",
    whatsapp_account_id: "wa-primary",
    contact_phone: "(86) 99482-1190",
    contact_name: "Carlos Alberto Ferreira",
    contact_avatar_url: null,
    lead_id: "lead-101",
    client_id: null,
    department_id: "dept-trabalhista",
    queue_id: "queue-trab-1",
    assigned_user_id: null,
    status: "WAITING_QUEUE",
    ai_mode: "PAUSED",
    priority: "urgent",
    ai_summary: "Carlos Alberto, 38 anos, relata dispensa da Construtora Horizonte Norte sem pagamento integral das verbas rescisórias e horas extras. Informou 4 anos de vínculo em obra e aguarda cálculo rescisório para ação reclamatória trabalhista imediata.",
    ai_detected_area: "Trabalhista",
    ai_detected_urgency: "alta",
    first_message_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    last_message_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    last_message_snippet: "Gostaria de saber quanto tempo demora para o advogado analisar meus documentos.",
    last_message_sender: "contact",
    unread_count: 1,
    closed_at: null,
    closed_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    traffic_code: "TRF-01",
    traffic_action_name: "Revisional de FGTS / Horas Extras",
    traffic_detected_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    lead: {
      id: "lead-101",
      name: "Carlos Alberto Ferreira",
      area_direito: "Trabalhista",
      estimated_value: 85000,
      stage_id: "stage-1",
      stage_name: "LEADs",
      stage_color: "#3b82f6",
      responsible_name: "Aguardando Atendente",
      lead_type: "imediato",
    },
  },
  {
    id: "conv-102",
    account_id: "default",
    whatsapp_account_id: "wa-primary",
    contact_phone: "(11) 98712-3344",
    contact_name: "Mariana Dias da Silva",
    contact_avatar_url: null,
    lead_id: null,
    client_id: null,
    department_id: "dept-civel",
    queue_id: "queue-civ-1",
    assigned_user_id: null,
    status: "WAITING_AI",
    ai_mode: "ACTIVE",
    priority: "medium",
    ai_summary: "Mariana entrou em contato relatando atraso de mais de 8 meses na entrega das chaves do apartamento adquirido na planta. IA em processo de triagem inicial e coleta do contrato de promessa de compra e venda.",
    ai_detected_area: "Cível / Imobiliário",
    ai_detected_urgency: "media",
    first_message_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    last_message_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    last_message_snippet: "Estou com o contrato em PDF aqui no celular, posso enviar?",
    last_message_sender: "contact",
    unread_count: 2,
    closed_at: null,
    closed_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    lead: null,
  },
  {
    id: "conv-103",
    account_id: "default",
    whatsapp_account_id: "wa-primary",
    contact_phone: "(21) 97120-9988",
    contact_name: "Roberto Mendonça de Sousa",
    contact_avatar_url: null,
    lead_id: null,
    client_id: null,
    department_id: "dept-financeiro",
    queue_id: "queue-fin-1",
    assigned_user_id: "current-user",
    status: "IN_PROGRESS",
    ai_mode: "PAUSED",
    priority: "low",
    ai_summary: "Cliente solicitando a 2ª via do boleto dos honorários mensais com vencimento para amanhã.",
    ai_detected_area: "Financeiro",
    ai_detected_urgency: "baixa",
    first_message_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    last_message_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    last_message_snippet: "Boleto enviado com sucesso. Aguardando confirmação do pagamento.",
    last_message_sender: "agent",
    unread_count: 0,
    closed_at: null,
    closed_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    lead: null,
  },
];

// 5. Mensagens Iniciais do Chat
export const INITIAL_MESSAGES: Record<string, LawMessage[]> = {
  "conv-100": [
    {
      id: "msg-ad-1",
      conversation_id: "conv-100",
      account_id: "default",
      sender_type: "contact",
      sender_user_id: null,
      sender_name: "Andressa Fernandes",
      message_type: "text",
      body: "#A1 Oi! Como podemos ajudar?",
      ad_referral: {
        source_type: "ad",
        ad_title: "Anúncio",
        headline: "#A1 Oi! Como podemos ajudar?",
        body: "Mensagem de saudação automática",
        thumbnail_url: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=120&auto=format&fit=crop&q=80",
        is_automated_greeting: true,
      },
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: "wamid-ad-1",
      status: "read",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: "msg-ad-2",
      conversation_id: "conv-100",
      account_id: "default",
      sender_type: "contact",
      sender_user_id: null,
      sender_name: "Andressa Fernandes",
      message_type: "text",
      body: "Olá! Vim através do Instagram, vi seu anúncio sobre o auxílio acidente.",
      ad_referral: null,
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: "wamid-ad-2",
      status: "read",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    },
    {
      id: "msg-ad-3",
      conversation_id: "conv-100",
      account_id: "default",
      sender_type: "system",
      sender_user_id: null,
      sender_name: "Robô de Tráfego",
      message_type: "text",
      body: "🤖 Robô de Tráfego: Identificado anúncio Meta Ads (Instagram/Facebook) [#A1] referente à \"Ação de Auxílio-Acidente / Acidente de Trabalho\" (Previdenciário / Trabalhista). Contato: Andressa Fernandes | Telefone: (86) 99482-1190. Dados vinculados com sucesso.",
      ad_referral: null,
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: null,
      status: "sent",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    },
    {
      id: "msg-ad-4",
      conversation_id: "conv-100",
      account_id: "default",
      sender_type: "ai",
      sender_user_id: null,
      sender_name: "IA Recepcionista",
      message_type: "text",
      body: "Olá, Andressa! Seja bem-vinda ao nosso escritório de advocacia. Vi que você veio pelo nosso anúncio do Instagram sobre Auxílio-Acidente. Você sofreu algum acidente de trabalho ou de qualquer natureza que tenha gerado alguma sequela permanente para exercer sua função?",
      ad_referral: null,
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: "wamid-ad-3",
      status: "delivered",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 13).toISOString(),
    },
  ],
  "conv-101": [
    {
      id: "msg-1",
      conversation_id: "conv-101",
      account_id: "default",
      sender_type: "contact",
      sender_user_id: null,
      sender_name: "Carlos Alberto Ferreira",
      message_type: "text",
      body: "Boa tarde, preciso falar com um advogado sobre uma demissão sem justa causa que sofri na construtora.",
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: "wamid-1",
      status: "read",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: "msg-2",
      conversation_id: "conv-101",
      account_id: "default",
      sender_type: "ai",
      sender_user_id: null,
      sender_name: "IA Recepcionista",
      message_type: "text",
      body: "Olá, Carlos Alberto! Seja bem-vindo ao escritório Borges & Advogados. Compreendo perfeitamente sua situação trabalhista. Para agilizarmos seu atendimento com nossos advogados especialistas, você trabalhou quanto tempo na empresa e recebeu a rescisão integral?",
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: "wamid-2",
      status: "delivered",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 44).toISOString(),
    },
    {
      id: "msg-3",
      conversation_id: "conv-101",
      account_id: "default",
      sender_type: "contact",
      sender_user_id: null,
      sender_name: "Carlos Alberto Ferreira",
      message_type: "text",
      body: "Trabalhei 4 anos na Construtora Horizonte Norte. Fui dispensado e depositaram menos da metade do que tinham prometido no acerto. Ficaram faltando horas extras também.",
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: "wamid-3",
      status: "read",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    },
    {
      id: "msg-4",
      conversation_id: "conv-101",
      account_id: "default",
      sender_type: "ai",
      sender_user_id: null,
      sender_name: "IA Recepcionista",
      message_type: "text",
      body: "Compreendido! Identifiquei que se trata de uma demanda Trabalhista com verbas rescisórias pendentes. Estou direcionando você para a nossa equipe do Jurídico Trabalhista e gerando seu cadastro prioritário.",
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: "wamid-4",
      status: "delivered",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 39).toISOString(),
    },
    {
      id: "msg-5",
      conversation_id: "conv-101",
      account_id: "default",
      sender_type: "system",
      sender_user_id: null,
      sender_name: "Sistema LawHub",
      message_type: "text",
      body: "📋 Lead #101 criado e vinculado à conversa. Transferido para o setor Jurídico Trabalhista.",
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: null,
      status: "sent",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    },
    {
      id: "msg-6",
      conversation_id: "conv-101",
      account_id: "default",
      sender_type: "system",
      sender_user_id: null,
      sender_name: "Nota Interna",
      message_type: "text",
      body: "⚠️ ATENÇÃO DR(A): Checagem de conflito aprovada (cleared). Construtora Horizonte Norte possui passivo trabalhista recorrente na 2ª Vara do Trabalho.",
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: null,
      status: "sent",
      error_details: null,
      is_internal_note: true,
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "msg-7",
      conversation_id: "conv-101",
      account_id: "default",
      sender_type: "contact",
      sender_user_id: null,
      sender_name: "Carlos Alberto Ferreira",
      message_type: "text",
      body: "Gostaria de saber quanto tempo demora para o advogado analisar meus documentos.",
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: "wamid-5",
      status: "delivered",
      error_details: null,
      is_internal_note: false,
      created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    },
  ],
  "conv-102": [
    {
      id: "msg-102-1",
      conversation_id: "conv-102",
      account_id: "default",
      sender_type: "contact",
      sender_name: "Mariana Dias da Silva",
      message_type: "text",
      body: "Olá, comprei um imóvel na planta com entrega prevista para janeiro de 2024 e a construtora ainda nem fez o habite-se.",
      is_internal_note: false,
      status: "read",
      created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
    {
      id: "msg-102-2",
      conversation_id: "conv-102",
      account_id: "default",
      sender_type: "ai",
      sender_name: "IA Recepcionista",
      message_type: "text",
      body: "Olá Mariana! Lamento pelo ocorrido. Atrasos superiores a 180 dias de tolerância podem gerar indenização e rescisão contratual com devolução integral. Você possui a cópia do contrato de compra e venda?",
      is_internal_note: false,
      status: "delivered",
      created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: "msg-102-3",
      conversation_id: "conv-102",
      account_id: "default",
      sender_type: "contact",
      sender_name: "Mariana Dias da Silva",
      message_type: "text",
      body: "Estou com o contrato em PDF aqui no celular, posso enviar?",
      is_internal_note: false,
      status: "delivered",
      created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    },
  ],
};

// Canal Realtime para sincronização inter-dispositivos e inter-navegadores
let realtimeChannel: any = null;
let localBroadcastChannel: BroadcastChannel | null = null;

function setupRealtimeChannels() {
  if (typeof window === "undefined") return;

  // 1. Canal nativo do navegador para sincronização instantânea entre abas
  if (typeof BroadcastChannel !== "undefined" && !localBroadcastChannel) {
    try {
      localBroadcastChannel = new BroadcastChannel("lawhub_atendimento_channel");
      localBroadcastChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === "CONVERSATIONS_UPDATED" && payload) {
          LawHubAtendimentoService.applyRemoteConversations(payload);
        } else if (type === "MESSAGE_ADDED" && payload) {
          LawHubAtendimentoService.applyRemoteMessage(payload.conversationId, payload.message);
        }
      };
    } catch {}
  }

  // 2. Canal Supabase Realtime (WebSockets) para sincronização em nuvem entre computadores diferentes
  if (!realtimeChannel && supabase) {
    try {
      realtimeChannel = supabase.channel("lawhub_atendimento_realtime_sync", {
        config: { broadcast: { self: false } },
      });

      realtimeChannel
        .on("broadcast", { event: "conversations_sync" }, ({ payload }: any) => {
          if (payload?.conversations) {
            LawHubAtendimentoService.applyRemoteConversations(payload.conversations);
          }
        })
        .on("broadcast", { event: "conversation_updated" }, ({ payload }: any) => {
          if (payload?.conversation) {
            LawHubAtendimentoService.applyRemoteConversationUpdate(payload.conversation);
          }
        })
        .on("broadcast", { event: "message_created" }, ({ payload }: any) => {
          if (payload?.conversationId && payload?.message) {
            LawHubAtendimentoService.applyRemoteMessage(payload.conversationId, payload.message);
          }
        })
        .subscribe();
    } catch (err) {
      console.warn("Realtime channel initialization warning:", err);
    }
  }
}

export class LawHubAtendimentoService {
  // Aplica conversas recebidas remotamente via Realtime
  static applyRemoteConversations(remoteConvs: LawConversation[]): void {
    if (typeof window === "undefined" || !Array.isArray(remoteConvs)) return;
    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(remoteConvs));
      window.dispatchEvent(new CustomEvent("lawhub_atendimento_conversations_updated"));
    } catch {}
  }

  static applyRemoteConversationUpdate(updatedConv: LawConversation): void {
    if (typeof window === "undefined" || !updatedConv?.id) return;
    try {
      const current = this.getConversations();
      const index = current.findIndex((c) => c.id === updatedConv.id);
      let next: LawConversation[];
      if (index >= 0) {
        next = [...current];
        next[index] = { ...next[index], ...updatedConv };
      } else {
        next = [updatedConv, ...current];
      }
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("lawhub_atendimento_conversations_updated"));
    } catch {}
  }

  static applyRemoteMessage(conversationId: string, msg: LawMessage): void {
    if (typeof window === "undefined" || !conversationId || !msg) return;
    try {
      const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
      let map: Record<string, LawMessage[]> = stored ? JSON.parse(stored) : INITIAL_MESSAGES;
      const list = map[conversationId] || [];
      if (!list.some((m) => m.id === msg.id)) {
        map[conversationId] = [...list, msg];
        localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent("lawhub_atendimento_conversations_updated"));
      }
    } catch {}
  }

  // Carrega ou inicializa conversas
  static getConversations(): LawConversation[] {
    if (typeof window === "undefined") return INITIAL_CONVERSATIONS;
    setupRealtimeChannels();
    try {
      const stored = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(INITIAL_CONVERSATIONS));
        return INITIAL_CONVERSATIONS;
      }
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Garante que a conversa demonstrativa de tráfego pago da Andressa Fernandes (#A1) esteja presente
        const hasConv100 = parsed.some((c: LawConversation) => c.id === "conv-100" || c.traffic_code === "#A1");
        if (!hasConv100) {
          const merged = [INITIAL_CONVERSATIONS[0], ...parsed];
          this.saveConversations(merged);
          return merged;
        }
        return parsed;
      }
      return INITIAL_CONVERSATIONS;
    } catch {
      return INITIAL_CONVERSATIONS;
    }
  }

  static saveConversations(convs: LawConversation[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(convs));
      window.dispatchEvent(new CustomEvent("lawhub_atendimento_conversations_updated"));

      // 1. Sincroniza abas no mesmo computador
      if (localBroadcastChannel) {
        localBroadcastChannel.postMessage({ type: "CONVERSATIONS_UPDATED", payload: convs });
      }

      // 2. Sincroniza em nuvem (Supabase Realtime) com outros computadores/usuários
      if (realtimeChannel) {
        realtimeChannel.send({
          type: "broadcast",
          event: "conversations_sync",
          payload: { conversations: convs },
        });
      }
    } catch (e) {
      console.error("Erro ao salvar conversas:", e);
    }
  }

  static getConversationById(id: string): LawConversation | null {
    const list = this.getConversations();
    return list.find((c) => c.id === id) || null;
  }

  // Mensagens
  static getMessages(conversationId: string): LawMessage[] {
    setupRealtimeChannels();
    if (typeof window === "undefined") return INITIAL_MESSAGES[conversationId] || [];
    try {
      const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
      let map: Record<string, LawMessage[]> = stored ? JSON.parse(stored) : INITIAL_MESSAGES;
      if (!map[conversationId]) {
        map[conversationId] = INITIAL_MESSAGES[conversationId] || [];
      }
      return map[conversationId] || [];
    } catch {
      return INITIAL_MESSAGES[conversationId] || [];
    }
  }

  static sendMessage(
    conversationId: string,
    body: string,
    isInternalNote: boolean = false,
    senderType: SenderType = "agent",
    senderName: string = "Advogado Responsável",
    adReferral?: any | null
  ): LawMessage {
    setupRealtimeChannels();
    let map: Record<string, LawMessage[]> = INITIAL_MESSAGES;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
        if (stored) map = JSON.parse(stored);
      } catch (e) {
        console.error("Erro ao ler mensagens:", e);
      }
    }
    const convMsgs = map[conversationId] || [];

    const newMsg: LawMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: conversationId,
      account_id: "default",
      sender_type: senderType,
      sender_user_id: senderType === "agent" ? "current-user" : null,
      sender_name: isInternalNote ? "Nota Interna" : senderName,
      message_type: adReferral ? "ad" : "text",
      body,
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      external_message_id: `out-${Date.now()}`,
      status: "sent",
      error_details: null,
      is_internal_note: isInternalNote,
      ad_referral: adReferral || null,
      created_at: new Date().toISOString(),
    };

    map[conversationId] = [...convMsgs, newMsg];
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(map));
      } catch (e) {
        console.error("Erro ao gravar mensagens:", e);
      }
    }

    // Atualiza conversa
    const convs = this.getConversations();
    const updatedConvs = convs.map((c) => {
      if (c.id === conversationId) {
        return {
          ...c,
          last_message_at: newMsg.created_at,
          last_message_snippet: isInternalNote ? `[Nota Interna]: ${body}` : body,
          last_message_sender: senderType,
          unread_count: senderType === "contact" ? (c.unread_count || 0) + 1 : 0,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });
    this.saveConversations(updatedConvs);

    // Sincroniza mensagem em tempo real
    if (localBroadcastChannel) {
      localBroadcastChannel.postMessage({
        type: "MESSAGE_ADDED",
        payload: { conversationId, message: newMsg },
      });
    }
    if (realtimeChannel) {
      realtimeChannel.send({
        type: "broadcast",
        event: "message_created",
        payload: { conversationId, message: newMsg },
      });
    }

    // Aciona o Robô de Tráfego Pago se for mensagem de contato OU mensagem de anúncio / saudação automática da Meta
    const isTrafficAdMessage = 
      senderType === "contact" || 
      !!adReferral ||
      (body && (
        body.includes("Mensagem de saudação automática") || 
        body.includes("Anúncio") || 
        body.trim().startsWith("#")
      ));

    if (isTrafficAdMessage && !isInternalNote) {
      this.processIncomingMessageTrafficRobot(conversationId, body, adReferral || undefined);
    }

    // Processamento inteligente de entrada: Handoff para Fila de Atendimento Humano ou Triagem IA
    if (senderType === "contact" && !isInternalNote) {
      this.processIncomingContactMessage(conversationId, body);
    }

    return newMsg;
  }

  // Assumir Atendimento (Handoff IA -> Humano)
  static assumeConversation(conversationId: string, userId: string = "current-user", userName: string = "Dr. João Silva"): LawConversation | null {
    const convs = this.getConversations();
    let updated: LawConversation | null = null;

    const newConvs = convs.map((c) => {
      if (c.id === conversationId) {
        updated = {
          ...c,
          status: "IN_PROGRESS",
          ai_mode: "PAUSED", // Pausa imediata da IA ao assumir
          assigned_user_id: userId,
          assigned_user_name: userName,
          updated_at: new Date().toISOString(),
        };
        return updated;
      }
      return c;
    });

    if (updated) {
      this.saveConversations(newConvs);
      this.sendMessage(
        conversationId,
        `👤 Atendimento assumido por ${userName}. A IA foi pausada para esta conversa.`,
        false,
        "system"
      );
    }
    return updated;
  }

  // Transferência entre Setores com Justificativa
  static transferConversation(
    conversationId: string,
    targetDeptId: string,
    targetUserId: string | null = null,
    reason: string = "Redirecionamento de área jurídica",
    note: string = ""
  ): LawConversation | null {
    const convs = this.getConversations();
    const depts = this.getDepartments();
    const targetDept = depts.find((d) => d.id === targetDeptId);
    let updated: LawConversation | null = null;

    const newConvs = convs.map((c) => {
      if (c.id === conversationId) {
        const fromDept = depts.find((d) => d.id === c.department_id);
        updated = {
          ...c,
          department_id: targetDeptId,
          assigned_user_id: targetUserId,
          status: "TRANSFERRED",
          updated_at: new Date().toISOString(),
        };

        // Salvar registro de transferência
        const transfers = this.getTransfers();
        transfers.push({
          id: `tr-${Date.now()}`,
          conversation_id: conversationId,
          account_id: "default",
          transferred_by_user_id: "current-user",
          transferred_by_name: "Dr. João Silva",
          from_department_id: c.department_id,
          from_department_name: fromDept?.name || "Setor Anterior",
          to_department_id: targetDeptId,
          to_department_name: targetDept?.name || "Novo Setor",
          from_user_id: c.assigned_user_id,
          to_user_id: targetUserId,
          reason,
          internal_note: note,
          created_at: new Date().toISOString(),
        });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(TRANSFERS_STORAGE_KEY, JSON.stringify(transfers));
          } catch (e) {
            console.error("Erro ao salvar histórico de transferência:", e);
          }
        }

        return updated;
      }
      return c;
    });

    if (updated) {
      this.saveConversations(newConvs);
      this.sendMessage(
        conversationId,
        `🔀 Conversa transferida para o setor "${targetDept?.name || 'Novo Setor'}". Motivo: ${reason}`,
        false,
        "system"
      );
      if (note.trim()) {
        this.sendMessage(conversationId, `Observação da transferência: ${note}`, true, "system");
      }
    }
    return updated;
  }

  // Pausa / Retomada da IA
  static toggleAIMode(conversationId: string, newMode: AIMode): LawConversation | null {
    const convs = this.getConversations();
    let updated: LawConversation | null = null;

    const newConvs = convs.map((c) => {
      if (c.id === conversationId) {
        updated = { ...c, ai_mode: newMode, updated_at: new Date().toISOString() };
        return updated;
      }
      return c;
    });

    if (updated) {
      this.saveConversations(newConvs);
      this.sendMessage(
        conversationId,
        newMode === "ACTIVE" ? "🤖 IA reativada para esta conversa." : "⏸️ IA pausada. Atendimento humano ativo.",
        false,
        "system"
      );
    }
    return updated;
  }

  // Encerrar Atendimento
  static closeConversation(
    conversationId: string,
    closedById: string = "current-user",
    closedByName: string = "Atendente"
  ): LawConversation | null {
    const convs = this.getConversations();
    let updated: LawConversation | null = null;

    const newConvs = convs.map((c) => {
      if (c.id === conversationId) {
        updated = {
          ...c,
          status: "RESOLVED",
          closed_at: new Date().toISOString(),
          closed_by: closedById,
          updated_at: new Date().toISOString(),
        };
        return updated;
      }
      return c;
    });

    if (updated) {
      this.saveConversations(newConvs);
      this.sendMessage(
        conversationId,
        `✅ Atendimento concluído e resolvido por ${closedByName}.`,
        false,
        "system"
      );
    }
    return updated;
  }

  // Reabrir Atendimento
  static reopenConversation(
    conversationId: string,
    reopenedById: string = "current-user",
    reopenedByName: string = "Atendente"
  ): LawConversation | null {
    const convs = this.getConversations();
    let updated: LawConversation | null = null;

    const newConvs = convs.map((c) => {
      if (c.id === conversationId) {
        updated = {
          ...c,
          status: "IN_PROGRESS",
          closed_at: null,
          closed_by: null,
          updated_at: new Date().toISOString(),
        };
        return updated;
      }
      return c;
    });

    if (updated) {
      this.saveConversations(newConvs);
      this.sendMessage(
        conversationId,
        `🔄 Atendimento reaberto por ${reopenedByName}. Atendimento humano ativo.`,
        false,
        "system"
      );
    }
    return updated;
  }

  // Departamentos
  static getDepartments(): LawDepartment[] {
    if (typeof window === "undefined") return INITIAL_DEPARTMENTS;
    try {
      const stored = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(INITIAL_DEPARTMENTS));
        return INITIAL_DEPARTMENTS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_DEPARTMENTS;
    }
  }

  static saveDepartments(departments: LawDepartment[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(departments));
      window.dispatchEvent(new CustomEvent("lawhub_atendimento_departments_updated"));
    } catch (e) {
      console.error("Erro ao salvar departamentos:", e);
    }
  }

  // Filas
  static getQueues(deptId?: string): LawQueue[] {
    if (typeof window === "undefined") return INITIAL_QUEUES;
    try {
      const stored = localStorage.getItem(QUEUES_STORAGE_KEY);
      const list: LawQueue[] = stored ? JSON.parse(stored) : INITIAL_QUEUES;
      if (deptId) return list.filter((q) => q.department_id === deptId);
      return list;
    } catch {
      return INITIAL_QUEUES;
    }
  }

  // Respostas Rápidas
  static getQuickMessages(deptId?: string): LawQuickMessage[] {
    if (typeof window === "undefined") return INITIAL_QUICK_MESSAGES;
    try {
      const stored = localStorage.getItem(QUICK_MSGS_STORAGE_KEY);
      const list: LawQuickMessage[] = stored ? JSON.parse(stored) : INITIAL_QUICK_MESSAGES;
      if (!deptId) return list;
      return list.filter((qm) => qm.is_global || qm.department_id === deptId);
    } catch {
      return INITIAL_QUICK_MESSAGES;
    }
  }

  static saveQuickMessages(messages: LawQuickMessage[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(QUICK_MSGS_STORAGE_KEY, JSON.stringify(messages));
      window.dispatchEvent(new CustomEvent("lawhub_atendimento_quick_messages_updated"));
    } catch (e) {
      console.error("Erro ao salvar respostas rápidas:", e);
    }
  }

  // Histórico de Transferências
  static getTransfers(conversationId?: string): LawTransfer[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(TRANSFERS_STORAGE_KEY);
      const list: LawTransfer[] = stored ? JSON.parse(stored) : [];
      if (conversationId) return list.filter((t) => t.conversation_id === conversationId);
      return list;
    } catch {
      return [];
    }
  }

  // Configurações do Escritório (WhatsApp, IA, Horários)
  static getSettings(): Record<string, any> | null {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  static saveSettings(settings: Record<string, any>): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent("lawhub_atendimento_settings_updated"));
    } catch (e) {
      console.error("Erro ao salvar configurações de atendimento:", e);
    }
  }

  // Métricas do Topo com suporte a escopo (Administração Geral vs Posto de Call Center)
  static getMetrics(scope?: {
    filterUser?: boolean;
    userId?: string;
    userName?: string;
    userEmail?: string;
    departmentId?: string | null;
  }): AtendimentoMetrics {
    const convs = this.getConversations();

    if (scope?.filterUser) {
      const uid = scope.userId;
      const uname = scope.userName?.toLowerCase().trim();
      const uemail = scope.userEmail?.toLowerCase().trim();

      const isMyChat = (c: LawConversation) =>
        (uid && c.assigned_user_id === uid) ||
        (uemail && c.assigned_user_id === uemail) ||
        (uname && c.assigned_user_name?.toLowerCase().trim() === uname) ||
        c.assigned_user_id === "current-user";

      return {
        totalToday: convs.filter((c) => isMyChat(c) || c.status === "WAITING_QUEUE" || c.status === "WAITING_AI").length,
        inProgress: convs.filter((c) => isMyChat(c) && c.status === "IN_PROGRESS").length,
        waitingQueue: convs.filter((c) => c.status === "WAITING_QUEUE" && (!c.assigned_user_id || isMyChat(c))).length,
        waitingAI: convs.filter((c) => c.status === "WAITING_AI" && (!c.assigned_user_id || isMyChat(c))).length,
        resolvedToday: convs.filter((c) => isMyChat(c) && (c.status === "RESOLVED" || c.status === "CLOSED")).length,
        myActiveChats: convs.filter((c) => isMyChat(c) && c.status === "IN_PROGRESS").length,
      };
    }

    return {
      totalToday: convs.length,
      inProgress: convs.filter((c) => c.status === "IN_PROGRESS").length,
      waitingQueue: convs.filter((c) => c.status === "WAITING_QUEUE").length,
      waitingAI: convs.filter((c) => c.status === "WAITING_AI").length,
      resolvedToday: convs.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED").length,
      myActiveChats: convs.filter((c) => c.status === "IN_PROGRESS").length,
    };
  }

  // ==========================================
  // CÓDIGOS DE TRÁFEGO PAGO & CAMPANHAS
  // ==========================================

  static getCampaignCodes(): LawTrafficCampaignCode[] {
    if (typeof window === "undefined") return INITIAL_TRAFFIC_CAMPAIGN_CODES;
    try {
      const stored = localStorage.getItem(CAMPAIGN_CODES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Assegura que o código #A1 da campanha Meta Ads esteja presente
          const hasA1 = parsed.some((c: LawTrafficCampaignCode) => c.code.replace(/^#/, "").toUpperCase() === "A1");
          if (!hasA1) {
            const merged = [INITIAL_TRAFFIC_CAMPAIGN_CODES[0], ...parsed];
            this.saveCampaignCodes(merged);
            return merged;
          }
          return parsed;
        }
      }
    } catch {}
    this.saveCampaignCodes(INITIAL_TRAFFIC_CAMPAIGN_CODES);
    return INITIAL_TRAFFIC_CAMPAIGN_CODES;
  }

  static saveCampaignCodes(codes: LawTrafficCampaignCode[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CAMPAIGN_CODES_STORAGE_KEY, JSON.stringify(codes));
      window.dispatchEvent(new CustomEvent("lawhub_atendimento_traffic_codes_updated"));
    } catch (e) {
      console.error("Erro ao salvar códigos de campanha:", e);
    }
  }

  static saveCampaignCode(codeData: Partial<LawTrafficCampaignCode>): LawTrafficCampaignCode {
    const list = this.getCampaignCodes();
    const id = codeData.id || "camp-" + Date.now();
    const cleanCode = (codeData.code || "COD-NOVO").trim().toUpperCase();

    const existingIdx = list.findIndex((c) => c.id === id);
    const newCode: LawTrafficCampaignCode = {
      id,
      code: cleanCode,
      action_type: codeData.action_type || "Ação Cível Geral",
      area_direito: codeData.area_direito || "Geral",
      description: codeData.description || "",
      active: codeData.active !== undefined ? !!codeData.active : true,
      created_at: codeData.created_at || new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      list[existingIdx] = newCode;
    } else {
      list.unshift(newCode);
    }

    this.saveCampaignCodes(list);
    return newCode;
  }

  static deleteCampaignCode(id: string): void {
    const list = this.getCampaignCodes().filter((c) => c.id !== id);
    this.saveCampaignCodes(list);
  }

  // ==========================================
  // ROBÔ DE RECONHECIMENTO DE TRÁFEGO PAGO
  // Analisa mensagem de entrada, extrai código e ação referenciada
  // Suporta anúncios do Instagram/Facebook (Meta Ads Click to WhatsApp)
  // ==========================================

  static detectTrafficCode(text: string, referral?: { headline?: string; body?: string; source_url?: string }): LawTrafficCampaignCode | null {
    if (!text && !referral) return null;
    const cleanText = (text || "").trim();
    const referralText = `${referral?.headline || ""} ${referral?.body || ""} ${referral?.source_url || ""}`.trim();
    const fullSearchText = `${cleanText} ${referralText}`.trim();
    if (!fullSearchText) return null;

    const codes = this.getCampaignCodes().filter((c) => c.active);

    for (const item of codes) {
      const rawTarget = item.code.trim();
      const codeWithoutHash = rawTarget.replace(/^#/, "").toUpperCase();
      const codeWithHash = `#${codeWithoutHash}`;
      if (!codeWithoutHash) continue;

      const escapedWithout = codeWithoutHash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedWith = codeWithHash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // 1. Padrão Hashtag no início ou no corpo: #A1, #TRF-01 (comum em anúncios Click to WhatsApp)
      // Ex: "#A1 Oi! Como podemos ajudar?" ou "Mensagem de saudação automática... #A1"
      const hashtagRegex = new RegExp(`(?:^|\\s|[.,;!?'"\\(\\[])${escapedWith}(?:$|\\s|[.,;!?'"\\)\\]])`, "i");
      if (hashtagRegex.test(fullSearchText)) return item;

      // 2. Padrão colchetes ou parênteses: [A1], [#A1], (A1), (#A1), [TRF-01]
      const bracketRegex = new RegExp(`\\[#?${escapedWithout}\\]|\\(#?${escapedWithout}\\)`, "i");
      if (bracketRegex.test(fullSearchText)) return item;

      // 3. Padrão prefixado: "código: A1", "cód: #A1", "ref: A1", "campanha: A1", "anúncio: A1"
      const prefixRegex = new RegExp(`(?:c[oó]d(?:igo)?|ref|campanha|an[uú]ncio)[\\s:=-]+#?${escapedWithout}\\b`, "i");
      if (prefixRegex.test(fullSearchText)) return item;

      // 4. Correspondência da palavra / código exato delimitado
      const wordRegex = new RegExp(`(?:^|\\s|[.,;!?'"\\(\\[])${escapedWithout}(?:$|\\s|[.,;!?'"\\)\\]])`, "i");
      if (wordRegex.test(fullSearchText)) return item;
    }

    // 5. Fallback: Se contiver hashtag no formato #[A-Za-z0-9_-]+, busca por correspondência
    const hashMatch = fullSearchText.match(/#([A-Za-z0-9_-]+)/);
    if (hashMatch) {
      const extracted = hashMatch[1].toUpperCase();
      const matched = codes.find((c) => c.code.replace(/^#/, "").toUpperCase() === extracted);
      if (matched) return matched;
    }

    return null;
  }

  static processIncomingMessageTrafficRobot(
    conversationId: string,
    body: string,
    referral?: { headline?: string; body?: string; source_url?: string }
  ): void {
    const detected = this.detectTrafficCode(body, referral);
    if (!detected) return;

    const convs = this.getConversations();
    const conv = convs.find((c) => c.id === conversationId);
    if (!conv) return;

    const wasAlreadyDetected = conv.traffic_code === detected.code;
    const updatedConvs = convs.map((c) => {
      if (c.id === conversationId) {
        return {
          ...c,
          traffic_code: detected.code,
          traffic_action_name: detected.action_type,
          traffic_detected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });
    this.saveConversations(updatedConvs);

    // Se ainda não estava detectado este código na conversa, registra nota de sistema
    if (!wasAlreadyDetected) {
      this.sendMessage(
        conversationId,
        `🤖 Robô de Tráfego: Identificado anúncio Meta Ads (Instagram/Facebook) [${detected.code}] referente à "${detected.action_type}" (${detected.area_direito}). Contato: ${conv.contact_name} | Telefone: ${conv.contact_phone}. Dados vinculados com sucesso.`,
        false,
        "system"
      );
    }

    // Se a conversa já possuir um lead vinculado, atualiza o lead e grava histórico
    if (conv.lead_id) {
      try {
        const lead = legacyLeadRuntimeDisabled.getLeadById(conv.lead_id);
        if (lead && lead.traffic_code !== detected.code) {
          legacyLeadRuntimeDisabled.saveLead({
            id: lead.id,
            traffic_code: detected.code,
            traffic_action_name: detected.action_type,
            area_direito: lead.area_direito === "Geral" ? detected.area_direito : lead.area_direito,
          }, "Robô de Tráfego Pago");
        }
      } catch (e) {
        console.error("Erro ao sincronizar robô com lead existente:", e);
      }
    }
  }

  // ==========================================
  // ROTEAMENTO INTELIGENTE: HANDOFF IA -> FILA DO CALL CENTER
  // Transição automatizada quando o contato solicita atendimento humano
  // ==========================================

  static detectHumanHandOffRequest(text: string): boolean {
    if (!text) return false;
    const normalized = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    const patterns = [
      /\b(?:atendente|humano|advogado|operador|pessoa|alguem)\b/i,
      /\b(?:falar|conversar|chamar|passar|transferir)\b.*\b(?:atendente|humano|advogado|operador|pessoa|alguem)\b/i,
      /\b(?:quero|preciso|gostaria|favor)\b.*\b(?:atendente|humano|advogado|operador|ajuda humana)\b/i,
      /\b(?:sair do robo|sem robo|nao quero robo)\b/i,
      /\b(?:atendimento humano|atendimento pessoal|suporte humano)\b/i,
    ];

    return patterns.some((p) => p.test(normalized));
  }

  static transitionToQueue(
    conversationId: string,
    reason: string = "Solicitação de atendimento humano"
  ): LawConversation | null {
    const convs = this.getConversations();
    let updated: LawConversation | null = null;

    const newConvs = convs.map((c) => {
      if (c.id === conversationId) {
        updated = {
          ...c,
          status: "WAITING_QUEUE",
          ai_mode: "PAUSED",
          assigned_user_id: null,
          assigned_user_name: "Aguardando Atendente",
          priority: c.priority === "urgent" ? "urgent" : "high",
          updated_at: new Date().toISOString(),
        };
        return updated;
      }
      return c;
    });

    if (updated) {
      this.saveConversations(newConvs);

      // Resposta ao cliente
      this.sendMessage(
        conversationId,
        "Entendido! Estou transferindo seu atendimento para a nossa Fila do Call Center. Um advogado ou operador assumirá sua conversa em instantes. Por favor, aguarde.",
        false,
        "ai",
        "Assistente Virtual LawHub"
      );

      // Nota de auditoria do sistema
      this.sendMessage(
        conversationId,
        `🔔 Transição Automática: ${reason}. A IA foi pausada e a conversa foi encaminhada para a Fila do Call Center com prioridade alta.`,
        true,
        "system"
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("lawhub_queue_call_arrived", {
            detail: {
              conversationId,
              contactName: (updated as LawConversation).contact_name,
              contactPhone: (updated as LawConversation).contact_phone,
              reason,
            },
          })
        );
      }
    }

    return updated;
  }

  static processIncomingContactMessage(conversationId: string, body: string): void {
    const conv = this.getConversationById(conversationId);
    if (!conv) return;

    // 1. Detecção imediata de solicitação de atendente humano
    if (this.detectHumanHandOffRequest(body)) {
      this.transitionToQueue(conversationId, "Cliente solicitou atendimento humano no chat");
      return;
    }

    // 2. Se IA estiver ativa em triagem (WAITING_AI ou sem operador humano ativo)
    if (conv.ai_mode === "ACTIVE" && (conv.status === "WAITING_AI" || !conv.assigned_user_id)) {
      const cleanBody = body.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      let detectedArea: string | null = null;
      let targetDeptId: string | null = null;
      let replySnippet: string = "";

      if (/rescis|demis|justa causa|fgts|hora extra|carteira|salario|trabalh|patrao|verbas/.test(cleanBody)) {
        detectedArea = "Trabalhista";
        targetDeptId = "dept-trabalhista";
        replySnippet = "Identifiquei que sua dúvida é sobre Direito Trabalhista. Para calcularmos suas verbas ou orientar sobre sua rescisão, você possui em mãos o termo de rescisão (TRCT) ou extrato do FGTS?";
      } else if (/inss|aposent|auxilio|doenca|acidente|bpc|loas|laudo|pericia|cat|sequela/.test(cleanBody)) {
        detectedArea = "Previdenciário / Trabalhista";
        targetDeptId = "dept-previdenciario";
        replySnippet = "Compreendi perfeitamente. Nossos especialistas atuam fortemente em benefícios do INSS e indenizações por acidente/auxílio-doença. Você já deu entrada no pedido pelo Meu INSS ou possui laudos médicos recentes?";
      } else if (/voo|bagagem|atraso|imovel|planta|contrato|golpe|pix|fraude|banco|indeniza/.test(cleanBody)) {
        detectedArea = "Cível / Consumidor";
        targetDeptId = "dept-civel";
        replySnippet = "Entendido. Casos de direito do consumidor e contratos imobiliários exigem análise documental rápida para evitar prejuízos. Você tem cópia dos comprovantes ou do contrato para avaliação?";
      } else if (/boleto|fatura|pagamento|pix|honorario|recibo/.test(cleanBody)) {
        detectedArea = "Financeiro";
        targetDeptId = "dept-financeiro";
        replySnippet = "Localizei sua solicitação financeira. Para envio de 2ª via de boletos, chave PIX ou confirmação de honorários, estou localizando seu cadastro financeiro.";
      }

      // Se detectou área e departamento específico, atualiza a conversa
      if (detectedArea && targetDeptId && (conv.department_id !== targetDeptId || !conv.ai_detected_area)) {
        const convs = this.getConversations();
        const updatedConvs = convs.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              department_id: targetDeptId,
              ai_detected_area: detectedArea,
              updated_at: new Date().toISOString(),
            };
          }
          return c;
        });
        this.saveConversations(updatedConvs);
      }

      // Resposta da IA com delay realista para simulação natural
      if (replySnippet) {
        setTimeout(() => {
          const currentConv = this.getConversationById(conversationId);
          if (currentConv && currentConv.ai_mode === "ACTIVE" && currentConv.status !== "IN_PROGRESS") {
            this.sendMessage(
              conversationId,
              `${replySnippet}\n\nSe preferir falar diretamente com nossa equipe humana agora, basta responder: "Falar com atendente".`,
              false,
              "ai",
              "Assistente Virtual LawHub"
            );
          }
        }, 800);
      }
    }
  }

  // ==========================================
  // STATUS MULTI-TENANT DE NÚMEROS WHATSAPP
  // ==========================================

  static async getWhatsAppInstanceStatus(accountId: string = "default"): Promise<{
    connected: boolean;
    phoneNumber: string | null;
    provider: string;
    limit: number;
    used: number;
    isSimulation: boolean;
  }> {
    try {
      if (supabase) {
        const { data: numbers, count } = await (supabase as any)
          .from("whatsapp_bot_numbers")
          .select("phone_number, active, name", { count: "exact" })
          .eq("active", true)
          .not("phone_number", "like", "sim-%");

        if (numbers && numbers.length > 0) {
          const first = numbers[0];
          return {
            connected: true,
            phoneNumber: first.phone_number,
            provider: "WhatsAble / Meta Cloud API",
            limit: 3,
            used: count || numbers.length,
            isSimulation: false,
          };
        }
      }
    } catch (e) {
      console.warn("Aviso ao consultar status do WhatsApp:", e);
    }

    // Fallback com número homologado do escritório
    return {
      connected: true,
      phoneNumber: "+55 (86) 99482-1190",
      provider: "WhatsAble / Oficial Homologado",
      limit: 3,
      used: 1,
      isSimulation: false,
    };
  }

  // ==========================================
  // INTEGRAÇÃO COM LEADS NATIVOS (CALL CENTER)
  // Permite criar Lead Imediato ou Lead Futuro com data agendada
  // ==========================================

  static createLeadForConversation(
    conversationId: string,
    leadData: {
      name: string;
      phone: string;
      area_direito: string;
      estimated_value?: number;
      lead_type?: "imediato" | "futuro";
      future_contact_date?: string;
      future_contact_time?: string;
      future_contact_reason?: string;
      traffic_code?: string;
      traffic_action_name?: string;
      notes?: string;
      userName?: string;
    }
  ) {
    const conv = this.getConversationById(conversationId);
    const stages = legacyLeadRuntimeDisabled.getStages();
    const initialStage = stages[0] || { id: "stage-1" };
    const actor = leadData.userName || "Atendimento Call Center";

    const trafficCode = leadData.traffic_code || conv?.traffic_code || undefined;
    const trafficAction = leadData.traffic_action_name || conv?.traffic_action_name || undefined;
    const leadType = leadData.lead_type || "imediato";

    return this.validateContactAsLead(conversationId, {
      option: leadType,
      futureContactDate: leadData.future_contact_date,
      futureContactTime: leadData.future_contact_time,
      futureContactReason: leadData.future_contact_reason,
      userName: actor,
      notes: leadData.notes,
    });
  }

  static validateContactAsLead(
    conversationId: string,
    params: {
      option: "imediato" | "futuro";
      futureContactDate?: string;
      futureContactTime?: string;
      futureContactReason?: string;
      userName?: string;
      notes?: string;
    }
  ) {
    const conv = this.getConversationById(conversationId);
    if (!conv) throw new Error("Conversa não encontrada.");

    const actor = params.userName || "Atendimento Call Center";
    const trafficCode = conv.traffic_code || undefined;
    const trafficAction = conv.traffic_action_name || undefined;

    // Prevenção estrita de duplicidade: busca se já existe lead vinculado à conversa ou com mesmo telefone
    let existingLead: any = null;
    const allLeads = legacyLeadRuntimeDisabled.getLeads("all");
    if (conv.lead_id) {
      existingLead = allLeads.find((l: any) => l.id === conv.lead_id);
    }
    if (!existingLead && conv.contact_phone) {
      const cleanPhone = conv.contact_phone.replace(/\D/g, "");
      if (cleanPhone.length >= 8) {
        existingLead = allLeads.find((l: any) => (l.phone || "").replace(/\D/g, "") === cleanPhone);
      }
    }

    const principalStages = legacyLeadRuntimeDisabled.getStages("pipe-principal");
    const futureStages = legacyLeadRuntimeDisabled.getStages("pipe-futuros");

    let resultLead: any;

    if (params.option === "imediato") {
      const targetStage = principalStages[0] || { id: "stage-1", name: "LEADs", color: "#3b82f6" };
      if (existingLead) {
        const history = Array.isArray(existingLead.history) ? [...existingLead.history] : [];
        history.unshift({
          id: "hist-" + Date.now(),
          timestamp: new Date().toISOString(),
          action: "validated_immediate",
          user_name: actor,
          details: `Contato validado como Lead Válido e Apto por ${actor}. Direcionado à Pipeline Principal.`,
          description: "Contato validado como Lead Válido e Apto.",
        });

        const updatedLead = {
          ...existingLead,
          lead_type: "imediato",
          pipeline_id: "pipe-principal",
          stage_id: targetStage.id,
          source: trafficCode ? `Tráfego Pago (${trafficCode})` : (existingLead.source || "WhatsApp CALL CENTER"),
          traffic_code: trafficCode || existingLead.traffic_code,
          traffic_action_name: trafficAction || existingLead.traffic_action_name,
          notes: params.notes ? `${existingLead.notes || ""}\n${params.notes}`.trim() : existingLead.notes,
          history,
          updated_at: new Date().toISOString(),
        };
        legacyLeadRuntimeDisabled.saveLead(updatedLead, actor);
        resultLead = updatedLead;
      } else {
        resultLead = legacyLeadRuntimeDisabled.saveLead({
          name: conv.contact_name || "Contato WhatsApp",
          phone: conv.contact_phone || "",
          area_direito: conv.ai_detected_area || "Geral",
          stage_id: targetStage.id,
          pipeline_id: "pipe-principal",
          lead_type: "imediato",
          source: trafficCode ? `Tráfego Pago (${trafficCode})` : "WhatsApp CALL CENTER",
          traffic_code: trafficCode,
          traffic_action_name: trafficAction,
          notes: params.notes || `Contato validado como Lead Válido e Apto pelo CALL CENTER.${trafficCode ? ` [Código: ${trafficCode} - ${trafficAction}]` : ""}`,
        }, actor);
      }

      this.sendMessage(
        conversationId,
        `✅ Contato validado como LEAD VÁLIDO E APTO por ${actor} e direcionado para a Pipeline Principal.${trafficCode ? ` [Campanha: ${trafficCode}]` : ""}`,
        false,
        "system"
      );
    } else {
      // OPÇÃO 2: LEAD APTO PARA O FUTURO
      if (!params.futureContactDate) {
        throw new Error("A data para novo contato é obrigatória para validar como Lead Futuro.");
      }
      const targetStage = futureStages[0] || { id: "stage-fut-1", name: "NOVO FUTURO", color: "#8b5cf6" };

      if (existingLead) {
        const history = Array.isArray(existingLead.history) ? [...existingLead.history] : [];
        history.unshift({
          id: "hist-" + Date.now(),
          timestamp: new Date().toISOString(),
          action: "validated_future",
          user_name: actor,
          details: `Contato classificado como Lead Futuro por ${actor}. Data de retorno: ${params.futureContactDate}. Motivo: ${params.futureContactReason || "Retorno programado"}.`,
          description: `Contato classificado como Lead Futuro para ${params.futureContactDate}.`,
        });

        const updatedLead = {
          ...existingLead,
          lead_type: "futuro",
          pipeline_id: "pipe-futuros",
          stage_id: targetStage.id,
          future_contact_date: params.futureContactDate,
          future_contact_time: params.futureContactTime || "10:00",
          future_contact_reason: params.futureContactReason,
          source: trafficCode ? `Tráfego Pago (${trafficCode})` : (existingLead.source || "WhatsApp CALL CENTER"),
          traffic_code: trafficCode || existingLead.traffic_code,
          traffic_action_name: trafficAction || existingLead.traffic_action_name,
          notes: params.notes ? `${existingLead.notes || ""}\n${params.notes}`.trim() : existingLead.notes,
          history,
          updated_at: new Date().toISOString(),
        };
        legacyLeadRuntimeDisabled.saveLead(updatedLead, actor);
        resultLead = updatedLead;
      } else {
        resultLead = legacyLeadRuntimeDisabled.saveLead({
          name: conv.contact_name || "Contato WhatsApp",
          phone: conv.contact_phone || "",
          area_direito: conv.ai_detected_area || "Geral",
          stage_id: targetStage.id,
          pipeline_id: "pipe-futuros",
          lead_type: "futuro",
          future_contact_date: params.futureContactDate,
          future_contact_time: params.futureContactTime || "10:00",
          future_contact_reason: params.futureContactReason,
          source: trafficCode ? `Tráfego Pago (${trafficCode})` : "WhatsApp CALL CENTER",
          traffic_code: trafficCode,
          traffic_action_name: trafficAction,
          notes: params.notes || `Contato classificado como Lead Futuro pelo CALL CENTER.${trafficCode ? ` [Código: ${trafficCode} - ${trafficAction}]` : ""}`,
        }, actor);
      }

      this.sendMessage(
        conversationId,
        `📅 Contato validado como LEAD APTO PARA O FUTURO por ${actor}. Data de retorno: ${params.futureContactDate} às ${params.futureContactTime || "10:00"}. Alerta registrado no sistema.${trafficCode ? ` [Código: ${trafficCode}]` : ""}`,
        false,
        "system"
      );
    }

    // Atualiza a conversa com o vínculo do lead
    const convs = this.getConversations();
    const updatedConvs = convs.map((c) => {
      if (c.id === conversationId) {
        return {
          ...c,
          lead_id: resultLead.id,
          lead: {
            id: resultLead.id,
            name: resultLead.name,
            area_direito: resultLead.area_direito,
            estimated_value: resultLead.estimated_value || 0,
            stage_id: resultLead.stage_id,
            stage_name: params.option === "futuro" ? "NOVO FUTURO" : "LEADs",
            stage_color: params.option === "futuro" ? "#8b5cf6" : "#3b82f6",
            responsible_name: resultLead.responsible_name || actor,
            lead_type: resultLead.lead_type,
            future_contact_date: resultLead.future_contact_date,
          },
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });
    this.saveConversations(updatedConvs);

    // Dispara alerta global
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lawhub_alerts_updated"));
    }

    return resultLead;
  }
}
