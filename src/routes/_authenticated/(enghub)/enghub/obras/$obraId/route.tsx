import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { EngHubAppShell } from "@/components/navor-enghub/EngHubAppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HardHat, LayoutDashboard, Calendar, ClipboardList, Wallet, FileText, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/obras/$obraId")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : "resumo",
  }),
  component: ObraLayout,
});

function ObraLayout() {
  const { obraId } = Route.useParams();
  const { tab = "resumo" } = Route.useSearch();

  const { data: obra, isLoading } = useQuery({
    queryKey: ["enghub_projects", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enghub_projects")
        .select("*")
        .eq("id", obraId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const TABS = [
    { id: "resumo", label: "Resumo", icon: LayoutDashboard },
    { id: "cronograma", label: "Cronograma", icon: Calendar },
    { id: "diario", label: "Diário de Obra (RDO)", icon: ClipboardList },
    { id: "medicoes", label: "Boletins de Medição", icon: CheckCircle2 },
    { id: "financeiro", label: "Financeiro", icon: Wallet },
    { id: "documentos", label: "Documentos", icon: FileText },
  ] as const;

  if (isLoading) {
    return (
      <EngHubAppShell title="Carregando..." subtitle="Aguarde um momento">
        <div className="flex h-64 items-center justify-center">
          <span className="text-muted-foreground animate-pulse">Carregando dados da obra...</span>
        </div>
      </EngHubAppShell>
    );
  }

  if (!obra) {
    return (
      <EngHubAppShell title="Obra não encontrada" subtitle="O projeto não existe ou você não tem acesso.">
        <div className="text-center py-12">
          <h2 className="text-xl font-bold text-white">Ops, não encontramos esta obra.</h2>
          <Link to="/enghub/obras" className="text-gold mt-4 inline-block hover:underline">Voltar para Obras</Link>
        </div>
      </EngHubAppShell>
    );
  }

  return (
    <EngHubAppShell
      title={obra.name}
      subtitle={`${obra.code ? obra.code + ' • ' : ''}${obra.status.toUpperCase()}`}
    >
      {/* Obra Header Navigation */}
      <div className="mb-6 flex flex-col gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/enghub/obras" className="hover:text-white transition-colors">Obras</Link>
          <ChevronRight className="size-4" />
          <span className="text-white font-medium">{obra.name}</span>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            
            return (
              <Link
                key={t.id}
                to="/enghub/obras/$obraId"
                params={{ obraId }}
                search={{ tab: t.id }}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-gold cursor-pointer",
                  active
                    ? "bg-gold text-background shadow-[0_0_15px_rgba(255,215,0,0.4)] font-bold"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border border-white/5"
                )}
              >
                <Icon className={cn("size-4", active && "drop-shadow-sm")} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Outlet />
      </div>
    </EngHubAppShell>
  );
}
