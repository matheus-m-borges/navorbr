import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getPortalSession, registerPortalLogin } from "@/lib/portal.functions";
import { Field, GlassCard, PrimaryButton, TextInput } from "@/components/navor-rephub/ui";
import { RepHubAccessLayout } from "@/components/navor/RepHubAccessLayout";

export const Route = createFileRoute("/cliente/login")({
  head: () => ({
    meta: [
      { title: "Portal do Cliente | RepHub" },
      {
        name: "description",
        content:
          "Acesse suas marcas, coleções, catálogos, pedidos e materiais comerciais em um único lugar.",
      },
      { property: "og:title", content: "Portal do Cliente | RepHub" },
      {
        property: "og:description",
        content: "Área exclusiva dos clientes da representação: coleções, catálogos e pedidos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalLogin,
});

const schema = z.object({
  email: z.string().trim().email({ message: "Informe um e-mail válido" }).max(255),
  password: z.string().min(6, { message: "A senha deve ter ao menos 6 caracteres" }).max(72),
});

function PortalLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");

  async function submit() {
    setBusy(true);
    try {
      if (mode === "reset") {
        const email = z.string().trim().email().parse(form.email);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Se este e-mail tiver acesso, enviaremos um link de redefinição.");
        setMode("login");
        return;
      }

      const parsed = schema.parse(form);
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.email,
        password: parsed.password,
      });
      if (error) {
        toast.error("E-mail ou senha incorretos.");
        return;
      }
      try {
        await getPortalSession();
      } catch (e) {
        await supabase.auth.signOut();
        const msg = (e as Error).message || "Acesso não autorizado.";
        if (msg.startsWith("Acesso não autorizado")) {
          toast.error(
            "Este e-mail não tem acesso ao Portal do Cliente. Se você é representante, entre pela área do representante.",
          );
        } else {
          toast.error(msg);
        }
        return;
      }

      if (!remember) window.sessionStorage.setItem("portal-session-only", "1");
      await registerPortalLogin();
      void navigate({ to: "/cliente/resumo" });
    } catch (e) {
      const msg =
        e instanceof z.ZodError ? (e.issues[0]?.message ?? "Dados inválidos") : (e as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <RepHubAccessLayout
      eyebrow="Portal RepHub para Cliente"
      title="Sua área comercial"
      description="Suas marcas, coleções, catálogos, pedidos e materiais em um único lugar."
    >
        <GlassCard className="p-6 sm:p-7">
          <h2 className="font-display text-base font-semibold text-card-foreground">
            {mode === "login" ? "Entrar" : "Recuperar senha"}
          </h2>
          <p className="mt-1 mb-5 text-xs text-muted-foreground">
            {mode === "login"
              ? "Use o e-mail e a senha enviados pela representação."
              : "Informe seu e-mail para receber o link de redefinição."}
          </p>

          <div className="space-y-3">
            <Field label="E-mail de acesso">
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
                autoComplete="email"
              />
            </Field>
            {mode === "login" ? (
              <Field label="Senha">
                <TextInput
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  maxLength={72}
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submit();
                  }}
                />
              </Field>
            ) : null}
          </div>

          {mode === "login" ? (
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-3.5 accent-current"
              />
              Lembrar meu acesso neste dispositivo
            </label>
          ) : null}

          <PrimaryButton className="mt-5 w-full" disabled={busy} onClick={() => void submit()}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Enviar link"}
          </PrimaryButton>

          <div className="mt-5 text-center text-xs">
            <button
              className="text-muted-foreground hover:underline"
              onClick={() => setMode(mode === "login" ? "reset" : "login")}
            >
              {mode === "login" ? "Esqueci minha senha" : "Voltar para o login"}
            </button>
          </div>
        </GlassCard>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ainda não tem acesso? Fale com a sua representação.
        </p>
    </RepHubAccessLayout>
  );
}
