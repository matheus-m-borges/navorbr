import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuroraBackdrop, Field, GlassCard, PrimaryButton, TextInput } from "@/components/navor-rephub/ui";
import { usePortalSession } from "@/hooks/usePortal";
import { changePortalPassword } from "@/lib/portal.functions";

/**
 * No primeiro acesso (ou após uma senha provisória) o cliente é obrigado a
 * definir uma senha própria antes de usar a área dele.
 */
export function PortalPasswordGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: session, isLoading } = usePortalSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading || !session?.mustChangePassword) return <>{children}</>;

  async function save() {
    if (password.length < 8) {
      toast.error("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      await changePortalPassword({ data: { password } });
      await qc.invalidateQueries({ queryKey: ["portal"] });
      toast.success("Senha definida. Bem-vindo!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <AuroraBackdrop />
      <GlassCard className="relative z-10 w-full max-w-md p-6">
        <h1 className="font-display text-lg font-semibold text-card-foreground">
          Crie a sua senha de acesso
        </h1>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">
          Você entrou com uma senha provisória. Defina agora uma senha só sua para continuar.
        </p>
        <div className="space-y-3">
          <Field label="Nova senha">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirmar nova senha">
            <TextInput
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={72}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
            />
          </Field>
        </div>
        <PrimaryButton className="mt-5 w-full" disabled={busy} onClick={() => void save()}>
          {busy ? "Salvando..." : "Salvar e entrar"}
        </PrimaryButton>
      </GlassCard>
    </div>
  );
}
