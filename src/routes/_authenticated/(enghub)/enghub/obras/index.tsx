import { createFileRoute, Link } from "@tanstack/react-router";
import { EngHubAppShell } from "@/components/navor-enghub/EngHubAppShell";
import { GlassCard, PrimaryButton } from "@/components/navor-rephub/ui";
import { Plus, HardHat, Calendar, DollarSign, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/obras/")({
  component: ObrasList,
});

function ObrasList() {
  const { data: obras, isLoading } = useQuery({
    queryKey: ["enghub_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enghub_projects")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <EngHubAppShell
      title="Obras"
      subtitle="Gerencie todos os seus projetos de construção"
      actions={
        <Link to="/enghub/obras/novo">
          <PrimaryButton>
            <Plus className="mr-2 size-4" />
            Nova Obra
          </PrimaryButton>
        </Link>
      }
    >
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <span className="text-muted-foreground animate-pulse">Carregando obras...</span>
        </div>
      ) : obras?.length === 0 ? (
        <GlassCard className="p-12 flex flex-col items-center justify-center text-center">
          <div className="grid size-20 place-items-center rounded-full bg-gold/10 text-gold mb-6">
            <HardHat className="size-10" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white">Nenhuma obra cadastrada</h2>
          <p className="mt-2 text-muted-foreground max-w-md">
            Comece cadastrando sua primeira obra para controlar cronograma, financeiro e equipe em um só lugar.
          </p>
          <Link to="/enghub/obras/novo" className="mt-8">
            <PrimaryButton>Cadastrar Primeira Obra</PrimaryButton>
          </Link>
        </GlassCard>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {obras?.map((obra) => (
            <Link key={obra.id} to="/enghub/obras/$obraId" params={{ obraId: obra.id }} className="group outline-none">
              <GlassCard className="h-full flex flex-col transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_20px_rgba(255,215,0,0.1)] group-focus-visible:ring-2 group-focus-visible:ring-gold overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-gold to-yellow-600 w-full" />
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-white/10 uppercase tracking-wider">
                      {obra.status}
                    </span>
                    <span className="text-xs font-bold text-gold">{obra.progress_percentage}% Concluído</span>
                  </div>
                  
                  <h3 className="font-display text-xl font-bold text-white mb-2 line-clamp-2">{obra.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <MapPin className="size-3.5" />
                    <span className="truncate">{obra.address || "Sem endereço"}</span>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">Custo Previsto</span>
                      <div className="flex items-center gap-1.5 text-white font-medium">
                        <DollarSign className="size-3.5 text-gold" />
                        R$ {Number(obra.expected_cost || 0).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">Fim Previsto</span>
                      <div className="flex items-center gap-1.5 text-white font-medium">
                        <Calendar className="size-3.5 text-gold" />
                        {obra.expected_end_date ? new Date(obra.expected_end_date).toLocaleDateString('pt-BR') : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </EngHubAppShell>
  );
}
