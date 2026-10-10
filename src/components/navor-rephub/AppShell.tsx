import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  Factory,
  FolderOpen,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Users,
  UsersRound,
  Wallet,
  PiggyBank,
  Activity,
  BarChart3,
  Bot,
  X,
  GripVertical,
  ListOrdered,
  Navigation,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";
import { initials } from "@/lib/crm";
import { SYSTEM_NAME, SYSTEM_TAGLINE, useRepresentation } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { AuroraBackdrop } from "./ui";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: UsersRound },
  { to: "/clientes", label: "Clientes", icon: Building2 },
  { to: "/rotas", label: "Rotas de Viagem", icon: Navigation },
  { to: "/marcas", label: "Fábricas / Marcas", icon: Factory },
  { to: "/colecoes", label: "Coleções", icon: Layers },
  { to: "/radar-colecoes", label: "Radar Coleções", icon: Activity },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/faturamento", label: "Faturamento", icon: Receipt },
  { to: "/comissoes", label: "Comissões", icon: Wallet },
  { to: "/financeiro", label: "Financeiro", icon: PiggyBank },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/usuarios", label: "Usuários", icon: Users },
  { to: "/agente-whatsapp", label: "Agente WhatsApp", icon: Bot, adminOnly: true },
  { to: "/documentos", label: "Documentos", icon: FolderOpen },
] as const;


