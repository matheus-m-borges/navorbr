import React, { useState } from "react";
import { AlertTriangle, Unlink, Clock } from "lucide-react";
import { toast } from "sonner";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { LawProcess } from "@/lib/lawhub/types";

interface UnlinkProcessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Pode receber um processo individual ou uma lista de processos para lote
  process?: LawProcess | null;
  processIds?: string[];
  onSuccess: () => void;
}

export function UnlinkProcessDialog({
  isOpen,
  onClose,
  process,
  processIds,
  onSuccess,
}: UnlinkProcessDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isBatch = Boolean(processIds && processIds.length > 0 && !process);
  const count = isBatch ? processIds!.length : 1;

  const handleConfirmUnlink = async () => {
    setIsSubmitting(true);
    try {
      if (isBatch) {
        toast.loading(`Desvinculando ${count} processos do tribunal...`, { id: "unlink-proc" });
        await LawHubService.unlinkProcessesBatch(processIds!);
        toast.success(
          `${count} processos foram desvinculados do tribunal. O monitoramento automático foi suspenso.`,
          { id: "unlink-proc" }
        );
      } else if (process) {
        toast.loading("Desvinculando processo do tribunal...", { id: "unlink-proc" });
        await LawHubService.unlinkProcessFromCourt(process.id);
        toast.success(
          `O processo ${process.cnj_number || process.title} foi desvinculado do tribunal com sucesso.`,
          { id: "unlink-proc" }
        );
      }

      onSuccess();
      onClose();
    } catch {
      toast.error("Não foi possível desvincular o(s) processo(s).", { id: "unlink-proc" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 shrink-0">
            <Unlink className="size-5" />
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {isBatch
                ? `Desvincular ${count} processos do tribunal?`
                : "Desvincular processo do tribunal?"}
            </h4>

            <p className="text-xs text-slate-500 leading-relaxed dark:text-slate-400">
              {isBatch ? (
                <>
                  Tem certeza que deseja desvincular os <strong>{count}</strong> processos selecionados? A partir deste momento, eles não receberão mais andamentos automáticos do site do tribunal.
                </>
              ) : (
                <>
                  Deseja realmente desvincular este processo do tribunal? A partir desse momento, ele não receberá mais andamentos automáticos.
                </>
              )}
            </p>

            {!isBatch && process && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs">
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {process.title}
                </p>
                {process.cnj_number && (
                  <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                    {process.cnj_number}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3.5">
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
            disabled={isSubmitting}
            onClick={handleConfirmUnlink}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Clock className="size-3.5 animate-spin" />
                <span>Desvinculando...</span>
              </>
            ) : (
              <>
                <Unlink className="size-3.5" />
                <span>Confirmar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
