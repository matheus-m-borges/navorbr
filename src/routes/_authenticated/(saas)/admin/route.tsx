import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuroraBackdrop } from "@/components/navor-rephub/ui";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  LogOut,
  BarChart3,
  Activity,
  MessageSquare,
  Package,
  ShieldCheck,
  DollarSign,
  Lock,
  Menu,
  X,
  User,
  Cpu,
  FileText,
  Key,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getAdminErrorStatus, getAdminSessionInfo, lockAdminPanel } from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const onUnlockPage = location.pathname.startsWith("/admin/unlock");
    const { checkAdminUnlock } = await import("@/api/admin-actions");
    const unlocked = await checkAdminUnlock().catch(() => false);

    if (!unlocked && !onUnlockPage) {
      throw redirect({ to: "/admin/unlock" });
    }
    if (unlocked && onUnlockPage) {
      throw redirect({ to: "/admin" });
    }

    return { isAdmin: true, unlocked };
  },
  component: AdminLayout,
});

const ADMIN_NAV = [
  { to: "/admin", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/contas", label: "Assinantes", icon: Users },
  { to: "/admin/planos", label: "Planos", icon: CreditCard },
  { to: "/admin/ia-consumo", label: "Consumo de IA & Tokens", icon: Cpu },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/error-logs", label: "Logs de Erros", icon: Activity },
  { to: "/admin/whatsapp", label: "WhatsApp (Meta)", icon: MessageSquare },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
  { to: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard },
  { to: "/admin/assinaturas/alteracoes", label: "Alterações de Plano", icon: ArrowRightLeft },
  { to: "/admin/dashboard-comercial", label: "Dashboard Comercial", icon: BarChart3 },
  { to: "/admin/integracoes", label: "Integrações", icon: Key },
  { to: "/admin/faturas", label: "Faturas", icon: FileText },
  { to: "/admin/provisioning", label: "Provisionamento", icon: Activity },
  { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/admin/auditoria", label: "Auditoria & LGPD", icon: ShieldCheck },
  { to: "/admin/monitoramento", label: "Monitoramento", icon: Activity },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const [hasNewErrors, setHasNewErrors] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    void getAdminSessionInfo()
      .then((session) => setUserEmail(session.email))
      .catch(() => setUserEmail(""));
  }, []);

  useEffect(() => {
    const fetchErrors = async () => {
      if (pathname.startsWith("/admin/error-logs")) {
        localStorage.setItem("admin_last_seen_errors_at", new Date().toISOString());
        setHasNewErrors(false);
        return;
      }
      const lastSeenStr = localStorage.getItem("admin_last_seen_errors_at");
      const referenceDate = lastSeenStr
        ? new Date(lastSeenStr).toISOString()
        : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const status = await getAdminErrorStatus({ data: { since: referenceDate } }).catch(() => null);
      setHasNewErrors(status?.hasNewErrors === true);
    };
    fetchErrors();
    const handleClear = () => setHasNewErrors(false);
    window.addEventListener("admin_errors_cleared", handleClear);
    return () => window.removeEventListener("admin_errors_cleared", handleClear);
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await lockAdminPanel().catch(() => {});
      localStorage.removeItem("admin_last_seen_errors_at");
      localStorage.removeItem("lawhub_master_auth_event");
      toast.success("Sessão da retaguarda encerrada com sucesso");
      window.location.replace("/admin/unlock");
    } catch (err: any) {
      window.location.replace("/admin/unlock");
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleLockPanel() {
    try {
      await lockAdminPanel().catch(() => {});
      toast.info("Retaguarda bloqueada", {
        description: "Será necessário confirmar suas credenciais individuais para reabrir.",
      });
      window.location.replace("/admin/unlock");
    } catch (err: any) {
      window.location.replace("/admin/unlock");
    }
  }

  if (pathname.startsWith("/admin/unlock")) {
    return <Outlet />;
  }

  return (
    <div className="relative min-h-screen bg-ink text-foreground">
      <AuroraBackdrop />
      <div className="relative z-10 mx-auto flex max-w-[1560px] gap-6 px-3 py-4 sm:px-6 sm:py-6">
        {/* Admin Sidebar (Desktop) */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] shrink-0 w-64 lg:block">
          <div className="glass flex h-full flex-col rounded-2xl p-4 bg-white/80 dark:bg-card/40 border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-3 px-2 pb-5 border-b border-slate-200 dark:border-white/10">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 font-display text-xl font-bold text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                N
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <p className="truncate font-display text-lg tracking-wider font-bold text-slate-900 dark:text-white">
                  NAVOR
                </p>
                <p className="truncate text-[10px] text-cyan-700 dark:text-cyan-400 uppercase font-bold">Tecnologia que move negócios</p>
              </div>
            </div>
            <nav className="mt-4 flex-1 space-y-1 overflow-y-auto pr-1">
              {ADMIN_NAV.map((item) => {
                const active = pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition relative",
                      active
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-accent/60 dark:hover:text-white"
                    )}
                  >
                    <Icon className={cn("size-4", active ? "text-white" : "text-slate-500 dark:text-gold")} />
                    {item.label}
                    {item.to === "/admin/error-logs" && hasNewErrors ? (
                      <span className="ml-auto size-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            {/* Sidebar Bottom: Perfil Admin & Botão SAIR */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
                <div className="grid size-7 shrink-0 place-items-center rounded-md bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  <User className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {userEmail || "Administrador"}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    <ShieldCheck className="size-2.5" /> Retaguarda SaaS
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleLockPanel}
                  title="Bloquear a retaguarda com senha sem deslogar da conta"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-800/40 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <Lock className="size-3.5 text-amber-500" />
                  <span>Trancar</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  title="Encerrar sessão e sair da plataforma"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100/80 dark:text-rose-400 dark:hover:bg-rose-950/50 transition cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="size-3.5 text-rose-500" />
                  <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 space-y-5">
          {/* Header Superior */}
          <header className="flex items-center justify-between gap-3 rounded-2xl glass p-3 px-4 bg-white/60 dark:bg-card/30 border border-slate-200 dark:border-white/10 shadow-2xs">
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                aria-label="Abrir menu de navegação"
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 font-display text-sm font-bold text-white">
                  N
                </div>
                <span className="font-display font-bold text-sm tracking-wide text-slate-900 dark:text-white">
                  NAVOR Admin
                </span>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="size-3.5" />
                Administração Geral Ativa
              </span>
              {userEmail && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  ({userEmail})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLockPanel}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs transition cursor-pointer"
                title="Bloquear o painel"
              >
                <Lock className="size-3.5 text-amber-500" />
                <span>Bloquear</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-950/70 shadow-2xs transition cursor-pointer disabled:opacity-50"
                title="Encerrar sessão e sair da plataforma"
              >
                <LogOut className="size-3.5 text-rose-500" />
                <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
              </button>
            </div>
          </header>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden rounded-2xl glass p-4 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 shadow-xl space-y-4">
              <nav className="space-y-1">
                {ADMIN_NAV.map((item) => {
                  const active = pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition relative",
                        active
                          ? "bg-blue-600 text-white font-semibold shadow-xs"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-accent/60 dark:hover:text-white"
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-white" : "text-slate-500 dark:text-gold")} />
                      {item.label}
                      {item.to === "/admin/error-logs" && hasNewErrors ? (
                        <span className="ml-auto size-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleLockPanel}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-800/60 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <Lock className="size-3.5 text-amber-500" />
                  <span>Bloquear</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 py-2 text-xs font-bold text-rose-600 dark:text-rose-400"
                >
                  <LogOut className="size-3.5 text-rose-500" />
                  <span>{isLoggingOut ? "Saindo..." : "Sair da Conta"}</span>
                </button>
              </div>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
}




