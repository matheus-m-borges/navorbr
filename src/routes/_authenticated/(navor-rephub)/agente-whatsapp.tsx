import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/navor-rephub/AppShell';
import {
  GlassCard,
  SectionTitle,
  TextInput,
  PrimaryButton,
  GhostButton,
  Chip,
  EmptyState,
  Field,
  Button
} from '@/components/navor-rephub/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, History, Plus, Trash2, Bot, CheckCircle2, AlertCircle, Pencil, X } from 'lucide-react';
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from 'zod';

// ==========================================
// HELPER PARA RESOLUÇÃO RESILIENTE DE CONTA E ADMIN
// ==========================================

async function resolveAccountAndAdmin(_admin: any, userId: string, adminOnly = false) {
  const { requireAuthenticatedAccount, requireTenantAdmin } = await import("@/lib/security/authorization.server");
  const scope = adminOnly
    ? await requireTenantAdmin(userId)
    : await requireAuthenticatedAccount(userId);

  return {
    accountId: scope.accountId,
    isPlatformAdmin: scope.isPlatformAdmin,
    isAccountAdmin: adminOnly || scope.isPlatformAdmin,
  };
}

// ==========================================
// SERVER FUNCTIONS
// ==========================================

export const getWhatsappLimits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { accountId } = await resolveAccountAndAdmin(supabaseAdmin, context.userId);

    if (!accountId) return { limit: 3, used: 0, accountId: null };

    let limit = 3;
    const { data: acc } = await (supabaseAdmin as any)
      .from("accounts")
      .select("whatsapp_number_limit")
      .eq("id", accountId)
      .maybeSingle();

    if (acc?.whatsapp_number_limit) {
      limit = acc.whatsapp_number_limit;
    } else {
      const { data: sub } = await (supabaseAdmin as any)
        .from("subscriptions")
        .select("plan_id")
        .eq("account_id", accountId)
        .eq("status", "active")
        .maybeSingle();

      if (sub?.plan_id) {
        const { data: plan } = await (supabaseAdmin as any)
          .from("plans")
          .select("whatsapp_number_limit")
          .eq("id", sub.plan_id)
          .maybeSingle();
        if (plan?.whatsapp_number_limit) limit = plan.whatsapp_number_limit;
      }
    }

    // Desativar preventivamente quaisquer números de simulação residuais na conta
    try {
      await (supabaseAdmin as any)
        .from("whatsapp_bot_numbers")
        .update({ active: false })
        .eq("account_id", accountId)
        .like("phone_number", "sim-%");
    } catch (_) {}

    const { count } = await (supabaseAdmin as any)
      .from("whatsapp_bot_numbers")
      .select("*", { count: 'exact', head: true })
      .eq("account_id", accountId)
      .not("phone_number", "like", "sim-%")
      .eq("active", true);

    return { limit, used: count || 0, accountId };
  });

