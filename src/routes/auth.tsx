import { useEffect, useState, useMemo } from "react";
import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Sparkles, KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveProductLoginEmail } from "@/api/admin-actions";
import { Field, GlassCard, PrimaryButton, TextInput } from "@/components/navor-rephub/ui";
import { RepHubAccessLayout } from "@/components/navor/RepHubAccessLayout";
import { launchLawHubSso } from "@/lib/lawhub-sso";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search }) => {
    const next = (search as any)?.next;
    if (typeof next === "string" && next.startsWith("/admin")) {
      throw redirect({ to: "/admin/unlock" });
    }
    const token = (search as any)?.token || (search as any)?.invite_token;
    if (token) {
      throw redirect({
        to: "/primeiro-acesso" as any,
        search: { token: String(token).trim() } as any,
      });
    }
  },
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    product?: string | undefined;
    next?: string | undefined;
    invite_token?: string | undefined;
    email?: string | undefined;
  } => {
    const rawNext = search['next'];
    // Só aceita caminho relativo da própria aplicação.
    const next =
      typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//")
        ? rawNext
        : undefined;
    return {
      product: search['product'] as string | undefined,
      next,
      invite_token: search['invite_token'] as string | undefined,
      email: search['email'] as string | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Entrar | NavorBR" },
      {
        name: "description",
        content: "Acesse o seu sistema NavorBR.",
      },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z.string().min(4, { message: "A senha deve ter ao menos 4 caracteres" }).max(72),
  name: z.string().trim().max(120).optional(),
});

/** Traduz as mensagens de erro de acesso para linguagem clara. */
function friendlyAuthError(raw: string) {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Conta ainda não verificada. Tente entrar novamente em instantes.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Já existe uma conta com este e-mail. Use a opção Entrar.";
  if (m.includes("email rate limit") || m.includes("over_email_send_rate"))
    return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("password should be at least")) return "A senha deve ter ao menos 6 caracteres.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "A criação de contas está desativada. Peça acesso ao administrador.";
  return raw;
}

