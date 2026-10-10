import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, KeyRound, MessageCircle } from "lucide-react";
import {
  Chip,
  Field,
  GhostButton,
  PrimaryButton,
  SectionTitle,
  SelectInput,
  TextInput,
} from "@/components/navor-rephub/ui";
import { BrandTag } from "@/components/navor-rephub/BrandTag";
import { useBrands } from "@/hooks/useCrm";
import { formatDateTime, whatsappLink } from "@/lib/crm";
import {
  createPortalAccess,
  getPortalAccess,
  removePortalAccess,
  resetPortalPassword,
  setClientBrandAccess,
  setPortalStatus,
} from "@/lib/portalAdmin.functions";

/**
 * Painel administrativo do Portal do Cliente dentro da ficha do cliente:
 * cria o acesso, mostra a senha temporária e libera as marcas visíveis.
 */
export function PortalAccessPanel({
  clientId,
  clientName,
  defaultEmail,
  whatsapp,
}: {
  clientId: string;
  clientName: string;
  defaultEmail?: string | null;
  whatsapp?: string | null;
}) {
  const qc = useQueryClient();
  const { data: brands = [] } = useBrands();
  const { data: access, isLoading } = useQuery({
    queryKey: ["portal-access", clientId],
    queryFn: () => getPortalAccess({ data: { clientId } }),
  });

  const [email, setEmail] = useState(defaultEmail ?? "");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedBrands(access?.brandIds ?? []);
    setTempPassword(null);
    setEmail(access?.email ?? defaultEmail ?? "");
  }, [access, defaultEmail, clientId]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["portal-access", clientId] });
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}/cliente/login` : "/cliente/login";

  const shareText = tempPassword
    ? `Olá! Seu acesso ao portal está pronto.\nEndereço: ${loginUrl}\nE-mail: ${email}\nSenha temporária: ${tempPassword}`
    : "";

  return (
    <div>
      <SectionTitle
        title="Portal do Cliente"
        hint="Crie a área do cliente, gerencie a senha e escolha as marcas visíveis"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-4">
          {access?.hasAccess ? (
            <div className="rounded-xl border border-border bg-ink-2/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={access.status === "Ativo" ? "brand" : "rose"}>Acesso {access.status}</Chip>
                <span className="text-xs text-muted-foreground">{access.email}</span>
                <span className="text-[11px] text-muted-foreground">
                  Último acesso: {access.lastLoginAt ? formatDateTime(access.lastLoginAt) : "nunca entrou"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SelectInput
                  className="max-w-40"
                  value={access.status ?? "Ativo"}
                  onChange={(e) =>
                    void run(async () => {
                      await setPortalStatus({
                        data: {
                          clientId,
                          status: e.target.value as "Ativo" | "Bloqueado" | "Suspenso",
                        },
                      });
                      refresh();
                      toast.success("Situação do acesso atualizada.");
                    })
                  }
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Bloqueado">Bloqueado</option>
                  <option value="Suspenso">Suspenso</option>
                </SelectInput>
                <GhostButton
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await resetPortalPassword({ data: { clientId } });
                      setTempPassword(r.password);
                      refresh();
                      toast.success("Nova senha temporária gerada.");
                    })
                  }
                >
                  <KeyRound className="size-3.5" /> Gerar nova senha
                </GhostButton>
                <GhostButton
                  className="border-rose/30 text-rose"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (!window.confirm(`Remover o acesso ao portal de ${clientName}?`)) return;
                      await removePortalAccess({ data: { clientId } });
                      setTempPassword(null);
                      refresh();
                      toast.success("Acesso removido.");
                    })
                  }
                >
                  Remover acesso
                </GhostButton>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-ink-2/40 p-3">
              <p className="mb-3 text-xs text-muted-foreground">
                Este cliente ainda não tem acesso ao portal. Informe o e-mail de acesso e o sistema gera
                uma senha provisória. No primeiro acesso o cliente troca a senha.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="E-mail de acesso">
                  <TextInput
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="compras@loja.com.br"
                  />
                </Field>
                <PrimaryButton
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await createPortalAccess({
                        data: { clientId, email: email.trim(), username: clientName },
                      });
                      setTempPassword(r.password);
                      refresh();
                      toast.success("Área do cliente criada. Envie a senha provisória.");
                    })
                  }
                >
                  Criar área do cliente
                </PrimaryButton>
              </div>
            </div>
          )}

          {tempPassword ? (
            <div className="rounded-xl border border-brand/40 bg-brand/10 p-3">
              <p className="text-xs font-medium text-card-foreground">
                Senha temporária (mostrada apenas agora)
              </p>
              <p className="mt-1 font-display text-lg font-bold tracking-widest text-brand">
                {tempPassword}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <GhostButton
                  onClick={() => {
                    void navigator.clipboard.writeText(shareText);
                    toast.success("Dados de acesso copiados.");
                  }}
                >
                  <Copy className="size-3.5" /> Copiar dados
                </GhostButton>
                {whatsappLink(whatsapp ?? null, shareText) ? (
                  <a
                    href={whatsappLink(whatsapp ?? null, shareText) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <GhostButton className="border-brand/30 text-brand">
                      <MessageCircle className="size-3.5" /> Enviar por WhatsApp
                    </GhostButton>
                  </a>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Endereço de acesso do cliente: {loginUrl}
              </p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Marcas liberadas no portal
            </p>
            {brands.length === 0 ? (
              <p className="text-xs text-muted-foreground">Cadastre marcas nas fábricas primeiro.</p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {brands.map((b) => {
                    const on = selectedBrands.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        onClick={() =>
                          setSelectedBrands(
                            on ? selectedBrands.filter((x) => x !== b.id) : [...selectedBrands, b.id],
                          )
                        }
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                          on ? "border-brand/50 bg-brand/10" : "border-border hover:bg-accent/50"
                        }`}
                      >
                        <BrandTag
                          brand={b.brand}
                          logoUrl={(b as unknown as { logo_url?: string | null }).logo_url}
                          hint={b.company_name}
                        />
                        <span className={on ? "text-brand" : "text-muted-foreground"}>
                          {on ? "liberada" : "liberar"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-end">
                  <PrimaryButton
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await setClientBrandAccess({ data: { clientId, brandIds: selectedBrands } });
                        refresh();
                        toast.success("Marcas liberadas atualizadas.");
                      })
                    }
                  >
                    Salvar marcas liberadas
                  </PrimaryButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
