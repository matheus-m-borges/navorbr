// @ts-nocheck — tipos legados do LawHub em migração
import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, Input, Button, Label } from "@/components/navor-rephub/ui";
import {
  Search,
  Plus,
  MoreHorizontal,
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  Key,
  Settings,
  Play,
  Copy,
  Check,
  Package,
  Scale,
  Scissors,
  PawPrint,
  HardHat,
  RotateCw,
  Sparkles,
  Info,
  Trash2,
  LayoutGrid,
  Bot,
  Cpu,
  Coins,
  BarChart2,
  Calendar,
  CheckSquare,
  Square,
  ShieldAlert,
  TrendingUp,
  Crown,
  Users2,
  Sliders,
  Zap,
  ShieldCheck,
  Shield,
  ExternalLink,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  createTenantAccount,
  checkEmailSubscriptions,
  updateSubscriptionStatus,
  registerPayment,
  deleteTenantAccount,
  updateTenantAccount,
   getSubscriber360,
  resetTenantPassword,
  sendRecoveryLink,
  syncTenantModules,
  toggleAccountModule,
  getAccountAiUsage,
  syncAccountAiUsage,
  seedAccountAiUsage,
  clearAccountAiUsage,
  getAdminAccountsList,
  getAdminAccountDetail,
  getAdminAccountOptions,
} from "@/api/admin-actions";
import { LawHubService } from "@/lib/lawhub/lawhub-service";

export const Route = createFileRoute("/_authenticated/(saas)/admin/contas")({
  component: AdminContas,
});

/**
 * Resolução confiável e universal do sistema (produto) da conta:
 * 1. Produto explícito da conta (slug ou nome)
 * 2. Produto ou nome do plano da assinatura (ex: contém lawhub/advocacia)
 * 3. Nome da conta do assinante (ex: "Arthur Advogados")
 */
export function getAccountProductSlug(account: any, sub?: any): "lawhub" | "enghub" | "rephub" | "barberhub" | "pethub" | string {
  if (!account) return "rephub";

  // 1. Slug explícito do produto vinculado na conta
  const directSlug = account.products?.slug?.toLowerCase();
  if (directSlug === "pethub" || directSlug?.includes("pet")) return "pethub";
  if (directSlug === "lawhub" || directSlug === "enghub" || directSlug === "rephub" || directSlug === "barberhub") {
    return directSlug;
  }
  if (directSlug?.includes("barber")) return "barberhub";

  // 2. Nome do produto na conta
  const directName = (account.products?.name || "").toLowerCase();
  if (directName.includes("pethub") || directName.includes("pet") || directName.includes("veterin")) return "pethub";
  if (directName.includes("lawhub") || directName.includes("advog") || directName.includes("jurid")) return "lawhub";
  if (directName.includes("enghub") || directName.includes("obra") || directName.includes("eng")) return "enghub";

  // 3. Plano da assinatura
  const activeSub = sub || (Array.isArray(account.subscriptions) ? account.subscriptions[0] : account.subscriptions);
  const planProdSlug = activeSub?.plans?.products?.slug?.toLowerCase();
  if (planProdSlug === "pethub") return "pethub";
  if (planProdSlug === "lawhub" || planProdSlug === "enghub" || planProdSlug === "rephub") {
    return planProdSlug;
  }

  const planName = (activeSub?.plans?.name || "").toLowerCase();
  if (
    planName.includes("lawhub") ||
    planName.includes("advog") ||
    planName.includes("jurid") ||
    planName.includes("escritório") ||
    planName.includes("contencioso")
  ) {
    return "lawhub";
  }
  if (
    planName.includes("enghub") ||
    planName.includes("obra") ||
    planName.includes("eng") ||
    planName.includes("canteiro") ||
    planName.includes("construtora")
  ) {
    return "enghub";
  }

  // 4. Nome da conta do assinante
  const accName = (account.name || "").toLowerCase();
  if (
    accName.includes("advog") ||
    accName.includes("jurídic") ||
    accName.includes("juridic") ||
    accName.includes("direito") ||
    accName.includes("oab")
  ) {
    return "lawhub";
  }
  if (
    accName.includes("engenhar") ||
    accName.includes("construt") ||
    accName.includes("obras") ||
    accName.includes("reforma")
  ) {
    return "enghub";
  }

  return "rephub";
}

/**
 * Calcula o tempo de contrato ativo de forma legível
 */
