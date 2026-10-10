import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Info, Bell, MessageSquare, Mail } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { MinhaContaSection } from "@/components/navor/MinhaContaSection";
import {
  Field,
  GhostButton,
  GlassCard,
  PrimaryButton,
  SectionTitle,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import { DEFAULT_WHATSAPP_TEMPLATE, UF_LIST } from "@/lib/crm";
import { crmDb, useLeadSources, useLossReasons, useSettings } from "@/hooks/useCrm";
import {
  EMPTY_REPRESENTATION,
  GLOBAL_ACCOUNT_ID,
  REPRESENTATION_KEY,
  SYSTEM_ICON_URL,
  SYSTEM_LOGO_URL,
  SYSTEM_NAME,
  useRepresentation,
  type Representation,
} from "@/lib/branding";
import { saveMySettings } from "@/lib/branding.functions";
import { readLogoImage } from "@/lib/logo";
import { formatCnpj } from "@/lib/cnpj";
import { formatCep, lookupCep } from "@/lib/cep";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | CRM Representação" },
      {
        name: "description",
        content:
          "Ajuste os prazos de alerta de leads sem retorno, follow-up automático, origens de lead, motivos de recusa e o modelo de mensagem de WhatsApp.",
      },
      { property: "og:title", content: "Configurações | CRM Representação" },
      {
        property: "og:description",
        content: "Personalize alertas, automações e mensagens do CRM.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: sources = [] } = useLeadSources();
  const { data: reasons = [] } = useLossReasons();

  const [noReturn, setNoReturn] = useState("3");
  const [followup, setFollowup] = useState("2");
  const [template, setTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [activeCollectionsOnly, setActiveCollectionsOnly] = useState("false");
  const [newSource, setNewSource] = useState("");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    if (!settings) return;
    setNoReturn(String(settings["no_return_days"] ?? 3));
    setFollowup(String(settings["followup_days_after_catalog"] ?? 2));
    setTemplate(String(settings["whatsapp_template"] ?? DEFAULT_WHATSAPP_TEMPLATE));
    setActiveCollectionsOnly(String(settings["active_collections_only"] ?? "false"));
  }, [settings]);

  async function saveAll() {
    try {
      await saveMySettings({ data: { settings: [
        { key: "no_return_days", value: noReturn },
        { key: "followup_days_after_catalog", value: followup },
        { key: "whatsapp_template", value: template },
        { key: "active_collections_only", value: activeCollectionsOnly }
      ]}});
      void qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Configurações salvas.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addSource() {
    if (!newSource.trim()) return;
    const { error } = await crmDb.from("lead_sources").insert({ name: newSource.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewSource("");
    void qc.invalidateQueries({ queryKey: ["lead-sources"] });
  }

  async function addReason() {
    if (!newReason.trim()) return;
    const { error } = await crmDb.from("loss_reasons").insert({ name: newReason.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewReason("");
    void qc.invalidateQueries({ queryKey: ["loss-reasons"] });
  }

  return (
    <AppShell title="Configurações" subtitle="Minha conta, segurança, representação, alertas e automações">
      {/* Minha Conta, Segurança e Privacidade NAVOR */}
      <MinhaContaSection />

      <div className="mt-6">
        <RepresentacaoCard />
      </div>
      <div className="mt-4">
        <IntegracoesNotificacoesCard />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <SectionTitle title="Alertas e automações" hint="Usados no dashboard e nas notificações" />
          <div className="space-y-3">
            <Field label="Avisar quando o lead ficar sem retorno por (dias)">
              <TextInput
                type="number"
                min={1}
                value={noReturn}
                onChange={(e) => setNoReturn(e.target.value)}
              />
            </Field>
            <Field label="Agendar follow-up automático após envio de catálogo (dias)">
              <TextInput
                type="number"
                min={1}
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
              />
            </Field>
            <Field label="Modelo de mensagem de WhatsApp">
              <TextArea
                rows={5}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                maxLength={1000}
              />
            </Field>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="active_collections_only"
                checked={activeCollectionsOnly === "true"}
                onChange={(e) => setActiveCollectionsOnly(e.target.checked ? "true" : "false")}
                className="size-4 rounded border-border bg-ink focus:ring-brand"
              />
              <label htmlFor="active_collections_only" className="text-sm font-medium text-card-foreground">
                Ocultar dados de coleções Encerradas nos resumos e módulos
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Variáveis disponíveis: {"{NOME}"}, {"{EMPRESA}"}, {"{MARCA}"}.
            </p>
            <PrimaryButton onClick={() => void saveAll()}>Salvar configurações</PrimaryButton>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-5">
            <SectionTitle title="Origens de lead" />
            <div className="flex flex-wrap gap-2">
              {sources.map((s) => (
                <span
                  key={s.id}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-card-foreground"
                >
                  {s.name}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <TextInput
                placeholder="Nova origem"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                maxLength={60}
              />
              <GhostButton onClick={() => void addSource()}>Adicionar</GhostButton>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle title="Motivos de recusa" />
            <div className="flex flex-wrap gap-2">
              {reasons.map((r) => (
                <span
                  key={r.id}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-card-foreground"
                >
                  {r.name}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <TextInput
                placeholder="Novo motivo"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                maxLength={60}
              />
              <GhostButton onClick={() => void addReason()}>Adicionar</GhostButton>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

/** Notificações e Integrações de WhatsApp e E-mail (Credenciais e alertas) */
function IntegracoesNotificacoesCard() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const [saving, setSaving] = useState(false);

  // WhatsApp
  const [waProvider, setWaProvider] = useState("manual");
  const [metaPhoneId, setMetaPhoneId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [metaWabaId, setMetaWabaId] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionToken, setEvolutionToken] = useState("");

  // Alertas para o Representante
  const [repPhone, setRepPhone] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [alertNewLead, setAlertNewLead] = useState("1");
  const [alertInvoiced, setAlertInvoiced] = useState("1");
  const [autoNotifyClientOrder, setAutoNotifyClientOrder] = useState("0");

  // E-mail Provider
  const [emailProvider, setEmailProvider] = useState("manual");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailApiKey, setEmailApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");

  useEffect(() => {
    if (!settings) return;
    setWaProvider(String(settings["whatsapp_provider"] ?? "manual"));
    setMetaPhoneId(String(settings["whatsapp_meta_phone_id"] ?? ""));
    setMetaToken(String(settings["whatsapp_meta_token"] ?? ""));
    setMetaWabaId(String(settings["whatsapp_meta_waba_id"] ?? ""));
    setTwilioSid(String(settings["twilio_sid"] ?? ""));
    setTwilioToken(String(settings["twilio_token"] ?? ""));
    setTwilioFrom(String(settings["twilio_from"] ?? ""));
    setEvolutionUrl(String(settings["whatsapp_evolution_url"] ?? ""));
    setEvolutionToken(String(settings["whatsapp_evolution_token"] ?? ""));

    setRepPhone(String(settings["rep_alert_whatsapp"] ?? ""));
    setRepEmail(String(settings["rep_alert_email"] ?? ""));
    setAlertNewLead(String(settings["alert_new_lead"] ?? "1"));
    setAlertInvoiced(String(settings["alert_invoiced"] ?? "1"));
    setAutoNotifyClientOrder(String(settings["auto_notify_client_order"] ?? "0"));

    setEmailProvider(String(settings["email_provider"] ?? "manual"));
    setEmailFrom(String(settings["email_from"] ?? ""));
    setEmailApiKey(String(settings["email_api_key"] ?? ""));
    setSmtpHost(String(settings["smtp_host"] ?? ""));
    setSmtpPort(String(settings["smtp_port"] ?? "587"));
    setSmtpUser(String(settings["smtp_user"] ?? ""));
    setSmtpPass(String(settings["smtp_pass"] ?? ""));
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      const entries: [string, string][] = [
        ["whatsapp_provider", waProvider],
        ["whatsapp_meta_phone_id", metaPhoneId.trim()],
        ["whatsapp_meta_token", metaToken.trim()],
        ["whatsapp_meta_waba_id", metaWabaId.trim()],
        ["twilio_sid", twilioSid.trim()],
        ["twilio_token", twilioToken.trim()],
        ["twilio_from", twilioFrom.trim()],
        ["whatsapp_evolution_url", evolutionUrl.trim()],
        ["whatsapp_evolution_token", evolutionToken.trim()],

        ["rep_alert_whatsapp", repPhone.trim()],
        ["rep_alert_email", repEmail.trim()],
        ["alert_new_lead", alertNewLead],
        ["alert_invoiced", alertInvoiced],
        ["auto_notify_client_order", autoNotifyClientOrder],

        ["email_provider", emailProvider],
        ["email_from", emailFrom.trim()],
        ["email_api_key", emailApiKey.trim()],
        ["smtp_host", smtpHost.trim()],
        ["smtp_port", smtpPort.trim()],
        ["smtp_user", smtpUser.trim()],
        ["smtp_pass", smtpPass.trim()],
      ];

      const settingsToSave = entries.map(([key, value]) => ({ key, value }));
      await saveMySettings({ data: { settings: settingsToSave } });

      void qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Configurações de notificações e integrações salvas!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          title="Notificações e Integrações (WhatsApp & E-mail)"
          hint="Credenciais e canais de disparo para o representante, clientes e leads"
        />
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              waProvider !== "manual"
                ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                waProvider !== "manual" ? "animate-pulse bg-emerald-400" : "bg-muted-foreground"
              }`}
            />
            {waProvider === "manual" ? "Envio assistido (wa.me)" : "WhatsApp API Conectado"}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-ink-2/40 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-brand" />
          <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-card-foreground">
              Como funcionam os envios de WhatsApp e E-mail:
            </p>
            <p>
              • <strong className="text-card-foreground">Envio Assistido (Padrão do sistema):</strong>{" "}
              O CRM gera links diretos do WhatsApp (<code className="rounded bg-muted px-1">wa.me</code>) e
              do cliente de e-mail com mensagens pré-formatadas. Basta 1 clique para abrir seu WhatsApp Web
              ou aplicativo, sem custos de API ou risco de bloqueio.
            </p>
            <p>
              • <strong className="text-card-foreground">Envio Automático em Segundo Plano:</strong> Para que o
              sistema envie mensagens sozinho (como alertas urgentes no WhatsApp do representante para novos leads,
              notificações de faturamento ou confirmação automática de pedido para o cliente), selecione o
              provedor desejado e informe suas credenciais de API abaixo.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Coluna 1: Alertas do Representante */}
        <div className="space-y-3 rounded-xl border border-border bg-ink-2/30 p-4">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-brand" />
            <h4 className="text-sm font-semibold text-card-foreground">Alertas do Representante</h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Onde você recebe avisos imediatos de atividades no CRM.
          </p>

          <Field label="WhatsApp para receber alertas">
            <TextInput
              placeholder="(11) 99999-9999"
              value={repPhone}
              onChange={(e) => setRepPhone(e.target.value)}
              maxLength={25}
            />
          </Field>

          <Field label="E-mail para receber alertas">
            <TextInput
              placeholder="representante@email.com"
              type="email"
              value={repEmail}
              onChange={(e) => setRepEmail(e.target.value)}
              maxLength={120}
            />
          </Field>

          <div className="space-y-2 border-t border-border/50 pt-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-card-foreground">
              <input
                type="checkbox"
                checked={alertNewLead === "1"}
                onChange={(e) => setAlertNewLead(e.target.checked ? "1" : "0")}
                className="rounded border-border"
              />
              Avisar representante sobre novo lead
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-card-foreground">
              <input
                type="checkbox"
                checked={alertInvoiced === "1"}
                onChange={(e) => setAlertInvoiced(e.target.checked ? "1" : "0")}
                className="rounded border-border"
              />
              Avisar representante ao faturar pedido
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-card-foreground">
              <input
                type="checkbox"
                checked={autoNotifyClientOrder === "1"}
                onChange={(e) => setAutoNotifyClientOrder(e.target.checked ? "1" : "0")}
                className="rounded border-border"
              />
              Avisar cliente por WhatsApp ao emitir pedido
            </label>
          </div>
        </div>

        {/* Coluna 2: Provedor de WhatsApp */}
        <div className="space-y-3 rounded-xl border border-border bg-ink-2/30 p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-brand" />
            <h4 className="text-sm font-semibold text-card-foreground">WhatsApp Automatizado</h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Escolha o serviço para envio automático em segundo plano.
          </p>

          <Field label="Provedor de WhatsApp">
            <SelectInput value={waProvider} onChange={(e) => setWaProvider(e.target.value)}>
              <option value="manual">Apenas links diretos (wa.me) — Sem API</option>
              <option value="meta">Meta Cloud API (Oficial da Meta)</option>
              <option value="twilio">Twilio for WhatsApp</option>
              <option value="evolution">Evolution API / Z-API (Instância)</option>
            </SelectInput>
          </Field>

          {waProvider === "meta" ? (
            <div className="space-y-3 pt-2">
              <Field label="Phone Number ID">
                <TextInput
                  placeholder="Ex.: 105672948291039"
                  value={metaPhoneId}
                  onChange={(e) => setMetaPhoneId(e.target.value)}
                />
              </Field>
              <Field label="Token Permanente de Acesso">
                <TextInput
                  type="password"
                  placeholder="EAAG..."
                  value={metaToken}
                  onChange={(e) => setMetaToken(e.target.value)}
                />
              </Field>
              <Field label="WhatsApp Business Account ID (WABA)">
                <TextInput
                  placeholder="Ex.: 192837465019283"
                  value={metaWabaId}
                  onChange={(e) => setMetaWabaId(e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {waProvider === "twilio" ? (
            <div className="space-y-3 pt-2">
              <Field label="Account SID">
                <TextInput
                  placeholder="AC..."
                  value={twilioSid}
                  onChange={(e) => setTwilioSid(e.target.value)}
                />
              </Field>
              <Field label="Auth Token">
                <TextInput
                  type="password"
                  placeholder="Token do console Twilio"
                  value={twilioToken}
                  onChange={(e) => setTwilioToken(e.target.value)}
                />
              </Field>
              <Field label="Número Remetente Twilio">
                <TextInput
                  placeholder="whatsapp:+14155238886"
                  value={twilioFrom}
                  onChange={(e) => setTwilioFrom(e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {waProvider === "evolution" ? (
            <div className="space-y-3 pt-2">
              <Field label="URL da Instância">
                <TextInput
                  placeholder="https://api.seudominio.com"
                  value={evolutionUrl}
                  onChange={(e) => setEvolutionUrl(e.target.value)}
                />
              </Field>
              <Field label="Chave de API (API Key)">
                <TextInput
                  type="password"
                  placeholder="Token da instância"
                  value={evolutionToken}
                  onChange={(e) => setEvolutionToken(e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {waProvider === "manual" ? (
            <p className="text-[11px] italic text-muted-foreground">
              Nenhuma credencial necessária. Os botões de WhatsApp abrem diretamente no navegador ou aplicativo com a mensagem pronta.
            </p>
          ) : null}
        </div>

        {/* Coluna 3: Provedor de E-mail */}
        <div className="space-y-3 rounded-xl border border-border bg-ink-2/30 p-4">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-brand" />
            <h4 className="text-sm font-semibold text-card-foreground">E-mail Automatizado</h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Envio de espelhos, notificações e relatórios por e-mail.
          </p>

          <Field label="Provedor de E-mail">
            <SelectInput value={emailProvider} onChange={(e) => setEmailProvider(e.target.value)}>
              <option value="manual">Apenas links mailto: — Sem servidor</option>
              <option value="smtp">SMTP Próprio (Hostinger, Google, etc.)</option>
              <option value="resend">Resend API</option>
            </SelectInput>
          </Field>

          {emailProvider === "resend" ? (
            <div className="space-y-3 pt-2">
              <Field label="Resend API Key">
                <TextInput
                  type="password"
                  placeholder="re_..."
                  value={emailApiKey}
                  onChange={(e) => setEmailApiKey(e.target.value)}
                />
              </Field>
              <Field label="E-mail remetente verificado">
                <TextInput
                  placeholder="contato@seudominio.com.br"
                  value={emailFrom}
                  onChange={(e) => setEmailFrom(e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {emailProvider === "smtp" ? (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Field label="Host SMTP">
                    <TextInput
                      placeholder="smtp.seudominio.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                    />
                  </Field>
                </div>
                <div>
                  <Field label="Porta">
                    <TextInput
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <Field label="Usuário SMTP">
                <TextInput
                  placeholder="seu-email@dominio.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
              </Field>
              <Field label="Senha SMTP / App Password">
                <TextInput
                  type="password"
                  placeholder="••••••••"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                />
              </Field>
              <Field label="E-mail remetente exibido">
                <TextInput
                  placeholder="contato@seudominio.com.br"
                  value={emailFrom}
                  onChange={(e) => setEmailFrom(e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {emailProvider === "manual" ? (
            <p className="text-[11px] italic text-muted-foreground">
              Links de e-mail abrem seu cliente padrão (Outlook, Gmail ou Thunderbird).
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <PrimaryButton disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando..." : "Salvar integrações e notificações"}
        </PrimaryButton>
      </div>
    </GlassCard>
  );
}

/** Cadastro da empresa de representação: dados, ícone e imagem de topo. */
function RepresentacaoCard() {
  const qc = useQueryClient();
  const { representation } = useRepresentation();
  const [form, setForm] = useState<Representation>(EMPTY_REPRESENTATION);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(representation);
  }, [representation]);

  function set<K extends keyof Representation>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Região de atuação: estados brasileiros (múltipla escolha) + Exterior.
  const chosen = (form.regions_states || form.regions || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const abroad = chosen.includes("EXTERIOR");
  const selectedStates = chosen.filter((s) => s !== "EXTERIOR");

  function setStates(states: string[]) {
    const list = [...states, ...(abroad ? ["EXTERIOR"] : [])];
    setForm((f) => ({
      ...f,
      regions_states: list.join(", "),
      regions: list.join(", "),
      ...(abroad ? {} : { regions_abroad: "" }),
    }));
  }

  function toggleState(uf: string) {
    if (uf === "EXTERIOR") {
      const list = abroad ? selectedStates : [...selectedStates, "EXTERIOR"];
      setForm((f) => ({
        ...f,
        regions_states: list.join(", "),
        regions: list.join(", "),
        ...(abroad ? { regions_abroad: "" } : {}),
      }));
      return;
    }
    setStates(
      selectedStates.includes(uf)
        ? selectedStates.filter((s) => s !== uf)
        : [...selectedStates, uf],
    );
  }

  async function pickImage(key: "icon_url" | "banner_url", file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await readLogoImage(file, key === "icon_url" ? 256 : 1200);
      const { uploadBrandingImage } = await import("@/lib/branding.functions");
      const kind = key === "icon_url" ? "icon" : "banner";
      const res = await uploadBrandingImage({ data: { kind, dataUrl } });
      setForm((f) => ({
        ...f,
        [key]: res.url,
        [kind === "icon" ? "icon_path" : "banner_path"]: res.path,
      }));
      toast.success("Imagem enviada. Clique em salvar para aplicar.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const { saveMyRepresentation } = await import("@/lib/branding.functions");
      await saveMyRepresentation({ data: form });
      void qc.invalidateQueries({ queryKey: ["representation"] });
      toast.success("Dados da representação salvos.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard className="p-5">
      <SectionTitle
        title="Dados da representação"
        hint={`O nome do sistema (${SYSTEM_NAME}) é fixo; estes dados identificam a sua representação`}
      />

      {form.banner_url ? (
        <img
          src={form.banner_url}
          alt={form.name || "Imagem de topo"}
          className="mb-4 max-h-32 w-full rounded-xl border border-border bg-ink-2/40 object-contain p-3"
        />
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          {form.icon_url ? (
            <img
              src={form.icon_url}
              alt="Ícone"
              className="size-14 rounded-xl border border-border object-contain"
            />
          ) : (
            <div className="grid size-14 place-items-center rounded-xl border border-border text-[11px] text-muted-foreground">
              ícone
            </div>
          )}
          <div className="space-y-1">
            <label className="block cursor-pointer text-xs text-brand hover:underline">
              Escolher ícone
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickImage("icon_url", e.target.files?.[0])}
              />
            </label>
            <label className="block cursor-pointer text-xs text-brand hover:underline">
              Escolher imagem de topo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickImage("banner_url", e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
        <GhostButton
          onClick={() => {
            set("icon_url", SYSTEM_ICON_URL);
            set("banner_url", SYSTEM_LOGO_URL);
          }}
        >
          Usar imagens enviadas
        </GhostButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Nome da representação (destaque)">
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
        </Field>
        <Field label="Slogan">
          <TextInput value={form.slogan} onChange={(e) => set("slogan", e.target.value)} maxLength={140} />
        </Field>
        <Field label="Razão social">
          <TextInput value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} maxLength={160} />
        </Field>
        <Field label="CNPJ">
          <TextInput
            value={form.cnpj}
            onChange={(e) => set("cnpj", formatCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            maxLength={18}
          />
        </Field>
        <Field label="Inscrição estadual">
          <TextInput
            value={form.state_registration}
            onChange={(e) => set("state_registration", e.target.value)}
            maxLength={30}
          />
        </Field>
        <Field label="Responsável">
          <TextInput value={form.responsible} onChange={(e) => set("responsible", e.target.value)} maxLength={120} />
        </Field>
        <Field label="Telefone">
          <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} />
        </Field>
        <Field label="WhatsApp">
          <TextInput value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} maxLength={30} />
        </Field>
        <Field label="E-mail">
          <TextInput value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={160} />
        </Field>
        <Field label="Site">
          <TextInput value={form.website} onChange={(e) => set("website", e.target.value)} maxLength={160} />
        </Field>
        <Field label="Instagram">
          <TextInput value={form.instagram} onChange={(e) => set("instagram", e.target.value)} maxLength={80} />
        </Field>
        <Field label="CEP">
          <TextInput
            value={form.zip_code}
            onChange={(e) => {
              const cep = formatCep(e.target.value);
              set("zip_code", cep);
              if (cep.replace(/\D/g, "").length === 8) {
                void lookupCep(cep)
                  .then((d) => {
                    if (d.address) set("address", d.address);
                    if (d.district) set("district", d.district);
                    if (d.city) set("city", d.city);
                    if (d.state) set("state", d.state);
                  })
                  .catch(() => undefined);
              }
            }}
            placeholder="00000-000"
            inputMode="numeric"
            maxLength={9}
          />
        </Field>
        <Field label="Endereço">
          <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={180} />
        </Field>
        <Field label="Bairro">
          <TextInput value={form.district} onChange={(e) => set("district", e.target.value)} maxLength={80} />
        </Field>
        <Field label="Cidade">
          <TextInput value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
        </Field>
        <Field label="UF">
          <TextInput value={form.state} onChange={(e) => set("state", e.target.value)} maxLength={2} />
        </Field>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-ink-2/40 p-4">
        <SectionTitle
          title="Região de atuação"
          hint="Marque todos os estados atendidos pela representação. Exterior abre um campo livre."
        />
        <div className="flex flex-wrap gap-2">
          {UF_LIST.map((uf) => {
            const active = selectedStates.includes(uf);
            return (
              <button
                key={uf}
                type="button"
                onClick={() => toggleState(uf)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground hover:bg-accent/60"
                }`}
              >
                {uf}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => toggleState("EXTERIOR")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              abroad
                ? "border-cyan/50 bg-cyan/15 text-cyan"
                : "border-border text-muted-foreground hover:bg-accent/60"
            }`}
          >
            Exterior
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <GhostButton onClick={() => setStates(UF_LIST.slice())}>Selecionar todos</GhostButton>
          <GhostButton onClick={() => setStates([])}>Limpar seleção</GhostButton>
        </div>
        {abroad ? (
          <div className="mt-3">
            <Field label="Quais países / regiões no exterior">
              <TextInput
                value={form.regions_abroad}
                onChange={(e) => set("regions_abroad", e.target.value)}
                placeholder="Ex.: Paraguai, Uruguai, Chile"
                maxLength={200}
              />
            </Field>
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-muted-foreground">
          {selectedStates.length > 0 || abroad
            ? `Selecionados: ${[...selectedStates, ...(abroad ? ["Exterior"] : [])].join(", ")}`
            : "Nenhum estado selecionado ainda."}
        </p>
      </div>

      <div className="mt-3">
        <Field label="Observações">
          <TextArea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={600} />
        </Field>
      </div>

      <PrimaryButton className="mt-4" disabled={busy} onClick={() => void save()}>
        {busy ? "Salvando..." : "Salvar dados da representação"}
      </PrimaryButton>
    </GlassCard>
  );
}
