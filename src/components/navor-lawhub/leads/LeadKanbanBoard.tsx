import React, { useState } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  GripVertical,
  Plus,
  ShieldCheck,
  TrendingUp,
  User,
  ArrowRight,
  Sparkles,
  Edit3,
  Trash2,
  Phone,
  Calendar,
  Target,
  ExternalLink,
  Minimize2,
  Columns,
  Maximize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { LawLead, LawLeadPipelineStage } from "@/lib/lawhub/lead-types";
import { cn } from "@/lib/utils";
import { useHorizontalKanbanScroll } from "@/hooks/useHorizontalKanbanScroll";

interface LeadKanbanBoardProps {
  stages: LawLeadPipelineStage[];
  leads: LawLead[];
  onMoveLead: (leadId: string, newStageId: string) => void;
  onSelectLead: (lead: LawLead) => void;
  onEditLead?: (lead: LawLead) => void;
  onDeleteLead?: (leadId: string) => void;
  onNewLeadAtStage?: (stageId: string) => void;
  onNewLeadClick?: () => void;
}

export function LeadKanbanBoard({
  stages,
  leads,
  onMoveLead,
  onSelectLead,
  onEditLead,
  onDeleteLead,
  onNewLeadAtStage,
  onNewLeadClick,
}: LeadKanbanBoardProps) {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [density, setDensity] = useState<"compact" | "normal" | "wide">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lawhub_kanban_density");
      if (saved === "compact" || saved === "normal" || saved === "wide") return saved;
    }
    return "compact";
  });

  const handleSetDensity = (newDensity: "compact" | "normal" | "wide") => {
    setDensity(newDensity);
    if (typeof window !== "undefined") {
      localStorage.setItem("lawhub_kanban_density", newDensity);
    }
  };

  const {
    containerRef,
    canScrollLeft,
    canScrollRight,
    scrollToLeft,
    scrollToRight,
  } = useHorizontalKanbanScroll();

  const getLeadsByStage = (stageId: string) => {
    return (leads || []).filter((l) => Boolean(l) && l.stage_id === stageId);
  };

  const getStageTotalValue = (stageLeads: LawLead[]) => {
    return (stageLeads || []).reduce((acc, lead) => acc + (lead?.estimated_value || 0), 0);
  };

  const calculateSlaHoursRemaining = (lead: LawLead, stage: LawLeadPipelineStage) => {
    if (!stage.sla_hours || stage.sla_hours <= 0 || stage.is_won || stage.is_lost) {
      return null;
    }
    const createdAt = new Date(lead.updated_at || lead.created_at).getTime();
    const now = Date.now();
    const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
    const hoursRemaining = Math.round(stage.sla_hours - hoursElapsed);
    return {
      hoursRemaining,
      isExpired: hoursRemaining < 0,
      isWarning: hoursRemaining >= 0 && hoursRemaining <= 12,
    };
  };

  const columnWidthClass =
    density === "compact"
      ? "w-[215px] min-w-[215px]"
      : density === "normal"
      ? "w-[250px] min-w-[250px]"
      : "w-[295px] min-w-[295px]";

  const containerGapClass =
    density === "compact" ? "gap-2" : density === "normal" ? "gap-2.5" : "gap-3.5";

  return (
    <div className="space-y-3">
      {/* Barra de Controle de Densidade e Resumo do Funil */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {stages.length} etapas no funil
          </span>
          <span>•</span>
          <span>
            {(leads || []).length} {(leads || []).length === 1 ? "lead registrado" : "leads registrados"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
            Largura do Funil:
          </span>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <button
              type="button"
              onClick={() => handleSetDensity("compact")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md transition cursor-pointer",
                density === "compact"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400 font-bold"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
              title="Modo Compacto: reduz a largura das etapas para caber na tela sem gerar barra de rolagem excessiva"
            >
              <Minimize2 className="size-3" />
              <span>Compacto (Sem Rolagem)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetDensity("normal")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md transition cursor-pointer",
                density === "normal"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400 font-bold"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
              title="Modo Otimizado: largura equilibrada de 250px"
            >
              <Columns className="size-3" />
              <span>Otimizado</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetDensity("wide")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md transition cursor-pointer",
                density === "wide"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400 font-bold"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
              title="Modo Expandido: largura confortável de 295px"
            >
              <Maximize2 className="size-3" />
              <span>Expandido</span>
            </button>
          </div>
        </div>
      </div>

      {/* Container Principal do Kanban */}
      <div className="relative group">
        {/* Botões Flutuantes de Navegação Lateral Rápida */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={scrollToLeft}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Rolar etapas para a esquerda"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}

        {canScrollRight && (
          <button
            type="button"
            onClick={scrollToRight}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Rolar etapas para a direita"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        <div
          ref={containerRef}
          className={cn(
            "flex overflow-x-auto pb-4 pt-1 select-none navor-kanban-scroll scroll-smooth",
            containerGapClass
          )}
        >
          {stages.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            const totalValue = getStageTotalValue(stageLeads);
            const isDragOver = dragOverStageId === stage.id;

            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStageId(stage.id);
                }}
                onDragLeave={() => {
                  if (dragOverStageId === stage.id) setDragOverStageId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStageId(null);
                  if (draggedLeadId) {
                    onMoveLead(draggedLeadId, stage.id);
                    setDraggedLeadId(null);
                  }
                }}
                className={cn(
                  "flex flex-col flex-shrink-0 max-h-[calc(100vh-210px)] rounded-xl border bg-slate-50/70 dark:bg-slate-900/60 transition-all shadow-2xs",
                  columnWidthClass,
                  isDragOver
                    ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                    : "border-slate-200/80 dark:border-slate-800"
                )}
              >
                {/* Header da Coluna */}
                <div className={cn(
                  "border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 rounded-t-xl",
                  density === "compact" ? "p-2.5" : "p-3"
                )}>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="size-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <h3 className="font-bold text-[11px] uppercase tracking-wide text-slate-800 dark:text-slate-200 truncate" title={stage.name}>
                        {stage.name}
                      </h3>
                      <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px] shrink-0">
                        {stageLeads.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNewLeadAtStage ? onNewLeadAtStage(stage.id) : onNewLeadClick?.()}
                      className="rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition shrink-0 cursor-pointer"
                      title="Adicionar lead nesta etapa"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  {/* Métrica da Coluna & SLA */}
                  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[125px]">
                      {stageLeads.length} {stageLeads.length === 1 ? "lead" : "leads"}
                      {totalValue > 0 && ` • R$ ${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(0)}k` : totalValue}`}
                    </span>

                    {stage.sla_hours > 0 && !stage.is_won && !stage.is_lost && (
                      <span className="text-[9.5px] text-slate-400 flex items-center gap-0.5 font-mono shrink-0">
                        <Clock className="size-2.5" />
                        SLA {stage.sla_hours}h
                      </span>
                    )}
                  </div>
                </div>

                {/* Lista de Cards com Scroll Interno Ergonômico */}
                <div className={cn(
                  "flex-1 overflow-y-auto navor-kanban-scroll",
                  density === "compact" ? "p-2 space-y-1.5" : "p-2.5 space-y-2"
                )}>
                  {stageLeads.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-slate-200/80 dark:border-slate-800 rounded-lg text-[11px] text-slate-400">
                      Nenhum lead nesta etapa
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const sla = calculateSlaHoursRemaining(lead, stage);
                      const isConflict = lead.conflict_check_status === "conflict_detected";

                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDraggedLeadId(lead.id)}
                          onClick={() => onSelectLead(lead)}
                          className={cn(
                            "group relative rounded-xl border bg-white dark:bg-slate-900/90 shadow-2xs hover:shadow-md transition cursor-pointer hover:border-blue-400 dark:hover:border-blue-600",
                            density === "compact" ? "p-2 space-y-1.5" : "p-2.5 space-y-2",
                            isConflict
                              ? "border-rose-300 dark:border-rose-900 bg-rose-50/20"
                              : "border-slate-200/90 dark:border-slate-800"
                          )}
                        >
                          {/* Topo do Card: Área, Código de Tráfego e Botões Rápidos */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 flex-wrap min-w-0">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[9px] font-bold border border-blue-200/60 dark:border-blue-800 truncate max-w-[95px]">
                                {lead.area_direito}
                              </span>

                              {lead.traffic_code && (
                                <span className="px-1 py-0.2 rounded bg-indigo-600 text-white font-mono text-[8.5px] font-bold shrink-0">
                                  {lead.traffic_code}
                                </span>
                              )}

                              {lead.lead_type === "futuro" && (
                                <span className="px-1 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-[8.5px] font-bold border border-purple-300/80 flex items-center gap-0.5 shrink-0">
                                  <Calendar className="size-2 text-purple-600" />
                                  Futuro
                                </span>
                              )}
                            </div>

                            {/* Botões Rápidos de Editar e Excluir no Card */}
                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {isConflict && (
                                <span
                                  className="inline-flex items-center p-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[8.5px] font-bold border border-rose-300 mr-0.5"
                                  title={lead.conflict_notes || "Conflito ético detectado"}
                                >
                                  <AlertTriangle className="size-2.5 text-rose-600" />
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => (onEditLead ? onEditLead(lead) : onSelectLead(lead))}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                title="Editar lead"
                              >
                                <Edit3 className="size-3" />
                              </button>

                              {onDeleteLead && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteLead(lead.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Excluir lead"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Nome do Lead e Detalhes */}
                          <div>
                            <h4 className="font-bold text-[11.5px] text-slate-900 dark:text-white line-clamp-1 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition" title={lead.name}>
                              {lead.name}
                            </h4>
                            {lead.opposing_party && (
                              <p className="text-[9.5px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 truncate" title={`vs. ${lead.opposing_party}`}>
                                vs. <span className="font-semibold text-slate-700 dark:text-slate-300">{lead.opposing_party}</span>
                              </p>
                            )}
                            {lead.traffic_action_name && (
                              <p className="text-[9.5px] text-indigo-600 dark:text-indigo-400 line-clamp-1 mt-0.5 font-medium truncate" title={lead.traffic_action_name}>
                                🎯 {lead.traffic_action_name}
                              </p>
                            )}
                          </div>

                          {/* Informações de Contato e Canal */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80 gap-1">
                            {lead.phone ? (
                              <a
                                href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline truncate max-w-[125px]"
                                title={lead.phone}
                              >
                                <Phone className="size-2.5 shrink-0" />
                                <span className="truncate">{lead.phone}</span>
                              </a>
                            ) : (
                              <span className="text-[9.5px] text-slate-400 italic">Sem fone</span>
                            )}

                            <span
                              className={cn(
                                "rounded px-1.5 py-0.2 text-[8.5px] font-bold uppercase shrink-0",
                                lead.estimated_success_rate === "alta"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : lead.estimated_success_rate === "baixa"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              )}
                            >
                              Êxito {lead.estimated_success_rate}
                            </span>
                          </div>

                          {/* Bloco Exclusivo de Lead Futuro (Agendamento & Observações) */}
                          {lead.lead_type === "futuro" && (
                            <div className="p-1.5 rounded-lg bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/60 text-[9.5px] space-y-0.5">
                              <div className="flex items-center justify-between font-semibold text-purple-700 dark:text-purple-300 gap-1">
                                <span className="flex items-center gap-1 truncate">
                                  <Calendar className="size-2.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                  Retorno: {lead.future_contact_date ? new Date(lead.future_contact_date + "T12:00:00").toLocaleDateString("pt-BR") : "A definir"} {lead.future_contact_time || ""}
                                </span>
                                {lead.responsible_name && (
                                  <span className="text-[8.5px] text-slate-500 dark:text-slate-400 truncate max-w-[70px]" title={lead.responsible_name}>
                                    {lead.responsible_name}
                                  </span>
                                )}
                              </div>
                              {lead.future_contact_reason && (
                                <p className="text-[9px] text-slate-600 dark:text-slate-400 line-clamp-1 italic truncate" title={lead.future_contact_reason}>
                                  &ldquo;{lead.future_contact_reason}&rdquo;
                                </p>
                              )}
                            </div>
                          )}

                          {/* Rodapé do Card: Origem e Alerta de SLA */}
                          <div className="flex items-center justify-between text-[9.5px] text-slate-400 pt-0.5">
                            <span className="truncate max-w-[110px]" title={lead.source}>
                              {lead.lead_type === "futuro" && lead.future_contact_date
                                ? `Ret: ${lead.future_contact_date.split("-").reverse().slice(0, 2).join("/")}`
                                : lead.source}
                            </span>

                            {sla && (
                              <span
                                className={cn(
                                  "font-bold flex items-center gap-0.5 shrink-0",
                                  sla.isExpired
                                    ? "text-rose-600 dark:text-rose-400 animate-pulse"
                                    : sla.isWarning
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-400"
                                )}
                                title={
                                  sla.isExpired
                                    ? `SLA Estourado em ${Math.abs(sla.hoursRemaining)} horas!`
                                    : `Restam ${sla.hoursRemaining}h dentro do SLA`
                                }
                              >
                                <Clock className="size-2.5" />
                                {sla.isExpired ? `+${Math.abs(sla.hoursRemaining)}h` : `${sla.hoursRemaining}h`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
