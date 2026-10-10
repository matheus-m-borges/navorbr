/**
 * NAVOR LawHub — Módulo de Leads, Intake e Propostas Jurídicas
 * Tipagens estritas para funil, matriz de honorários, campos dinâmicos e timeline
 */

export type FeeType =
  | 'fixo'
  | 'exito'
  | 'misto'
  | 'partido_mensal'
  | 'hora'
  | 'ato'
  | 'consulta';

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export type SuccumbencyRule = 'escritorio_100' | 'compartilhada' | 'cliente';

export type ConflictCheckStatus = 'pending' | 'cleared' | 'conflict_detected';

export type EstimatedSuccessRate = 'alta' | 'media' | 'baixa';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'select'
  | 'boolean';

export type LeadTimelineEventType =
  | 'stage_change'
  | 'note'
  | 'proposal'
  | 'whatsapp'
  | 'conflict_check'
  | 'created'
  | 'converted';

export type LawPipelineId = 'pipe-principal' | 'pipe-futuros';

export interface LawLeadPipelineStage {
  id: string;
  account_id?: string;
  pipeline_id?: LawPipelineId;
  name: string;
  color: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  is_conflict: boolean;
  sla_hours: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_PRINCIPAL_STAGES: LawLeadPipelineStage[] = [
  { id: "stage-1", name: "LEADs", color: "#3b82f6", position: 0, is_won: false, is_lost: false, is_conflict: false, sla_hours: 24, pipeline_id: "pipe-principal" },
  { id: "stage-2", name: "Análise Documental", color: "#8b5cf6", position: 1, is_won: false, is_lost: false, is_conflict: false, sla_hours: 48, pipeline_id: "pipe-principal" },
  { id: "stage-3", name: "Proposta Apresentada", color: "#eab308", position: 2, is_won: false, is_lost: false, is_conflict: false, sla_hours: 72, pipeline_id: "pipe-principal" },
  { id: "stage-4", name: "Em Negociação", color: "#f97316", position: 3, is_won: false, is_lost: false, is_conflict: false, sla_hours: 48, pipeline_id: "pipe-principal" },
  { id: "stage-5", name: "Convertido / Ganho", color: "#10b981", position: 4, is_won: true, is_lost: false, is_conflict: false, sla_hours: 0, pipeline_id: "pipe-principal" },
  { id: "stage-6", name: "Inviável / Perdido", color: "#ef4444", position: 5, is_won: false, is_lost: true, is_conflict: false, sla_hours: 0, pipeline_id: "pipe-principal" },
];

export const DEFAULT_FUTURE_STAGES: LawLeadPipelineStage[] = [
  { id: "stage-fut-1", name: "NOVO FUTURO", color: "#8b5cf6", position: 0, is_won: false, is_lost: false, is_conflict: false, sla_hours: 48, pipeline_id: "pipe-futuros" },
  { id: "stage-fut-2", name: "AGUARDANDO DATA", color: "#6366f1", position: 1, is_won: false, is_lost: false, is_conflict: false, sla_hours: 0, pipeline_id: "pipe-futuros" },
  { id: "stage-fut-3", name: "RETORNO HOJE", color: "#f59e0b", position: 2, is_won: false, is_lost: false, is_conflict: false, sla_hours: 8, pipeline_id: "pipe-futuros" },
  { id: "stage-fut-4", name: "CONTATADO", color: "#3b82f6", position: 3, is_won: false, is_lost: false, is_conflict: false, sla_hours: 24, pipeline_id: "pipe-futuros" },
  { id: "stage-fut-5", name: "REQUALIFICADO", color: "#10b981", position: 4, is_won: false, is_lost: false, is_conflict: false, sla_hours: 24, pipeline_id: "pipe-futuros" },
  { id: "stage-fut-6", name: "CONVERTIDO", color: "#059669", position: 5, is_won: true, is_lost: false, is_conflict: false, sla_hours: 0, pipeline_id: "pipe-futuros" },
  { id: "stage-fut-7", name: "DESCARTADO", color: "#ef4444", position: 6, is_won: false, is_lost: true, is_conflict: false, sla_hours: 0, pipeline_id: "pipe-futuros" },
];

export interface LawLeadCustomField {
  id: string;
  account_id?: string;
  label: string;
  field_key: string;
  field_type: CustomFieldType;
  options?: string[];
  area?: string; // Opcional: Trabalhista, Tributário, etc.
  is_required: boolean;
  position: number;
  created_at?: string;
}

export interface LawLeadProposal {
  id: string;
  lead_id: string;
  account_id?: string;
  fee_type: FeeType;
  fixed_amount?: number;
  success_percentage?: number;
  hourly_rate?: number;
  monthly_amount?: number;
  per_act_amount?: number;
  consultation_amount?: number;
  installments?: number;
  installment_value?: number;
  payment_method?: string;
  payment_conditions?: string;
  succumbency_rule?: SuccumbencyRule;
  status: ProposalStatus;
  pdf_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LawLeadTimelineEntry {
  id: string;
  lead_id: string;
  account_id?: string;
  user_id?: string;
  user_name?: string;
  event_type: LeadTimelineEventType;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface LawLeadHistoryItem {
  id: string;
  timestamp: string;
  user_id?: string;
  user_name: string;
  action:
    | 'created'
    | 'stage_changed'
    | 'converted_future'
    | 'promoted_immediate'
    | 'validated_immediate'
    | 'validated_future'
    | 'converted_to_active'
    | 'scheduled_future'
    | 'edited'
    | 'note_added';
  from_stage_name?: string;
  to_stage_name?: string;
  description?: string;
  details?: string;
}

export interface LawLead {
  id: string;
  account_id?: string;
  pipeline_id?: LawPipelineId;
  stage_id: string;
  responsible_user_id?: string;
  responsible_name?: string;
  name: string;
  document_number?: string;
  email?: string;
  phone?: string;
  area_direito: string;
  opposing_party?: string;
  opposing_party_doc?: string;
  conflict_check_status: ConflictCheckStatus;
  conflict_notes?: string;
  source: string;
  estimated_value?: number;
  estimated_success_rate: EstimatedSuccessRate;
  prescription_date?: string;
  custom_fields: Record<string, any>;
  notes?: string;
  proposals?: LawLeadProposal[];
  timeline?: LawLeadTimelineEntry[];
  stage?: LawLeadPipelineStage;
  // Gestão de Leads Imediatos vs Futuros
  lead_type?: 'imediato' | 'futuro';
  future_contact_date?: string; // YYYY-MM-DD
  future_contact_time?: string; // HH:mm
  future_contact_reason?: string;
  // Reconhecimento de Tráfego Pago
  traffic_code?: string; // Ex: TRF-01
  traffic_action_name?: string; // Ex: Revisional de FGTS
  // Histórico de Movimentações com Usuário
  history?: LawLeadHistoryItem[];
  converted_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Templates pré-configurados de funil por especialidade jurídica
 */
export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  stages: Array<{
    name: string;
    color: string;
    sla_hours: number;
    is_won?: boolean;
    is_lost?: boolean;
    is_conflict?: boolean;
  }>;
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: "padrao_geral",
    name: "Geral / Advocacia Abrangente",
    description: "Estrutura equilibrada para escritórios full-service e demandas cíveis gerais.",
    stages: [
      { name: "Triagem Inicial", color: "#3b82f6", sla_hours: 24 },
      { name: "Análise Documental", color: "#8b5cf6", sla_hours: 48 },
      { name: "Proposta Apresentada", color: "#eab308", sla_hours: 72 },
      { name: "Em Negociação", color: "#f97316", sla_hours: 48 },
      { name: "Convertido / Ganho", color: "#10b981", sla_hours: 0, is_won: true },
      { name: "Inviável / Perdido", color: "#ef4444", sla_hours: 0, is_lost: true },
    ],
  },
  {
    id: "trabalhista",
    name: "Trabalhista (Reclamante & Reclamada)",
    description: "Foco em análise de rescisão, verbas incontroversas e cálculo inicial de liquidação.",
    stages: [
      { name: "Primeiro Contato", color: "#3b82f6", sla_hours: 12 },
      { name: "Análise de TRCT e Carteira", color: "#6366f1", sla_hours: 36 },
      { name: "Cálculo Trabalhista Prévia", color: "#8b5cf6", sla_hours: 48 },
      { name: "Proposta de Honorários (Quota Litis)", color: "#eab308", sla_hours: 48 },
      { name: "Aguardando Assinatura Procuração", color: "#f97316", sla_hours: 72 },
      { name: "Ação Ajuizada / Contratado", color: "#10b981", sla_hours: 0, is_won: true },
      { name: "Prescrito / Sem Viabilidade", color: "#ef4444", sla_hours: 0, is_lost: true },
    ],
  },
  {
    id: "tributario",
    name: "Tributário & Empresarial",
    description: "Foco em diagnóstico de passivo/ativo fiscal, tese jurídica e parecer inicial.",
    stages: [
      { name: "Qualificação da Empresa", color: "#3b82f6", sla_hours: 24 },
      { name: "Diagnóstico Fiscal & Sped", color: "#06b6d4", sla_hours: 96 },
      { name: "Definição de Tese & Parecer", color: "#8b5cf6", sla_hours: 72 },
      { name: "Apresentação da Proposta (Misto)", color: "#eab308", sla_hours: 48 },
      { name: "Comitê Jurídico da Empresa", color: "#f97316", sla_hours: 120 },
      { name: "Contrato Assinado", color: "#10b981", sla_hours: 0, is_won: true },
      { name: "Inviabilidade Tributária", color: "#ef4444", sla_hours: 0, is_lost: true },
    ],
  },
  {
    id: "consumidor_civel",
    name: "Cível & Consumidor em Massa",
    description: "Funil ágil para negativação indevida, voos atrasados, bancário e cobranças.",
    stages: [
      { name: "Intake / Triagem Rápida", color: "#3b82f6", sla_hours: 8 },
      { name: "Coleta de Provas (Extratos/Prints)", color: "#6366f1", sla_hours: 24 },
      { name: "Notificação / Acordo Pré-Processual", color: "#eab308", sla_hours: 48 },
      { name: "Contrato & Procuração Enviados", color: "#f97316", sla_hours: 24 },
      { name: "Ação Distribuída", color: "#10b981", sla_hours: 0, is_won: true },
      { name: "Desistência / Inviável", color: "#ef4444", sla_hours: 0, is_lost: true },
    ],
  },
];
