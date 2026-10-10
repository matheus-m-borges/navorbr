export type ClientType = 'PF' | 'PJ';
export type ClientStatus = 'active' | 'inactive' | 'prospect';

export interface LawClient {
  id: string;
  account_id?: string | undefined;
  client_type: ClientType;
  name: string; // Nome Completo ou Razão Social
  trade_name?: string | undefined; // Nome Fantasia (PJ)
  document: string; // CPF ou CNPJ
  rg?: string | undefined; // RG (PF)
  state_registration?: string | undefined; // Inscrição Estadual (PJ)
  birth_date?: string | undefined;
  marital_status?: string | undefined;
  profession?: string | undefined;
  representative_name?: string | undefined; // Responsável legal (PJ)
  email?: string | undefined;
  phone?: string | undefined;
  mobile?: string | undefined;
  zip_code?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  notes?: string | undefined;
  status: ClientStatus;
  created_at: string;
  updated_at?: string | undefined;
}

export type LawyerRole = 'socio' | 'advogado_senior' | 'advogado' | 'estagiario' | 'paralegal' | 'secretario';

export interface LawLawyer {
  id: string;
  account_id?: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  oab_number?: string;
  oab_state?: string;
  role: LawyerRole;
  specialties?: string[];
  status: 'active' | 'inactive';
  created_at: string;
}

export type ProcessStatus = 'novo' | 'ativo' | 'em_andamento' | 'aguardando' | 'suspenso' | 'encerrado' | 'arquivado';
export type PartyPosition = 'ativo' | 'passivo' | 'terceiro';
export type ProcessInstance = '1grau' | '2grau' | 'superior' | 'tribunal_superior';

export type LawRecordType = 'processo' | 'caso';

export type LawCaseType = 
  | 'consultoria'
  | 'contrato'
  | 'cartorio'
  | 'parecer'
  | 'notificacao'
  | 'orgao_publico'
  | 'mediacao'
  | 'outro';

export type LawCaseStage =
  | 'briefing'
  | 'analise'
  | 'minuta'
  | 'negociacao'
  | 'aguardando_cliente'
  | 'concluido';

export interface ProcessMovementEntry {
  id?: string;
  date: string;
  text: string;
  type?: string;
  instance?: string;
  is_important?: boolean;
  importance_category?: string;
  importance_reason?: string;
  category?: string;
  category_label?: string;
  reason?: string;
  urgency?: string;
  suggested_action?: string;
  user_starred?: boolean;
  confidence?: number;
  [key: string]: unknown;
}

export type LawResourceType =
  | 'apelacao'
  | 'agravo_instrumento'
  | 'embargos_declaracao'
  | 'recurso_especial'
  | 'recurso_extraordinario'
  | 'recurso_ordinario'
  | 'cumprimento_sentenca'
  | 'incidente'
  | 'apenso'
  | 'outro';

export type LawResourceCategory = 'recurso' | 'desdobramento' | 'apenso';

export type LawResourceStatus = 'ativo' | 'julgado' | 'provido' | 'nao_provido' | 'encerrado' | 'suspenso';

