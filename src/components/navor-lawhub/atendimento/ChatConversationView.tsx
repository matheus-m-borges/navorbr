import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  ArrowRightLeft,
  CheckCircle2,
  Lock,
  MessageSquare,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  LawConversation,
  LawMessage,
  LawDepartment,
  LawQuickMessage,
} from "@/lib/lawhub/atendimento-types";
import { cn } from "@/lib/utils";

interface ChatConversationViewProps {
  conversation: LawConversation | null;
  messages: LawMessage[];
  departments: LawDepartment[];
  quickMessages: LawQuickMessage[];
  isLeadPanelOpen?: boolean;
  onToggleLeadPanel?: () => void;
  onSendMessage: (body: string, isInternalNote: boolean) => void;
  onAssume: () => void;
  onOpenTransfer?: () => void;
  onToggleAI: () => void;
  onCloseConversation: () => void;
  onReopenConversation?: () => void;
}

export function ChatConversationView({
  conversation,
  messages,
  departments,
  quickMessages,
  isLeadPanelOpen,
  onToggleLeadPanel,
  onSendMessage,
  onAssume,
  onOpenTransfer,
  onToggleAI,
  onCloseConversation,
  onReopenConversation,
}: ChatConversationViewProps) {
  const [inputText, setInputText] = useState("");
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
          <MessageSquare className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Nenhuma conversa selecionada</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          Selecione uma conversa na coluna à esquerda para iniciar o atendimento.
        </p>
      </div>
    );
  }

  const dept = departments.find((d) => d.id === conversation.department_id);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), isInternalNoteMode);
    setInputText("");
    setShowQuickMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertQuickMessage = (qm: LawQuickMessage) => {
    setInputText(qm.content);
    setShowQuickMenu(false);
  };

  const isUnassignedOrQueue =
    conversation.status === "WAITING_QUEUE" ||
    conversation.status === "WAITING_AI" ||
    !conversation.assigned_user_id;

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden min-w-0">
      {/* 1. Header do Chat: Totalmente Responsivo sem Sobreposição */}
      <div className="px-3.5 py-2.5 border-b border-border/60 bg-card/90 backdrop-blur-sm shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Identificação do Contato */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
            {conversation.contact_name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">
                {conversation.contact_name}
              </h2>
              {dept && (
                <span
                  className="px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0"
                  style={{
                    backgroundColor: `${dept.color}15`,
                    color: dept.color,
                    borderColor: `${dept.color}30`,
                  }}
                >
                  {dept.name.split("/")[0]?.trim() || dept.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
              <span>{conversation.contact_phone}</span>
              <span>•</span>
              <span className="truncate">
                {conversation.assigned_user_id
                  ? (conversation.assigned_user_name || "Advogado")
                  : "Aguardando na Fila"}
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Ações Rápidas (Organizada e Compacta) */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {/* Botão Assumir Atendimento */}
          {isUnassignedOrQueue && (
            <Button
              size="sm"
              onClick={onAssume}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] h-7 px-2.5 shadow-xs"
            >
              <User className="w-3 h-3 mr-1" />
              Assumir
            </Button>
          )}

          {/* Toggle IA Ativa / Pausada */}
          <button
            onClick={onToggleAI}
            title={conversation.ai_mode === "ACTIVE" ? "Pausar respostas automáticas da IA" : "Reativar IA"}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-all h-7",
              conversation.ai_mode === "ACTIVE"
                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
            )}
          >
            <Bot className="w-3 h-3 text-purple-500" />
            <span>{conversation.ai_mode === "ACTIVE" ? "IA Ativa" : "IA Pausada"}</span>
          </button>


          {/* Encerrar / Resolver ou Reabrir */}
          {conversation.status === "RESOLVED" || conversation.status === "CLOSED" ? (
            onReopenConversation && (
              <button
                onClick={onReopenConversation}
                className="p-1 rounded-md border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors h-7 px-2 text-[11px] font-medium flex items-center gap-1"
                title="Reabrir atendimento concluído"
              >
                <RotateCcw className="w-3 h-3 text-amber-500" />
                <span>Reabrir</span>
              </button>
            )
          ) : (
            <button
              onClick={onCloseConversation}
              className="p-1 rounded-md border border-border/70 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors h-7 px-2 text-[11px] font-medium flex items-center gap-1"
              title="Encerrar atendimento"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden md:inline">Resolver</span>
            </button>
          )}

          {/* Botão para Alternar Painel do Lead (Coluna 3) */}
          {onToggleLeadPanel && (
            <button
              onClick={onToggleLeadPanel}
              className={cn(
                "p-1 rounded-md border transition-colors h-7 px-1.5 text-[11px] flex items-center gap-1",
                isLeadPanelOpen
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-border/70 text-muted-foreground hover:text-foreground"
              )}
              title={isLeadPanelOpen ? "Ocultar Painel do Lead" : "Mostrar Painel do Lead"}
            >
              {isLeadPanelOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Banner de Chamado em Espera na Fila do Call Center */}
      {conversation.status === "WAITING_QUEUE" && (
        <div className="mx-3 mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs shrink-0 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <span className="p-1 rounded-full bg-amber-500/20 animate-pulse">
              <Users className="w-3.5 h-3.5 text-amber-600" />
            </span>
            <div>
              <span className="font-bold block text-[11px]">Cliente Aguardando Atendente na Fila</span>
              <span className="text-[10px] text-muted-foreground">
                O cliente solicitou atendimento humano. A IA está pausada para este contato.
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onAssume}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] h-7 px-3 shrink-0 shadow-xs"
          >
            <User className="w-3 h-3 mr-1" />
            Assumir Agora
          </Button>
        </div>
      )}

      {/* 2. Banner de Resumo da IA para Handoff (Compacto & Colapsável) */}
      {conversation.ai_summary && (
        <div className="mx-3 mt-2 mb-1 p-2 rounded-lg bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 text-xs shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="p-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">
                <Sparkles className="w-3 h-3" />
              </span>
              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                Triagem IA:
              </span>
              {conversation.ai_detected_area && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-800 dark:text-purple-200">
                  {conversation.ai_detected_area}
                </span>
              )}
              {conversation.ai_detected_urgency && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                    conversation.ai_detected_urgency === "alta"
                      ? "bg-red-500/20 text-red-700 dark:text-red-300"
                      : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                  )}
                >
                  Urgência {conversation.ai_detected_urgency}
                </span>
              )}
            </div>

            <button
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              {isSummaryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {isSummaryExpanded && (
            <p className="text-[11px] text-foreground/90 mt-1 leading-relaxed pl-5">
              {conversation.ai_summary}
            </p>
          )}
        </div>
      )}

      {/* 3. Área de Mensagens com Rolagem Suave */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-muted/5">
        {messages.map((msg) => {
          // A: Mensagem de Sistema / Evento
          if (msg.sender_type === "system" && !msg.is_internal_note) {
            return (
              <div key={msg.id} className="flex justify-center my-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted/70 border border-border/50 text-muted-foreground text-center max-w-sm">
                  {msg.body}
                </span>
              </div>
            );
          }

          // B: Nota Interna da Equipe (Exclusiva)
          if (msg.is_internal_note) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="w-full max-w-lg bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 shadow-2xs">
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold text-[10px] mb-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    <span>NOTA INTERNA (Visível apenas para advogados)</span>
                  </div>
                  <p className="text-[11px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                  <span className="block text-[9px] text-muted-foreground mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          }

          // C: Balão de Anúncio / Meta Ads (Click to WhatsApp) ou Saudação Automática
          const isMetaAdCard =
            !!msg.ad_referral ||
            (msg.body && (
              msg.body.includes("Mensagem de saudação automática") ||
              msg.body.includes("Anúncio") ||
              /^#A\d+/i.test(msg.body.trim()) ||
              (msg.body.trim().startsWith("#") && msg.body.includes("Oi! Como podemos ajudar?"))
            ));

          if (isMetaAdCard && msg.sender_type !== "system") {
            const referral = msg.ad_referral;
            const thumbnail = referral?.thumbnail_url || "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=120&auto=format&fit=crop&q=80";
            const greetingText = msg.body?.replace(/Mensagem de saudação automática/gi, "").trim() || "#A1 Oi! Como podemos ajudar?";

            return (
              <div key={msg.id} className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[75%]">
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0 mb-0.5">
                  {conversation.contact_name[0]}
                </div>
                <div className="bg-card border border-border/90 rounded-2xl rounded-bl-xs overflow-hidden shadow-xs">
                  {/* Cartão de Visualização do Anúncio (Topo) */}
                  <div className="p-2.5 bg-muted/40 border-b border-border/70 flex items-center gap-2.5">
                    <img
                      src={thumbnail}
                      alt="Anúncio Meta"
                      className="w-11 h-11 rounded-lg object-cover border border-border/60 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">Anúncio</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                          Meta Ads
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground hover:underline block truncate cursor-pointer">
                        Ver detalhes
                      </span>
                    </div>
                  </div>

                  {/* Corpo da Mensagem de Saudação com Código */}
                  <div className="p-2.5">
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-medium">
                      {greetingText}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        Mensagem de saudação automática
                      </span>
                      <span className="text-[9px] text-muted-foreground/80">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // D: Balão Normal do Cliente
          if (msg.sender_type === "contact") {
            return (
              <div key={msg.id} className="flex items-end gap-1.5 max-w-[85%] sm:max-w-[70%]">
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0 mb-0.5">
                  {conversation.contact_name[0]}
                </div>
                <div className="bg-card border border-border/80 rounded-xl rounded-bl-xs p-2.5 shadow-2xs">
                  <span className="block text-[9px] font-bold text-muted-foreground mb-0.5">
                    {msg.sender_name || conversation.contact_name}
                  </span>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                  <span className="block text-[9px] text-muted-foreground/80 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          }

          // D: Balão da IA
          if (msg.sender_type === "ai") {
            return (
              <div key={msg.id} className="flex items-end gap-1.5 max-w-[85%] sm:max-w-[70%]">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 mb-0.5 shadow-2xs">
                  <Bot className="w-3 h-3" />
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl rounded-bl-xs p-2.5 shadow-2xs">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-purple-700 dark:text-purple-300 mb-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>IA Recepção</span>
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                  <span className="block text-[9px] text-purple-600/70 dark:text-purple-400/70 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          }

          // E: Balão do Atendente / Advogado (Direita)
          return (
            <div key={msg.id} className="flex items-end justify-end gap-1.5 ml-auto max-w-[85%] sm:max-w-[70%]">
              <div className="bg-primary text-primary-foreground rounded-xl rounded-br-xs p-2.5 shadow-xs">
                <span className="block text-[9px] font-medium text-primary-foreground/80 mb-0.5">
                  {msg.sender_name || "Advogado"}
                </span>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-primary-foreground/80">
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <CheckCircle2 className="w-2.5 h-2.5 inline" />
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Barra de Envio e Atalhos Rápidos */}
      <div className="p-2.5 border-t border-border/60 bg-card shrink-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
            <button
              onClick={() => setIsInternalNoteMode(false)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1",
                !isInternalNoteMode
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-3 h-3 text-emerald-500" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => setIsInternalNoteMode(true)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1",
                isInternalNoteMode
                  ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Lock className="w-3 h-3 text-amber-500" />
              <span>Nota Interna</span>
            </button>
          </div>

          {/* Atalho de Respostas Rápidas */}
          <div className="relative">
            <button
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/60 transition-colors"
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Respostas Rápidas (/)</span>
            </button>

            {showQuickMenu && (
              <div className="absolute bottom-7 right-0 w-72 max-h-60 overflow-y-auto bg-popover border border-border rounded-xl shadow-xl p-1.5 z-50 divide-y divide-border/40">
                <div className="p-1 text-[10px] font-bold text-muted-foreground">Clique para inserir resposta:</div>
                {quickMessages.map((qm) => (
                  <button
                    key={qm.id}
                    onClick={() => insertQuickMessage(qm)}
                    className="w-full text-left p-1.5 hover:bg-muted/70 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary">{qm.title}</span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground">
                        {qm.shortcut}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{qm.content}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div
          className={cn(
            "flex items-end gap-1.5 border rounded-xl p-1.5 focus-within:ring-1 transition-all",
            isInternalNoteMode
              ? "border-amber-500/40 bg-amber-500/5 focus-within:ring-amber-500"
              : "border-border/80 bg-background focus-within:ring-primary"
          )}
        >
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (e.target.value === "/") setShowQuickMenu(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isInternalNoteMode
                ? "Escreva uma observação interna confidencial..."
                : "Digite uma mensagem WhatsApp (Enter para enviar)..."
            }
            rows={1}
            className="flex-1 bg-transparent border-0 resize-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed py-1"
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs shrink-0",
              isInternalNoteMode
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
