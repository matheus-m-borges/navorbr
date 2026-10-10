import { useState, useEffect, useMemo } from "react";
import {
  X,
  Clock,
  Calendar,
  CheckSquare,
  FileText,
  Sparkles,
  ShieldAlert,
  Video,
  MapPin,
  User,
  AlertTriangle,
  ChevronRight,
  Info,
  CheckCircle2,
  CalendarDays,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import { treatLawHubPublication } from "@/lib/lawhub/publications.functions";
import { calculateLegalDeadline, type LegalCalculationResult } from "@/products/lawhub/domain/deadline-calculator";
import { analyzePublicationText, type PublicationAiAnalysis } from "@/lib/lawhub/ai-publication-analyzer";
import type { LawProcess, OfficeUser, DeadlinePriority, HearingType } from "@/lib/lawhub/types";

interface PublicationData {
  id: string;
  releasedAt?: string;
  publishedAt: string;
  processNumber: string;
  diary: string;
  vara?: string;
  comarca?: string;
  searchedName?: string;
  snippet: string;
  fullText: string;
  isLinked?: boolean;
  linkedProcessTitle?: string;
  linkedProcessId?: string;
}

interface TreatPublicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  publication: PublicationData;
  linkedProcess?: LawProcess | null;
  onSuccess: () => void;
}

