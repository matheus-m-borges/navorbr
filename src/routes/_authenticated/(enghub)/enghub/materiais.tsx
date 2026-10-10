import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Plus,
  Building2,
  Filter,
  AlertCircle,
  FileSpreadsheet,
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

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/materiais")({
  head: () => ({
    meta: [
      { title: "Materiais e Suprimentos | Navor EngHub" },
      { name: "description", content: "Gestão de insumos, compras e entregas no canteiro de obras." },
    ],
  }),
  component: EngHubMateriais,
});

export interface MaterialItem {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  supplier?: string;
  status: "Pendente" | "Comprado" | "Em Trânsito" | "Entregue";
  requestedDate: string;
  estimatedCost?: number;
}

const STORAGE_KEY = "navor_enghub_materials_catalog";

const INITIAL_MATERIALS: MaterialItem[] = [
  {
    id: "mat-1",
    projectId: "obra-1",
    projectName: "Residencial Jardins das Palmeiras",
    name: "Cimento Portland CP II-F-32 (50kg)",
    category: "Cimento & Argamassa",
    quantity: 150,
    unit: "sacos",
    supplier: "Votorantim Cimentos",
    status: "Entregue",
    requestedDate: "2026-09-18",
    estimatedCost: 5250,
  },
  {
    id: "mat-2",
    projectId: "obra-1",
    projectName: "Residencial Jardins das Palmeiras",
    name: "Aço CA-50 10.0mm (Barra 12m)",
    category: "Aço & Ferro",
    quantity: 80,
    unit: "barras",
    supplier: "Gerdau",
    status: "Em Trânsito",
    requestedDate: "2026-09-22",
    estimatedCost: 6800,
  },
  {
    id: "mat-3",
    projectId: "obra-2",
    projectName: "Edifício Horizon Corporate",
    name: "Areia Média Lavada",
    category: "Agregados",
    quantity: 14,
    unit: "m³",
    supplier: "Areal Paraíba",
    status: "Pendente",
    requestedDate: "2026-09-25",
    estimatedCost: 1820,
  },
  {
    id: "mat-4",
    projectId: "obra-2",
    projectName: "Edifício Horizon Corporate",
    name: "Bloco Cerâmico 14x19x29cm",
    category: "Alvenaria",
    quantity: 2500,
    unit: "unid",
    supplier: "Cerâmica União",
    status: "Comprado",
    requestedDate: "2026-09-24",
    estimatedCost: 4750,
  },
];

