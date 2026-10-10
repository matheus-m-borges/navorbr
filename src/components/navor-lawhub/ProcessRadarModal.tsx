import React, { useState } from "react";
import {
  X,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Radio,
  Coins,
  FileText,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { LawProcess } from "@/lib/lawhub/types";

interface ProcessRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  process: LawProcess;
  onSuccess?: (updated: LawProcess) => void;
}

export function ProcessRadarModal({
  isOpen,
  onClose,
  process,
  onSuccess,
}: ProcessRadarModalProps) {
  // Determine current active radar type
  const initialType: "datajud" | "escavador" | "manual" =
    process.radar_provider === "escavador" ||
    (process.court_sync_system && process.court_sync_system.toLowerCase().includes("escavador"))
      ? "escavador"
      : process.monitoring_type === "manual" || !process.court_linked
      ? "manual"
      : "datajud";

  const [selectedType, setSelectedType] = useState<"datajud" | "escavador" | "manual">(initialType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const updated = await LawHubService.configureProcessRadar(process.id, selectedType);
      if (updated) {
        const label =
          selectedType === "escavador"
            ? "Radar Avançado Escavador (Token API)"
            : selectedType === "datajud"
            ? "Radar Oficial Nacional (DataJud & DJEN)"
            : "Acompanhamento Manual (Sem Radar)";

        toast.success(`Modalidade de radar atualizada para: ${label}`, {
          description:
            selectedType === "escavador"
              ? "A solicitação foi registrada para o provedor Escavador; consumo e ativação dependem de configuração server-side."
              : selectedType === "datajud"
              ? "Processo monitorado nos canais oficiais CNJ/DJEN sem consumo de créditos."
              : "Monitoramento automático desativado. Processo mantido em modo manual.",
        });

        onSuccess?.(updated);
        onClose();
      }
    } catch (e) {
      toast.error("Erro ao atualizar modalidade de radar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Modalidade de Radar & Monitoramento
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {process.court || "Tribunal"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Processo: <strong className="text-slate-700 dark:text-slate-200">{process.cnj_number || process.title}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Informação sobre os tipos de radar */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
          <HelpCircle className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Escolha como este processo deve ser acompanhado pelo robô
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Você pode alternar entre o radar oficial incluso ou o radar com cobertura aprofundada via token da API a qualquer momento.
            </p>
          </div>
        </div>

        {/* Lista de Opções */}
        <div className="mt-4 space-y-3">
          {/* OPÇÃO 1: Radar Oficial Nacional (DataJud / DJEN) */}
          <div
            onClick={() => setSelectedType("datajud")}
            className={cn(
              "relative cursor-pointer rounded-xl border p-4 transition-all flex flex-col gap-2.5",
              selectedType === "datajud"
                ? "border-blue-600 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20 ring-2 ring-blue-500/20 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg text-white font-bold",
                    selectedType === "datajud"
                      ? "bg-blue-600"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Radar Oficial Nacional (DataJud & DJEN)
                    </h4>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      INCLUSO NO PLANO · 0 CRÉDITOS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Conexão direta com a base pública nacional do CNJ (DataJud) e Diário de Justiça Eletrônico Nacional.
                  </p>
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                <div
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border transition",
                    selectedType === "datajud"
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                  )}
                >
                  {selectedType === "datajud" && <CheckCircle2 className="size-3.5" />}
                </div>
              </div>
            </div>

            {/* Vantagens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                <span>Consulta pública somente quando o provider estiver disponível</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                <span>0 créditos consumidos do seu token</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                <span>Tribunais disponíveis conforme o alias suportado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                <span>Ideal para o fluxo regular de processos</span>
              </div>
            </div>
          </div>

          {/* OPÇÃO 2: Radar Avançado Escavador (Token / Créditos) */}
          <div
            onClick={() => setSelectedType("escavador")}
            className={cn(
              "relative cursor-pointer rounded-xl border p-4 transition-all flex flex-col gap-2.5",
              selectedType === "escavador"
                ? "border-purple-600 bg-purple-50/40 dark:border-purple-500 dark:bg-purple-950/20 ring-2 ring-purple-500/20 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg text-white font-bold",
                    selectedType === "escavador"
                      ? "bg-purple-600"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Radar Avançado Escavador (API & Token)
                    </h4>
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                      1 CRÉDITO / MÊS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Monitoramento Escavador depende de API, contrato, créditos e callback configurados.
                  </p>
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                <div
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border transition",
                    selectedType === "escavador"
                      ? "border-purple-600 bg-purple-600 text-white"
                      : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                  )}
                >
                  {selectedType === "escavador" && <CheckCircle2 className="size-3.5" />}
                </div>
              </div>
            </div>

            {/* Vantagens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-purple-600 shrink-0" />
                <span>Cobertura somente a ser exibida após validação do provider</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-purple-600 shrink-0" />
                <span>Notificações antecipadas em tempo real</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-purple-600 shrink-0" />
                <span>Histórico retroativo de autos e partes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-purple-600 shrink-0" />
                <span>Consumo será informado pelo provider após confirmação</span>
              </div>
            </div>

            {/* Saldo de créditos */}
            <div className="mt-1 flex items-center justify-between rounded-lg bg-purple-100/50 dark:bg-purple-950/40 px-3 py-1.5 text-[11px] text-purple-900 dark:text-purple-300">
              <div className="flex items-center gap-1.5">
                <Coins className="size-3.5 text-purple-600 dark:text-purple-400" />
                <span>Saldo de créditos: indisponível até existir ledger server-side</span>
              </div>
              <span className="text-[10px] text-purple-700 dark:text-purple-400">Ativação imediata</span>
            </div>
          </div>

          {/* OPÇÃO 3: Gestão Manual (Sem Radar Ativo) */}
          <div
            onClick={() => setSelectedType("manual")}
            className={cn(
              "relative cursor-pointer rounded-xl border p-4 transition-all flex flex-col gap-2",
              selectedType === "manual"
                ? "border-amber-600 bg-amber-50/40 dark:border-amber-500 dark:bg-amber-950/20 ring-2 ring-amber-500/20 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg text-white font-bold",
                    selectedType === "manual"
                      ? "bg-amber-600"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  <FileText className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Desativar Radar (Apenas Gestão Manual)
                    </h4>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      REGISTRO MANUAL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    O processo é mantido apenas para arquivo ou preenchimento manual pela equipe, sem consultas automáticas periódicas.
                  </p>
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                <div
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border transition",
                    selectedType === "manual"
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                  )}
                >
                  {selectedType === "manual" && <CheckCircle2 className="size-3.5" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            {selectedType === "escavador" ? (
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                O consumo será confirmado somente após retorno idempotente do provider
              </span>
            ) : selectedType === "datajud" ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Varredura oficial sem custo de créditos
              </span>
            ) : (
              <span>Radar inativo para este processo</span>
            )}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm transition",
                selectedType === "escavador"
                  ? "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20"
                  : selectedType === "datajud"
                  ? "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
                  : "bg-slate-700 hover:bg-slate-600"
              )}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Aplicar Modalidade
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
