import { useEffect, useState } from "react";
import {
  User,
  Phone,
  Briefcase,
  ExternalLink,
  Plus,
  History,
  CheckCircle2,
  ShieldCheck,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LawConversation, LawDepartment, LawTransfer } from "@/lib/lawhub/atendimento-types";
import { listLawHubLeads, moveLawHubLead } from "@/lib/lawhub/lead.functions";
import { ValidateContactModal } from "./ValidateContactModal";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface ContactLeadWorkspaceColumnProps {
  conversation: LawConversation | null;
  departments: LawDepartment[];
  transfers: LawTransfer[];
  onOpenCreateLeadModal: () => void;
  onLeadStageChanged?: () => void;
}

export function ContactLeadWorkspaceColumn({
  conversation,
  departments,
  transfers,
  onOpenCreateLeadModal,
  onLeadStageChanged,
}: ContactLeadWorkspaceColumnProps) {
  const [isValidateModalOpen, setIsValidateModalOpen] = useState(false);
  const [stages, setStages] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    void listLawHubLeads({ data: { pipelineId: "pipe-principal" } }).then((result) => { if (active) setStages(result.stages as any[]); }).catch(() => { if (active) setStages([]); });
    return () => { active = false; };
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="w-72 lg:w-80 flex-shrink-0 bg-card border-l border-border/60 p-4 flex flex-col items-center justify-center text-center text-muted-foreground text-xs select-none">
        <Briefcase className="w-6 h-6 text-muted-foreground/40 mb-1.5" />
        <p>Selecione uma conversa para ver dados do Lead.</p>
      </div>
    );
  }

  const lead = conversation.lead;

  const handleStageChange = async (newStageId: string) => {
    if (!lead) return;
    try {
      await moveLawHubLead({ data: { leadId: lead.id, stageId: newStageId } });
      toast.success("Etapa do lead atualizada!");
      if (onLeadStageChanged) onLeadStageChanged();
    } catch (e: any) {
      toast.error(e.message || "Erro ao mover etapa do lead.");
    }
  };

  return (
    <div className="w-72 lg:w-80 flex-shrink-0 bg-card border-l border-border/60 flex flex-col h-full overflow-y-auto divide-y divide-border/60 select-none text-xs">
      {/* 1. Card do Contato */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider">
            Dados do Contato
          </h3>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
            {conversation.contact_name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-foreground leading-snug truncate">
              {conversation.contact_name}
            </h4>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone className="w-2.5 h-2.5 text-emerald-500" />
              <span>{conversation.contact_phone}</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" />
              WhatsApp Vinculado
            </span>
          </div>
        </div>
      </div>

      {/* 2. Mini Painel do Lead / Pipeline Jurídico */}
      <div className="p-3 space-y-2 bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider">
              Lead Jurídico
            </h3>
          </div>
          {lead && (
            <Link
              to="/lawhub/leads"
              className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Ver no Funil</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          )}
        </div>

        {lead ? (
          <div className="space-y-2 bg-card border border-border/80 rounded-lg p-2.5 shadow-2xs">
            {/* Status / Enquadramento da Validação */}
            <div className="p-2 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between">
              <span className="text-[10px] font-bold flex items-center gap-1.5">
                {lead.lead_type === "futuro" ? (
                  <>
                    <CalendarClock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span className="text-purple-700 dark:text-purple-300">Lead Futuro (Agendado)</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">Lead Válido e Apto</span>
                  </>
                )}
              </span>

              <button
                type="button"
                onClick={() => setIsValidateModalOpen(true)}
                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
              >
                Revalidar
              </button>
            </div>

            <div>
              <span className="text-[9px] font-medium text-muted-foreground block">Demanda / Causa:</span>
              <h4 className="text-xs font-bold text-foreground truncate mt-0.5">{lead.name}</h4>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="p-1.5 rounded-md bg-muted/40 border border-border/50">
                <span className="text-[9px] text-muted-foreground block">Área</span>
                <span className="font-bold text-foreground truncate block">{lead.area_direito}</span>
              </div>
              <div className="p-1.5 rounded-md bg-muted/40 border border-border/50">
                <span className="text-[9px] text-muted-foreground block">Valor Estimado</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                  {(lead.estimated_value ?? 0) > 0
                    ? (lead.estimated_value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                    : "A calcular"}
                </span>
              </div>
            </div>

            {/* Seletor Rápido de Etapa */}
            <div>
              <label className="text-[9px] font-medium text-muted-foreground block mb-0.5">
                Etapa do Pipeline:
              </label>
              <select
                value={lead.stage_id}
                onChange={(e) => handleStageChange(e.target.value)}
                className="w-full text-xs font-semibold py-1 px-1.5 rounded-md bg-background border border-border/80 text-foreground cursor-pointer focus:ring-1 focus:ring-primary"
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-dashed border-border rounded-lg p-3 text-center space-y-2.5">
            <p className="text-[11px] text-muted-foreground">
              Sem Lead validado para este contato.
            </p>
            <Button
              size="sm"
              onClick={() => setIsValidateModalOpen(true)}
              className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-8 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>VALIDAR CONTATO</span>
            </Button>
          </div>
        )}
      </div>

      {/* 3. Timeline / Histórico da Conversa */}
      <div className="p-3 space-y-2 flex-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <History className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider">
            Linha do Tempo
          </h3>
        </div>

        <div className="space-y-2.5 text-[11px] border-l-2 border-border/70 pl-3 ml-1">
          {/* Início */}
          <div className="relative">
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -left-[17px] top-1 ring-3 ring-background" />
            <span className="text-[9px] text-muted-foreground block">
              {new Date(conversation.first_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <p className="font-semibold text-foreground">Início via WhatsApp</p>
          </div>

          {/* Triagem IA */}
          {conversation.ai_summary && (
            <div className="relative">
              <span className="w-2 h-2 rounded-full bg-purple-500 absolute -left-[17px] top-1 ring-3 ring-background" />
              <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold block">
                Triagem IA
              </span>
              <p className="text-foreground/90 truncate">
                Demanda: <strong>{conversation.ai_detected_area || "Jurídico"}</strong>
              </p>
            </div>
          )}

          {/* Lead Vinculado */}
          {conversation.lead && (
            <div className="relative">
              <span className="w-2 h-2 rounded-full bg-blue-500 absolute -left-[17px] top-1 ring-3 ring-background" />
              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold block">
                Lead Vinculado
              </span>
              <p className="text-foreground/90">Lead #{conversation.lead.id.slice(-3)}</p>
            </div>
          )}

          {/* Transferências */}
          {transfers.map((tr) => (
            <div key={tr.id} className="relative">
              <span className="w-2 h-2 rounded-full bg-amber-500 absolute -left-[17px] top-1 ring-3 ring-background" />
              <span className="text-[9px] text-muted-foreground block">
                {new Date(tr.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <p className="font-semibold text-foreground">
                Transferido: {tr.to_department_name}
              </p>
            </div>
          ))}

          {/* Status Atual */}
          <div className="relative">
            <span className="w-2 h-2 rounded-full bg-indigo-500 absolute -left-[17px] top-1 ring-3 ring-background" />
            <span className="text-[9px] text-muted-foreground block">Status Atual</span>
            <p className="font-semibold text-foreground">
              {conversation.assigned_user_name
                ? `${conversation.assigned_user_name}`
                : "Na fila do setor"}
            </p>
          </div>
        </div>
      </div>

      {/* Modal Oficial de Validação do Lead pelo Call Center */}
      <ValidateContactModal
        isOpen={isValidateModalOpen}
        onClose={() => setIsValidateModalOpen(false)}
        conversation={conversation}
        onValidated={() => {
          if (onLeadStageChanged) onLeadStageChanged();
        }}
      />
    </div>
  );
}
