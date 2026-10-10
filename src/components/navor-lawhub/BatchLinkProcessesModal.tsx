import { cn } from "@/lib/utils";
import React, { useState } from "react";
import {
  X,
  Link2,
  Building,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  Scale,
  Search,
  CheckSquare,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { LawProcess } from "@/lib/lawhub/types";
import { BRAZILIAN_COURTS_GROUPS } from "@/products/lawhub/domain/courts-data";

interface BatchLinkProcessesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProcesses: LawProcess[];
  initialMode: "cnj" | "orgao";
  onSuccess: () => void;
}

export function BatchLinkProcessesModal({
  isOpen,
  onClose,
  selectedProcesses,
  initialMode = "cnj",
  onSuccess,
}: BatchLinkProcessesModalProps) {
  const [mode, setMode] = useState<"cnj" | "orgao">(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campos para o modo "orgao"
  const [selectedCourt, setSelectedCourt] = useState("TJPI");
  const [selectedInstance, setSelectedInstance] = useState<"1grau" | "2grau" | "superior">("1grau");
  const [selectedBranch, setSelectedBranch] = useState("Vara Cível");
  const [searchSystem, setSearchSystem] = useState("DataJud / PJe");

  if (!isOpen) return null;

  // Processos manuais elegíveis
  const eligibleProcesses = selectedProcesses.filter(
    (p) => !p.court_linked || p.monitoring_type === "manual"
  );
  const processesToLink = eligibleProcesses.length > 0 ? eligibleProcesses : selectedProcesses;

  const handleLinkProcesses = async () => {
    setIsSubmitting(true);
    const ids = processesToLink.map((p) => p.id);

    try {
      if (mode === "cnj") {
        toast.loading(`Vinculando ${ids.length} processos pelo número CNJ...`, { id: "batch-link" });
        const res = await LawHubService.linkProcessesBatchByCNJ(ids);
        toast.success(
          `${res.count} processo(s) vinculado(s) ao tribunal com sucesso! Radar de andamentos ativado.`,
          { id: "batch-link" }
        );
      } else {
        toast.loading(`Vinculando ${ids.length} processos ao órgão ${selectedCourt}...`, { id: "batch-link" });
        const count = await LawHubService.linkProcessesBatchByCourt(ids, {
          court: selectedCourt,
          judicial_branch: `${selectedCourt} - ${selectedBranch}`,
          instance: selectedInstance,
          court_sync_system: searchSystem,
        });
        toast.success(
          `${count} processo(s) vinculado(s) ao ${selectedCourt} com sucesso!`,
          { id: "batch-link" }
        );
      }

      onSuccess();
      onClose();
    } catch {
      toast.error("Erro ao vincular processos. Tente novamente.", { id: "batch-link" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Link2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Vincular Processos ao Tribunal em Lote
                </h3>
                <span className="rounded bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  NAVOR LAWHUB
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ative o radar automático para múltiplos processos manuais simultaneamente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Seleção do Modo de Vinculação */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 dark:border-slate-800 p-3 bg-slate-50/70 dark:bg-slate-850">
          <button
            type="button"
            onClick={() => setMode("cnj")}
            className={cn(
              "flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition border",
              mode === "cnj"
                ? "bg-white text-blue-600 border-blue-200 shadow-xs dark:bg-slate-800 dark:text-blue-400 dark:border-blue-800"
                : "border-transparent text-slate-600 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
            )}
          >
            <Scale className="size-3.5" />
            <span>Por Número CNJ</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("orgao")}
            className={cn(
              "flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition border",
              mode === "orgao"
                ? "bg-white text-blue-600 border-blue-200 shadow-xs dark:bg-slate-800 dark:text-blue-400 dark:border-blue-800"
                : "border-transparent text-slate-600 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
            )}
          >
            <Building className="size-3.5" />
            <span>Por Seleção de Órgão</span>
          </button>
        </div>

        {/* Conteúdo do Formulário */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {mode === "cnj" ? (
            /* Modo 1: Vinculação Automática por CNJ */
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 flex items-start gap-2.5">
                <ShieldCheck className="size-4 shrink-0 mt-0.5 text-blue-600" />
                <div className="space-y-1">
                  <p className="font-bold">Varredura Oficial via DataJud / Robô dos Tribunais</p>
                  <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                    O NAVOR LawHub identificará automaticamente o tribunal competente de cada processo pelo padrão oficial do CNJ (ex: TJPI, TJSP, TRT22) e ativará o radar de andamentos sem consumir créditos de IA.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Processos que serão vinculados ({processesToLink.length}):
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/40 dark:bg-slate-900">
                  {processesToLink.map((p) => (
                    <div key={p.id} className="p-2.5 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">
                          {p.title}
                        </p>
                        <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                          {p.cnj_number || "Sem CNJ informado"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                        {p.court || "Auto"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Modo 2: Vinculação por Seleção de Órgão */
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 flex items-start gap-2.5">
                <Building className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <p className="text-[11px] leading-relaxed">
                  Defina o tribunal ou órgão administrativo em comum para todos os processos manuais selecionados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tribunal / Órgão
                  </label>
                  <select
                    value={selectedCourt}
                    onChange={(e) => setSelectedCourt(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BRAZILIAN_COURTS_GROUPS.map((group) => (
                      <optgroup key={group.groupName} label={group.groupName}>
                        {group.courts.map((court) => (
                          <option key={court.code} value={court.code}>
                            {court.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <optgroup label="Órgãos Administrativos">
                      <option value="INPI">INPI - Instituto Nacional da Propriedade Industrial</option>
                      <option value="PROCON">PROCON - Processo Administrativo</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Grau / Instância
                  </label>
                  <select
                    value={selectedInstance}
                    onChange={(e) => setSelectedInstance(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1grau">1º Grau (Vara / Juizado Especial)</option>
                    <option value="2grau">2º Grau (Câmaras / Turmas Recursais)</option>
                    <option value="superior">Instância Superior (Tribunal Pleno / Brasília)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Vara / Seção Judiciária
                  </label>
                  <input
                    type="text"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    placeholder="Ex: 5ª Vara Cível de Teresina"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Sistema Eletrônico
                  </label>
                  <select
                    value={searchSystem}
                    onChange={(e) => setSearchSystem(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DataJud / PJe">DataJud / PJe Oficial</option>
                    <option value="e-SAJ">e-SAJ (Tribunal de Justiça)</option>
                    <option value="Projudi">Projudi</option>
                    <option value="Eproc">Eproc</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Processos Selecionados ({processesToLink.length}):
                </label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/40 dark:bg-slate-900">
                  {processesToLink.map((p) => (
                    <div key={p.id} className="p-2 text-xs flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[280px]">
                        {p.title}
                      </span>
                      <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                        {p.cnj_number || "Sem CNJ"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botão Azul 'Vincular Processos' */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-3.5 bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Zap className="size-3.5 text-amber-500" />
            <span>Robô oficial • Zero consumo de créditos de IA</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isSubmitting || processesToLink.length === 0}
              onClick={handleLinkProcesses}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <Clock className="size-3.5 animate-spin" />
                  <span>Vinculando...</span>
                </>
              ) : (
                <>
                  <Link2 className="size-3.5" />
                  <span>Vincular Processos</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
