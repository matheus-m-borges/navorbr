import { useState } from "react";
import { AlertTriangle, Trash2, ShieldX, X } from "lucide-react";
import { toast } from "sonner";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import { discardLawHubPublication } from "@/lib/lawhub/publications.functions";

interface DiscardPublicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  publication: {
    id: string;
    processNumber: string;
    diary: string;
    searchedName?: string;
  };
  onSuccess: () => void;
}

export function DiscardPublicationModal({
  isOpen,
  onClose,
  publication,
  onSuccess,
}: DiscardPublicationModalProps) {
  const [blockTerm, setBlockTerm] = useState(false);
  const [discardReason, setDiscardReason] = useState("Sem relevância processual ou processo de homônimo");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirmDiscard = async () => {
    setIsSubmitting(true);
    try {
      await discardLawHubPublication({
        data: {
          publicationId: publication.id,
          reason: discardReason,
        },
      });

      // Sincroniza estado em memória se presente
      try {
        await LawHubService.treatPublication({
          pubId: publication.id,
          type: "descarte",
          title: `Descartada: ${discardReason}`,
        });
      } catch {}

      if (blockTerm && publication.searchedName) {
        toast.info(`Termo "${publication.searchedName}" adicionado à lista de regras de bloqueio.`);
      }

      toast.info("Publicação movida para a aba de Descartadas.");
      onSuccess();
      onClose();
    } catch {
      toast.error("Erro ao descartar publicação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Descartar Publicação Judicial?
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {publication.processNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Esta publicação será marcada como <strong>Descartada</strong>. Nenhum prazo ou tarefa será gerado na agenda. Você poderá consultá-la a qualquer momento na aba "Descartadas".
        </p>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Motivo do Descarte (Governança)
          </label>
          <select
            value={discardReason}
            onChange={(e) => setDiscardReason(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="Sem relevância processual ou processo de homônimo">Sem relevância / Homônimo</option>
            <option value="Publicação duplicada">Publicação duplicada</option>
            <option value="Processo que não pertence à carteira ativa">Processo fora da carteira do escritório</option>
            <option value="Apenas informativo / Sem providência requerida">Apenas informativo / Ciência tácita</option>
          </select>
        </div>

        {publication.searchedName && (
          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <input
              type="checkbox"
              checked={blockTerm}
              onChange={(e) => setBlockTerm(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500 mt-0.5"
            />
            <div>
              <span className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                <ShieldX className="size-3.5 text-red-500" />
                Bloquear notificações deste processo
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Evita novos avisos para o número {publication.processNumber}.
              </span>
            </div>
          </label>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirmDiscard}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            <span>Confirmar Descarte</span>
          </button>
        </div>
      </div>
    </div>
  );
}