export function getContractDuration(createdAt: string): string {
  if (!createdAt) return "Recente";
  const start = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.max(1, Math.floor(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
  }
  const months = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;
  if (remainingDays === 0) {
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  }
  return `${months} ${months === 1 ? "mês" : "meses"} e ${remainingDays}d`;
}

function AdminContas() {
  const [search, setSearch] = useState("");
  const [filterSystem, setFilterSystem] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ["admin_accounts_list"],
    queryFn: () => getAdminAccountsList(),
  });

  const { data: accountOptions } = useQuery({
    queryKey: ["admin_account_options"],
    queryFn: () => getAdminAccountOptions(),
  });
  const plans = accountOptions?.plans || [];
  const products = accountOptions?.products || [];

  const systemCounts = useMemo(() => {
    const total = accounts?.length || 0;
    let rephub = 0;
    let enghub = 0;
    let lawhub = 0;
    let barberhub = 0;
    let pethub = 0;

    accounts?.forEach((a: any) => {
      const slug = getAccountProductSlug(a);
      if (slug === "lawhub") lawhub++;
      else if (slug === "enghub") enghub++;
      else if (slug === "barberhub") barberhub++;
      else if (slug === "pethub") pethub++;
      else rephub++;
    });

    return { total, rephub, enghub, lawhub, barberhub, pethub };
  }, [accounts]);

  const filtered =
    accounts?.filter((a: any) => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (!filterSystem) return true;
      const slug = getAccountProductSlug(a);
      return slug === filterSystem;
    }) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Contas de Assinantes SaaS
          </h2>
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            Gerencie assinaturas, acessos e provisionamento dos seus clientes em toda a plataforma NAVOR.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm font-semibold">
          <Plus className="mr-2 size-4" />
          Nova Conta
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr] flex-1 min-h-0">
        {/* COLUNA ESQUERDA: LISTA */}
        <div className={`flex flex-col gap-4 overflow-hidden ${selectedAccountId ? "hidden lg:flex" : "flex"}`}>
          <div className="flex flex-col p-0 h-full overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-card/40 backdrop-blur-md">
            <div className="p-4 border-b border-slate-200 dark:border-white/5 shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <input
                  type="search"
                  placeholder="Buscar assinante por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              {/* Seletor de Sistema - Ajustado para alta legibilidade e sem texto amontoado */}
              <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100/90 rounded-xl dark:bg-white/5 text-xs font-medium">
                <button
                  onClick={() => setFilterSystem(null)}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                    filterSystem === null
                      ? "bg-white text-slate-900 shadow-xs dark:bg-card dark:text-white font-bold ring-1 ring-slate-200 dark:ring-white/10"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50"
                  }`}
                >
                  <span>Todos</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                    {systemCounts.total}
                  </span>
                </button>

                <button
                  onClick={() => setFilterSystem("rephub")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                    filterSystem === "rephub"
                      ? "bg-white text-cyan-700 shadow-xs dark:bg-card dark:text-cyan-400 font-bold ring-1 ring-cyan-200 dark:ring-cyan-900/40"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50"
                  }`}
                  title="Navor RepHub"
                >
                  <Package className="size-3.5 shrink-0 text-cyan-600" />
                  <span>RepHub</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                    {systemCounts.rephub}
                  </span>
                </button>

                <button
                  onClick={() => setFilterSystem("enghub")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                    filterSystem === "enghub"
                      ? "bg-white text-amber-700 shadow-xs dark:bg-card dark:text-amber-400 font-bold ring-1 ring-amber-200 dark:ring-amber-900/40"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50"
                  }`}
                  title="Navor EngHub"
                >
                  <HardHat className="size-3.5 shrink-0 text-amber-600" />
                  <span>EngHub</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    {systemCounts.enghub}
                  </span>
                </button>

                <button
                  onClick={() => setFilterSystem("lawhub")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                    filterSystem === "lawhub"
                      ? "bg-white text-blue-700 shadow-xs dark:bg-card dark:text-blue-400 font-bold ring-1 ring-blue-200 dark:ring-blue-900/40"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50"
                  }`}
                  title="Navor LawHub"
                >
                  <Scale className="size-3.5 shrink-0 text-blue-600" />
                  <span>LawHub</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                    {systemCounts.lawhub}
                  </span>
                </button>

                <button
                  onClick={() => setFilterSystem("barberhub")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                    filterSystem === "barberhub"
                      ? "bg-white text-orange-700 shadow-xs dark:bg-card dark:text-orange-400 font-bold ring-1 ring-orange-200 dark:ring-orange-900/40"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50"
                  }`}
                  title="Navor BarberHub"
                >
                  <Scissors className="size-3.5 shrink-0 text-orange-500" />
                  <span>BarberHub</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                    {systemCounts.barberhub}
                  </span>
                </button>

                <button
                  onClick={() => setFilterSystem("pethub")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                    filterSystem === "pethub"
                      ? "bg-white text-teal-700 shadow-xs dark:bg-card dark:text-teal-400 font-bold ring-1 ring-teal-200 dark:ring-teal-900/40"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50"
                  }`}
                  title="Navor PetHub"
                >
                  <PawPrint className="size-3.5 shrink-0 text-teal-600" />
                  <span>PetHub</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                    {systemCounts.pethub}
                  </span>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1.5 scrollbar-thin">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-slate-500">Carregando assinantes...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">Nenhum assinante encontrado neste filtro.</div>
              ) : (
                filtered.map((conta: any) => {
                  const sub = Array.isArray(conta.subscriptions) ? conta.subscriptions[0] : conta.subscriptions;
                  const isActive = selectedAccountId === conta.id;
                  const prodSlug = getAccountProductSlug(conta, sub);
                  const prodName = prodSlug === "pethub" ? "PetHub" : prodSlug === "lawhub" ? "Navor LawHub" : prodSlug === "enghub" ? "Navor EngHub" : prodSlug === "barberhub" ? "Navor BarberHub" : "Navor RepHub";

                  const otherAccountsWithSameEmail = (accounts || []).filter(
                    (a: any) =>
                      a.id !== conta.id &&
                      a.contact_email &&
                      conta.contact_email &&
                      a.contact_email.trim().toLowerCase() === conta.contact_email.trim().toLowerCase()
                  );

                  return (
                    <button
                      key={conta.id}
                      onClick={() => setSelectedAccountId(conta.id)}
                      className={`w-full text-left p-3 rounded-xl transition border ${
                        isActive
                          ? "bg-blue-50/90 border-blue-300 dark:bg-white/10 dark:border-white/20 shadow-xs ring-1 ring-blue-500/20"
                          : "bg-transparent border-transparent hover:bg-slate-100/80 dark:hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <p className={`font-bold truncate text-xs ${isActive ? "text-blue-950 dark:text-white" : "text-slate-800 dark:text-white/90"}`}>
                            {conta.name}
                          </p>
                          {conta.account_type === "demo" && (
                            <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                              DEMO
                            </span>
                          )}
                          {!conta.is_billable && (
                            <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-extrabold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                              NÃO FATURÁVEL
                            </span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            sub?.status === "active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-green-500/10 dark:text-green-500"
                              : sub?.status === "trial"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-500"
                              : sub?.status === "suspended"
                              ? "bg-rose-100 text-rose-800 dark:bg-red-500/10 dark:text-red-500"
                              : "bg-amber-100 text-amber-800 dark:bg-gold/10 dark:text-gold"
                          }`}
                        >
                          {sub?.status || "S/ PLANO"}
                        </span>
                      </div>

                      {conta.contact_email && (
                        <p className="text-[10px] text-slate-400 font-mono truncate mb-1.5">
                          {conta.contact_email}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-muted-foreground truncate flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[9px] px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                            prodSlug === "lawhub"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40"
                              : prodSlug === "barberhub"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40"
                              : prodSlug === "enghub"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                              : "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/40"
                          }`}
                        >
                          {prodSlug === "pethub" && <PawPrint className="size-2.5" />}
                          {prodSlug === "lawhub" && <Scale className="size-2.5" />}
                          {prodSlug === "barberhub" && <Scissors className="size-2.5" />}
                          {prodSlug === "enghub" && <HardHat className="size-2.5" />}
                          {prodSlug === "rephub" && <Package className="size-2.5" />}
                          <span>{prodName}</span>
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {sub?.plans?.name || "Sem plano"}
                        </span>

                        {otherAccountsWithSameEmail.length > 0 && (
                          <span className="inline-flex items-center text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 font-bold ml-auto">
                            Multi-Assinatura ({otherAccountsWithSameEmail.length + 1})
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHES */}
        <div className={`overflow-y-auto scrollbar-thin rounded-2xl ${!selectedAccountId ? "hidden lg:block" : "block"}`}>
          {!selectedAccountId ? (
            <div className="h-full flex items-center justify-center text-slate-400 dark:text-muted-foreground rounded-2xl border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-card/40 p-8 text-sm">
              Selecione uma conta à esquerda para ver os detalhes
            </div>
          ) : (
            <AdminContaDetail
              accountId={selectedAccountId}
              onBack={() => setSelectedAccountId(null)}
              products={products || []}
              plans={plans || []}
              onDeleted={() => {
                setSelectedAccountId(null);
                refetch();
              }}
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <CreateAccountModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }}
          plans={plans || []}
          products={products || []}
        />
      )}
    </div>
  );
}

function AdminContaDetail({
  accountId,
  onBack,
  products,
  plans,
  onDeleted,
}: {
  accountId: string;
  onBack: () => void;
  products: any[];
  plans: any[];
  onDeleted?: () => void;
}) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [syncingModules, setSyncingModules] = useState(false);

  // 1. Query de dados da conta e módulos
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin_account_detail_v3", accountId],
    queryFn: () => getAdminAccountDetail({ data: { accountId } }),
    enabled: !!accountId,
  });

  // Extração segura de dados

  const account = data?.account;
  const sub = data?.sub;
  const charges = data?.charges || [];
  const accountModules = data?.accountModules || [];
  const allModules = data?.allModules || [];

  // Resolução universal de sistema e tempo de contrato
  const prodSlug = useMemo(() => {
    return getAccountProductSlug(account, sub);
  }, [account, sub]);

  const prodName = useMemo(() => {
    if (prodSlug === "lawhub") return "Navor LawHub";
    if (prodSlug === "enghub") return "Navor EngHub";
    if (prodSlug === "barberhub") return "Navor BarberHub";
    return "Navor RepHub";
  }, [prodSlug]);

  const contractDurationText = useMemo(() => {
    return getContractDuration(account?.created_at);
  }, [account?.created_at]);

  const queryClient = useQueryClient();
  const [isRefreshingAi, setIsRefreshingAi] = useState(false);

  // 2. Query de auditoria e consumo de IA isolada por conta e sistema
  const { data: aiUsageData, isLoading: isLoadingAi, refetch: refetchAi } = useQuery({
    queryKey: ["admin_ai_usage", accountId, prodSlug],
    queryFn: () => getAccountAiUsage({ data: { accountId, days: 30, system: prodSlug } }),
    enabled: !!accountId,
  });

  async function handleRefreshAi() {
    setIsRefreshingAi(true);
    try {
      await syncAccountAiUsage({ data: { accountId, system: prodSlug } });
      await queryClient.invalidateQueries({ queryKey: ["admin_ai_usage"] });
      await refetchAi();
      toast.success(`Consumo de IA do ${prodName} sincronizado com sucesso!`);
    } catch (e: any) {
      toast.error(`Erro ao sincronizar: ${e.message}`);
    } finally {
      setIsRefreshingAi(false);
    }
  }

  const [isSeedingAi, setIsSeedingAi] = useState(false);

  async function handleSeedAi() {
    try {
      setIsSeedingAi(true);
      await seedAccountAiUsage({ data: { accountId, system: prodSlug } });
      toast.success(`Consumo de demonstração gerado exclusivamente para ${prodName}!`);
      await refetchAi();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSeedingAi(false);
    }
  }

  async function handleClearAi() {
    if (!window.confirm(`Zerar o histórico de IA para esta conta no ${prodName}?`)) return;
    try {
      setIsSeedingAi(true);
      await clearAccountAiUsage({ data: { accountId } });
      toast.success("Histórico de consumo de IA zerado com sucesso!");
      await refetchAi();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSeedingAi(false);
    }
  }

  // Lista consolidada de módulos do sistema/plano
  const activeModulesList = useMemo(() => {
    if (!account) return [];
    const fromAccount = (accountModules || [])
      .map((am: any) => allModules?.find((m: any) => m.id === am.module_id))
      .filter(Boolean);

    const fromPlan = (sub?.plans?.plan_modules || [])
      .map((pm: any) => pm.system_modules)
      .filter(Boolean);

    const map = new Map<string, any>();
    [...fromAccount, ...fromPlan].forEach((m: any) => {
      if (m?.id && !map.has(m.id)) map.set(m.id, m);
    });
    return Array.from(map.values());
  }, [accountModules, allModules, sub, account]);

  // Handlers
  async function handleToggleSuspend() {
    if (!sub) return;
    const newStatus = sub.status === "suspended" ? "active" : "suspended";
    try {
      setLoadingAction(true);
      await updateSubscriptionStatus({ data: { accountId, status: newStatus } });
      toast.success(`Conta ${newStatus === "active" ? "reativada" : "suspensa"}.`);
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleRegisterPayment() {
    if (!sub) return;
    const month = window.prompt("Mês de referência (Ex: 2026-09):", "2026-09");
    if (!month) return;

    try {
      setLoadingAction(true);
      await registerPayment({
        data: {
          subscriptionId: sub.id,
          amount: Number(sub.amount),
          referenceMonth: month,
          notes: "Pagamento manual registrado pelo administrador",
        },
      });
      toast.success("Pagamento registrado com sucesso.");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleChangePlanDirect(newPlanId: string) {
    if (!sub || !newPlanId) return;
    const targetPlan = plans.find((p: any) => p.id === newPlanId);
    if (!targetPlan) return;
    try {
      setLoadingAction(true);
      await updateTenantAccount({
        data: {
          accountId: account.id,
          planId: newPlanId,
          amount: Number(targetPlan.amount || sub.amount),
          syncModules: true,
        },
      });
      // Sincroniza também no serviço LawHub se for conta jurídica
      LawHubService.upgradeSubscriptionPlan(
        targetPlan.name.toLowerCase().includes("ágil") || targetPlan.name.toLowerCase().includes("agil")
          ? "agil"
          : targetPlan.name.toLowerCase().includes("enterprise")
          ? "enterprise"
          : "pro"
      );
      toast.success(`Plano alterado para "${targetPlan.name}" com sucesso! Módulos e quotas recalculados.`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao trocar plano");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleChangeStatusDirect(newStatus: string) {
    if (!sub) return;
    try {
      setLoadingAction(true);
      await updateSubscriptionStatus({ data: { accountId, status: newStatus } });
      const currentSub = LawHubService.getSubscriptionInfo();
      LawHubService.saveSubscriptionInfo({ ...currentSub, status: newStatus as any });
      toast.success(`Status da assinatura alterado para "${newStatus.toUpperCase()}".`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar status");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleAddTurboDirect(type: "users" | "oabs" | "ai") {
    const qtyStr = window.prompt(
      type === "users"
        ? "Quantos assentos de usuários adicionais liberar para este assinante?"
        : type === "oabs"
        ? "Quantas vagas extras de OAB liberar para monitoramento no DJEN?"
        : "Quantos créditos de IA adicionais adicionar ao saldo deste mês?",
      type === "ai" ? "500" : "1"
    );
    if (!qtyStr || isNaN(Number(qtyStr))) return;
    const qty = Number(qtyStr);
    if (qty <= 0) return;

    LawHubService.addExtraTurbos({
      extra_users: type === "users" ? qty : 0,
      extra_oabs: type === "oabs" ? qty : 0,
      extra_ai_credits: type === "ai" ? qty : 0,
    });
    toast.success(`Turbo concedido com sucesso: +${qty} ${type === "users" ? "usuários" : type === "oabs" ? "OABs" : "créditos IA"}!`);
    refetch();
  }

  async function handleResetPassword() {
    if (window.confirm("Gerar nova senha provisória? Isso revogará o acesso com a senha antiga.")) {
      try {
        setLoadingAction(true);
        const res = await resetTenantPassword({ data: { accountId } });
        if (res?.password) {
          toast.success(`Nova senha gerada: ${res.password}`);
        } else {
          toast.success("Senha redefinida com sucesso.");
        }
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoadingAction(false);
      }
    }
  }

  async function handleSyncModules() {
    try {
      setSyncingModules(true);
      // Encontrar o produto correspondente
      const targetProduct = products.find((p) => p.slug === prodSlug) || products[0];
      const planId = sub?.plan_id || sub?.plans?.id;

      await syncTenantModules({
        data: {
          accountId,
          productId: targetProduct.id,
          planId: planId || undefined,
        },
      });
      toast.success(`Módulos do sistema ${prodName} sincronizados com sucesso!`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar módulos");
    } finally {
      setSyncingModules(false);
    }
  }

  async function handleToggleModule(moduleId: string, currentlyActive: boolean) {
    try {
      await toggleAccountModule({
        data: {
          accountId,
          moduleId,
          active: !currentlyActive,
        },
      });
      toast.success(!currentlyActive ? "Módulo ativado para este assinante." : "Módulo desativado.");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao alternar módulo");
    }
  }

  async function handleDeleteAccount() {
    try {
      setLoadingAction(true);
      await deleteTenantAccount({ data: { accountId: account.id } });
      toast.success("Assinante excluído com sucesso!");
      setIsDeleteConfirmOpen(false);
      if (onDeleted) onDeleted();
      else onBack();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir conta");
    } finally {
      setLoadingAction(false);
    }
  }

  const aiSummary = aiUsageData?.summary || {
    totalCalls: 0,
    totalCredits: 0,
    totalTokens: 0,
    totalCostBrl: 0,
    totalCostUsd: 0,
  };
  const aiLogs = aiUsageData?.logs || [];

  // Quotas e limites do plano no contexto do sistema
  const currentPlanName = (sub?.plans?.name || "").toLowerCase();
  const isAgil = currentPlanName.includes("ágil") || currentPlanName.includes("agil") || Number(sub?.amount || 0) < 180;
  const isEnterprise = currentPlanName.includes("enterprise") || Number(sub?.amount || 0) > 350;

  const tenantQuotas = useMemo(() => {
    if (prodSlug !== "lawhub") {
      return {
        usersLimit: 5,
        usersUsed: 1,
        oabLimit: 1,
        oabUsed: 1,
        procLimit: 500,
        procUsed: 40,
        aiLimit: 500,
        aiUsed: Math.round(Number(aiSummary?.totalCredits || 0)),
        storageGbLimit: 20,
        storageGbUsed: 2.1,
      };
    }
    const lawSub = LawHubService.getSubscriptionInfo();
    const lawQuotas = LawHubService.getTenantUsageQuotas();
    const extraUsers = lawSub.extra_users || 0;
    const extraOabs = lawSub.extra_oabs || 0;
    const extraAi = lawSub.extra_ai_credits || 0;

    const baseUsers = isAgil ? 1 : isEnterprise ? 25 : 5;
    const baseOabs = isAgil ? 1 : isEnterprise ? 10 : 3;
    const baseProcs = isAgil ? 200 : isEnterprise ? 10000 : 1000;
    const baseAi = isAgil ? 100 : isEnterprise ? 2500 : 500;

    return {
      usersLimit: baseUsers + extraUsers,
      usersUsed: lawQuotas.users_count,
      oabLimit: baseOabs + extraOabs,
      oabUsed: lawQuotas.monitored_oabs_count,
      procLimit: baseProcs,
      procUsed: lawQuotas.processes_count,
      aiLimit: baseAi + extraAi,
      aiUsed: lawQuotas.ai_credits_used,
      storageGbLimit: isAgil ? 10 : isEnterprise ? 200 : 50,
      storageGbUsed: lawQuotas.storage_gb_used,
    };
  }, [prodSlug, isAgil, isEnterprise, aiSummary]);

  // Retornos condicionais colocados RIGOROSAMENTE DEPOIS de todos os hooks (evita Minified React Error #310 / #300)
  if (isLoading) {
    return (
      <div className="h-full p-6 text-slate-600 dark:text-white flex items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-card/40">
        <div className="flex items-center gap-2">
          <RotateCw className="size-4 animate-spin text-blue-600" />
          <span>Carregando detalhes do assinante...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full p-6 text-slate-700 dark:text-card-foreground flex flex-col items-center justify-center gap-3 text-center rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-card/40">
        <p className="text-sm font-semibold">Não foi possível carregar este assinante.</p>
        <p className="text-xs text-rose-600">{(error as Error).message}</p>
        <Button variant="ghost" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="h-full p-6 text-slate-600 dark:text-white flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-card/40">
        <p className="text-sm font-semibold">Conta não encontrada ou carregando.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RotateCw className="mr-1.5 size-3.5" /> Recarregar Detalhes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white lg:hidden"
        >
          <ArrowLeft className="size-4" /> Voltar à lista
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="bg-blue-600 text-white hover:bg-blue-700 shadow-xs font-semibold"
          >
            <Settings className="mr-1.5 size-3.5" /> Editar Dados & Sistema
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <Trash2 className="mr-1.5 size-3.5" /> Excluir Assinante
          </Button>
        </div>
      </div>

      {/* CARD PRINCIPAL: DADOS DO ASSINANTE E CONTRATO */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-card/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                  prodSlug === "lawhub"
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40"
                    : prodSlug === "barberhub"
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40"
                    : prodSlug === "enghub"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                    : "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/40"
                }`}
              >
                {prodSlug === "pethub" && <PawPrint className="size-3.5" />}
                {prodSlug === "lawhub" && <Scale className="size-3.5" />}
                {prodSlug === "barberhub" && <Scissors className="size-3.5" />}
                {prodSlug === "enghub" && <HardHat className="size-3.5" />}
                {prodSlug === "rephub" && <Package className="size-3.5" />}
                <span>{prodName}</span>
              </span>
              {account.account_type === "demo" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                  DEMO
                </span>
              )}
              {account.account_type === "demo" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                  INTERNA
                </span>
              )}
              {!account.is_billable && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  NÃO FATURÁVEL
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{account.name}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-muted-foreground">
              <span>Cadastrado em {new Date(account.created_at).toLocaleDateString("pt-BR")}</span>
              <span>•</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                {contractDurationText}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                sub?.status === "active"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-green-500/10 dark:text-green-500"
                  : sub?.status === "suspended"
                  ? "bg-rose-100 text-rose-800 dark:bg-red-500/10 dark:text-red-500"
                  : "bg-amber-100 text-amber-800 dark:bg-gold/10 dark:text-gold"
              }`}
            >
              {sub?.status === "active" ? "Assinatura Ativa" : sub?.status === "suspended" ? "Conta Suspensa" : sub?.status || "Pendente"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 border-t border-slate-100 pt-4 dark:border-white/5 text-xs">
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold">Responsável</span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{account.responsible_name || "—"}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold">E-mail de Acesso</span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{account.contact_email || "—"}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold">Telefone / WhatsApp</span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{account.contact_phone || "—"}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold">CPF / CNPJ</span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{account.document || "—"}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold">Plano Contratado</span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{sub?.plans?.name || "Sem plano vinculado"}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold">Mensalidade</span>
            <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              R$ {Number(sub?.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold">Dia de Vencimento</span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{sub?.due_date ? `Dia ${sub.due_date}` : "Não definido"}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold">Conexões WhatsApp</span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
              {account.whatsapp_number_limit ? `${account.whatsapp_number_limit} números` : "1 número (Padrão)"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-white/5">
          <Button
            size="sm"
            onClick={handleRegisterPayment}
            disabled={loadingAction}
            className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
          >
            <CreditCard className="mr-1.5 size-3.5" /> Registrar Pagamento Manual
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleResetPassword}
            disabled={loadingAction}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            <Key className="mr-1.5 size-3.5" /> Gerar Nova Senha Provisória
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={handleToggleSuspend}
            disabled={loadingAction}
            className={sub?.status === "suspended" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-rose-600 text-white hover:bg-rose-700"}
          >
            {sub?.status === "suspended" ? <Play className="mr-1.5 size-3.5" /> : <Ban className="mr-1.5 size-3.5" />}
            {sub?.status === "suspended" ? "Reativar Assinante" : "Suspender Acesso"}
          </Button>
        </div>
      </div>

      
        {/* LINKS DIRETOS PARA PETHUB (SEM LINKS FAKE) */}
        {prodSlug === "pethub" && (
          <div className="mt-4 p-4 rounded-xl border border-teal-200 bg-teal-50/60 dark:border-teal-900/60 dark:bg-teal-950/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold">
                <PawPrint className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-teal-950 dark:text-teal-200">Acesso Direto aos Ambientes PetHub</p>
                <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80">Abra a retaguarda, o PDV de loja ou a vitrine pública deste cliente</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="https://app.pethub.navorbr.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs"
              >
                <span>PetHub Gestão</span>
                <ExternalLink className="size-3" />
              </a>
              <a
                href="https://loja.pethub.navorbr.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 text-xs font-bold hover:bg-teal-50 transition"
              >
                <span>PDV & Recepção</span>
                <ExternalLink className="size-3" />
              </a>
              <a
                href="https://pethub.navorbr.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition"
              >
                <span>Portal da Rede</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        )}

      {/* CARD DE RETAGUARDA: GESTÃO DE PLANO, STATUS, QUOTAS E TURBOS */}
      <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm dark:border-indigo-900/40 dark:bg-card/40">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Crown className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Gestão do Plano, Quotas & Capacidade (SaaS Backoffice)
                </h4>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Retaguarda SaaS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-muted-foreground">
                Monitore o consumo das cotas em tempo real, efetue upgrades de plano ou libere vagas extras (turbos).
              </p>
            </div>
          </div>

          {/* Seletor rápido de Status da Assinatura */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status do Contrato:</span>
            <select
              value={sub?.status || "active"}
              disabled={loadingAction}
              onChange={(e) => handleChangeStatusDirect(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="active">🟢 Ativo (Acesso Total)</option>
              <option value="trial">🔵 Período de Testes (Trial)</option>
              <option value="past_due">🟡 Inadimplente (Aviso de Pagamento)</option>
              <option value="suspended">🔴 Suspenso (Bloqueado)</option>
              <option value="canceled">⚪ Cancelado</option>
            </select>
          </div>
        </div>

        {/* 1. Troca de Plano e Mensalidade */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Trocar Plano Comercial do Assinante
            </label>
            <div className="flex items-center gap-2">
              <select
                value={sub?.plan_id || sub?.plans?.id || ""}
                disabled={loadingAction}
                onChange={(e) => handleChangePlanDirect(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Selecione o plano desejado...</option>
                {plans
                  .filter((p: any) => {
                    const slug = p.products?.slug?.toLowerCase();
                    return slug ? slug === prodSlug : true;
                  })
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R$ {Number(p.amount).toFixed(2)}/mês
                    </option>
                  ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Ao trocar de plano, as cotas de usuários, OABs e módulos são recalculados automaticamente na retaguarda.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Mensalidade Vigente
            </label>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                R$ {Number(sub?.amount || 0).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Vence dia {sub?.due_date || "10"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Medidores de Quota e Capacidade em Tempo Real */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Sliders className="size-3.5 text-indigo-600" />
              <span>Cotas & Limites Operacionais ({prodName})</span>
            </h5>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddTurboDirect("oabs")}
                className="h-7 text-[11px] border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
              >
                <Zap className="size-3 mr-1 text-amber-500" /> + Injetar OAB Extra
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddTurboDirect("users")}
                className="h-7 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
              >
                <Plus className="size-3 mr-1" /> + Vagas Usuários
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddTurboDirect("ai")}
                className="h-7 text-[11px] border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
              >
                <Sparkles className="size-3 mr-1 text-purple-500" /> + Créditos IA
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Usuários */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/20">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users2 className="size-3.5 text-blue-600" /> Usuários da Equipe
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                  {tenantQuotas.usersUsed} / {tenantQuotas.usersLimit}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (tenantQuotas.usersUsed / tenantQuotas.usersLimit) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {Math.max(0, tenantQuotas.usersLimit - tenantQuotas.usersUsed)} assentos disponíveis
              </p>
            </div>

            {/* OABs no DJEN */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/20">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Scale className="size-3.5 text-indigo-600" /> OABs / DJEN
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                  {tenantQuotas.oabUsed} / {tenantQuotas.oabLimit}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (tenantQuotas.oabUsed / tenantQuotas.oabLimit) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {Math.max(0, tenantQuotas.oabLimit - tenantQuotas.oabUsed)} vagas de monitoramento livres
              </p>
            </div>

            {/* Processos Ativos */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/20">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BarChart2 className="size-3.5 text-emerald-600" /> Processos no Acervo
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                  {tenantQuotas.procUsed} / {tenantQuotas.procLimit}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (tenantQuotas.procUsed / tenantQuotas.procLimit) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {Math.round((tenantQuotas.procUsed / tenantQuotas.procLimit) * 100)}% da capacidade atingida
              </p>
            </div>

            {/* Créditos IA */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/20">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-500" /> Créditos de IA (Mês)
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                  {tenantQuotas.aiUsed} / {tenantQuotas.aiLimit}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (tenantQuotas.aiUsed / tenantQuotas.aiLimit) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {Math.max(0, tenantQuotas.aiLimit - tenantQuotas.aiUsed)} créditos restantes neste ciclo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NOVO CARD DE DESTAQUE: CONTROLE DE GASTOS E CRÉDITOS DE IA */}
      <div className="rounded-2xl border border-blue-200 bg-linear-to-b from-blue-50/50 to-white p-6 shadow-sm dark:border-blue-900/40 dark:from-blue-950/20 dark:to-card/40">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Bot className="size-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>Controle de Gastos & Créditos de IA</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  prodSlug === "lawhub"
                    ? "bg-blue-600 text-white"
                    : prodSlug === "enghub"
                    ? "bg-amber-600 text-white"
                    : "bg-cyan-600 text-white"
                }`}>
                  Exclusivo {prodName}
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-muted-foreground">
                Auditoria de consumo de IA restrita a este contrato do {prodName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAi}
              disabled={isLoadingAi || isRefreshingAi}
              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 text-xs font-semibold"
            >
              <RotateCw className={`mr-1.5 size-3.5 ${isLoadingAi || isRefreshingAi ? "animate-spin" : ""}`} /> Atualizar Uso
            </Button>

            {aiLogs.length === 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedAi}
                disabled={isSeedingAi}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 text-xs"
              >
                <Sparkles className="mr-1.5 size-3 text-amber-500" />
                {isSeedingAi ? "Gerando..." : `Simular Uso (${prodName})`}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAi}
                disabled={isSeedingAi}
                className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 text-xs"
              >
                <Trash2 className="mr-1.5 size-3" />
                Zerar Gastos
              </Button>
            )}
          </div>
        </div>

        {/* 4 CARDS DE KPI DE IA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 rounded-xl border border-blue-100 bg-white dark:border-blue-900/30 dark:bg-slate-900/60 shadow-xs">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
              <Coins className="size-3" /> Créditos de IA
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {aiSummary.totalCredits} <span className="text-xs font-normal text-slate-400">créditos</span>
            </p>
            <span className="text-[10px] text-slate-500">Últimos {"periodDays" in aiSummary ? aiSummary.periodDays : 30} dias no {prodSlug.toUpperCase()}</span>
          </div>

          <div className="p-3.5 rounded-xl border border-blue-100 bg-white dark:border-blue-900/30 dark:bg-slate-900/60 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
              <CreditCard className="size-3" /> Custo Estimado
            </span>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              R$ {aiSummary.totalCostBrl.toFixed(2)}
            </p>
            <span className="text-[10px] text-slate-500 font-mono">(${aiSummary.totalCostUsd.toFixed(4)} USD)</span>
          </div>

          <div className="p-3.5 rounded-xl border border-blue-100 bg-white dark:border-blue-900/30 dark:bg-slate-900/60 shadow-xs">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
              <Cpu className="size-3" /> Chamadas de IA
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {aiSummary.totalCalls} <span className="text-xs font-normal text-slate-400">requisições</span>
            </p>
            <span className="text-[10px] text-slate-500 truncate block">
              {prodSlug === "rephub"
                ? "Automações CRM e WhatsApp"
                : prodSlug === "lawhub"
                ? "Peças, DJEN e Cálculos"
                : "Orçamentos e Obras"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-blue-100 bg-white dark:border-blue-900/30 dark:bg-slate-900/60 shadow-xs">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
              <BarChart2 className="size-3" /> Volume de Tokens
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {aiSummary.totalTokens.toLocaleString("pt-BR")}
            </p>
            <span className="text-[10px] text-slate-500">Entrada + Saída processadas</span>
          </div>
        </div>

        {/* TABELA DE HISTÓRICO DE REQUISIÇÕES DE IA */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/80 overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-white">
              Histórico Detalhado de Uso no {prodName}
            </span>
            <span className="text-[10px] text-slate-400">
              {aiLogs.length} registros neste contrato
            </span>
          </div>

          {aiLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Nenhum gasto de IA registrado nesta assinatura do {prodName}.
              </p>
              <p className="text-[11px] text-slate-400">
                O histórico e os custos de inteligência artificial de cada sistema ({prodName} vs outros planos) são registrados de forma 100% isolada e independente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Data / Hora</th>
                    <th className="px-4 py-2.5">Recurso & Finalidade</th>
                    <th className="px-4 py-2.5">Modelo IA</th>
                    <th className="px-4 py-2.5 text-right">Tokens</th>
                    <th className="px-4 py-2.5 text-right">Créditos de IA</th>
                    <th className="px-4 py-2.5">Usuário / Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {aiLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {new Date(log.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-slate-800 dark:text-white block">
                          {log.feature_label || log.feature}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono capitalize">
                          {log.feature?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-mono text-[10px]">
                          <Sparkles className="size-2.5" />
                          {log.model}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                        {Number(log.total_tokens).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap font-bold text-blue-600 dark:text-blue-400">
                        {Number(log.lovable_credits).toFixed(2)} pts
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                        {log.user_name || "Advogado Responsável"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MÓDULOS ATIVOS DO ASSINANTE COM SINCRONIZAÇÃO */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card/40">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LayoutGrid className="size-4 text-blue-600" />
              <span>Módulos e Recursos Ativos no Sistema</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
              {activeModulesList.length} módulos liberados para o assinante no {prodName}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncModules}
            disabled={syncingModules}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs"
          >
            <RotateCw className={`mr-1.5 size-3.5 ${syncingModules ? "animate-spin" : ""}`} />
            Sincronizar Módulos do Sistema
          </Button>
        </div>

        {activeModulesList.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
            <p>Nenhum módulo específico listado para este assinante.</p>
            <Button
              size="sm"
              onClick={handleSyncModules}
              disabled={syncingModules}
              className="mt-3 bg-blue-600 text-white hover:bg-blue-700"
            >
              Liberar Módulos Padrão do {prodName}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            {activeModulesList.map((mod: any) => (
              <div
                key={mod.id}
                className="flex items-start justify-between gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40 text-xs hover:border-slate-300 transition"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <Check className="size-2.5 stroke-[3]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{mod.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{mod.key}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleModule(mod.id, true)}
                  title="Desativar módulo"
                  className="text-slate-400 hover:text-rose-600 transition"
                >
                  <CheckSquare className="size-4 text-emerald-600" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTÓRICO DE COBRANÇAS / MENSALIDADES */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card/40">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Histórico de Cobranças / Pagamentos</h4>
        {charges.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum pagamento registrado nesta assinatura ainda.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
            {charges.map((ch: any) => (
              <div key={ch.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Ref: {ch.reference_month || "Mensalidade"}</p>
                  <p className="text-[10px] text-slate-400">{new Date(ch.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 dark:text-white">
                    R$ {Number(ch.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">{ch.status || "Pago"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CADEIRA 4.6 — ENTITLEMENTS 360° */}
      <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900/40 dark:bg-card/40">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white shadow-xs">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Gestão de Assinantes 360°
              </h4>
              <p className="text-xs text-slate-500 dark:text-muted-foreground">Acesse as telas administrativas para gerenciar entitlements, addons, blocos e auditoria.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" size="sm" className="justify-start h-auto py-3" onClick={() => window.location.href = "/_authenticated/(saas)/admin/entitlements"}>
            <Shield className="size-4 mr-2 text-violet-600" /> Entitlements
          </Button>
          <Button variant="outline" size="sm" className="justify-start h-auto py-3" onClick={() => window.location.href = "/_authenticated/(saas)/admin/capabilities"}>
            <Sparkles className="size-4 mr-2 text-amber-600" /> Capabilities
          </Button>
          <Button variant="outline" size="sm" className="justify-start h-auto py-3" onClick={() => window.location.href = "/_authenticated/(saas)/admin/addons"}>
            <Package className="size-4 mr-2 text-emerald-600" /> Add-ons
          </Button>
          <Button variant="outline" size="sm" className="justify-start h-auto py-3" onClick={() => window.location.href = "/_authenticated/(saas)/admin/blocos"}>
            <LayoutGrid className="size-4 mr-2 text-blue-600" /> Blocos
          </Button>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO COMPLETA DE DADOS, SISTEMA E PLANO */}
      {isEditModalOpen && (
        <EditAccountModal
          account={account}
          products={products}
          plans={plans || []}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            refetch();
          }}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl border border-rose-200 bg-white shadow-2xl dark:border-rose-900/50 dark:bg-slate-900">
            <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-2">
              <Trash2 className="size-5" />
              <span>Excluir Assinante Definitivamente</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir a conta de <strong>{account.name}</strong>?
              Esta ação removerá a assinatura, vínculos e acessos deste cliente.
            </p>
            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={loadingAction}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 text-white hover:bg-rose-700 font-semibold"
                onClick={handleDeleteAccount}
                disabled={loadingAction}
              >
                {loadingAction ? "Excluindo..." : "Sim, Excluir Conta"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MODAL REFORMULADO DE EDIÇÃO DE CONTA, SISTEMA, PLANO E MÓDULOS
 */
function EditAccountModal({
  account,
  products,
  plans,
  onClose,
  onSuccess,
}: {
  account: any;
  products: any[];
  plans: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const sub = Array.isArray(account.subscriptions) ? account.subscriptions[0] : account.subscriptions;
  const currentSlug = getAccountProductSlug(account, sub);

  // Determinar o produto inicial
  const initialProduct = products.find((p) => p.slug === currentSlug) || products[0];

  const [selectedSystemSlug, setSelectedSystemSlug] = useState<"rephub" | "enghub" | "lawhub" | "barberhub">(currentSlug);
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProduct?.id || "");
  const [selectedPlanId, setSelectedPlanId] = useState<string>(sub?.plan_id || sub?.plans?.id || "");
  const [amount, setAmount] = useState<number>(Number(sub?.amount || 0));
  const [dueDate, setDueDate] = useState<string>(sub?.due_date || "10");
  const [syncModules, setSyncModules] = useState<boolean>(true);

  const [formData, setFormData] = useState({
    name: account.name || "",
    document: account.document || "",
    responsibleName: account.responsible_name || "",
    phone: account.contact_phone || "",
    email: account.contact_email || "",
    whatsappNumberLimit: account.whatsapp_number_limit || 1,
  });

  // Filtrar os planos pelo sistema selecionado
  const filteredPlans = useMemo(() => {
    return plans.filter((p: any) => {
      const pSlug = p.products?.slug?.toLowerCase();
      if (pSlug) return pSlug === selectedSystemSlug;
      const pName = (p.name || "").toLowerCase();
      if (selectedSystemSlug === "lawhub") return pName.includes("lawhub") || pName.includes("advog") || pName.includes("jurid");
      if (selectedSystemSlug === "enghub") return pName.includes("enghub") || pName.includes("obra") || pName.includes("eng");
      if (selectedSystemSlug === "barberhub") return pName.includes("barber") || pName.includes("barbearia");
      if (selectedSystemSlug === "barberhub") return pName.includes("barber") || pName.includes("barbearia");
      return !pName.includes("lawhub") && !pName.includes("enghub");
    });
  }, [plans, selectedSystemSlug]);

  // Ao trocar de sistema, ajustar productId e plano
  function handleSystemChange(slug: "rephub" | "enghub" | "lawhub" | "barberhub") {
    setSelectedSystemSlug(slug);
    const prod = products.find((p) => p.slug === slug);
    if (prod) {
      setSelectedProductId(prod.id);
    }
    // Selecionar o primeiro plano daquele sistema
    const sysPlans = plans.filter((p: any) => {
      const pSlug = p.products?.slug?.toLowerCase();
      if (pSlug) return pSlug === slug;
      const pName = (p.name || "").toLowerCase();
      if (slug === "lawhub") return pName.includes("lawhub") || pName.includes("advog") || pName.includes("jurid");
      if (slug === "enghub") return pName.includes("enghub") || pName.includes("obra") || pName.includes("eng");
      return !pName.includes("lawhub") && !pName.includes("enghub");
    });

    if (sysPlans.length > 0) {
      setSelectedPlanId(sysPlans[0].id);
      setAmount(Number(sysPlans[0].amount || 0));
    }
  }

  // Ao trocar de plano, atualizar o valor da mensalidade sugerido
  function handlePlanChange(planId: string) {
    setSelectedPlanId(planId);
    const selected = filteredPlans.find((p: any) => p.id === planId);
    if (selected) {
      setAmount(Number(selected.amount || 0));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await updateTenantAccount({
        data: {
          accountId: account.id,
          newName: formData.name,
          document: formData.document,
          responsibleName: formData.responsibleName,
          phone: formData.phone,
          email: formData.email,
          dueDate,
          amount,
          ...(selectedPlanId ? { planId: selectedPlanId } : {}),
          ...(selectedProductId ? { productId: selectedProductId } : {}),

          whatsappNumberLimit: formData.whatsappNumberLimit ? Number(formData.whatsappNumberLimit) : null,
          syncModules,
        },
      });
      toast.success("Conta, sistema e assinatura atualizados com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl p-6 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Gerenciar Assinatura & Sistema</h3>
            <p className="text-xs text-slate-500">Configure os dados cadastrais, sistema contratado e plano do cliente</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            ID: {account.id?.substring(0, 8)}...
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* SELEÇÃO DO SISTEMA / PRODUTO */}
          <div>
            <label className="text-slate-700 dark:text-slate-200 font-bold block mb-1.5">
              Sistema Contratado (Produto)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleSystemChange("rephub")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition text-center ${
                  selectedSystemSlug === "rephub"
                    ? "border-cyan-500 bg-cyan-50/80 text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200 ring-2 ring-cyan-500/20 font-bold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:text-slate-400"
                }`}
              >
                <Package className="size-5 text-cyan-600" />
                <span className="text-xs">Navor RepHub</span>
                <span className="text-[10px] opacity-70">CRM Comercial</span>
              </button>

              <button
                type="button"
                onClick={() => handleSystemChange("enghub")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition text-center ${
                  selectedSystemSlug === "enghub"
                    ? "border-amber-500 bg-amber-50/80 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 ring-2 ring-amber-500/20 font-bold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:text-slate-400"
                }`}
              >
                <HardHat className="size-5 text-amber-600" />
                <span className="text-xs">Navor EngHub</span>
                <span className="text-[10px] opacity-70">Gestão de Obras</span>
              </button>

              <button
                type="button"
                onClick={() => handleSystemChange("lawhub")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition text-center ${
                  selectedSystemSlug === "lawhub"
                    ? "border-blue-600 bg-blue-50/80 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 ring-2 ring-blue-600/20 font-bold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:text-slate-400"
                }`}
              >
                <Scale className="size-5 text-blue-600" />
                <span className="text-xs">Navor LawHub</span>
                <span className="text-[10px] opacity-70">Gestão Jurídica</span>
              </button>
            </div>
          </div>

          {/* PLANO, VALOR E VENCIMENTO */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/30 space-y-3">
            <span className="text-[11px] font-bold text-slate-800 dark:text-white uppercase tracking-wider block">
              Condições da Assinatura
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                  Plano Selecionado
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Selecione um plano...</option>
                  {filteredPlans.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (R$ {Number(p.amount).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                  Mensalidade (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                  Dia de Vencimento
                </label>
                <input
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="Ex: 10 ou 2026-09-25"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncModules}
                  onChange={(e) => setSyncModules(e.target.checked)}
                  className="size-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-xs">
                  Sincronizar módulos deste sistema automaticamente ao salvar (aplica os recursos oficiais do {selectedSystemSlug === "lawhub" ? "LawHub" : selectedSystemSlug === "enghub" ? "EngHub" : "RepHub"})
                </span>
              </label>
            </div>
          </div>

          {/* DADOS CADASTRAIS DO CLIENTE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                Razão Social / Nome do Assinante
              </label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                CPF / CNPJ
              </label>
              <input
                value={formData.document}
                onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                Nome do Responsável
              </label>
              <input
                value={formData.responsibleName}
                onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                Telefone / WhatsApp
              </label>
              <input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-slate-600 dark:text-slate-300 font-semibold block mb-1">
                E-mail de Acesso e Cobrança
              </label>
              <input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm"
            >
              {loading ? "Salvando..." : "Salvar Alterações e Vínculos"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * MODAL DE CRIAÇÃO DE CONTA COM SELETOR DE SISTEMA (RepHub, EngHub, LawHub)
 * E SUPORTE A OAB + SINCRONIZAÇÃO AUTOMÁTICA
 */
function CreateAccountModal({
  onClose,
  onSuccess,
  plans,
  products = [],
}: {
  onClose: () => void;
  onSuccess: () => void;
  plans: any[];
  products?: any[];
}) {
  const [selectedSystem, setSelectedSystem] = useState<string>("lawhub");
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Encontrar o produto correspondente ao sistema selecionado
  const currentProduct = useMemo(() => {
    return (
      products.find((p) => {
        const slug = (p.slug || p.name || "").toLowerCase();
        return slug.includes(selectedSystem);
      }) || products[0]
    );
  }, [products, selectedSystem]);

  // Filtrar planos do sistema selecionado
  const systemPlans = useMemo(() => {
    const filtered = plans.filter((p) => {
      if (currentProduct?.id && p.product_id) {
        return p.product_id === currentProduct.id;
      }
      const pName = (p.name || "").toLowerCase();
      const prodName = (p.products?.name || p.products?.slug || "").toLowerCase();
      return pName.includes(selectedSystem) || prodName.includes(selectedSystem);
    });
    return filtered.length > 0 ? filtered : plans;
  }, [plans, currentProduct, selectedSystem]);

  const [selectedPlanId, setSelectedPlanId] = useState(systemPlans[0]?.id || plans[0]?.id || "");
  const [amount, setAmount] = useState<number>(() => {
    const initial = systemPlans[0] || plans[0];
    return initial?.amount ? Number(initial.amount) : 199.0;
  });

  // Atualiza plano selecionado e valor quando o sistema mudar
  useEffect(() => {
    if (systemPlans.length > 0) {
      const match = systemPlans.find((p) => p.id === selectedPlanId) || systemPlans[0];
      setSelectedPlanId(match.id);
      setAmount(Number(match.amount || 199.0));
    }
  }, [selectedSystem, systemPlans]);

  // Form states
  const [companyName, setCompanyName] = useState("");
  const [document, setDocument] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dueDate, setDueDate] = useState("2026-09-30");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [existingEmailInfo, setExistingEmailInfo] = useState<{
    exists: boolean;
    accounts: any[];
    message: string | null;
  } | null>(null);
  const [confirmMultiSubscription, setConfirmMultiSubscription] = useState(false);

  // LawHub specific fields
  const [oabNumber, setOabNumber] = useState("18.293");
  const [oabState, setOabState] = useState("PI");
  const [autoSyncOAB, setAutoSyncOAB] = useState(true);

  async function handleEmailBlur() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;
    try {
      setCheckingEmail(true);
      const res = await checkEmailSubscriptions({ data: { email: trimmed } });
      if (res?.exists) {
        setExistingEmailInfo(res);
        setConfirmMultiSubscription(true);
      } else {
        setExistingEmailInfo(null);
      }
    } catch (e) {
      console.warn("Erro ao checar e-mail:", e);
    } finally {
      setCheckingEmail(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (existingEmailInfo?.exists && !confirmMultiSubscription) {
      toast.error("Marque a confirmação para criar uma assinatura independente neste e-mail existente.");
      return;
    }

    setLoading(true);

    try {
      // 1. Criar tenant account no SaaS com productId explícito do sistema selecionado
      const result = await createTenantAccount({
        data: {
          companyName,
          email: email.trim(),
          phone,
          document,
          responsibleName,
          planId: selectedPlanId,
          productId: currentProduct?.id,
          amount: Number(amount),
          dueDate,
          allowMultipleSubscriptions: true,
        },
      });

      // 2. Se for LawHub e marcado autoSyncOAB: Acionar sincronização do acervo imediatamente!
      if (selectedSystem === "lawhub" && autoSyncOAB && oabNumber.trim()) {
        try {
          toast.loading("Sincronizando acervo OAB do novo assinante...", { id: "oab-seed" });
          await LawHubService.syncOfficeOAB(oabNumber.trim(), oabState, responsibleName || companyName);
          toast.success(`Acervo OAB/${oabState} ${oabNumber} sincronizado com sucesso no LawHub!`, { id: "oab-seed" });
        } catch (syncErr) {
          console.warn("Aviso ao sincronizar OAB inicial:", syncErr);
        }
      }

      if (result?.password) {
        setGeneratedPassword(result.password);
        toast.success("Conta criada com sucesso!");
      } else {
        toast.success("Conta criada com sucesso! O e-mail já possuía cadastro anterior.");
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (generatedPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="w-full max-w-xl p-6 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Conta Criada com Sucesso</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            O assinante já está cadastrado no sistema <strong>{selectedSystem.toUpperCase()}</strong>. Copie a senha provisória e encaminhe ao cliente:
          </p>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between dark:bg-blue-950/40 dark:border-blue-900">
            <div>
              <p className="text-xs text-blue-700 font-semibold mb-1 dark:text-blue-300">Senha provisória gerada:</p>
              <p className="text-slate-900 font-mono font-black text-lg tracking-wider dark:text-white">{generatedPassword}</p>
            </div>
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              <span>{copied ? "Copiado!" : "Copiar Senha"}</span>
            </button>
          </div>

          <div className="flex justify-end">
            <Button onClick={onSuccess} className="bg-blue-600 text-white hover:bg-blue-700 font-semibold">
              Concluir
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl p-6 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Criar Nova Conta SaaS</h3>
            <p className="text-xs text-slate-500">
              Escolha o sistema e informe os dados de acesso e faturamento do assinante.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. SELETOR DE SISTEMA DINÂMICO PARA TODOS OS PRODUTOS NAVOR */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider">
              1. Selecione o Sistema Contratado
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {(products && products.length > 0 ? products : [
                { id: "1", slug: "lawhub", name: "Navor LawHub", description: "Advocacia, contencioso e captura por OAB" },
                { id: "2", slug: "rephub", name: "Navor RepHub", description: "Representação comercial e vendas" },
                { id: "3", slug: "enghub", name: "Navor EngHub", description: "Construção civil, obras e insumos" },
                { id: "4", slug: "barberhub", name: "Navor BarberHub", description: "Gestão completa para barbearias" },
                { id: "5", slug: "pethub", name: "PetHub", description: "Pet shops, clínicas veterinárias, banho & tosa e e-commerce" },
              ]).map((prod: any) => {
                const slug = (prod.slug || prod.name || "").toLowerCase();
                const isSelected = selectedSystem === slug;
                const isLawHub = slug.includes("law");
                const isRepHub = slug.includes("rep");
                const isEngHub = slug.includes("eng");
                const isBarberHub = slug.includes("barber");
                const isPetHub = slug.includes("pet");

                const IconComponent = isPetHub ? PawPrint : isLawHub ? Scale : isRepHub ? Package : isEngHub ? HardHat : isBarberHub ? Scissors : LayoutGrid;

                let activeBorder = "border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500/20";
                let iconColor = "bg-blue-600/10 text-blue-600";
                let checkBg = "bg-blue-600";

                if (isRepHub) {
                  activeBorder = "border-cyan-600 bg-cyan-50/80 dark:bg-cyan-950/40 ring-2 ring-cyan-500/20";
                  iconColor = "bg-cyan-600/10 text-cyan-600";
                  checkBg = "bg-cyan-600";
                } else if (isEngHub) {
                  activeBorder = "border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/20";
                  iconColor = "bg-amber-600/10 text-amber-600";
                  checkBg = "bg-amber-600";
                } else if (isBarberHub) {
                  activeBorder = "border-orange-600 bg-orange-50/80 dark:bg-orange-950/40 ring-2 ring-orange-500/20";
                  iconColor = "bg-orange-600/10 text-orange-600";
                  checkBg = "bg-orange-600";
                }

                return (
                  <button
                    key={prod.id || slug}
                    type="button"
                    onClick={() => setSelectedSystem(slug)}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? `${activeBorder} shadow-xs`
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg ${iconColor}`}>
                        <IconComponent className="size-5" />
                      </div>
                      {isSelected && (
                        <span className={`rounded-full ${checkBg} p-0.5 text-white`}>
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{prod.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                        {prod.description || (isLawHub ? "Advocacia e contencioso" : isRepHub ? "Representação comercial e vendas" : isEngHub ? "Construção civil e obras" : "Gestão para barbearias")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. CAMPOS ESPECÍFICOS PARA LAWHUB (OAB + AUTO SYNC) */}
          {selectedSystem === "lawhub" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-3 dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-blue-600" />
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  Dados da OAB do Escritório (Sincronização Automática)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Ao cadastrar a OAB abaixo, o sistema do novo assinante LawHub já importará automaticamente todos os <strong>processos judiciais</strong>, <strong>contatos</strong> e <strong>publicações de diários oficiais</strong> vinculados à OAB.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200">
                    Número da OAB *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 18.293"
                    value={oabNumber}
                    onChange={(e) => setOabNumber(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200">
                    Estado da OAB (Seccional) *
                  </label>
                  <select
                    value={oabState}
                    onChange={(e) => setOabState(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
                  >
                    <option value="PI">PI - Piauí</option>
                    <option value="SP">SP - São Paulo</option>
                    <option value="RJ">RJ - Rio de Janeiro</option>
                    <option value="DF">DF - Distrito Federal</option>
                    <option value="MA">MA - Maranhão</option>
                    <option value="CE">CE - Ceará</option>
                    <option value="MG">MG - Minas Gerais</option>
                    <option value="BA">BA - Bahia</option>
                    <option value="PR">PR - Paraná</option>
                    <option value="RS">RS - Rio Grande do Sul</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoSyncOAB}
                  onChange={(e) => setAutoSyncOAB(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Puxar dados do acervo e processos do advogado no momento do provisionamento</span>
              </label>
            </div>
          )}

          {/* 3. DADOS DO ASSINANTE / EMPRESA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold">
                {selectedSystem === "lawhub" ? "Nome do Escritório / Razão Social *" : "Razão Social / Nome da Empresa *"}
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={selectedSystem === "lawhub" ? "Ex: Borges & Associados Advocacia" : "Ex: Ativa Representações"}
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold">CPF / CNPJ</label>
              <input
                type="text"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold">
                {selectedSystem === "lawhub" ? "Advogado Titular / Responsável *" : "Nome do Responsável *"}
              </label>
              <input
                type="text"
                required
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Ex: Dr. Matheus Borges"
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold">Telefone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(86) 99999-9999"
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
                <span>E-mail do Administrador (Será o Login de Acesso) *</span>
                {checkingEmail && (
                  <span className="text-[10px] text-blue-600 flex items-center gap-1 font-normal">
                    <RotateCw className="size-2.5 animate-spin" /> Verificando e-mail...
                  </span>
                )}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (existingEmailInfo) setExistingEmailInfo(null);
                }}
                onBlur={handleEmailBlur}
                placeholder="advogado@escritorio.com.br"
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              {existingEmailInfo?.exists && (
                <div className="mt-2.5 p-3 rounded-xl border border-amber-300 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/40 space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 dark:text-amber-200">
                      <p className="font-bold">E-mail já possui cadastro na plataforma NAVOR</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                        {existingEmailInfo.message}
                      </p>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmMultiSubscription}
                      onChange={(e) => setConfirmMultiSubscription(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">
                      Confirmar criação de uma <u>nova assinatura 100% independente</u> no <strong>{selectedSystem.toUpperCase()}</strong> vinculada a este login/e-mail. (Custos, notas e módulos serão totalmente separados).
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* 4. PLANO E VALOR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold">Plano</label>
              <select
                value={selectedPlanId}
                onChange={(e) => {
                  setSelectedPlanId(e.target.value);
                  const p = systemPlans.find((x) => x.id === e.target.value);
                  if (p) setAmount(Number(p.amount));
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
              >
                {systemPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.amount ? `(R$ ${Number(p.amount).toFixed(2)})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold">Mensalidade (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold text-emerald-600"
              />
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold">Data 1º Vencimento</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RotateCw className="size-3.5 animate-spin" />
                  <span>Provisionando...</span>
                </>
              ) : (
                <span>Criar Conta & Ativar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