export function EngHubMateriais() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [formProjectName, setFormProjectName] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Cimento & Argamassa");
  const [formQuantity, setFormQuantity] = useState("");
  const [formUnit, setFormUnit] = useState("unid");
  const [formSupplier, setFormSupplier] = useState("");
  const [formCost, setFormCost] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["enghub_materials_projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("enghub_projects")
        .select("id, name");
      return data || [];
    },
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMaterials(JSON.parse(saved));
      } else {
        setMaterials(INITIAL_MATERIALS);
      }
    } catch (e) {
      setMaterials(INITIAL_MATERIALS);
    }
  }, []);

  const saveToStorage = (updated: MaterialItem[]) => {
    setMaterials(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleUpdateStatus = (id: string, status: MaterialItem["status"]) => {
    const updated = materials.map((m) => (m.id === id ? { ...m, status } : m));
    saveToStorage(updated);
    toast.success(`Status do material atualizado para '${status}'!`);
  };

  const handleAddMaterial = () => {
    if (!formName.trim()) {
      toast.error("Informe a descrição do material.");
      return;
    }
    const qty = parseFloat(formQuantity) || 1;
    const cost = parseFloat(formCost.replace(",", ".")) || 0;

    const newItem: MaterialItem = {
      id: "mat-" + Date.now(),
      projectId: formProjectName || "obra-geral",
      projectName: formProjectName || "Obra Principal",
      name: formName.trim(),
      category: formCategory,
      quantity: qty,
      unit: formUnit,
      supplier: formSupplier.trim() || undefined,
      status: "Pendente",
      requestedDate: new Date().toISOString().slice(0, 10),
      estimatedCost: cost,
    };

    saveToStorage([newItem, ...materials]);
    setIsModalOpen(false);
    setFormName("");
    setFormQuantity("");
    setFormCost("");
    setFormSupplier("");
    toast.success("Requisição de material cadastrada!");
  };

  const filtered = useMemo(() => {
    return materials.filter((m) => {
      const matchProj = filterProject === "all" || m.projectName === filterProject;
      const matchStat = filterStatus === "all" || m.status === filterStatus;
      return matchProj && matchStat;
    });
  }, [materials, filterProject, filterStatus]);

  const metrics = useMemo(() => {
    const total = materials.length;
    const pendentes = materials.filter((m) => m.status === "Pendente").length;
    const transito = materials.filter((m) => m.status === "Em Trânsito").length;
    const entregues = materials.filter((m) => m.status === "Entregue").length;
    return { total, pendentes, transito, entregues };
  }, [materials]);

  return (
    <EngHubAppShell
      title="Materiais & Suprimentos"
      subtitle="Controle de pedidos de compra, cotações e entregas no canteiro de obras"
      actions={
        <PrimaryButton
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Solicitar Material
        </PrimaryButton>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
              <Package className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-white">{metrics.total}</div>
              <div className="text-[11px] text-muted-foreground">Itens Requisitados</div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/5 text-muted-foreground">
              <Clock className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-white">{metrics.pendentes}</div>
              <div className="text-[11px] text-muted-foreground">Cotações / Pendentes</div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
              <Truck className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-blue-400">{metrics.transito}</div>
              <div className="text-[11px] text-muted-foreground">Em Trânsito / Cargas</div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-emerald-400">{metrics.entregues}</div>
              <div className="text-[11px] text-muted-foreground">Recebidos na Obra</div>
            </div>
          </GlassCard>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="Pendente">Pendente</option>
              <option value="Comprado">Comprado</option>
              <option value="Em Trânsito">Em Trânsito</option>
              <option value="Entregue">Entregue</option>
            </select>
          </div>
        </div>

        {/* Materials Table */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-card/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Insumo / Material</th>
                  <th className="px-4 py-3">Obra de Destino</th>
                  <th className="px-4 py-3 text-right">Qtd. Solicitada</th>
                  <th className="px-4 py-3">Fornecedor</th>
                  <th className="px-4 py-3 text-center">Status de Envio</th>
                  <th className="px-4 py-3 text-right">Custo Est. (R$)</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((mat) => (
                  <tr key={mat.id} className="hover:bg-card/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{mat.name}</div>
                      <div className="text-[10px] text-muted-foreground">{mat.category}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {mat.projectName}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      {mat.quantity} {mat.unit}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {mat.supplier || "A Cotar"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          mat.status === "Entregue"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : mat.status === "Em Trânsito"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : mat.status === "Comprado"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-white/5 text-muted-foreground border border-white/10"
                        }`}
                      >
                        {mat.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      {mat.estimatedCost
                        ? new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(mat.estimatedCost)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={mat.status}
                        onChange={(e) =>
                          handleUpdateStatus(mat.id, e.target.value as any)
                        }
                        className="rounded border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer"
                      >
                        <option value="Pendente">Pendente</option>
                        <option value="Comprado">Comprado</option>
                        <option value="Em Trânsito">Em Trânsito</option>
                        <option value="Entregue">Entregue</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Modal: Solicitar Material */}
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Nova Requisição de Material"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Obra de Destino:
              </label>
              <select
                value={formProjectName}
                onChange={(e) => setFormProjectName(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
              >
                <option value="">Selecione uma obra...</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Descrição do Insumo / Material:
              </label>
              <TextInput
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Tinta Acrílica Fosca Branco Neve (18L)"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Quantidade:
                </label>
                <TextInput
                  type="number"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                  placeholder="Ex: 20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Unidade:
                </label>
                <select
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
                >
                  <option value="unid">Unidades</option>
                  <option value="sacos">Sacos</option>
                  <option value="m³">m³ (Metros cúbicos)</option>
                  <option value="m²">m² (Metros quadrados)</option>
                  <option value="barras">Barras</option>
                  <option value="latas">Latas / Baldes</option>
                  <option value="kg">kg (Quilos)</option>
                  <option value="ton">Toneladas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Fornecedor / Loja Sugerida:
              </label>
              <TextInput
                value={formSupplier}
                onChange={(e) => setFormSupplier(e.target.value)}
                placeholder="Ex: Leroy Merlin, Votorantim, Depósito Central"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Valor Total Estimado (R$):
              </label>
              <TextInput
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <GhostButton onClick={() => setIsModalOpen(false)}>
                Cancelar
              </GhostButton>
              <PrimaryButton onClick={handleAddMaterial}>
                Cadastrar Requisição
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      </div>
    </EngHubAppShell>
  );
}
