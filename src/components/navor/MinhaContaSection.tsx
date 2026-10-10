import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Shield, KeyRound, User, FileText, Smartphone, Mail, LogOut, CheckCircle2, Lock } from "lucide-react";
import {
  GlassCard,
  SectionTitle,
  Field,
  TextInput,
  PrimaryButton,
  GhostButton,
} from "@/components/navor-rephub/ui";
import {
  getAccountSecurityProfile,
  updateUserEmail,
  updateUserPassword,
  updateMarketingPreference,
  revokeOtherSessions,
} from "@/api/account-security";
import { supabase } from "@/integrations/supabase/client";

export function MinhaContaSection() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    marketingOptIn: boolean;
    createdAt: string | null;
  } | null>(null);

  const [consent, setConsent] = useState<{
    termsVersion: string;
    privacyVersion: string;
    termsAcceptedAt: string | null;
    privacyAcknowledgedAt: string | null;
    marketingOptIn: boolean;
    acceptanceSource: string;
  } | null>(null);

  // Estados de edição de e-mail
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Estados de troca de senha
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Estado de marketing
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [savingMarketing, setSavingMarketing] = useState(false);

  // Estado de sessões
  const [revokingSessions, setRevokingSessions] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const res = await getAccountSecurityProfile();
      if (res) {
        setProfile(res.profile);
        setConsent(res.consent);
        setMarketingOptIn(Boolean(res.consent?.marketingOptIn ?? res.profile?.marketingOptIn));
      }
    } catch (err) {
      console.error("[MinhaContaSection] Erro ao carregar dados de segurança:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleUpdateEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error("Informe o novo endereço de e-mail.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await updateUserEmail({ data: { newEmail: newEmail.trim() } });
      toast.success(res.message);
      setEditingEmail(false);
      setNewEmail("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Não foi possível atualizar o e-mail.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da senha não confere.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await updateUserPassword({ data: { newPassword } });
      toast.success(res.message);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleMarketingToggle(checked: boolean) {
    setMarketingOptIn(checked);
    setSavingMarketing(true);
    try {
      const res = await updateMarketingPreference({ data: { marketingOptIn: checked } });
      toast.success(res.message);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar preferência de marketing.");
      setMarketingOptIn(!checked);
    } finally {
      setSavingMarketing(false);
    }
  }

  async function handleRevokeOthers() {
    setRevokingSessions(true);
    try {
      const res = await revokeOtherSessions();
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err.message || "Erro ao revogar outras sessões.");
    } finally {
      setRevokingSessions(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      toast.success("Sessão encerrada com sucesso.");
      void navigate({ to: "/auth", replace: true });
    } catch {
      window.location.href = "/auth";
    }
  }

  if (loading) {
    return (
      <GlassCard className="p-5 text-center text-xs text-muted-foreground">
        Carregando informações da conta e segurança...
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grade com os 3 cards compactos */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* CARD 1: MINHA CONTA */}
        <GlassCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="size-4 text-brand" />
              <SectionTitle title="Minha Conta" hint="Identidade estável e dados cadastrais" />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">Nome completo</span>
                <span className="text-card-foreground font-medium text-sm">{profile?.name || "Não informado"}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">Telefone cadastrado</span>
                <span className="text-card-foreground">{profile?.phone || "Não informado"}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">E-mail de acesso</span>
                <span className="text-card-foreground font-mono">{profile?.email || "Não informado"}</span>
              </div>

              <div className="rounded-lg bg-card/40 border border-border/50 p-2 text-[11px] text-muted-foreground">
                <span className="block font-medium text-card-foreground">Identidade estável:</span>
                A alteração de e-mail preserva seu histórico, tenants e permissões.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60">
            {!editingEmail ? (
              <GhostButton
                onClick={() => {
                  setNewEmail("");
                  setEditingEmail(true);
                }}
                className="w-full text-xs"
              >
                <Mail className="size-3.5 mr-1.5" />
                Alterar e-mail de acesso
              </GhostButton>
            ) : (
              <form onSubmit={handleUpdateEmail} className="space-y-2">
                <Field label="Novo e-mail">
                  <TextInput
                    type="email"
                    required
                    placeholder="novo.email@empresa.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <PrimaryButton disabled={savingEmail} className="flex-1 text-xs">
                    {savingEmail ? "Salvando..." : "Confirmar troca"}
                  </PrimaryButton>
                  <GhostButton onClick={() => setEditingEmail(false)} className="text-xs">
                    Cancelar
                  </GhostButton>
                </div>
              </form>
            )}
          </div>
        </GlassCard>

        {/* CARD 2: SEGURANÇA */}
        <GlassCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="size-4 text-brand" />
              <SectionTitle title="Segurança da Conta" hint="Credenciais e sessões ativas" />
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <Field label="Nova senha">
                <TextInput
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>

              <Field label="Confirmar nova senha">
                <TextInput
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>

              <PrimaryButton
                disabled={savingPassword || !newPassword}
                className="w-full text-xs"
              >
                {savingPassword ? "Atualizando senha..." : "Salvar nova senha"}
              </PrimaryButton>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Sessão atual:</span>
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <CheckCircle2 className="size-3" />
                Ativa no navegador
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <GhostButton
                onClick={() => void handleRevokeOthers()}
                disabled={revokingSessions}
                className="flex-1 text-[11px]"
              >
                <Lock className="size-3 mr-1" />
                Sair de outros dispositivos
              </GhostButton>
              <GhostButton
                onClick={() => void handleLogout()}
                className="text-[11px] text-destructive hover:text-destructive"
              >
                <LogOut className="size-3 mr-1" />
                Sair
              </GhostButton>
            </div>
          </div>
        </GlassCard>

        {/* CARD 3: PRIVACIDADE E CONSENTIMENTOS */}
        <GlassCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="size-4 text-brand" />
              <SectionTitle title="Privacidade e Consentimentos" hint="Histórico versionado e LGPD" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-border/60 bg-card/30 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-card-foreground">Termos de Uso:</span>
                  <span className="font-semibold text-brand">v{consent?.termsVersion || "1.1"}</span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Aceite registrado:</span>
                  <span>
                    {consent?.termsAcceptedAt
                      ? new Date(consent.termsAcceptedAt).toLocaleDateString("pt-BR")
                      : "Cadastro inicial"}
                  </span>
                </div>
                <div className="pt-1">
                  <Link
                    to="/termos"
                    target="_blank"
                    className="text-[11px] text-brand hover:underline inline-flex items-center gap-1"
                  >
                    <FileText className="size-3" />
                    Ler Termos de Uso vigentes
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-card/30 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-card-foreground">Política de Privacidade:</span>
                  <span className="font-semibold text-brand">v{consent?.privacyVersion || "1.0"}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Canal do DPO: <span className="font-mono">privacidade@navorbr.com</span>
                </div>
                <div className="pt-1">
                  <Link
                    to="/privacidade"
                    target="_blank"
                    className="text-[11px] text-brand hover:underline inline-flex items-center gap-1"
                  >
                    <Shield className="size-3" />
                    Ler Política de Privacidade
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60">
            <div className="flex items-start gap-2.5">
              <input
                id="pref-marketing"
                type="checkbox"
                checked={marketingOptIn}
                disabled={savingMarketing}
                onChange={(e) => void handleMarketingToggle(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border bg-background text-brand focus:ring-brand"
              />
              <label
                htmlFor="pref-marketing"
                className="text-xs leading-relaxed text-muted-foreground select-none cursor-pointer"
              >
                <span className="font-medium text-card-foreground">Comunicações comerciais: </span>
                Receber novidades, lançamentos e avisos de produtos NAVOR.
              </label>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