export function AppShell({
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
  const [ordering, setOrdering] = useState(false);
  const [order, setOrder] = useState<string[]>(() => NAV.map((n) => n.to));
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUser();
  const { data: notifications = [] } = useNotifications();
  const { representation } = useRepresentation();
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("rephub-menu-collapsed") === "1");
    try {
      const saved = JSON.parse(window.localStorage.getItem("rephub-menu-order") || "[]");
      if (Array.isArray(saved) && saved.length > 0) {
        const valid = saved.filter((path) => NAV.some((n) => n.to === path));
        const missing = NAV.map((n) => n.to).filter((path) => !valid.includes(path));
        setOrder([...valid, ...missing]);
      }
    } catch {}
  }, []);

  function saveOrder(newOrder: string[]) {
    setOrder(newOrder);
    window.localStorage.setItem("rephub-menu-order", JSON.stringify(newOrder));
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

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem("rephub-menu-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const buildSidebar = (mini: boolean) => (
    <div className="glass flex h-full flex-col rounded-2xl p-4">
      <div className={cn("pb-5", mini ? "px-0" : "px-2")}>
        <div className={cn("flex items-center gap-3", mini && "justify-center")}>
          {representation.icon_url ? (
            <img
              src={representation.icon_url}
              alt={representation.name || SYSTEM_NAME}
              className="size-10 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 font-display text-xl font-bold text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              N
            </div>
          )}
          {mini ? null : (
            <div className="min-w-0">
              <p className="truncate font-display text-sm leading-tight font-semibold text-card-foreground">
                {representation.name || SYSTEM_NAME}
              </p>
              {representation.slogan ? (
                <p className="truncate text-[11px] text-muted-foreground">{representation.slogan}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{SYSTEM_TAGLINE}</p>
              )}
            </div>
          )}
        </div>
        {representation.name && !mini ? (
          <p className="mt-3 text-[9px] font-bold tracking-widest text-muted-foreground uppercase opacity-70">
            {SYSTEM_NAME} <span className="font-medium">BY NAVOR</span>
          </p>
        ) : null}
      </div>

      <div className={cn("flex items-center justify-between pb-2", mini ? "px-0 justify-center" : "px-2")}>
        {ordering ? (
          mini ? (
            <button onClick={() => setOrdering(false)} className="rounded bg-brand p-1 text-primary-foreground"><X className="size-3.5" /></button>
          ) : (
            <div className="flex w-full items-center justify-between">
              <span className="text-[11px] font-semibold text-brand uppercase tracking-wider">Organizando</span>
              <div className="flex items-center gap-2">
                <button
                  title="Restaurar padrão"
                  onClick={() => {
                    const defaultOrder = NAV.map((n) => n.to);
                    setOrder(defaultOrder);
                    window.localStorage.removeItem("rephub-menu-order");
                  }}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-card-foreground transition"
                >
                  Restaurar
                </button>
                <button
                  onClick={() => setOrdering(false)}
                  className="rounded bg-accent p-1 text-card-foreground hover:bg-accent/80"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          )
        ) : (
          <button
            onClick={() => setOrdering(true)}
            title="Organizar menu"
            className={cn("flex items-center text-[11px] font-semibold text-muted-foreground hover:text-card-foreground transition", mini ? "justify-center w-full" : "gap-1.5")}
          >
            <ListOrdered className={cn("size-3.5", mini && "size-4")} /> {!mini && "ORGANIZAR MENU"}
          </button>
        )}
      </div>

      <nav className={cn("mt-1 flex-1 space-y-1 overflow-y-auto", ordering && "touch-none")}>
        {order
          .map((path) => NAV.find((item) => item.to === path))
          .filter((item): item is (typeof NAV)[number] => item !== undefined)
          .filter(item => !('adminOnly' in item) || user?.role === 'admin')
          .filter(item => !('platformAdminOnly' in item) || user?.isPlatformAdmin)
          .map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
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
                "relative group rounded-lg",
                draggedItem === item.to && "opacity-50",
                dragOverItem === item.to && dragOverItem !== draggedItem && "bg-brand/10 border border-brand/30"
              )}
            >
              {ordering && (
                <div className={cn(
                  "absolute top-1/2 -translate-y-1/2 z-10 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-card-foreground",
                  mini ? "left-[2px]" : "left-1"
                )}>
                  <GripVertical className={cn("size-3.5", mini && "size-3")} />
                </div>
              )}
              <Link
                to={item.to as any}
                onClick={(e) => {
                  if (ordering) {
                    e.preventDefault();
                    return;
                  }
                  setMenuOpen(false);
                }}
                title={item.label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition relative",
                  mini && "justify-center px-0",
                  active
                    ? "bg-accent font-medium text-card-foreground"
                    : "text-muted-foreground hover:bg-accent/60",
                  ordering && !mini && "pl-8",
                  ordering && mini && "pl-3"
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-4", active ? "text-brand" : "")} />
                  {mini && item.to === "/notificacoes" && unread > 0 ? (
                    <span className="absolute -top-1.5 -right-2 grid size-4 place-items-center rounded-full bg-rose text-[9px] font-bold text-primary-foreground">
                      {unread}
                    </span>
                  ) : null}
                </span>
                {mini ? null : <span className="truncate">{item.label}</span>}
                {!mini && item.to === "/notificacoes" && unread > 0 ? (
                  <span className="ml-auto grid size-5 place-items-center rounded-full bg-rose text-[10px] font-bold text-primary-foreground">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          "mt-4 flex items-center gap-3 rounded-xl border border-border bg-ink-2/60 p-3",
          mini && "flex-col gap-2 p-2",
        )}
      >
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-violet/20 font-display text-xs font-semibold text-violet">
          {initials(user?.name)}
        </div>
        {mini ? null : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-card-foreground">{user?.name ?? "—"}</p>
            <p className="truncate text-[11px] text-muted-foreground capitalize">
              {user?.role === "admin" ? "Administrador" : "Vendedor"}
            </p>
          </div>
        )}
        <button
          aria-label="Sair"
          title="Sair"
          onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/auth" });
          }}
          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>
    </div>
  );

  const sidebar = buildSidebar(false);

  return (
    <div className="relative min-h-screen bg-ink text-foreground">
      <AuroraBackdrop />

      <div className="relative z-10 mx-auto flex max-w-[1560px] gap-6 px-3 py-4 sm:px-6 sm:py-6">
        <aside
          className={cn(
            "sticky top-6 hidden h-[calc(100vh-3rem)] shrink-0 transition-all duration-200 lg:block",
            collapsed ? "w-[4.5rem]" : "w-60",
          )}
        >
          {collapsed ? buildSidebar(true) : sidebar}
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm lg:hidden">
            <div className="h-full w-[17rem] p-3">{sidebar}</div>
            <button
              aria-label="Fechar menu"
              className="flex-1"
              onClick={() => setMenuOpen(false)}
            />
          </div>
        ) : null}

        <main className="min-w-0 flex-1 space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Abrir menu"
                onClick={() => setMenuOpen(true)}
                className="glass grid size-10 shrink-0 place-items-center rounded-xl lg:hidden"
              >
                {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
              <button
                aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
                title={collapsed ? "Expandir menu" : "Minimizar menu"}
                onClick={toggleCollapsed}
                className="glass hidden size-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:text-card-foreground lg:grid"
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </button>
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-semibold text-card-foreground">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void navigate({ to: "/leads", search: { q: search } as never });
                }}
                className="glass hidden items-center gap-2 rounded-xl px-3 py-2 md:flex"
              >
                <Search className="size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-44 bg-transparent text-sm text-card-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="CNPJ, empresa, contato..."
                />
              </form>
              <ThemeToggle />
              <Link
                to="/notificacoes"
                aria-label="Notificações"
                className="glass relative grid size-10 place-items-center rounded-xl"
              >
                <Bell className="size-4 text-muted-foreground" />
                {unread > 0 ? (
                  <span className="absolute top-2 right-2 size-2 rounded-full bg-rose" />
                ) : null}
              </Link>
              {actions}
            </div>
          </header>

          {children}
        </main>
      </div>

    </div>
  );
}