export function TreatPublicationModal({
  isOpen,
  onClose,
  publication,
  linkedProcess,
  onSuccess,
}: TreatPublicationModalProps) {
  const [activeTab, setActiveTab] = useState<"prazo" | "audiencia" | "tarefa" | "historico">("prazo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuditDetail, setShowAuditDetail] = useState(false);

  // Lista de advogados / membros da equipe do LawHub
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  useEffect(() => {
    setOfficeUsers(LawHubService.getOfficeUsers());
  }, []);

  // Análise preditiva da IA LawHub
  const aiAnalysis = useMemo<PublicationAiAnalysis>(() => {
    return analyzePublicationText(publication.fullText || publication.snippet || "");
  }, [publication.fullText, publication.snippet]);

  // Form State: Prazo Processual
  const [prazoTitle, setPrazoTitle] = useState("");
  const [prazoDays, setPrazoDays] = useState<number>(15);
  const [countMode, setCountMode] = useState<"dias_uteis" | "dias_corridos">("dias_uteis");
  const [includeRecess, setIncludeRecess] = useState(true);
  const [prazoTime, setPrazoTime] = useState("23:59");
  const [prazoPriority, setPrazoPriority] = useState<DeadlinePriority>("urgente");
  const [prazoResponsible, setPrazoResponsible] = useState("");
  const [prazoDescription, setPrazoDescription] = useState("");

  // Form State: Audiência
  const [hearingType, setHearingType] = useState<HearingType>("conciliacao");
  const [hearingDate, setHearingDate] = useState("");
  const [hearingTime, setHearingTime] = useState("14:00");
  const [isVirtualHearing, setIsVirtualHearing] = useState(true);
  const [virtualLink, setVirtualLink] = useState("");
  const [hearingLocation, setHearingLocation] = useState("");
  const [hearingResponsible, setHearingResponsible] = useState("");
  const [hearingNotes, setHearingNotes] = useState("");

  // Form State: Tarefa
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [taskResponsible, setTaskResponsible] = useState("");
  const [taskDescription, setTaskDescription] = useState("");

  // Form State: Histórico / Andamento
  const [historyTitle, setHistoryTitle] = useState("");
  const [historyText, setHistoryText] = useState("");

  // Inicialização padrão baseada na IA
  useEffect(() => {
    if (!isOpen) return;

    const defaultResp = officeUsers[0]?.name || "Dr. Matheus Borges";
    setPrazoResponsible(defaultResp);
    setHearingResponsible(defaultResp);
    setTaskResponsible(defaultResp);

    // Pré-preenche com as sugestões da IA
    setPrazoTitle(aiAnalysis.suggestedTitle);
    setPrazoDays(aiAnalysis.suggestedDays || 15);
    setCountMode(aiAnalysis.countMode);
    setPrazoPriority(aiAnalysis.urgency === "fatal" ? "urgente" : "normal");
    setPrazoDescription(`Fundamentação: ${aiAnalysis.legalArticle}. ${aiAnalysis.recommendedAction}`);

    if (aiAnalysis.hearingData) {
      setHearingType(aiAnalysis.hearingData.type);
      setHearingDate(aiAnalysis.hearingData.date);
      setHearingTime(aiAnalysis.hearingData.time);
      setIsVirtualHearing(aiAnalysis.hearingData.isVirtual);
      setHearingLocation(aiAnalysis.hearingData.location || "Fórum Central");
      if (aiAnalysis.category === "audiencia") {
        setActiveTab("audiencia");
      }
    } else {
      setHearingDate(new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10));
    }

    setTaskTitle(`Providenciar: ${aiAnalysis.suggestedTitle}`);
    setTaskDate(new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10));

    setHistoryTitle(`Intimação DJe: ${aiAnalysis.communicationType}`);
    setHistoryText(publication.snippet || publication.fullText.slice(0, 300));
  }, [isOpen, aiAnalysis, officeUsers, publication]);

  // Cálculo Dinâmico do Prazo via Motor CPC (Art. 224)
  const calcResult = useMemo<LegalCalculationResult>(() => {
    const baseDate = publication.releasedAt || publication.publishedAt || new Date().toLocaleDateString("pt-BR");
    const baseType = publication.releasedAt ? "disponibilizacao" : "publicacao";

    return calculateLegalDeadline({
      baseDate,
      baseType,
      days: prazoDays,
      countMode,
      includeForenseRecess: includeRecess,
    });
  }, [publication.releasedAt, publication.publishedAt, prazoDays, countMode, includeRecess]);

  const handleApplyAiSuggestion = () => {
    setPrazoTitle(aiAnalysis.suggestedTitle);
    setPrazoDays(aiAnalysis.suggestedDays || 15);
    setCountMode(aiAnalysis.countMode);
    setPrazoPriority(aiAnalysis.urgency === "fatal" ? "urgente" : "normal");
    setPrazoDescription(`Fundamentação: ${aiAnalysis.legalArticle}. ${aiAnalysis.recommendedAction}`);
    toast.success("Sugestão jurídica da IA aplicada aos campos de tratamento!");
  };

  const handleSubmitTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (activeTab === "prazo") {
        if (!prazoTitle.trim()) {
          toast.error("Informe a descrição do prazo processual.");
          setIsSubmitting(false);
          return;
        }

        await treatLawHubPublication({
          data: {
            publicationId: publication.id,
            type: "prazo",
            title: prazoTitle,
            description: prazoDescription,
            date: calcResult.fatalDateIso,
            time: prazoTime,
            priority: prazoPriority,
            responsibleName: prazoResponsible,
            processCnj: publication.processNumber,
            processId: linkedProcess?.id,
            clientName: linkedProcess?.client_name,
          },
        });

        toast.success(`Prazo processual fatal (${calcResult.fatalDate}) registrado com sucesso na agenda!`);
      } else if (activeTab === "audiencia") {
        if (!hearingDate) {
          toast.error("Informe a data da audiência.");
          setIsSubmitting(false);
          return;
        }

        await treatLawHubPublication({
          data: {
            publicationId: publication.id,
            type: "audiencia",
            title: `Audiência de ${hearingType.toUpperCase()}`,
            description: hearingNotes,
            date: hearingDate,
            time: hearingTime,
            processCnj: publication.processNumber,
            processId: linkedProcess?.id,
            clientName: linkedProcess?.client_name,
          },
        });

        toast.success("Audiência judicial agendada com sucesso!");
      } else if (activeTab === "tarefa") {
        if (!taskTitle.trim() || !taskDate) {
          toast.error("Informe o título e a data limite da tarefa.");
          setIsSubmitting(false);
          return;
        }

        await treatLawHubPublication({
          data: {
            publicationId: publication.id,
            type: "tarefa",
            title: taskTitle,
            description: taskDescription,
            date: taskDate,
            responsibleName: taskResponsible,
            processCnj: publication.processNumber,
            processId: linkedProcess?.id,
            clientName: linkedProcess?.client_name,
          },
        });

        toast.success("Tarefa vinculada à publicação delegada com sucesso!");
      } else if (activeTab === "historico") {
        if (!historyTitle.trim()) {
          toast.error("Informe o título do andamento.");
          setIsSubmitting(false);
          return;
        }

        await treatLawHubPublication({
          data: {
            publicationId: publication.id,
            type: "historico",
            title: historyTitle,
            description: historyText,
            processCnj: publication.processNumber,
            processId: linkedProcess?.id,
            clientName: linkedProcess?.client_name,
          },
        });

        toast.success("Andamento lançado no histórico dos autos!");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar tratamento da publicação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                TRATAMENTO DE PUBLICAÇÃO
              </span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Controladoria & Governança NAVOR LawHub
              </span>
            </div>
            <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              Autos: {publication.processNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Card de IA Jurídica (NAVOR LawHub Intelligence) */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-200 p-1.5 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <span className="font-black uppercase tracking-wider text-[11px] text-purple-700 dark:text-purple-300">
                    Sugestão Jurídica da IA LawHub
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-[13px]">
                    {aiAnalysis.communicationType}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyAiSuggestion}
                className="shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-purple-700 transition"
              >
                Aplicar Sugestão
              </button>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              {aiAnalysis.summary}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-purple-200/60 dark:border-purple-900/60 text-[11px]">
              <span>
                <strong>Prazo Legal sugerido:</strong> {aiAnalysis.suggestedDays} dias úteis
              </span>
              <span>•</span>
              <span>
                <strong>Fundamentação:</strong> {aiAnalysis.legalArticle}
              </span>
              <span>•</span>
              <span className={cn(
                "font-bold uppercase text-[10px] rounded px-1.5 py-0.5",
                aiAnalysis.urgency === "fatal" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-700"
              )}>
                {aiAnalysis.urgency === "fatal" ? "Prazo Fatal" : "Urgente"}
              </span>
            </div>
          </div>

          {/* Abas de Tratamento (Prazo, Audiência, Tarefa, Histórico) */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("prazo")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 transition",
                activeTab === "prazo"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <Clock className="size-3.5" />
              <span>Prazo Processual</span>
              <span className="rounded bg-blue-500/30 px-1 text-[10px] uppercase">CPC</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("audiencia")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 transition",
                activeTab === "audiencia"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <Calendar className="size-3.5" />
              <span>Audiência</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tarefa")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 transition",
                activeTab === "tarefa"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <CheckSquare className="size-3.5" />
              <span>Tarefa / Diligência</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("historico")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 transition",
                activeTab === "historico"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <FileText className="size-3.5" />
              <span>Histórico dos Autos</span>
            </button>
          </div>

          {/* Formulário: ABA PRAZO PROCESSUAL */}
          {activeTab === "prazo" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Título / Ato Processual a Praticar *
                  </label>
                  <input
                    type="text"
                    required
                    value={prazoTitle}
                    onChange={(e) => setPrazoTitle(e.target.value)}
                    placeholder="Ex: Apresentar Contrarrazões de Apelação"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* Seleção de Dias e Modo de Contagem */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prazo em Dias *
                  </label>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {[5, 10, 15, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPrazoDays(d)}
                        className={cn(
                          "rounded border px-2.5 py-1 text-xs font-bold transition",
                          prazoDays === d
                            ? "border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        )}
                      >
                        {d} dias
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={prazoDays}
                    onChange={(e) => setPrazoDays(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Regra de Contagem *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCountMode("dias_uteis")}
                      className={cn(
                        "rounded-lg border p-2 text-left text-xs transition",
                        countMode === "dias_uteis"
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 font-bold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      <span>Dias Úteis</span>
                      <span className="block text-[10px] text-slate-500 font-normal">CPC Art. 219</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountMode("dias_corridos")}
                      className={cn(
                        "rounded-lg border p-2 text-left text-xs transition",
                        countMode === "dias_corridos"
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 font-bold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      <span>Dias Corridos</span>
                      <span className="block text-[10px] text-slate-500 font-normal">CPP / JECrim</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD EM DESTAQUE: CALCULADORA DE PRAZO CPC (Art. 224) */}
              <div className="rounded-xl border border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50/40 p-4 text-xs dark:border-blue-900/60 dark:from-blue-950/30 dark:to-indigo-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold">
                    <Scale className="size-4" />
                    <span>Resultado da Calculadora Processual (Art. 224 CPC)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuditDetail(!showAuditDetail)}
                    className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1"
                  >
                    <span>{showAuditDetail ? "Ocultar memória" : "Ver memória de cálculo"}</span>
                    <ChevronRight className={cn("size-3 transition-transform", showAuditDetail && "rotate-90")} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Disponibilização</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{calcResult.disponibilizacaoDate || publication.releasedAt || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Publicação (D1)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{calcResult.publicacaoDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Início Contagem (D2)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{calcResult.inicioContagemDate}</span>
                  </div>
                  <div className="rounded-lg bg-red-100/90 dark:bg-red-950/60 p-2 text-center border border-red-300 dark:border-red-900">
                    <span className="text-[10px] text-red-700 dark:text-red-300 uppercase tracking-widest font-black block">TERMO FATAL</span>
                    <span className="font-mono text-sm sm:text-base font-black text-red-700 dark:text-red-200 block">
                      {calcResult.fatalDate}
                    </span>
                  </div>
                </div>

                {/* Memória de cálculo passo a passo auditável */}
                {showAuditDetail && (
                  <div className="mt-3 pt-3 border-t border-blue-200/60 dark:border-blue-900/40 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    <p className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                      Rastreamento cronológico de tempestividade ({calcResult.auditSteps.length} eventos):
                    </p>
                    {calcResult.auditSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-between text-[11px] p-1.5 rounded",
                          step.type === "vencimento" ? "bg-red-100 font-bold text-red-900 dark:bg-red-950 dark:text-red-200" :
                          step.type === "marco_inicial" ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300" :
                          step.type === "dia_util" ? "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-200" :
                          "bg-slate-100 text-slate-500 line-through dark:bg-slate-900 dark:text-slate-500"
                        )}
                      >
                        <span>{step.dateFormatted} ({step.dayOfWeek})</span>
                        <span>{step.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Responsável, Horário e Prioridade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Advogado Responsável *
                  </label>
                  <select
                    value={prazoResponsible}
                    onChange={(e) => setPrazoResponsible(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {officeUsers.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} {u.is_master_admin ? "(Titular)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Horário Limite Fatal
                  </label>
                  <input
                    type="time"
                    value={prazoTime}
                    onChange={(e) => setPrazoTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Criticidade do Prazo
                  </label>
                  <select
                    value={prazoPriority}
                    onChange={(e) => setPrazoPriority(e.target.value as DeadlinePriority)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="urgente">Fatal / Urgente</option>
                    <option value="proximo">Próximo</option>
                    <option value="atencao">Atenção</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Instruções Processuais
                </label>
                <textarea
                  rows={2}
                  value={prazoDescription}
                  onChange={(e) => setPrazoDescription(e.target.value)}
                  placeholder="Orientações específicas para o cumprimento tempestivo..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Formulário: ABA AUDIÊNCIA */}
          {activeTab === "audiencia" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Audiência *
                  </label>
                  <select
                    value={hearingType}
                    onChange={(e) => setHearingType(e.target.value as HearingType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="conciliacao">Conciliação (Art. 334 CPC)</option>
                    <option value="instrucao">Instrução e Julgamento</option>
                    <option value="una">Audiência UNA (Juizados / CLT)</option>
                    <option value="pericial">Pericial</option>
                    <option value="julgamento">Julgamento Colegiado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data da Audiência *
                  </label>
                  <input
                    type="date"
                    required
                    value={hearingDate}
                    onChange={(e) => setHearingDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Horário de Início
                  </label>
                  <input
                    type="time"
                    value={hearingTime}
                    onChange={(e) => setHearingTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Modalidade Presencial vs Telepresencial */}
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                    <input
                      type="radio"
                      name="hearing_modality"
                      checked={isVirtualHearing}
                      onChange={() => setIsVirtualHearing(true)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <Video className="size-4 text-blue-600" />
                    <span>Telepresencial / Virtual</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                    <input
                      type="radio"
                      name="hearing_modality"
                      checked={!isVirtualHearing}
                      onChange={() => setIsVirtualHearing(false)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <MapPin className="size-4 text-slate-500" />
                    <span>Presencial no Fórum</span>
                  </label>
                </div>

                {isVirtualHearing ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Link da Sala Virtual (Teams / Zoom / Google Meet / PJecorr)
                    </label>
                    <input
                      type="url"
                      value={virtualLink}
                      onChange={(e) => setVirtualLink(e.target.value)}
                      placeholder="https://teams.microsoft.com/l/meetup-join/..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Local / Vara / Endereço do Fórum
                    </label>
                    <input
                      type="text"
                      value={hearingLocation}
                      onChange={(e) => setHearingLocation(e.target.value)}
                      placeholder="Ex: Fórum Central de Teresina - Sala da 3ª Vara Cível"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Advogado Responsável pela Audiência
                </label>
                <select
                  value={hearingResponsible}
                  onChange={(e) => setHearingResponsible(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {officeUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Formulário: ABA TAREFA */}
          {activeTab === "tarefa" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Título da Tarefa / Diligência *
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex: Solicitar extratos bancários com o cliente"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data Limite de Conclusão *
                  </label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Delegar Para (Membro da Equipe) *
                  </label>
                  <select
                    value={taskResponsible}
                    onChange={(e) => setTaskResponsible(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {officeUsers.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Orientações da Tarefa
                </label>
                <textarea
                  rows={3}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Descreva o que deve ser providenciado..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Formulário: ABA HISTÓRICO */}
          {activeTab === "historico" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Título do Andamento nos Autos *
                </label>
                <input
                  type="text"
                  required
                  value={historyTitle}
                  onChange={(e) => setHistoryTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Teor do Andamento
                </label>
                <textarea
                  rows={4}
                  value={historyText}
                  onChange={(e) => setHistoryText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botão de Ação */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmitTreatment}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" />
            <span>
              {isSubmitting
                ? "Gravando Tratamento..."
                : activeTab === "prazo"
                ? `Criar Prazo Fatal (${calcResult.fatalDate}) e Tratar`
                : activeTab === "audiencia"
                ? "Agendar Audiência e Tratar"
                : activeTab === "tarefa"
                ? "Criar Tarefa e Tratar"
                : "Registrar Andamento e Tratar"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
