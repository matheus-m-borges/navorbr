import { Clock, Play, Trash2, Sparkles } from "lucide-react";
import { CalculatorDraft, CalculatorDraftService } from "@/products/lawhub/domain/calculator-utils";

interface DraftRecoveryBannerProps {
  draft: CalculatorDraft | null;
  onResume: (draft: CalculatorDraft) => void;
  onDiscard: () => void;
}

export function DraftRecoveryBanner({ draft, onResume, onDiscard }: DraftRecoveryBannerProps) {
  if (!draft) return null;

  const formattedTime = new Date(draft.updatedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedDate = new Date(draft.updatedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 p-4 shadow-xs dark:border-amber-900/60 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-amber-950/40 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500 text-white shadow-xs">
            <Clock className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
                Rascunho Não Finalizado
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Salvo automaticamente em {formattedDate} às {formattedTime}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              Continuar preenchimento de{" "}
              <strong className="text-amber-700 dark:text-amber-400">
                {draft.calculatorName || "Cálculo Jurídico"}
              </strong>
              {draft.data.clientName ? ` (Cliente: ${draft.data.clientName})` : ""}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Etapa atual: <strong>{draft.wizardStep} de 4</strong>. Você pode retomar exatamente do ponto onde parou sem perder nenhum dado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 transition"
            title="Descartar este rascunho e começar do zero"
          >
            <Trash2 className="size-3.5" />
            <span>Descartar</span>
          </button>

          <button
            type="button"
            onClick={() => onResume(draft)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-98 transition"
          >
            <Play className="size-3.5 fill-white" />
            <span>Continuar de Onde Parei</span>
          </button>
        </div>
      </div>
    </div>
  );
}
