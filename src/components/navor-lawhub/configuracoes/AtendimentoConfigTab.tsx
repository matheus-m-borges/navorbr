import { useState, useEffect } from "react";
import {
  PhoneCall,
  Key,
  Copy,
  Check,
  Clock,
  Bot,
  Sparkles,
  Layers,
  Zap,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Headphones,
  ShieldCheck,
  AlertCircle,
  X,
  Target,
  Megaphone,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LawHubAtendimentoService } from "@/lib/lawhub/atendimento-service";
import { getMetaWhatsAppIntegrationStatus, saveMetaWhatsAppIntegration, testStoredMetaWhatsAppIntegration, saveCallCenterOperationalConfig, getCallCenterOperationalConfig, saveCallCenterCampaign, deleteCallCenterCampaign } from "@/api/tenant-integrations";
import type { LawDepartment, LawQuickMessage, LawTrafficCampaignCode } from "@/lib/lawhub/atendimento-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SubSection = "whatsapp" | "horarios" | "ia" | "setores" | "respostas" | "trafego_codigos";

export function AtendimentoConfigTab() {
  const [subSection, setSubSection] = useState<SubSection>("whatsapp");

  // Estados: WhatsApp Oficial & Webhook
  const [phoneNumber, setPhoneNumber] = useState("+55 (86) 99482-1190");
  const [phoneNumberId, setPhoneNumberId] = useState("109482910482910");
  const [wabaId, setWabaId] = useState("849201948201948");
  const [accessToken, setAccessToken] = useState("");
  const [showSecureTokenForm, setShowSecureTokenForm] = useState(false);
  const [metaConnection, setMetaConnection] = useState<{ configured: boolean; tokenLastFour: string | null; tokenStatus: string; verifiedAt: string | null; account: any | null } | null>(null);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isTestingMeta, setIsTestingMeta] = useState(false);
  const [metaDiagnostic, setMetaDiagnostic] = useState<{
    checkedAt: string;
    displayPhoneNumber: string | null;
    qualityRating: string;
    checks: { credential: boolean; phoneNumber: boolean; waba: boolean; metaApi: boolean; webhookVerification: boolean; webhookSignature: boolean };
  } | null>(null);
  const [metaDiagnosticError, setMetaDiagnosticError] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState("lawhub_meta_secret_token_2026");
  const [isCopiedWebhook, setIsCopiedWebhook] = useState(false);
  const [isCopiedToken, setIsCopiedToken] = useState(false);

  // Estados: Guia e Modais Informativos de Credenciais Meta
  const [showMetaGuide, setShowMetaGuide] = useState(false);
  const [activeInfoModal, setActiveInfoModal] = useState<string | null>(null);

  // Webhook URL gerada para este escritório
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/whatsapp/lawhub`
    : "https://seudominio.com/api/public/whatsapp/lawhub";

  // Estados: Horários & Mensagens
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("18:00");
  const [businessDays, setBusinessDays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg a Sex
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Olá! Seja muito bem-vindo ao escritório Borges & Advogados Associados. Eu sou a assistente virtual e estou aqui para agilizar seu atendimento. Como podemos ajudá-lo hoje?"
  );
  const [outOfHoursMessage, setOutOfHoursMessage] = useState(
    "Olá! Nosso horário de expediente é de segunda a sexta-feira, das 08h30 às 18h00. Recebemos sua mensagem com segurança e nosso departamento jurídico responderá no primeiro horário do próximo dia útil."
  );

  // Estados: Modo de Recepção, Bot Estruturado vs IA (CALL CENTER)
  const [receptionMode, setReceptionMode] = useState<"bot" | "ai" | "hybrid">("hybrid");
  const [leadRule, setLeadRule] = useState<"instant" | "qualified" | "manual">("instant");
  const [botMenuText, setBotMenuText] = useState(
    "Olá! Seja bem-vindo ao escritório Borges & Advogados Associados.\nPor favor, digite o número da opção desejada:\n1️⃣ - Iniciar uma nova consulta jurídica\n2️⃣ - Acompanhar andamento do meu processo\n3️⃣ - Dúvidas sobre honorários e pagamentos\n4️⃣ - Falar diretamente com um atendente"
  );

  // Estados: IA de Triagem (Padrão Lovable / Gemini)
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiBotName, setAiBotName] = useState("Dra. Sofia (Recepção Inteligente)");
  const [aiAutoCreateLeads, setAiAutoCreateLeads] = useState(true);
  const [aiCustomPrompt, setAiCustomPrompt] = useState(
    "O escritório é referência em Direito Trabalhista e Direito Cível Imobiliário. Sempre seja empática ao ouvir relatos de demissão ou problemas com atraso de obras. Solicite o nome completo e detalhe se a demissão foi com ou sem justa causa."
  );

  // Estados: Setores e Filas
  const [departments, setDepartments] = useState<LawDepartment[]>(() =>
    LawHubAtendimentoService.getDepartments()
  );
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptColor, setNewDeptColor] = useState("#2563eb");

  // Estados: Respostas Rápidas
  const [quickMessages, setQuickMessages] = useState<LawQuickMessage[]>(() =>
    LawHubAtendimentoService.getQuickMessages()
  );
  const [isAddingQuick, setIsAddingQuick] = useState(false);
  const [newShortcut, setNewShortcut] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  // Estados: Códigos de Tráfego Pago & Campanhas
  const [campaignCodes, setCampaignCodes] = useState<LawTrafficCampaignCode[]>(() =>
    LawHubAtendimentoService.getCampaignCodes()
  );
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campCode, setCampCode] = useState("");
  const [campAction, setCampAction] = useState("");
  const [campArea, setCampArea] = useState("Trabalhista");
  const [campDesc, setCampDesc] = useState("");
  const [testText, setTestText] = useState("#A1 Oi! Como podemos ajudar?\nMensagem de saudação automática");
  const [testDetected, setTestDetected] = useState<LawTrafficCampaignCode | null | "none">(null);

  // Carrega configurações persistidas se houver
  useEffect(() => {
    const saved = LawHubAtendimentoService.getSettings();
    if (saved) {
      if (saved.phoneNumber) setPhoneNumber(saved.phoneNumber);
      if (saved.phoneNumberId) setPhoneNumberId(saved.phoneNumberId);
      if (saved.wabaId) setWabaId(saved.wabaId);
      if (saved.verifyToken) setVerifyToken(saved.verifyToken);
      if (saved.startTime) setStartTime(saved.startTime);
      if (saved.endTime) setEndTime(saved.endTime);
      if (saved.businessDays) setBusinessDays(saved.businessDays);
      if (saved.welcomeMessage) setWelcomeMessage(saved.welcomeMessage);
      if (saved.outOfHoursMessage) setOutOfHoursMessage(saved.outOfHoursMessage);
      if (saved.receptionMode) setReceptionMode(saved.receptionMode);
      if (saved.leadRule) setLeadRule(saved.leadRule);
      if (saved.botMenuText) setBotMenuText(saved.botMenuText);
      if (typeof saved.aiEnabled === "boolean") setAiEnabled(saved.aiEnabled);
      if (saved.aiBotName) setAiBotName(saved.aiBotName);
      if (typeof saved.aiAutoCreateLeads === "boolean") setAiAutoCreateLeads(saved.aiAutoCreateLeads);
      if (saved.aiCustomPrompt) setAiCustomPrompt(saved.aiCustomPrompt);
    }
    getMetaWhatsAppIntegrationStatus()
      .then((result) => {
        setMetaConnection(result);
        if (result.account) {
          if (result.account.display_phone_number || result.account.phone_number) setPhoneNumber(result.account.display_phone_number || result.account.phone_number);
          if (result.account.phone_number_id) setPhoneNumberId(result.account.phone_number_id);
          if (result.account.waba_id) setWabaId(result.account.waba_id);
        }
      })
      .catch(() => undefined);
    getCallCenterOperationalConfig()
      .then(({ settings, campaigns }) => {
        if (settings) {
          setStartTime(settings.business_hours_start?.slice(0, 5) || "08:00");
          setEndTime(settings.business_hours_end?.slice(0, 5) || "18:00");
          setBusinessDays(settings.business_days || [1, 2, 3, 4, 5]);
          setWelcomeMessage(settings.welcome_message || "");
          setOutOfHoursMessage(settings.out_of_hours_message || "");
          setReceptionMode(settings.reception_mode === "bot" || settings.reception_mode === "ai" ? settings.reception_mode : "hybrid");
          setLeadRule(settings.lead_rule || "qualified");
          setBotMenuText(settings.bot_menu_text || "");
          setAiEnabled(settings.ai_enabled !== false);
          setAiBotName(settings.bot_name || "Assistente Jurídica");
          setAiAutoCreateLeads(settings.ai_auto_create_leads !== false);
          setAiCustomPrompt(settings.ai_system_prompt || "");
        }
        if (campaigns.length) setCampaignCodes(campaigns as LawTrafficCampaignCode[]);
      })
      .catch(() => undefined);
  }, []);

  const safeCopy = async (text: string, onSuccess: () => void) => {
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        onSuccess();
        return;
      }
    } catch {
      // fallback manual
    }
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      onSuccess();
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleCopyWebhook = () => {
    safeCopy(webhookUrl, () => {
      setIsCopiedWebhook(true);
      toast.success("URL de Webhook copiada para a área de transferência!");
      setTimeout(() => setIsCopiedWebhook(false), 2000);
    });
  };

  const handleCopyVerifyToken = () => {
    safeCopy(verifyToken, () => {
      setIsCopiedToken(true);
      toast.success("Token de verificação copiado!");
      setTimeout(() => setIsCopiedToken(false), 2000);
    });
  };

  const handleSaveAll = async () => {
    LawHubAtendimentoService.saveSettings({
      phoneNumber,
      phoneNumberId,
      wabaId,
      verifyToken,
      startTime,
      endTime,
      businessDays,
      welcomeMessage,
      outOfHoursMessage,
      receptionMode,
      leadRule,
      botMenuText,
      aiEnabled,
      aiBotName,
      aiAutoCreateLeads,
      aiCustomPrompt,
    });
    try {
      await saveCallCenterOperationalConfig({ data: {
        botName: aiBotName, welcomeMessage, outOfHoursMessage, startTime, endTime, businessDays,
        aiEnabled, aiAutoCreateLeads, aiCustomPrompt, receptionMode, leadRule, botMenuText,
      }});
      toast.success("Configurações do CallCenter salvas e aplicadas ao atendimento real.");
    } catch (error: any) {
      toast.error(error?.message || "As configurações locais foram salvas, mas não puderam ser aplicadas ao servidor.");
    }
  };

  const handleSaveMetaCredential = async () => {
    setIsSavingMeta(true);
    try {
      const result = await saveMetaWhatsAppIntegration({ data: { phoneNumber, phoneNumberId, wabaId, accessToken } });
      setAccessToken("");
      setShowSecureTokenForm(false);
      setMetaConnection((current) => ({
        configured: true,
        tokenLastFour: "••••",
        tokenStatus: "verified",
        verifiedAt: result.verifiedAt,
        account: current?.account || null,
      }));
      setMetaDiagnostic(null);
      setMetaDiagnosticError(null);
      toast.success("Credencial validada e guardada no cofre seguro.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível validar a credencial Meta.");
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleTestStoredMeta = async () => {
    setIsTestingMeta(true);
    setMetaDiagnosticError(null);
    try {
      const result = await testStoredMetaWhatsAppIntegration();
      setMetaConnection((current) => current ? { ...current, tokenStatus: "verified", verifiedAt: result.verifiedAt } : current);
      setMetaDiagnostic({
        checkedAt: result.verifiedAt,
        displayPhoneNumber: result.displayPhoneNumber,
        qualityRating: result.qualityRating,
        checks: result.checks,
      });
      toast.success("Conexão Meta validada com sucesso.");
    } catch (error: any) {
      const message = error?.message || "A conexão Meta não pôde ser validada.";
      setMetaDiagnosticError(message);
      toast.error(message);
    } finally {
      setIsTestingMeta(false);
    }
  };

  const toggleDay = (day: number) => {
    setBusinessDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    const newDept: LawDepartment = {
      id: `dept-${Date.now()}`,
      account_id: "default",
      name: newDeptName.trim(),
      slug: newDeptName.toLowerCase().replace(/\s+/g, "-"),
      description: "Setor personalizado do escritório",
      color: newDeptColor,
      icon: "Briefcase",
      is_active: true,
      position: departments.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [...departments, newDept];
    setDepartments(updated);
    LawHubAtendimentoService.saveDepartments(updated);
    setNewDeptName("");
    setIsAddingDept(false);
    toast.success(`Setor "${newDept.name}" cadastrado com sucesso!`);
  };

  const handleDeleteDepartment = (deptId: string) => {
    const updated = departments.filter((d) => d.id !== deptId);
    setDepartments(updated);
    LawHubAtendimentoService.saveDepartments(updated);
    toast.success("Setor removido com sucesso!");
  };

  const handleAddQuickMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcut.trim() || !newContent.trim()) return;
    const qm: LawQuickMessage = {
      id: `qm-${Date.now()}`,
      account_id: "default",
      shortcut: newShortcut.startsWith("/") ? newShortcut.trim() : `/${newShortcut.trim()}`,
      title: newTitle.trim() || newShortcut.trim(),
      content: newContent.trim(),
      department_id: null,
      is_global: true,
      created_at: new Date().toISOString(),
    };
    const updated = [...quickMessages, qm];
    setQuickMessages(updated);
    LawHubAtendimentoService.saveQuickMessages(updated);
    setNewShortcut("");
    setNewTitle("");
    setNewContent("");
    setIsAddingQuick(false);
    toast.success(`Resposta rápida "${qm.shortcut}" cadastrada!`);
  };

  const handleDeleteQuickMessage = (qmId: string) => {
    const updated = quickMessages.filter((q) => q.id !== qmId);
    setQuickMessages(updated);
    LawHubAtendimentoService.saveQuickMessages(updated);
    toast.success("Resposta rápida removida!");
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campCode.trim() || !campAction.trim()) {
      toast.error("Preencha o código da campanha e a ação jurídica correspondente.");
      return;
    }
    try {
      const saved = await saveCallCenterCampaign({ data: { id: editingCampaignId || undefined, code: campCode, actionType: campAction, areaDireito: campArea, description: campDesc, active: true } });
      LawHubAtendimentoService.saveCampaignCode(saved);
      setCampaignCodes((current) => [...current.filter((campaign) => campaign.id !== saved.id && campaign.code !== saved.code), saved]);
      setCampCode(""); setCampAction(""); setCampDesc(""); setEditingCampaignId(null); setIsAddingCampaign(false);
      toast.success(`Código de campanha [${saved.code}] salvo e aplicado ao robô.`);
    } catch (error: any) { toast.error(error?.message || "Não foi possível salvar a campanha no servidor."); }
  };

  const handleToggleCampaignActive = async (c: LawTrafficCampaignCode) => {
    try {
      const saved = await saveCallCenterCampaign({ data: { id: c.id, code: c.code, actionType: c.action_type, areaDireito: c.area_direito, description: c.description, active: !c.active } });
      LawHubAtendimentoService.saveCampaignCode(saved);
      setCampaignCodes((current) => current.map((campaign) => campaign.id === saved.id ? saved : campaign));
      toast.success(`Campanha [${c.code}] ${!c.active ? "ativada" : "pausada"}!`);
    } catch (error: any) { toast.error(error?.message || "Não foi possível atualizar a campanha no servidor."); }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      await deleteCallCenterCampaign({ data: { id } });
      LawHubAtendimentoService.deleteCampaignCode(id);
      setCampaignCodes((current) => current.filter((campaign) => campaign.id !== id));
      toast.success("Código de campanha removido do robô.");
    } catch (error: any) { toast.error(error?.message || "Não foi possível remover a campanha no servidor."); }
  };

  const handleTestRobotSimulator = () => {
    const res = LawHubAtendimentoService.detectTrafficCode(testText);
    setTestDetected(res || "none");
    if (res) {
      toast.success(`Robô reconheceu a campanha [${res.code}] com sucesso!`);
    } else {
      toast.info("Nenhum código de tráfego ativo foi reconhecido na mensagem.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo da Aba */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              Configurações do CallCenter
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Headphones className="w-3 h-3" />
              1 Número Oficial
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie as credenciais da Meta Cloud API (WhatsApp Oficial), códigos de tráfego pago, robô de reconhecimento, modo de atendimento (Bot ou IA), expediente e setores.
          </p>
        </div>

        <Button onClick={handleSaveAll} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs cursor-pointer">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Salvar Alterações
        </Button>
      </div>

      {/* Sub-navegação interna */}
      <div className="flex items-center gap-1 border-b border-border/60 pb-1 overflow-x-auto">
        {[
          { key: "whatsapp", label: "WhatsApp & Credenciais Meta", icon: PhoneCall },
          { key: "trafego_codigos", label: "Códigos de Tráfego & Campanhas", icon: Target },
          { key: "horarios", label: "Expediente & Horários", icon: Clock },
          { key: "ia", label: "Recepção, Bot & IA", icon: Bot },
          { key: "setores", label: "Setores & Filas", icon: Layers },
          { key: "respostas", label: "Respostas Rápidas (/)", icon: Zap },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subSection === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSubSection(tab.key as SubSection)}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. WHATSAPP & WEBHOOK OFICIAL (FASE 4)                                    */}
      {/* ========================================================================= */}
      {subSection === "whatsapp" && (
        <div className="space-y-6">
          {/* Card de Status da Conexão */}
          <div className={cn(
            "p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
            metaConnection?.configured ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5",
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-md shrink-0",
                metaConnection?.configured ? "bg-emerald-600 shadow-emerald-500/20" : "bg-amber-500 shadow-amber-500/20",
              )}>
                {metaConnection?.configured ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">
                    {metaConnection?.configured ? "Meta Cloud API configurada" : "Meta Cloud API ainda não configurada"}
                  </h4>
                  <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                    Graph API v21.0
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {metaConnection?.configured
                    ? <>Número vinculado: <strong className="text-foreground">{metaConnection.account?.display_phone_number || phoneNumber}</strong>{metaConnection.account?.quality_rating ? ` · qualidade ${metaConnection.account.quality_rating}` : ""}</>
                    : "Insira os identificadores e o token permanente para habilitar o atendimento oficial."}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTestStoredMeta}
              disabled={!metaConnection?.configured || isTestingMeta}
              className="text-xs font-semibold cursor-pointer"
            >
              {isTestingMeta ? "Diagnosticando..." : "Executar diagnóstico"}
            </Button>
          </div>

          {(metaDiagnostic || metaDiagnosticError) && (
            <div className={cn(
              "rounded-2xl border p-4",
              metaDiagnostic ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5",
            )}>
              <div className="flex items-start gap-2">
                {metaDiagnostic ? <ShieldCheck className="mt-0.5 size-4 text-emerald-600" /> : <AlertCircle className="mt-0.5 size-4 text-destructive" />}
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-foreground">
                    {metaDiagnostic ? "Diagnóstico da integração Meta" : "Diagnóstico não concluído"}
                  </h4>
                  {metaDiagnostic ? (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Validado em {new Date(metaDiagnostic.checkedAt).toLocaleString("pt-BR")} · número {metaDiagnostic.displayPhoneNumber || phoneNumber} · qualidade {metaDiagnostic.qualityRating}.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-[11px]">
                        {[
                          ["Cofre", metaDiagnostic.checks.credential],
                          ["Phone Number ID", metaDiagnostic.checks.phoneNumber],
                          ["WABA ID", metaDiagnostic.checks.waba],
                          ["Resposta da Meta", metaDiagnostic.checks.metaApi],
                          ["Token do webhook", metaDiagnostic.checks.webhookVerification],
                          ["Assinatura do webhook", metaDiagnostic.checks.webhookSignature],
                        ].map(([label, ok]) => (
                          <span key={String(label)} className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1.5", ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-muted bg-muted text-muted-foreground")}>
                            {ok ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}{label}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        A consulta confirma token, permissões e número diretamente na Meta. Para confirmar o fluxo completo, assine o campo <code>messages</code> no painel da Meta e envie uma mensagem real de teste ao número: somente essa etapa comprova o recebimento de mensagens pelo CallCenter.
                      </p>
                    </>
                  ) : <p className="mt-1 text-xs text-destructive">{metaDiagnosticError}</p>}
                </div>
              </div>
            </div>
          )}

          {/* GUIA PASSO A PASSO COLAPSÁVEL: Onde conseguir as credenciais da Meta */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/60 dark:bg-indigo-950/20 p-4 transition-all">
            <button
              type="button"
              onClick={() => setShowMetaGuide(!showMetaGuide)}
              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                    Guia Passo a Passo: Onde conseguir a API KEY e Credenciais na Meta
                    <span className="text-[10px] bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                      INFORMATIVO
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {showMetaGuide ? "Clique para recolher o tutorial" : "Clique aqui para ver onde localizar cada chave no portal da Meta"}
                  </p>
                </div>
              </div>
              <div className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                {showMetaGuide ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </button>

            {showMetaGuide && (
              <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/40 text-xs space-y-3.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Criar ou Acessar seu Aplicativo no Meta for Developers:</strong>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Acesse <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold inline-flex items-center gap-0.5">developers.facebook.com/apps <ExternalLink className="size-3" /></a> e selecione seu aplicativo comercial com produto <strong>WhatsApp</strong> ativado.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Copiar o Phone Number ID e o WABA ID:</strong>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      No menu lateral do aplicativo, vá em <strong>WhatsApp &gt; Configuração da API (API Setup)</strong>. Lá você encontrará o <em>"Identificador do número de telefone"</em> (Phone Number ID) e o <em>"Identificador da conta do WhatsApp Business"</em> (WABA ID).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Gerar a API KEY Permanente (Usuário do Sistema):</strong>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      No <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold inline-flex items-center gap-0.5">Gerenciador de Negócios (business.facebook.com) <ExternalLink className="size-3" /></a>, vá em <strong>Usuários do Sistema</strong> &gt; Adicionar Usuário (Função: Administrador). Clique em <strong>Gerar Novo Token</strong>, selecione seu aplicativo, defina expiração para <strong>Nunca</strong> e marque as permissões <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code>. Cole o token no campo de API KEY abaixo.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">4</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Configurar o Webhook no Meta for Developers:</strong>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      No painel da Meta, vá em <strong>WhatsApp &gt; Configuração &gt; Webhook</strong>, clique em Editar e cole a <strong>URL de Retorno de Chamada</strong> e o <strong>Token de Verificação</strong> gerados abaixo. Em seguida, assine o campo <code>messages</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dados do Webhook para colar no Meta for Developers */}
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Configuração do Webhook no Meta for Developers
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveInfoModal(activeInfoModal === "webhook" ? null : "webhook")}
                className="text-muted-foreground hover:text-primary transition p-1 cursor-pointer"
                title="Ver explicação do Webhook"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            {activeInfoModal === "webhook" && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Info className="size-4 shrink-0 mt-0.5 text-blue-600" />
                  <div>
                    <strong>O que é o Webhook?</strong> É o canal bidirecional pelo qual a Meta notifica o LawHub instantaneamente no milissegundo em que uma mensagem de cliente chega no WhatsApp do escritório.
                  </div>
                </div>
                <button type="button" onClick={() => setActiveInfoModal(null)} className="cursor-pointer text-blue-600 hover:text-blue-800">
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Cole estes dados no painel da Meta Cloud API (Aplicativo do Escritório &gt; WhatsApp &gt; Configuração &gt; Webhook):
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <span>URL de Retorno de Chamada (Callback URL)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">(Cole na Meta)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 text-xs font-mono p-2.5 rounded-lg bg-muted/50 border border-border text-foreground select-all"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyWebhook} className="text-xs shrink-0 cursor-pointer">
                    {isCopiedWebhook ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    <span>{isCopiedWebhook ? "Copiado!" : "Copiar URL"}</span>
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <span>Token de Verificação (Verify Token)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">(Segredo de handshake)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    className="flex-1 text-xs font-mono p-2.5 rounded-lg bg-background border border-border text-foreground"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyVerifyToken} className="text-xs shrink-0 cursor-pointer">
                    {isCopiedToken ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    <span>{isCopiedToken ? "Copiado!" : "Copiar Token"}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Credenciais da Conta Meta do Escritório & API KEY */}
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Credenciais da API do Escritório</h3>
                <p className="text-[11px] text-muted-foreground">
                  Insira abaixo os identificadores oficiais e a <strong>API KEY da Meta</strong> do escritório.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMetaGuide(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <BookOpen className="size-3.5" />
                <span>Onde encontrar?</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* 1. Número Exibido */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    Número de WhatsApp Exibido
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveInfoModal(activeInfoModal === "phone" ? null : "phone")}
                    className="text-muted-foreground hover:text-primary transition p-0.5 cursor-pointer"
                    title="Mais informações"
                  >
                    <Info className="size-3.5" />
                  </button>
                </div>
                {activeInfoModal === "phone" && (
                  <div className="mb-2 p-2 rounded-lg bg-muted/60 text-[10px] text-muted-foreground border border-border">
                    O número comercial (com DDI e DDD) homologado na Meta que aparecerá para os clientes. Ex: +55 (86) 99482-1190.
                  </div>
                )}
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-foreground"
                />
              </div>

              {/* 2. Phone Number ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    Phone Number ID (Meta)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveInfoModal(activeInfoModal === "phone_id" ? null : "phone_id")}
                    className="text-muted-foreground hover:text-primary transition p-0.5 cursor-pointer"
                    title="Mais informações"
                  >
                    <Info className="size-3.5" />
                  </button>
                </div>
                {activeInfoModal === "phone_id" && (
                  <div className="mb-2 p-2 rounded-lg bg-muted/60 text-[10px] text-muted-foreground border border-border">
                    Identificador numérico do número registrado na Meta Cloud API. Encontrado em: developers.facebook.com &gt; Seu App &gt; WhatsApp &gt; Configuração da API &gt; "Identificação do número de telefone".
                  </div>
                )}
                <input
                  type="text"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-foreground font-mono"
                />
              </div>

              {/* 3. WABA ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    WhatsApp Business Account ID (WABA ID)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveInfoModal(activeInfoModal === "waba_id" ? null : "waba_id")}
                    className="text-muted-foreground hover:text-primary transition p-0.5 cursor-pointer"
                    title="Mais informações"
                  >
                    <Info className="size-3.5" />
                  </button>
                </div>
                {activeInfoModal === "waba_id" && (
                  <div className="mb-2 p-2 rounded-lg bg-muted/60 text-[10px] text-muted-foreground border border-border">
                    ID da conta empresarial WhatsApp vinculada no Gerenciador de Negócios. Encontrado em: developers.facebook.com &gt; Seu App &gt; WhatsApp &gt; Configuração da API &gt; "Identificação da conta do WhatsApp Business".
                  </div>
                )}
                <input
                  type="text"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-foreground font-mono"
                />
              </div>

              {/* 4. API KEY DA META (System User Access Token Permanente) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="text-primary font-bold">API KEY da Meta</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(Token Permanente)</span>
                    <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1 py-0.2 text-[9px] font-bold">
                      CHAVE PRINCIPAL
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveInfoModal(activeInfoModal === "token" ? null : "token")}
                    className="text-muted-foreground hover:text-primary transition p-0.5 cursor-pointer"
                    title="Onde conseguir esta chave?"
                  >
                    <Info className="size-3.5" />
                  </button>
                </div>
                {activeInfoModal === "token" && (
                  <div className="mb-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 text-[10px] text-amber-900 dark:text-amber-200">
                    <strong>Atenção:</strong> Não utilize o token temporário de 24h gerado no painel de testes! Crie um <strong>Usuário do Sistema</strong> no <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" className="underline font-bold">Gerenciador de Negócios</a> com validade "Nunca expira" e permissões <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code>.
                  </div>
                )}
                {metaConnection?.configured && !showSecureTokenForm ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                          <ShieldCheck className="size-4" /> Credencial guardada no cofre seguro
                        </p>
                        <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                          Token terminado em {metaConnection.tokenLastFour || "••••"} · {metaConnection.verifiedAt ? `validado em ${new Date(metaConnection.verifiedAt).toLocaleString("pt-BR")}` : "aguardando validação"}.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={handleTestStoredMeta} disabled={isTestingMeta}>
                          {isTestingMeta ? "Testando..." : "Testar conexão"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowSecureTokenForm(true)}>
                          Trocar API Key
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      A chave será usada uma única vez para validar a Meta e será cifrada no cofre do servidor. Ela nunca será exibida novamente ou salva neste navegador.
                    </p>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Cole o Token Permanente da Meta (EAAG...)"
                      className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-foreground font-mono focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex justify-end gap-2">
                      {metaConnection?.configured && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setAccessToken(""); setShowSecureTokenForm(false); }}>
                          Cancelar
                        </Button>
                      )}
                      <Button type="button" size="sm" onClick={handleSaveMetaCredential} disabled={isSavingMeta || !accessToken.trim()}>
                        {isSavingMeta ? "Validando e salvando..." : "Inserir API Key com segurança"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HORÁRIOS & EXPEDIENTE (FASES 7 E 8)                                    */}
      {/* ========================================================================= */}
      {subSection === "horarios" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="text-sm font-bold text-foreground">Horário de Atendimento do Escritório</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Início do Expediente</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Término do Expediente</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-2 text-xs">Dias da Semana com Atendimento Ativo</label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { day: 1, label: "Seg" },
                  { day: 2, label: "Ter" },
                  { day: 3, label: "Qua" },
                  { day: 4, label: "Qui" },
                  { day: 5, label: "Sex" },
                  { day: 6, label: "Sáb" },
                  { day: 7, label: "Dom" },
                ].map((item) => {
                  const isSelected = businessDays.includes(item.day);
                  return (
                    <button
                      key={item.day}
                      type="button"
                      onClick={() => toggleDay(item.day)}
                      className={cn(
                        "w-10 h-10 rounded-xl text-xs font-bold border transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/30 text-muted-foreground border-border/80 hover:bg-muted/70"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="text-sm font-bold text-foreground">Mensagens Automáticas de Atendimento</h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Mensagem de Boas-Vindas</label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-3 rounded-lg bg-background border border-border text-foreground leading-relaxed resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Mensagem Automática Fora do Expediente
                </label>
                <textarea
                  value={outOfHoursMessage}
                  onChange={(e) => setOutOfHoursMessage(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-3 rounded-lg bg-background border border-border text-foreground leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RECEPÇÃO, BOT ESTRUTURADO & IA (CALL CENTER)                           */}
      {/* ========================================================================= */}
      {subSection === "ia" && (
        <div className="space-y-6">
          {/* Header de Status */}
          <div className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">Recepção do CallCenter & Automações</h4>
                  <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-800 dark:text-indigo-300">
                    {receptionMode === "bot" ? "BOT 0 TOKENS" : receptionMode === "ai" ? "IA CONVERSACIONAL" : "HÍBRIDO BOT + IA"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Escolha se os novos contatos de WhatsApp são atendidos por <strong>Menu Fixo (Bot Estruturado)</strong> ou por <strong>IA Jurídica</strong>.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Seleção do Modo de Recepção */}
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 text-xs">
            <div>
              <label className="font-semibold text-foreground uppercase tracking-wider text-[11px] block mb-2">
                Modo de Recepção Inicial no WhatsApp
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setReceptionMode("bot")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    receptionMode === "bot"
                      ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                      : "border-border bg-background hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs">🤖 Bot Estruturado</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">0 TOKENS</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Menu guiado numérico com opções fixas. Não consome IA de terceiros e atende imediatamente.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setReceptionMode("ai")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    receptionMode === "ai"
                      ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                      : "border-border bg-background hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs">✨ IA Conversacional</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">GEMINI FLASH</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Interpretação humana de mensagens livres. Identifica área do direito, urgência e resume o caso.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setReceptionMode("hybrid")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    receptionMode === "hybrid"
                      ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/20"
                      : "border-border bg-background hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs">⚡ Híbrido Bot + IA</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white">RECOMENDADO</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Apresenta menu rápido inicial; se o cliente digitar dúvidas em texto aberto, a IA assume e qualifica.
                  </p>
                </button>
              </div>
            </div>

            {/* Configuração do Menu do Bot quando ativo */}
            {receptionMode !== "ai" && (
              <div className="pt-2 border-t border-border/60">
                <label className="font-semibold text-foreground block mb-1">
                  Texto do Menu Interativo do Bot Estruturado
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Personalize as opções numéricas que o cliente receberá no primeiro contato:
                </p>
                <textarea
                  value={botMenuText}
                  onChange={(e) => setBotMenuText(e.target.value)}
                  rows={5}
                  className="w-full text-xs p-3 rounded-lg bg-background border border-border text-foreground font-mono leading-relaxed"
                />
              </div>
            )}

            {/* Configurações da IA quando ativa */}
            {receptionMode !== "bot" && (
              <div className="space-y-4 pt-2 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Nome da Assistente de IA</label>
                    <input
                      type="text"
                      value={aiBotName}
                      onChange={(e) => setAiBotName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-foreground"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Modelo de IA Dedicado ao Call Center</label>
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-foreground font-mono flex items-center justify-between">
                      <span>google/gemini-2.5-flash</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                        Ultra Rápido
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Instruções Específicas do Escritório (Prompt Adicional da IA)
                  </label>
                  <textarea
                    value={aiCustomPrompt}
                    onChange={(e) => setAiCustomPrompt(e.target.value)}
                    rows={3}
                    className="w-full text-xs p-3 rounded-lg bg-background border border-border text-foreground leading-relaxed resize-none"
                  />
                </div>
              </div>
            )}

            {/* Regra de Incorporação em Leads */}
            <div className="pt-3 border-t border-border/60 space-y-2">
              <label className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
                Quando a mensagem do WhatsApp deve ser incorporada nos Leads?
              </label>

              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-background hover:bg-muted/30 cursor-pointer">
                  <input
                    type="radio"
                    name="leadRule"
                    value="instant"
                    checked={leadRule === "instant"}
                    onChange={() => setLeadRule("instant")}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-bold text-foreground text-xs">
                      Incorporação Instantânea (Recomendado)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Cria o Lead imediatamente na 1ª mensagem recebida no WhatsApp, na etapa "Triagem Inicial" com origem "WhatsApp CALL CENTER".
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-background hover:bg-muted/30 cursor-pointer">
                  <input
                    type="radio"
                    name="leadRule"
                    value="qualified"
                    checked={leadRule === "qualified"}
                    onChange={() => setLeadRule("qualified")}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-bold text-foreground text-xs">
                      Incorporação Pós-Qualificação (após Bot ou IA)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      O Lead só é cadastrado no funil comercial após o cliente fornecer o nome completo e o resumo do caso jurídico.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-background hover:bg-muted/30 cursor-pointer">
                  <input
                    type="radio"
                    name="leadRule"
                    value="manual"
                    checked={leadRule === "manual"}
                    onChange={() => setLeadRule("manual")}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-bold text-foreground text-xs">
                      Incorporação Manual pelo Atendente
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Não cria automaticamente. O advogado ou atendente clica em "Criar Lead" na barra lateral direita do Call Center quando oportuno.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SETORES & FILAS (FASE 5)                                               */}
      {/* ========================================================================= */}
      {subSection === "setores" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Setores Internos de Atendimento</h3>
              <p className="text-xs text-muted-foreground">Cada setor possui sua própria fila e atendentes dedicados.</p>
            </div>
            <Button size="sm" onClick={() => setIsAddingDept(true)} className="text-xs font-semibold">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Setor
            </Button>
          </div>

          {/* Form Novo Setor */}
          {isAddingDept && (
            <form onSubmit={handleAddDepartment} className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 text-xs">
              <h4 className="font-bold text-foreground">Cadastrar Novo Setor</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-foreground mb-1">Nome do Setor *</label>
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="Ex: Jurídico Tributário"
                    className="w-full p-2 text-xs rounded-lg bg-background border border-border text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">Cor Temática</label>
                  <input
                    type="color"
                    value={newDeptColor}
                    onChange={(e) => setNewDeptColor(e.target.value)}
                    className="w-full h-8 rounded-lg cursor-pointer bg-background border border-border p-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingDept(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm">
                  Salvar Setor
                </Button>
              </div>
            </form>
          )}

          {/* Grid de Setores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departments.map((dept) => (
              <div key={dept.id} className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border"
                    style={{
                      backgroundColor: `${dept.color}15`,
                      color: dept.color,
                      borderColor: `${dept.color}30`,
                    }}
                  >
                    {dept.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dept.color }} />
                    <button
                      type="button"
                      onClick={() => handleDeleteDepartment(dept.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir setor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{dept.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. RESPOSTAS RÁPIDAS (FASE 7)                                             */}
      {/* ========================================================================= */}
      {subSection === "respostas" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Modelos de Resposta Rápida (Atalhos /)</h3>
              <p className="text-xs text-muted-foreground">
                Digite a barra "/" no campo de mensagem do atendimento para inserir estes textos instantaneamente.
              </p>
            </div>
            <Button size="sm" onClick={() => setIsAddingQuick(true)} className="text-xs font-semibold">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Atalho
            </Button>
          </div>

          {/* Form Nova Resposta Rápida */}
          {isAddingQuick && (
            <form onSubmit={handleAddQuickMessage} className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 text-xs">
              <h4 className="font-bold text-foreground">Cadastrar Novo Atalho</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">Atalho (com /) *</label>
                  <input
                    type="text"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value)}
                    placeholder="Ex: /documentos"
                    className="w-full p-2 text-xs rounded-lg bg-background border border-border text-foreground font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">Título de Referência *</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Solicitação de Documentos"
                    className="w-full p-2 text-xs rounded-lg bg-background border border-border text-foreground"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Conteúdo da Mensagem *</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={3}
                  className="w-full p-2 text-xs rounded-lg bg-background border border-border text-foreground leading-relaxed resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingQuick(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm">
                  Salvar Atalho
                </Button>
              </div>
            </form>
          )}

          {/* Lista de Respostas Rápidas */}
          <div className="space-y-2.5">
            {quickMessages.map((qm) => (
              <div key={qm.id} className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {qm.shortcut}
                    </span>
                    <span className="text-xs font-bold text-foreground">{qm.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuickMessage(qm.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir atalho"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{qm.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CÓDIGOS DE TRÁFEGO PAGO & ROBÔ DE RECONHECIMENTO                       */}
      {/* ========================================================================= */}
      {subSection === "trafego_codigos" && (
        <div className="space-y-6">
          {/* Header da Seção */}
          <div className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0 mt-0.5 sm:mt-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">Robô de Tráfego Pago & Rastreamento de Campanhas</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                    Ativo 24h
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monitora anúncios do <strong>Instagram & Facebook (Meta Ads Click to WhatsApp)</strong> e mensagens diretas. Reconhece códigos (ex: <code>#A1</code>, <code>[TRF-01]</code>), vincula à ação jurídica, grava nome e telefone no histórico e alimenta o funil de LEADs.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                setEditingCampaignId(null);
                setCampCode("");
                setCampAction("");
                setCampArea("Trabalhista");
                setCampDesc("");
                setIsAddingCampaign(true);
              }}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Código de Campanha
            </Button>
          </div>

          {/* CARD EXPLICATIVO: Como funciona o Anúncio Meta Ads CTWA */}
          <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 text-xs text-blue-950 dark:text-blue-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Como o Robô reconhece os anúncios de Tráfego Pago do Instagram / Facebook:</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              No Gerenciador de Anúncios da Meta, os anúncios com destino WhatsApp (Click-to-WhatsApp) disparam uma mensagem de saudação automática com o cartão de visualização do anúncio (ex: <strong>#A1 Oi! Como podemos ajudar?</strong> / <em>Mensagem de saudação automática</em>). O cliente não precisa digitar o código! O Robô do LawHub monitora essa saudação automática enviada pela Meta, extrai o código <strong>#A1</strong> e sincroniza automaticamente o contato com a Ação Jurídica correspondente.
            </p>
          </div>

          {/* SIMULADOR INTERATIVO DO ROBÔ */}
          <div className="p-4 rounded-2xl border border-border bg-card/60 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Simulador do Robô de Tráfego Pago
              </h4>
              <span className="text-[10px] text-muted-foreground">
                (Teste uma mensagem automática ou digitada como ela chegaria pelo WhatsApp)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Ex: #A1 Oi! Como podemos ajudar? ou [TRF-01] Olá, vi o anúncio..."
                className="flex-1 p-2.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono"
              />
              <Button
                type="button"
                onClick={handleTestRobotSimulator}
                size="sm"
                className="text-xs font-semibold shrink-0 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-300" />
                Analisar com o Robô
              </Button>
            </div>

            {/* Botões de Teste Rápido com Cenários Reais */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="text-muted-foreground font-semibold">Exemplos rápidos:</span>
              <button
                type="button"
                onClick={() => {
                  const text = "#A1 Oi! Como podemos ajudar?\nMensagem de saudação automática";
                  setTestText(text);
                  const res = LawHubAtendimentoService.detectTrafficCode(text);
                  setTestDetected(res || "none");
                }}
                className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
              >
                📸 Anúncio Instagram/Meta (#A1 Auxílio-Acidente)
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = "[TRF-01] Olá, vi seu anúncio no Facebook sobre rescisão e demissão";
                  setTestText(text);
                  const res = LawHubAtendimentoService.detectTrafficCode(text);
                  setTestDetected(res || "none");
                }}
                className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border font-medium hover:text-foreground transition-colors cursor-pointer"
              >
                Demissão [TRF-01]
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = "Olá, vi a campanha do INSS-BPC e quero saber se minha mãe tem direito";
                  setTestText(text);
                  const res = LawHubAtendimentoService.detectTrafficCode(text);
                  setTestDetected(res || "none");
                }}
                className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border font-medium hover:text-foreground transition-colors cursor-pointer"
              >
                Previdenciário [INSS-BPC]
              </button>
            </div>

            {testDetected && testDetected !== "none" && (
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2 animate-in fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                          {testDetected.code}
                        </span>
                        <strong className="text-xs font-bold text-foreground">
                          {testDetected.action_type}
                        </strong>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                          Área: {testDetected.area_direito}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        ✅ Reconhecido com sucesso pelo Robô através da saudação automática do anúncio da Meta!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prévia Visual do Cartão Meta Ads */}
                <div className="mt-2 p-2.5 rounded-lg bg-background/80 border border-border text-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 shrink-0 font-bold text-xs">
                    ADS
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-xs">Anúncio • Meta Ads</span>
                      <span className="text-[10px] text-muted-foreground">Ver detalhes</span>
                    </div>
                    <p className="text-[11px] text-foreground/90 font-medium truncate mt-0.5">
                      {testText.split("\n")[0]}
                    </p>
                    <span className="text-[9px] text-muted-foreground italic">
                      Mensagem de saudação automática
                    </span>
                  </div>
                </div>
              </div>
            )}

            {testDetected === "none" && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Nenhum código cadastrado ativo foi detectado neste texto. Cadastre o código abaixo para que o robô o identifique.</span>
              </div>
            )}
          </div>

          {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
          {isAddingCampaign && (
            <form onSubmit={handleSaveCampaign} className="p-4 rounded-2xl border border-primary/30 bg-card shadow-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {editingCampaignId ? "Editar Código de Campanha" : "Cadastrar Novo Código de Campanha"}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingCampaign(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Código no Anúncio *
                  </label>
                  <input
                    type="text"
                    value={campCode}
                    onChange={(e) => setCampCode(e.target.value.toUpperCase())}
                    placeholder="Ex: TRF-01, INSS-BPC, CIV-VOO"
                    className="w-full p-2 text-xs rounded-lg bg-background border border-border text-foreground font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-muted-foreground">Coloque este código no link/anúncio do WhatsApp</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Ação Jurídica Referenciada *
                  </label>
                  <input
                    type="text"
                    value={campAction}
                    onChange={(e) => setCampAction(e.target.value)}
                    placeholder="Ex: Revisional de FGTS / Horas Extras"
                    className="w-full p-2 text-xs rounded-lg bg-background border border-border text-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Área do Direito *
                  </label>
                  <select
                    value={campArea}
                    onChange={(e) => setCampArea(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg bg-background border border-border text-foreground"
                  >
                    <option value="Trabalhista">Trabalhista</option>
                    <option value="Previdenciário">Previdenciário</option>
                    <option value="Cível">Cível</option>
                    <option value="Cível / Consumidor">Cível / Consumidor</option>
                    <option value="Cível / Imobiliário">Cível / Imobiliário</option>
                    <option value="Bancário">Bancário</option>
                    <option value="Família & Sucessões">Família & Sucessões</option>
                    <option value="Tributário">Tributário</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Origem / Descrição da Campanha (Opcional)
                </label>
                <input
                  type="text"
                  value={campDesc}
                  onChange={(e) => setCampDesc(e.target.value)}
                  placeholder="Ex: Meta Ads Instagram Stories - Campanha Demissão sem justa causa"
                  className="w-full p-2 text-xs rounded-lg bg-background border border-border text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingCampaign(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {editingCampaignId ? "Salvar Alterações" : "Gravar Código"}
                </Button>
              </div>
            </form>
          )}

          {/* LISTA DE CÓDIGOS REGISTRADOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                Códigos de Campanha Cadastrados ({campaignCodes.length})
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {campaignCodes.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-4 rounded-xl border bg-card transition-all flex flex-col justify-between gap-3 shadow-xs",
                    item.active ? "border-border hover:border-indigo-500/40" : "border-border/40 opacity-60 bg-muted/20"
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md font-mono text-xs font-extrabold bg-indigo-600 text-white shadow-2xs">
                          {item.code}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                          {item.area_direito}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        item.active ? "bg-emerald-500/10 text-emerald-600" : "bg-zinc-500/10 text-zinc-500"
                      )}>
                        {item.active ? "Ativo" : "Pausado"}
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-foreground mt-1">
                      {item.action_type}
                    </h5>

                    {item.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="pt-1 text-[10px] text-muted-foreground font-mono bg-muted/40 p-1.5 rounded-md">
                      Exemplo WhatsApp: &quot;Olá, vim pelo anúncio [{item.code}]...&quot;
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleCampaignActive(item)}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {item.active ? "Pausar Código" : "Ativar Código"}
                    </button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCampaignId(item.id);
                          setCampCode(item.code);
                          setCampAction(item.action_type);
                          setCampArea(item.area_direito);
                          setCampDesc(item.description || "");
                          setIsAddingCampaign(true);
                        }}
                        className="h-7 text-xs px-2 cursor-pointer"
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCampaign(item.id)}
                        className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