export const saveAuthorizedNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      phoneNumber: z.string().min(8),
      name: z.string().optional(),
      originalPhoneNumber: z.string().optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { accountId, isAccountAdmin } = await resolveAccountAndAdmin(supabaseAdmin, context.userId, true);

    if (!accountId) throw new Error("Acesso não autorizado ou conta da empresa não localizada.");
    if (!isAccountAdmin) throw new Error("Somente administradores da conta podem gerenciar números.");

    let clean = data.phoneNumber.replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) {
      clean = `55${clean}`;
    }

    if (clean.length < 12) {
      throw new Error("Telefone inválido. Inclua o DDD e o número completo (ex: 86981116254 ou 5586981116254).");
    }

    const cleanOriginal = data.originalPhoneNumber ? data.originalPhoneNumber.replace(/\D/g, '') : null;
    const isEditing = !!cleanOriginal;

    // Se estiver adicionando (não editando o mesmo número), checar limite
    if (!isEditing || clean !== cleanOriginal) {
      const { data: acc } = await (supabaseAdmin as any)
        .from("accounts")
        .select("whatsapp_number_limit")
        .eq("id", accountId)
        .maybeSingle();

      const limit = acc?.whatsapp_number_limit || 3;
      const { count } = await (supabaseAdmin as any)
        .from("whatsapp_bot_numbers")
        .select("*", { count: 'exact', head: true })
        .eq("account_id", accountId)
        .not("phone_number", "like", "sim-%")
        .eq("active", true);

      // Se não for edição do mesmo número e atingiu limite
      if (!isEditing && (count || 0) >= limit) {
        throw new Error(`Limite de ${limit} número(s) atingido para a sua conta. Solicite aumento à administração do SaaS.`);
      }
    }

    // Se mudou o número de telefone durante a edição, remove o antigo
    if (isEditing && cleanOriginal && cleanOriginal !== clean) {
      await (supabaseAdmin as any)
        .from("whatsapp_bot_numbers")
        .delete()
        .eq("phone_number", cleanOriginal);
    }

    // Payload resiliente
    const numName = data.name?.trim() || null;
    let upsertPayload: Record<string, any> = {
      phone_number: clean,
      account_id: accountId,
      user_id: context.userId,
      name: numName,
      active: true,
      updated_at: new Date().toISOString(),
    };

    // Tentar upsert com 'name'. Se a coluna 'name' não existir no schema cache, retenta sem 'name'.
    let { error: upsertErr } = await (supabaseAdmin as any)
      .from("whatsapp_bot_numbers")
      .upsert(upsertPayload);

    if (upsertErr && (upsertErr.message?.includes("'name'") || upsertErr.message?.includes("column \"name\""))) {
      delete upsertPayload['name'];
      const retry = await (supabaseAdmin as any)
        .from("whatsapp_bot_numbers")
        .upsert(upsertPayload);
      upsertErr = retry.error;
    }

    if (upsertErr) throw new Error("Erro ao salvar número: " + upsertErr.message);

    // Salvar também o mapa de nomes em whatsapp_bot_settings para resiliência máxima
    if (numName) {
      try {
        const { data: settings } = await (supabaseAdmin as any)
          .from("whatsapp_bot_settings")
          .select("number_names")
          .eq("account_id", accountId)
          .maybeSingle();

        const currentNames = settings?.number_names || {};
        currentNames[clean] = numName;
        if (cleanOriginal && cleanOriginal !== clean) {
          delete currentNames[cleanOriginal];
        }

        await (supabaseAdmin as any)
          .from("whatsapp_bot_settings")
          .upsert({
            account_id: accountId,
            number_names: currentNames,
            updated_at: new Date().toISOString(),
          });
      } catch (_) {
        // Ignora caso whatsapp_bot_settings não suporte o campo
      }
    }

    return { success: true };
  });

export const toggleAuthorizedNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ phoneNumber: z.string(), active: z.boolean() }).parse)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { accountId, isPlatformAdmin, isAccountAdmin } = await resolveAccountAndAdmin(supabaseAdmin, context.userId, true);
    if (!accountId || !isAccountAdmin) {
      throw new Error("Somente administradores da conta podem alterar números.");
    }

    let query = (supabaseAdmin as any)
      .from("whatsapp_bot_numbers")
      .update({ active: data.active })
      .eq("phone_number", data.phoneNumber);

    if (!isPlatformAdmin && accountId) {
      query = query.eq("account_id", accountId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteAuthorizedNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ phoneNumber: z.string() }).parse)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { accountId, isPlatformAdmin, isAccountAdmin } = await resolveAccountAndAdmin(supabaseAdmin, context.userId, true);
    if (!accountId || !isAccountAdmin) {
      throw new Error("Somente administradores da conta podem excluir números.");
    }

    // 1. Obter o número para checar conta
    const { data: numRow } = await (supabaseAdmin as any)
      .from("whatsapp_bot_numbers")
      .select("account_id, user_id")
      .eq("phone_number", data.phoneNumber)
      .maybeSingle();

    if (!numRow) {
      return { success: true }; // Já não existe
    }

    // Permitir se for platform admin, dono da conta ou criador do número
    const hasPermission =
      isPlatformAdmin ||
      (isAccountAdmin && accountId && numRow.account_id === accountId);

    if (!hasPermission) {
      throw new Error("Acesso não autorizado para excluir este número.");
    }

    const { error } = await (supabaseAdmin as any)
      .from("whatsapp_bot_numbers")
      .delete()
      .eq("phone_number", data.phoneNumber);

    if (error) throw new Error(error.message);

    // Limpar do mapa de nomes se houver
    if (numRow.account_id) {
      try {
        const { data: settings } = await (supabaseAdmin as any)
          .from("whatsapp_bot_settings")
          .select("number_names")
          .eq("account_id", numRow.account_id)
          .maybeSingle();

        if (settings?.number_names?.[data.phoneNumber]) {
          const names = { ...settings.number_names };
          delete names[data.phoneNumber];
          await (supabaseAdmin as any)
            .from("whatsapp_bot_settings")
            .update({ number_names: names })
            .eq("account_id", numRow.account_id);
        }
      } catch (_) {}
    }

    return { success: true };
  });

