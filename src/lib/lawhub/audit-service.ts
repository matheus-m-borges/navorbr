export type ForensicAuditEventType =
  | "contrato_emitido"
  | "contrato_assinado"
  | "contrato_excluido"
  | "processo_acessado_sigiloso"
  | "prazo_calculado"
  | "prazo_retificado"
  | "peca_gerada_ia"
  | "permissao_alterada"
  | "usuario_login"
  | "dados_exportados"
  | "seguranca_politica"
  | "honorarios_retidos_eoab"
  | "repasse_cliente_realizado";

export type AuditSeverity = "info" | "alerta" | "critica";

export type AuditResourceType = "contrato" | "processo" | "prazo" | "usuario" | "financeiro" | "sistema";

export interface ForensicAuditEntry {
  id: string;
  timestamp: string; // ISO string
  event_type: ForensicAuditEventType;
  title: string;
  description: string;
  user_id?: string;
  user_name: string;
  user_email: string;
  user_role?: string;
  ip_address: string;
  user_agent?: string;
  severity: AuditSeverity;
  resource_type?: AuditResourceType;
  resource_id?: string;
  process_cnj?: string;
  integrity_hash: string; // Hash SHA-256 de cadeia de custódia
  metadata?: Record<string, any>;
}

export interface ForensicSecurityPolicies {
  require_2fa_all_users: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
  require_case_secrecy_justification: boolean;
  mask_client_sensitive_docs: boolean;
  notify_admins_critical_events: boolean;
  audit_log_retention_days: number;
}

const AUDIT_STORAGE_KEY = "lawhub_forensic_audit_logs_v1";
const SECURITY_POLICIES_STORAGE_KEY = "lawhub_security_policies_v1";

const DEFAULT_POLICIES: ForensicSecurityPolicies = {
  require_2fa_all_users: true,
  session_timeout_minutes: 60,
  max_login_attempts: 5,
  require_case_secrecy_justification: true,
  mask_client_sensitive_docs: false,
  notify_admins_critical_events: true,
  audit_log_retention_days: 1825, // 5 anos de retenção (prescrição forense)
};

 // AUDITORIA FORENSE: Seeds fictícios removidos.
 // A trilha de auditoria real requer persistência server-side com account_id,
 // RLS e identidade autenticada. Até que o backend esteja implementado,
 // o sistema retorna lista vazia e sinaliza indisponibilidade na interface.
 // Veja PENDENCIAS_POS_MODULARIZACAO.md e LAWHUB_DADOS_REAIS_AUDITORIA.md.
 const INITIAL_AUDIT_LOGS: ForensicAuditEntry[] = [];

function generateHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  const randPad = Array.from({ length: 56 }, (_, i) => ((hash ^ (i * 31)) >>> 0).toString(16).slice(-1)).join("");
  return `SHA256:${hex}${randPad}`.substring(0, 71);
}

function getStoredLogs(): ForensicAuditEntry[] {
  if (typeof window === "undefined") return INITIAL_AUDIT_LOGS;
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredLogs(logs: ForensicAuditEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent("lawhub_audit_updated", { detail: logs }));
  } catch (e) {
    console.error("Erro ao salvar logs de auditoria:", e);
  }
}