export interface LawProcessResource {
  id: string;
  parent_process_id: string;
  title: string;
  resource_type: LawResourceType;
  category: LawResourceCategory;
  number?: string;
  court?: string;
  chamber_or_section?: string;
  rapporteur?: string;
  interposition_date?: string;
  judgment_date?: string;
  status: LawResourceStatus;
  value?: number;
  notes?: string;
  attachments_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface LawProcess {
  id: string;
  account_id?: string;
  record_type?: LawRecordType; // 'processo' (judicial) ou 'caso' (extrajudicial)
  case_type?: LawCaseType; // tipo da demanda consultiva/extrajudicial
  case_stage?: LawCaseStage; // fase de evolução da demanda
  client_id?: string;
  client_name?: string | undefined;
  cnj_number?: string | undefined; // Formato 0000000-00.0000.0.00.0000 (obrigatório em processos, opcional/gerado em casos)
  title?: string | undefined;
  active_pole?: string | undefined; // Autor / Requerente
  passive_pole?: string | undefined; // Réu / Contraparte
  party_position?: PartyPosition | undefined;
  court?: string | undefined; // Ex: TJSP, TRF3, TRT2, ou "Extrajudicial"
  instance?: ProcessInstance | undefined;
  judicial_branch?: string | undefined; // Ex: 2ª Vara Cível
  judicial_district?: string | undefined; // Comarca
  procedural_class?: string | undefined; // Procedimento Comum Cível, etc.
  subject?: string | undefined;
  legal_area?: string; // Cível, Trabalhista, Tributário, etc.
  case_value?: number | undefined;
  condemnation_value?: number | undefined;
  estimated_risk_value?: number | undefined; // Valor em risco / estimado
  agreed_fee_value?: number | undefined; // Honorários contratados / estimados
  distribution_date?: string | undefined;
  responsible_id?: string | undefined;
  responsible_name?: string | undefined;
  created_by?: string | undefined;
  client_role?: string | undefined;
  co_counsel?: string | undefined;
  opposing_lawyer?: string | undefined;
  lawyer_id?: string | undefined;
  status: ProcessStatus;
  is_secret?: boolean;
  notes?: string | undefined;
  last_movement?: string | undefined;
  next_deadline?: string | undefined;
  movements?: ProcessMovementEntry[];
  monitoring_type?: "automatico" | "manual";
  court_linked?: boolean;
  court_sync_system?: string;
  radar_provider?: "datajud" | "escavador" | "none";
  radar_cost_label?: string;
  folder_name?: string | undefined; // Nome da pasta / identificador interno
  folder_number?: string | undefined; // Código físico da pasta (ex: Pasta 104-B)
  is_administrative?: boolean;
  tags?: string[];
  resources?: LawProcessResource[]; // Recursos e Desdobramentos vinculados
  attachments?: Array<{
    id: string;
    name: string;
    date?: string;
    url?: string;
    extension?: string;
    size?: string;
  }>;
  created_at: string;
  updated_at?: string | undefined;
}

export interface ProcessSearchResultItem {
  id: string;
  cnj: string;
  court: string;
  title: string;
  searchedAt: string;
  status: "pronto_para_adicionar" | "sincronizado" | "em_andamento" | "falha";
  type: "individual_cnj" | "individual_tribunal" | "lote_oab";
  batchId?: string;
  batchName?: string;
  errorMessage?: string;
  partiesSummary?: string;
  vara?: string;
  comarca?: string;
  classe?: string;
  autor?: string;
  reu?: string;
  instance?: "1grau" | "2grau" | "superior";
  lastMovement?: string;
  caseValue?: number;
}

export interface ProcessSearchBatch {
  id: string;
  name: string;
  oab?: string;
  courtScope?: string;
  date: string;
  totalFound: number;
  readyCount: number;
  errorCount: number;
  syncedCount: number;
  status: "concluida" | "em_andamento" | "parcial";
}

export interface LawProcessMovement {
  id: string;
  process_id: string;
  movement_date: string;
  title: string;
  description?: string;
  source: 'manual' | 'dje' | 'cnj_api' | 'tribunal';
  created_at: string;
  is_important?: boolean;
  importance_category?: string;
  importance_reason?: string;
  importance_source?: 'ai' | 'manual';
  urgency_level?: 'alta' | 'media' | 'baixa';
  suggested_action?: string;
  user_starred?: boolean;
}

export type DeadlinePriority = 'urgente' | 'proximo' | 'atencao' | 'normal';
export type DeadlineStatus = 'pendente' | 'cumprido' | 'cancelado';

export interface LawDeadline {
  id: string;
  process_id?: string;
  process_cnj?: string;
  client_id?: string;
  client_name?: string | undefined;
  responsible_id?: string;
  responsible_name?: string;
  title: string;
  description?: string;
  deadline_date: string;
  deadline_time?: string;
  fatal_date?: string;
  priority: DeadlinePriority;
  status: DeadlineStatus;
  completed_at?: string;
  origin_publication_id?: string;
  created_at: string;
  legal_rule?: string;
  days_count?: number;
  initial_type?: "disponibilizacao" | "publicacao" | "intimacao_direta";
  initial_date?: string;
  completion_protocol?: string;
  completion_notes?: string;
}

export type HearingType = 'conciliacao' | 'instrucao' | 'julgamento' | 'pericial' | 'una';
export type HearingStatus = 'agendada' | 'realizada' | 'cancelada' | 'redesignada';

export interface LawHearing {
  id: string;
  process_id?: string;
  process_cnj?: string;
  client_id?: string;
  client_name?: string | undefined;
  responsible_id?: string;
  responsible_name?: string;
  title: string;
  hearing_type: HearingType;
  hearing_date: string;
  hearing_time: string;
  location?: string;
  link_url?: string;
  status: HearingStatus;
  notes?: string;
  created_at: string;
}

export type AttendanceChannel = 'presencial' | 'whatsapp' | 'telefone' | 'videochamada' | 'email';

export interface LawAttendance {
  id: string;
  client_id: string;
  client_name?: string;
  process_id?: string;
  process_cnj?: string;
  responsible_id?: string;
  responsible_name?: string;
  subject: string;
  channel: AttendanceChannel;
  attendance_date: string;
  summary: string;
  next_action?: string;
  created_at: string;
}

export type TaskPriority = 'urgente' | 'alta' | 'media' | 'baixa';
export type TaskStatus = 'pendente' | 'em_andamento' | 'concluida';

export interface LawTaskChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface LawTaskComment {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface LawTaskList {
  id: string;
  name: string;
  color: string;
  is_default?: boolean;
  is_active: boolean;
}

export interface LawWorkflowStep {
  id: string;
  title: string;
  type: string;
  days_from_start: number;
  priority: TaskPriority;
  default_checklist: string[];
  description?: string;
}

export interface LawWorkflowTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  target_type: "processo" | "caso";
  steps: LawWorkflowStep[];
  estimated_days: number;
}

export interface LawTask {
  id: string;
  process_id?: string;
  process_cnj?: string;
  client_id?: string;
  client_name?: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  delegated_by?: string;
  list_id?: string;
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority: TaskPriority;
  status: TaskStatus;
  checklist?: LawTaskChecklistItem[];
  comments?: LawTaskComment[];
  tags?: string[];
  is_recurring?: boolean;
  recurrence_rule?: 'diaria' | 'semanal' | 'mensal' | 'nenhuma';
  completed_at?: string;
  created_at: string;
}

// Tipos da Agenda Jurídica Navor LawHub
export type LawAgendaActivityType = 'tarefa' | 'evento' | 'prazo' | 'audiencia';
export type LawAgendaActivityStatus = 'a_concluir' | 'concluida' | 'cancelada';

export interface LawAgendaActivityComment {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface LawAgendaActivityAttachment {
  id: string;
  name: string;
  size?: string;
  url?: string;
  date: string;
}

export interface LawAgendaActivity {
  id: string;
  type: LawAgendaActivityType;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (opcional para tarefas sem horário)
  end_time?: string;
  status: LawAgendaActivityStatus;
  responsible_name: string;
  involved_names?: string[];
  delegated_by?: string;
  process_cnj?: string;
  process_title?: string;
  client_name?: string;
  location?: string;
  is_virtual?: boolean;
  tags?: string[];
  comments?: LawAgendaActivityComment[];
  attachments?: LawAgendaActivityAttachment[];
  created_at: string;
}

export interface LawTimezoneOption {
  value: string;
  label: string;
  region: string;
  offset: string;
}

export const LAW_TIMEZONE_OPTIONS: LawTimezoneOption[] = [
  {
    value: "America/Sao_Paulo",
    label: "São Paulo, Sul e Sudeste do Brasil (BA, GO, DF, MG, ES, RJ, SP, PR, SC, RS) – Horário de Brasília",
    region: "Brasília / Sul / Sudeste / Centro-Oeste / Nordeste",
    offset: "UTC-03:00",
  },
  {
    value: "America/Manaus",
    label: "Manaus, Amazonas, Rondônia e Roraima (AM, RO, RR)",
    region: "Norte Ocidental",
    offset: "UTC-04:00",
  },
  {
    value: "America/Cuiaba",
    label: "Cuiabá, Mato Grosso e Mato Grosso do Sul (MT, MS)",
    region: "Centro-Oeste Pantanal",
    offset: "UTC-04:00",
  },
  {
    value: "America/Rio_Branco",
    label: "Rio Branco, Acre e extremo oeste do Amazonas (AC)",
    region: "Acre",
    offset: "UTC-05:00",
  },
  {
    value: "America/Noronha",
    label: "Fernando de Noronha (PE)",
    region: "Ilhas Oceânicas",
    offset: "UTC-02:00",
  },
  {
    value: "America/Belem",
    label: "Belém, Pará e Amapá (PA, AP)",
    region: "Norte Oriental",
    offset: "UTC-03:00",
  },
  {
    value: "UTC",
    label: "UTC (Tempo Universal Coordenado)",
    region: "Internacional",
    offset: "UTC+00:00",
  },
  {
    value: "Europe/Lisbon",
    label: "Lisboa / Portugal (WET/WEST)",
    region: "Europa / Portugal",
    offset: "UTC+00:00 / +01:00",
  },
];


export type DocumentCategory = 'procuracao' | 'peticao' | 'documento_pessoal' | 'decisao' | 'contrato' | 'comprovante' | 'geral';

export interface LawDocument {
  id: string;
  process_id?: string;
  process_cnj?: string;
  client_id?: string;
  client_name?: string;
  name?: string;
  title?: string;
  file_name?: string;
  category?: DocumentCategory | string;
  file_url?: string;
  file_size?: number | string;
  file_type?: string;
  date?: string;
  created_at?: string;
  created_by?: string;
  status?: string;
  visible_to_client?: boolean;
  hash_sha256?: string;
  version?: string;
  tags?: string[];
  notes?: string;
}

export interface ExtractedPdfData {
  fileName: string;
  fileSize: string;
  pageCount: number;
  extractedText: string;
  detectedCnj?: string;
  detectedCourt?: string;
  detectedAuthor?: string;
  detectedDefendant?: string;
  detectedValue?: number;
  detectedSubject?: string;
  detectedActions?: string[];
  summary?: string;
}

export type FinancialType = 'honorario' | 'cobranca' | 'despesa';
export type FinancialStatus = 'pendente' | 'pago' | 'vencido' | 'cancelado';

export interface LawFinancialEntry {
  id: string;
  client_id?: string;
  client_name?: string;
  process_id?: string;
  process_cnj?: string;
  entry_type: FinancialType;
  title: string;
  amount: number;
  due_date: string;
  payment_date?: string;
  status: FinancialStatus;
  category?: string;
  payment_method?: string;
  notes?: string;
  created_at: string;
}

export interface LawActivity {
  id: string;
  type: 'processo' | 'documento' | 'cliente' | 'tarefa' | 'atendimento' | 'pagamento' | 'prazo';
  title: string;
  description: string;
  timestamp: string;
  iconType?: string;
}

export interface SyncedLawyerProfile {
  name: string;
  oab_number: string;
  oab_state: string;
  full_oab: string;
  status: string;
  registration_type: string;
  sectional: string;
  subdivision: string;
  law_firm: string;
  law_firm_cnpj: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  synced_at: string;
}

export interface LawPublication {
  id: string;
  process_cnj: string;
  court: string;
  gazette_name: string;
  edition_number: string;
  publication_date: string;
  release_date?: string; // Data de divulgação
  dispatch_summary: string;
  full_text: string;
  status: 'pendente' | 'lida' | 'tratada' | 'descartada';
  deadline_days?: number | undefined;
  deadline_date?: string | undefined;
  lawyer_oab: string;
  searched_name?: string | undefined;
  vara?: string | undefined;
  comarca?: string | undefined;
  source_url?: string | undefined;
  is_linked?: boolean | undefined;
  linked_process_id?: string | undefined;
  treatment_type?: 'prazo' | 'audiencia' | 'tarefa' | 'historico' | 'descarte';
  treatment_title?: string;
  treatment_date?: string;
  treated_by?: string;
  treated_at?: string;
}

export type LawAlertCategory =
  | "todos"
  | "importantes"
  | "callcenter"
  | "publicacoes"
  | "andamentos"
  | "processos"
  | "tarefas"
  | "agenda"
  | "financeiro"
  | "portal_cliente"
  | "integracao"
  | "outros";

export interface LawAlert {
  id: string;
  type: "publicacao" | "andamento" | "prazo" | "tarefa" | "audiencia" | "financeiro" | "portal" | "callcenter" | "outro";
  category: LawAlertCategory;
  title: string;
  status: "nao_tratada" | "tratada" | "descartada";
  is_treated?: boolean;
  process_cnj?: string;
  process_id?: string;
  court?: string;
  monitored_term?: string;
  publication_id?: string;
  publication?: LawPublication;
  time_label?: string; // Ex: "Ontem - 04:59", "18/09/2026 - 10:36"
  created_at: string;
  is_important?: boolean;
  read?: boolean;
  dismissed?: boolean;
  summary?: string;
  content?: string;
  lead_id?: string;
}

export interface MonitoredDiarioConfig {
  id: string;
  type: "PF" | "PJ";
  name: string;
  diario_summary: string; // Ex: "DJPI , Superiores"
  receiver_name: string; // Ex: "matheus moura"
  status: "Ativo" | "Inativo";
  state_name: string; // Ex: "Piauí"
  state_diarios: string[]; // Ex: ["TJPI", "TEPI", "TRPI", ...]
  superior_diarios: string[]; // Ex: ["CNJDJN", "TSTDJN", "STJDJN", ...]
  diarios_list?: string[];
}

export interface MonitoredPublicationTerm {
  id: string;
  type: "PF" | "PJ";
  name: string;
  oab_uf?: string | undefined;
  oab_number?: string | undefined;
  cpf?: string | undefined;
  cnpj?: string | undefined;
  has_homonyms: boolean;
  blocked_terms: string[];
  scope_type: "todos" | "um_estado" | "diferentes_estados";
  selected_states: string[];
  notified_users: string[];
  status: "ativo" | "em_homologacao" | "inativo";
  created_at: string;
}

export interface OABSyncResult {
  lawyer: SyncedLawyerProfile;
  processes: LawProcess[];
  clients: LawClient[];
  publications: LawPublication[];
  deadlines: LawDeadline[];
  hearings: LawHearing[];
  monitoredDiarios?: MonitoredDiarioConfig[];
  summary: {
    processesCount: number;
    clientsCount: number;
    publicationsCount: number;
    deadlinesCount: number;
    hearingsCount: number;
  };
}

export interface OfficeTaxConfig {
  id: string;
  name: string; // Ex: IRRF, PCC, ISS
  percentage: number; // Ex: 1.5, 4.65
  min_retention: number; // Ex: 10.00
  simples_nacional: boolean; // Sim / Não
}

export interface OfficeBillingConfig {
  next_invoice_number: number;
  service_type: string;
  notes: string;
  report_grouping: "separados" | "mesmo_relatorio";
  taxes: OfficeTaxConfig[];
}

export interface OfficeGeneralConfig {
  name: string; // Nome do escritório / Razão Social
  titular_name: string; // matheus moura borges
  email: string; // matheus_zip@hotmail.com
  address: string;
  site: string;
  document: string; // CPF ou CNPJ
  ccm: string; // Inscrição Municipal / CCM
  oab: string; // Ex: OAB/PI 18.293
  practice_area?: string;
  logo_url?: string;
  billing: OfficeBillingConfig;
}

export type OfficeUserRole =
  | "colaborador"
  | "advogado_associado"
  | "advogado_senior"
  | "administrador"
  | "advogado_supervisionado"
  | "advogado_autonomia"
  | "coordenador"
  | "atendente_callcenter";

export interface OfficeUserPermissions {
  accessFinanceiro: boolean; // Módulo Financeiro
  accessHonorariosForaFinanceiro: boolean; // Honorários em processos/contatos
  accessAllProcesses: boolean; // Visualizar todos os processos ou apenas atribuídos
  accessPublicacoes: boolean; // Visualizar todas as publicações do escritório
  canConcludeDeadlines: boolean; // Autonomia para cumprir prazos e audiências sem supervisão
  canDeleteRecords: boolean; // Permissão para excluir processos, clientes ou documentos
  canDelegateTasks: boolean; // Delegar tarefas e reatribuir responsáveis
  isAdmin: boolean; // Acesso às configurações administrativas
  accessCallCenter?: boolean; // Acesso ao módulo Call Center
  onlyCallCenter?: boolean; // Permissão exclusiva apenas para Call Center (tela inteira)
  createProcesses?: boolean;
  deleteProcesses?: boolean;
  createInvoices?: boolean;
  managePublications?: boolean;
  registerOABTerms?: boolean;
  manageAgenda?: boolean;
  useAI?: boolean;
  manageClients?: boolean;
  accessLeads?: boolean; // CRM / Funil de Leads
  accessDocumentos?: boolean; // Central de Documentos
}

export interface OfficeUser {
  id: string;
  name: string;
  email: string;
  role: OfficeUserRole;
  custom_role_name?: string; // Nome personalizado do cargo se for customizado
  is_master_admin?: boolean; // Administrador Geral Titular da conta
  permissions: OfficeUserPermissions;
  accessFinanceiro: boolean; // Compatibilidade com código legado
  accessHonorariosForaFinanceiro: boolean; // Compatibilidade com código legado
  status: "ativo" | "pendente" | "inativo";
  first_access_token?: string;
  first_access_expires_at?: string;
  first_access_status?: "pendente" | "utilizado" | "ativo" | "expirado" | string;
  first_access_used_at?: string;
  has_set_password?: boolean;
  oab?: string;
  team_name?: string;
  department?: string;
  avatar_url?: string;
  created_at?: string;

