import React, { useState } from "react";
import {
  X,
  Briefcase,
  User,
  FileText,
  Tag,
  DollarSign,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Building2,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService, INITIAL_CLIENTS } from "@/lib/lawhub/lawhub-service";
import type { LawProcess, LawCaseType, LawCaseStage } from "@/lib/lawhub/types";

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newCase: LawProcess) => void;
}

const CASE_TYPES: Array<{ id: LawCaseType; label: string; icon: string; desc: string }> = [
  { id: "contrato", label: "Contratos", icon: "📝", desc: "Elaboração, análise e revisão contratual" },
  { id: "consultoria", label: "Consultoria Jurídica", icon: "💼", desc: "Assessoria consultiva e preventiva" },
  { id: "cartorio", label: "Cartório / Notarial", icon: "🏛️", desc: "Inventários, divórcios e certidões" },
  { id: "parecer", label: "Parecer Técnico", icon: "📑", desc: "Estudos jurídicos e teses fundamentadas" },
  { id: "notificacao", label: "Notificação & Pré-Lide", icon: "✉️", desc: "Cobranças e notificações extrajudiciais" },
  { id: "orgao_publico", label: "Órgãos Reguladores", icon: "🏢", desc: "INPI, PROCON, CRM e autarquias" },
  { id: "mediacao", label: "Mediação & Acordo", icon: "🤝", desc: "Negociações amigáveis e conciliação" },
  { id: "outro", label: "Outro Extrajudicial", icon: "📁", desc: "Demanda não contenciosa geral" },
];

const CASE_STAGES: Array<{ id: LawCaseStage; label: string }> = [
  { id: "briefing", label: "1. Briefing & Documentação" },
  { id: "analise", label: "2. Análise & Viabilidade" },
  { id: "minuta", label: "3. Redação de Minuta" },
  { id: "negociacao", label: "4. Em Negociação" },
  { id: "aguardando_cliente", label: "5. Aguardando Cliente" },
  { id: "concluido", label: "6. Demanda Concluída" },
];

export function NewCaseModal({ isOpen, onClose, onSuccess }: NewCaseModalProps) {
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [caseType, setCaseType] = useState<LawCaseType>("contrato");
  const [caseStage, setCaseStage] = useState<LawCaseStage>("briefing");
  const [responsibleName, setResponsibleName] = useState("Dr. Matheus Borges");
  const [legalArea, setLegalArea] = useState("Contratos & Consultivo");
  const [caseValue, setCaseValue] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>(["Extrajudicial", "Consultivo"]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSelectClient = (name: string, id: string) => {
    setClientName(name);
    setSelectedClientId(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Por favor, informe o título ou objeto do caso.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Por favor, indique o cliente vinculado.");
      return;
    }

    setIsSubmitting(true);
    try {
      const numValue = caseValue ? parseFloat(caseValue.replace(/\D/g, "")) / 100 : undefined;

      const created = await LawHubService.createCase({
        title: title.trim(),
        client_name: clientName.trim(),
        client_id: selectedClientId || undefined,
        case_type: caseType,
        case_stage: caseStage,
        responsible_name: responsibleName,
        legal_area: legalArea,
        case_value: numValue,
        notes: notes.trim() || undefined,
        tags: tags,
      });

      toast.success("Caso extrajudicial cadastrado com sucesso!");
      if (onSuccess) onSuccess(created);
      onClose();
    } catch (err) {
      toast.error("Erro ao salvar caso extrajudicial.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Briefcase className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Novo Caso Extrajudicial
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Consultivo / Sem CNJ
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Demandas consultivas, minutas de contratos, procedimentos cartorários e pareceres
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Banner Informativo de Gestão Interna */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-200 text-xs">
            <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Gestão Interna de Demandas:</span> Casos extrajudiciais não tramitam no Poder Judiciário e <strong>não consomem créditos de radar nem de IA</strong>. Caso esta demanda seja ajuizada futuramente, você poderá transformá-la em Processo Judicial com 1 clique.
            </div>
          </div>

          {/* 1. Título do Caso */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Título / Objeto do Caso <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Elaboração de Contrato de Distribuição Mercantil"
              className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* 2. Seleção de Cliente */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Cliente Vinculado <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setSelectedClientId("");
                }}
                placeholder="Digite o nome do cliente ou razão social..."
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              {/* Sugestões rápidas de clientes */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Clientes frequentes:</span>
                {INITIAL_CLIENTS.slice(0, 3).map((cli) => (
                  <button
                    key={cli.id}
                    type="button"
                    onClick={() => handleSelectClient(cli.name, cli.id)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-xs transition border",
                      clientName === cli.name
                        ? "bg-blue-100 dark:bg-blue-900/60 border-blue-400 text-blue-800 dark:text-blue-200 font-semibold"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    {cli.trade_name || cli.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Categoria / Tipo de Caso */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Tipo da Demanda
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CASE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCaseType(t.id)}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-xl border text-left transition text-xs",
                    caseType === t.id
                      ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 font-semibold shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <span className="text-base mb-1">{t.icon}</span>
                  <span className="font-semibold leading-tight">{t.label}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5 line-clamp-1">
                    {t.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Fase Inicial e Área do Direito */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Fase Inicial da Demanda
              </label>
              <select
                value={caseStage}
                onChange={(e) => setCaseStage(e.target.value as LawCaseStage)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                {CASE_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Área de Atuação
              </label>
              <input
                type="text"
                value={legalArea}
                onChange={(e) => setLegalArea(e.target.value)}
                placeholder="Ex: Contratos, Cível, Tributário"
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* 5. Responsável e Honorários / Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Advogado Responsável
              </label>
              <select
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value="Dr. Matheus Borges">Dr. Matheus Borges</option>
                <option value="Arthur Carvalho Moura Da Silva">Arthur Carvalho Moura Da Silva</option>
                <option value="Dra. Jaynnara Cavalcante Paiva">Dra. Jaynnara Cavalcante Paiva</option>
                <option value="Dr. Gabriel Alcantara">Dr. Gabriel Alcantara</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Valor Estimado / Honorários
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">R$</span>
                <input
                  type="text"
                  value={caseValue}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    if (!raw) {
                      setCaseValue("");
                      return;
                    }
                    const val = (parseInt(raw, 10) / 100).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                    setCaseValue(val);
                  }}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* 6. Tags / Marcadores */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Tags / Marcadores
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  <Tag className="size-3 text-slate-400" />
                  {t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-red-500 transition ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Adicionar nova tag (pressione Enter)..."
                className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* 7. Observações e Estratégia */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Observações & Estratégia
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva particularidades do atendimento, cláusulas prioritárias, certidões pendentes ou prazos internos..."
              className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
          </div>
        </form>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
          >
            Cancelar
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Salvando Caso...</span>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                <span>Salvar Caso Extrajudicial</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
