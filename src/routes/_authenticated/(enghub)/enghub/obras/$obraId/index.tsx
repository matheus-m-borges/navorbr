import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PrimaryButton } from "@/components/navor-rephub/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  HardHat,
  Calendar,
  Plus,
  Sun,
  ClipboardList,
  Wallet,
  FileText,
  MapPin,
  Clock,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { DiarioObraRdoManager } from "@/components/navor-enghub/DiarioObraRdoManager";
import { BoletimMedicaoManager } from "@/components/navor-enghub/BoletimMedicaoManager";

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/obras/$obraId/")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : "resumo",
  }),
  component: ObraWorkspaceView,
});

function ObraWorkspaceView() {
  const { obraId } = Route.useParams();
  const { tab = "resumo" } = Route.useSearch();
  const activeTab = (tab || "resumo") as
    | "resumo"
    | "cronograma"
    | "diario"
    | "medicoes"
    | "financeiro"
    | "documentos";
  const queryClient = useQueryClient();

  // Obra Query
  const { data: obraData } = useQuery({
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

  const obra = obraData;

  // Etapas Query
  const { data: stages = [], isLoading: stagesLoading } = useQuery({
    queryKey: ["enghub_project_stages", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enghub_project_stages")
        .select("*")
        .eq("project_id", obraId)
        .order("start_date", { ascending: true });

      if (error) {
        console.warn("Erro ao carregar etapas:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!obraId,
  });

  // Formulário Nova Etapa
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageCost, setNewStageCost] = useState("");
  const [newStageStart, setNewStageStart] = useState("");
  const [newStageEnd, setNewStageEnd] = useState("");
  const [isSubmittingStage, setIsSubmittingStage] = useState(false);

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim() || !obra?.account_id) {
      toast.error("Informe o nome da etapa.");
      return;
    }

    setIsSubmittingStage(true);
    try {
      const cost = parseFloat(newStageCost.replace(",", ".")) || 0;
      const { error } = await supabase.from("enghub_project_stages").insert({
        account_id: obra.account_id,
        project_id: obraId,
        name: newStageName.trim(),
        expected_cost: cost,
        start_date: newStageStart || null,
        end_date: newStageEnd || null,
        status: "pending",
        progress_percentage: 0,
      });

      if (error) throw error;

      toast.success("Etapa adicionada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["enghub_project_stages", obraId] });
      setIsAddingStage(false);
      setNewStageName("");
      setNewStageCost("");
      setNewStageStart("");
      setNewStageEnd("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar etapa.");
    } finally {
      setIsSubmittingStage(false);
    }
  };

  if (!obra) return null;

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. ABA RESUMO & KPIS                                     */}
      {/* ======================================================== */}
      {activeTab === "resumo" && (
        <div className="grid gap-6">
          {/* Cards Financeiros Principais */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GlassCard className="p-5 flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Valor Contratado
              </span>
              <div className="flex items-center gap-2">
                <DollarSign className="size-5 text-emerald-400" />
                <span className="font-display text-2xl font-bold text-white">
                  R$ {Number(obra.contract_value || 0).toLocaleString("pt-BR")}
                </span>
              </div>
            </GlassCard>

            <GlassCard className="p-5 flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Custo Previsto
              </span>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-gold" />
                <span className="font-display text-2xl font-bold text-white">
                  R$ {Number(obra.expected_cost || 0).toLocaleString("pt-BR")}
                </span>
              </div>
            </GlassCard>

            <GlassCard className="p-5 flex flex-col gap-2 border-red-500/20">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-red-400/80">
                Custo Realizado
              </span>
              <div className="flex items-center gap-2">
                <AlertCircle className="size-5 text-red-500" />
                <span className="font-display text-2xl font-bold text-red-500">
                  R$ {Number(obra.actual_cost || 0).toLocaleString("pt-BR")}
                </span>
              </div>
            </GlassCard>

            <GlassCard className="p-5 flex flex-col gap-2 bg-emerald-500/5">
              <span className="text-sm font-medium text-emerald-500/80 uppercase tracking-wider">
                Progresso Físico
              </span>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                <span className="font-display text-2xl font-bold text-emerald-400">
                  {Number(obra.progress_percentage || 0)}%
                </span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-1 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${obra.progress_percentage || 0}%` }}
                />
              </div>
            </GlassCard>
          </div>

          {/* Informações Cadastrais e Cronograma Resumo */}
          <div className="grid gap-6 lg:grid-cols-3">
            <GlassCard className="p-6 lg:col-span-1 flex flex-col gap-4">
              <h3 className="font-display font-bold text-white mb-2">Informações da Obra</h3>

              <div>
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-1">
                  Endereço
                </span>
                <span className="text-sm text-white font-medium">
                  {obra.address || "Não informado"}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-1">
                  Tipo
                </span>
                <span className="text-sm text-white font-medium">{obra.type || "Não informado"}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-1">
                  Início
                </span>
                <span className="text-sm text-white font-medium">
                  {obra.start_date
                    ? new Date(obra.start_date).toLocaleDateString("pt-BR")
                    : "Não informado"}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-1">
                  Engenheiro / Mestre de Obra
                </span>
                <span className="text-sm text-white font-medium flex items-center gap-2">
                  <HardHat className="size-4 text-gold" />
                  Eng. Responsável Técnico
                </span>
              </div>
            </GlassCard>

            <GlassCard className="p-6 lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-white">Etapas Recentes do Canteiro</h3>
                  <span className="text-xs text-gold font-bold">{stages.length} fases</span>
                </div>

                {stages.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="size-10 text-gold opacity-50 mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">Nenhuma etapa cadastrada ainda</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Acesse a aba Cronograma para planejar as fases da obra.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stages.slice(0, 4).map((s: any) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-lg border border-white/5 bg-white/5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white block">{s.name}</span>
                          <span className="text-muted-foreground">
                            {s.start_date ? new Date(s.start_date).toLocaleDateString("pt-BR") : "--"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gold font-bold">
                            R$ {Number(s.expected_cost || 0).toLocaleString("pt-BR")}
                          </span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 font-bold text-white">
                            {s.progress_percentage || 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. ABA CRONOGRAMA & FASES                                */}
      {/* ======================================================== */}
      {activeTab === "cronograma" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg text-white">Fases do Cronograma</h3>
              <p className="text-xs text-muted-foreground">
                Planejamento e evolução física das etapas contratuais
              </p>
            </div>
            <button
              onClick={() => setIsAddingStage(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3.5 py-1.5 text-xs font-bold text-background hover:bg-yellow-400 transition"
            >
              <Plus className="size-4" /> Nova Etapa
            </button>
          </div>

          {isAddingStage && (
            <GlassCard className="p-4 border-gold/40">
              <form onSubmit={handleCreateStage} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold">
                  Cadastrar Etapa na Obra
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      required
                      placeholder="Nome da fase (ex: Fundação e Baldrame)"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Custo Previsto (R$)"
                      value={newStageCost}
                      onChange={(e) => setNewStageCost(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-gold focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSubmittingStage}
                      className="flex-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-background hover:bg-yellow-400 transition"
                    >
                      {isSubmittingStage ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingStage(false)}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            </GlassCard>
          )}

          <div className="space-y-3">
            {stages.map((st: any) => (
              <GlassCard key={st.id} className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-white">{st.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    Período: {st.start_date ? new Date(st.start_date).toLocaleDateString("pt-BR") : "--"} a{" "}
                    {st.end_date ? new Date(st.end_date).toLocaleDateString("pt-BR") : "--"}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Custo Previsto
                    </span>
                    <span className="text-xs font-bold text-gold">
                      R$ {Number(st.expected_cost || 0).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                    {st.progress_percentage || 0}%
                  </span>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ABA DIÁRIO DE OBRA (RDO)                              */}
      {/* ======================================================== */}
      {activeTab === "diario" && (
        <DiarioObraRdoManager obraId={obraId} obraName={obra.name} stages={stages} />
      )}

      {/* ======================================================== */}
      {/* 4. ABA BOLETINS DE MEDIÇÃO                               */}
      {/* ======================================================== */}
      {activeTab === "medicoes" && (
        <BoletimMedicaoManager obraId={obraId} obraName={obra.name} stages={stages} />
      )}

      {/* ======================================================== */}
      {/* 4. ABA FINANCEIRO DA OBRA                                */}
      {/* ======================================================== */}
      {activeTab === "financeiro" && (
        <div className="space-y-4">
          <h3 className="font-display font-bold text-lg text-white">Detalhamento de Custos</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <GlassCard className="p-4">
              <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">
                Materiais Comprados
              </span>
              <span className="text-xl font-bold font-display text-white">R$ 184.200,00</span>
            </GlassCard>
            <GlassCard className="p-4">
              <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">
                Empreiteiros & Mão de Obra
              </span>
              <span className="text-xl font-bold font-display text-white">R$ 142.500,00</span>
            </GlassCard>
            <GlassCard className="p-4">
              <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">
                Equipamentos & Máquinas
              </span>
              <span className="text-xl font-bold font-display text-white">R$ 28.900,00</span>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ABA DOCUMENTOS & LICENÇAS                             */}
      {/* ======================================================== */}
      {activeTab === "documentos" && (
        <div className="space-y-4">
          <h3 className="font-display font-bold text-lg text-white">Documentos Técnicos e Alvarás</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <GlassCard className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="size-6 text-gold" />
                <div>
                  <span className="font-bold text-sm text-white block">Projeto Arquitetônico Executivo</span>
                  <span className="text-xs text-muted-foreground">PDF • Aprovado pela Prefeitura</span>
                </div>
              </div>
              <button className="text-xs text-gold font-bold hover:underline">Download</button>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="size-6 text-emerald-400" />
                <div>
                  <span className="font-bold text-sm text-white block">ART / RRT de Execução</span>
                  <span className="text-xs text-muted-foreground">CREA/CAU • Vigente</span>
                </div>
              </div>
              <button className="text-xs text-gold font-bold hover:underline">Download</button>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
