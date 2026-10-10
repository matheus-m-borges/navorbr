import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, GlassCard, PrimaryButton, TextInput } from "@/components/navor-rephub/ui";
import { RepHubAccessLayout } from "@/components/navor/RepHubAccessLayout";
import { updateMyPassword } from "@/api/admin-actions";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha | RepHub" },
      { name: "description", content: "Defina uma nova senha de acesso ao CRM." },
      { property: "og:title", content: "Nova senha | RepHub" },
      { property: "og:description", content: "Defina uma nova senha de acesso ao CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    setBusy(true);
    try {
      await updateMyPassword({ data: { password } });
      toast.success("Senha atualizada.");
      void navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message || "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RepHubAccessLayout
      eyebrow="RepHub by NAVOR"
      title="Defina sua nova senha"
      description="Crie uma senha segura para continuar usando o RepHub."
    >
      <GlassCard className="p-6 sm:p-7">
        <h1 className="font-display text-base font-semibold text-card-foreground">Definir nova senha</h1>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">
          Escolha uma senha nova para acessar o CRM.
        </p>
        <Field label="Nova senha">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={72}
            autoComplete="new-password"
          />
        </Field>
        <PrimaryButton className="mt-5 w-full" disabled={busy} onClick={() => void save()}>
          {busy ? "Salvando..." : "Salvar senha"}
        </PrimaryButton>
      </GlassCard>
    </RepHubAccessLayout>
  );
}