  // DADOS PESSOAIS COMPLETOS
  cpf?: string;
  rg?: string;
  rg_issuer?: string;
  birth_date?: string;
  phone?: string;
  gender?: string;

  // DOCUMENTAÇÃO TRABALHISTA & CONTRATUAL
  ctps_number?: string; // Carteira de Trabalho
  ctps_series?: string;
  ctps_uf?: string;
  pis_pasep?: string;
  contract_type?: "socio" | "associado" | "clt" | "pj" | "estagio" | "outros";
  admission_date?: string;

  // ENDEREÇO COMPLETO
  zip_code?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;

  // DADOS BANCÁRIOS & REPASSE DE HONORÁRIOS
  pix_type?: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
  pix_key?: string;
  bank_name?: string;
  bank_agency?: string;
  bank_account?: string;

  // CONTROLE DE ACESSO AO SISTEMA (Ex: equipe de limpeza/apoio sem acesso)
  has_system_access?: boolean;
}

export interface OfficeRoleConfig {
  id: string;
  name: string;
  description?: string;
  default_has_system_access: boolean;
  color?: string;
  is_custom?: boolean;
}

export interface OfficeTeam {
  id: string;
  name: string; // Ex: Criminalista, Cível, Trabalhista, Tributário, Contratos
  members: string[]; // Nomes dos membros da equipe
  status: "ativo" | "inativo";
  created_at?: string | undefined;
}

export interface ClientPortalAccess {
  id: string;
  client_id?: string;
  client_name: string;
  email: string;
  created_at: string;
  last_access?: string;
  status: "ativo" | "pendente" | "inativo";
  processes_count: number;
  permissions: {
    view_processes: boolean;
    view_movements: boolean;
    view_documents: boolean;
    view_financial: boolean;
    email_notifications: boolean;
  };
  token: string;
}

export type LawHubPlanTier = "autonomo" | "agil" | "pro" | "business" | "enterprise";

export interface CreditTransaction {
  id: string;
  created_at: string;
  type: "credit_in" | "credit_out";
  amount: number;
  description: string;
  balance_after: number;
}

export interface SubscriptionPlanInfo {
  id: string;
  tier: LawHubPlanTier;
  name: string;
  description: string;
  amount: number;
  billing_cycle: "monthly" | "yearly";
  status: "active" | "trial" | "past_due" | "suspended" | "canceled";
  renewal_date: string;
  created_at: string;
  // Quotas contratuais
  max_users: number;
  monitored_oab_limit: number;
  processes_limit: number;
  radar_processes_limit: number;
  ai_credits_monthly: number;
  storage_gb: number;
  // Turbos / Cotas extras contratadas
  extra_users?: number;
  extra_oabs?: number;
  extra_ai_credits?: number;
  extra_radar_processes?: number;
}

export interface TenantUsageQuotas {
  users_count: number;
  monitored_oabs_count: number;
  processes_count: number;
  radar_processes_count: number;
  ai_credits_used: number;
  storage_gb_used: number;
}

export interface SubscriptionInvoice {
  id: string;
  invoice_number: string;
  reference_month: string; // Ex: "09/2026"
  issue_date: string;
  due_date: string;
  paid_at?: string;
  amount: number;
  status: "pago" | "aberto" | "vencido" | "cancelado";
  payment_method: "cartao_credito" | "pix" | "boleto";
  receipt_url?: string;
  pdf_url?: string;
}

export interface BillingCardInfo {
  brand: "mastercard" | "visa" | "elo" | "amex";
  last4: string;
  exp_month: string;
  exp_year: string;
  holder_name: string;
  document: string;
}

export interface MasterSecurityConfig {
  primary_email: string;
  recovery_email: string;
  master_password: string;
  face_id_enabled: boolean;
  face_id_photo_url?: string;
  face_id_last_calibrated?: string;
  voice_id_enabled: boolean;
  voice_id_phrase: string;
  voice_id_last_calibrated?: string;
  voice_sample_url?: string;
  require_face_or_voice: boolean;
  last_auth_event?: {
    timestamp: string;
    method: "credentials" | "face_id" | "voice_id";
    email_used: string;
    success: boolean;
  };
}



