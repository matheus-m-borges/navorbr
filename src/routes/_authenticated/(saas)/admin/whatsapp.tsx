import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, Button, Label, Chip, TextInput, PrimaryButton, GhostButton } from "@/components/navor-rephub/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Building2,
  Phone,
  Sparkles,
  Send,
  Sliders,
  Link2,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createServerFn } from "@tanstack/react-start";
import { requireAdminSession } from "@/api/admin-actions";
import { z } from "zod";

// ==========================================
// SERVER FUNCTIONS
// ==========================================

export const testConnectionFn = createServerFn({ method: "POST" })
  .handler(async () => {
  await requireAdminSession();
    const { testWhatsAbleConnection } = await import("@/lib/whatsable/client");
    return await testWhatsAbleConnection();
  });

export const getSubscriberAccountsUsage = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Buscar todas as contas de assinantes
    const { data: accounts } = await (supabaseAdmin as any)
      .from("accounts")
      .select("id, name, whatsapp_number_limit, created_at")
      .order("name", { ascending: true });

    if (!accounts) return [];

    // Buscar todos os números cadastrados
    const { data: numbers } = await (supabaseAdmin as any)
      .from("whatsapp_bot_numbers")
      .select("phone_number, account_id, name, active, user_id")
      .not("phone_number", "like", "sim-%");

    return accounts.map((acc: any) => {
      const accNumbers = (numbers || []).filter((n: any) => n.account_id === acc.id);
      const activeCount = accNumbers.filter((n: any) => n.active).length;
      return {
        id: acc.id,
        name: acc.name,
        limit: acc.whatsapp_number_limit || 3,
        activeCount,
        totalCount: accNumbers.length,
        numbers: accNumbers,
      };
    });
  });

export const updateAccountWhatsappLimit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      accountId: z.string().uuid(),
      limit: z.number().int().min(1).max(100),
    }).parse
  )
  .handler(async ({ data }) => {
  await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("accounts")
      .update({ whatsapp_number_limit: data.limit })
      .eq("id", data.accountId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const simulateAdminAgentChat = createServerFn({ method: "POST" })
  .validator(
    z.object({
      messageText: z.string().min(1),
      targetAccountId: z.string().optional(),
    }).parse
  )
  .handler(async ({ data }) => {
    const adminSession = await requireAdminSession();
    const { processWhatsAppMessage } = await import("@/lib/agent/agent.server");

    const accountId = data.targetAccountId;
    if (!accountId) throw new Error("ACCOUNT_SELECTION_REQUIRED");

    const simPhone = `sim-admin-${adminSession.userId!.substring(0, 8)}`;
    const reply = await processWhatsAppMessage(simPhone, data.messageText, undefined, {
      accountId,
      userId: adminSession.userId!,
    });
    return { reply };
  });

export const sendTestWhatsAppMessageFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      toPhone: z.string().min(8),
      messageText: z.string().min(1),
    }).parse
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const { sendWhatsAppTextMessage } = await import("@/lib/whatsable/client");
    return await sendWhatsAppTextMessage(data.toPhone, data.messageText);
  });

