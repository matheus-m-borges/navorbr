import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Building2, CreditCard, Users, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/(saas)/minha-conta")({
  component: SubscriberPortalLayout,
});

const PORTAL_NAV = [
  { to: "/minha-conta", label: "Minha Empresa", icon: Building2 },
  { to: "/minha-conta/faturas", label: "Faturas", icon: CreditCard },
  { to: "/minha-conta/equipe", label: "Equipe", icon: Users },
  { to: "/minha-conta/configuracoes", label: "Configurações", icon: Settings },
];

function SubscriberPortalLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-bold shadow-md">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">Portal do Assinante</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua empresa, faturas e equipe.</p>
        </div>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {PORTAL_NAV.map((item) => {
          const active = pathname === item.to || (item.to !== "/minha-conta" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}

