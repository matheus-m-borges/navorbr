import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  Users,
  Wallet,
  Settings,
  X,
  Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useSession";
import { initials } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { AuroraBackdrop } from "@/components/navor-rephub/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { to: "/enghub/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/enghub/obras", label: "Obras", icon: HardHat },
  { to: "/enghub/planejamento", label: "Planejamento", icon: CalendarDays },
  { to: "/enghub/pessoas", label: "Pessoas", icon: Users },
  { to: "/enghub/materiais", label: "Materiais", icon: Package },
  { to: "/enghub/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/enghub/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function EngHubAppShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUser();

  async function logout() {
    await supabase.auth.signOut();
    void navigate({ to: "/entrar" });
  }

  return (
    <div className="relative flex min-h-screen bg-ink text-foreground selection:bg-brand/30">
      <AuroraBackdrop />

      {/* Sidebar Desktop */}
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-white/5 bg-background/50 backdrop-blur-xl transition-all duration-300 lg:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-white/5">
          <div className={cn("flex items-center gap-2 overflow-hidden transition-all", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
            <div className="grid size-8 shrink-0 place-items-center rounded bg-gold text-background shadow-[0_0_15px_rgba(255,215,0,0.4)]">
              <HardHat className="size-5" />
            </div>
            <div className="flex flex-col whitespace-nowrap">
              <span className="font-display font-bold leading-tight tracking-tight text-white">Navor EngHub</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-gold">Construção</span>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 py-6 custom-scrollbar space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "bg-gold/10 text-gold shadow-[inset_2px_0_0_#FFD700]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className={cn("size-5 shrink-0 transition-transform group-hover:scale-110", active && "text-gold drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl bg-white/5 p-2",
              collapsed && "justify-center px-0",
            )}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-gold to-yellow-600 font-bold text-background">
              {initials(user?.name || user?.email)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user?.name || "Usuário"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            )}
          </div>
          
          <button
            onClick={logout}
            className={cn(
              "mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Sair do sistema" : undefined}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && "Sair do sistema"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-background/50 px-4 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMenuOpen(true)}
              className="grid size-10 place-items-center rounded-lg hover:bg-white/5 lg:hidden"
            >
              <Menu className="size-5 text-foreground" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold sm:text-xl text-white">{title}</h1>
              {subtitle && <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1440px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-3/4 max-w-sm flex flex-col border-r border-border bg-card shadow-2xl animate-in slide-in-from-left">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="font-display font-bold text-gold">Navor EngHub</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
