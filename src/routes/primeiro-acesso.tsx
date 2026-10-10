import { useState, useEffect, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Scale,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LawHubFirstAccessService, type FirstAccessToken } from "@/lib/lawhub/first-access-service";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import { initials } from "@/lib/crm";

export const Route = createFileRoute("/primeiro-acesso")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Primeiro Acesso & Ativação de Conta | Navor LawHub" },
      {
        name: "description",
        content: "Definição de senha individual e ativação segura de conta no LawHub.",
      },
    ],
  }),
  component: PrimeiroAcessoPage,
});

function PrimeiroAcessoPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState<FirstAccessToken | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Formulário de Criação de Senha Individual
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Validação do Token no carregamento (com suporte a qualquer dispositivo via servidor)
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    if (!token) {
      setValidationError("Nenhum token de primeiro acesso foi informado na URL.");
      setIsLoading(false);
      return;
    }

    LawHubFirstAccessService.validateTokenAsync(token).then((validation) => {
      if (!isMounted) return;
      if (!validation.valid || !validation.tokenData) {
        setValidationError(
          validation.error || "Link de primeiro acesso inválido, expirado ou já utilizado."
        );
      } else {
        setTokenData(validation.tokenData);
        setValidationError(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Força da senha
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 50;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  }, [password]);

  const passwordRequirements = [
    { label: "Mínimo de 8 caracteres", met: password.length >= 8 },
    { label: "Letra maiúscula recomendada", met: /[A-Z]/.test(password) },
    { label: "Número ou caractere especial recomendado", met: /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password) },
    { label: "As senhas coincidem", met: !!password && password === confirmPassword },
  ];

  const canSubmit = password.length >= 8 && password === confirmPassword && !submitting;

  async function handleActivateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !tokenData) return;

    if (password.length < 8) {
      toast.error("A senha deve conter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas informadas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      // Consome uma única vez o convite validado no servidor.
      const consumeRes = await LawHubFirstAccessService.consumeFirstAccess({
        token,
        newPassword: password,
      });

      if (!consumeRes.success) {
        toast.error(consumeRes.error || "Não foi possível validar este token de acesso.");
        setValidationError(consumeRes.error || "Token inválido ou já utilizado.");
        setSubmitting(false);
        return;
      }

      // Autentica o usuário na sessão atual.
      try {
        await supabase.auth.signInWithPassword({
          email: tokenData.userEmail,
          password: password,
        });
      } catch (authErr) {
        console.warn("Aviso signInWithPassword:", authErr);
      }

      toast.success("Senha cadastrada com sucesso! Bem-vindo(a) ao sistema.");

      // Redireciona com base estrita nas permissões concedidas.
      const cleanEmail = tokenData.userEmail.toLowerCase().trim();
      const destination = LawHubService.getUserDefaultRoute(cleanEmail);
      void navigate({ to: destination as any, replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao ativar conta. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // Estado de Carregamento
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans">
        <div className="text-center space-y-3">
          <div className="size-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            Validando token de primeiro acesso seguro...
          </p>
        </div>
      </div>
    );
  }

  // Estado de Erro de Validação (Token inválido, expirado ou já utilizado)
  if (validationError || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-slate-100 p-4 font-sans antialiased selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-red-500/20 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md text-center space-y-5">
            <div className="size-16 rounded-2xl bg-red-500/10 border border-red-500/30 grid place-items-center mx-auto text-red-400 shadow-inner">
              <ShieldAlert className="size-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                Acesso Não Autorizado
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Link de Primeiro Acesso Inválido
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                {validationError}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left text-xs space-y-2 text-slate-400">
              <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                <AlertCircle className="size-3.5 text-amber-400 shrink-0" />
                <span>Padrão de Segurança & LGPD:</span>
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed text-slate-400">
                <li>Os links de primeiro acesso são <strong>individuais e de uso único</strong>.</li>
                <li>Possuem validade máxima de <strong>24 horas</strong> a partir da emissão.</li>
                <li>Se este link expirou, solicite ao Administrador Geral da advocacia a geração de um novo link.</li>
              </ul>
            </div>

            <button
              onClick={() => void navigate({ to: "/auth" })}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-3 text-xs font-bold text-white transition shadow-sm cursor-pointer"
            >
              <span>Ir para a Página de Login</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Estado Válido: Tela "CRIAR SUA SENHA INDIVIDUAL"
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B0F19] via-[#0F172A] to-[#0A0D14] text-slate-100 p-4 font-sans antialiased selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Identificação Institucional do Escritório */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-2 shadow-sm backdrop-blur-md">
            <div className="grid size-8 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              <Scale className="size-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-white block leading-tight">
                {tokenData.officeName}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Ambiente Corporativo LawHub
              </span>
            </div>
          </div>
        </div>

        {/* Card Principal de Definição de Senha */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="space-y-1.5 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-0.5 text-[10px] font-bold text-blue-400">
              <Sparkles className="size-3" />
              <span>Primeiro Acesso Seguro</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Crie sua Senha Individual
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Defina sua credencial pessoal e exclusiva. Ninguém além de você terá acesso à sua senha.
            </p>
          </div>

          {/* Dados do Colaborador Identificado (Determinados com segurança pelo token) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-600 text-xs font-bold text-white shadow-xs">
              {initials(tokenData.userName)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-bold text-white truncate">
                {tokenData.userName}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {tokenData.userEmail}
              </p>
              <span className="inline-block mt-0.5 text-[9px] font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/60 rounded px-1.5 py-0.2">
                {tokenData.userRole.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
            <ShieldCheck className="size-5 text-emerald-400 shrink-0" />
          </div>

          {/* Formulário de Criação de Senha */}
          <form onSubmit={handleActivateAccount} className="space-y-4">
            {/* Campo 1: Nova Senha */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200">
                Nova Senha Individual
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crie sua nova senha segura"
                  autoFocus
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 pr-10 text-xs font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Barra de Progresso de Força da Senha */}
              {password && (
                <div className="space-y-1 pt-1">
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordStrength <= 25
                          ? "w-1/4 bg-red-500"
                          : passwordStrength <= 50
                          ? "w-2/4 bg-amber-500"
                          : passwordStrength <= 75
                          ? "w-3/4 bg-blue-500"
                          : "w-full bg-emerald-500"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Campo 2: Confirmar Nova Senha */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200">
                Confirmar Nova Senha
              </label>
              <div className="relative flex items-center">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita sua nova senha"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 pr-10 text-xs font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Lista de Requisitos */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 space-y-1.5">
              {passwordRequirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <CheckCircle2
                    className={`size-3.5 shrink-0 ${
                      req.met ? "text-emerald-400" : "text-slate-600"
                    }`}
                  />
                  <span className={req.met ? "text-slate-200" : "text-slate-500"}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold text-white transition shadow-lg ${
                canSubmit
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 cursor-pointer shadow-blue-500/20"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60"
              }`}
            >
              {submitting ? (
                <>
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Ativando conta...</span>
                </>
              ) : (
                <>
                  <Lock className="size-3.5" />
                  <span>Criar Senha e Entrar no Sistema</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé Informativo */}
          <p className="text-[10px] text-center text-slate-500 leading-relaxed">
            Ao ativar sua conta, seu token de primeiro acesso será permanentemente invalidado e você acessará somente os módulos autorizados pela advocacia.
          </p>
        </div>
      </div>
    </div>
  );
}
