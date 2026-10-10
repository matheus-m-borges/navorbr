// Tipos estritos do Módulo LawHub Atendimento (Central Inteligente & WhatsApp Oficial)

export type ConversationStatus =
  | 'WAITING_AI'        // Em triagem automatizada com a IA
  | 'WAITING_QUEUE'     // Triado pela IA aguardando atendente na fila
  | 'ASSIGNED'          // Atribuído a um atendente
  | 'IN_PROGRESS'       // Atendimento humano ativo
  | 'WAITING_CLIENT'    // Aguardando resposta do cliente
  | 'WAITING_INTERNAL'  // Aguardando documento/análise interna
  | 'TRANSFERRED'       // Transferido recentemente
  | 'RESOLVED'          // Concluído com sucesso
  | 'CLOSED';           // Encerrado definitivamente

export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type AIMode = 'ACTIVE' | 'PAUSED' | 'DISABLED';

export type SenderType = 'contact' | 'agent' | 'ai' | 'system';

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template';

export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type AgentPresenceStatus = 'online' | 'busy' | 'away' | 'offline';

export type AgentRoleInDepartment = 'agent' | 'coordinator';

export type WhatsAppAccountStatus = 'connected' | 'disconnected' | 'pending' | 'error';

export type DistributionMode = 'manual' | 'round_robin' | 'least_busy';

export interface LawAtendimentoSettings {
  id: string;
  account_id: string;
  bot_name: string;
  welcome_message: string;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  out_of_hours_message: string;
  ai_enabled: boolean;
  ai_auto_create_leads: boolean;
  ai_default_stage_id: string | null;
  ai_system_prompt: string | null;
  distribution_mode: DistributionMode;
  max_active_chats_per_agent: number;
  created_at: string;
  updated_at: string;
}

export interface LawWhatsAppAccount {
  id: string;
  account_id: string;
  phone_number: string;
  display_phone_number: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  status: WhatsAppAccountStatus;
  quality_rating: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LawDepartment {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  // Campos computados em listagens
  active_conversations_count?: number;
  waiting_queue_count?: number;
  agents_online_count?: number;
}

export interface LawQueue {
  id: string;
  account_id: string;
  department_id: string;
  name: string;
  sla_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface LawAgent {
  id: string;
  account_id: string;
  user_id: string;
  department_id: string;
  role_in_department: AgentRoleInDepartment;
  presence_status: AgentPresenceStatus;
  can_transfer_any_department: boolean;
  can_view_all_department_chats: boolean;
  max_simultaneous_chats: number;
  last_seen_at: string | null;
  created_at: string;
  // Joins
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
  department_name?: string;
  active_chats_count?: number;
}

export interface LawConversation {
  id: string;
  account_id: string;
  whatsapp_account_id: string | null;
  contact_phone: string;
  contact_name: string;
  contact_avatar_url: string | null;
  
  // Vínculos Nativos LawHub
  lead_id: string | null;
  client_id: string | null;
  
  // Roteamento
  department_id: string | null;
  queue_id: string | null;
  assigned_user_id: string | null;
  
  // Estado
  status: ConversationStatus;
  ai_mode: AIMode;
  priority: ConversationPriority;
  
  // Contexto da IA
  ai_summary: string | null;
  ai_detected_area: string | null;
  ai_detected_urgency: string | null;
  
  // Timeline e Mensagens
  first_message_at: string;
  last_message_at: string;
  last_message_snippet: string | null;
  last_message_sender: SenderType;
  unread_count: number;
  closed_at: string | null;
  closed_by: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Detecção Automática de Tráfego Pago / Anúncios
  traffic_code?: string | null;
  traffic_action_name?: string | null;
  traffic_detected_at?: string | null;

  // Relações carregadas opcionalmente
  department?: LawDepartment | null;
  queue?: LawQueue | null;
  assigned_user_name?: string | null;
  lead?: {
    id: string;
    name: string;
    area_direito: string;
    estimated_value?: number;
    stage_id: string;
    stage_name?: string;
    stage_color?: string;
    responsible_name?: string;
    lead_type?: 'imediato' | 'futuro';
    future_contact_date?: string;
  } | null;
  client?: {
    id: string;
    name: string;
    document: string;
    client_type: string;
  } | null;
}

export interface LawTrafficCampaignCode {
  id: string;
  code: string; // Ex: "TRF-01"
  action_type: string; // Ex: "Revisional de FGTS / Horas Extras"
  area_direito: string; // Ex: "Trabalhista"
  description?: string; // Ex: "Campanha Meta Ads Instagram"
  active: boolean;
  created_at: string;
}

export interface LawMessageAdReferral {
  source_type?: 'ad' | 'post';
  ad_title?: string;
  headline?: string;
  body?: string;
  source_url?: string;
  thumbnail_url?: string;
  is_automated_greeting?: boolean;
}

export interface LawMessage {
  id: string;
  conversation_id: string;
  account_id: string;
  sender_type: SenderType;
  sender_user_id: string | null;
  sender_name: string | null;
  
  message_type: MessageType;
  body: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_size_bytes: number | null;
  
  external_message_id: string | null;
  status: MessageDeliveryStatus;
  error_details: string | null;
  
  is_internal_note: boolean;
  ad_referral?: LawMessageAdReferral | null;
  created_at: string;
}

export interface LawTransfer {
  id: string;
  conversation_id: string;
  account_id: string;
  transferred_by_user_id: string;
  transferred_by_name?: string;
  from_department_id: string | null;
  from_department_name?: string;
  to_department_id: string;
  to_department_name?: string;
  from_user_id: string | null;
  from_user_name?: string;
  to_user_id: string | null;
  to_user_name?: string;
  reason: string;
  internal_note: string | null;
  created_at: string;
}

export interface LawQuickMessage {
  id: string;
  account_id: string;
  shortcut: string;
  title: string;
  content: string;
  department_id: string | null;
  is_global: boolean;
  created_at: string;
}

export interface LawAuditLog {
  id: string;
  account_id: string;
  conversation_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, any>;
  created_at: string;
}

export interface AtendimentoMetrics {
  totalToday: number;
  inProgress: number;
  waitingQueue: number;
  waitingAI: number;
  resolvedToday: number;
  myActiveChats: number;
}
