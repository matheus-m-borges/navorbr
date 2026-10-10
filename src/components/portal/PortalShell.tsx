import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Layers,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  Tag,
  User,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SYSTEM_NAME, useRepresentation } from "@/lib/branding";
import { usePortalSession } from "@/hooks/usePortal";
import { cn } from "@/lib/utils";
import { AuroraBackdrop } from "@/components/navor-rephub/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { to: "/cliente/resumo", label: "Início", icon: Home },
  { to: "/cliente/minhas-marcas", label: "Minhas marcas", icon: Tag },
  { to: "/cliente/minhas-colecoes", label: "Coleções e catálogos", icon: Layers },
  { to: "/cliente/meus-pedidos", label: "Meus pedidos", icon: ShoppingBag },
  { to: "/cliente/perfil", label: "Meu perfil", icon: User },
] as const;

export function PortalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { representation } = useRepresentation();
  const { data: session } = usePortalSession();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/cliente/login", replace: true });
  }

  const sidebar = (
    <div className="glass flex h-full flex-col rounded-2xl p-4">
      <div className="flex items-center gap-3 px-1 pb-5">
        {representation.icon_url ? (
          <img
            src={representation.icon_url}
            alt={representation.name || SYSTEM_NAME}
            className="size-10 shrink-0 rounded-xl object-contain"
          />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-cyan font-display text-sm font-bold text-primary-foreground">
            RH
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-card-foreground">
            {representation.name || SYSTEM_NAME}
          </p>
          <p className="text-[11px] text-muted-foreground">Portal do cliente</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-accent font-medium text-card-foreground"
                  : "text-muted-foreground hover:bg-accent/60",
              )}
            >
              <Icon className={cn("size-4", active && "text-brand")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-ink-2/60 p-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/20">
          <Package className="size-4 text-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-card-foreground">
            {session?.tradeName || session?.legalName || "Cliente"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{session?.city ?? ""}</p>
        </div>
        <button
          aria-label="Sair"
          title="Sair"
          onClick={() => void signOut()}
          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-ink text-foreground">
      <AuroraBackdrop />
      <div className="relative z-10 mx-auto flex max-w-[1400px] gap-6 px-3 py-4 sm:px-6 sm:py-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 lg:block">{sidebar}</aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm lg:hidden">
            <div className="h-full w-[17rem] p-3">{sidebar}</div>
            <button aria-label="Fechar menu" className="flex-1" onClick={() => setMenuOpen(false)} />
          </div>
        ) : null}

        <main className="min-w-0 flex-1 space-y-5">
          <header className="flex flex-wrap items-center gap-3">
            <button
              aria-label="Abrir menu"
              onClick={() => setMenuOpen(true)}
              className="glass grid size-10 shrink-0 place-items-center rounded-xl lg:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-semibold text-card-foreground">{title}</h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
