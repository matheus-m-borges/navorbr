import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Calendar,
  Clock,
  X,
  ShieldCheck,
  CalendarClock,
  ArrowRight,
  Phone,
  Tag,
  AlertCircle,
  FileText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LawConversation } from "@/lib/lawhub/atendimento-types";
import type { LawLead } from "@/lib/lawhub/lead-types";
import { validateLawHubContactAsLead } from "@/lib/lawhub/lead.functions";
import { useCurrentUser } from "@/hooks/useSession";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ValidateContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: LawConversation | null;
  onValidated: (lead: LawLead) => void;
}

export function ValidateContactModal({
  isOpen,
  onClose,
  conversation,
  onValidated,
}: ValidateContactModalProps) {
  const { user } = useCurrentUser();

  const [option, setOption] = useState<"imediato" | "futuro">("imediato");
  const [futureDate, setFutureDate] = useState("");
  const [futureTime, setFutureTime] = useState("10:00");
  const [futureReason, setFutureReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializa dados com base na conversa
  useEffect(() => {
    if (!isOpen || !conversation) return;

    // Se a conversa já possuía um lead futuro agendado, preenche
    if (conversation.lead?.lead_type === "futuro" && conversation.lead.future_contact_date) {
      setOption("futuro");
      setFutureDate(conversation.lead.future_contact_date);
    } else {
      setOption("imediato");
      // Sugestão de data futura padrão: 15 dias à frente
      const suggestedDate = new Date(Date.now() + 86400000 * 15).toISOString().split("T")[0];
      setFutureDate(suggestedDate ?? "");
    }

    setFutureTime("10:00");
    setFutureReason("");
    setNotes("");
    setIsSubmitting(false);
  }, [isOpen, conversation]);

  if (!isOpen || !conversation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Proteção rigorosa contra duplo clique / concorrência
    if (isSubmitting) return;

    if (option === "futuro") {
      if (!futureDate) {
        toast.error("A Data para Novo Contato é obrigatória para Lead Apto para o Futuro.");
        return;
      }
      const todayStr = new Date().toISOString().split("T")[0] ?? "";
      if (futureDate < todayStr) {
        toast.error("A data de retorno para contato deve ser hoje ou uma data futura.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const actorName = user?.name || "Operador Call Center";

      const lead = await validateLawHubContactAsLead({ data: {
        existingLeadId: conversation.lead_id || undefined,
        name: conversation.contact_name,
        phone: conversation.contact_phone,
        area: conversation.ai_detected_area || "Geral",
        option,
        futureContactDate: option === "futuro" ? futureDate : undefined,
        futureContactTime: option === "futuro" ? futureTime : undefined,
        futureContactReason: option === "futuro" ? (futureReason.trim() || undefined) : undefined,
        notes: notes.trim() || undefined,
        trafficCode: conversation.traffic_code || undefined,
        trafficAction: conversation.traffic_action_name || undefined,
      } });

      if (option === "imediato") {
        toast.success(
          `Contato validado com sucesso como "LEAD VÁLIDO E APTO"! Encaminhado para a Pipeline Principal.`
        );
      } else {
        toast.success(
          `Contato validado como "LEAD APTO PARA O FUTURO" para ${new Date(futureDate + "T12:00:00").toLocaleDateString("pt-BR")}. Alerta programado!`
        );
      }

      onValidated(lead as LawLead);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Falha ao validar contato.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Oficial do Modal */}
        <div className="p-4 border-b border-border/80 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">VALIDAR CONTATO</h3>
              <p className="text-[11px] text-muted-foreground">
                Qualificação oficial do atendimento do Call Center para o Funil de Oportunidades
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário com Dados Capturados & Opções */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Card Informativo com Dados Já Capturados (Sem Re-digitação) */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3 text-primary" />
                Dados Capturados do WhatsApp
              </span>
              {conversation.traffic_code && (
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[9px] font-bold">
                  Código: {conversation.traffic_code}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[9px] text-muted-foreground block">Nome do Contato</span>
                <span className="font-bold text-foreground">{conversation.contact_name || "Não informado"}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground block">Telefone / WhatsApp</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {conversation.contact_phone || "Não informado"}
                </span>
              </div>
              {conversation.traffic_action_name && (
                <div className="sm:col-span-2">
                  <span className="text-[9px] text-muted-foreground block">Ação Referenciada no Tráfego</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    🎯 {conversation.traffic_action_name}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/50">
              * Dados preservados integralmente. Nenhuma re-digitação de nome, telefone ou código é necessária.
            </p>
          </div>

          {/* Seleção Obrigatória das Duas Opções */}
          <div className="space-y-2">
            <label className="font-bold text-xs text-foreground block">
              Selecione o Enquadramento da Validação:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* OPÇÃO 1: LEAD VÁLIDO E APTO */}
              <button
                type="button"
                onClick={() => setOption("imediato")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2",
                  option === "imediato"
                    ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 dark:border-emerald-500"
                    : "bg-card border-border hover:bg-muted/50"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <input
                    type="radio"
                    name="validationOption"
                    checked={option === "imediato"}
                    onChange={() => setOption("imediato")}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                    LEAD VÁLIDO E APTO
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    Lead pronto para triagem imediata. Entra na <strong>Pipeline Principal</strong> (LEADs).
                  </p>
                </div>
              </button>

              {/* OPÇÃO 2: LEAD APTO PARA O FUTURO */}
              <button
                type="button"
                onClick={() => setOption("futuro")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2",
                  option === "futuro"
                    ? "bg-purple-50/70 border-purple-500 ring-2 ring-purple-500/20 dark:bg-purple-950/40 dark:border-purple-500"
                    : "bg-card border-border hover:bg-muted/50"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                    <CalendarClock className="w-4 h-4" />
                  </span>
                  <input
                    type="radio"
                    name="validationOption"
                    checked={option === "futuro"}
                    onChange={() => setOption("futuro")}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-purple-900 dark:text-purple-200">
                    LEAD APTO PARA O FUTURO
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    Retorno programado. Entra na <strong>Pipeline de Leads Futuros</strong> com alerta.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Campos Exclusivos da OPÇÃO 2 (Lead Apto para o Futuro) */}
          {option === "futuro" && (
            <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-50/40 dark:bg-purple-950/20 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-bold text-xs">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>Programação de Novo Contato</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Data para Novo Contato *
                  </label>
                  <input
                    type="date"
                    value={futureDate}
                    onChange={(e) => setFutureDate(e.target.value)}
                    required
                    className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground font-semibold"
                  />
                  <span className="text-[9px] text-muted-foreground mt-0.5 block">
                    Data obrigatória para disparo do alerta
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Horário Sugerido
                  </label>
                  <input
                    type="time"
                    value={futureTime}
                    onChange={(e) => setFutureTime(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground font-semibold"
                  />
                  <span className="text-[9px] text-muted-foreground mt-0.5 block">
                    Padrão: 10:00 (horário comercial)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">
                  Observação do Retorno (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={futureReason}
                  onChange={(e) => setFutureReason(e.target.value)}
                  placeholder="Ex: Cliente informou que pretende se aposentar somente no final do ano."
                  className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground resize-none"
                />
              </div>
            </div>
          )}

          {/* Observações Gerais do Atendimento (Opcional) */}
          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              Notas Adicionais do Call Center (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações para a equipe jurídica..."
              className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground"
            />
          </div>

          {/* Botões do Rodapé com Proteção de Duplo Clique */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "h-8 text-xs font-bold text-white shadow-xs cursor-pointer flex items-center gap-1.5 transition-all",
                option === "imediato"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-purple-600 hover:bg-purple-700"
              )}
            >
              {isSubmitting ? (
                <span>Validando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {option === "imediato"
                      ? "Confirmar Lead Válido e Apto"
                      : "Confirmar Lead Apto para o Futuro"}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
