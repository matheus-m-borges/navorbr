import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PortalShell } from "@/components/portal/PortalShell";
import { DataRow, Field, GlassCard, PrimaryButton, TextInput } from "@/components/navor-rephub/ui";
import { usePortalSession } from "@/hooks/usePortal";
import { changePortalPassword, getPortalAccessLogs } from "@/lib/portal.functions";
import { formatDateTime } from "@/lib/crm";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/cliente/_area/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil | Portal do Cliente" },
      { name: "description", content: "Dados cadastrais da sua loja e alteração de senha de acesso." },
      { property: "og:title", content: "Meu perfil | Portal do Cliente" },
      { property: "og:description", content: "Confira seus dados e troque sua senha de acesso." },
    ],
  }),
  component: PortalProfile,
});

function PortalProfile() {
  const { data: session } = usePortalSession();
  const { data: accessLogs } = useQuery({
    queryKey: ["portal-access-logs"],
    queryFn: () => getPortalAccessLogs(),
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

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
      setPassword("");
      setConfirm("");
      toast.success("Senha atualizada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Meu perfil" subtitle="Dados da sua loja e segurança do acesso">
      <div className="grid gap-3 lg:grid-cols-2">
        <GlassCard className="p-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-card-foreground">
            Dados cadastrais
          </h2>
          <div className="space-y-1">
            <DataRow label="Razão social" value={session?.legalName ?? "—"} />
            <DataRow label="Nome fantasia" value={session?.tradeName ?? "—"} />
            <DataRow label="CNPJ" value={session?.cnpj ?? "—"} />
            <DataRow
              label="Cidade / UF"
              value={[session?.city, session?.state].filter(Boolean).join(" / ") || "—"}
            />
            <DataRow label="E-mail de acesso" value={session?.email ?? "—"} />
            <DataRow label="Contato" value={session?.contactName ?? "—"} />
            <DataRow
              label="Último acesso"
              value={session?.lastLoginAt ? formatDateTime(session.lastLoginAt) : "—"}
            />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Precisa alterar algum dado cadastral? Fale com a representação.
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-card-foreground">Alterar senha</h2>
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
              />
            </Field>
          </div>
          <PrimaryButton className="mt-4 w-full" disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando..." : "Salvar nova senha"}
          </PrimaryButton>
        </GlassCard>

        <GlassCard className="p-4 lg:col-span-2">
          <h2 className="mb-3 font-display text-sm font-semibold text-card-foreground">
            Últimos acessos
          </h2>
          <div className="space-y-2">
            {accessLogs && accessLogs.length > 0 ? (
              accessLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div className="size-2 rounded-full bg-green-500" />
                  <span>Acesso realizado em {formatDateTime(log)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum acesso recente encontrado.</p>
            )}
          </div>
        </GlassCard>
      </div>
    </PortalShell>
  );
}
