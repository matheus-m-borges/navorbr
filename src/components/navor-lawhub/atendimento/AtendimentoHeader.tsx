import { PhoneCall, Sparkles, CheckCircle2, UserCheck, RefreshCw, Settings, Users, Bot } from "lucide-react";
import type { AtendimentoMetrics, AgentPresenceStatus } from "@/lib/lawhub/atendimento-types";

interface AtendimentoHeaderProps {
  metrics: AtendimentoMetrics;
  presenceStatus: AgentPresenceStatus;
  onPresenceChange: (status: AgentPresenceStatus) => void;
  onRefresh: () => void;
  onAssumeNextInQueue?: () => void;
  showSettings?: boolean;
  isCallCenterUser?: boolean;
  currentUserName?: string;
  whatsAppPhone?: string | null;
}

export function AtendimentoHeader({
  metrics,
  presenceStatus,
  onPresenceChange,
  onRefresh,
  onAssumeNextInQueue,
  showSettings = false,
  isCallCenterUser = false,
  currentUserName,
  whatsAppPhone,
}: AtendimentoHeaderProps) {
  const presenceConfig: Record<AgentPresenceStatus, { label: string; dotClass: string; bgClass: string }> = {
    online: { label: "Disponível", dotClass: "bg-emerald-500", bgClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    busy: { label: "Em Atendimento", dotClass: "bg-blue-500", bgClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    away: { label: "Ausente", dotClass: "bg-amber-500", bgClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    offline: { label: "Offline", dotClass: "bg-slate-400", bgClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
  };

  return (
    <div className="bg-card/90 backdrop-blur-md border-b border-border/60 px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
      {/* Esquerda: Identificação do Canal WhatsApp Oficial Compacta */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
            <PhoneCall className="w-4 h-4" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-xs font-bold text-foreground truncate tracking-wide">
              {isCallCenterUser ? `CallCenter • Posto: ${currentUserName || "Atendente"}` : "CallCenter • Gestão Geral"}
            </h1>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
              title="Instância oficial conectada"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {whatsAppPhone ? `WhatsApp: ${whatsAppPhone}` : "1 Número Oficial"}
            </span>
          </div>
        </div>
      </div>

      {/* Centro: Indicadores Rápidos Compactos (Pills) */}
      <div className="hidden md:flex items-center gap-1.5 overflow-x-auto">
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50 text-[11px]">
          <Users className="w-3 h-3 text-blue-500" />
          <span className="text-muted-foreground">Fila:</span>
          <span className="font-bold text-foreground">{metrics.waitingQueue}</span>
        </div>

        {metrics.waitingQueue > 0 && onAssumeNextInQueue && (
          <button
            type="button"
            onClick={onAssumeNextInQueue}
            title="Assumir o próximo cliente aguardando na fila do Call Center"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs transition animate-pulse"
          >
            <Users className="w-3 h-3" />
            <span>Atender Próximo ({metrics.waitingQueue})</span>
          </button>
        )}

        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50 text-[11px]">
          <UserCheck className="w-3 h-3 text-indigo-500" />
          <span className="text-muted-foreground">{isCallCenterUser ? "Meus Ativos:" : "Em Atendimento:"}</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">
            {isCallCenterUser ? metrics.myActiveChats : metrics.inProgress}
          </span>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50 text-[11px]">
          <Bot className="w-3 h-3 text-purple-500" />
          <span className="text-muted-foreground">Triagem IA:</span>
          <span className="font-bold text-purple-600 dark:text-purple-400">{metrics.waitingAI}</span>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50 text-[11px]">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span className="text-muted-foreground">Resolvidos:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{metrics.resolvedToday}</span>
        </div>
      </div>

      {/* Direita: Status de Presença & Ações */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <select
            value={presenceStatus}
            onChange={(e) => onPresenceChange(e.target.value as AgentPresenceStatus)}
            className={`text-xs font-semibold py-1 pl-2.5 pr-6 rounded-md border appearance-none cursor-pointer focus:outline-none transition-colors ${presenceConfig[presenceStatus].bgClass}`}
          >
            <option value="online">🟢 Disponível</option>
            <option value="busy">🔵 Em Atendimento</option>
            <option value="away">🟡 Ausente</option>
            <option value="offline">⚪ Offline</option>
          </select>
        </div>

        <button
          onClick={onRefresh}
          title="Sincronizar conversas"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {showSettings && (
          <a
            href="/lawhub/configuracoes?tab=atendimento"
            title="Configurações de Atendimento, WhatsApp e IA"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
