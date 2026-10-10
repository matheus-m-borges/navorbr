// @ts-nocheck — tipos legados do LawHub em migração
import { supabase } from "@/integrations/supabase/client";
import type {
  LawClient,
  LawLawyer,
  LawProcess,
  LawProcessResource,
  LawProcessMovement,
  LawDeadline,
  LawHearing,
  LawAttendance,
  LawTask,
  LawTaskChecklistItem,
  LawTaskComment,
  LawTaskList,
  LawWorkflowTemplate,
  LawWorkflowStep,
  TaskPriority,
  TaskStatus,
  LawDocument,
  LawFinancialEntry,
  LawActivity,
  SyncedLawyerProfile,
  LawPublication,
  OABSyncResult,
  MonitoredDiarioConfig,
  MonitoredPublicationTerm,
  OfficeGeneralConfig,
  OfficeBillingConfig,
  OfficeTaxConfig,
  OfficeUser,
  OfficeUserPermissions,
  OfficeUserRole,
  OfficeRoleConfig,
  OfficeTeam,
  ClientPortalAccess,
  ClientType,
  ProcessSearchResultItem,
  ProcessSearchBatch,
  LawAgendaActivity,
  LawAgendaActivityType,
  LawAgendaActivityStatus,
  LawAgendaActivityComment,
  LawAgendaActivityAttachment,
  LAW_TIMEZONE_OPTIONS,
  LawAlert,
  LawAlertCategory,
  SubscriptionPlanInfo,
  TenantUsageQuotas,
  SubscriptionInvoice,
  BillingCardInfo,
  LawHubPlanTier,
  MasterSecurityConfig,
} from "./types";
import { generateOABPortfolio } from "./oab-sync-engine";
import { ComunicaPJEService } from "./comunicapje-service";

const db = supabase as any;

export function generateValidUUID(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Dados de semente / inicialização de alta fidelidade
export const INITIAL_CLIENTS: LawClient[] = [];

export const INITIAL_LAWYERS: LawLawyer[] = [];

export const INITIAL_PROCESSES: LawProcess[] = [];

export const INITIAL_DEADLINES: LawDeadline[] = [];

export const INITIAL_HEARINGS: LawHearing[] = [];

export const DEFAULT_AGENDA_TIMEZONE = "America/Sao_Paulo";

export const INITIAL_AGENDA_ACTIVITIES: LawAgendaActivity[] = [];

export const INITIAL_FINANCIAL: LawFinancialEntry[] = [];

export const INITIAL_ACTIVITIES: LawActivity[] = [];

export const INITIAL_PUBLICATIONS: LawPublication[] = [];

export const INITIAL_MONITORED_DIARIOS: MonitoredDiarioConfig[] = [];

export const INITIAL_PUBLICATION_TERMS: MonitoredPublicationTerm[] = [];

export const INITIAL_OFFICE_CONFIG: OfficeGeneralConfig = {
  name: "",
  titular_name: "",
  email: "",
  address: "",
  site: "",
  document: "",
  ccm: "",
  oab: "",
  practice_area: "",
  logo_url: "",
  billing: {
    next_invoice_number: 1,
    service_type: "Prestação de Serviços Advocatícios e Assessoria Jurídica",
    notes: "Fatura emitida com retenção de impostos na fonte para Pessoa Jurídica conforme legislação vigente.",
    report_grouping: "mesmo_relatorio",
    taxes: [
      {
        id: "tax-irrf",
        name: "IRRF",
        percentage: 1.5,
        min_retention: 10.0,
        simples_nacional: true,
      },
      {
        id: "tax-pcc",
        name: "PCC",
        percentage: 4.65,
        min_retention: 10.0,
        simples_nacional: false,
      },
    ],
  },
};

// Identidades e e-mails são sempre carregados da conta autenticada.
export const DEFAULT_TEST_TITULAR_EMAIL = "";
export const MASTER_ADMIN_EMAIL = DEFAULT_TEST_TITULAR_EMAIL;

export function getDefaultPermissionsForRole(
  role: OfficeUserRole,
  isMasterAdmin = false
): OfficeUserPermissions {
  if (isMasterAdmin || role === "administrador") {
    return {
      accessFinanceiro: true,
      accessHonorariosForaFinanceiro: true,
      accessAllProcesses: true,
      accessPublicacoes: true,
      canConcludeDeadlines: true,
      canDeleteRecords: true,
      canDelegateTasks: true,
      isAdmin: true,
      accessCallCenter: true,
      onlyCallCenter: false,
      createProcesses: true,
      deleteProcesses: true,
      createInvoices: true,
      managePublications: true,
      registerOABTerms: true,
      manageAgenda: true,
      useAI: true,
      manageClients: true,
      accessLeads: true,
      accessDocumentos: true,
    };
  }

  if (role === "atendente_callcenter") {
    return {
      accessFinanceiro: false,
      accessHonorariosForaFinanceiro: false,
      accessAllProcesses: false,
      accessPublicacoes: false,
      canConcludeDeadlines: false,
      canDeleteRecords: false,
      canDelegateTasks: false,
      isAdmin: false,
      accessCallCenter: true,
      onlyCallCenter: true,
      createProcesses: false,
      deleteProcesses: false,
      createInvoices: false,
      managePublications: false,
      registerOABTerms: false,
      manageAgenda: false,
      useAI: false,
      manageClients: false,
      accessLeads: false,
      accessDocumentos: false,
    };
  }

  if (role === "advogado_senior" || role === "coordenador") {
    return {
      accessFinanceiro: true,
      accessHonorariosForaFinanceiro: true,
      accessAllProcesses: true,
      accessPublicacoes: true,
      canConcludeDeadlines: true,
      canDeleteRecords: false,
      canDelegateTasks: true,
      isAdmin: false,
      accessCallCenter: false,
      onlyCallCenter: false,
      createProcesses: true,
      deleteProcesses: false,
      createInvoices: true,
      managePublications: true,
      registerOABTerms: true,
      manageAgenda: true,
      useAI: true,
      manageClients: true,
      accessLeads: true,
      accessDocumentos: true,
    };
  }

  if (role === "advogado_associado" || role === "advogado_autonomia") {
    return {
      accessFinanceiro: false,
      accessHonorariosForaFinanceiro: true,
      accessAllProcesses: false,
      accessPublicacoes: true,
      canConcludeDeadlines: true,
      canDeleteRecords: false,
      canDelegateTasks: false,
      isAdmin: false,
      accessCallCenter: false,
      onlyCallCenter: false,
      createProcesses: true,
      deleteProcesses: false,
      createInvoices: false,
      managePublications: true,
      registerOABTerms: false,
      manageAgenda: true,
      useAI: true,
      manageClients: true,
      accessLeads: true,
      accessDocumentos: true,
    };
  }

  // colaborador ou advogado_supervisionado (Colaborador de escritório sob supervisão)
  return {
    accessFinanceiro: false,
    accessHonorariosForaFinanceiro: false,
    accessAllProcesses: false,
    accessPublicacoes: false,
    canConcludeDeadlines: false,
    canDeleteRecords: false,
    canDelegateTasks: false,
    isAdmin: false,
    accessCallCenter: false,
    onlyCallCenter: false,
    createProcesses: false,
    deleteProcesses: false,
    createInvoices: false,
    managePublications: false,
    registerOABTerms: false,
    manageAgenda: true,
    useAI: false,
    manageClients: false,
    accessLeads: false,
    accessDocumentos: false,
  };
}

export const INITIAL_OFFICE_ROLES: OfficeRoleConfig[] = [
  { id: "socio", name: "Sócio / Diretor", description: "Gestão executiva, sócio cotista e governança irrestrita.", default_has_system_access: true, color: "#1e3a8a" },
  { id: "advogado_senior", name: "Advogado Sênior / Coordenador", description: "Autonomia plena, coordena equipe técnica e prazos complexos.", default_has_system_access: true, color: "#2563eb" },
  { id: "advogado_associado", name: "Advogado Associado / Pleno", description: "Atuação técnica em processos, petições e audiências atribuídas.", default_has_system_access: true, color: "#0284c7" },
  { id: "advogado_junior", name: "Advogado Júnior", description: "Atuação sob supervisão de um coordenador.", default_has_system_access: true, color: "#0d9488" },
  { id: "atendente_callcenter", name: "Atendente / Call Center", description: "Operador dedicado ao Call Center e WhatsApp Oficial.", default_has_system_access: true, color: "#06b6d4" },
  { id: "estagiario", name: "Estagiário de Direito", description: "Pesquisas jurisprudenciais, elaboração de minutas e acompanhamento.", default_has_system_access: true, color: "#16a34a" },
  { id: "paralegal", name: "Paralegal / Assistente Jurídico", description: "Controle de diligências, cópias, certidões e protocolos.", default_has_system_access: true, color: "#d97706" },
  { id: "secretaria", name: "Secretária / Recepção", description: "Atendimento a clientes, triagem telefônica e controle de agenda física.", default_has_system_access: true, color: "#9333ea" },
  { id: "financeiro", name: "Financeiro / Controladoria", description: "Faturamento, cobrança Asaas, emissão de boletos e fluxo de caixa.", default_has_system_access: true, color: "#059669" },
  { id: "limpeza", name: "Limpeza / Serviços Gerais", description: "Conservação predial e copa (Sem acesso ao sistema de processos).", default_has_system_access: false, color: "#64748b" },
  { id: "ti_suporte", name: "TI / Suporte Técnico", description: "Infraestrutura de redes, computadores e certificados digitais.", default_has_system_access: true, color: "#475569" },
];

export const INITIAL_OFFICE_USERS: OfficeUser[] = [];

export const INITIAL_OFFICE_TEAMS: OfficeTeam[] = [];

export const INITIAL_PORTAL_ACCESSES: ClientPortalAccess[] = [];

export const INITIAL_SEARCH_BATCHES: ProcessSearchBatch[] = [];

export const INITIAL_SEARCH_RESULTS: ProcessSearchResultItem[] = [];

// Helper para persistência local reactiva durante navegação
function getStorageKey(): string {
  if (typeof window === "undefined") return "navor_lawhub_state_v4";
  try {
    const accId = window.localStorage.getItem("navor.active_account_id");
    return accId ? `navor_lawhub_state_v4_${accId}` : "navor_lawhub_state_v4";
  } catch {
    return "navor_lawhub_state_v4";
  }
}

function getLocalState() {
  if (typeof window === "undefined") {
    return {
      clients: INITIAL_CLIENTS,
      processes: INITIAL_PROCESSES,
      deadlines: INITIAL_DEADLINES,
      hearings: INITIAL_HEARINGS,
      financial: INITIAL_FINANCIAL,
      activities: INITIAL_ACTIVITIES,
      lawyers: INITIAL_LAWYERS,
      publications: INITIAL_PUBLICATIONS,
      monitoredDiarios: INITIAL_MONITORED_DIARIOS,
      officeConfig: INITIAL_OFFICE_CONFIG,
      searchResults: INITIAL_SEARCH_RESULTS,
      agendaActivities: INITIAL_AGENDA_ACTIVITIES,
      agendaTimezone: DEFAULT_AGENDA_TIMEZONE,
    };
  }

  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) {
      const initial = {
        clients: INITIAL_CLIENTS,
        processes: INITIAL_PROCESSES,
        deadlines: INITIAL_DEADLINES,
        hearings: INITIAL_HEARINGS,
        financial: INITIAL_FINANCIAL,
        activities: INITIAL_ACTIVITIES,
        lawyers: INITIAL_LAWYERS,
        publications: INITIAL_PUBLICATIONS,
        monitoredDiarios: INITIAL_MONITORED_DIARIOS,
        officeConfig: INITIAL_OFFICE_CONFIG,
        searchResults: INITIAL_SEARCH_RESULTS,
        agendaActivities: INITIAL_AGENDA_ACTIVITIES,
        agendaTimezone: DEFAULT_AGENDA_TIMEZONE,
      };
      localStorage.setItem(getStorageKey(), JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.officeConfig) {
      parsed.officeConfig = INITIAL_OFFICE_CONFIG;
    }
    if (!parsed.searchResults || !Array.isArray(parsed.searchResults)) {
      parsed.searchResults = INITIAL_SEARCH_RESULTS;
    }
    if (!parsed.agendaActivities || !Array.isArray(parsed.agendaActivities) || parsed.agendaActivities.length === 0) {
      parsed.agendaActivities = INITIAL_AGENDA_ACTIVITIES;
    }
    if (!parsed.agendaTimezone) {
      parsed.agendaTimezone = DEFAULT_AGENDA_TIMEZONE;
    }
    // Garante que todos os clientes da semente (incluindo Ativa) existam no localStorage
    if (Array.isArray(parsed.clients)) {
      for (const initCli of INITIAL_CLIENTS) {
        const exists = parsed.clients.some(
          (c: any) => c.id === initCli.id || (c.name && c.name.toLowerCase() === initCli.name.toLowerCase())
        );
        if (!exists) {
          parsed.clients.unshift(initCli);
        }
      }
    } else {
      parsed.clients = INITIAL_CLIENTS;
    }

    // Limpeza de processos fictícios de terceiros e garantia de fidelidade aos dados oficiais
    if (Array.isArray(parsed.processes)) {
      parsed.processes = parsed.processes
        .filter((p: any) => p && p.id !== "proc-1" && p.id !== "proc-2" && p.id !== "proc-3" && !p.id?.startsWith("p1") && !p.id?.startsWith("p2") && !p.id?.startsWith("p3"))
        .map((p: any) => {
          let atts = Array.isArray(p.attachments) ? p.attachments : [];
          // Remove rigorosamente anexos mock / simulados
          atts = atts.filter(
            (a: any) => a && a.id !== "cda-uniao-01" && a.id !== "pet-inicial" && !String(a.id).includes("cda-uniao") && !a.name?.includes("Certidão de Dívida") && !a.name?.includes("Petição Inicial")
          );
          // Deduplica anexos por ID
          const seenAtts = new Set<string>();
          atts = atts.filter((a: any) => {
            const rawId = String(a.id || "").replace(/^doc-/, "");
            if (seenAtts.has(rawId)) return false;
            seenAtts.add(rawId);
            return true;
          }).map((a: any) => {
            if (String(a.id).includes("470443987") || a.name?.includes("470443987")) {
              return { ...a, date: "18/09/2026" };
            }
            return a;
          });

          return {
            ...p,
            record_type: p.record_type || (p.id?.startsWith("case-") ? "caso" : "processo"),
            attachments: atts,
          };
        });

      for (const initProc of INITIAL_PROCESSES) {
        const exists = parsed.processes.some((p: any) => p.id === initProc.id);
        if (!exists) {
          parsed.processes.unshift(initProc);
        }
      }
    } else {
      parsed.processes = INITIAL_PROCESSES;
    }

    // Limpa documentos e peças fictícias injetadas no histórico, deduplica e garante data oficial do tribunal
    if (Array.isArray(parsed.documents)) {
      const seenDocKeys = new Set<string>();
      parsed.documents = parsed.documents
        .filter((d: any) => {
          if (!d) return false;
          if (d.id === "doc-cda-uniao-01" || d.id === "doc-pet-inicial" || String(d.id).includes("cda-uniao")) return false;
          if (d.title?.includes("Dossiê") || d.category === "Dossiê Completo") return false;
          if (d.title?.includes("Certidão de Dívida Ativa") || d.title?.includes("Petição Inicial Execução Fiscal")) return false;

          const rawId = String(d.id || "").replace(/^doc-/, "");
          const key = rawId || `${d.process_cnj}_${d.title}`;
          if (seenDocKeys.has(key)) return false;
          seenDocKeys.add(key);
          return true;
        })
        .map((d: any) => {
          if (d.title?.includes("470443987") || String(d.id).includes("470443987")) {
            return {
              ...d,
              date: "18/09/2026",
              created_at: "2026-09-18T14:00:00.000Z",
              file_size: "480 KB",
              created_by: "Escavador Sync",
            };
          }
          return d;
        });
    }

    // Restaura e prioriza processos importados via Escavador gravados em chaves isoladas no localStorage
    if (typeof window !== "undefined") {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("escavador_imported_") || key.startsWith("escavador_cache_")) && !key.endsWith("_raw")) {
            const rawVal = localStorage.getItem(key);
            if (rawVal) {
              const item = JSON.parse(rawVal);
              if (item && item.id && item.cnj_number) {
                // Remove attachments simulados que possam ter ficado em chaves antigas de cache
                if (Array.isArray(item.attachments)) {
                  item.attachments = item.attachments
                    .filter(
                      (a: any) => a && a.id !== "cda-uniao-01" && a.id !== "pet-inicial" && !String(a.id).includes("cda-uniao") && !a.name?.includes("Certidão de Dívida") && !a.name?.includes("Petição Inicial")
                    )
                    .map((a: any) => {
                      if (String(a.id).includes("470443987") || a.name?.includes("470443987")) {
                        return { ...a, date: "18/09/2026" };
                      }
                      return a;
                    });
                  // Salva versão limpa no cache
                  try {
                    localStorage.setItem(key, JSON.stringify(item));
                  } catch {}
                }
                const cleanItemCnj = item.cnj_number.replace(/\D/g, "");
                const existingIdx = parsed.processes.findIndex((p: any) =>
                  p.id === item.id || (p.cnj_number && p.cnj_number.replace(/\D/g, "") === cleanItemCnj)
                );
                if (existingIdx >= 0) {
                  parsed.processes[existingIdx] = { ...parsed.processes[existingIdx], ...item };
                } else {
                  parsed.processes.unshift(item);
                }
              }
            }
          }
        }
        // Salva estado corrigido e limpo
        localStorage.setItem(getStorageKey(), JSON.stringify(parsed));
      } catch {}
    }

    return parsed;
  } catch {
    return {
      clients: INITIAL_CLIENTS,
      processes: INITIAL_PROCESSES,
      deadlines: INITIAL_DEADLINES,
      hearings: INITIAL_HEARINGS,
      financial: INITIAL_FINANCIAL,
      activities: INITIAL_ACTIVITIES,
      lawyers: INITIAL_LAWYERS,
      publications: INITIAL_PUBLICATIONS,
      monitoredDiarios: INITIAL_MONITORED_DIARIOS,
      officeConfig: INITIAL_OFFICE_CONFIG,
      searchResults: INITIAL_SEARCH_RESULTS,
    };
  }
}

