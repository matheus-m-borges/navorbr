import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  BarChart3,
  Receipt,
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

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro | Navor EngHub" },
      { name: "description", content: "Financeiro consolidado das obras e da construtora." },
    ],
  }),
  component: EngHubFinanceiro,
});

export function EngHubFinanceiro() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Materiais");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["enghub_financial_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enghub_projects")
        .select("*, enghub_clients(name)")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Aviso ao carregar projetos do enghub:", error);
        return [];
      }
      return data || [];
    },
  });

  const totals = useMemo(() => {
    let contractTotal = 0;
    let expectedCostTotal = 0;
    let actualCostTotal = 0;

    projects.forEach((p: any) => {
      contractTotal += Number(p.contract_value || 0);
      expectedCostTotal += Number(p.expected_cost || 0);
      actualCostTotal += Number(p.actual_cost || 0);
    });

    const projectedProfit = contractTotal - actualCostTotal;
    const profitMargin =
      contractTotal > 0 ? (projectedProfit / contractTotal) * 100 : 0;
    const budgetVariance =
      expectedCostTotal > 0
        ? ((actualCostTotal - expectedCostTotal) / expectedCostTotal) * 100
        : 0;

    return {
      contractTotal,
      expectedCostTotal,
      actualCostTotal,
      projectedProfit,
      profitMargin,
      budgetVariance,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (filterStatus === "all") return projects;
    return projects.filter((p: any) => p.status === filterStatus);
  }, [projects, filterStatus]);

  const handleAddExpense = async () => {
    if (!selectedProjectId) {
      toast.error("Selecione a obra de destino.");
      return;
    }
    const val = parseFloat(expenseAmount.replace(",", "."));
    if (!val || val <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    try {
      const targetProj = projects.find((p: any) => p.id === selectedProjectId);
      const currentActual = Number(targetProj?.actual_cost || 0);
      const newActual = currentActual + val;

      const { error } = await supabase
        .from("enghub_projects")
        .update({ actual_cost: newActual })
        .eq("id", selectedProjectId);

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["enghub_financial_projects"] });
      toast.success("Despesa/Aporte lançado com sucesso na obra!");
      setIsExpenseModalOpen(false);
      setExpenseDescription("");
      setExpenseAmount("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar lançamento financeiro.");
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  return (
    <EngHubAppShell
      title="Financeiro"
      subtitle="Controle orçamentário consolidado, custos realizados e margem operacional das obras"
      actions={
        <div className="flex items-center gap-2">
          <PrimaryButton
            onClick={() => setIsExpenseModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            Lançar Despesa de Obra
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Valor Total em Contratos
              </span>
              <DollarSign className="size-4 text-amber-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-display text-white">
                {formatCurrency(totals.contractTotal)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {projects.length} obras cadastradas
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Orçamento Previsto (Capex)
              </span>
              <Receipt className="size-4 text-blue-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-display text-white">
                {formatCurrency(totals.expectedCostTotal)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Teto planejado de custos diretos
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Custo Realizado Acumulado
              </span>
              <TrendingDown className="size-4 text-rose-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-display text-rose-400">
                {formatCurrency(totals.actualCostTotal)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Despesas de materiais, mão de obra e locações
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Margem Bruta Projetada
              </span>
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-display text-emerald-400">
                {formatCurrency(totals.projectedProfit)}
              </div>
              <div className="text-[11px] text-emerald-500 font-semibold mt-0.5">
                {totals.profitMargin.toFixed(1)}% de margem operacional
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Filtrar por Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground cursor-pointer"
            >
              <option value="all">Todas as Obras ({projects.length})</option>
              <option value="planejamento">Planejamento</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluida">Concluída</option>
              <option value="pausada">Pausada</option>
            </select>
          </div>
        </div>

        {/* Projects Financial Table */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-card/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Obra / Empreendimento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Contrato (R$)</th>
                  <th className="px-4 py-3 text-right">Orçado (R$)</th>
                  <th className="px-4 py-3 text-right">Realizado (R$)</th>
                  <th className="px-4 py-3 text-right">Saldo Restante</th>
                  <th className="px-4 py-3 text-center">% Consumido</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando dados financeiros das obras...
                    </td>
                  </tr>
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma obra encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p: any) => {
                    const contract = Number(p.contract_value || 0);
                    const expected = Number(p.expected_cost || 0);
                    const actual = Number(p.actual_cost || 0);
                    const remainingBudget = expected - actual;
                    const pctConsumed = expected > 0 ? (actual / expected) * 100 : 0;
                    const isOverBudget = actual > expected && expected > 0;

                    return (
                      <tr key={p.id} className="hover:bg-card/40 transition">
                        <td className="px-4 py-3">
                          <Link
                            to="/enghub/obras/$obraId"
                            params={{ obraId: p.id }}
                            className="font-bold text-white hover:text-amber-400 transition"
                          >
                            {p.name}
                          </Link>
                          {p.enghub_clients?.name && (
                            <div className="text-[11px] text-muted-foreground">
                              Cliente: {p.enghub_clients.name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              p.status === "concluida"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : p.status === "em_andamento"
                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}
                          >
                            {p.status || "planejamento"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">
                          {formatCurrency(contract)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                          {formatCurrency(expected)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-rose-400">
                          {formatCurrency(actual)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            remainingBudget >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatCurrency(remainingBudget)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 h-2 rounded-full bg-border overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isOverBudget ? "bg-rose-500" : "bg-amber-500"
                                }`}
                                style={{ width: `${Math.min(pctConsumed, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`text-[10px] font-bold ${
                                isOverBudget ? "text-rose-400" : "text-muted-foreground"
                              }`}
                            >
                              {pctConsumed.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            to="/enghub/obras/$obraId"
                            params={{ obraId: p.id }}
                            className="rounded px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-400/10 transition"
                          >
                            Ver Obra
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Modal: Lançar Despesa */}
        <Modal
          open={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          title="Lançar Custo / Despesa na Obra"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Selecione a Obra de Destino:
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
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
                Categoria de Custo:
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
              >
                <option value="Materiais">Materiais de Construção</option>
                <option value="MaoDeObra">Mão de Obra e Empreiteiros</option>
                <option value="Equipamentos">Locação de Máquinas e Andaimes</option>
                <option value="Projetos">Projetos Complementares e Licenças</option>
                <option value="Outros">Outras Despesas Operacionais</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Descrição do Lançamento:
              </label>
              <TextInput
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="Ex: Pagamento 1ª Parcela Concretagem / Compra de Cimento"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Valor (R$):
              </label>
              <TextInput
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <GhostButton onClick={() => setIsExpenseModalOpen(false)}>
                Cancelar
              </GhostButton>
              <PrimaryButton onClick={handleAddExpense}>
                Confirmar Lançamento
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      </div>
    </EngHubAppShell>
  );
}
