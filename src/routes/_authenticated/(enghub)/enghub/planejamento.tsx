import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  HardHat,
  Layers,
  ChevronRight,
  Filter,
} from "lucide-react";
import { EngHubAppShell } from "@/components/navor-enghub/EngHubAppShell";
import {
  GlassCard,
  PrimaryButton,
  GhostButton,
  TextInput,
  Modal,
} from "@/components/navor-rephub/ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento e Cronograma | Navor EngHub" },
      { name: "description", content: "Cronograma de obras, etapas e entregas da construtora." },
    ],
  }),
  component: EngHubPlanejamento,
});

export function EngHubPlanejamento() {
  const qc = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [newStageStart, setNewStageStart] = useState("");
  const [newStageEnd, setNewStageEnd] = useState("");
  const [newStageExpectedCost, setNewStageExpectedCost] = useState("");

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["enghub_planning_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enghub_projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return [];
      return data || [];
    },
  });

  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["enghub_planning_stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enghub_project_stages")
        .select("*, enghub_projects(name, status)")
        .order("order", { ascending: true });

      if (error) return [];
      return data || [];
    },
  });

  const filteredStages = useMemo(() => {
    if (selectedProjectId === "all") return stages;
    return stages.filter((s: any) => s.project_id === selectedProjectId);
  }, [stages, selectedProjectId]);

  const metrics = useMemo(() => {
    const total = stages.length;
    const completed = stages.filter((s: any) => s.status === "completed" || s.progress_percentage >= 100).length;
    const inProgress = stages.filter((s: any) => s.status === "in_progress" || (s.progress_percentage > 0 && s.progress_percentage < 100)).length;
    const pending = total - completed - inProgress;

    return { total, completed, inProgress, pending };
  }, [stages]);

  const handleUpdateStageProgress = async (stageId: string, newProgress: number) => {
    try {
      const status = newProgress >= 100 ? "completed" : newProgress > 0 ? "in_progress" : "pending";
      const { error } = await supabase
        .from("enghub_project_stages")
        .update({
          progress_percentage: newProgress,
          status,
        })
        .eq("id", stageId);

      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["enghub_planning_stages"] });
      toast.success("Progresso da etapa atualizado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar etapa.");
    }
  };

  const handleAddStage = async () => {
    if (!targetProjectId) {
      toast.error("Selecione a obra de destino.");
      return;
    }
    if (!newStageName.trim()) {
      toast.error("Informe o nome da etapa.");
      return;
    }

    try {
      const cost = parseFloat(newStageExpectedCost.replace(",", ".")) || 0;
      const targetProject = projects.find((project: any) => project.id === targetProjectId);
      if (!targetProject?.account_id) {
        toast.error("Não foi possível identificar a conta desta obra.");
        return;
      }
      const { error } = await supabase
        .from("enghub_project_stages")
        .insert({
          account_id: targetProject.account_id,
          project_id: targetProjectId,
          name: newStageName.trim(),
          start_date: newStageStart || null,
          end_date: newStageEnd || null,
          expected_cost: cost,
          progress_percentage: 0,
          status: "pending",
        });

      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["enghub_planning_stages"] });
      toast.success("Nova etapa adicionada ao cronograma!");
      setIsAddStageModalOpen(false);
      setNewStageName("");
      setNewStageStart("");
      setNewStageEnd("");
      setNewStageExpectedCost("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar etapa.");
    }
  };

  return (
    <EngHubAppShell
      title="Planejamento & Cronograma"
      subtitle="Controle de fases, marcos contratuais e evolução física das obras"
      actions={
        <PrimaryButton
          onClick={() => setIsAddStageModalOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Adicionar Etapa
        </PrimaryButton>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-white">{metrics.total}</div>
              <div className="text-[11px] text-muted-foreground">Etapas Totais</div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
              <Clock className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-blue-400">{metrics.inProgress}</div>
              <div className="text-[11px] text-muted-foreground">Em Andamento</div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-emerald-400">{metrics.completed}</div>
              <div className="text-[11px] text-muted-foreground">Concluídas</div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/5 text-muted-foreground">
              <HardHat className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-white">{projects.length}</div>
              <div className="text-[11px] text-muted-foreground">Obras Ativas</div>
            </div>
          </GlassCard>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Filtrar por Obra:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground cursor-pointer"
          >
            <option value="all">Todas as Obras ({projects.length})</option>
            {projects.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Timeline / Stages List */}
        {filteredStages.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <CalendarDays className="size-10 mx-auto text-muted-foreground mb-3 opacity-60" />
            <h3 className="text-lg font-bold text-white">Nenhuma etapa cadastrada</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Estruture o cronograma de suas obras definindo etapas como Fundação, Estrutura, Alvenaria e Acabamentos.
            </p>
            <PrimaryButton
              onClick={() => setIsAddStageModalOpen(true)}
              className="mt-4 mx-auto"
            >
              Criar Primeira Etapa
            </PrimaryButton>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {filteredStages.map((stage: any, index: number) => {
              const pct = Number(stage.progress_percentage || 0);

              return (
                <GlassCard key={stage.id} className="p-4 transition hover:border-amber-500/40">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded bg-card border border-border text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <h4 className="text-sm font-bold text-white">{stage.name}</h4>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            stage.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : stage.status === "in_progress"
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-white/5 text-muted-foreground"
                          }`}
                        >
                          {stage.status === "completed"
                            ? "Concluída"
                            : stage.status === "in_progress"
                            ? "Em Execução"
                            : "Pendente"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground ml-8">
                        {stage.enghub_projects?.name && (
                          <span className="text-amber-400 font-semibold">
                            Obra: {stage.enghub_projects.name}
                          </span>
                        )}
                        {(stage.start_date || stage.end_date) && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            {stage.start_date || "Início"} até {stage.end_date || "Prazo"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Slider & Controls */}
                    <div className="flex items-center gap-4 ml-8 md:ml-0">
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Avanço Físico</span>
                          <span className="font-bold text-amber-400">{pct}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={pct}
                          onChange={(e) =>
                            handleUpdateStageProgress(stage.id, parseInt(e.target.value))
                          }
                          className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <button
                        onClick={() => handleUpdateStageProgress(stage.id, pct >= 100 ? 0 : 100)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                          pct >= 100
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-card border border-border text-muted-foreground hover:text-white"
                        }`}
                      >
                        {pct >= 100 ? "Concluída ✓" : "Concluir"}
                      </button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}

        {/* Modal: Adicionar Etapa */}
        <Modal
          open={isAddStageModalOpen}
          onClose={() => setIsAddStageModalOpen(false)}
          title="Nova Etapa no Cronograma"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Obra de Destino:
              </label>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
              >
                <option value="">Selecione uma obra...</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Nome da Etapa:
              </label>
              <TextInput
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Ex: Fundação e Estaqueamento / Alvenaria Estrutural"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Data de Início:
                </label>
                <TextInput
                  type="date"
                  value={newStageStart}
                  onChange={(e) => setNewStageStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Previsão de Término:
                </label>
                <TextInput
                  type="date"
                  value={newStageEnd}
                  onChange={(e) => setNewStageEnd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Custo Orçado para a Etapa (R$):
              </label>
              <TextInput
                value={newStageExpectedCost}
                onChange={(e) => setNewStageExpectedCost(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <GhostButton onClick={() => setIsAddStageModalOpen(false)}>
                Cancelar
              </GhostButton>
              <PrimaryButton onClick={handleAddStage}>
                Salvar Etapa
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      </div>
    </EngHubAppShell>
  );
}
