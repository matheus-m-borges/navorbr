import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  HardHat,
  ShieldCheck,
  Phone,
  MessageCircle,
  Plus,
  Building2,
  Filter,
  CheckCircle2,
  AlertTriangle,
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
import { whatsappLink } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/(enghub)/enghub/pessoas")({
  head: () => ({
    meta: [
      { title: "Equipe e Pessoas | Navor EngHub" },
      { name: "description", content: "Gestão de colaboradores, encarregados e empreiteiros das obras." },
    ],
  }),
  component: EngHubPessoas,
});

export interface WorkerItem {
  id: string;
  name: string;
  role: string;
  projectName: string;
  phone?: string;
  document?: string;
  status: "Ativo" | "Em Férias" | "Desligado";
  nrStatus: "Conforme" | "Pendente Renovação";
}

const STORAGE_KEY = "navor_enghub_workers_list";

const INITIAL_WORKERS: WorkerItem[] = [
  {
    id: "wrk-1",
    name: "Eng. Roberto Albuquerque",
    role: "Engenheiro Residente (CREA-MG)",
    projectName: "Residencial Jardins das Palmeiras",
    phone: "(31) 99842-1102",
    document: "CREA 142.859/D",
    status: "Ativo",
    nrStatus: "Conforme",
  },
  {
    id: "wrk-2",
    name: "Valdir dos Santos",
    role: "Mestre de Obras Geral",
    projectName: "Residencial Jardins das Palmeiras",
    phone: "(31) 98711-4520",
    document: "CPF ***.482.106-**",
    status: "Ativo",
    nrStatus: "Conforme",
  },
  {
    id: "wrk-3",
    name: "Carlos Eduardo Menezes",
    role: "Encarregado de Armação e Formas",
    projectName: "Edifício Horizon Corporate",
    phone: "(31) 99120-7733",
    document: "CPF ***.192.836-**",
    status: "Ativo",
    nrStatus: "Conforme",
  },
  {
    id: "wrk-4",
    name: "Silva & Filhos Instalações Hidráulicas",
    role: "Empreiteiro Terceirizado",
    projectName: "Edifício Horizon Corporate",
    phone: "(31) 98450-9900",
    document: "CNPJ 24.891.0001/90",
    status: "Ativo",
    nrStatus: "Conforme",
  },
];

export function EngHubPessoas() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("Pedreiro / Oficial");
  const [formProject, setFormProject] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDocument, setFormDocument] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["enghub_workers_projects"],
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
        setWorkers(JSON.parse(saved));
      } else {
        setWorkers(INITIAL_WORKERS);
      }
    } catch (e) {
      setWorkers(INITIAL_WORKERS);
    }
  }, []);

  const saveToStorage = (updated: WorkerItem[]) => {
    setWorkers(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAddWorker = () => {
    if (!formName.trim()) {
      toast.error("Informe o nome do colaborador.");
      return;
    }

    const newWorker: WorkerItem = {
      id: "wrk-" + Date.now(),
      name: formName.trim(),
      role: formRole,
      projectName: formProject || "Obra Geral",
      phone: formPhone.trim() || undefined,
      document: formDocument.trim() || undefined,
      status: "Ativo",
      nrStatus: "Conforme",
    };

    saveToStorage([newWorker, ...workers]);
    setIsModalOpen(false);
    setFormName("");
    setFormPhone("");
    setFormDocument("");
    toast.success("Colaborador cadastrado na equipe com sucesso!");
  };

  const filtered = useMemo(() => {
    if (filterProject === "all") return workers;
    return workers.filter((w) => w.projectName === filterProject);
  }, [workers, filterProject]);

  const metrics = useMemo(() => {
    const total = workers.length;
    const ativos = workers.filter((w) => w.status === "Ativo").length;
    const conformes = workers.filter((w) => w.nrStatus === "Conforme").length;
    return { total, ativos, conformes };
  }, [workers]);

  return (
    <EngHubAppShell
      title="Equipe & Pessoas"
      subtitle="Quadro de mão de obra direta, mestres de obra, engenheiros e empreiteiros"
      actions={
        <PrimaryButton
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Cadastrar Colaborador
        </PrimaryButton>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
              <Users className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-white">{metrics.total}</div>
              <div className="text-[11px] text-muted-foreground">Efetivo Cadastrado</div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <HardHat className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-emerald-400">{metrics.ativos}</div>
              <div className="text-[11px] text-muted-foreground">Trabalhando em Campo</div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="text-xl font-bold font-display text-blue-400">100%</div>
              <div className="text-[11px] text-muted-foreground">Conformidade NR-18 / NR-35</div>
            </div>
          </GlassCard>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Filtrar por Obra:</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground cursor-pointer"
          >
            <option value="all">Todas as Obras ({workers.length} pessoas)</option>
            {projects.map((p: any) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Workers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((worker) => (
            <GlassCard key={worker.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">{worker.name}</h4>
                  <div className="text-xs text-amber-400 font-semibold">{worker.role}</div>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  {worker.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-amber-500" />
                  <span>{worker.projectName}</span>
                </div>
                {worker.document && (
                  <div className="text-[11px] font-mono text-muted-foreground/80">
                    Doc: {worker.document}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                  <ShieldCheck className="size-3.5" />
                  <span>Segurança: {worker.nrStatus}</span>
                </div>
              </div>

              {worker.phone && (
                <div className="pt-2 flex items-center gap-2">
                  <a
                    href={whatsappLink(worker.phone, "Olá! Contato da gestão de obras Navor EngHub.")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                  >
                    <MessageCircle className="size-3" />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${worker.phone}`}
                    className="inline-flex items-center gap-1 rounded bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
                  >
                    <Phone className="size-3" />
                    Ligar
                  </a>
                </div>
              )}
            </GlassCard>
          ))}
        </div>

        {/* Modal: Adicionar Colaborador */}
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Cadastrar Colaborador / Empreiteiro"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Nome Completo ou Razão Social:
              </label>
              <TextInput
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: João Ferreira / Elétrica Minas Ltda"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Função / Atribuição:
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
              >
                <option value="Engenheiro Residente">Engenheiro Residente</option>
                <option value="Mestre de Obras">Mestre de Obras</option>
                <option value="Técnico em Edificações">Técnico em Edificações</option>
                <option value="Encarregado">Encarregado</option>
                <option value="Pedreiro / Oficial">Pedreiro / Oficial</option>
                <option value="Armador">Armador</option>
                <option value="Carpinteiro">Carpinteiro</option>
                <option value="Eletricista">Eletricista</option>
                <option value="Encanador">Encanador</option>
                <option value="Empreiteiro Terceirizado">Empreiteiro Terceirizado</option>
                <option value="Servente">Servente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Obra Alocada:
              </label>
              <select
                value={formProject}
                onChange={(e) => setFormProject(e.target.value)}
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Telefone / WhatsApp:
                </label>
                <TextInput
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="(31) 99999-9999"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Documento (CPF/CREA):
                </label>
                <TextInput
                  value={formDocument}
                  onChange={(e) => setFormDocument(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <GhostButton onClick={() => setIsModalOpen(false)}>
                Cancelar
              </GhostButton>
              <PrimaryButton onClick={handleAddWorker}>
                Salvar Colaborador
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      </div>
    </EngHubAppShell>
  );
}