export const adminAddNumberFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      accountId: z.string().uuid(),
      phoneNumber: z.string().min(8),
      name: z.string().optional(),
    }).parse
  )
  .handler(async ({ data }) => {
    const adminSession = await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let clean = data.phoneNumber.replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) {
      clean = `55${clean}`;
    }

    const payload: Record<string, any> = {
      phone_number: clean,
      account_id: data.accountId,
      user_id: adminSession.userId,
      name: data.name?.trim() || null,
      active: true,
      updated_at: new Date().toISOString(),
    };

    let { error } = await (supabaseAdmin as any)
      .from("whatsapp_bot_numbers")
      .upsert(payload);

    if (error && error.message?.includes("'name'")) {
      delete payload['name'];
      const retry = await (supabaseAdmin as any)
        .from("whatsapp_bot_numbers")
        .upsert(payload);
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getRecentWebhooksFn = createServerFn({ method: "GET" })
  .handler(async () => {
  await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: logs } = await (supabaseAdmin as any)
      .from("audit_logs")
      .select("*")
      .in("entity_type", ["whatsapp_webhook", "error"])
      .order("created_at", { ascending: false })
      .limit(20);

    return logs || [];
  });

// ==========================================
// PÁGINA ADMIN SAAS
// ==========================================

export const Route = createFileRoute("/_authenticated/(saas)/admin/whatsapp")({
  ssr: false,
  component: AdminWhatsappPage,
  head: () => ({
    meta: [
      { title: "WhatsAble Admin | Navor RepHub" },
      { name: "description", content: "Configurações da integração WhatsAble, limites de WhatsApp e simulador do SaaS." },
    ],
  }),
});

function AdminWhatsappPage() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedField, setCopiedField] = useState<'edge' | 'web' | null>(null);
  const [accountsUsage, setAccountsUsage] = useState<any[]>([]);
  const [editingLimits, setEditingLimits] = useState<Record<string, number>>({});
  const [savingLimitId, setSavingLimitId] = useState<string | null>(null);

  // Live Test Send
  const [liveTestPhone, setLiveTestPhone] = useState('');
  const [liveTestMsg, setLiveTestMsg] = useState('Teste RepHub - integração WhatsAble funcionando com sucesso!');
  const [sendingLiveTest, setSendingLiveTest] = useState(false);
  const [liveTestResult, setLiveTestResult] = useState<any>(null);

  // Webhooks log state
  const [recentWebhooks, setRecentWebhooks] = useState<any[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);

  // New Number state
  const [newNumberAccountId, setNewNumberAccountId] = useState('');
  const [newNumberPhone, setNewNumberPhone] = useState('558681116254');
  const [newNumberName, setNewNumberName] = useState('Matheus Borges');
  const [addingNumber, setAddingNumber] = useState(false);

  // Simulator state
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [simInput, setSimInput] = useState('');
  const [simMessages, setSimMessages] = useState<{ role: 'user' | 'bot'; text: string; time: string }[]>([
    {
      role: 'bot',
      text: 'Olá! Sou o assistente de IA RepHub em modo de simulação do SaaS. Teste intenções, comandos de pedidos e consultas.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadWebhooks();
  }, []);

  const loadWebhooks = () => {
    setLoadingWebhooks(true);
    getRecentWebhooksFn()
      .then(res => setRecentWebhooks(res || []))
      .catch(console.error)
      .finally(() => setLoadingWebhooks(false));
  };

  const loadAccounts = () => {
    getSubscriberAccountsUsage()
      .then(res => {
        setAccountsUsage(res);
        const limitsMap: Record<string, number> = {};
        res.forEach((acc: any) => {
          limitsMap[acc.id] = acc.limit;
        });
        setEditingLimits(limitsMap);
        if (res.length > 0 && !selectedAccountId) {
          setSelectedAccountId(res[0].id);
          setNewNumberAccountId(res[0].id);
        }
      })
      .catch(console.error);
  };

  async function handleAddNumber() {
    if (!newNumberAccountId || !newNumberPhone.trim()) {
      toast.error('Selecione o assinante e informe o telefone.');
      return;
    }
    setAddingNumber(true);
    try {
      await adminAddNumberFn({
        data: {
          accountId: newNumberAccountId,
          phoneNumber: newNumberPhone.trim(),
          name: newNumberName.trim() || undefined,
        }
      });
      toast.success('Número autorizado com sucesso no RepHub!');
      setNewNumberPhone('');
      setNewNumberName('');
      loadAccounts();
    } catch (err: any) {
      toast.error('Erro ao autorizar número: ' + err.message);
    } finally {
      setAddingNumber(false);
    }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const edgeWebhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/whatsapp-incoming` : '';
  const webWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/public/whatsapp/webhook`
    : '';

  const handleCopy = (text: string, field: 'edge' | 'web') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('URL copiada!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnectionFn();
      setTestResult(result);
      if (result.success) toast.success("Conexão com a WhatsAble estabelecida com sucesso!");
      else toast.error("Falha na conexão: " + result.message);
    } catch (err: any) {
      toast.error(err.message);
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSendLiveTest() {
    if (!liveTestPhone.trim() || sendingLiveTest) {
      toast.error('Informe o número de WhatsApp de destino.');
      return;
    }
    setSendingLiveTest(true);
    setLiveTestResult(null);
    try {
      const res = await sendTestWhatsAppMessageFn({
        data: {
          toPhone: liveTestPhone.trim(),
          messageText: liveTestMsg.trim() || 'Teste RepHub - integração WhatsAble',
        }
      });
      setLiveTestResult(res);
      if (res.success) {
        toast.success(`Mensagem enviada com sucesso para ${liveTestPhone}!`);
      } else {
        toast.error(`Falha no envio: ${res.error || 'Erro retornado pela WhatsAble'}`);
      }
    } catch (err: any) {
      setLiveTestResult({ success: false, error: err.message });
      toast.error(err.message);
    } finally {
      setSendingLiveTest(false);
    }
  }


  async function handleSaveAccountLimit(accId: string) {
    const limit = editingLimits[accId];
    if (!limit || limit < 1) {
      toast.error("Informe um limite válido (mínimo 1).");
      return;
    }

    setSavingLimitId(accId);
    try {
      await updateAccountWhatsappLimit({ data: { accountId: accId, limit: Number(limit) } });
      toast.success("Limite de números atualizado com sucesso!");
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar limite.");
    } finally {
      setSavingLimitId(null);
    }
  }

  const handleSendSim = async () => {
    if (!simInput.trim() || simLoading) return;
    const userMsg = simInput.trim();
    setSimInput('');

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSimMessages(prev => [...prev, { role: 'user', text: userMsg, time }]);
    setSimLoading(true);

    try {
      const res = await simulateAdminAgentChat({
        data: {
          messageText: userMsg,
          targetAccountId: selectedAccountId || undefined,
        }
      });
      setSimMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: res.reply || 'Sem resposta.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setSimMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: 'Erro ao processar: ' + err.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Gestão WhatsApp & WhatsAble (SaaS Admin)</h2>
        <p className="text-sm text-muted-foreground">
          Controle centralizado dos limites de números por assinante, credenciais de infraestrutura e ambiente de simulação da IA.
        </p>
      </div>

      <Tabs defaultValue="limits" className="w-full space-y-6">
        <TabsList className="bg-ink-2 border border-border p-1 rounded-xl">
          <TabsTrigger value="limits" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="w-4 h-4" /> Assinantes & Limites de Números
          </TabsTrigger>
          <TabsTrigger value="infra" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Link2 className="w-4 h-4" /> Webhooks & Integração WhatsAble
          </TabsTrigger>
          <TabsTrigger value="simulator" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Sparkles className="w-4 h-4" /> Simulador de IA (Testes SaaS)
          </TabsTrigger>
        </TabsList>

        {/* ==========================================
            ABA 1: ASSINANTES & LIMITES DE NÚMEROS
            ========================================== */}
        <TabsContent value="limits" className="space-y-6 mt-0">
          <GlassCard className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                  <Building2 className="size-5 text-primary" /> Limite de Números Autorizados por Assinante
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Defina a quantidade de números de WhatsApp que cada empresa assinante pode autorizar no seu plano.
                </p>
              </div>
            </div>

            {/* Form Rápido para Autorizar Número */}
            <div className="p-4 rounded-xl bg-ink-2/60 border border-primary/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="text-xs font-semibold text-card-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" /> Autorizar Novo Número no WhatsApp Bot
                </h4>
                <span className="text-[10px] text-muted-foreground">Números precisam estar cadastrados para a IA responder</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Assinante</label>
                  <select
                    value={newNumberAccountId}
                    onChange={e => setNewNumberAccountId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg bg-ink-3 border border-border text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {accountsUsage.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Telefone (com DDD e 55)</label>
                  <TextInput
                    value={newNumberPhone}
                    onChange={e => setNewNumberPhone(e.target.value)}
                    placeholder="ex: 558681116254"
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Nome do Usuário</label>
                  <TextInput
                    value={newNumberName}
                    onChange={e => setNewNumberName(e.target.value)}
                    placeholder="ex: Matheus Borges"
                    className="text-xs h-8"
                  />
                </div>
                <div className="flex items-end">
                  <PrimaryButton
                    onClick={handleAddNumber}
                    disabled={addingNumber || !newNumberPhone.trim() || !newNumberAccountId}
                    className="w-full h-8 text-xs flex items-center justify-center gap-1.5"
                  >
                    {addingNumber ? 'Autorizando...' : '+ Autorizar Número'}
                  </PrimaryButton>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {accountsUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conta de assinante encontrada.</p>
              ) : (
                accountsUsage.map(acc => (
                  <div key={acc.id} className="p-4 rounded-xl bg-ink-2/40 border border-border space-y-3 transition-colors hover:bg-ink-2/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-card-foreground text-sm">{acc.name}</h4>
                        <span className="text-xs text-muted-foreground font-mono">ID: {acc.id}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Chip tone={acc.activeCount >= acc.limit ? 'rose' : 'brand'}>
                          {acc.activeCount} / {acc.limit} números em uso
                        </Chip>

                        {/* Campo de Alteração de Limite */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Limite:</span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editingLimits[acc.id] ?? acc.limit}
                            onChange={e => setEditingLimits({ ...editingLimits, [acc.id]: parseInt(e.target.value, 10) || 1 })}
                            className="w-16 h-8 text-center rounded-lg bg-ink-3 border border-border text-xs text-card-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Button
                            onClick={() => handleSaveAccountLimit(acc.id)}
                            disabled={savingLimitId === acc.id}
                            size="sm"
                            className="h-8 text-xs px-2.5 bg-primary text-primary-foreground"
                          >
                            {savingLimitId === acc.id ? 'Salvando...' : 'Salvar'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Números Ativos do Assinante */}
                    {acc.numbers.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
                        {acc.numbers.map((n: any) => (
                          <span
                            key={n.phone_number}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-ink-3 border border-border text-card-foreground"
                          >
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <span>{n.name ? `${n.name} (${n.phone_number})` : n.phone_number}</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${n.active ? 'bg-green-500' : 'bg-muted-foreground'}`}></span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhum número cadastrado por este assinante ainda.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </TabsContent>

        {/* ==========================================
            ABA 2: WEBHOOKS & INTEGRAÇÃO WHATSABLE
            ========================================== */}
        <TabsContent value="infra" className="space-y-6 mt-0">
          <GlassCard className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                <h3 className="text-lg font-semibold text-card-foreground">Conexão WhatsAble & Notifier API</h3>
              </div>
              <Button
                onClick={handleTestConnection}
                disabled={testing}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-xs shrink-0"
              >
                {testing ? "Testando..." : "Testar Conexão WhatsAble"}
              </Button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${testResult.success ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                {testResult.success ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Alerta de Configuração Única de Webhook */}
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-300">Atenção com URLs duplicadas na WhatsAble:</p>
                  <p className="text-amber-200/90 leading-relaxed">
                    Mantenha <strong>apenas uma URL ativa</strong> no console da WhatsAble. Ter tanto a Edge Function quanto o Servidor Web cadastrados faz a WhatsAble disparar dois eventos simultâneos, bloqueando mensagens por duplicidade. Mantenha <strong>apenas a URL do Servidor Web (Vercel)</strong> abaixo:
                  </p>
                </div>
              </div>

              {/* Card Webhook Principal */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-card-foreground text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> URL Oficial do Webhook (Servidor RepHub / Vercel)
                  </span>
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                    Recomendada
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta é a URL que deve estar configurada no Console do WhatsAble em <strong>Webhooks</strong>:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 bg-ink-3 border border-border p-2.5 rounded-lg font-mono text-xs text-card-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                    {webWebhookUrl}
                  </div>
                  <Button
                    onClick={() => handleCopy(webWebhookUrl, 'web')}
                    variant="outline"
                    size="sm"
                    className="shrink-0 bg-ink-2 h-9 px-3"
                  >
                    {copiedField === 'web' ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                    <span className="text-xs ml-1">{copiedField === 'web' ? 'Copiado!' : 'Copiar'}</span>
                  </Button>
                </div>
              </div>

              {/* Card Disparo de Teste Real no WhatsApp */}
              <div className="p-4 rounded-xl border border-border bg-ink-2/30 space-y-3">
                <div>
                  <span className="font-semibold text-card-foreground text-sm flex items-center gap-2">
                    <Send className="w-4 h-4 text-primary" /> Testar Envio Real de Mensagem no WhatsApp
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dispare uma mensagem diretamente para testar a comunicação com a API Notifier da WhatsAble.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Número de Destino (com DDD)</Label>
                    <TextInput
                      value={liveTestPhone}
                      onChange={e => setLiveTestPhone(e.target.value)}
                      placeholder="ex: 5586981116254"
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">Mensagem de Teste</Label>
                    <div className="flex gap-2">
                      <TextInput
                        value={liveTestMsg}
                        onChange={e => setLiveTestMsg(e.target.value)}
                        placeholder="Mensagem..."
                        className="text-xs h-9 flex-1"
                      />
                      <PrimaryButton
                        onClick={handleSendLiveTest}
                        disabled={sendingLiveTest || !liveTestPhone.trim()}
                        className="text-xs h-9 px-4 shrink-0 flex items-center gap-1.5"
                      >
                        {sendingLiveTest ? (
                          <>
                            <div className="size-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="size-3.5" />
                            <span>Enviar</span>
                          </>
                        )}
                      </PrimaryButton>
                    </div>
                  </div>
                </div>

                {liveTestResult && (
                  <div className={`p-3 rounded-lg text-xs border ${liveTestResult.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
                    <span className="font-semibold">{liveTestResult.success ? 'Entregue para WhatsAble!' : 'Falha no envio:'}</span>{' '}
                    {liveTestResult.success
                      ? `WhatsAble respondeu OK (ID: ${liveTestResult.message_id || 'OK'}). Se não tocar no WhatsApp, verifique a janela de 24h abaixo.`
                      : (liveTestResult.error || liveTestResult.message || 'Erro de comunicação')}
                    {liveTestResult.data && (
                      <details className="mt-2 pt-2 border-t border-border/40 font-mono text-[10px] text-muted-foreground">
                        <summary className="cursor-pointer hover:underline text-card-foreground">Ver resposta bruta da API WhatsAble</summary>
                        <pre className="mt-1 p-2 rounded bg-black/40 overflow-x-auto whitespace-pre-wrap max-h-40">
                          {JSON.stringify(liveTestResult.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                <div className="text-[11px] text-muted-foreground bg-ink-3/60 p-3 rounded-lg space-y-1.5 border border-border/50">
                  <p className="font-medium text-card-foreground">💡 Dicas importantes da Meta & WhatsAble:</p>
                  <p>
                    <strong>1. Janela de 24 horas da Meta:</strong> Por regra oficial do WhatsApp Cloud API, para receber mensagens de texto livre sem template, o celular de destino precisa ter enviado pelo menos uma mensagem para o número da empresa nas últimas 24h.
                  </p>
                  <p>
                    <strong>2. Onde ver se a mensagem chegou na WhatsAble:</strong> No painel da WhatsAble, clique na aba <em>"Webhooks Recebidos e Enviados"</em> (ao lado da aba Webhooks). Lá fica o log completo de todas as tentativas de entrega da Meta.
                  </p>
                  <p>
                    <strong>3. Formato do número no Brasil:</strong> Se o número não receber com o 9º dígito (ex: 5586981116254), tente também com 8 dígitos (ex: 558681116254), pois a Meta registra contas antigas de certos DDDs sem o 9º dígito.
                  </p>
                </div>
              </div>

              {/* Secrets */}
              <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                <h4 className="font-medium text-card-foreground text-sm mb-2">Secrets de Infraestrutura</h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-card-foreground font-mono">
                  <li>
                    NOTIFYER_API_BASE_URL: <span className="font-sans text-muted-foreground">https://api.insightssystem.com</span>
                  </li>
                  <li>
                    NOTIFYER_API_TOKEN: <span className="font-sans text-muted-foreground">(JWT do console WhatsAble)</span>
                  </li>
                  <li>
                    OPENAI_API_KEY / GEMINI_API_KEY: <span className="font-sans text-muted-foreground">(Chave de IA para o Agente de WhatsApp)</span>
                  </li>
                </ul>
              </div>

              {/* Monitor de Webhooks Recebidos */}
              <div className="p-4 rounded-xl bg-ink-2/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-card-foreground text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" /> Histórico de Webhooks Recebidos (Tempo Real)
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Monitore as requisições que a WhatsAble envia para o RepHub quando uma mensagem chega no WhatsApp.
                    </p>
                  </div>
                  <Button
                    onClick={loadWebhooks}
                    disabled={loadingWebhooks}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 px-3"
                  >
                    {loadingWebhooks ? 'Atualizando...' : 'Atualizar Logs'}
                  </Button>
                </div>

                {recentWebhooks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg space-y-1">
                    <p className="font-medium text-card-foreground">Nenhum webhook recebido recentemente pelo servidor.</p>
                    <p>Quando uma mensagem for enviada no WhatsApp com a opção "AI Assistant" ligada no WhatsAble, a requisição aparecerá aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {recentWebhooks.map((log: any) => (
                      <div key={log.id} className="p-2.5 rounded-lg bg-ink-3/60 border border-border text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              log.entity_type === 'error'
                                ? 'bg-destructive/20 text-destructive'
                                : log.action === 'REPLY'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-primary/20 text-primary'
                            }`}>
                              {log.entity_type === 'error' ? 'ERRO' : log.action}
                            </span>
                            <span className="text-card-foreground font-medium">{log.description}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        {log.after_data && (
                          <details className="text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/30">
                            <summary className="cursor-pointer hover:text-card-foreground">Ver Payload JSON</summary>
                            <pre className="mt-1 p-2 rounded bg-black/40 overflow-x-auto whitespace-pre-wrap max-h-40">
                              {JSON.stringify(log.after_data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ==========================================
            ABA 3: SIMULADOR DE IA (TESTES SAAS)
            ========================================== */}
        <TabsContent value="simulator" className="space-y-4 mt-0">
          <GlassCard className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-3">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Simulador de IA e Prompts (Administração)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Simule conversas reais em nome de qualquer assinante para validar pedidos, atalhos determinísticos e respostas da IA.
                </p>
              </div>

              {/* Seletor de Assinante para Teste */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Contexto:</span>
                <select
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-ink-3 border border-border text-xs text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[200px]"
                >
                  {accountsUsage.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
                <GhostButton
                  onClick={() => setSimMessages([
                    {
                      role: 'bot',
                      text: 'Simulador reiniciado. Envie uma mensagem para testar.',
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }
                  ])}
                  className="text-xs h-9 px-3"
                >
                  Limpar
                </GhostButton>
              </div>
            </div>

            {/* Atalhos Rápidos para o Admin */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Testes rápidos:</span>
              {[
                'Ajuda',
                'Quero cadastrar um pedido da Loja ABC de R$ 15.000',
                'Cadastre o cliente Loja Nova Estrela',
                'Lance despesa de R$ 250 combustível',
                'Cancelar'
              ].map(cmd => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => setSimInput(cmd)}
                  className="px-2.5 py-1 rounded-md bg-ink-3 border border-border text-card-foreground hover:border-primary transition-colors text-xs"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Chat Box */}
            <div className="h-96 overflow-y-auto space-y-3 p-4 rounded-xl bg-ink-3/40 border border-border">
              {simMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-ink-2 border border-border text-card-foreground rounded-bl-none shadow-sm'
                      }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 px-1">{msg.time}</span>
                </div>
              ))}
              {simLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground italic p-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Agente processando resposta via IA...
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={simInput}
                onChange={e => setSimInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendSim()}
                placeholder="Digite uma mensagem para testar o agente..."
                className="flex-1 h-11 px-4 rounded-lg bg-ink-3 border border-border text-sm text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <PrimaryButton
                onClick={handleSendSim}
                disabled={simLoading || !simInput.trim()}
                className="h-11 px-5 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Enviar
              </PrimaryButton>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
