import React, { useState, useEffect } from "react";
import {
  X,
  Scale,
  Zap,
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Paperclip,
  Upload,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import { formatCNJ, detectCourtFromCNJ } from "@/products/lawhub/domain/cnj-detector";
import type { LawProcess } from "@/lib/lawhub/types";

interface TransformCaseToProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: LawProcess | null;
  onSuccess?: (updated: LawProcess) => void;
}

export function TransformCaseToProcessModal({
  isOpen,
  onClose,
  caseItem,
  onSuccess,
}: TransformCaseToProcessModalProps) {
  const [cnj, setCnj] = useState("");
  const [court, setCourt] = useState("TJPI");
  const [judicialBranch, setJudicialBranch] = useState("1ª Vara Cível da Comarca de Teresina");
  const [instance, setInstance] = useState<"1grau" | "2grau" | "superior">("1grau");
  const [proceduralClass, setProceduralClass] = useState("Procedimento Comum Cível");
  const [enableRadar, setEnableRadar] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<Array<{
    id: string;
    name: string;
    file_name: string;
    file_size: string;
    category: string;
    visible_to_client: boolean;
    file_url?: string;
  }>>([]);

  useEffect(() => {
    if (caseItem) {
      setCnj("");
      setCourt("TJPI");
      setJudicialBranch("1ª Vara Cível");
      setInstance("1grau");
      setProceduralClass("Procedimento Comum Cível");
      setEnableRadar(true);
    }
  }, [caseItem]);

  if (!isOpen || !caseItem) return null;

  const handleCnjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNJ(e.target.value);
    setCnj(formatted);

    // Detecção automática de tribunal pelo CNJ
    const detected = detectCourtFromCNJ(formatted);
    if (detected) {
      setCourt(detected.courtInitials);
      setJudicialBranch(`${detected.courtInitials} - Vara Cível`);
      setInstance("1grau");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems = Array.from(files).map((file, idx) => {
      const sizeInMB = file.size / (1024 * 1024);
      const formattedSize = sizeInMB >= 1 ? `${sizeInMB.toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;

      let detectedCat = "geral";
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes("peticao") || lowerName.includes("inicial")) detectedCat = "peticao";
      else if (lowerName.includes("procuracao")) detectedCat = "procuracao";
      else if (lowerName.includes("contrato")) detectedCat = "contrato";
      else if (lowerName.includes("comprovante")) detectedCat = "comprovante";
      else if (lowerName.includes("rg") || lowerName.includes("cpf") || lowerName.includes("cnh")) detectedCat = "documento_pessoal";

      return {
        id: `att-case-${Date.now()}-${idx}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        file_name: file.name,
        file_size: formattedSize,
        category: detectedCat,
        visible_to_client: true,
        file_url: URL.createObjectURL(file),
      };
    });

    setAttachments((prev) => [...prev, ...newItems]);
    toast.success(`${newItems.length} anexo(s) adicionado(s)!`);
    e.target.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggleVisibility = (id: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, visible_to_client: !a.visible_to_client } : a))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCnj = cnj.trim();
    if (!cleanCnj || cleanCnj.length < 15) {
      toast.error("Por favor, informe um número de processo CNJ válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await LawHubService.convertCaseToProcess(caseItem.id, {
        cnj_number: cleanCnj,
        court: court.trim() || "TJPI",
        judicial_branch: judicialBranch.trim(),
        instance: instance,
        procedural_class: proceduralClass.trim(),
        monitoring_type: enableRadar ? "automatico" : "manual",
      });

      if (updated) {
        if (attachments.length > 0) {
          for (const att of attachments) {
            LawHubService.addDocument({
              process_id: updated.id,
              process_cnj: updated.cnj_number,
              client_name: updated.client_name,
              title: att.name,
              name: att.name,
              file_name: att.file_name,
              file_size: att.file_size,
              category: att.category,
              visible_to_client: att.visible_to_client,
              date: new Date().toLocaleDateString("pt-BR"),
              created_at: new Date().toISOString(),
              created_by: updated.responsible_name || "Advogado Titular",
              file_url: att.file_url || "#",
            });
          }
          toast.info(`${attachments.length} documento(s) compartilhado(s) com cliente e advogado!`);
        }
        toast.success(`Caso transformado com sucesso em Processo Judicial nº ${cleanCnj}!`);
        if (onSuccess) onSuccess(updated);
        onClose();
      }
    } catch (err) {
      toast.error("Erro ao transformar caso em processo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Topo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Scale className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Transformar em Processo Judicial
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ajuizamento de demanda extrajudicial no Poder Judiciário
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

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Card Resumo do Caso */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Demanda Extrajudicial de Origem:
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 mt-0.5">
              {caseItem.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Cliente: <span className="font-semibold text-slate-900 dark:text-slate-200">{caseItem.client_name}</span>
            </p>
          </div>

          {/* 1. Número CNJ */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Número Único do Processo (CNJ) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={cnj}
              onChange={handleCnjChange}
              placeholder="0000000-00.0000.0.00.0000"
              className="w-full font-mono text-sm px-3.5 py-2.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              O tribunal e a instância serão identificados automaticamente pela numeração CNJ.
            </p>
          </div>

          {/* 2. Tribunal e Vara */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Tribunal
              </label>
              <input
                type="text"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                placeholder="Ex: TJPI, TJSP, TRF1"
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Instância
              </label>
              <select
                value={instance}
                onChange={(e) => setInstance(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="1grau">1º Grau</option>
                <option value="2grau">2º Grau</option>
                <option value="superior">Tribunal Superior</option>
              </select>
            </div>
          </div>

          {/* 3. Vara e Classe Processual */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Vara / Órgão Julgador
            </label>
            <input
              type="text"
              value={judicialBranch}
              onChange={(e) => setJudicialBranch(e.target.value)}
              placeholder="Ex: 5ª Vara Cível da Comarca de Teresina"
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Classe Processual
            </label>
            <input
              type="text"
              value={proceduralClass}
              onChange={(e) => setProceduralClass(e.target.value)}
              placeholder="Ex: Procedimento Comum Cível, Execução de Título"
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Anexos Compartilhados (Cliente & Advogado) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="size-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Documentos & Anexos Iniciais ({attachments.length})
                </span>
              </div>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition cursor-pointer">
                <Upload className="size-3" />
                <span>Anexar</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="sr-only"
                  accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                />
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="size-3.5 text-blue-500 shrink-0" />
                      <span className="truncate font-medium">{att.file_name}</span>
                      <span className="text-[10px] text-slate-400">({att.file_size})</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(att.id)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1",
                          att.visible_to_client ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700"
                        )}
                      >
                        {att.visible_to_client ? <Eye className="size-2.5" /> : <EyeOff className="size-2.5" />}
                        <span>{att.visible_to_client ? "Cliente & Advogado" : "Apenas Advogado"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Opção de Radar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <Zap className="size-4 text-amber-500" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Ativar Radar de Monitoramento Automático
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Acompanhar andamentos e publicações no diário oficial
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableRadar}
              onChange={(e) => setEnableRadar(e.target.checked)}
              className="size-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !cnj.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Convertendo...</span>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Confirmar & Migrar para Processo Judicial</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