function saveLocalState(state: any) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(state));
    } catch {}
  }
}

export const LawHubService = {
  clearLocalCache(): void {
    if (typeof window === "undefined") return;
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (
          k &&
          (k.startsWith("navor_lawhub_state_") ||
            k.startsWith("escavador_imported_") ||
            k.startsWith("escavador_cache_") ||
            k.startsWith("lawhub_resources_"))
        ) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {}
  },

  invalidateAccountCache(accountId?: string): void {
    if (typeof window === "undefined") return;
    try {
      const key = accountId ? `navor_lawhub_state_v4_${accountId}` : getStorageKey();
      window.localStorage.removeItem(key);
    } catch {}
  },

  // Clientes
  getClientsSync(): LawClient[] {
    return getLocalState().clients || [];
  },

  getAllContactsSync(): Array<{
    id: string;
    name: string;
    trade_name?: string;
    email?: string;
    phone?: string;
    document?: string;
    contact_type?: string;
  }> {
    const clients = getLocalState().clients || [];
    const processes = getLocalState().processes || [];
    const map = new Map<string, any>();

    // 1. Clientes cadastrados no módulo Clientes
    clients.forEach((c: any) => {
      const key = (c.name || "").trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, {
          id: c.id,
          name: c.name,
          trade_name: c.trade_name,
          email: c.email || "",
          phone: c.mobile || c.phone || "",
          document: c.document || "",
          contact_type: "Cliente",
        });
      }
    });

    // 2. Contatos pré-cadastrados / agenda de contatos
    const baseContacts: Array<Record<string, string>> = [];

    baseContacts.forEach((bc) => {
      const key = bc.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, bc);
      }
    });

    // 3. Clientes dos processos
    processes.forEach((p: any) => {
      if (p.client_name) {
        const key = p.client_name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: p.client_id || `proc-cli-${Math.random().toString(36).substring(2, 7)}`,
            name: p.client_name,
            trade_name: undefined,
            email: p.client_name.includes("Ativa") ? "contato@ativarepresentacoes.com.br" : "",
            phone: "",
            document: "",
            contact_type: "Cliente Processual",
          });
        }
      }
    });

    return Array.from(map.values());
  },

  async getClients(): Promise<LawClient[]> {
    try {
      const { data, error } = await db.from("law_clients").select("*").order("created_at", { ascending: false });
      if (!error && data && data.length > 0) {
        return data as LawClient[];
      }
    } catch {}
    return getLocalState().clients;
  },

  async getClientById(id: string): Promise<LawClient | undefined> {
    try {
      const { data, error } = await db.from("law_clients").select("*").eq("id", id).maybeSingle();
      if (!error && data) {
        return data as LawClient;
      }
    } catch {}
    return getLocalState().clients.find((c: LawClient) => c.id === id);
  },

  async createClient(clientData: Omit<LawClient, "id" | "created_at">): Promise<LawClient> {
    const newClient: LawClient = {
      ...clientData,
      id: generateValidUUID(),
      created_at: new Date().toISOString(),
    };

    try {
      await db.from("law_clients").insert(newClient);
    } catch {}

    const state = getLocalState();
    state.clients = [newClient, ...state.clients];
    state.activities = [
      {
        id: "act-" + Date.now(),
        type: "cliente",
        title: "Novo cliente cadastrado",
        description: `${newClient.name} (${newClient.client_type})`,
        timestamp: "Agora mesmo",
      },
      ...state.activities,
    ];
    saveLocalState(state);
    return newClient;
  },

  // Processos
  async getProcesses(): Promise<LawProcess[]> {
    const local = getLocalState().processes || [];
    try {
      const { data, error } = await db.from("law_processes").select("*").order("created_at", { ascending: false });
      if (!error && data && data.length > 0) {
        // Unifica os dados do banco com os processos locais/importados para nunca perder no refresh
        const dbIds = new Set(data.map((d: any) => d.id));
        const extraLocal = local.filter((lp: LawProcess) => lp && !dbIds.has(lp.id));
        return [...extraLocal, ...data] as LawProcess[];
      }
    } catch {}
    return local;
  },

  async getProcessById(id: string): Promise<LawProcess | undefined> {
    const rawId = decodeURIComponent(id || "").trim();
    if (!rawId) return undefined;
    const cleanDigits = rawId.replace(/\D/g, "");
    const normalizedRaw = rawId.toLowerCase().replace(/[\s_-]/g, "");

    // 1. Busca autoritativa no Supabase pelo id ou cnj_number
    try {
      const { data } = await db
        .from("law_processes")
        .select("*")
        .or(`id.eq.${rawId},cnj_number.eq.${rawId}`)
        .maybeSingle();
      if (data) return data as LawProcess;
    } catch {}

    // 2. Busca no cache UX local da conta ativa
    const localProcesses = getLocalState().processes || [];
    const localMatch = localProcesses.find((p: LawProcess) => {
      if (!p) return false;
      if (p.id === rawId) return true;
      if (p.id && p.id.toLowerCase().replace(/[\s_-]/g, "") === normalizedRaw) return true;
      if (p.cnj_number === rawId) return true;
      if (cleanDigits && p.cnj_number?.replace(/\D/g, "") === cleanDigits) return true;
      if (cleanDigits && p.id?.replace(/\D/g, "") === cleanDigits) return true;
      return false;
    });
    if (localMatch) return localMatch;

    // 3. Proibido fallback para primeiro processo ou processos de outra conta
    return undefined;
  },

  addProcess(process: LawProcess): LawProcess {
    // Grava de forma resiliente e isolada no localStorage para garantir persistência mesmo entre abas
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`escavador_imported_${process.id}`, JSON.stringify(process));
        if (process.cnj_number) {
          const clean = process.cnj_number.replace(/\D/g, "");
          if (clean) {
            localStorage.setItem(`escavador_imported_${clean}`, JSON.stringify(process));
            localStorage.setItem(`escavador_cache_${clean}`, JSON.stringify(process));
          }
        }
      } catch {}
    }

    const state = getLocalState();
    const existingIndex = state.processes.findIndex(
      (p: LawProcess) =>
        p.id === process.id ||
        (p.cnj_number && process.cnj_number && p.cnj_number.replace(/\D/g, "") === process.cnj_number.replace(/\D/g, ""))
    );

    if (existingIndex >= 0) {
      state.processes[existingIndex] = {
        ...state.processes[existingIndex],
        ...process,
        updated_at: new Date().toISOString(),
      };
    } else {
      state.processes = [process, ...state.processes];
    }

    state.activities = [
      {
        id: "act-" + Date.now(),
        type: "processo",
        title: "Processo importado via Escavador API v2",
        description: `CNJ ${process.cnj_number || process.title} (${process.court || "Tribunal"})`,
        timestamp: "Agora mesmo",
      },
      ...(state.activities || []),
    ];

    saveLocalState(state);

    try {
      db.from("law_processes")
        .upsert(process, { onConflict: "id" })
        .then(() => {})
        .catch(() => {});
    } catch {}

    return process;
  },

  async createProcess(processData: Omit<LawProcess, "id" | "created_at">): Promise<LawProcess> {
    const newProcess: LawProcess = {
      ...processData,
      id: generateValidUUID(),
      created_at: new Date().toISOString(),
    };

    try {
      await db.from("law_processes").insert(newProcess);
    } catch {}

    const state = getLocalState();
    state.processes = [newProcess, ...state.processes];
    state.activities = [
      {
        id: "act-" + Date.now(),
        type: "processo",
        title: "Novo processo cadastrado",
        description: `CNJ ${newProcess.cnj_number} (${newProcess.court})`,
        timestamp: "Agora mesmo",
      },
      ...state.activities,
    ];
    saveLocalState(state);
    return newProcess;
  },

  async createCase(caseData: Partial<LawProcess> & { title: string; client_name: string }): Promise<LawProcess> {
    const newCase: LawProcess = {
      ...caseData,
      id: "case-" + Math.random().toString(36).substring(2, 9),
      record_type: "caso",
      case_type: caseData.case_type || "consultoria",
      case_stage: caseData.case_stage || "briefing",
      client_id: caseData.client_id || "cli-" + Math.random().toString(36).substring(2, 7),
      client_name: caseData.client_name,
      title: caseData.title,
      active_pole: caseData.active_pole || caseData.client_name,
      passive_pole: caseData.passive_pole || "Demanda Extrajudicial",
      party_position: "ativo",
      court: caseData.court || "Extrajudicial",
      legal_area: caseData.legal_area || "Consultivo",
      responsible_name: caseData.responsible_name || "",
      monitoring_type: "manual",
      court_linked: false,
      status: "em_andamento",
      is_secret: false,
      last_movement: `${new Date().toLocaleDateString("pt-BR")} - Criado no acervo de casos extrajudiciais`,
      movements: [
        {
          id: "mov-" + Date.now(),
          date: new Date().toLocaleDateString("pt-BR"),
          text: `Demanda extrajudicial cadastrada na fase de ${caseData.case_stage || "briefing"}`,
        }
      ],
      created_at: new Date().toISOString(),
    };

    try {
      await db.from("law_processes").insert(newCase);
    } catch {}

    const state = getLocalState();
    state.processes = [newCase, ...state.processes];
    state.activities = [
      {
        id: "act-" + Date.now(),
        type: "processo",
        title: "Novo caso extrajudicial registrado",
        description: `${newCase.title} (${newCase.client_name})`,
        timestamp: "Agora mesmo",
      },
      ...state.activities,
    ];
    saveLocalState(state);
    return newCase;
  },

  async convertCaseToProcess(
    caseId: string,
    conversionData: {
      cnj_number: string;
      court: string;
      judicial_branch?: string;
      instance?: "1grau" | "2grau" | "superior";
      procedural_class?: string;
      monitoring_type?: "automatico" | "manual";
    }
  ): Promise<LawProcess | undefined> {
    const state = getLocalState();
    const index = state.processes.findIndex((p: LawProcess) => p.id === caseId);
    if (index === -1) return undefined;

    const current = state.processes[index];
    const updated: LawProcess = {
      ...current,
      record_type: "processo",
      cnj_number: conversionData.cnj_number,
      court: conversionData.court,
      judicial_branch: conversionData.judicial_branch || `${conversionData.court} - Vara Cível`,
      instance: conversionData.instance || "1grau",
      procedural_class: conversionData.procedural_class || "Procedimento Comum Cível",
      monitoring_type: conversionData.monitoring_type || "automatico",
      court_linked: conversionData.monitoring_type !== "manual",
      court_sync_system: conversionData.monitoring_type === "automatico" ? "DataJud / PJe" : "Manual",
      last_movement: `${new Date().toLocaleDateString("pt-BR")} - Transformado de Caso Extrajudicial para Processo Judicial`,
      movements: [
        {
          id: "mov-" + Date.now(),
          date: new Date().toLocaleDateString("pt-BR"),
          text: `Demanda convertida em Processo Judicial nº ${conversionData.cnj_number} perante o ${conversionData.court}`,
          instance: conversionData.instance === "2grau" ? "2º Grau" : "1º Grau",
        },
        ...(current.movements || []),
      ],
      updated_at: new Date().toISOString(),
    };

    state.processes[index] = updated;
    state.activities = [
      {
        id: "act-" + Date.now(),
        type: "processo",
        title: "Caso transformado em Processo Judicial",
        description: `CNJ ${conversionData.cnj_number} (${conversionData.court})`,
        timestamp: "Agora mesmo",
      },
      ...state.activities,
    ];
    saveLocalState(state);

    try {
      await db.from("law_processes").update(updated).eq("id", caseId);
    } catch {}

    return updated;
  },

  async updateProcess(id: string, updates: Partial<LawProcess>): Promise<LawProcess | undefined> {
    const rawId = decodeURIComponent(id || "").trim();
    const state = getLocalState();
    const index = state.processes.findIndex(
      (p: LawProcess) => p.id === rawId || p.cnj_number === rawId || (p.cnj_number && rawId.replace(/\D/g, "") && p.cnj_number.replace(/\D/g, "") === rawId.replace(/\D/g, ""))
    );
    if (index === -1) return undefined;

    const updated: LawProcess = {
      ...state.processes[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    state.processes[index] = updated;
    saveLocalState(state);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`escavador_imported_${updated.id}`, JSON.stringify(updated));
        if (updated.cnj_number) {
          const clean = updated.cnj_number.replace(/\D/g, "");
          if (clean) {
            localStorage.setItem(`escavador_imported_${clean}`, JSON.stringify(updated));
            localStorage.setItem(`escavador_cache_${clean}`, JSON.stringify(updated));
          }
        }
      } catch {}
    }

    try {
      await db.from("law_processes").update(updates).eq("id", updated.id);
    } catch {}

    return updated;
  },

  async swapProcessParties(id: string): Promise<LawProcess | undefined> {
    const rawId = decodeURIComponent(id || "").trim();
    const state = getLocalState();
    const index = state.processes.findIndex(
      (p: LawProcess) => p.id === rawId || p.cnj_number === rawId || (p.cnj_number && rawId.replace(/\D/g, "") && p.cnj_number.replace(/\D/g, "") === rawId.replace(/\D/g, ""))
    );
    if (index === -1) return undefined;

    const current = state.processes[index];
    const oldActive = current.active_pole || "Parte Autora";
    const oldPassive = current.passive_pole || "Parte Ré";

    const updated: LawProcess = {
      ...current,
      active_pole: oldPassive,
      passive_pole: oldActive,
      party_position: current.party_position === "ativo" ? "passivo" : current.party_position === "passivo" ? "ativo" : current.party_position,
      last_movement: `${new Date().toLocaleDateString("pt-BR")} - Inversão de polos processuais registrada`,
      updated_at: new Date().toISOString(),
    };

    state.processes[index] = updated;
    saveLocalState(state);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`escavador_imported_${updated.id}`, JSON.stringify(updated));
        if (updated.cnj_number) {
          const clean = updated.cnj_number.replace(/\D/g, "");
          if (clean) localStorage.setItem(`escavador_imported_${clean}`, JSON.stringify(updated));
        }
      } catch {}
    }

    try {
      await db.from("law_processes").update({
        active_pole: updated.active_pole,
        passive_pole: updated.passive_pole,
        party_position: updated.party_position,
      }).eq("id", updated.id);
    } catch {}

    return updated;
  },

  async addProcessResource(
    parentId: string,
    resourceData: Omit<LawProcessResource, "id" | "created_at">
  ): Promise<LawProcessResource> {
    const newResource: LawProcessResource = {
      ...resourceData,
      id: "res-" + Math.random().toString(36).substring(2, 9),
      parent_process_id: parentId,
      created_at: new Date().toISOString(),
    };

    const state = getLocalState();
    const index = state.processes.findIndex(
      (p: LawProcess) => p.id === parentId || p.cnj_number === parentId || (p.cnj_number && parentId.replace(/\D/g, "") && p.cnj_number.replace(/\D/g, "") === parentId.replace(/\D/g, ""))
    );

    if (index !== -1) {
      const currentProc = state.processes[index];
      const existingResources = currentProc.resources || [];
      const updatedResources = [newResource, ...existingResources];
      state.processes[index] = {
        ...currentProc,
        resources: updatedResources,
        updated_at: new Date().toISOString(),
      };
      saveLocalState(state);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`escavador_imported_${currentProc.id}`, JSON.stringify(state.processes[index]));
        } catch {}
      }
    }

    // Persistência complementar no localStorage por chave de recurso
    if (typeof window !== "undefined") {
      try {
        const storeKey = `lawhub_resources_${parentId}`;
        const currentList = JSON.parse(localStorage.getItem(storeKey) || "[]");
        localStorage.setItem(storeKey, JSON.stringify([newResource, ...currentList]));
      } catch {}
    }

    return newResource;
  },

  getProcessResources(parentId: string): LawProcessResource[] {
    const state = getLocalState();
    const proc = state.processes.find(
      (p: LawProcess) => p.id === parentId || p.cnj_number === parentId || (p.cnj_number && parentId.replace(/\D/g, "") && p.cnj_number.replace(/\D/g, "") === parentId.replace(/\D/g, ""))
    );

    const memoryResources = proc?.resources || [];
    let storedResources: LawProcessResource[] = [];
    if (typeof window !== "undefined") {
      try {
        storedResources = JSON.parse(localStorage.getItem(`lawhub_resources_${parentId}`) || "[]");
      } catch {}
    }

    const map = new Map<string, LawProcessResource>();
    [...memoryResources, ...storedResources].forEach((r) => {
      if (r && r.id && !map.has(r.id)) {
        map.set(r.id, r);
      }
    });

    return Array.from(map.values());
  },

  async deleteProcessResource(parentId: string, resourceId: string): Promise<boolean> {
    const state = getLocalState();
    const index = state.processes.findIndex(
      (p: LawProcess) => p.id === parentId || p.cnj_number === parentId || (p.cnj_number && parentId.replace(/\D/g, "") && p.cnj_number.replace(/\D/g, "") === parentId.replace(/\D/g, ""))
    );

    if (index !== -1) {
      const currentProc = state.processes[index];
      const filtered = (currentProc.resources || []).filter((r) => r.id !== resourceId);
      state.processes[index] = {
        ...currentProc,
        resources: filtered,
        updated_at: new Date().toISOString(),
      };
      saveLocalState(state);
    }

    if (typeof window !== "undefined") {
      try {
        const storeKey = `lawhub_resources_${parentId}`;
        const currentList: LawProcessResource[] = JSON.parse(localStorage.getItem(storeKey) || "[]");
        localStorage.setItem(storeKey, JSON.stringify(currentList.filter((r) => r.id !== resourceId)));
      } catch {}
    }

    return true;
  },

  // Central de Buscas & Resultados de Consulta
  async getSearchBatches(): Promise<ProcessSearchBatch[]> {
    const state = getLocalState();
    return state.searchBatches || INITIAL_SEARCH_BATCHES;
  },

  async getSearchResults(batchId?: string): Promise<ProcessSearchResultItem[]> {
    const state = getLocalState();
    const all = state.searchResults || INITIAL_SEARCH_RESULTS;
    if (batchId) {
      return all.filter((item: any) => item.batchId === batchId);
    }
    return all;
  },

  async deleteSearchResult(searchId: string): Promise<boolean> {
    const state = getLocalState();
    const prevList: ProcessSearchResultItem[] = state.searchResults || INITIAL_SEARCH_RESULTS;
    state.searchResults = prevList.filter((item) => item.id !== searchId);
    saveLocalState(state);
    return true;
  },

  async deleteSearchResultsBatch(searchIds: string[]): Promise<number> {
    const state = getLocalState();
    const prevList: ProcessSearchResultItem[] = state.searchResults || INITIAL_SEARCH_RESULTS;
    state.searchResults = prevList.filter((item) => !searchIds.includes(item.id));
    saveLocalState(state);
    return searchIds.length;
  },

  async includeSearchResultDirectly(searchId: string): Promise<LawProcess | undefined> {
    const state = getLocalState();
    const all = state.searchResults || INITIAL_SEARCH_RESULTS;
    const searchItem = all.find((s: any) => s.id === searchId);
    if (!searchItem) return undefined;

    const newProc: LawProcess = {
      id: "proc-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      record_type: "processo",
      cnj_number: searchItem.cnj,
      court: searchItem.court,
      judicial_branch: searchItem.vara || `${searchItem.court} - Vara Cível`,
      judicial_district: searchItem.comarca || "Teresina",
      instance: searchItem.instance || "1grau",
      procedural_class: searchItem.classe || "Procedimento Comum Cível",
      title: searchItem.title,
      active_pole: searchItem.autor || "Parte Ativa",
      passive_pole: searchItem.reu || "Parte Passiva",
      party_position: "ativo",
      client_name: searchItem.autor || "Cliente do Escritório",
      case_value: searchItem.caseValue || 0,
      responsible_name: "",
      monitoring_type: "automatico",
      court_linked: true,
      court_sync_system: "DataJud / PJe",
      status: "em_andamento",
      last_movement: searchItem.lastMovement || "Processo importado via busca em lote",
      tags: ["Importado em Lote", searchItem.court],
      created_at: new Date().toISOString(),
    };

    state.processes = [newProc, ...state.processes];
    state.searchResults = all.map((s: any) =>
      s.id === searchId ? { ...s, status: "sincronizado" as const } : s
    );
    saveLocalState(state);
    return newProc;
  },

  async includeSearchResultsBatch(searchIds: string[]): Promise<number> {
    let count = 0;
    for (const id of searchIds) {
      const res = await this.includeSearchResultDirectly(id);
      if (res) count++;
    }
    return count;
  },

  async clearAllSearchResults(): Promise<boolean> {
    const state = getLocalState();
    state.searchResults = [];
    saveLocalState(state);
    return true;
  },

  async addSearchResult(item: Omit<ProcessSearchResultItem, "id">): Promise<ProcessSearchResultItem> {
    const newItem: ProcessSearchResultItem = {
      ...item,
      id: "search-" + Math.random().toString(36).substring(2, 9),
    };
    const state = getLocalState();
    state.searchResults = [newItem, ...(state.searchResults || INITIAL_SEARCH_RESULTS)];
    saveLocalState(state);
    return newItem;
  },

  checkDuplicateCNJ(cnjNumber: string): LawProcess | undefined {
    const cleanDigits = cnjNumber.replace(/\D/g, "");
    if (!cleanDigits) return undefined;
    const localProcesses = getLocalState().processes;
    return localProcesses.find((p: LawProcess) => {
      const pDigits = (p.cnj_number || "").replace(/\D/g, "");
      return pDigits === cleanDigits;
    });
  },

  async linkProcessToCourt(
    processId: string,
    courtData: {
      court?: string;
      judicial_branch?: string;
      judicial_district?: string;
      procedural_class?: string;
      active_pole?: string;
      passive_pole?: string;
      movements?: Array<{ id?: string; date: string; text: string; instance?: string }>;
      last_movement?: string;
      court_sync_system?: string;
    }
  ): Promise<LawProcess | undefined> {
    const state = getLocalState();
    const index = state.processes.findIndex((p: LawProcess) => p.id === processId);
    if (index === -1) return undefined;

    const current = state.processes[index];
    const updated: LawProcess = {
      ...current,
      court: courtData.court || current.court,
      judicial_branch: courtData.judicial_branch || current.judicial_branch,
      judicial_district: courtData.judicial_district || current.judicial_district,
      procedural_class: courtData.procedural_class || current.procedural_class,
      active_pole: current.active_pole || courtData.active_pole || "Autor",
      passive_pole: current.passive_pole || courtData.passive_pole || "Réu",
      last_movement: courtData.last_movement || current.last_movement || "Vinculado ao tribunal",
      movements: courtData.movements && courtData.movements.length > 0 ? courtData.movements : current.movements,
      monitoring_type: "automatico",
      court_linked: true,
      court_sync_system: courtData.court_sync_system || "DataJud / PJe",
      updated_at: new Date().toISOString(),
    };

    state.processes[index] = updated;
    state.activities = [
      {
        id: "act-" + Date.now(),
        type: "processo",
        title: "Processo vinculado ao tribunal",
        description: `CNJ ${updated.cnj_number} vinculado para monitoramento automático`,
        timestamp: "Agora mesmo",
      },
      ...state.activities,
    ];
    saveLocalState(state);

    try {
      await db.from("law_processes").update(updated).eq("id", processId);
    } catch {}

    return updated;
  },

  // Desvincular processo individual do tribunal
  async unlinkProcessFromCourt(processId: string): Promise<LawProcess | undefined> {
    const state = getLocalState();
    const index = state.processes.findIndex((p: LawProcess) => p.id === processId);
    if (index === -1) return undefined;

    const current = state.processes[index];
    const today = new Date().toLocaleDateString("pt-BR");
    const updated: LawProcess = {
      ...current,
      monitoring_type: "manual",
      court_linked: false,
      court_sync_system: "Manual",
      last_movement: `${today} - Desvinculado do tribunal (monitoramento automático suspenso)`,
      movements: [
        {
          id: "mov-" + Date.now(),
          date: today,
          text: "Processo desvinculado do tribunal. Monitoramento alterado para manual a pedido do usuário.",
          instance: current.instance === "2grau" ? "2º Grau" : "1º Grau",
        },
        ...(current.movements || []),
      ],
      updated_at: new Date().toISOString(),
    };

    state.processes[index] = updated;
    state.activities = [
      {
        id: "act-" + Date.now(),
        type: "processo",
        title: "Processo desvinculado do tribunal",
        description: `CNJ ${current.cnj_number || current.title} desvinculado do monitoramento automático`,
        timestamp: "Agora mesmo",
      },
      ...(state.activities || []),
    ];
    saveLocalState(state);

    try {
      await db.from("law_processes").update(updated).eq("id", processId);
    } catch {}

    return updated;
  },

  // Configurar Modalidade de Radar do Processo (Oficial DataJud vs Avançado Escavador vs Manual)
  async configureProcessRadar(
    processId: string,
    radarType: "datajud" | "escavador" | "manual"
  ): Promise<LawProcess | undefined> {
    const state = getLocalState();
    const index = state.processes.findIndex((p: LawProcess) => p.id === processId);
    if (index === -1) return undefined;

    const current = state.processes[index];
    const today = new Date().toLocaleDateString("pt-BR");

    let updated: LawProcess;

    if (radarType === "escavador") {
      updated = {
        ...current,
        monitoring_type: "automatico",
        court_linked: true,
        radar_provider: "escavador",
        radar_cost_label: "1 Crédito / Mês",
        court_sync_system: "Escavador API v2",
        last_movement: `${today} - Radar Avançado Escavador ativado (1 crédito/mês alocado)`,
        movements: [
          {
            id: "mov-" + Date.now(),
            date: today,
            text: "Modalidade de radar atualizada para: Radar Avançado Escavador (Monitoramento Profundo em 450+ Diários, Webhooks de alta frequência e Datalake retroativo).",
            instance: current.instance === "2grau" ? "2º Grau" : "1º Grau",
          },
          ...(current.movements || []),
        ],
        updated_at: new Date().toISOString(),
      };
    } else if (radarType === "datajud") {
      updated = {
        ...current,
        monitoring_type: "automatico",
        court_linked: true,
        radar_provider: "datajud",
        radar_cost_label: "Incluso no Plano",
        court_sync_system: "DataJud / PJe",
        last_movement: `${today} - Radar Oficial DataJud & DJEN ativado (Incluso no plano)`,
        movements: [
          {
            id: "mov-" + Date.now(),
            date: today,
            text: "Modalidade de radar atualizada para: Radar Oficial DataJud & DJEN (Varredura diária no Diário de Justiça Eletrônico Nacional e CNJ sem consumo de créditos).",
            instance: current.instance === "2grau" ? "2º Grau" : "1º Grau",
          },
          ...(current.movements || []),
        ],
        updated_at: new Date().toISOString(),
      };
    } else {
      updated = {
        ...current,
        monitoring_type: "manual",
        court_linked: false,
        radar_provider: "none",
        radar_cost_label: "Sem Radar",
        court_sync_system: "Manual",
        last_movement: `${today} - Radar desativado (Acompanhamento manual)`,
        movements: [
          {
            id: "mov-" + Date.now(),
            date: today,
            text: "Radar automático desativado. Processo mantido em acompanhamento manual da banca.",
            instance: current.instance === "2grau" ? "2º Grau" : "1º Grau",
          },
          ...(current.movements || []),
        ],
        updated_at: new Date().toISOString(),
      };
    }

    state.processes[index] = updated;
    state.activities = [
      {
        id: "act-" + Date.now(),
        type: "processo",
        title: "Modalidade de radar atualizada",
        description: `Processo ${updated.cnj_number || updated.title} configurado para: ${
          radarType === "escavador"
            ? "Radar Avançado Escavador (Token)"
            : radarType === "datajud"
            ? "Radar Oficial DataJud (Incluso)"
            : "Acompanhamento Manual"
        }`,
        timestamp: "Agora mesmo",
      },
      ...(state.activities || []),
    ];
    saveLocalState(state);

    try {
      await db.from("law_processes").update(updated).eq("id", processId);
    } catch {}

    return updated;
  },

  // Desvincular múltiplos processos em lote
  async unlinkProcessesBatch(processIds: string[]): Promise<number> {
    let count = 0;
    for (const id of processIds) {
      const res = await this.unlinkProcessFromCourt(id);
      if (res) count++;
    }
    return count;
  },

  // Vincular múltiplos processos em lote pelo número CNJ
  async linkProcessesBatchByCNJ(processIds: string[]): Promise<{ count: number; updated: LawProcess[] }> {
    const state = getLocalState();
    const today = new Date().toLocaleDateString("pt-BR");
    const updatedList: LawProcess[] = [];

    // Tabela auxiliar de detecção de tribunal por CNJ: J.TR
    const detectCourtFromCNJ = (cnj: string): string => {
      const clean = cnj.replace(/\D/g, "");
      if (clean.length < 20) return "TJPI";
      const jtr = clean.substring(13, 16); // J.TR
      switch (jtr) {
        case "818": return "TJPI";
        case "826": return "TJSP";
        case "819": return "TJRJ";
        case "522": return "TRT22";
        case "502": return "TRT2";
        case "401": return "TRF1";
        case "403": return "TRF3";
        case "100": return "STF";
        case "300": return "STJ";
        default: return "TJPI";
      }
    };

    for (const id of processIds) {
      const index = state.processes.findIndex((p: LawProcess) => p.id === id);
      if (index === -1) continue;

      const current = state.processes[index];
      const courtName = current.court && current.court !== "Extrajudicial" ? current.court : detectCourtFromCNJ(current.cnj_number || "");
      
      const updated: LawProcess = {
        ...current,
        monitoring_type: "automatico",
        court_linked: true,
        court: courtName,
        court_sync_system: "DataJud / PJe",
        last_movement: `${today} - Vinculado ao tribunal por número CNJ`,
        movements: [
          {
            id: "mov-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5),
            date: today,
            text: `Processo vinculado ao tribunal ${courtName} por consulta automática de CNJ no DataJud. Monitoramento automático ativado.`,
            instance: current.instance === "2grau" ? "2º Grau" : "1º Grau",
          },
          ...(current.movements || []),
        ],
        updated_at: new Date().toISOString(),
      };

      state.processes[index] = updated;
      updatedList.push(updated);

      try {
        await db.from("law_processes").update(updated).eq("id", id);
      } catch {}
    }

    if (updatedList.length > 0) {
      state.activities = [
        {
          id: "act-" + Date.now(),
          type: "processo",
          title: "Vinculação em lote por CNJ realizada",
          description: `${updatedList.length} processo(s) vinculado(s) ao radar oficial de tribunais`,
          timestamp: "Agora mesmo",
        },
        ...(state.activities || []),
      ];
      saveLocalState(state);
    }

    return { count: updatedList.length, updated: updatedList };
  },

  // Vincular múltiplos processos em lote por seleção de órgão / tribunal
  async linkProcessesBatchByCourt(
    processIds: string[],
    courtData: {
      court: string;
      judicial_branch?: string;
      instance?: "1grau" | "2grau" | "superior";
      court_sync_system?: string;
    }
  ): Promise<number> {
    const state = getLocalState();
    const today = new Date().toLocaleDateString("pt-BR");
    let count = 0;

    for (const id of processIds) {
      const index = state.processes.findIndex((p: LawProcess) => p.id === id);
      if (index === -1) continue;

      const current = state.processes[index];
      const updated: LawProcess = {
        ...current,
        court: courtData.court,
        judicial_branch: courtData.judicial_branch || current.judicial_branch || `${courtData.court} - Vara Cível`,
        instance: courtData.instance || current.instance || "1grau",
        monitoring_type: "automatico",
        court_linked: true,
        court_sync_system: courtData.court_sync_system || "DataJud / PJe",
        last_movement: `${today} - Vinculado ao tribunal ${courtData.court}`,
        movements: [
          {
            id: "mov-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5),
            date: today,
            text: `Processo vinculado ao órgão ${courtData.court} (${courtData.court_sync_system || "DataJud / PJe"}). Monitoramento ativado.`,
            instance: courtData.instance === "2grau" ? "2º Grau" : "1º Grau",
          },
          ...(current.movements || []),
        ],
        updated_at: new Date().toISOString(),
      };

      state.processes[index] = updated;
      count++;

      try {
        await db.from("law_processes").update(updated).eq("id", id);
      } catch {}
    }

    if (count > 0) {
      state.activities = [
        {
          id: "act-" + Date.now(),
          type: "processo",
          title: "Vinculação em lote por órgão realizada",
          description: `${count} processo(s) vinculado(s) ao órgão ${courtData.court}`,
          timestamp: "Agora mesmo",
        },
        ...(state.activities || []),
      ];
      saveLocalState(state);
    }

    return count;
  },

  // Documentos do Acervo
  getDocuments(processIdOrCnj?: string): LawDocument[] {
    const state = getLocalState();
    const docs: LawDocument[] = state.documents || [];
    const cleanDigits = processIdOrCnj ? processIdOrCnj.replace(/\D/g, "") : undefined;

    const seen = new Set<string>();
    return docs
      .filter((d: any) => {
        if (!d) return false;
        if (d.id === "doc-cda-uniao-01" || d.id === "doc-pet-inicial" || String(d.id).includes("cda-uniao")) return false;
        if (d.title?.includes("Dossiê") || d.category === "Dossiê Completo") return false;
        if (d.title?.includes("Certidão de Dívida Ativa") || d.title?.includes("Petição Inicial Execução Fiscal")) return false;

        if (processIdOrCnj) {
          const matches =
            d.process_id === processIdOrCnj ||
            d.process_cnj === processIdOrCnj ||
            (cleanDigits && d.process_cnj?.replace(/\D/g, "") === cleanDigits);
          if (!matches) return false;
        }

        const rawId = String(d.id || "").replace(/^doc-/, "");
        const key = rawId || `${d.process_cnj}_${d.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((d: any) => {
        if (d.title?.includes("470443987") || String(d.id).includes("470443987")) {
          return {
            ...d,
            date: "18/09/2026",
            created_at: "2026-09-18T14:00:00.000Z",
            file_size: "480 KB",
            created_by: "Escavador Sync",
          };
        }
        return d;
      });
  },

  addDocument(doc: Partial<LawDocument> & { id?: string }): LawDocument {
    const docDate = doc.date || (doc.title?.includes("470443987") || String(doc.id).includes("470443987") ? "18/09/2026" : "18/09/2026");
    const newDoc: LawDocument = {
      ...doc,
      id: doc.id || "doc-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      title: doc.title || doc.name || "Peça Processual",
      name: doc.name || doc.title || "Peça Processual",
      date: docDate,
      created_at: doc.created_at || (docDate.includes("/")
        ? `${docDate.split("/")[2]}-${docDate.split("/")[1]}-${docDate.split("/")[0]}T14:00:00.000Z`
        : "2026-09-18T14:00:00.000Z"),
      created_by: doc.created_by || "Escavador Sync",
    };
    const state = getLocalState();
    if (!state.documents) state.documents = [];

    const rawNewId = String(newDoc.id || "").replace(/^doc-/, "");
    const existingIndex = state.documents.findIndex((d: any) => {
      if (!d) return false;
      const rawExistingId = String(d.id || "").replace(/^doc-/, "");
      if (rawExistingId && rawExistingId === rawNewId) return true;
      if (d.id === newDoc.id) return true;
      if (d.process_cnj && newDoc.process_cnj && d.process_cnj === newDoc.process_cnj && (d.title === newDoc.title || d.name === newDoc.name)) return true;
      return false;
    });

    if (existingIndex >= 0) {
      state.documents[existingIndex] = { ...state.documents[existingIndex], ...newDoc };
    } else {
      state.documents.unshift(newDoc);
    }
    saveLocalState(state);
    return newDoc;
  },

  deleteDocument(id: string): boolean {
    const state = getLocalState();
    if (!state.documents || state.documents.length === 0) return false;
    const initialLen = state.documents.length;
    state.documents = state.documents.filter((d: any) => d && d.id !== id);
    if (state.documents.length !== initialLen) {
      saveLocalState(state);
      return true;
    }
    return false;
  },

  // Prazos
  async getDeadlines(): Promise<LawDeadline[]> {
    try {
      const { data, error } = await db.from("law_deadlines").select("*").order("deadline_date", { ascending: true });
      if (!error && data && data.length > 0) {
        return data as LawDeadline[];
      }
    } catch {}
    return getLocalState().deadlines;
  },

  async createDeadline(deadlineData: Omit<LawDeadline, "id" | "created_at">): Promise<LawDeadline> {
    const newDeadline: LawDeadline = {
      ...deadlineData,
      id: generateValidUUID(),
      created_at: new Date().toISOString(),
    };

    try {
      await db.from("law_deadlines").insert(newDeadline);
    } catch {}

    const state = getLocalState();
    state.deadlines = [newDeadline, ...state.deadlines];
    saveLocalState(state);
    return newDeadline;
  },

  async updateDeadlineStatus(
    deadlineId: string,
    status: DeadlineStatus,
    metadata?: { completion_protocol?: string; completion_notes?: string }
  ): Promise<void> {
    const updatePayload: Record<string, any> = {
      status,
      completed_at: status === "cumprido" ? new Date().toISOString() : null,
    };
    if (metadata?.completion_protocol !== undefined) {
      updatePayload.completion_protocol = metadata.completion_protocol;
    }
    if (metadata?.completion_notes !== undefined) {
      updatePayload.completion_notes = metadata.completion_notes;
    }

    try {
      await db.from("law_deadlines").update(updatePayload).eq("id", deadlineId);
    } catch {}

    const state = getLocalState();
    const idx = state.deadlines.findIndex((d) => d.id === deadlineId);
    if (idx !== -1) {
      state.deadlines[idx].status = status;
      if (status === "cumprido") {
        state.deadlines[idx].completed_at = new Date().toISOString();
        if (metadata?.completion_protocol) {
          state.deadlines[idx].completion_protocol = metadata.completion_protocol;
        }
        if (metadata?.completion_notes) {
          state.deadlines[idx].completion_notes = metadata.completion_notes;
        }
      } else {
        delete state.deadlines[idx].completed_at;
      }
      saveLocalState(state);
    }
  },

  // Listas de Tarefas Padrão
  getDefaultTaskLists(): LawTaskList[] {
    return [
      { id: "peticoes", name: "Petições e Peças", color: "#2563eb", is_default: true, is_active: true },
      { id: "diligencias", name: "Diligências e Cartório", color: "#ea580c", is_active: true },
      { id: "consultivo", name: "Consultivo e Contratos", color: "#9333ea", is_active: true },
      { id: "atendimento", name: "Atendimento ao Cliente", color: "#16a34a", is_active: true },
      { id: "administrativo", name: "Administrativo & Gestão", color: "#64748b", is_active: true },
    ];
  },

  getTaskLists(): LawTaskList[] {
    if (typeof window === "undefined") return this.getDefaultTaskLists();
    try {
      const stored = localStorage.getItem("lawhub_task_lists");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const defaults = this.getDefaultTaskLists();
    try {
      localStorage.setItem("lawhub_task_lists", JSON.stringify(defaults));
    } catch {}
    return defaults;
  },

  saveTaskList(list: LawTaskList): void {
    if (typeof window === "undefined") return;
    try {
      const lists = this.getTaskLists();
      const idx = lists.findIndex((l) => l.id === list.id);
      if (idx >= 0) {
        lists[idx] = list;
      } else {
        lists.push(list);
      }
      localStorage.setItem("lawhub_task_lists", JSON.stringify(lists));
      window.dispatchEvent(new CustomEvent("lawhub_task_lists_updated"));
    } catch {}
  },

  deleteTaskList(listId: string): void {
    if (typeof window === "undefined") return;
    try {
      const lists = this.getTaskLists().filter((l) => l.id !== listId && !l.is_default);
      localStorage.setItem("lawhub_task_lists", JSON.stringify(lists));
      window.dispatchEvent(new CustomEvent("lawhub_task_lists_updated"));
    } catch {}
  },

  // Tarefas Iniciais Enriquecidas
  getDefaultTasks(): LawTask[] {
    return [];
  },

  // Métodos de Tarefas
  async getTasks(): Promise<LawTask[]> {
    if (typeof window === "undefined") return this.getDefaultTasks();
    try {
      const stored = localStorage.getItem("lawhub_tasks");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as LawTask[];
        }
      }
    } catch {}

    const defaults = this.getDefaultTasks();
    try {
      localStorage.setItem("lawhub_tasks", JSON.stringify(defaults));
    } catch {}
    return defaults;
  },

  async createTask(taskData: Omit<LawTask, "id" | "created_at">): Promise<LawTask> {
    const newTask: LawTask = {
      ...taskData,
      id: "task-" + Math.random().toString(36).substring(2, 9),
      checklist: taskData.checklist || [],
      comments: taskData.comments || [],
      tags: taskData.tags || [],
      created_at: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      try {
        const current = await this.getTasks();
        const updated = [newTask, ...current];
        localStorage.setItem("lawhub_tasks", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("lawhub_tasks_updated"));
      } catch {}
    }
    return newTask;
  },

  async updateTask(task: LawTask): Promise<LawTask> {
    if (typeof window !== "undefined") {
      try {
        const current = await this.getTasks();
        const idx = current.findIndex((t) => t.id === task.id);
        if (idx >= 0) {
          current[idx] = task;
        } else {
          current.unshift(task);
        }
        localStorage.setItem("lawhub_tasks", JSON.stringify(current));
        window.dispatchEvent(new CustomEvent("lawhub_tasks_updated"));
      } catch {}
    }
    return task;
  },

  async deleteTask(taskId: string): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        const current = await this.getTasks();
        const updated = current.filter((t) => t.id !== taskId);
        localStorage.setItem("lawhub_tasks", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("lawhub_tasks_updated"));
      } catch {}
    }
  },

  async toggleTaskStatus(taskId: string, newStatus?: TaskStatus): Promise<LawTask | undefined> {
    if (typeof window === "undefined") return undefined;
    try {
      const current = await this.getTasks();
      const task = current.find((t) => t.id === taskId);
      if (!task) return undefined;

      if (newStatus) {
        task.status = newStatus;
      } else {
        task.status = task.status === "concluida" ? "pendente" : "concluida";
      }

      if (task.status === "concluida") {
        task.completed_at = new Date().toISOString();
      } else {
        delete task.completed_at;
      }

      localStorage.setItem("lawhub_tasks", JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("lawhub_tasks_updated"));
      return task;
    } catch {
      return undefined;
    }
  },

  async toggleChecklistItem(taskId: string, itemId: string): Promise<LawTask | undefined> {
    if (typeof window === "undefined") return undefined;
    try {
      const current = await this.getTasks();
      const task = current.find((t) => t.id === taskId);
      if (!task || !task.checklist) return undefined;

      const item = task.checklist.find((c) => c.id === itemId);
      if (item) {
        item.done = !item.done;
      }

      localStorage.setItem("lawhub_tasks", JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("lawhub_tasks_updated"));
      return task;
    } catch {
      return undefined;
    }
  },

  async addTaskComment(taskId: string, text: string, author?: string): Promise<LawTask | undefined> {
    if (typeof window === "undefined") return undefined;
    try {
      const current = await this.getTasks();
      const task = current.find((t) => t.id === taskId);
      if (!task) return undefined;

      if (!task.comments) task.comments = [];
      const newComment: LawTaskComment = {
        id: "cmt-" + Math.random().toString(36).substring(2, 9),
        author: author || "Usuário autenticado",
        text,
        created_at: new Date().toISOString(),
      };
      task.comments.push(newComment);

      localStorage.setItem("lawhub_tasks", JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("lawhub_tasks_updated"));
      return task;
    } catch {
      return undefined;
    }
  },

  // Templates de Workflows Jurídicos Pré-configurados (Workflows & Checklists)
  getWorkflowTemplates(): LawWorkflowTemplate[] {
    return [
      {
        id: "wf-ajuizamento-civel",
        title: "Ajuizamento de Ação Cível / Trabalhista",
        description: "Fluxo padrão de 5 etapas completas para ajuizamento de novas ações, com coleta de procuração, análise de provas, redação e protocolo.",
        category: "Cível",
        target_type: "processo",
        estimated_days: 7,
        steps: [
          {
            id: "step-1",
            title: "Entrevista inicial e coleta de documentação probatória",
            type: "atendimento",
            days_from_start: 1,
            priority: "alta",
            description: "Atendimento formal para colher procuração assinada, declaração de hipossuficiência se aplicável, e documentos.",
            default_checklist: [
              "Procuração e termo de consentimento LGPD assinados",
              "Documentos pessoais e comprovante de residência atualizado",
              "Dossiê de provas materiais (contratos, comprovantes de pagamento, conversas de WhatsApp)",
            ],
          },
          {
            id: "step-2",
            title: "Análise de viabilidade jurídica e cálculo do valor da causa",
            type: "consultivo",
            days_from_start: 3,
            priority: "media",
            description: "Pesquisa de precedentes qualificados e jurisprudência vinculante; liquidação de pedidos.",
            default_checklist: [
              "Pesquisa de teses e jurisprudência recente nos tribunais superiores",
              "Planilha de liquidação aritmética de todos os pedidos",
              "Definição da competência territorial e funcional do juízo",
            ],
          },
          {
            id: "step-3",
            title: "Elaboração da Minuta da Petição Inicial",
            type: "peticao",
            days_from_start: 5,
            priority: "urgente",
            description: "Redação dos fatos, fundamentação jurídica e pedidos de tutela provisória de urgência.",
            default_checklist: [
              "Qualificação completa das partes com polo ativo e passivo",
              "Fundamentação legal e precedentes correlatos",
              "Capítulo de tutela provisória de urgência se houver periculum in mora",
              "Rol de pedidos com valor discriminado de cada pleito",
            ],
          },
          {
            id: "step-4",
            title: "Revisão sênior da inicial e conferência de custas",
            type: "diligencia",
            days_from_start: 6,
            priority: "alta",
            description: "Validação final das teses com o sócio responsável e emissão de guias de custas judiciais.",
            default_checklist: [
              "Revisão técnica de prazos prescricionais e decadenciais",
              "Emissão e pagamento da Guia de Recolhimento do TJ / TRT",
              "Assinatura digital da peça pelo advogado patrono",
            ],
          },
          {
            id: "step-5",
            title: "Protocolo eletrônico no PJe / e-SAJ e aviso ao cliente",
            type: "prazo",
            days_from_start: 7,
            priority: "urgente",
            description: "Distribuição da ação no sistema judicial competente e envio do recibo de protocolo ao cliente.",
            default_checklist: [
              "Juntada de arquivos em PDF indexados conforme padrão do tribunal",
              "Download do comprovante de protocolo e certidão de distribuição",
              "Envio de mensagem ao cliente informando número de processo e vara",
            ],
          },
        ],
      },
      {
        id: "wf-contestacao",
        title: "Defesa e Contestação com Preliminares de Mérito",
        description: "Fluxo de defesa rigoroso para atender ao prazo peremptório de 15 dias úteis do art. 335 do CPC.",
        category: "Cível",
        target_type: "processo",
        estimated_days: 12,
        steps: [
          {
            id: "step-c1",
            title: "Análise da citação e fixação do prazo fatal",
            type: "prazo",
            days_from_start: 1,
            priority: "urgente",
            description: "Anotação da juntada do aviso de recebimento (AR) ou mandado cumprido e cálculo do termo final.",
            default_checklist: [
              "Cálculo exato pelo motor CPC (dias úteis, feriados e recesso)",
              "Anotação do prazo fatal na agenda com alerta em 48h",
            ],
          },
          {
            id: "step-c2",
            title: "Contato com o cliente e levantamento de subsídios defensivos",
            type: "atendimento",
            days_from_start: 4,
            priority: "alta",
            description: "Coleta das versões dos fatos, contradições da inicial e documentos comprobatórios de quitação.",
            default_checklist: [
              "Envio do questionário defensivo para o cliente responder em 48h",
              "Coleta de comprovantes de pagamento e registros de e-mail",
              "Indicação do rol de testemunhas defensivas",
            ],
          },
          {
            id: "step-c3",
            title: "Redação da Contestação e Preliminares",
            type: "peticao",
            days_from_start: 8,
            priority: "urgente",
            description: "Construção de preliminares processuais e impugnação específica fática e probatória.",
            default_checklist: [
              "Preliminares do art. 337 do CPC (incompetência, ilegitimidade, inépcia)",
              "Impugnação pormenorizada de cada alegação da inicial",
              "Eventual pedido de reconvenção do art. 343 do CPC",
            ],
          },
          {
            id: "step-c4",
            title: "Revisão e Protocolo Tempestivo nos Autos",
            type: "peticao",
            days_from_start: 12,
            priority: "urgente",
            description: "Protocolo nos autos com emissão do recibo judicial definitivo.",
            default_checklist: [
              "Revisão final de procuração e atos constitutivos",
              "Protocolo no sistema eletrônico",
              "Registro do cumprimento do prazo fatal",
            ],
          },
        ],
      },
      {
        id: "wf-fase-recursal",
        title: "Fase Recursal (Apelação / Agravo de Instrumento)",
        description: "Gestão completa de prazos de recursos com controle de preparo recursal, dialeticidade e julgamento.",
        category: "Cível",
        target_type: "processo",
        estimated_days: 10,
        steps: [
          {
            id: "step-r1",
            title: "Análise da decisão/sentença e verificação de cabimento recursal",
            type: "consultivo",
            days_from_start: 1,
            priority: "urgente",
            description: "Identificação de contradições, omissões ou erros de julgamento passíveis de reforma.",
            default_checklist: [
              "Avaliação de cabimento prévio de embargos de declaração (5 dias)",
              "Definição do recurso adequado (Apelação, Agravo ou Recurso Ordinário)",
            ],
          },
          {
            id: "step-r2",
            title: "Cálculo e recolhimento das custas de preparo e porte de remessa",
            type: "diligencia",
            days_from_start: 3,
            priority: "alta",
            description: "Emissão das guias do Tribunal de Justiça ou Tribunal Regional.",
            default_checklist: [
              "Cálculo das custas sobre o valor da condenação / causa",
              "Pagamento das guias e juntada do comprovante original",
            ],
          },
          {
            id: "step-r3",
            title: "Elaboração das razões recursais com foco em dialeticidade",
            type: "peticao",
            days_from_start: 7,
            priority: "urgente",
            description: "Combate específico aos fundamentos da sentença combatida.",
            default_checklist: [
              "Capítulo demonstrando a tempestividade e o preparo",
              "Contraponto direto ponto a ponto da decisão recorrida",
              "Citação de precedentes qualificados e jurisprudência vinculante",
            ],
          },
          {
            id: "step-r4",
            title: "Protocolo do recurso no Tribunal e acompanhamento de relatoria",
            type: "prazo",
            days_from_start: 10,
            priority: "urgente",
            description: "Protocolo do recurso tempestivo e ativação de monitoramento de relator.",
            default_checklist: [
              "Protocolo eletrônico",
              "Monitoramento da certidão de intimação da parte contrária para contrarrazões",
            ],
          },
        ],
      },
      {
        id: "wf-cumprimento-sentenca",
        title: "Cumprimento de Sentença & Execução de Título",
        description: "Fluxo estratégico de execução com busca patrimonial, penhora online (SisbaJud/RenaJud) e intimações.",
        category: "Empresarial",
        target_type: "processo",
        estimated_days: 15,
        steps: [
          {
            id: "step-e1",
            title: "Memória discriminada e atualizada do cálculo de liquidação",
            type: "consultivo",
            days_from_start: 2,
            priority: "alta",
            description: "Aplicação dos índices determinados no título judicial (IPCA-E/Selic) e honorários sucumbenciais.",
            default_checklist: [
              "Atualização dos valores com juros legais e correção monetária",
              "Acréscimo de honorários advocatícios da fase de conhecimento",
            ],
          },
          {
            id: "step-e2",
            title: "Petição requerendo intimação para pagamento voluntário (Art. 523 CPC)",
            type: "peticao",
            days_from_start: 5,
            priority: "urgente",
            description: "Pedido de intimação do devedor com aviso da multa de 10% e honorários de 10%.",
            default_checklist: [
              "Protocolo da petição de cumprimento de sentença com cálculo anexo",
              "Monitoramento do prazo de 15 dias de pagamento voluntário",
            ],
          },
          {
            id: "step-e3",
            title: "Pedido de penhora e constrição patrimonial online (SisbaJud / RenaJud)",
            type: "diligencia",
            days_from_start: 15,
            priority: "urgente",
            description: "Decorrido o prazo in albis, peticionar requerendo penhora teimosinha via SisbaJud e veículos.",
            default_checklist: [
              "Certificação do decurso de prazo sem pagamento espontâneo",
              "Petição de constrição patrimonial com reiteração automática de bloqueio",
            ],
          },
        ],
      },
      {
        id: "wf-due-diligence",
        title: "Due Diligence & Diagnóstico Jurídico (Consultivo)",
        description: "Auditoria jurídica para compra e venda de empresas, imóveis de alto padrão ou reestruturação societária.",
        category: "Consultivo",
        target_type: "caso",
        estimated_days: 14,
        steps: [
          {
            id: "step-d1",
            title: "Levantamento de certidões fiscais, cíveis e trabalhistas (CNDs)",
            type: "diligencia",
            days_from_start: 3,
            priority: "media",
            description: "Emissão de certidões em todas as esferas públicas e cartórios de protesto.",
            default_checklist: [
              "Certidão Negativa de Débitos da Receita Federal e PGFN",
              "Certidão Negativa de Débitos Trabalhistas (CNDT)",
              "Certidões de Distribuição Cível e Criminal estaduais e federais",
            ],
          },
          {
            id: "step-d2",
            title: "Auditoria do passivo processual e classificação de risco",
            type: "consultivo",
            days_from_start: 7,
            priority: "alta",
            description: "Classificação das contingências judiciais em perda provável, possível ou remota.",
            default_checklist: [
              "Planilha de contingências processuais ativas",
              "Cálculo do passivo estimado e provisões necessárias",
            ],
          },
          {
            id: "step-d3",
            title: "Análise de contratos vigentes, garantias e riscos societários",
            type: "consultivo",
            days_from_start: 10,
            priority: "alta",
            description: "Auditoria de cláusulas de exclusividade, non-compete e garantias reais.",
            default_checklist: [
              "Exame de contratos com fornecedores e clientes estratégicos",
              "Verificação de ônus reais sobre bens do ativo fixo",
            ],
          },
          {
            id: "step-d4",
            title: "Emissão do Parecer Jurídico Final e Relatório de Riscos",
            type: "peticao",
            days_from_start: 14,
            priority: "urgente",
            description: "Apresentação executiva aos sócios ou investidores com medidas de mitigação.",
            default_checklist: [
              "Redação do relatório executivo de Due Diligence",
              "Reunião presencial ou virtual de entrega dos achados",
            ],
          },
        ],
      },
    ];
  },

  // Aplicação de Workflow a um Processo ou Caso
  async applyWorkflowToTarget(
    templateId: string,
    targetType: "processo" | "caso",
    targetId: string,
    targetTitle: string,
    assigneeName: string,
    clientName?: string,
    processCnj?: string
  ): Promise<LawTask[]> {
    const template = this.getWorkflowTemplates().find((w) => w.id === templateId);
    if (!template) throw new Error("Template de workflow não encontrado");

    const createdTasks: LawTask[] = [];
    const baseDate = new Date();

    for (const step of template.steps) {
      const stepDate = new Date(baseDate);
      stepDate.setDate(stepDate.getDate() + step.days_from_start);
      const dueDateStr = stepDate.toISOString().split("T")[0];

      const newTaskData: Omit<LawTask, "id" | "created_at"> = {
        title: `[${template.title.split(" ")[0]}] ${step.title}`,
        description: step.description,
        list_id: step.type === "peticao" ? "peticoes" : step.type === "diligencia" ? "diligencias" : "consultivo",
        priority: step.priority,
        status: "pendente",
        due_date: dueDateStr,
        due_time: "17:00",
        process_id: targetType === "processo" ? targetId : undefined,
        process_cnj: processCnj,
        process_title: targetTitle,
        client_name: clientName || "Cliente do Escritório",
        assigned_to_name: assigneeName,
        delegated_by: "Workflow Automatizado",
        checklist: step.default_checklist.map((item, idx) => ({
          id: `chk-wf-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          text: item,
          done: false,
        })),
        comments: [
          {
            id: `cmt-wf-${Math.random().toString(36).substring(2, 6)}`,
            author: "Sistema NAVOR LawHub",
            text: `Tarefa gerada automaticamente pelo fluxo "${template.title}".`,
            created_at: new Date().toISOString(),
          },
        ],
        tags: [template.category, "Workflow"],
        is_recurring: false,
      };

      const created = await this.createTask(newTaskData);
      createdTasks.push(created);
    }

    return createdTasks;
  },

  // Exportador de Agenda Padrão iCalendar (.ics - RFC 5545)
  exportAgendaToICS(activities: LawAgendaActivity[]): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatICSDate = (dateStr: string, timeStr?: string) => {
      const cleanDate = dateStr.replace(/-/g, "");
      if (!timeStr) {
        return `${cleanDate}T090000Z`;
      }
      const [h = "09", m = "00"] = timeStr.split(":");
      return `${cleanDate}T${pad(Number(h))}${pad(Number(m))}00Z`;
    };

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//NAVOR LawHub//Agenda Juridica//PT-BR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:NAVOR LawHub - Agenda Jurídica",
      "X-WR-TIMEZONE:America/Sao_Paulo",
    ];

    const nowStr = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    activities.forEach((act) => {
      const start = formatICSDate(act.date, act.time);
      const end = formatICSDate(act.date, act.end_time || act.time);
      const summary = `[${act.type.toUpperCase()}] ${act.title.replace(/[,;\\]/g, " ")}`;
      const description = `${act.description ? act.description.replace(/\n/g, " ") : ""} Responsável: ${act.responsible_name}${act.process_cnj ? ` | Processo: ${act.process_cnj}` : ""}`.trim();
      const location = act.location || (act.is_virtual ? "Audiência Virtual / Videoconferência" : "Escritório");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${act.id}@lawhub.navor.com.br`);
      lines.push(`DTSTAMP:${nowStr}`);
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
      lines.push(`SUMMARY:${summary}`);
      if (description) lines.push(`DESCRIPTION:${description}`);
      lines.push(`LOCATION:${location}`);
      lines.push(`STATUS:${act.status === "concluida" ? "CONFIRMED" : "TENTATIVE"}`);
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  },

  // Audiências
  async getHearings(): Promise<LawHearing[]> {
    try {
      const { data, error } = await db.from("law_hearings").select("*").order("hearing_date", { ascending: true });
      if (!error && data && data.length > 0) {
        return data as LawHearing[];
      }
    } catch {}
    return getLocalState().hearings;
  },

  async createHearing(hearingData: Omit<LawHearing, "id" | "created_at">): Promise<LawHearing> {
    const newHearing: LawHearing = {
      ...hearingData,
      id: generateValidUUID(),
      created_at: new Date().toISOString(),
    };

    try {
      await db.from("law_hearings").insert(newHearing);
    } catch {}

    const state = getLocalState();
    state.hearings = [newHearing, ...state.hearings];
    saveLocalState(state);
    return newHearing;
  },

  // Financeiro
  async getFinancialEntries(): Promise<LawFinancialEntry[]> {
    try {
      const { data, error } = await db.from("law_financial_entries").select("*").order("due_date", { ascending: false });
      if (!error && data && data.length > 0) {
        return data as LawFinancialEntry[];
      }
    } catch {}
    return getLocalState().financial;
  },

  async createFinancialEntry(entryData: Omit<LawFinancialEntry, "id" | "created_at">): Promise<LawFinancialEntry> {
    const newEntry: LawFinancialEntry = {
      ...entryData,
      id: generateValidUUID(),
      created_at: new Date().toISOString(),
    };

    try {
      await db.from("law_financial_entries").insert(newEntry);
    } catch {}

    const state = getLocalState();
    state.financial = [newEntry, ...state.financial];
    saveLocalState(state);
    return newEntry;
  },

  // Atividades recentes
  async getActivities(): Promise<LawActivity[]> {
    return getLocalState().activities;
  },

  // Advogados
  async getLawyers(): Promise<LawLawyer[]> {
    return getLocalState().lawyers;
  },

  // Sincronização Integral por OAB do Escritório
  async syncOfficeOAB(oabNumber: string, oabState: string, lawyerName?: string): Promise<OABSyncResult> {
    const result = generateOABPortfolio(oabNumber, oabState, lawyerName);
    const state = getLocalState();

    // 1. Atualiza acervo de clientes e contatos
    state.clients = result.clients;

    // 2. Atualiza os 21 processos judiciais
    state.processes = result.processes;

    // 3. Atualiza prazos e audiências
    state.deadlines = result.deadlines;
    state.hearings = result.hearings;

    // 4. Salva perfil do advogado e publicações
    state.lawyerProfile = result.lawyer;
    state.publications = result.publications;
    state.monitoredDiarios = result.monitoredDiarios || INITIAL_MONITORED_DIARIOS;

    // 5. Registra atividade de sincronização
    state.activities = [
      {
        id: "act-sync-" + Date.now(),
        type: "processo",
        title: `Acervo sincronizado via ${result.lawyer.full_oab}`,
        description: `Importação automática concluída: ${result.processes.length} processos reais do acervo, contatos/partes, publicações TJPI/DJEN e diários oficiais monitorados pré-selecionados.`,
        timestamp: "Agora mesmo",
      },
      ...state.activities,
    ];

    saveLocalState(state);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_synced_oab_profile", JSON.stringify(result.lawyer));
        localStorage.setItem("law_hub_oab_search_term", result.lawyer.full_oab);
        localStorage.setItem("law_hub_synced_publications", JSON.stringify(result.publications));
        localStorage.setItem("law_hub_monitored_diarios", JSON.stringify(state.monitoredDiarios));
      } catch (e) {
        console.error("Erro ao persistir dados OAB no localStorage:", e);
      }
    }

    // Tenta persistir no Supabase em segundo plano se tabelas existirem
    try {
      if (result.clients.length > 0) {
        await db.from("law_clients").upsert(result.clients.slice(0, 10), { onConflict: "id" });
      }
      if (result.processes.length > 0) {
        await db.from("law_processes").upsert(result.processes.slice(0, 10), { onConflict: "id" });
      }
    } catch {}

    return result;
  },

  getSyncedLawyerProfile(): SyncedLawyerProfile {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_synced_oab_profile");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name) {
            return parsed;
          }
        }
      } catch {}
    }
    const state = getLocalState();
    if (state.lawyerProfile?.name) {
      return state.lawyerProfile;
    }

    // Sem perfil fictício: os dados devem vir da conta autenticada ou da sincronização OAB.
    return {
      name: "",
      oab_number: "",
      oab_state: "",
      full_oab: "",
      status: "",
      registration_type: "",
      sectional: "",
      subdivision: "",
      law_firm: "",
      law_firm_cnpj: "",
      email: "",
      phone: "",
      mobile: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      synced_at: "",
    };
  },

  saveSyncedLawyerProfile(profile: SyncedLawyerProfile): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_synced_oab_profile", JSON.stringify(profile));
      } catch {}
    }
    const state = getLocalState();
    state.lawyerProfile = profile;
    saveLocalState(state);
  },

  async getPublications(): Promise<LawPublication[]> {
    const state = getLocalState();
    if (state.publications && state.publications.length > 0) {
      return state.publications;
    }
    return INITIAL_PUBLICATIONS;
  },

  async getMonitoredDiarios(): Promise<MonitoredDiarioConfig[]> {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_monitored_diarios");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    const state = getLocalState();
    if (state.monitoredDiarios && state.monitoredDiarios.length > 0) {
      return state.monitoredDiarios;
    }
    return INITIAL_MONITORED_DIARIOS;
  },

  saveMonitoredDiarios(configs: MonitoredDiarioConfig[]): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_monitored_diarios", JSON.stringify(configs));
      } catch {}
    }
    const state = getLocalState();
    state.monitoredDiarios = configs;
    saveLocalState(state);
  },

  getMonitoredPublicationTerms(): MonitoredPublicationTerm[] {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_publication_terms");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return INITIAL_PUBLICATION_TERMS;
  },

  saveMonitoredPublicationTerms(terms: MonitoredPublicationTerm[]): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_publication_terms", JSON.stringify(terms));
      } catch {}
    }
  },

  getPublicationSearchSlots(): { used: number; total: number; available: number } {
    let used = 2;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_publication_terms");
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) used = list.length;
        }
      } catch {}
    }
    const total = 9999; // Sem restrição de limites no LawHub
    return { used, total, available: Math.max(0, total - used) };
  },

  async linkPublicationToProcess(pubId: string, processId: string): Promise<void> {
    const state = getLocalState();
    if (state.publications) {
      const idx = state.publications.findIndex((p: LawPublication) => p.id === pubId);
      if (idx !== -1) {
        state.publications[idx].is_linked = true;
        state.publications[idx].linked_process_id = processId;
        state.publications[idx].status = "tratada";
        saveLocalState(state);
      }
    }
  },

  /**
   * Tratamento Unificado de Publicações Judiciais (NAVOR LawHub)
   * Suporta criação de Prazos Fatais, Audiências, Tarefas, Histórico e Descarte com persistência total.
   */
  async treatPublication(params: {
    pubId: string;
    type: "prazo" | "audiencia" | "tarefa" | "historico" | "descarte";
    title?: string;
    description?: string;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:mm
    priority?: DeadlinePriority;
    responsibleName?: string;
    processCnj?: string;
    processId?: string;
    clientName?: string;
    hearingType?: HearingType;
    isVirtual?: boolean;
    location?: string;
    linkUrl?: string;
  }): Promise<{ success: boolean; createdItemId?: string }> {
    const state = getLocalState();
    if (!state.publications) state.publications = [];

    const pubIdx = state.publications.findIndex((p: LawPublication) => p.id === params.pubId);
    const pub = pubIdx !== -1 ? state.publications[pubIdx] : undefined;

    const treatedBy = this.getOfficeConfig()?.titular_name || "Usuário autenticado";
    const treatedAt = new Date().toISOString();

    let createdItemId: string | undefined;

    if (params.type === "prazo") {
      const deadline = await this.createDeadline({
        process_id: params.processId,
        process_cnj: params.processCnj || pub?.process_cnj,
        client_name: params.clientName || "Cliente",
        title: params.title || `Prazo Judicial - ${pub?.gazette_name || "Publicação"}`,
        description: params.description || `Originado da publicação judicial ${pub?.process_cnj || ""}`,
        deadline_date: params.date || new Date(Date.now() + 86400000 * 15).toISOString().slice(0, 10),
        deadline_time: params.time || "23:59",
        priority: params.priority || "urgente",
        status: "pendente",
        responsible_name: params.responsibleName || treatedBy,
        origin_publication_id: params.pubId,
      });
      createdItemId = deadline.id;
    } else if (params.type === "audiencia") {
      const hearing = await this.createHearing({
        process_id: params.processId,
        process_cnj: params.processCnj || pub?.process_cnj,
        client_name: params.clientName || "Cliente",
        title: params.title || "Audiência Judicial",
        hearing_type: params.hearingType || "conciliacao",
        hearing_date: params.date || new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
        hearing_time: params.time || "14:00",
        location: params.location || (params.isVirtual ? "Sala Virtual (Teams / Zoom)" : "Fórum Central"),
        link_url: params.linkUrl,
        status: "agendada",
        responsible_name: params.responsibleName || treatedBy,
        notes: params.description || `Originado da publicação ${pub?.process_cnj || ""}`,
      });
      createdItemId = hearing.id;
    } else if (params.type === "tarefa") {
      const task = await this.createAgendaActivity({
        type: "tarefa",
        title: params.title || "Tarefa Judicial",
        description: params.description || `Originada da publicação judicial ${pub?.process_cnj || ""}`,
        date: params.date || new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
        status: "pendente",
        responsible_name: params.responsibleName || treatedBy,
        process_cnj: params.processCnj || pub?.process_cnj,
        client_name: params.clientName,
      });
      createdItemId = task.id;
    }

    if (pubIdx !== -1) {
      state.publications[pubIdx].status = params.type === "descarte" ? "descartada" : "tratada";
      state.publications[pubIdx].treatment_type = params.type;
      state.publications[pubIdx].treatment_title = params.title || (params.type === "descarte" ? "Publicação descartada" : "Tratada");
      state.publications[pubIdx].treatment_date = params.date || new Date().toISOString().slice(0, 10);
      state.publications[pubIdx].treated_by = treatedBy;
      state.publications[pubIdx].treated_at = treatedAt;
      saveLocalState(state);
    }

    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new Event("lawhub_publications_updated"));
        window.dispatchEvent(new Event("lawhub_agenda_updated"));
        window.dispatchEvent(new Event("lawhub_alerts_updated"));
      } catch {}
    }

    return { success: true, createdItemId };
  },

  deletePublication(pubId: string): void {
    this.deletePublications([pubId]);
  },

  deletePublications(pubIds: string[]): void {
    const idsSet = new Set(pubIds);
    const state = getLocalState();
    if (state.publications) {
      state.publications = state.publications.filter((p: LawPublication) => !idsSet.has(p.id));
      saveLocalState(state);
    }

    if (typeof window !== "undefined") {
      try {
        const stored1 = localStorage.getItem("law_hub_synced_publications");
        if (stored1) {
          const list = JSON.parse(stored1);
          if (Array.isArray(list)) {
            const filtered = list.filter((p: any) => !idsSet.has(p.id));
            localStorage.setItem("law_hub_synced_publications", JSON.stringify(filtered));
          }
        }
        const stored2 = localStorage.getItem("law_hub_synced_publications_v2");
        if (stored2) {
          const list2 = JSON.parse(stored2);
          if (Array.isArray(list2)) {
            const filtered2 = list2.filter((p: any) => !idsSet.has(p.id));
            localStorage.setItem("law_hub_synced_publications_v2", JSON.stringify(filtered2));
          }
        }
        window.dispatchEvent(new Event("lawhub_publications_updated"));
        window.dispatchEvent(new Event("lawhub_alerts_updated"));
      } catch (e) {
        console.error("Erro ao deletar publicações:", e);
      }
    }
  },

  clearAllPublications(): void {
    const state = getLocalState();
    state.publications = [];
    saveLocalState(state);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_synced_publications", JSON.stringify([]));
        localStorage.setItem("law_hub_synced_publications_v2", JSON.stringify([]));
        window.dispatchEvent(new Event("lawhub_publications_updated"));
        window.dispatchEvent(new Event("lawhub_alerts_updated"));
      } catch (e) {
        console.error("Erro ao limpar publicações:", e);
      }
    }
  },

  getDismissedAlertIds(): Set<string> {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_dismissed_alerts");
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    return new Set();
  },

  dismissAlert(alertId: string): void {
    const dismissed = this.getDismissedAlertIds();
    dismissed.add(alertId);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_dismissed_alerts", JSON.stringify(Array.from(dismissed)));
        window.dispatchEvent(new Event("lawhub_alerts_updated"));
      } catch {}
    }
  },

  dismissAllAlerts(alertIds?: string[]): void {
    const dismissed = this.getDismissedAlertIds();
    if (alertIds && alertIds.length > 0) {
      alertIds.forEach((id) => dismissed.add(id));
    } else {
      const state = getLocalState();
      const publications = state.publications && state.publications.length > 0 ? state.publications : INITIAL_PUBLICATIONS;
      publications.forEach((p: LawPublication) => dismissed.add(`al-pub-${p.id}`));
      dismissed.add("al-andamento-1");
      dismissed.add("al-prazo-1");
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_dismissed_alerts", JSON.stringify(Array.from(dismissed)));
        window.dispatchEvent(new Event("lawhub_alerts_updated"));
      } catch {}
    }
  },

  async getAlerts(): Promise<LawAlert[]> {
    const publications = await this.getPublications();
    const dismissed = this.getDismissedAlertIds();
    const alerts: LawAlert[] = [];

    // 2. Alertas de Publicações recebidas no nome monitorado (Reflete imediatamente os recortes)
    for (const pub of publications) {
      const alertId = `al-pub-${pub.id}`;
      if (dismissed.has(alertId)) continue;

      const timeLabel = pub.publication_date ? `${pub.publication_date} - 08:00` : "Recente";

      alerts.push({
        id: alertId,
        type: "publicacao",
        category: "publicacoes",
        title: "Publicação recebida",
        status: pub.status === "tratada" ? "tratada" : pub.status === "descartada" ? "descartada" : "nao_tratada",
        is_treated: pub.status === "tratada",
        process_cnj: pub.process_cnj,
        court: pub.court || pub.gazette_name,
        monitored_term: pub.searched_name || "",
        publication_id: pub.id,
        publication: pub,
        time_label: timeLabel,
        created_at: pub.publication_date || new Date().toISOString(),
        is_important: true,
        summary: pub.dispatch_summary,
        content: pub.full_text,
      });
    }

    // 4. Alertas do Call Center / Leads Futuros com retorno agendado para hoje ou data ultrapassada
    if (typeof window !== "undefined") {
      try {
        const rawLeads = localStorage.getItem("lawhub_leads_v1") || localStorage.getItem("law_hub_leads");
        if (rawLeads) {
          const leads = JSON.parse(rawLeads);
          const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
          for (const lead of leads) {
            if (lead.lead_type === "futuro" && lead.future_contact_date) {
              const alertId = `al-lead-futuro-${lead.id}`;
              if (dismissed.has(alertId)) continue;

              const isToday = lead.future_contact_date === todayStr;
              const isOverdue = lead.future_contact_date < todayStr;
              if (isToday || isOverdue) {
                alerts.push({
                  id: alertId,
                  type: "callcenter",
                  category: "callcenter",
                  title: isToday
                    ? `Retorno de Lead Call Center: ${lead.name}`
                    : `Retorno Atrasado Call Center: ${lead.name}`,
                  status: "nao_tratada",
                  monitored_term: lead.traffic_code ? `[${lead.traffic_code}] ${lead.traffic_action_name || ""}` : "Call Center",
                  time_label: isToday ? `Hoje - ${lead.future_contact_time || "Horário comercial"}` : `${lead.future_contact_date} (Atrasado)`,
                  created_at: new Date().toISOString(),
                  is_important: true,
                  summary: `Agendamento de contato: ${lead.future_contact_reason || "Retorno sobre ação judicial"}. Tel: ${lead.phone || "Não informado"}`,
                  content: `Lead futuro captado pelo WhatsApp/Tráfego. Campanha: ${lead.traffic_code || "Direto"} - Ação: ${lead.traffic_action_name || lead.title || "Geral"}. Telefone/WhatsApp: ${lead.phone || "Não informado"}. Motivo: ${lead.future_contact_reason || "Acompanhamento de cliente em maturação"}.`,
                  lead_id: lead.id,
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar leads futuros para alertas:", e);
      }
    }

    return alerts.filter((a) => !dismissed.has(a.id));
  },

  getAnalyzedPublicationIds(): Set<string> {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_analyzed_pub_ids");
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    return new Set();
  },

  isPublicationAnalyzed(pubId: string): boolean {
    return this.getAnalyzedPublicationIds().has(pubId);
  },

  markPublicationAsAnalyzed(pubId: string, analyzed: boolean = true): void {
    const analyzedSet = this.getAnalyzedPublicationIds();
    if (analyzed) {
      analyzedSet.add(pubId);
    } else {
      analyzedSet.delete(pubId);
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_analyzed_pub_ids", JSON.stringify(Array.from(analyzedSet)));
        window.dispatchEvent(new Event("lawhub_publications_updated"));
      } catch {}
    }
  },

  markAllPublicationsAsAnalyzed(): void {
    const analyzedSet = this.getAnalyzedPublicationIds();
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_synced_publications_v2");
        if (raw !== null) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach((p: any) => analyzedSet.add(p.id));
          }
        }
      } catch {}
    }
    const state = getLocalState();
    const pubs = state.publications && state.publications.length > 0 ? state.publications : INITIAL_PUBLICATIONS;
    pubs.forEach((p: LawPublication) => analyzedSet.add(p.id));

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_analyzed_pub_ids", JSON.stringify(Array.from(analyzedSet)));
        window.dispatchEvent(new Event("lawhub_publications_updated"));
      } catch {}
    }
  },

  getNewPublicationsCount(): number {
    const analyzedSet = this.getAnalyzedPublicationIds();
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_synced_publications_v2");
        if (raw !== null) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            return list.filter((p: any) => !analyzedSet.has(p.id)).length;
          }
        }
      } catch {}
    }
    const state = getLocalState();
    const pubs = state.publications && state.publications.length > 0 ? state.publications : INITIAL_PUBLICATIONS;
    return pubs.filter((p: LawPublication) => !analyzedSet.has(p.id)).length;
  },

  getUnhandledPublicationsCount(): number {
    return this.getNewPublicationsCount();
  },

  getActiveAlertsCount(): number {
    const dismissed = this.getDismissedAlertIds();
    const state = getLocalState();
    const publications = state.publications && state.publications.length > 0 ? state.publications : INITIAL_PUBLICATIONS;

    const unhandledPubs = publications.filter((p: LawPublication) => {
      const alertId = `al-pub-${p.id}`;
      return !dismissed.has(alertId) && p.status !== "tratada" && p.status !== "descartada";
    }).length;

    let otherCount = 0;
    if (!dismissed.has("al-andamento-1")) otherCount++;
    if (!dismissed.has("al-prazo-1")) otherCount++;

    return unhandledPubs + otherCount;
  },

  /**
   * Executa busca real e ao vivo de publicações nos diários oficiais via ComunicaPJe / DJEN (CNJ)
   * Varredura multicritério (OABs + Nomes Advogados + Nome da Parte/Envolvido + Processos)
   * Garante paridade total com o robô do Astrea e previne perdas por ausência de OAB em intimações
   */
  async fetchLiveCourtPublications(options?: {
    oabNumber?: string;
    ufOab?: string;
    nomeAdvogado?: string;
    processCNJ?: string;
  }): Promise<{ count: number; publications: LawPublication[]; source: string }> {
    const lawyerProfile = this.getSyncedLawyerProfile();
    const source = "ComunicaPJe / DJEN (CNJ)";

    // 1. OABs a consultar
    const oabsToSearch: Array<{ numeroOab: string; ufOab: string }> = [];
    if (options?.oabNumber) {
      oabsToSearch.unshift({ numeroOab: options.oabNumber, ufOab: options.ufOab || "PI" });
    }
    if (lawyerProfile?.oab_number) {
      oabsToSearch.push({
        numeroOab: lawyerProfile.oab_number.replace(/\D/g, ""),
        ufOab: lawyerProfile.oab_state || "PI",
      });
    }

    // 2. Nomes como Advogado (destinatarioadvogados)
    const lawyerNames: string[] = [];
    if (options?.nomeAdvogado && !lawyerNames.includes(options.nomeAdvogado)) {
      lawyerNames.unshift(options.nomeAdvogado);
    }
    if (lawyerProfile?.name && !lawyerNames.includes(lawyerProfile.name)) {
      lawyerNames.push(lawyerProfile.name);
    }

    // 3. Nomes como Parte / Interessado (destinatarios - essencial para processos em causa própria ou erro de cartório)
    const partyNames: string[] = [];
    if (options?.nomeAdvogado && !partyNames.includes(options.nomeAdvogado)) {
      partyNames.push(options.nomeAdvogado);
    }

    // 4. Termos e nomes no INTEIRO TEOR da peça / decisão / despacho (parâmetro ?texto=)
    const bodyTerms: string[] = lawyerProfile?.name ? [lawyerProfile.name] : [];

    // 5. Processos específicos no radar e cadastrados no escritório
    const processesToSearch: string[] = [];
    if (options?.processCNJ) {
      processesToSearch.unshift(options.processCNJ);
    }
    const state = getLocalState();
    if (state.processes && Array.isArray(state.processes)) {
      // Prioridade máxima: processos com radar ativo (court_linked, automatico ou favoritos)
      const radarProcesses = state.processes.filter(
        (p: any) => p.court_linked || p.monitoring_type === "automatico" || p.isStarred
      );
      for (const p of radarProcesses) {
        if (p.cnj_number && !processesToSearch.includes(p.cnj_number)) {
          processesToSearch.push(p.cnj_number);
        }
      }
      // Complementar com outros processos cadastrados
      for (const p of state.processes) {
        if (p.cnj_number && !processesToSearch.includes(p.cnj_number)) {
          processesToSearch.push(p.cnj_number);
        }
      }
    }

    let fetched: LawPublication[] = [];
    try {
      fetched = await ComunicaPJEService.fetchMultiCriteria({
        oabs: oabsToSearch,
        lawyerNames,
        partyNames,
        bodyTerms,
        processes: processesToSearch,
      });
    } catch (e) {
      console.warn("LawHubService.fetchLiveCourtPublications live fetch failed:", e);
    }

    const existing = state.publications && state.publications.length > 0 ? state.publications : INITIAL_PUBLICATIONS;

    if (fetched.length > 0) {
      const existingIds = new Set(existing.map((p: LawPublication) => p.id));
      const existingKeys = new Set(
        existing.map((p: LawPublication) => `${p.process_cnj.replace(/\D/g, "")}-${p.publication_date}`)
      );

      const uniqueNew = fetched.filter((p) => {
        const cleanCnj = p.process_cnj.replace(/\D/g, "");
        return !existingIds.has(p.id) && !existingKeys.has(`${cleanCnj}-${p.publication_date}`);
      });

      if (uniqueNew.length > 0) {
        state.publications = [...uniqueNew, ...existing];
        state.activities = [
          {
            id: "act-pub-" + Date.now(),
            type: "processo",
            title: "Publicações capturadas ao vivo",
            description: `${uniqueNew.length} nova(s) publicação(ões) capturada(s) nos diários oficiais via ComunicaPJe / DJEN.`,
            timestamp: "Agora mesmo",
          },
          ...(state.activities || []),
        ];
        saveLocalState(state);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("law_hub_synced_publications_v2", JSON.stringify(state.publications));
            window.dispatchEvent(new Event("lawhub_publications_updated"));
            window.dispatchEvent(new Event("lawhub_alerts_updated"));
          } catch {}
        }
        return { count: uniqueNew.length, publications: state.publications, source };
      }
    }

    return { count: 0, publications: existing, source };
  },

  getOfficeConfig(): OfficeGeneralConfig {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("law_hub_office_config_v1");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    const state = getLocalState();
    return state.officeConfig || INITIAL_OFFICE_CONFIG;
  },

  saveOfficeConfig(config: OfficeGeneralConfig): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("law_hub_office_config_v1", JSON.stringify(config));
        localStorage.setItem("law_hub_office_name", config.name);
        localStorage.setItem("law_hub_office_cnpj", config.document);
        localStorage.setItem("law_hub_office_address", config.address);
        localStorage.setItem("law_hub_office_oab_sociedade", config.oab);
        localStorage.setItem("law_hub_associate_lawyer", config.titular_name);
        if (config.logo_url) {
          localStorage.setItem("law_hub_office_logo", config.logo_url);
        }
        window.dispatchEvent(new Event("lawhub_office_updated"));
      } catch (e) {
        console.error("Erro ao salvar configuração do escritório:", e);
      }
    }
    const state = getLocalState();
    state.officeConfig = config;
    saveLocalState(state);
  },

  /**
   * Cálculo de retenção de tributos em faturas e honorários (Motor Financeiro LawHub)
   * Regra vital: Clientes Pessoa Jurídica (PJ) têm desconto de impostos respeitando a retenção mínima.
   * Clientes Pessoa Física (PF) não sofrem retenção na fonte.
   */
  calculateBillingTaxes(
    grossAmount: number,
    clientType: ClientType = "PJ",
    customTaxes?: OfficeTaxConfig[]
  ): {
    grossAmount: number;
    totalTaxes: number;
    netAmount: number;
    breakdown: Array<{
      id: string;
      name: string;
      percentage: number;
      min_retention: number;
      simples_nacional: boolean;
      calculatedAmount: number;
      retainedAmount: number;
      isBelowMinimum: boolean;
      summary: string;
    }>;
    exemptReason?: string;
  } {
    if (clientType === "PF") {
      return {
        grossAmount,
        totalTaxes: 0,
        netAmount: grossAmount,
        breakdown: [],
        exemptReason: "Clientes Pessoa Física não possuem retenção de tributos na fonte.",
      };
    }

    const officeConfig = this.getOfficeConfig();
    const taxes = customTaxes || officeConfig.billing?.taxes || INITIAL_OFFICE_CONFIG.billing.taxes;

    let totalTaxes = 0;
    const breakdown = taxes.map((tax) => {
      const calculatedAmount = Number((grossAmount * (tax.percentage / 100)).toFixed(2));
      const isBelowMinimum = calculatedAmount < tax.min_retention;
      const retainedAmount = isBelowMinimum ? 0 : calculatedAmount;

      totalTaxes += retainedAmount;

      return {
        id: tax.id,
        name: tax.name,
        percentage: tax.percentage,
        min_retention: tax.min_retention,
        simples_nacional: tax.simples_nacional,
        calculatedAmount,
        retainedAmount,
        isBelowMinimum,
        summary: `${tax.name} ${tax.percentage}% sobre o valor bruto, mínimo de R$ ${tax.min_retention.toFixed(2).replace(".", ",")}`,
      };
    });

    const netAmount = Number((grossAmount - totalTaxes).toFixed(2));

    return {
      grossAmount,
      totalTaxes: Number(totalTaxes.toFixed(2)),
      netAmount,
      breakdown,
    };
  },

  getTitularEmail(): string {
    try {
      const config = this.getOfficeConfig();
      if (config?.email && config.email.trim().length > 0) {
        return config.email.toLowerCase().trim();
      }
    } catch {}
    return "";
  },

  getOfficeUsers(): OfficeUser[] {
    const titularEmail = this.getTitularEmail();
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("lawhub_office_users_v1");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.map((u: OfficeUser) => {
              const isMaster = Boolean(titularEmail) && u.email?.toLowerCase().trim() === titularEmail;
              const permissions =
                u.permissions || getDefaultPermissionsForRole(u.role, isMaster);
              return {
                ...u,
                is_master_admin: isMaster,
                permissions: isMaster
                  ? {
                      ...permissions,
                      isAdmin: true,
                      accessFinanceiro: true,
                      accessAllProcesses: true,
                      accessCallCenter: true,
                      onlyCallCenter: false,
                    }
                  : permissions,
                accessFinanceiro: isMaster ? true : permissions.accessFinanceiro,
                accessHonorariosForaFinanceiro: isMaster ? true : permissions.accessHonorariosForaFinanceiro,
              };
            });
          }
        }
      } catch (e) {
        console.error("Erro ao carregar usuários do escritório:", e);
      }
    }
    return INITIAL_OFFICE_USERS.map((u) => {
      const isMaster = Boolean(titularEmail) && u.email?.toLowerCase().trim() === titularEmail;
      return {
        ...u,
        is_master_admin: isMaster,
        permissions: u.permissions || getDefaultPermissionsForRole(u.role, isMaster),
      };
    });
  },

  saveOfficeUsers(users: OfficeUser[]): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("lawhub_office_users_v1", JSON.stringify(users));
        window.dispatchEvent(new Event("lawhub_users_updated"));
      } catch (e) {
        console.error("Erro ao salvar usuários do escritório:", e);
      }
    }
  },

  /**
   * Obtém o usuário do escritório pelo e-mail
   */
  getCurrentOfficeUser(userEmail?: string | null): OfficeUser | null {
    if (!userEmail) return null;
    const cleanEmail = userEmail.toLowerCase().trim();
    const users = this.getOfficeUsers();
    return users.find((u) => u.email?.toLowerCase().trim() === cleanEmail) || null;
  },

  /**
   * Verifica se o usuário é Administrador Geral ou possui Acesso Total ao LawHub.
   * Regra: O ícone CallCenter vai aparecer dentro do menu lawhub somente para o administrador geral
   * ou para a conta que tem acesso total.
   */
  isMasterOrFullAccess(userEmail?: string | null, isPlatformAdmin = false): boolean {
    if (isPlatformAdmin) return true;
    if (!userEmail) return false;

    const cleanEmail = userEmail.toLowerCase().trim();
    const titularEmail = this.getTitularEmail();
    if (Boolean(titularEmail) && cleanEmail === titularEmail) {
      return true;
    }

    const officeUser = this.getCurrentOfficeUser(cleanEmail);
    if (!officeUser) {
      // Se não for encontrado na lista de usuários do escritório, não concede acesso irrestrito
      return false;
    }

    if (officeUser.is_master_admin) return true;
    if (officeUser.role === "administrador") return true;
    if (officeUser.permissions?.isAdmin) return true;

    // Acesso total (acesso aos módulos financeiros, processos e publicações)
    const p = officeUser.permissions;
    if (p && p.accessAllProcesses && p.accessFinanceiro && p.accessPublicacoes && !p.onlyCallCenter) {
      return true;
    }

    return false;
  },

  /**
   * Verifica se o usuário possui permissão APENAS para o Call Center.
   * Regra: Quando ele usar o email e senha no login, o Call Center vai aparecer UNICAMENTE na tela inteira,
   * só deixando a barra superior com os dados do escritório.
   */
  isCallCenterOnly(userEmail?: string | null, isPlatformAdmin = false): boolean {
    if (isPlatformAdmin) return false;
    if (!userEmail) return false;

    const cleanEmail = userEmail.toLowerCase().trim();
    const titularEmail = this.getTitularEmail();
    if (Boolean(titularEmail) && cleanEmail === titularEmail) {
      return false;
    }

    const officeUser = this.getCurrentOfficeUser(cleanEmail);
    if (!officeUser) return false;

    // Se for admin ou titular, não é CallCenter-only
    if (officeUser.is_master_admin || officeUser.role === "administrador" || officeUser.permissions?.isAdmin) {
      return false;
    }

    const p = officeUser.permissions || getDefaultPermissionsForRole(officeUser.role);

    // Se tiver CRM ativo, NÃO é exclusivamente Call Center (tem CallCenter + CRM cumulativo)
    if (p.accessLeads === true) {
      return false;
    }

    // Se tiver módulos gerais ativos, não é apenas Call Center
    if (p.accessAllProcesses || p.accessFinanceiro || p.accessPublicacoes) {
      return false;
    }

    if (p.onlyCallCenter || officeUser.role === "atendente_callcenter" || p.accessCallCenter) {
      return true;
    }

    return false;
  },

  /**
   * Validador Granular de Acesso por Rota (Segurança Frontend + Rota)
   * Verifica se o colaborador tem permissão para a rota solicitada.
   * Se não tiver, retorna a rota autorizada para redirecionamento.
   */
  canUserAccessRoute(
    userEmail?: string | null,
    pathname = "",
    isPlatformAdmin = false
  ): { allowed: boolean; redirectRoute?: string; reason?: string } {
    if (isPlatformAdmin) return { allowed: true };
    if (!userEmail) return { allowed: true };

    const cleanEmail = userEmail.toLowerCase().trim();
    const titularEmail = this.getTitularEmail();
    if (Boolean(titularEmail) && cleanEmail === titularEmail) {
      return { allowed: true };
    }

    const officeUser = this.getCurrentOfficeUser(cleanEmail);
    if (!officeUser) return { allowed: false, redirectRoute: "/lawhub/dashboard" };

    // Administrador ou Titular tem acesso irrestrito
    if (
      officeUser.is_master_admin ||
      officeUser.role === "administrador" ||
      officeUser.permissions?.isAdmin
    ) {
      return { allowed: true };
    }

    const p = officeUser.permissions || getDefaultPermissionsForRole(officeUser.role);
    const fallback = this.getUserDefaultRoute(cleanEmail);

    // 1. Configurações / Administração do Escritório / Gestão de Equipe
    if (pathname.startsWith("/lawhub/configuracoes") || pathname.startsWith("/lawhub/equipe")) {
      if (!p.isAdmin && !officeUser.is_master_admin) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Configurações restritas à administração do escritório",
        };
      }
    }

    // 2. Módulo Financeiro
    if (pathname.startsWith("/lawhub/financeiro")) {
      if (!p.accessFinanceiro) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Módulo financeiro não autorizado para o seu usuário",
        };
      }
    }

    // 3. Módulo Call Center
    if (pathname.startsWith("/lawhub/atendimentos")) {
      if (!p.accessCallCenter && !p.onlyCallCenter && officeUser.role !== "atendente_callcenter") {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Módulo Call Center não liberado para o seu perfil",
        };
      }
    }

    // 4. Módulo CRM / Leads
    if (pathname.startsWith("/lawhub/leads") || pathname === "/crm" || pathname.startsWith("/crm/")) {
      const hasCrm = p.accessLeads === true || (!p.onlyCallCenter && officeUser.role !== "atendente_callcenter" && p.accessLeads !== false);
      if (!hasCrm) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Acesso a Leads / CRM não concedido",
        };
      }
    }

    // 5. Processos Judiciais
    if (pathname.startsWith("/lawhub/processos")) {
      if (!p.accessAllProcesses && !p.createProcesses) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Acesso aos processos judiciais não autorizado",
        };
      }
    }

    // 6. Tarefas e Kanban Geral
    if (pathname.startsWith("/lawhub/tarefas")) {
      if (!p.accessAllProcesses && !p.canDelegateTasks && (p.onlyCallCenter || officeUser.role === "atendente_callcenter")) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Acesso ao kanban de tarefas não autorizado",
        };
      }
    }

    // 7. Agenda de Audiências e Compromissos
    if (pathname.startsWith("/lawhub/agenda")) {
      if (!p.manageAgenda && !p.accessAllProcesses && (p.onlyCallCenter || officeUser.role === "atendente_callcenter")) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Acesso à agenda não autorizado",
        };
      }
    }

    // 8. Contatos e Clientes
    if (pathname.startsWith("/lawhub/clientes")) {
      const hasClientes = p.manageClients !== false && (!p.onlyCallCenter || p.manageClients === true);
      if (!hasClientes) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Acesso à base de clientes não autorizado",
        };
      }
    }

    // 9. Publicações de Diários Oficiais
    if (pathname.startsWith("/lawhub/publicacoes")) {
      if (!p.accessPublicacoes && !p.managePublications) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Acesso às publicações oficiais não autorizado",
        };
      }
    }

    // 10. Calculadora Jurídica
    if (pathname.startsWith("/lawhub/calculadora")) {
      if (!p.accessAllProcesses && !p.accessFinanceiro && (p.onlyCallCenter || officeUser.role === "atendente_callcenter")) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Calculadora jurídica não autorizada",
        };
      }
    }

    // 11. Peças com IA & Jurisprudência
    if (pathname.startsWith("/lawhub/modelos") || pathname.startsWith("/lawhub/ia")) {
      if (!p.useAI && !p.accessAllProcesses) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Recursos de Inteligência Artificial jurídica não autorizados",
        };
      }
    }

    // 12. Central de Documentos
    if (pathname.startsWith("/lawhub/documentos")) {
      if (!p.accessAllProcesses && !p.accessDocumentos && (p.onlyCallCenter || officeUser.role === "atendente_callcenter")) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Acesso a documentos não autorizado",
        };
      }
    }

    // 13. Workflows e Automações
    if (pathname.startsWith("/lawhub/workflows")) {
      if (!p.isAdmin && !p.accessAllProcesses) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Workflows e automações restritos",
        };
      }
    }

    // 14. Relatórios e Indicadores
    if (pathname.startsWith("/lawhub/relatorios") || pathname.startsWith("/lawhub/indicadores")) {
      if (!p.accessFinanceiro && !p.accessAllProcesses && !p.isAdmin) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Relatórios gerenciais restritos",
        };
      }
    }

    // 15. Alertas
    if (pathname.startsWith("/lawhub/alertas")) {
      if (!p.accessPublicacoes && !p.accessAllProcesses && !p.isAdmin && (p.onlyCallCenter || officeUser.role === "atendente_callcenter")) {
        return {
          allowed: false,
          redirectRoute: fallback,
          reason: "Central de alertas não autorizada para operador",
        };
      }
    }

    // 16. Dashboard Geral (usuários puramente operacionais ou restritos são redirecionados ao seu módulo)
    if (pathname === "/lawhub/dashboard" || pathname === "/lawhub" || pathname === "/lawhub/") {
      if (p.onlyCallCenter || officeUser.role === "atendente_callcenter" || (p.accessCallCenter && !p.accessAllProcesses && !p.accessFinanceiro)) {
        return {
          allowed: false,
          redirectRoute: "/lawhub/atendimentos",
          reason: "Usuário direcionado diretamente ao Call Center",
        };
      }
      if (p.accessLeads && !p.accessAllProcesses && !p.accessFinanceiro) {
        return {
          allowed: false,
          redirectRoute: "/lawhub/leads",
          reason: "Usuário direcionado ao CRM Comercial",
        };
      }
    }

    return { allowed: true };
  },

  /**
   * Rota padrão de pouso após o login / ativação
   */
  getUserDefaultRoute(userEmail?: string | null): string {
    if (!userEmail) return "/lawhub/dashboard";
    const cleanEmail = userEmail.toLowerCase().trim();
    const titularEmail = this.getTitularEmail();
    if (Boolean(titularEmail) && cleanEmail === titularEmail) {
      return "/lawhub/dashboard";
    }

    const officeUser = this.getCurrentOfficeUser(cleanEmail);
    if (!officeUser) return "/lawhub/dashboard";

    if (officeUser.is_master_admin || officeUser.role === "administrador" || officeUser.permissions?.isAdmin) {
      return "/lawhub/dashboard";
    }

    const p = officeUser.permissions || getDefaultPermissionsForRole(officeUser.role);

    // 1. Se tem Call Center e é operador ou restrito, pousa no Call Center
    if (p.onlyCallCenter || officeUser.role === "atendente_callcenter" || (p.accessCallCenter && !p.accessAllProcesses && !p.accessFinanceiro)) {
      return "/lawhub/atendimentos";
    }

    // 2. Se tem apenas CRM
    if (p.accessLeads && !p.accessAllProcesses && !p.accessFinanceiro) {
      return "/lawhub/leads";
    }

    // 3. Se tem apenas Financeiro
    if (p.accessFinanceiro && !p.accessAllProcesses) {
      return "/lawhub/financeiro";
    }

    // 4. Se tem Processos
    if (p.accessAllProcesses) {
      return "/lawhub/processos";
    }

    return "/lawhub/dashboard";
  },
  getOfficeRoles(): OfficeRoleConfig[] {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("lawhub_office_roles_v1");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return INITIAL_OFFICE_ROLES;
  },

  saveOfficeRoles(roles: OfficeRoleConfig[]): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("lawhub_office_roles_v1", JSON.stringify(roles));
        window.dispatchEvent(new Event("lawhub_roles_updated"));
      } catch (e) {
        console.error("Erro ao salvar cargos do escritório:", e);
      }
    }
  },

  addOfficeRole(roleData: { name: string; description?: string; default_has_system_access?: boolean; color?: string }): OfficeRoleConfig {
    const current = this.getOfficeRoles();
    const newRole: OfficeRoleConfig = {
      id: `role-${Date.now()}`,
      name: roleData.name,
      description: roleData.description || "",
      default_has_system_access: roleData.default_has_system_access !== false,
      color: roleData.color || "#3b82f6",
      is_custom: true,
    };
    const updated = [...current, newRole];
    this.saveOfficeRoles(updated);
    return newRole;
  },

  deactivateOfficeUser(userId: string, transferToUserId?: string): { success: boolean; transferredCount: number } {
    const users = this.getOfficeUsers();
    const titularEmail = this.getTitularEmail();
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return { success: false, transferredCount: 0 };
    if (targetUser.is_master_admin || targetUser.email.toLowerCase().trim() === titularEmail) {
      throw new Error("O Administrador Geral Titular da conta não pode ser desativado.");
    }

    let transferUser: OfficeUser | undefined;
    if (transferToUserId) {
      transferUser = users.find((u) => u.id === transferToUserId && u.status === "ativo");
    }

    let transferredCount = 0;
    const state = getLocalState();

    if (transferUser) {
      const oldName = targetUser.name;
      const newName = transferUser.name;
      const newId = transferUser.id;

      // Reatribui processos
      if (Array.isArray(state.processes)) {
        state.processes.forEach((p: any) => {
          if (p.responsible_id === userId || p.responsible_name === oldName) {
            p.responsible_id = newId;
            p.responsible_name = newName;
            transferredCount++;
          }
        });
      }

      // Reatribui prazos
      if (Array.isArray(state.deadlines)) {
        state.deadlines.forEach((d: any) => {
          if (d.responsible_id === userId || d.responsible_name === oldName) {
            d.responsible_id = newId;
            d.responsible_name = newName;
            transferredCount++;
          }
        });
      }

      // Reatribui audiências
      if (Array.isArray(state.hearings)) {
        state.hearings.forEach((h: any) => {
          if (h.responsible_id === userId || h.responsible_name === oldName) {
            h.responsible_id = newId;
            h.responsible_name = newName;
            transferredCount++;
          }
        });
      }

      // Reatribui tarefas
      if (Array.isArray(state.tasks)) {
        state.tasks.forEach((t: any) => {
          if (t.assigned_to_id === userId || t.assigned_to_name === oldName) {
            t.assigned_to_id = newId;
            t.assigned_to_name = newName;
            transferredCount++;
          }
        });
      }

      // Reatribui atividades de agenda
      if (Array.isArray(state.agendaActivities)) {
        state.agendaActivities.forEach((a: any) => {
          if (a.responsible_id === userId || a.responsible_name === oldName) {
            a.responsible_id = newId;
            a.responsible_name = newName;
            transferredCount++;
          }
        });
      }

      saveLocalState(state);
    }

    // Marca o status como inativo
    const updatedUsers = users.map((u) =>
      u.id === userId ? { ...u, status: "inativo" as const } : u
    );
    this.saveOfficeUsers(updatedUsers);

    return { success: true, transferredCount };
  },

  getOfficeTeams(): OfficeTeam[] {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("lawhub_office_teams_v1");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.error("Erro ao carregar equipes do escritório:", e);
      }
    }
    return INITIAL_OFFICE_TEAMS;
  },

  saveOfficeTeams(teams: OfficeTeam[]): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("lawhub_office_teams_v1", JSON.stringify(teams));
        window.dispatchEvent(new Event("lawhub_teams_updated"));
      } catch (e) {
        console.error("Erro ao salvar equipes do escritório:", e);
      }
    }
  },

  getClientPortalAccesses(): ClientPortalAccess[] {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("lawhub_portal_accesses_v1");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.error("Erro ao carregar acessos do portal:", e);
      }
    }
    return INITIAL_PORTAL_ACCESSES;
  },

  saveClientPortalAccesses(accesses: ClientPortalAccess[]): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("lawhub_portal_accesses_v1", JSON.stringify(accesses));
        window.dispatchEvent(new Event("lawhub_portal_updated"));
      } catch (e) {
        console.error("Erro ao salvar acessos do portal:", e);
      }
    }
  },

  createClientPortalInvite(
    clientName: string,
    email: string,
    permissions: Partial<ClientPortalAccess["permissions"]>,
    clientId?: string
  ): { access: ClientPortalAccess; link: string } {
    const accesses = this.getClientPortalAccesses();
    const token = `tok-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newAccess: ClientPortalAccess = {
      id: `portal-${Date.now()}`,
      client_id: clientId || `cli-${Date.now()}`,
      client_name: clientName,
      email,
      created_at: new Date().toLocaleDateString("pt-BR"),
      status: "pendente",
      processes_count: 1,
      permissions: {
        view_processes: permissions.view_processes ?? true,
        view_movements: permissions.view_movements ?? true,
        view_documents: permissions.view_documents ?? true,
        view_financial: permissions.view_financial ?? false,
        email_notifications: permissions.email_notifications ?? true,
      },
      token,
    };
    const updated = [newAccess, ...accesses.filter((a) => a.email.toLowerCase() !== email.toLowerCase())];
    this.saveClientPortalAccesses(updated);
    const origin = typeof window !== "undefined" ? window.location.origin : "https://ativaconsult.lovable.app";
    const link = `${origin}/lawhub/portal-cliente?token=${token}&email=${encodeURIComponent(email)}&client=${encodeURIComponent(clientName)}`;
    return { access: newAccess, link };
  },

  // Módulo de Agenda Navor LawHub
  getAgendaActivitiesSync(): LawAgendaActivity[] {
    return getLocalState().agendaActivities || INITIAL_AGENDA_ACTIVITIES;
  },

  async getAgendaActivities(): Promise<LawAgendaActivity[]> {
    return this.getAgendaActivitiesSync();
  },

  async createAgendaActivity(
    activityData: Omit<LawAgendaActivity, "id" | "created_at">
  ): Promise<LawAgendaActivity> {
    const newActivity: LawAgendaActivity = {
      ...activityData,
      id: "act-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      created_at: new Date().toISOString(),
      comments: activityData.comments || [],
      attachments: activityData.attachments || [],
    };

    const state = getLocalState();
    state.agendaActivities = [newActivity, ...(state.agendaActivities || [])];
    saveLocalState(state);
    return newActivity;
  },

  async updateAgendaActivity(
    id: string,
    updates: Partial<LawAgendaActivity>
  ): Promise<LawAgendaActivity | null> {
    const state = getLocalState();
    let updatedItem: LawAgendaActivity | null = null;
    state.agendaActivities = (state.agendaActivities || []).map((item: LawAgendaActivity) => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });

    if (updatedItem) {
      saveLocalState(state);
    }
    return updatedItem;
  },

  async toggleAgendaActivityStatus(id: string): Promise<LawAgendaActivity | null> {
    const state = getLocalState();
    let updatedItem: LawAgendaActivity | null = null;
    state.agendaActivities = (state.agendaActivities || []).map((item: LawAgendaActivity) => {
      if (item.id === id) {
        const nextStatus: LawAgendaActivityStatus =
          item.status === "concluida" ? "a_concluir" : "concluida";
        updatedItem = { ...item, status: nextStatus };
        return updatedItem;
      }
      return item;
    });

    if (updatedItem) {
      saveLocalState(state);
    }
    return updatedItem;
  },

  async deleteAgendaActivity(id: string): Promise<boolean> {
    const state = getLocalState();
    const initialLen = (state.agendaActivities || []).length;
    state.agendaActivities = (state.agendaActivities || []).filter(
      (item: LawAgendaActivity) => item.id !== id
    );
    if (state.agendaActivities.length !== initialLen) {
      saveLocalState(state);
      return true;
    }
    return false;
  },

  async addAgendaActivityComment(
    id: string,
    comment: { author: string; text: string }
  ): Promise<LawAgendaActivity | null> {
    const state = getLocalState();
    let updatedItem: LawAgendaActivity | null = null;
    state.agendaActivities = (state.agendaActivities || []).map((item: LawAgendaActivity) => {
      if (item.id === id) {
        const newComment: LawAgendaActivityComment = {
          id: "c-" + Date.now(),
          author: comment.author,
          text: comment.text,
          created_at: new Date().toISOString(),
        };
        updatedItem = {
          ...item,
          comments: [...(item.comments || []), newComment],
        };
        return updatedItem;
      }
      return item;
    });

    if (updatedItem) {
      saveLocalState(state);
    }
    return updatedItem;
  },

  async addAgendaActivityAttachment(
    id: string,
    attachment: { name: string; size?: string; url?: string }
  ): Promise<LawAgendaActivity | null> {
    const state = getLocalState();
    let updatedItem: LawAgendaActivity | null = null;
    state.agendaActivities = (state.agendaActivities || []).map((item: LawAgendaActivity) => {
      if (item.id === id) {
        const newAtt: LawAgendaActivityAttachment = {
          id: "att-" + Date.now(),
          name: attachment.name,
          size: attachment.size || "450 KB",
          url: attachment.url,
          date: new Date().toLocaleDateString("pt-BR"),
        };
        updatedItem = {
          ...item,
          attachments: [...(item.attachments || []), newAtt],
        };
        return updatedItem;
      }
      return item;
    });

    if (updatedItem) {
      saveLocalState(state);
    }
    return updatedItem;
  },

  // Timezone da Agenda
  getTimezone(): string {
    const state = getLocalState();
    return state.agendaTimezone || DEFAULT_AGENDA_TIMEZONE;
  },

  setTimezone(timezone: string): void {
    const state = getLocalState();
    state.agendaTimezone = timezone;
    saveLocalState(state);
  },

  // --- GESTÃO DE PLANO E ASSINATURA DO ESCRITÓRIO ---
  getSubscriptionInfo(): SubscriptionPlanInfo {
    const state = getLocalState();
    if (state.subscriptionInfo) {
      return state.subscriptionInfo;
    }
    // Billing is Core-owned. This legacy local state must never impersonate a real plan.
    const defaultSub: SubscriptionPlanInfo = {
      id: "unavailable",
      tier: "agil",
      name: "Assinatura indisponível",
      description: "Dados de assinatura ainda não estão disponíveis neste ambiente.",
      amount: 0,
      billing_cycle: "monthly",
      status: "suspended",
      renewal_date: "",
      created_at: "",
      max_users: 0,
      monitored_oab_limit: 0,
      processes_limit: 0,
      radar_processes_limit: 0,
      ai_credits_monthly: 0,
      storage_gb: 0,
      extra_users: 0,
      extra_oabs: 0,
      extra_ai_credits: 0,
      extra_radar_processes: 0,
    };
    state.subscriptionInfo = defaultSub;
    saveLocalState(state);
    return defaultSub;
  },

  saveSubscriptionInfo(info: SubscriptionPlanInfo): void {
    const state = getLocalState();
    state.subscriptionInfo = info;
    saveLocalState(state);
  },

  getTenantUsageQuotas(): TenantUsageQuotas {
    const state = getLocalState();
    const usersCount = (state.officeUsers || []).filter((u: any) => u.status === "ativo").length;
    const monitoredOabsCount = (state.monitoredPublicationTerms || []).length;
    const processes = state.processes || [];
    const processesCount = processes.length;
    // Processos no Radar: processos com push ativado / estrela / monitoramento automático
    const radarProcessesCount = processes.filter((p: any) => p.hasRss || p.monitoring_type === "automatico" || p.isStarred).length;
    const aiCreditsUsed = state.aiCreditsUsed ?? 0;
    const storageGbUsed = state.storageGbUsed ?? 0;

    return {
      users_count: usersCount,
      monitored_oabs_count: monitoredOabsCount,
      processes_count: processesCount,
      radar_processes_count: radarProcessesCount,
      ai_credits_used: aiCreditsUsed,
      storage_gb_used: storageGbUsed,
    };
  },

  /**
   * Saldo e gestão de créditos de IA e Buscas Profundas
   */
  getAiCreditsBalance(): {
    totalMonthly: number;
    extraCredits: number;
    usedCredits: number;
    availableCredits: number;
  } {
    const sub = this.getSubscriptionInfo();
    const state = getLocalState();
    const totalMonthly = sub.ai_credits_monthly || 0;
    const extraCredits = sub.extra_ai_credits || 0;
    const usedCredits = state.aiCreditsUsed || 0;
    const availableCredits = Math.max(0, totalMonthly + extraCredits - usedCredits);

    return {
      totalMonthly,
      extraCredits,
      usedCredits,
      availableCredits,
    };
  },

  /**
   * Consome créditos de IA ou Busca Avançada com registro de transação
   */
  useAiCredit(amount: number = 1, reason: string = "Busca Profunda de Processos (Escavador / IA)"): {
    success: boolean;
    availableCredits: number;
    message: string;
  } {
    const state = getLocalState();
    const balance = this.getAiCreditsBalance();

    if (balance.availableCredits < amount) {
      return {
        success: false,
        availableCredits: balance.availableCredits,
        message: `Saldo insuficiente (${balance.availableCredits} créditos disponíveis). Adquira um pacote de recarga.`,
      };
    }

    state.aiCreditsUsed = (state.aiCreditsUsed || 0) + amount;

    // Registra transação no extrato
    const transactions = state.creditTransactions || [];
    transactions.unshift({
      id: `ctx-${Date.now()}`,
      created_at: new Date().toISOString(),
      type: "credit_out",
      amount,
      description: reason,
      balance_after: balance.availableCredits - amount,
    });
    state.creditTransactions = transactions.slice(0, 50);

    saveLocalState(state);

    return {
      success: true,
      availableCredits: balance.availableCredits - amount,
      message: `${amount} crédito(s) debitado(s) com sucesso.`,
    };
  },

  /**
   * Compra pacote de recarga de créditos avulsos
   */
  buyCreditPack(packId: "pack_50" | "pack_150" | "pack_500"): {
    success: boolean;
    newBalance: number;
    creditsAdded: number;
    price: number;
  } {
    void packId;
    throw new Error("UNAVAILABLE: compra de créditos requer provedor de billing configurado no Core.");
  },

  /**
   * Retorna extrato de transações de créditos
   */
  getCreditTransactions(): CreditTransaction[] {
    const state = getLocalState();
    if (Array.isArray(state.creditTransactions) && state.creditTransactions.length > 0) {
      return state.creditTransactions;
    }
    return [];
  },

  /**
   * Ativa ou desativa o monitoramento de radar com validação de cota contratual
   */
  toggleProcessRadar(processId: string): {
    success: boolean;
    isRadarActive: boolean;
    message: string;
  } {
    const state = getLocalState();
    const processes = state.processes || [];
    const proc = processes.find((p: any) => p.id === processId);

    if (!proc) {
      return { success: false, isRadarActive: false, message: "Processo não localizado." };
    }

    const quotas = this.getTenantUsageQuotas();
    const sub = this.getSubscriptionInfo();
    const limit = (sub.radar_processes_limit || 500) + (sub.extra_radar_processes || 0);

    const willActivate = !proc.hasRss;

    if (willActivate && quotas.radar_processes_count >= limit) {
      return {
        success: false,
        isRadarActive: false,
        message: `Limite de processos no radar atingido (${quotas.radar_processes_count}/${limit}). Faça upgrade do plano para expandir seu radar.`,
      };
    }

    proc.hasRss = willActivate;
    proc.monitoring_type = willActivate ? "automatico" : "manual";
    saveLocalState(state);

    return {
      success: true,
      isRadarActive: willActivate,
      message: willActivate
        ? "Radar ativado! Notificações push e alertas de diários habilitados para este processo."
        : "Radar desativado para este processo.",
    };
  },

  upgradeSubscriptionPlan(tier: LawHubPlanTier): SubscriptionPlanInfo {
    void tier;
    throw new Error("UNAVAILABLE: alteração de plano requer provedor de billing configurado no Core.");
  },

  addExtraTurbos(turbos: { extra_users?: number; extra_oabs?: number; extra_ai_credits?: number; extra_radar_processes?: number }): SubscriptionPlanInfo {
    void turbos;
    throw new Error("UNAVAILABLE: contratação de adicionais requer provedor de billing configurado no Core.");
  },

  isMasterAdmin(userOrEmail?: any): boolean {
    const titularEmail = this.getTitularEmail().toLowerCase().trim();

    // Client-side checks are presentation-only. Server functions enforce authorization.
    if (userOrEmail && typeof userOrEmail === "object") {
      if (
        userOrEmail.isPlatformAdmin === true ||
        userOrEmail.role === "admin" ||
        userOrEmail.is_master_admin === true
      ) {
        return true;
      }
      const email = (userOrEmail.email || "").toLowerCase().trim();
      return Boolean(email && email === titularEmail);
    }

    if (typeof userOrEmail === "string" && userOrEmail.trim().length > 0) {
      const normalized = userOrEmail.toLowerCase().trim();
      const state = getLocalState();
      const u = (state.officeUsers || []).find((usr: any) => usr.email?.toLowerCase().trim() === normalized);
      return normalized === titularEmail || u?.is_master_admin === true;
    }

    return false;
  },

  verifyMasterAdminPassword(_inputPassword: string): boolean {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("lawhub_master_password");
      } catch {}
    }
    return false;
  },

  setMasterAdminPassword(_newPassword: string): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("lawhub_master_password");
      } catch {}
    }
  },

  isMasterSessionUnlocked(): boolean {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem("lawhub_master_unlocked") === "true";
      } catch {}
    }
    return false;
  },

  unlockMasterSession(): void {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("lawhub_master_unlocked", "true");
      } catch {}
    }
  },

  lockMasterSession(): void {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("lawhub_master_unlocked");
      } catch {}
    }
  },

  // --- CONFIGURAÇÃO DE SEGURANÇA MULTI-MODAL DO ADMINISTRADOR GERAL ---
  getMasterSecurityConfig(): MasterSecurityConfig {
    const DEFAULT_SECURITY: MasterSecurityConfig = {
      primary_email: "",
      recovery_email: "",
      master_password: "",
      face_id_enabled: false,
      face_id_photo_url: undefined,
      face_id_last_calibrated: undefined,
      voice_id_enabled: false,
      voice_id_phrase: "",
      voice_id_last_calibrated: undefined,
      require_face_or_voice: false,
      last_auth_event: undefined,
    };

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("lawhub_master_security_config_v2");
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_SECURITY, ...parsed };
        }
      } catch {}
    }
    return DEFAULT_SECURITY;
  },

  saveMasterSecurityConfig(config: MasterSecurityConfig): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "lawhub_master_security_config_v2",
          JSON.stringify({ ...config, master_password: "" }),
        );
        localStorage.removeItem("lawhub_master_password");
        window.dispatchEvent(new Event("lawhub_security_config_updated"));
      } catch (e) {
        console.error("Erro ao salvar configuração de segurança:", e);
      }
    }
  },

  verifyMasterCredentials(inputEmail: string, inputPassword: string): boolean {
    void inputEmail;
    void inputPassword;
    return false;
  },

  calibrateFaceId(photoBase64: string): void {
    void photoBase64;
    throw new Error("Biometria facial ainda não possui implementação segura e está desabilitada.");
  },

  calibrateVoiceId(phrase: string, sampleUrl?: string): void {
    void phrase;
    void sampleUrl;
    throw new Error("Biometria de voz ainda não possui implementação segura e está desabilitada.");
  },

  logMasterAuthEvent(method: "credentials" | "face_id" | "voice_id", emailUsed?: string): void {
    const current = this.getMasterSecurityConfig();
    current.last_auth_event = {
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      method,
      email_used: emailUsed || current.primary_email,
      success: true,
    };
    this.saveMasterSecurityConfig(current);
  },

  // --- MÉTODOS DE FATURAMENTO E CARTÃO (CORREÇÃO DE BUG CONFIGURAÇÕES) ---
  getBillingCardInfo(): BillingCardInfo {
    const state = getLocalState();
    if (state.billingCard) return state.billingCard;
    const defaultCard: BillingCardInfo = {
      brand: "mastercard",
      last4: "",
      exp_month: "",
      exp_year: "",
      holder_name: "",
      document: "",
    };
    state.billingCard = defaultCard;
    saveLocalState(state);
    return defaultCard;
  },

  saveBillingCard(card: BillingCardInfo): void {
    const state = getLocalState();
    state.billingCard = card;
    saveLocalState(state);
  },

  getSubscriptionInvoices(): SubscriptionInvoice[] {
    const state = getLocalState();
    if (state.subscriptionInvoices && state.subscriptionInvoices.length > 0) {
      return state.subscriptionInvoices;
    }
    const defaultInvoices: SubscriptionInvoice[] = [];
    state.subscriptionInvoices = defaultInvoices;
    saveLocalState(state);
    return defaultInvoices;
  },

  getCreditTransactions(): CreditTransaction[] {
    const state = getLocalState();
    if (state.creditTransactions && state.creditTransactions.length > 0) {
      return state.creditTransactions;
    }
    const defaultCtx: CreditTransaction[] = [];
    state.creditTransactions = defaultCtx;
    saveLocalState(state);
    return defaultCtx;
  },

  lockMasterSession(): void {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("lawhub_master_unlocked");
      } catch {}
    }
  },

  cancelSubscription(reason: string = "Cancelamento solicitado"): void {
    void reason;
    throw new Error("UNAVAILABLE: cancelamento requer provedor de billing configurado no Core.");
  },

  upgradePlan(planId: string, billingCycle: "monthly" | "yearly" = "monthly"): void {
    void planId;
    void billingCycle;
    throw new Error("UNAVAILABLE: alteração de plano requer provedor de billing configurado no Core.");
  },
};


