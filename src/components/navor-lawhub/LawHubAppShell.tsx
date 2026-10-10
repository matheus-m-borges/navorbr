import { toast } from "sonner";
import { useState, useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Scale,
  LayoutDashboard,
  Home,
  Kanban,
  CalendarDays,
  Lock,
  Users,
  MessageSquare,
  Briefcase,
  FileText,
  DollarSign,
  PenTool,
  Sparkles,
  SearchCode,
  FolderClosed,
  BarChart3,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  HelpCircle,
  Plus,
  Search,
  ExternalLink,
  ChevronDown,
  Info,
  X,
  Bot,
  Zap,
  Settings,
  Building,
  Calculator,
  Layers,
  Workflow,
  ListTodo,
  FileSpreadsheet,
  UserCheck,
  UserPlus,
  ShieldCheck,
  GripVertical,
  ListOrdered,
  Headphones,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useSession";
import { initials } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OABSyncModal } from "./OABSyncModal";
import { NewProcessModal } from "./NewProcessModal";
import { TaskModal } from "./TaskModal";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import { LawHubPublicationBot } from "@/lib/lawhub/publication-bot";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeType?: "info" | "ia" | "beta" | "lock" | "alert";
}

const SIDEBAR_ITEMS: NavItem[] = [
  { to: "/lawhub/dashboard", label: "Área de Trabalho", icon: Home },
  { to: "/lawhub/dashboard?tab=operacional", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lawhub/leads", label: "Leads Kanban", icon: UserPlus, badge: "FUNIL", badgeType: "ia" },
  { to: "/lawhub/tarefas", label: "Gestão kanban", icon: Kanban },
  { to: "/lawhub/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/lawhub/workflows", label: "Workflows", icon: Workflow, badge: "AUTO", badgeType: "ia" },
  { to: "/lawhub/clientes", label: "Contatos", icon: Users },
  { to: "/lawhub/atendimentos", label: "CallCenter", icon: Headphones, badge: "OFICIAL", badgeType: "ia" },
  { to: "/lawhub/processos", label: "Processos e casos", icon: Briefcase },
  { to: "/lawhub/publicacoes", label: "Publicações", icon: FileText, badgeType: "alert" },
  { to: "/lawhub/calculadora", label: "Calculadora Jurídica", icon: Calculator, badge: "NOVO", badgeType: "ia" },
  { to: "/lawhub/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/lawhub/modelos", label: "Criação de peças", icon: PenTool, badge: "IA", badgeType: "ia" },
  { to: "/lawhub/ia", label: "Jurisprudência", icon: SearchCode, badge: "BETA IA", badgeType: "beta" },
  { to: "/lawhub/documentos", label: "Documentos", icon: FolderClosed },
  { to: "/lawhub/relatorios", label: "Relatórios", icon: FileSpreadsheet },
  { to: "/lawhub/indicadores", label: "Indicadores", icon: BarChart3 },
  { to: "/lawhub/alertas", label: "Alertas", icon: Bell, badgeType: "alert" },
];

export function LawHubAppShell({
  title,
  subtitle,
  children,
  actions,
  fullWidth = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  fullWidth?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [iaModalOpen, setIaModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [oabSyncModalOpen, setOabSyncModalOpen] = useState(false);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processModalMode, setProcessModalMode] = useState<"cnj" | "tribunal_orgao" | "lote_oab" | "cadastro_manual">("cnj");

  const lawyerProfile = LawHubService.getSyncedLawyerProfile();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUser();

  // Escuta atualizações de usuários e simulação
  const [, setUsersUpdatedTick] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setUsersUpdatedTick((t) => t + 1);
    window.addEventListener("lawhub_users_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("lawhub_users_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const isFullAccess = LawHubService.isMasterOrFullAccess(user?.email, user?.isPlatformAdmin);
  const isCallCenterOnlyUser = LawHubService.isCallCenterOnly(user?.email, user?.isPlatformAdmin);

  const officeUser = user?.email ? LawHubService.getCurrentOfficeUser(user.email) : null;
  const userPerms = officeUser?.permissions;
  const hasCrmAccess = isFullAccess || userPerms?.accessLeads === true || (!userPerms?.onlyCallCenter && officeUser?.role !== "atendente_callcenter" && userPerms?.accessLeads !== false);

  // Proteção em tempo real de rota com base nas permissões concedidas (Segurança Frontend)
  useEffect(() => {
    const accessCheck = LawHubService.canUserAccessRoute(user?.email, pathname, user?.isPlatformAdmin);
    if (!accessCheck.allowed && accessCheck.redirectRoute && pathname !== accessCheck.redirectRoute) {
      void navigate({ to: accessCheck.redirectRoute as any, replace: true });
    }
  }, [user?.email, user?.isPlatformAdmin, pathname, navigate]);

  // Configuração do Escritório (Logo, Nome, etc.)
  const [officeConfig, setOfficeConfig] = useState(() => LawHubService.getOfficeConfig());

  useEffect(() => {
    const handleOfficeUpdate = () => {
      setOfficeConfig(LawHubService.getOfficeConfig());
    };
    window.addEventListener("lawhub_office_updated", handleOfficeUpdate);
    window.addEventListener("storage", handleOfficeUpdate);
    return () => {
      window.removeEventListener("lawhub_office_updated", handleOfficeUpdate);
      window.removeEventListener("storage", handleOfficeUpdate);
    };
  }, []);

  // Contadores dinâmicos de Publicações e Alertas
  const [unhandledPubsCount, setUnhandledPubsCount] = useState<number>(() =>
    LawHubService.getUnhandledPublicationsCount()
  );
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(() =>
    LawHubService.getActiveAlertsCount()
  );
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenTask = () => setTaskModalOpen(true);
    window.addEventListener("lawhub_open_task_modal", handleOpenTask);
    return () => window.removeEventListener("lawhub_open_task_modal", handleOpenTask);
  }, []);

  useEffect(() => {
    // Inicia o Bot de monitoramento contínuo em segundo plano (100% do tempo)
    LawHubPublicationBot.start();

    const updateCounts = () => {
      setUnhandledPubsCount(LawHubService.getUnhandledPublicationsCount());
      setActiveAlertsCount(LawHubService.getActiveAlertsCount());
    };
    window.addEventListener("lawhub_publications_updated", updateCounts);
    window.addEventListener("lawhub_alerts_updated", updateCounts);
    window.addEventListener("lawhub_new_publication_detected", updateCounts);
    return () => {
      window.removeEventListener("lawhub_publications_updated", updateCounts);
      window.removeEventListener("lawhub_alerts_updated", updateCounts);
      window.removeEventListener("lawhub_new_publication_detected", updateCounts);
    };
  }, []);

  // Sistema de Reorganização do Menu Lateral (Idêntico ao RepHub)
  const [ordering, setOrdering] = useState(false);
  const [order, setOrder] = useState<string[]>(() => SIDEBAR_ITEMS.map((n) => n.to));
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("lawhub-menu-order") || "[]");
      if (Array.isArray(saved) && saved.length > 0) {
        const valid = saved.filter((path) => SIDEBAR_ITEMS.some((n) => n.to === path));
        const missing = SIDEBAR_ITEMS.map((n) => n.to).filter((path) => !valid.includes(path));
        setOrder([...valid, ...missing]);
      }
    } catch {}
  }, []);

  function saveOrder(newOrder: string[]) {
    setOrder(newOrder);
    window.localStorage.setItem("lawhub-menu-order", JSON.stringify(newOrder));
  }

  function handleDragStart(e: React.DragEvent, to: string) {
    if (!ordering) return;
    setDraggedItem(to);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", to);
  }

  function handleDragOver(e: React.DragEvent, to: string) {
    if (!ordering || !draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (to !== dragOverItem) setDragOverItem(to);
  }

  function handleDrop(e: React.DragEvent, to: string) {
    if (!ordering || !draggedItem) return;
    e.preventDefault();
    if (draggedItem !== to) {
      const newOrder = [...order];
      const fromIndex = newOrder.indexOf(draggedItem);
      const toIndex = newOrder.indexOf(to);
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, draggedItem);
      saveOrder(newOrder);
    }
    setDraggedItem(null);
    setDragOverItem(null);
  }

  function handleDragEnd() {
    setDraggedItem(null);
    setDragOverItem(null);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!ordering || !draggedItem) return;
    const touch = e.touches[0];
    if (!touch) return;
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const to = target?.closest("[data-dnd-id]")?.getAttribute("data-dnd-id");
    if (to && to !== dragOverItem) setDragOverItem(to);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!ordering || !draggedItem) return;
    if (dragOverItem && draggedItem !== dragOverItem) {
      const newOrder = [...order];
      const fromIndex = newOrder.indexOf(draggedItem);
      const toIndex = newOrder.indexOf(dragOverItem);
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, draggedItem);
      saveOrder(newOrder);
    }
    setDraggedItem(null);
    setDragOverItem(null);
  }

  // Mapeamento dinâmico dos itens da sidebar com badges em tempo real
  const dynamicSidebarItems = SIDEBAR_ITEMS.map((item) => {
    if (item.to === "/lawhub/publicacoes") {
      return {
        ...item,
        badge: unhandledPubsCount > 0 ? String(unhandledPubsCount) : undefined,
        badgeType: unhandledPubsCount > 0 ? ("alert" as const) : undefined,
      };
    }
    if (item.to === "/lawhub/alertas") {
      return {
        ...item,
        badge: activeAlertsCount > 0 ? String(activeAlertsCount) : undefined,
        badgeType: activeAlertsCount > 0 ? ("alert" as const) : undefined,
      };
    }
    return item;
  });

  // Regra 16 e 17: Menu Dinâmico construído estritamente com base nas permissões reais do usuário
  const visibleSidebarItems = dynamicSidebarItems.filter((item) => {
    return LawHubService.canUserAccessRoute(user?.email, item.to, user?.isPlatformAdmin).allowed;
  });

  // Dados do Escritório e Advogado Associado (Topo Minimalista)
  const [officeLogo, setOfficeLogo] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("law_hub_office_logo") || "";
    }
    return "";
  });
  const [officeName, setOfficeName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("law_hub_office_name") || "Borges & Advogados Associados";
    }
    return "Borges & Advogados Associados";
  });
  const [associateName, setAssociateName] = useState<string>(() => {
    const config = LawHubService.getOfficeConfig();
    if (config?.titular_name && config.titular_name.trim()) {
      return config.titular_name.trim();
    }
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("law_hub_associate_lawyer");
      if (saved && !saved.toUpperCase().includes("ARTHUR")) return saved;
    }
    if (lawyerProfile.name && !lawyerProfile.name.toUpperCase().includes("ARTHUR")) {
      return lawyerProfile.name;
    }
    return "Dr. Matheus Borges";
  });

  useEffect(() => {
    function loadOffice() {
      if (typeof window !== "undefined") {
        const config = LawHubService.getOfficeConfig();
        setOfficeLogo(config?.logo_url || localStorage.getItem("law_hub_office_logo") || "");
        setOfficeName(config?.name || localStorage.getItem("law_hub_office_name") || "Borges & Advogados Associados");
        const titular =
          config?.titular_name?.trim() ||
          localStorage.getItem("law_hub_associate_lawyer") ||
          (lawyerProfile.name && !lawyerProfile.name.toUpperCase().includes("ARTHUR") ? lawyerProfile.name : "Dr. Matheus Borges");
        setAssociateName(titular);
      }
    }
    loadOffice();
    window.addEventListener("lawhub_office_updated", loadOffice);
    return () => window.removeEventListener("lawhub_office_updated", loadOffice);
  }, [lawyerProfile.name, user?.name]);

  async function logout() {
    await supabase.auth.signOut();
    void navigate({ to: "/entrar" });
  }

  // Regra 11, 13 e 14: Usuários com permissão APENAS para o Call Center OU operadores restritos na tela de atendimentos:
  // "o call center vai aparecer UNICAMENTE na tela inteira, so deixando a barra superior com os dados do escritório"
  // E se tiver CallCenter + CRM cumulativo, adiciona a opção de alternar para o CRM no topo institucional
  const isDedicatedCallCenterView =
    isCallCenterOnlyUser ||
    (!isFullAccess && !userPerms?.accessAllProcesses && !userPerms?.accessFinanceiro && pathname.startsWith("/lawhub/atendimentos"));

  if (isDedicatedCallCenterView) {
    return (
      <div className="flex flex-col min-h-screen w-screen bg-[#F8FAFC] text-slate-800 antialiased selection:bg-blue-600 selection:text-white dark:bg-[#0B0F19] dark:text-slate-100 overflow-hidden">
        {/* Barra Superior Exclusiva com os Dados do Escritório (Regra 12) */}
        <header className="sticky top-0 z-20 flex h-15 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-[#0F172A]/95 sm:px-6">
          {/* Dados do Escritório (Logomarca, Nome e Identidade) */}
          <div className="flex items-center gap-3 min-w-0">
            {officeLogo ? (
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 p-0.5 shadow-sm overflow-hidden">
                <img
                  src={officeLogo}
                  alt={officeName}
                  className="size-full object-contain"
                />
              </div>
            ) : (
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
                <Scale className="size-5" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {officeName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <Headphones className="size-3" /> CallCenter Oficial
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {officeConfig.address || officeConfig.email || lawyerProfile.full_oab || "Central de Atendimento Telefônico e WhatsApp"}
              </span>
            </div>
          </div>

          {/* Navegação entre módulos concedidos (Regra 14: CallCenter + CRM) */}
          {hasCrmAccess && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-slate-900 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 shadow-xs">
                <Headphones className="size-3.5" /> CallCenter
              </span>
              <Link
                to="/lawhub/leads"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/60 dark:hover:bg-slate-900/60 transition"
              >
                <UserPlus className="size-3.5 text-blue-600 dark:text-blue-400" /> CRM / Leads Kanban
              </Link>
            </div>
          )}

          {/* Dados do Operador Logado, Tema & Sair */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {hasCrmAccess && (
              <Link
                to="/lawhub/leads"
                className="sm:hidden inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300"
              >
                <UserPlus className="size-3.5" />
                <span>CRM</span>
              </Link>
            )}

            <div className="flex items-center gap-2.5 pr-2 sm:pr-3 border-r border-slate-200 dark:border-slate-800">
              <div className="grid size-8.5 place-items-center rounded-full bg-cyan-600 text-xs font-bold text-white shadow-sm">
                {initials(user?.name || user?.email || "Operador")}
              </div>
              <div className="hidden sm:flex flex-col min-w-0 text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                  {user?.name || "Operador Call Center"}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[160px]">
                  {user?.email || "atendimento"}
                </span>
              </div>
            </div>

            <ThemeToggle />

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-red-600 hover:bg-red-50 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition"
              title="Encerrar sessão e sair"
            >
              <LogOut className="size-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {/* Call Center UNICAMENTE na tela inteira */}
        <main className="flex-1 w-full h-[calc(100vh-3.75rem)] p-0 m-0 overflow-hidden">
          {children}
        </main>

      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-800 antialiased selection:bg-blue-600 selection:text-white dark:bg-[#0B0F19] dark:text-slate-100">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-in-out dark:border-slate-800 dark:bg-[#0F172A] lg:sticky lg:top-0 lg:h-screen lg:z-30",
          collapsed ? "lg:w-18" : "lg:w-60",
          mobileOpen ? "w-64 translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header com Suporte à Logomarca do Escritório */}
        <div className="flex h-15 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <Link
            to="/lawhub/dashboard"
            className={cn(
              "flex items-center gap-2.5 overflow-hidden transition-all outline-none",
              collapsed ? "lg:hidden" : "w-auto opacity-100"
            )}
            title={officeConfig.name || "Navor LawHub"}
          >
            {officeConfig.logo_url ? (
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 p-0.5 shadow-sm overflow-hidden">
                <img
                  src={officeConfig.logo_url}
                  alt={officeConfig.name || "Logo do Escritório"}
                  className="size-full object-contain"
                />
              </div>
            ) : (
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-white shadow-sm">
                <Scale className="size-5" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 truncate">
                {officeConfig.name ? "ESCRITÓRIO" : "NAVOR"}
              </span>
              <span className="font-sans text-sm font-bold leading-none text-slate-900 dark:text-white truncate max-w-[130px]">
                {officeConfig.name || "LawHub"}
              </span>
            </div>
          </Link>

          {/* Logo compacta quando a sidebar estiver recolhida (collapsed) */}
          {collapsed && (
            <Link
              to="/lawhub/dashboard"
              className="hidden lg:grid size-9 shrink-0 place-items-center rounded-lg overflow-hidden outline-none mx-auto"
              title={officeConfig.name || "Navor LawHub"}
            >
              {officeConfig.logo_url ? (
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 p-0.5 shadow-sm overflow-hidden">
                  <img
                    src={officeConfig.logo_url}
                    alt={officeConfig.name || "Logo"}
                    className="size-full object-contain"
                  />
                </div>
              ) : (
                <div className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white shadow-sm">
                  <Scale className="size-5" />
                </div>
              )}
            </Link>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:grid"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>

          <button
            onClick={() => setMobileOpen(false)}
            className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Barra de Controle de Organização do Menu (Idêntico ao RepHub) */}
        <div className={cn("flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50", collapsed && "justify-center px-1")}>
          {ordering ? (
            collapsed ? (
              <button
                onClick={() => setOrdering(false)}
                title="Concluir organização"
                className="rounded bg-blue-600 p-1 text-white hover:bg-blue-700 transition"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <div className="flex w-full items-center justify-between">
                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                  <GripVertical className="size-3 text-blue-600" /> Organizando
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    title="Restaurar ordem padrão"
                    onClick={() => {
                      const defaultOrder = SIDEBAR_ITEMS.map((n) => n.to);
                      setOrder(defaultOrder);
                      window.localStorage.removeItem("lawhub-menu-order");
                      toast.success("Ordem padrão do menu restaurada!");
                    }}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
                  >
                    Restaurar
                  </button>
                  <button
                    onClick={() => setOrdering(false)}
                    title="Concluir"
                    className="rounded bg-slate-200 dark:bg-slate-800 p-1 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          ) : (
            <button
              onClick={() => setOrdering(true)}
              title="Organizar ordem do menu"
              className={cn(
                "flex items-center text-[10px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition uppercase tracking-wider",
                collapsed ? "justify-center w-full" : "gap-1.5"
              )}
            >
              <ListOrdered className={cn("size-3.5", collapsed && "size-4")} />
              {!collapsed && <span>ORGANIZAR MENU</span>}
            </button>
          )}
        </div>

        {/* Navigation Items (Suporta Drag & Drop e Persistência de Ordem) */}
        <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5 custom-scrollbar text-xs font-medium", ordering && "touch-none")}>
          {order
            .map((path) => visibleSidebarItems.find((item) => item.to === path))
            .filter((item): item is (typeof dynamicSidebarItems)[number] => item !== undefined)
            .map((item) => {
              const currentSearch = typeof window !== "undefined" ? window.location.search : "";
              const isOperacionalTab = currentSearch.includes("tab=operacional");
              const active =
                item.to.includes("tab=operacional")
                  ? pathname === "/lawhub/dashboard" && isOperacionalTab
                  : item.to === "/lawhub/dashboard"
                  ? pathname === "/lawhub/dashboard" && !isOperacionalTab
                  : pathname === item.to || (item.to !== "/lawhub/dashboard" && pathname.startsWith(item.to + "/"));
              const Icon = item.icon;

              return (
                <div
                  key={item.to}
                  data-dnd-id={item.to}
                  draggable={ordering}
                  onDragStart={(e) => handleDragStart(e, item.to)}
                  onDragOver={(e) => handleDragOver(e, item.to)}
                  onDrop={(e) => handleDrop(e, item.to)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={() => ordering && setDraggedItem(item.to)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={cn(
                    "relative group rounded-md transition-all",
                    draggedItem === item.to && "opacity-40 scale-98",
                    dragOverItem === item.to && dragOverItem !== draggedItem && "bg-blue-500/10 border border-blue-500/40 rounded-md"
                  )}
                >
                  {ordering && (
                    <div
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 z-10 p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition",
                        collapsed ? "left-[1px]" : "left-1"
                      )}
                    >
                      <GripVertical className={cn("size-3.5", collapsed && "size-3")} />
                    </div>
                  )}

                  <Link
                    to={item.to}
                    onClick={(e) => {
                      if (ordering) {
                        e.preventDefault();
                        return;
                      }
                      setMobileOpen(false);
                    }}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center justify-between rounded-md px-2.5 py-2 text-[13px] transition-colors outline-none",
                      active
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200",
                      ordering && !collapsed && "pl-7",
                      ordering && collapsed && "pl-4"
                    )}
                  >
                    {/* Active left indicator bar */}
                    {active && !ordering && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-600 dark:bg-blue-400" />
                    )}

                    <div className="flex items-center gap-2.5 min-w-0 pl-1">
                      <Icon
                        className={cn(
                          "size-4.5 shrink-0 transition-colors",
                          active
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!collapsed && item.badge && !ordering && (
                      <div className="flex items-center">
                        {item.badgeType === "ia" && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            <Sparkles className="size-2.5" /> IA
                          </span>
                        )}
                        {item.badgeType === "beta" && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            BETA <Sparkles className="size-2.5 text-blue-600" />
                          </span>
                        )}
                        {item.badgeType === "info" && (
                          <span className="grid size-4 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {item.badge}
                          </span>
                        )}
                        {item.badgeType === "lock" && (
                          <Lock className="size-3 text-slate-400" />
                        )}
                        {item.badgeType === "alert" && (
                          <span className="grid min-w-4.5 h-4.5 px-1 place-items-center rounded-full bg-red-600 text-[10px] font-extrabold text-white shadow-xs">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                </div>
              );
            })}
        </nav>

        {/* Sidebar Footer (AI CTA & Support) */}
        <div className="border-t border-slate-200 p-2.5 space-y-2 dark:border-slate-800">
          {!collapsed && (
            <button
              onClick={() => setIaModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95 hover:shadow"
            >
              <Sparkles className="size-3.5" /> Conheça as IAs
            </button>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setSupportModalOpen(true)}
              className={cn(
                "flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400",
                collapsed ? "justify-center w-full" : ""
              )}
              title="Suporte Jurídico"
            >
              <HelpCircle className="size-4 shrink-0" />
              {!collapsed && <span>Suporte</span>}
            </button>

            {!collapsed && (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
                title="Sair da conta"
              >
                <LogOut className="size-3.5" />
                <span>Sair</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex h-15 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-[#0F172A]/95 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden dark:border-slate-800 dark:text-slate-300"
            >
              <PanelLeftOpen className="size-4" />
            </button>

            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Identidade Minimalista do Escritório & Advogado Associado (Inspirado no RepHub) */}
            <div className="hidden lg:flex items-center gap-2.5 pl-4 ml-1 border-l border-slate-200 dark:border-slate-800">
              <div className="size-8 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                {officeLogo ? (
                  <img
                    src={officeLogo}
                    alt={officeName}
                    className="size-full object-contain p-0.5"
                  />
                ) : (
                  <Building className="size-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[200px] leading-tight" title={officeName}>
                  {officeName}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] leading-tight" title={associateName}>
                  {associateName}
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {actions}

            {/* Botão Sincronizar OAB (Somente com Acesso Completo) */}
            {isFullAccess && (
              <button
                onClick={() => setOabSyncModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 shadow-xs transition"
                title="Sincronizar acervo processual e contatos via OAB"
              >
                <Zap className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="hidden sm:inline font-bold">OAB:</span>
                <span className="font-mono text-[11px] sm:text-xs">{lawyerProfile.full_oab}</span>
              </button>
            )}

            {/* Quick Add Dropdown */}
            {(isFullAccess || userPerms?.accessAllProcesses || userPerms?.manageClients || hasCrmAccess) && (
              <div className="relative">
                <button
                  onClick={() => setQuickAddOpen(!quickAddOpen)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">Novo</span>
                  <ChevronDown className="size-3" />
                </button>

                {quickAddOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setQuickAddOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-40 w-60 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
                      {/* Destaque Principal: Processo Busca Automática */}
                      {(isFullAccess || userPerms?.accessAllProcesses || userPerms?.createProcesses) && (
                        <button
                          onClick={() => {
                            setQuickAddOpen(false);
                            setProcessModalMode("cnj");
                            setProcessModalOpen(true);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50/80 dark:text-blue-400 dark:hover:bg-blue-950/40 transition border-b border-slate-100 dark:border-slate-800/60"
                        >
                          <div className="flex items-center gap-2">
                            <div className="grid size-5 place-items-center rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                              <Zap className="size-3 text-blue-600 dark:text-blue-300" />
                            </div>
                            <span>Processo busca automática</span>
                          </div>
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/50">
                            Robô (Sem IA)
                          </span>
                        </button>
                      )}

                      {(isFullAccess || userPerms?.accessAllProcesses || userPerms?.createProcesses) && (
                        <button
                          onClick={() => {
                            setQuickAddOpen(false);
                            setProcessModalMode("cadastro_manual");
                            setProcessModalOpen(true);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                        >
                          <Briefcase className="size-3.5 text-slate-500" /> Pasta de Processo Manual
                        </button>
                      )}

                      {(isFullAccess || userPerms?.manageClients || hasCrmAccess) && (
                        <Link
                          to="/lawhub/clientes"
                          onClick={() => setQuickAddOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                        >
                          <Users className="size-3.5 text-emerald-600" /> Novo Contato
                        </Link>
                      )}

                      {(isFullAccess || userPerms?.accessAllProcesses || userPerms?.canDelegateTasks) && (
                        <button
                          onClick={() => {
                            setQuickAddOpen(false);
                            setTaskModalOpen(true);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition text-left"
                        >
                          <ListTodo className="size-3.5 text-blue-600" /> Nova Tarefa / Atividade
                        </button>
                      )}

                      {(isFullAccess || userPerms?.manageAgenda || userPerms?.accessAllProcesses) && (
                        <Link
                          to="/lawhub/agenda"
                          onClick={() => setQuickAddOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                        >
                          <CalendarDays className="size-3.5 text-indigo-600" /> Nova Audiência / Prazo
                        </Link>
                      )}

                      {(isFullAccess || userPerms?.useAI || userPerms?.accessAllProcesses) && (
                        <Link
                          to="/lawhub/modelos"
                          onClick={() => setQuickAddOpen(false)}
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="size-3.5 text-purple-600" />
                            <span>Criar Peça com IA</span>
                          </div>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                            IA • Créditos
                          </span>
                        </Link>
                      )}

                      {isFullAccess && (
                        <button
                          onClick={() => {
                            setQuickAddOpen(false);
                            setOabSyncModalOpen(true);
                          }}
                          className="flex w-full items-center justify-between border-t border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50/60 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-purple-950/30 transition"
                        >
                          <div className="flex items-center gap-2">
                            <Layers className="size-3.5 text-purple-600" />
                            <span>Sincronizar via OAB</span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono">Em lote • Sem IA</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Chave liga/desliga Claro e Escuro */}
            <ThemeToggle />

            {/* Sino Central de Alertas em Tempo Real */}
            {LawHubService.canUserAccessRoute(user?.email, "/lawhub/alertas", user?.isPlatformAdmin).allowed && (
              <Link
                to="/lawhub/alertas"
                className="relative grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                title={activeAlertsCount > 0 ? `${activeAlertsCount} alerta(s) não tratado(s)` : "Alertas"}
              >
                <Bell className="size-4" />
                {activeAlertsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white shadow-xs animate-in zoom-in-50">
                    {activeAlertsCount > 9 ? "9+" : activeAlertsCount}
                  </span>
                )}
              </Link>
            )}

            {/* Botão Configurações (Apenas Administradores) */}
            {(isFullAccess || userPerms?.isAdmin) && (
              <Link
                to="/lawhub/configuracoes"
                className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                title="Configurações e Administração"
              >
                <Settings className="size-4" />
              </Link>
            )}

            {/* User Avatar Badge */}
            {(isFullAccess || userPerms?.isAdmin) ? (
              <Link
                to="/lawhub/configuracoes"
                className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 hover:opacity-85 transition"
                title="Meu Perfil"
              >
                <div className="grid size-8 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                  {initials(user?.name || user?.email || "Advogado")}
                </div>
              </Link>
            ) : (
              <div
                className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800"
                title={user?.email || "Usuário Conectado"}
              >
                <div className="grid size-8 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                  {initials(user?.name || user?.email || "Colaborador")}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Body */}
        <main
          className={cn(
            "flex-1 w-full",
            fullWidth || pathname === "/lawhub/atendimentos"
              ? "p-0 max-w-none h-[calc(100vh-3.75rem)] overflow-hidden"
              : "p-4 sm:p-6 lg:p-7 max-w-7xl mx-auto"
          )}
        >
          {children}
        </main>
      </div>

      {/* Modal IAs Jurídicas */}
      {iaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Inteligência Artificial Jurídica NAVOR
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ferramentas avançadas para acelerar a rotina do escritório
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIaModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <Link
                to="/lawhub/modelos"
                onClick={() => setIaModalOpen(false)}
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-blue-500 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:border-blue-500/40 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <PenTool className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600">
                      Criação de Peças Processuais
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Redação guiada de petições iniciais, contestações, recursos e impugnações.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-blue-600">Acessar →</span>
              </Link>

              <Link
                to="/lawhub/ia"
                onClick={() => setIaModalOpen(false)}
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:border-indigo-500/40 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <SearchCode className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">
                      Jurisprudência & Jurimetria
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Chat inteligente para pesquisa de teses, divergência entre tribunais e precedentes.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-indigo-600">Acessar →</span>
              </Link>

              <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 p-4 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/20">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    <Bot className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Triagem Automática de Publicações (DJEN)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Identificação de prazos e intimações críticas direto no Diário Oficial.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-600 uppercase">Integrado</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Suporte */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="size-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Central de Ajuda LawHub
                </h3>
              </div>
              <button
                onClick={() => setSupportModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="py-4 space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <p>
                Precisa de suporte na configuração de OAB, sincronização com os Tribunais de Justiça ou gestão financeira?
              </p>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white">Horário de Atendimento:</p>
                <p>Segunda a Sexta, das 08h às 18h (Horário de Brasília)</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">Email Direto:</p>
                <p className="text-blue-600">suporte@navor.com.br</p>
              </div>
            </div>
            <button
              onClick={() => setSupportModalOpen(false)}
              className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Sincronização OAB Integral */}
      <OABSyncModal
        isOpen={oabSyncModalOpen}
        onClose={() => setOabSyncModalOpen(false)}
      />

      {/* Modal Unificado de Busca Processual Automática e Cadastro */}
      <NewProcessModal
        isOpen={processModalOpen}
        initialMode={processModalMode}
        onClose={() => setProcessModalOpen(false)}
        onOpenOABSync={() => {
          setProcessModalOpen(false);
          setOabSyncModalOpen(true);
        }}
      />

      {/* Modal Global de Atividades / Tarefas */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onTaskSaved={() => {
          setTaskModalOpen(false);
          window.dispatchEvent(new CustomEvent("lawhub_tasks_updated"));
        }}
      />
    </div>
  );
}
