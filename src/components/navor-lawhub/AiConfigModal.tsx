import { useState, useEffect } from "react";
import { Sparkles, Key, Check, X, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getLawHubServiceConfig, saveLawHubServiceConfig } from "@/api/admin-actions";

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AiConfigModal({ isOpen, onClose, onSaved }: AiConfigModalProps) {
  const [provider, setProvider] = useState<"openai" | "gemini" | "lovable">("openai");
  const [model, setModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getLawHubServiceConfig({ data: { service: "pieces_ai" } })
        .then((cfg) => {
          if (cfg) {
            if (cfg.provider) setProvider(cfg.provider as any);
            if (cfg.model) setModel(cfg.model);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await saveLawHubServiceConfig({ data: { service: "pieces_ai", provider, model, reviewRequired: true } });
      toast.success("Modelo de IA salvo. As credenciais permanecem somente no cofre NAVOR.");

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar credenciais de IA.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white">
              <Key className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Provedor de IA Jurídica
              </h3>
              <p className="text-[11px] text-slate-500">
                Selecione o modelo; chaves são gerenciadas no servidor NAVOR
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Provedor de Inteligência Artificial:
            </label>
            <select
              value={provider}
              onChange={(e) => {
                const prov = e.target.value as any;
                setProvider(prov);
                if (prov === "openai") setModel("gpt-4o");
                if (prov === "gemini") setModel("gemini-2.0-flash");
                if (prov === "lovable") setModel("google/gemini-2.5-flash");
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="openai">OpenAI (GPT-4o Oficial - Recomendado)</option>
              <option value="gemini">Google Gemini (Gemini 2.0 Flash)</option>
              <option value="lovable">Lovable AI Gateway</option>
            </select>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <strong>Credencial protegida:</strong> nenhuma API key é exibida, digitada ou guardada no navegador. O sistema usa somente segredos protegidos da NAVOR.
          </div>

          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <ShieldCheck className="size-4 shrink-0 mt-0.5" />
            <div>
              <strong>Qualidade Máxima Garantida:</strong> Nosso gerador entrega petições no mesmo padrão ou superior ao ChatGPT, com ementas de tribunais reais (TJ-MG, TJ-SP), artigos do Código Civil e proteção patrimonial completa.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Salvar Configurações
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
