// @ts-nocheck — tipos legados do LawHub em migração
import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Briefcase,
  FileText,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Percent,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Layers,
  Target,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useSession";
import type {
  LawLead,
  LawLeadPipelineStage,
  LawLeadCustomField,
  LawLeadProposal,
  FeeType,
  SuccumbencyRule,
} from "@/lib/lawhub/lead-types";
import { LawHubAtendimentoService } from "@/lib/lawhub/atendimento-service";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { addLawHubLeadTimelineEntry, checkLawHubLeadConflict, convertLawHubLeadToClient, getLawHubLeadWorkspace, moveLawHubLead, returnLawHubFutureLeadToMain, saveLawHubLeadProposal, updateLawHubLead } from "@/lib/lawhub/lead.functions";

interface LeadWorkspaceDrawerProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: () => void;
  onConvertSuccess: () => void;
}

export function LeadWorkspaceDrawer({
  leadId,
  isOpen,
  onClose,
  onLeadUpdated,
  onConvertSuccess,
}: LeadWorkspaceDrawerProps) {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<"overview" | "proposal" | "custom_fields" | "timeline" | "whatsapp">("overview");
  const [lead, setLead] = useState<LawLead | null>(null);
  const [stages, setStages] = useState<LawLeadPipelineStage[]>([]);
  const [customFields, setCustomFields] = useState<LawLeadCustomField[]>([]);

  // Estados da Proposta
  const [feeType, setFeeType] = useState<FeeType>("exito");
  const [fixedAmount, setFixedAmount] = useState<string>("0");
  const [successPercentage, setSuccessPercentage] = useState<string>("20");
  const [hourlyRate, setHourlyRate] = useState<string>("350");
  const [monthlyAmount, setMonthlyAmount] = useState<string>("2500");
  const [perActAmount, setPerActAmount] = useState<string>("1500");
  const [consultationAmount, setConsultationAmount] = useState<string>("400");
  const [installments, setInstallments] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentConditions, setPaymentConditions] = useState("");
  const [succumbencyRule, setSuccumbencyRule] = useState<SuccumbencyRule>("escritorio_100");
  const [proposalStatus, setProposalStatus] = useState<"draft" | "sent" | "accepted" | "rejected">("draft");

  // Estado para nota rápida na timeline
  const [quickNote, setQuickNote] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [futureDateEdit, setFutureDateEdit] = useState("");

  // Estados de edição de campos customizados
  const [leadCustomValues, setLeadCustomValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!leadId || !isOpen) return;
    loadLeadData(leadId);
  }, [leadId, isOpen]);

  const loadLeadData = async (id: string) => {
    try {
      const workspace = await getLawHubLeadWorkspace({ data: { leadId: id } });
      const l = workspace.lead as LawLead;
      setLead({ ...l, proposals: workspace.proposals as LawLeadProposal[], timeline: workspace.timeline as any } as LawLead);
      setLeadCustomValues(l.custom_fields || {});
      setFutureDateEdit(l.future_contact_date || "");
      setStages(workspace.stages as LawLeadPipelineStage[]);
      setCustomFields(workspace.customFields as LawLeadCustomField[]);

      // Carrega proposta se existir
      const props = workspace.proposals as LawLeadProposal[];
      if (props.length > 0) {
        const p = props[0];
        setFeeType(p.fee_type);
        setFixedAmount(String(p.fixed_amount || 0));
        setSuccessPercentage(String(p.success_percentage || 0));
        setHourlyRate(String(p.hourly_rate || 0));
        setMonthlyAmount(String(p.monthly_amount || 0));
        setPerActAmount(String(p.per_act_amount || 0));
        setConsultationAmount(String(p.consultation_amount || 0));
        setInstallments(p.installments || 1);
        setPaymentMethod(p.payment_method || "pix");
        setPaymentConditions(p.payment_conditions || "");
        setSuccumbencyRule(p.succumbency_rule || "escritorio_100");
        setProposalStatus(p.status || "draft");
      }
    } catch (error: any) { toast.error(error?.message || "Falha ao carregar dados reais do lead."); }
  };

  if (!isOpen || !lead) return null;

  const handleStageChange = async (newStageId: string) => {
    try { await moveLawHubLead({ data: { leadId: lead.id, stageId: newStageId } }); await loadLeadData(lead.id); onLeadUpdated(); toast.success("Etapa do lead atualizada com sucesso!"); }
    catch (error: any) { toast.error(error?.message || "Falha ao atualizar etapa."); }
  };

  const handlePromoteToImmediate = async () => {
    const target = stages.find((stage) => stage.pipeline_id === "pipe-principal" && !stage.is_won && !stage.is_lost);
    if (!target) { toast.error("Nenhuma etapa real disponível no pipeline principal."); return; }
    try { await returnLawHubFutureLeadToMain({ data: { leadId: lead.id, stageId: target.id } }); await loadLeadData(lead.id); onLeadUpdated(); toast.success(`Lead "${lead.name}" promovido para Atendimento Imediato no funil!`); }
    catch (error: any) { toast.error(error?.message || "Falha ao retornar lead futuro."); }
  };

  const handleFutureDateUpdate = async () => {
    if (!futureDateEdit || !lead) return;
    try { await updateLawHubLead({ data: { leadId: lead.id, changes: { future_contact_date: futureDateEdit } } }); await addLawHubLeadTimelineEntry({ data: { leadId: lead.id, eventType: "stage_change", description: `Data de novo contato alterada para ${futureDateEdit}.` } }); await loadLeadData(lead.id); onLeadUpdated(); toast.success("Data de retorno atualizada."); }
    catch (error: any) { toast.error(error?.message || "Falha ao atualizar data de retorno."); }
  };

  const handleRecheckConflict = async () => {
    if (!lead.opposing_party) {
      toast.info("Informe o nome da parte contrária para checar conflitos.");
      return;
    }
    try {
    const check = await checkLawHubLeadConflict({ data: { opposingParty: lead.opposing_party, opposingPartyDoc: lead.opposing_party_doc } });
    const updated = await updateLawHubLead({ data: { leadId: lead.id, changes: { conflict_check_status: check.hasConflict ? "conflict_detected" : "cleared", conflict_notes: check.notes } } });
    setLead(updated);
    onLeadUpdated();
    if (check.hasConflict) {
      toast.error("Alerta: Conflito de interesses detectado!");
    } else {
      toast.success("Checagem de conflitos limpa! Sem impedimentos éticos.");
    }
    } catch (error: any) { toast.error(error?.message || "Falha na checagem real de conflito."); }
  };

  const handleSaveProposal = async () => {
    const fixedNum = Number(fixedAmount) || 0;
    const instNum = Number(installments) || 1;
    const instVal = instNum > 1 ? fixedNum / instNum : fixedNum;

    try { await saveLawHubLeadProposal({ data: { leadId: lead.id, proposal: {
      lead_id: lead.id,
      fee_type: feeType,
      fixed_amount: fixedNum,
      success_percentage: Number(successPercentage) || 0,
      hourly_rate: Number(hourlyRate) || 0,
      monthly_amount: Number(monthlyAmount) || 0,
      per_act_amount: Number(perActAmount) || 0,
      consultation_amount: Number(consultationAmount) || 0,
      installments: instNum,
      installment_value: instVal,
      payment_method: paymentMethod,
      payment_conditions: paymentConditions,
      succumbency_rule: succumbencyRule,
      status: proposalStatus,
    } } });

    loadLeadData(lead.id);
    onLeadUpdated();
    toast.success("Proposta de honorários gravada com sucesso!"); } catch (error: any) { toast.error(error?.message || "Falha ao gravar proposta."); }
  };

  const handleSaveCustomFields = async () => {
    try { await updateLawHubLead({ data: { leadId: lead.id, changes: { custom_fields: leadCustomValues } } }); await loadLeadData(lead.id); onLeadUpdated(); toast.success("Campos específicos salvos!"); }
    catch (error: any) { toast.error(error?.message || "Falha ao salvar campos específicos."); }
  };

  const handleAddQuickNote = async () => {
    if (!quickNote.trim()) return;
    try { await addLawHubLeadTimelineEntry({ data: { leadId: lead.id, eventType: "note", description: quickNote.trim() } });
    setQuickNote("");
    loadLeadData(lead.id);
    toast.success("Nota registrada na timeline!"); } catch (error: any) { toast.error(error?.message || "Falha ao registrar nota."); }
  };

  const handleConvertLead = async () => {
    setIsConverting(true);
    try {
      const result = await convertLawHubLeadToClient({ data: { leadId: lead.id } });
      toast.success(`Lead "${lead.name}" convertido em cliente real. Processo deverá ser iniciado separadamente.`, {
        duration: 5000,
      });
      loadLeadData(lead.id);
      onLeadUpdated();
      onConvertSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`Falha ao converter lead: ${err.message || String(err)}`);
    } finally {
      setIsConverting(false);
    }
  };

  const isConflict = lead.conflict_check_status === "conflict_detected";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full overflow-hidden">
        {/* Cabeçalho do Drawer */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-black border border-blue-200 dark:border-blue-800">
                  <Briefcase className="size-3 text-blue-600" />
                  {lead.area_direito}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ID: #{lead.id.slice(-6)}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {lead.name}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Dados de Contato e Link WhatsApp */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {lead.phone && (
              <a
                href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                title="Abrir conversa no WhatsApp"
              >
                <Phone className="size-3.5" />
                <span>{lead.phone}</span>
                <ExternalLink className="size-2.5" />
              </a>
            )}

            {lead.email && (
              <span className="flex items-center gap-1 text-slate-500">
                <Mail className="size-3.5" />
                <span>{lead.email}</span>
              </span>
            )}

            {lead.document_number && (
              <span className="text-slate-400 font-mono">
                Doc: {lead.document_number}
              </span>
            )}
          </div>

          {/* Alerta de Conflito de Interesses */}
          {lead.opposing_party && (
            <div
              className={cn(
                "rounded-xl border p-3 text-xs space-y-1",
                isConflict
                  ? "border-rose-300 bg-rose-50/90 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
                  : "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  {isConflict ? (
                    <AlertTriangle className="size-4 text-rose-600" />
                  ) : (
                    <ShieldCheck className="size-4 text-emerald-600" />
                  )}
                  <span>
                    Parte Contrária: <strong>{lead.opposing_party}</strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRecheckConflict}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white underline flex items-center gap-1"
                >
                  <RefreshCw className="size-2.5" /> Re-checar
                </button>
              </div>

              <p className="text-[11px] leading-relaxed">
                {lead.conflict_notes ||
                  (isConflict
                    ? "Possível conflito com cliente existente no acervo."
                    : "Sem conflito ético detectado na base de clientes e processos.")}
              </p>
            </div>
          )}

          {/* Barra de Ação de Etapa e Conversão */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Etapa:
              </label>
              <select
                value={lead.stage_id}
                onChange={(e) => handleStageChange(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none"
              >
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.is_won ? "(Ganho)" : st.is_lost ? "(Perdido)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={isConverting}
              onClick={handleConvertLead}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <Sparkles className="size-3.5 text-amber-300" />
              <span>{isConverting ? "Convertendo..." : "Converter em Cliente & Processo"}</span>
            </button>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 px-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "px-3.5 py-3 border-b-2 transition -mb-px flex items-center gap-1.5",
              activeTab === "overview"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <User className="size-3.5" />
            <span>Visão Geral</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("proposal")}
            className={cn(
              "px-3.5 py-3 border-b-2 transition -mb-px flex items-center gap-1.5",
              activeTab === "proposal"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <DollarSign className="size-3.5" />
            <span>Proposta de Honorários</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("custom_fields")}
            className={cn(
              "px-3.5 py-3 border-b-2 transition -mb-px flex items-center gap-1.5",
              activeTab === "custom_fields"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Layers className="size-3.5" />
            <span>Campos do Escritório</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={cn(
              "px-3.5 py-3 border-b-2 transition -mb-px flex items-center gap-1.5",
              activeTab === "timeline"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Clock className="size-3.5" />
            <span>Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("whatsapp")}
            className={cn(
              "px-3.5 py-3 border-b-2 transition -mb-px flex items-center gap-1.5",
              activeTab === "whatsapp"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <MessageSquare className="size-3.5 text-emerald-500" />
            <span>CallCenter</span>
          </button>
        </div>

        {/* Conteúdo da Aba com Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ========================================================================= */}
          {/* ABA 1: VISÃO GERAL                                                        */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-4 text-xs animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Card 1: Classificação do Lead */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Classificação & Status
                  </span>
                  <div>
                    {lead.lead_type === "futuro" ? (
                      <div className="space-y-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-500/30">
                          <Calendar className="size-3.5" />
                          Lead Futuro Agendado
                        </span>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          Retorno: <strong>{lead.future_contact_date || "A definir"}</strong> às {lead.future_contact_time || "horário comercial"}
                        </p>
                        <div className="flex items-center gap-2">
                          <input type="date" value={futureDateEdit} onChange={(event) => setFutureDateEdit(event.target.value)} className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" />
                          <button type="button" onClick={handleFutureDateUpdate} className="rounded-lg bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-600">Salvar data</button>
                        </div>
                        {lead.future_contact_reason && (
                          <p className="text-[11px] text-muted-foreground italic">
                            &quot;{lead.future_contact_reason}&quot;
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handlePromoteToImmediate}
                          className="w-full mt-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sparkles className="size-3" />
                          Promover para Atendimento Imediato
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-500/30">
                          ⚡ Atendimento Imediato (Funil de LEADs)
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Lead qualificado em triagem ativa no pipeline.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 2: Tráfego Pago & Ação Referenciada */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Origem / Tráfego Pago
                  </span>
                  <div>
                    {lead.traffic_code ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-mono text-xs font-black bg-indigo-600 text-white shadow-2xs">
                            {lead.traffic_code}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {lead.traffic_action_name || "Ação de Campanha"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Canal: {lead.source}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {lead.source || "Indicação / Orgânico"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Sem código de campanha específico
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Anotações e Resumo do Caso */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-white dark:bg-slate-900">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide text-[11px]">
                  Resumo dos Fatos & Observações de Atendimento
                </h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {lead.notes || "Nenhuma observação detalhada registrada no momento da triagem."}
                </p>
              </div>

              {/* Origem e Responsável */}
              <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-400 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Canal de Captação:</span>{" "}
                  {lead.source}
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Advogado Responsável:</span>{" "}
                  {lead.responsible_name || "Dr. Matheus Borges"}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: PROPOSTA DE HONORÁRIOS (MATRIZ JURÍDICA)                           */}
          {/* ========================================================================= */}
          {activeTab === "proposal" && (
            <div className="space-y-4 text-xs animate-in fade-in">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Matriz de Honorários da Advocacia
                  </h4>
                  <span className="rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5">
                    Contratação Jurídica Real
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Defina o modelo de cobrança para gerar a proposta contratual de prestação de serviços advocatícios.
                </p>
              </div>

              {/* Seletor dos 7 Formatos */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Modelo de Honorários
                </label>
                <select
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value as FeeType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="exito">Quota Litis / Êxito (% sobre o proveito econômico)</option>
                  <option value="fixo">Pró-Labore Fixo (Entrada fixa parcelada)</option>
                  <option value="misto">Misto (Pró-Labore Inicial + % de Êxito)</option>
                  <option value="partido_mensal">Partido Mensal (Assessoria Contínua / Retainer)</option>
                  <option value="hora">Por Hora Técnica (Com teto / cap prévio)</option>
                  <option value="ato">Por Ato / Diligência (Parecer, recurso, audiência)</option>
                  <option value="consulta">Consulta Avulsa (Cobrança antecipada)</option>
                </select>
              </div>

              {/* Campos dinâmicos baseados no feeType */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {(feeType === "exito" || feeType === "misto") && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Percent className="size-3 text-blue-500" />
                      Percentual de Êxito (Quota Litis)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={successPercentage}
                        onChange={(e) => setSuccessPercentage(e.target.value)}
                        placeholder="Ex: 20 ou 30"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                )}

                {(feeType === "fixo" || feeType === "misto") && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <DollarSign className="size-3 text-emerald-500" />
                      Valor Pró-Labore (R$)
                    </label>
                    <input
                      type="number"
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount(e.target.value)}
                      placeholder="Ex: 5000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}

                {feeType === "partido_mensal" && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Mensalidade / Retainer (R$/mês)
                    </label>
                    <input
                      type="number"
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}

                {feeType === "hora" && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Valor da Hora Técnica (R$/h)
                    </label>
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}

                {feeType === "ato" && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Valor por Ato / Diligência (R$)
                    </label>
                    <input
                      type="number"
                      value={perActAmount}
                      onChange={(e) => setPerActAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}

                {feeType === "consulta" && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Valor da Consulta Jurídica (R$)
                    </label>
                    <input
                      type="number"
                      value={consultationAmount}
                      onChange={(e) => setConsultationAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}

                {/* Parcelamento para Pró-Labore */}
                {(feeType === "fixo" || feeType === "misto") && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Número de Parcelas
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value={1}>À vista (1x)</option>
                      <option value={2}>2 parcelas</option>
                      <option value={3}>3 parcelas</option>
                      <option value={4}>4 parcelas</option>
                      <option value={6}>6 parcelas</option>
                      <option value={10}>10 parcelas</option>
                      <option value={12}>12 parcelas</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Regra de Sucumbência */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Regras de Sucumbência Judicial
                </label>
                <select
                  value={succumbencyRule}
                  onChange={(e) => setSuccumbencyRule(e.target.value as SuccumbencyRule)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="escritorio_100">Honorários de sucumbência pertencem 100% ao escritório (Padrão OAB)</option>
                  <option value="compartilhada">Sucumbência abatida parcialmente do percentual de êxito</option>
                  <option value="cliente">Sucumbência repassada integralmente ao cliente</option>
                </select>
              </div>

              {/* Status da Proposta */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Status da Proposta
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["draft", "sent", "accepted", "rejected"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setProposalStatus(st)}
                      className={cn(
                        "rounded-lg py-1.5 text-xs font-bold uppercase transition",
                        proposalStatus === st
                          ? st === "accepted"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : st === "rejected"
                            ? "bg-rose-600 text-white shadow-2xs"
                            : "bg-blue-600 text-white shadow-2xs"
                          : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                      )}
                    >
                      {st === "draft" ? "Rascunho" : st === "sent" ? "Enviada" : st === "accepted" ? "Aceita" : "Recusada"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveProposal}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                Gravar Proposta de Honorários
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 3: CAMPOS CUSTOMIZADOS DO ESCRITÓRIO                                 */}
          {/* ========================================================================= */}
          {activeTab === "custom_fields" && (
            <div className="space-y-4 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Campos Customizados por Assinante
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Dados técnicos específicos coletados pelo seu escritório para esta demanda.
                  </p>
                </div>
              </div>

              {customFields.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800 text-slate-400">
                  Nenhum campo personalizado cadastrado. Cadastre no botão do topo.
                </div>
              ) : (
                <div className="space-y-3">
                  {customFields.map((cf) => (
                    <div key={cf.id} className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>
                          {cf.label} {cf.is_required && <span className="text-red-500">*</span>}
                        </span>
                        {cf.area && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {cf.area}
                          </span>
                        )}
                      </label>

                      {cf.field_type === "select" ? (
                        <select
                          value={leadCustomValues[cf.field_key] || ""}
                          onChange={(e) =>
                            setLeadCustomValues((prev) => ({
                              ...prev,
                              [cf.field_key]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="">Selecione uma opção...</option>
                          {cf.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : cf.field_type === "boolean" ? (
                        <div className="flex items-center gap-3 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={cf.field_key}
                              checked={leadCustomValues[cf.field_key] === true}
                              onChange={() =>
                                setLeadCustomValues((prev) => ({
                                  ...prev,
                                  [cf.field_key]: true,
                                }))
                              }
                            />
                            <span>Sim</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={cf.field_key}
                              checked={leadCustomValues[cf.field_key] === false}
                              onChange={() =>
                                setLeadCustomValues((prev) => ({
                                  ...prev,
                                  [cf.field_key]: false,
                                }))
                              }
                            />
                            <span>Não</span>
                          </label>
                        </div>
                      ) : (
                        <input
                          type={cf.field_type === "number" || cf.field_type === "currency" ? "number" : cf.field_type === "date" ? "date" : "text"}
                          value={leadCustomValues[cf.field_key] || ""}
                          onChange={(e) =>
                            setLeadCustomValues((prev) => ({
                              ...prev,
                              [cf.field_key]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleSaveCustomFields}
                    className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    Salvar Campos do Lead
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 4: TIMELINE DE ATENDIMENTO                                            */}
          {/* ========================================================================= */}
          {activeTab === "timeline" && (
            <div className="space-y-4 text-xs animate-in fade-in">
              {/* Adicionar Nota Rápida */}
              <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-blue-500" />
                  Registrar Nova Nota ou Contato com o Lead
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddQuickNote()}
                    placeholder="Ex: Cliente confirmou envio da cópia da CTPS por e-mail..."
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddQuickNote}
                    className="rounded-lg bg-blue-600 px-3.5 py-2 text-white font-bold hover:bg-blue-700 transition"
                  >
                    <Send className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Histórico de Auditoria & Movimentações (Quem moveu o lead) */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                  Histórico de Movimentações & Auditoria
                </h4>

                {/* Eventos de Auditoria com Usuário Responsável */}
                {Array.isArray(lead.history) && lead.history.length > 0 ? (
                  <div className="space-y-2.5 pl-2">
                    {lead.history.map((h) => (
                      <div key={h.id} className="relative pl-6 border-l-2 border-indigo-400 dark:border-indigo-600 pb-2">
                        <span className="absolute -left-[7px] top-1 size-3 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900" />
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-indigo-700 dark:text-indigo-300">
                              👤 {h.user_name || "Usuário do Sistema"}
                            </span>
                            <span>{new Date(h.timestamp).toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {h.details}
                            </p>
                            {h.from_stage && h.to_stage && (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                                <span className="px-1.5 py-0.5 rounded bg-muted">{h.from_stage}</span>
                                <span>&rarr;</span>
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold">{h.to_stage}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground pl-2 italic">
                    Nenhuma movimentação de estágio auditada registrada anteriormente.
                  </div>
                )}
              </div>

              {/* Lista Cronológica de Notas & Eventos Adicionais */}
              {(lead.timeline || []).length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                    Notas & Ocorrências da Timeline
                  </h4>
                  <div className="space-y-3 pl-2">
                    {lead.timeline.map((item) => (
                      <div key={item.id} className="relative pl-6 border-l-2 border-blue-200 dark:border-blue-900 pb-2">
                        <span className="absolute -left-[7px] top-1 size-3 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">
                              {item.user_name || "Sistema"}
                            </span>
                            <span>{new Date(item.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 5: CALL CENTER & IA                                                   */}
          {/* ========================================================================= */}
          {activeTab === "whatsapp" && (
            <div className="space-y-4">
              {(() => {
                const convs = LawHubAtendimentoService.getConversations();
                const matchedConv = convs.find(
                  (c) => c.lead_id === lead.id || (lead.phone && c.contact_phone.includes(lead.phone.replace(/\D/g, "").slice(-8)))
                );

                if (!matchedConv) {
                  return (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center space-y-3">
                      <MessageSquare className="size-10 text-slate-400 mx-auto" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Nenhum Atendimento Ativo no CallCenter</h4>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                          Este lead não possui histórico de chat recente no canal oficial do escritório.
                        </p>
                      </div>
                      <Link
                        to="/lawhub/atendimentos"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Abrir CallCenter</span>
                      </Link>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Card de Conversa Ativa */}
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="relative flex size-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            Conversa Ativa no CallCenter Oficial
                          </span>
                        </div>
                        <Link
                          to="/lawhub/atendimentos"
                          className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <span>Abrir Chat Completo</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white dark:bg-slate-800 p-2.5 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 block">Status da Conversa</span>
                          <span className="font-bold text-slate-800 dark:text-white block mt-0.5">
                            {matchedConv.status === "IN_PROGRESS" ? "🟢 Em Atendimento" : "🟡 Na Fila do Setor"}
                          </span>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-slate-800 p-2.5 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 block">Modo IA</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300 block mt-0.5">
                            {matchedConv.ai_mode === "ACTIVE" ? "🤖 IA Ativa" : "⏸️ IA Pausada (Humano)"}
                          </span>
                        </div>
                      </div>

                      {matchedConv.ai_summary && (
                        <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block mb-1">
                            Resumo da Triagem Inicial por IA:
                          </span>
                          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                            {matchedConv.ai_summary}
                          </p>
                        </div>
                      )}

                      <div className="rounded-lg bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 text-xs">
                        <span className="text-[10px] text-slate-400 block mb-1">Última Mensagem:</span>
                        <p className="text-slate-700 dark:text-slate-300 italic">
                          "{matchedConv.last_message_snippet}"
                        </p>
                        <span className="text-[9px] text-slate-400 mt-1 block text-right">
                          {new Date(matchedConv.last_message_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