function AuthPage() {
  const navigate = useNavigate();
  const { product, next, invite_token, email: queryEmail } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);
  const resolveLogin = resolveProductLoginEmail;

  // Decodifica dados do convite de primeiro acesso se fornecido
  const inviteInfo = useMemo(() => {
    if (!invite_token) return null;
    try {
      return JSON.parse(atob(invite_token));
    } catch {
      try {
        return JSON.parse(decodeURIComponent(escape(atob(invite_token))));
      } catch {
        return null;
      }
    }
  }, [invite_token]);

  useEffect(() => {
    const targetEmail = (inviteInfo?.email || queryEmail || "").trim();
    if (targetEmail) {
      setForm((prev) => ({
        ...prev,
        email: targetEmail,
        name: inviteInfo?.name || prev.name,
      }));
    }
  }, [inviteInfo?.email, inviteInfo?.name, queryEmail]);

  const isEngHub = product === 'enghub';
  const isLawHub = product === 'lawhub' || !!invite_token;
  const targetDashboard = isLawHub ? "/lawhub/dashboard" : isEngHub ? "/enghub/dashboard" : "/dashboard";

  /** Continua no destino interno pedido ou no painel do produto. */
  const goAfterAuth = async (_userEmail?: string) => {
    const destination = next || targetDashboard;
    if (isLawHub) {
      await launchLawHubSso(destination);
      return;
    }
    void navigate({ to: destination, replace: true });
  };

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const destination = next || targetDashboard;
      if (isLawHub) {
        await launchLawHubSso(destination);
      } else {
        void navigate({ to: destination, replace: true });
      }
    });
  }, [navigate, targetDashboard, next, isLawHub]);

  async function submit() {
    setBusy(true);
    try {
      if (mode === "reset") {
        const email = z.string().trim().email().parse(form.email);
        const { requestPasswordReset } = await import("@/api/account-security");
        const res = await requestPasswordReset({ data: { email } });
        toast.success(res.message);
        setMode("login");
        return;
      }

      if (mode === "signup") {
        void navigate({ to: "/cadastro", search: { next, product } });
        return;
      }

      // Fluxo regular e seguro de login com as credenciais individuais cadastradas
      const parsed = {
        email: z.string().trim().email().parse(form.email),
        password: z.string().min(6).parse(form.password),
      };
      const resolved = await resolveLogin({ data: { email: parsed.email, product: product || "rephub" } });
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: resolved.authEmail || parsed.email,
        password: parsed.password,
      });
      if (error) throw error;
      
      if (signInData.user?.user_metadata?.["must_change_password"]) {
        void navigate({ to: "/reset-password" });
      } else {
        goAfterAuth(signInData.user?.email || parsed.email);
      }
    } catch (e) {
      const raw =
        e instanceof z.ZodError
          ? (e.issues[0]?.message ?? "Dados inválidos")
          : ((e as Error).message ?? "Não foi possível continuar");
      toast.error(friendlyAuthError(raw));
    } finally {
      setBusy(false);
    }
  }


  return (
    <RepHubAccessLayout
      eyebrow={
        isLawHub
          ? "Portal NavorBR LawHub"
          : isEngHub
            ? "Portal EngHub"
            : "Portal RepHub para Representante"
      }
      title={
        isLawHub
          ? "Acesse seu Escritório"
          : isEngHub
            ? "Acesse suas obras"
            : "Acesse sua operação"
      }
      description={
        isLawHub
          ? "Entre para gerenciar processos, prazos, audiências, publicações e clientes com inteligência jurídica."
          : isEngHub
            ? "Entre para gerenciar cronogramas, custos, materiais e equipes."
            : "Entre para gerenciar clientes, leads, pedidos e resultados comerciais."
      }
    >
        <GlassCard className="p-6 sm:p-7">
          <h2 className="font-display text-base font-semibold text-card-foreground">
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
          </h2>
          <p className="mt-1 mb-5 text-xs text-muted-foreground">
            {mode === "reset"
              ? "Informe seu e-mail para receber o link de redefinição."
              : isLawHub
                ? "Acesso restrito a advogados e equipe jurídica cadastrados."
                : isEngHub
                  ? "Acesso restrito a engenheiros e gestores de obra."
                  : "Acesso restrito a representantes cadastrados."}
          </p>

          {inviteInfo || invite_token ? (
            <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-200">
              <div className="flex items-center gap-2 font-bold text-blue-300">
                <Sparkles className="size-4 text-amber-400" />
                <span>Primeiro Acesso ao Navor LawHub</span>
              </div>
              <p className="mt-1 text-slate-300">
                {inviteInfo?.name ? `Olá, ${inviteInfo.name}! ` : ""}
                Seu acesso ao escritório foi preparado com segurança. Utilize o link exclusivo de primeiro acesso para definir sua senha individual.
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            {mode === "signup" ? (
              <Field label="Nome completo">
                <TextInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={120}
                />
              </Field>
            ) : null}
            <Field label="E-mail">
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
                autoComplete="email"
              />
            </Field>
            {mode !== "reset" ? (
              <Field label="Senha">
                <TextInput
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  maxLength={72}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submit();
                  }}
                />
              </Field>
            ) : null}
          </div>

          <PrimaryButton className="mt-5 w-full" disabled={busy} onClick={() => void submit()}>
            {busy
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : "Enviar link"}
          </PrimaryButton>


          <div className="mt-5 flex flex-wrap justify-between gap-2 text-xs">
            {mode === "login" ? (
              <>
                <Link
                  to="/cadastro"
                  search={{ next, product }}
                  className="font-medium text-brand hover:underline"
                >
                  Criar conta NAVOR
                </Link>
                <button
                  className="text-muted-foreground hover:underline"
                  onClick={() => setMode("reset")}
                >
                  Esqueci minha senha
                </button>
              </>
            ) : (
              <button className="text-brand hover:underline" onClick={() => setMode("login")}>
                Voltar para o login
              </button>
            )}

          </div>
        </GlassCard>
    </RepHubAccessLayout>
  );
}