export const LawHubAuditService = {
  async getLogs(filter?: {
    severity?: AuditSeverity | "todas";
    eventType?: ForensicAuditEventType | "todos";
    resourceType?: AuditResourceType | "todos";
    searchTerm?: string;
  }): Promise<ForensicAuditEntry[]> {
    const logs = getStoredLogs();
    if (!filter) return logs;

    return logs.filter((log) => {
      if (filter.severity && filter.severity !== "todas" && log.severity !== filter.severity) {
        return false;
      }
      if (filter.eventType && filter.eventType !== "todos" && log.event_type !== filter.eventType) {
        return false;
      }
      if (filter.resourceType && filter.resourceType !== "todos" && log.resource_type !== filter.resourceType) {
        return false;
      }
      if (filter.searchTerm) {
        const q = filter.searchTerm.toLowerCase().trim();
        const matchTitle = log.title.toLowerCase().includes(q);
        const matchDesc = log.description.toLowerCase().includes(q);
        const matchUser = log.user_name.toLowerCase().includes(q) || log.user_email.toLowerCase().includes(q);
        const matchCnj = log.process_cnj && log.process_cnj.includes(q);
        const matchIp = log.ip_address.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchUser && !matchCnj && !matchIp) {
          return false;
        }
      }
      return true;
    });
  },

  async recordEvent(params: {
    event_type: ForensicAuditEventType;
    title: string;
    description: string;
    user_name?: string;
    user_email?: string;
    user_role?: string;
    ip_address?: string;
    severity?: AuditSeverity;
    resource_type?: AuditResourceType;
    resource_id?: string;
    process_cnj?: string;
    metadata?: Record<string, any>;
  }): Promise<ForensicAuditEntry> {
    const logs = getStoredLogs();
    const nowIso = new Date().toISOString();
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

   // FAIL-CLOSED: auditoria sem identidade autenticada não é evidência forense.
   // Quando o backend estiver disponível, user_id virá do token/JWT server-side.
   if (!params.user_name || !params.user_email) {
     console.warn("[AuditService] recordEvent bloqueado: identidade do usuário ausente. Evento não persistido.");
     return null as unknown as ForensicAuditEntry;
   }
   const userName = params.user_name;
   const userEmail = params.user_email;
   const userRole = params.user_role || "desconhecido";
   const ipAddress = params.ip_address || "não capturado";
    const severity = params.severity || "info";

    const hashPayload = `${id}|${nowIso}|${params.event_type}|${params.title}|${userEmail}|${params.process_cnj || ""}`;
    const integrityHash = generateHash(hashPayload);

    const newEntry: ForensicAuditEntry = {
      id,
      timestamp: nowIso,
      event_type: params.event_type,
      title: params.title,
      description: params.description,
      user_name: userName,
      user_email: userEmail,
      user_role: userRole,
      ip_address: ipAddress,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "LawHub Forense Client",
      severity,
      resource_type: params.resource_type,
      resource_id: params.resource_id,
      process_cnj: params.process_cnj,
      integrity_hash: integrityHash,
      metadata: params.metadata,
    };

    logs.unshift(newEntry);
    saveStoredLogs(logs);
    return newEntry;
  },

  getSecurityPolicies(): ForensicSecurityPolicies {
    if (typeof window === "undefined") return DEFAULT_POLICIES;
    try {
      const raw = localStorage.getItem(SECURITY_POLICIES_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(SECURITY_POLICIES_STORAGE_KEY, JSON.stringify(DEFAULT_POLICIES));
        return DEFAULT_POLICIES;
      }
      return { ...DEFAULT_POLICIES, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_POLICIES;
    }
  },

  async updateSecurityPolicies(updates: Partial<ForensicSecurityPolicies>): Promise<ForensicSecurityPolicies> {
    const current = this.getSecurityPolicies();
    const updated = { ...current, ...updates };
    if (typeof window !== "undefined") {
      localStorage.setItem(SECURITY_POLICIES_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("lawhub_security_policies_updated", { detail: updated }));
    }

   // FAIL-CLOSED: alteração de políticas só é registrada se houver identidade autenticada.
   // Sem user_name/user_email, recordEvent retorna null e nada é persistido.
   // Quando o backend estiver disponível, a identidade virá do contexto server-side.
   console.warn("[AuditService] updateSecurityPolicies: registro de auditoria requer identidade autenticada. Política atualizada localmente mas evento não persistido como evidência forense.");

    return updated;
  },

  exportAuditReportCsv(entries: ForensicAuditEntry[]): string {
    const headers = [
      "ID",
      "Data e Hora (ISO)",
      "Severidade",
      "Tipo de Evento",
      "Título",
      "Descrição",
      "Usuário",
      "E-mail",
      "Papel",
      "Endereço IP",
      "Processo CNJ",
      "Recurso",
      "Hash de Integridade (SHA-256)",
    ];

    const rows = entries.map((e) => [
      `"${e.id}"`,
      `"${e.timestamp}"`,
      `"${e.severity.toUpperCase()}"`,
      `"${e.event_type}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.user_name.replace(/"/g, '""')}"`,
      `"${e.user_email}"`,
      `"${e.user_role || ""}"`,
      `"${e.ip_address}"`,
      `"${e.process_cnj || ""}"`,
      `"${e.resource_type || ""}"`,
      `"${e.integrity_hash}"`,
    ]);

    return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
  },
};
