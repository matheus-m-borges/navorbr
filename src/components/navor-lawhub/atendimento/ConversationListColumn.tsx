import { useState, useMemo } from "react";
import { Search, Filter, Bot, User, Clock, Phone, Tag, Headphones, ShieldCheck } from "lucide-react";
import type { LawConversation, LawDepartment, ConversationStatus } from "@/lib/lawhub/atendimento-types";
import { cn } from "@/lib/utils";

interface ConversationListColumnProps {
  conversations: LawConversation[];
  selectedId: string | null;
  departments: LawDepartment[];
  onSelect: (conv: LawConversation) => void;
  isCallCenterUser?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  attendantDepartmentId?: string | null;
}

type TabFilter = "todas" | "minhas" | "fila" | "ia" | "encerradas";

export function ConversationListColumn({
  conversations,
  selectedId,
  departments,
  onSelect,
  isCallCenterUser = false,
  currentUserId,
  currentUserName,
  currentUserEmail,
  attendantDepartmentId,
}: ConversationListColumnProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("todas");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("todos");

  const deptMap = useMemo(() => {
    const map = new Map<string, LawDepartment>();
    departments.forEach((d) => map.set(d.id, d));
    return map;
  }, [departments]);

  // Regra de Segregação por Posto de Atendimento vs Supervisão da Administração
  const accessibleConversations = useMemo(() => {
    if (!isCallCenterUser) {
      // 1. Administração Geral da Advocacia: acesso irrestrito a TODAS as conversas do escritório
      return conversations;
    }

    // 2. Posto do Call Center:
    // Acesso exclusivamente às conversas:
    // - Atribuídas a este posto/atendente
    // - Ou que estão na fila de atendimento / triagem IA aguardando para serem assumidas
    // O operador NÃO vê conversas que já foram direcionadas ou assumidas por outros advogados
    return conversations.filter((c) => {
      const isMine =
        (currentUserId && c.assigned_user_id === currentUserId) ||
        (currentUserEmail && c.assigned_user_id === currentUserEmail) ||
        (currentUserName && c.assigned_user_name?.toLowerCase().trim() === currentUserName.toLowerCase().trim()) ||
        c.assigned_user_id === "current-user";

      if (isMine) return true;

      // Se já está atribuída a outro advogado/atendente, o operador do Call Center NÃO pode ver
      if (c.assigned_user_id && c.assigned_user_id !== currentUserId && c.assigned_user_id !== "current-user") {
        return false;
      }
      if (
        c.assigned_user_name &&
        currentUserName &&
        c.assigned_user_name.toLowerCase().trim() !== currentUserName.toLowerCase().trim() &&
        c.assigned_user_name !== "Aguardando Atendente"
      ) {
        return false;
      }

      // Se está na fila de espera ou na IA aguardando atendimento
      if (c.status === "WAITING_QUEUE" || c.status === "WAITING_AI" || !c.assigned_user_id) {
        if (
          attendantDepartmentId &&
          c.department_id &&
          c.department_id !== attendantDepartmentId &&
          c.department_id !== "dept-comercial"
        ) {
          return false;
        }
        return true;
      }

      return false;
    });
  }, [conversations, isCallCenterUser, currentUserId, currentUserName, currentUserEmail, attendantDepartmentId]);

  // Contadores dinâmicos por tab dentro do escopo acessível
  const tabCounts = useMemo(() => {
    const isMine = (c: LawConversation) =>
      (currentUserId && c.assigned_user_id === currentUserId) ||
      (currentUserEmail && c.assigned_user_id === currentUserEmail) ||
      (currentUserName && c.assigned_user_name?.toLowerCase().trim() === currentUserName.toLowerCase().trim()) ||
      c.assigned_user_id === "current-user";

    return {
      todas: accessibleConversations.filter((c) => c.status !== "RESOLVED" && c.status !== "CLOSED").length,
      fila: accessibleConversations.filter((c) => c.status === "WAITING_QUEUE").length,
      minhas: accessibleConversations.filter((c) => isMine(c) && c.status === "IN_PROGRESS").length,
      ia: accessibleConversations.filter((c) => c.ai_mode === "ACTIVE" || c.status === "WAITING_AI").length,
      encerradas: accessibleConversations.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED").length,
    };
  }, [accessibleConversations, currentUserId, currentUserName, currentUserEmail]);

  const filtered = useMemo(() => {
    return accessibleConversations.filter((c) => {
      const isMine =
        (currentUserId && c.assigned_user_id === currentUserId) ||
        (currentUserEmail && c.assigned_user_id === currentUserEmail) ||
        (currentUserName && c.assigned_user_name?.toLowerCase().trim() === currentUserName.toLowerCase().trim()) ||
        c.assigned_user_id === "current-user";

      // 1. Tab
      if (activeTab === "minhas") {
        if (!isMine) return false;
      } else if (activeTab === "fila") {
        if (c.status !== "WAITING_QUEUE") return false;
      } else if (activeTab === "ia") {
        if (c.ai_mode !== "ACTIVE" && c.status !== "WAITING_AI") return false;
      } else if (activeTab === "encerradas") {
        if (c.status !== "RESOLVED" && c.status !== "CLOSED") return false;
      } else {
        // Aba "Todas": exibe ativas (concluídas ficam na aba Concluídas ou busca)
        if ((c.status === "RESOLVED" || c.status === "CLOSED") && !searchTerm) return false;
      }

      // 2. Setor
      if (selectedDeptId !== "todos" && c.department_id !== selectedDeptId) {
        return false;
      }

      // 3. Busca de Texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = c.contact_name.toLowerCase().includes(term);
        const matchPhone = c.contact_phone.includes(term);
        const matchSnippet = c.last_message_snippet?.toLowerCase().includes(term) ?? false;
        const matchLead = c.lead?.name.toLowerCase().includes(term) ?? false;
        return matchName || matchPhone || matchSnippet || matchLead;
      }

      return true;
    });
  }, [accessibleConversations, activeTab, selectedDeptId, searchTerm, currentUserId, currentUserName, currentUserEmail]);

  const getStatusBadge = (status: ConversationStatus, aiMode: string) => {
    if (aiMode === "ACTIVE" || status === "WAITING_AI") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
          <Bot className="w-2.5 h-2.5 text-purple-500" />
          IA Triagem
        </span>
      );
    }
    if (status === "WAITING_QUEUE") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <Clock className="w-2.5 h-2.5 text-amber-500" />
          Na Fila
        </span>
      );
    }
    if (status === "IN_PROGRESS") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          <User className="w-2.5 h-2.5 text-emerald-500" />
          Atendimento
        </span>
      );
    }
    if (status === "TRANSFERRED") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
          Transferido
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400">
        Concluído
      </span>
    );
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="w-full md:w-72 lg:w-80 flex-shrink-0 bg-card border-r border-border/60 flex flex-col h-full overflow-hidden select-none">
      {/* 0. Banner de Identificação do Posto vs Administração Geral */}
      {isCallCenterUser ? (
        <div className="px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300 min-w-0">
            <Headphones className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">Posto: {currentUserName || "Call Center"}</span>
          </div>
          <span className="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-semibold shrink-0">
            Fila & Atribuídos
          </span>
        </div>
      ) : (
        <div className="px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">Supervisão Geral</span>
          </div>
          <span className="text-[9px] bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold shrink-0">
            Todas ({conversations.length})
          </span>
        </div>
      )}

      {/* 1. Barra de Busca e Filtro de Setor */}
      <div className="p-2.5 border-b border-border/60 space-y-2 bg-muted/10">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cliente ou assunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs rounded-md bg-background border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Seletor de Setores */}
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full text-[11px] py-1 px-2 rounded-md bg-background border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer truncate"
          >
            <option value="todos">Todos os Setores</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Tabs Rápidas com Badges Numéricos */}
      <div className="flex items-center border-b border-border/60 px-1 bg-card text-xs font-medium overflow-x-auto no-scrollbar">
        {[
          { key: "todas", label: "Todas", count: tabCounts.todas },
          { key: "fila", label: "Fila", count: tabCounts.fila },
          { key: "minhas", label: "Minhas", count: tabCounts.minhas },
          { key: "ia", label: "IA", count: tabCounts.ia },
          { key: "encerradas", label: "Concluídas", count: tabCounts.encerradas },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabFilter)}
            className={cn(
              "px-2 py-2 border-b-2 text-[11px] whitespace-nowrap transition-colors flex items-center gap-1",
              activeTab === tab.key
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={cn(
                  "px-1 py-0.2 rounded-full text-[9px] font-bold",
                  activeTab === tab.key
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 3. Lista de Conversas */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {filtered.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <Phone className="w-7 h-7 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-foreground">Nenhuma conversa</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Ajuste os filtros de busca.</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === selectedId;
            const dept = conv.department_id ? deptMap.get(conv.department_id) : null;

            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={cn(
                  "p-3 transition-all cursor-pointer border-l-3 relative hover:bg-muted/40",
                  isSelected
                    ? "bg-primary/5 border-l-primary"
                    : "border-l-transparent bg-card"
                )}
              >
                {/* Linha 1: Nome, Hora e Badges */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-2xs">
                      {conv.contact_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate leading-tight">
                        {conv.contact_name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground truncate">{conv.contact_phone}</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {formatTime(conv.last_message_at)}
                  </span>
                </div>

                {/* Linha 2: Snippet da última mensagem */}
                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">
                  {conv.last_message_snippet || "Sem mensagens registradas"}
                </p>

                {/* Linha 3: Setor, Status e Lead Badge */}
                <div className="flex items-center justify-between gap-1 mt-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    {dept && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold border"
                        style={{
                          backgroundColor: `${dept.color}15`,
                          color: dept.color,
                          borderColor: `${dept.color}30`,
                        }}
                      >
                        {dept.name.split("/")[0]?.trim() || dept.name}
                      </span>
                    )}

                    {getStatusBadge(conv.status, conv.ai_mode)}
                  </div>

                  <div className="flex items-center gap-1">
                    {conv.lead && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <Tag className="w-2.5 h-2.5" />
                        Lead #{conv.lead.id.slice(-3)}
                      </span>
                    )}

                    {conv.unread_count > 0 && (
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