export const getBotSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { accountId } = await resolveAccountAndAdmin(supabaseAdmin, context.userId);

    if (!accountId) return null;

    const { data: settings } = await (supabaseAdmin as any)
      .from("whatsapp_bot_settings")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();

    if (!settings) {
      return {
        account_id: accountId,
        bot_name: "Assistente RepHub",
        bot_personality: "Ágil, profissional e focado em vendas",
        is_active: true,
        welcome_message: "Olá! Sou o assistente virtual do RepHub. Como posso te ajudar hoje?",
      };
    }

    return settings;
  });

export const saveBotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      bot_name: z.string().min(1),
      bot_personality: z.string().min(1),
      is_active: z.boolean(),
      welcome_message: z.string().optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { accountId, isAccountAdmin } = await resolveAccountAndAdmin(supabaseAdmin, context.userId, true);

    if (!accountId) throw new Error("Usuário sem conta vinculada.");
    if (!isAccountAdmin) throw new Error("Somente administradores da conta podem alterar o robô.");

    const { error } = await (supabaseAdmin as any)
      .from("whatsapp_bot_settings")
      .upsert({
        account_id: accountId,
        bot_name: data.bot_name,
        bot_personality: data.bot_personality,
        is_active: data.is_active,
        welcome_message: data.welcome_message || null,
        updated_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getSubscriberData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { accountId, isPlatformAdmin } = await resolveAccountAndAdmin(supabaseAdmin, context.userId);

    let numbersQuery = (supabaseAdmin as any)
      .from("whatsapp_bot_numbers")
      .select("*")
      .not("phone_number", "like", "sim-%")
      .order("created_at", { ascending: false });

    let operationsQuery = (supabaseAdmin as any)
      .from("whatsapp_bot_operations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (accountId) {
      numbersQuery = numbersQuery.eq("account_id", accountId);
      operationsQuery = operationsQuery.eq("account_id", accountId);
    }

    const [{ data: numbers }, { data: operations }, { data: settings }] = await Promise.all([
      numbersQuery,
      operationsQuery,
      accountId
        ? (supabaseAdmin as any)
            .from("whatsapp_bot_settings")
            .select("number_names")
            .eq("account_id", accountId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const namesMap = settings?.number_names || {};

    const enrichedNumbers = (numbers || []).map((n: any) => ({
      ...n,
      name: n.name || namesMap[n.phone_number] || null,
    }));

    return {
      numbers: enrichedNumbers,
      operations: operations || [],
    };
  });

// ==========================================
// PÁGINA PRINCIPAL DO ASSINANTE
// ==========================================

export const Route = createFileRoute('/_authenticated/(navor-rephub)/agente-whatsapp')({
  component: AgenteWhatsappPage,
  head: () => ({
    meta: [
      { title: 'Agente WhatsApp IA | Navor RepHub' },
      { name: 'description', content: 'Gerencie os números autorizados da sua empresa e personalize seu assistente.' },
    ],
  }),
});

function AgenteWhatsappPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [numberName, setNumberName] = useState('');
  const [editingNumber, setEditingNumber] = useState<{ phoneNumber: string; name: string } | null>(null);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [limits, setLimits] = useState({ limit: 3, used: 0, accountId: null as string | null });

  // Bot Settings state
  const [botName, setBotName] = useState('Assistente RepHub');
  const [botPersonality, setBotPersonality] = useState('Ágil, profissional e focado em vendas');
  const [isActive, setIsActive] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    getWhatsappLimits().then(setLimits).catch(console.error);

    getBotSettings().then(res => {
      if (res) {
        setBotName(res.bot_name || 'Assistente RepHub');
        setBotPersonality(res.bot_personality || 'Ágil, profissional e focado em vendas');
        setIsActive(res.is_active ?? true);
        setWelcomeMessage(res.welcome_message || '');
      }
    }).catch(console.error);

    getSubscriberData().then(res => {
      setNumbers(res.numbers);
      setOperations(res.operations);
    }).catch(console.error);
  };

  const handleSaveNumber = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Informe o número de telefone com DDD.');
      return;
    }
    setLoading(true);

    try {
      await saveAuthorizedNumber({
        data: {
          phoneNumber: phoneNumber.trim(),
          name: numberName.trim() || undefined,
          originalPhoneNumber: editingNumber ? editingNumber.phoneNumber : undefined,
        }
      });
      toast.success(editingNumber ? 'Número atualizado com sucesso!' : 'Número de WhatsApp autorizado com sucesso!');
      setPhoneNumber('');
      setNumberName('');
      setEditingNumber(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar número.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (num: any) => {
    setEditingNumber({ phoneNumber: num.phone_number, name: num.name || '' });
    setPhoneNumber(num.phone_number);
    setNumberName(num.name || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingNumber(null);
    setPhoneNumber('');
    setNumberName('');
  };

  const handleToggleNumber = async (num: string, active: boolean) => {
    try {
      await toggleAuthorizedNumber({ data: { phoneNumber: num, active: !active } });
      toast.success(!active ? 'Número ativado com sucesso.' : 'Número pausado.');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteNumber = async (num: string) => {
    if (!confirm(`Deseja realmente remover o número ${num} dos autorizados?`)) return;

    try {
      await deleteAuthorizedNumber({ data: { phoneNumber: num } });
      toast.success('Número removido com sucesso.');
      if (editingNumber?.phoneNumber === num) {
        handleCancelEdit();
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover número.');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveBotSettings({
        data: {
          bot_name: botName,
          bot_personality: botPersonality,
          is_active: isActive,
          welcome_message: welcomeMessage,
        },
      });
      toast.success('Configurações do seu assistente salvas com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const formatPhone = (p: string) => {
    const d = (p || '').replace(/\D/g, '');
    if (d.startsWith('55') && d.length === 13) {
      return `+55 (${d.substring(2, 4)}) ${d.substring(4, 9)}-${d.substring(9)}`;
    }
    if (d.startsWith('55') && d.length === 12) {
      return `+55 (${d.substring(2, 4)}) ${d.substring(4, 8)}-${d.substring(8)}`;
    }
    if (d.length === 11) {
      return `(${d.substring(0, 2)}) ${d.substring(2, 7)}-${d.substring(7)}`;
    }
    return p;
  };

  return (
    <AppShell
      title="Agente Operacional WhatsApp"
      subtitle="Gerencie os números autorizados da sua empresa e personalize o comportamento do seu assistente."
    >
      <div className="space-y-6">
        {/* Banner de Limite da Empresa */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-ink-2/60 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-card-foreground text-sm">Capacidade de Números Autorizados</h4>
              <p className="text-xs text-muted-foreground">
                Limite configurado para a sua assinatura pelo administrador do SaaS.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Chip tone={limits.used >= limits.limit ? 'rose' : 'brand'}>
              {limits.used} de {limits.limit} números utilizados
            </Chip>
          </div>
        </div>

        {/* Tabs Principais do Assinante */}
        <Tabs defaultValue="numbers" className="w-full space-y-6">
          <TabsList className="bg-ink-2 border border-border p-1 rounded-xl">
            <TabsTrigger value="numbers" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Phone className="w-4 h-4" /> Números Autorizados
            </TabsTrigger>
            <TabsTrigger value="bot" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bot className="w-4 h-4" /> Meu Assistente
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="w-4 h-4" /> Histórico de Operações
            </TabsTrigger>
          </TabsList>

          {/* ==========================================
              ABA 1: NÚMEROS AUTORIZADOS
              ========================================== */}
          <TabsContent value="numbers" className="space-y-6 mt-0">
            {/* Card Cadastro / Edição de Número */}
            <GlassCard className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-semibold text-card-foreground text-base flex items-center gap-2">
                    {editingNumber ? (
                      <>
                        <Pencil className="w-4 h-4 text-primary" /> Editar Número Autorizado
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-primary" /> Autorizar Novo Número de WhatsApp
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {editingNumber
                      ? 'Atualize a identificação ou o número cadastrado abaixo.'
                      : 'Qualquer pessoa enviando mensagens a partir dos números cadastrados abaixo poderá consultar dados e emitir pedidos pelo WhatsApp.'}
                  </p>
                </div>

                {editingNumber && (
                  <GhostButton onClick={handleCancelEdit} className="text-xs flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Cancelar Edição
                  </GhostButton>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Telefone com DDD (Ex: 86981116254 ou 5586981116254)">
                  <TextInput
                    id="phone"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="Ex: 5586981116254 ou (86) 98111-6254"
                    disabled={loading || (!editingNumber && limits.used >= limits.limit)}
                  />
                </Field>

                <Field label="Identificação (Ex: Matheus Borges / Daniela Stracke / Vendas Loja)">
                  <TextInput
                    id="name"
                    value={numberName}
                    onChange={e => setNumberName(e.target.value)}
                    placeholder="Ex: Matheus Borges"
                    disabled={loading || (!editingNumber && limits.used >= limits.limit)}
                  />
                </Field>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-primary/70 shrink-0" />
                  <span>Não é necessário vincular a um usuário. A autorização pertence diretamente à sua empresa.</span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {editingNumber && (
                    <Button onClick={handleCancelEdit} variant="outline" size="sm" className="h-10 px-4 bg-ink-2">
                      Cancelar
                    </Button>
                  )}
                  <PrimaryButton
                    onClick={handleSaveNumber}
                    disabled={loading || (!editingNumber && limits.used >= limits.limit)}
                    className="h-10 px-5 flex items-center gap-2 shrink-0"
                  >
                    {editingNumber ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar Alterações'}
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> {loading ? 'Autorizando...' : 'Autorizar Número'}
                      </>
                    )}
                  </PrimaryButton>
                </div>
              </div>
            </GlassCard>

            {/* Lista de Números Cadastrados */}
            <GlassCard className="p-5 sm:p-6">
              <SectionTitle
                title="Números Ativos na sua Empresa"
                hint="Estes números estão liberados para interagir diretamente com o bot no WhatsApp."
              />

              <div className="mt-4 space-y-3">
                {numbers.length === 0 ? (
                  <EmptyState
                    title="Nenhum número autorizado ainda"
                    hint="Cadastre o seu número de WhatsApp no formulário acima para começar a operar."
                  />
                ) : (
                  numbers.map(num => (
                    <div
                      key={num.phone_number}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-ink-2/40 border border-border gap-4 transition-colors hover:bg-ink-2/60"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${num.active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-card-foreground text-sm">
                              {num.name || 'Número Autorizado'}
                            </span>
                            <Chip tone={num.active ? 'brand' : 'muted'}>
                              {num.active ? 'Ativo' : 'Inativo'}
                            </Chip>
                          </div>
                          <span className="font-mono text-xs text-muted-foreground mt-0.5">
                            {formatPhone(num.phone_number)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          onClick={() => handleStartEdit(num)}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 bg-ink-3 flex items-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5 text-primary" /> Editar
                        </Button>

                        <Button
                          onClick={() => handleToggleNumber(num.phone_number, num.active)}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 bg-ink-3"
                        >
                          {num.active ? 'Pausar' : 'Ativar'}
                        </Button>

                        <Button
                          onClick={() => handleDeleteNumber(num.phone_number)}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 text-rose-500 hover:text-rose-600 hover:border-rose-500/30 bg-ink-3"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* ==========================================
              ABA 2: MEU ASSISTENTE (PERSONALIZAÇÃO)
              ========================================== */}
          <TabsContent value="bot" className="space-y-6 mt-0">
            <GlassCard className="p-5 sm:p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" /> Identidade do seu Assistente
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Personalize como o bot se apresenta e atende sua equipe via WhatsApp.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{isActive ? 'Assistente Ativo' : 'Assistente Pausado'}</span>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-5 h-5 accent-primary rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Nome do seu Bot (Exibido no WhatsApp)">
                  <TextInput
                    id="botName"
                    value={botName}
                    onChange={e => setBotName(e.target.value)}
                    placeholder="Ex: Assistente RepHub, Maria Representações"
                  />
                </Field>

                <Field label="Personalidade da IA">
                  <TextInput
                    id="botPersonality"
                    value={botPersonality}
                    onChange={e => setBotPersonality(e.target.value)}
                    placeholder="Ex: Ágil, profissional e focado em vendas"
                  />
                </Field>
              </div>

              {/* Sugestões rápidas de personalidade */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground font-medium">Sugestões rápidas:</span>
                {[
                  'Ágil, direto e focado em vendas',
                  'Consultivo, cordial e detalhista',
                  'Parceiro comercial prestativo e amigável',
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBotPersonality(preset)}
                    className="px-2.5 py-1 rounded-md bg-ink-3 border border-border text-card-foreground hover:border-primary transition-colors text-xs"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <Field label="Mensagem de Boas-Vindas Inicial">
                <TextInput
                  id="welcomeMessage"
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  placeholder="Ex: Olá! Sou o assistente virtual da sua empresa. Como posso te ajudar hoje?"
                />
              </Field>

              <div className="pt-3 flex justify-end">
                <PrimaryButton
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="h-10 px-6 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
                </PrimaryButton>
              </div>
            </GlassCard>
          </TabsContent>

          {/* ==========================================
              ABA 3: HISTÓRICO DE OPERAÇÕES DO ASSINANTE
              ========================================== */}
          <TabsContent value="history" className="mt-0">
            <GlassCard className="p-5 sm:p-6">
              <SectionTitle
                title="Histórico de Operações da Empresa"
                hint="Registro de auditoria de pedidos, clientes e ações geradas pelo bot para a sua conta."
              />
              <div className="mt-6">
                {operations.length === 0 ? (
                  <EmptyState title="Nenhuma operação registrada ainda" hint="Quando o bot executar pedidos ou cadastros pelo WhatsApp, o histórico aparecerá aqui." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="font-medium p-3">Data/Hora</th>
                          <th className="font-medium p-3">Telefone</th>
                          <th className="font-medium p-3">Ação / Intenção</th>
                          <th className="font-medium p-3">Entidade</th>
                          <th className="font-medium p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operations.map(op => (
                          <tr key={op.id} className="border-b border-border/50 hover:bg-ink-3/30 transition-colors">
                            <td className="p-3 text-card-foreground whitespace-nowrap text-xs">
                              {new Date(op.created_at).toLocaleString()}
                            </td>
                            <td className="p-3 text-card-foreground font-mono text-xs">{op.phone_number}</td>
                            <td className="p-3">
                              <span className="text-primary font-medium">{op.intent || op.tool || 'Operação'}</span>
                              {op.input && (
                                <div className="text-xs text-muted-foreground truncate max-w-[240px] mt-0.5">
                                  {JSON.stringify(op.input)}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-xs text-card-foreground capitalize">
                              {op.entity_type || '—'}
                            </td>
                            <td className="p-3">
                              <Chip tone={op.success ? 'brand' : 'rose'}>
                                {op.success ? 'Sucesso' : 'Erro'}
                              </Chip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
