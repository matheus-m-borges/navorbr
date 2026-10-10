import { useState, useEffect } from "react";
import {
  Lock,
  Key,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { MasterSecurityConfig } from "@/lib/lawhub/types";

interface AdminSecurityGateProps {
  onSuccess: () => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
}

export function AdminSecurityGate({
  onSuccess,
  onCancel,
  title = "Acesso Restrito ao Administrador Geral",
  subtitle = "Confirme suas credenciais individuais para acessar os dados de Plano, Faturamento e Configurações Financeiras.",
}: AdminSecurityGateProps) {
  const [securityConfig, setSecurityConfig] = useState<MasterSecurityConfig>(() =>
    LawHubService.getMasterSecurityConfig()
  );

  const [emailInput, setEmailInput] = useState(securityConfig.primary_email || "");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setSecurityConfig(LawHubService.getMasterSecurityConfig());
    window.addEventListener("lawhub_security_config_updated", handleUpdate);
    return () => window.removeEventListener("lawhub_security_config_updated", handleUpdate);
  }, []);

  function handleSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (!emailInput.trim()) {
      setErrorMessage("Informe o e-mail do titular.");
      return;
    }
    if (!passwordInput.trim()) {
      setErrorMessage("Informe sua senha individual.");
      return;
    }

    setLoading(true);

    const isValid = LawHubService.verifyMasterCredentials(emailInput.trim(), passwordInput.trim());

    if (isValid) {
      LawHubService.unlockMasterSession();
      LawHubService.logMasterAuthEvent("credentials", emailInput.trim());
      toast.success("Credenciais validadas com sucesso!", {
        description: "Acesso de Administrador Geral liberado.",
      });
      setTimeout(() => {
        onSuccess();
      }, 300);
    } else {
      setLoading(false);
      setErrorMessage("E-mail ou senha individual incorretos. Acesso negado.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Área Sensível &bull; Segurança Reforçada
              </p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {subtitle}
          </p>

          <form onSubmit={handleSubmitCredentials} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E-mail do Administrador Titular
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@suaempresa.com.br"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pl-9 text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <Mail className="absolute left-3 top-3 size-4 text-slate-400" />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Aceita o e-mail principal ou o e-mail de redundância cadastrado.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Senha Mestra
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Digite sua senha individual..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pl-9 pr-9 text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <Key className="absolute left-3 top-3 size-4 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
                <AlertTriangle className="size-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passwordInput}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
            >
              <Lock className="size-4" />
              <span>{loading ? "Verificando..." : "Confirmar e Desbloquear"}</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="p-3 px-6 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span>Segurança Navor Enterprise</span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
