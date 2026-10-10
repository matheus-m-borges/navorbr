import { createFileRoute } from "@tanstack/react-router";
import { Field, GlassCard, PrimaryButton, TextInput } from "@/components/navor-rephub/ui";
import { RepHubAccessLayout } from "@/components/navor/RepHubAccessLayout";
import { useState } from "react";
import { toast } from "sonner";
import { unlockAdminPanel } from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/unlock")({
  component: AdminUnlockPage,
});

function AdminUnlockPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUnlock(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      toast.error("Informe o e-mail de administrador.");
      return;
    }
    if (!cleanPass) {
      toast.error("Digite sua senha individual.");
      return;
    }

    setLoading(true);
    try {
      await unlockAdminPanel({ data: { email: cleanEmail, password: cleanPass } });
      
      toast.success("Retaguarda SaaS desbloqueada com sucesso!");
      window.location.replace("/admin");
    } catch (err: any) {
      toast.error(err.message || "Credenciais inválidas. Verifique seu e-mail e sua senha individual.");
      setLoading(false);
    }
  }

  return (
    <RepHubAccessLayout
      eyebrow="Administração Geral do SaaS"
      title="Acesse a Retaguarda"
      description="Área restrita de controle global de planos, assinantes, produtos e infraestrutura."
      showBack={true}
      backTo="/entrar"
    >
      <GlassCard className="p-6 sm:p-7">
        <h2 className="font-display text-base font-semibold text-card-foreground">
          Entrar
        </h2>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">
          Acesso exclusivo ao administrador geral da plataforma.
        </p>

        <form onSubmit={handleUnlock} className="space-y-4 text-left">
          <Field label="E-mail">
            <TextInput
              type="email"
              required
              placeholder="Digite seu e-mail de administrador"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>

          <Field label="Senha individual">
            <TextInput
              type="password"
              required
              placeholder="Digite sua senha individual"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleUnlock();
              }}
            />
          </Field>

          <PrimaryButton
            type="submit"
            className="mt-5 w-full"
            disabled={loading || !password || !email}
          >
            {loading ? "Verificando credenciais..." : "Entrar na Retaguarda"}
          </PrimaryButton>
        </form>
      </GlassCard>
    </RepHubAccessLayout>
  );
}
