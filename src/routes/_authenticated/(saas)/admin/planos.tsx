import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, Button, Input } from "@/components/navor-rephub/ui";
import {
  Plus,
  LayoutGrid,
  CreditCard,
  Check,
  Package,
  HardHat,
  Scale,
  Scissors,
  PawPrint,
  Sparkles,
  Zap,
  RotateCw,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createPlan,
  updatePlan,
  deletePlan,
  createSystemModule,
  syncCanonicalProductsModulesPlans,
  getAdminPlansData,
} from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/planos")({
  component: AdminPlanosPage,
});

type SystemType = "rephub" | "enghub" | "lawhub" | "barberhub" | "pethub" | string;

interface SystemDefinition {
  slug: SystemType;
  name: string;
  icon: typeof Package;
  color: string;
  badgeColor: string;
  defaultModules: { key: string; name: string; description: string }[];
  defaultPlans: {
    name: string;
    description: string;
    amount: number;
    whatsappNumberLimit: number;
    moduleKeys: string[];
  }[];
}

const SYSTEMS: SystemDefinition[] = [
  {
    slug: "pethub",
    name: "PetHub",
    icon: PawPrint,
    color: "from-teal-500 to-emerald-600",
    badgeColor: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    defaultModules: [
      { key: "pet_cadastro", name: "Cadastro de Tutores & Pets", description: "Prontuário individual com raça, peso, alergias e foto" },
      { key: "pet_vacinas", name: "Carteira de Vacinação & Vermífugos", description: "Histórico e alertas automáticos de reforço de doses" },
      { key: "pet_banho_tosa", name: "Fila de Banho e Tosa em Tempo Real", description: "Aguardando > Em Atendimento > Pet Pronto > Retirada" },
      { key: "pet_vet_clinica", name: "Prontuário Clínico & Consultas", description: "Anamnese, prescrição e histórico veterinário" },
      { key: "pet_hotel_creche", name: "Hotel e Creche / Daycare", description: "Check-in, check-out, diárias e pertences" },
      { key: "pet_taxi_dog", name: "Táxi Dog & Leva e Traz", description: "Roteirização e confirmação de transporte" },
      { key: "pet_pdv_rapido", name: "Frente de Caixa e PDV Rápido", description: "Toque rápido, leitor de código de barras e emissão fiscal" },
      { key: "pet_estoque_lotes", name: "Estoque por Loja & Controle de Lotes", description: "Validade de rações, medicamentos e inventário" },
      { key: "pet_entrada_xml", name: "Entrada de Mercadoria por XML", description: "NF-e com workflow de 5 etapas sem erros tributários" },
      { key: "pet_comissoes", name: "Comissões de Tosadores e Profissionais", description: "Cálculo automático por serviço executado" },
      { key: "pet_fidelidade", name: "Clube de Fidelidade e Pontos Pet", description: "Pontuação por compras e resgate de banhos/produtos" },
      { key: "pet_financeiro", name: "Fluxo de Caixa e DRE da Loja", description: "Contas a pagar, receber e conciliação de cartões" },
      { key: "pet_site_online", name: "Vitrine Pública & E-commerce da Loja", description: "Loja virtual por cliente em {loja}.pethub.navorbr.com" },
      { key: "pet_agendamento_online", name: "Agendamento Online pelo Tutor", description: "Reserva direta de banho e tosa pela web" },
      { key: "pet_multi_lojas", name: "Rede de Lojas e Franquias", description: "Gestão centralizada de estoques e filiais" },
    ],
    defaultPlans: [
      {
        name: "Pet Gestão",
        description: "Gestão completa de pet shop, clientes, prontuário de pets, vacinas, agendamentos, PDV físico e estoque",
        amount: 149.90,
        whatsappNumberLimit: 1,
        moduleKeys: ["pet_cadastro", "pet_vacinas", "pet_banho_tosa", "pet_pdv_rapido", "pet_estoque_lotes", "pet_entrada_xml", "pet_comissoes", "pet_financeiro"],
      },
      {
        name: "Pet Gestão + E-commerce",
        description: "Tudo do Pet Gestão + Site público com agendamento online de banho/tosa e loja virtual e-commerce integrada",
        amount: 279.90,
        whatsappNumberLimit: 2,
        moduleKeys: ["pet_cadastro", "pet_vacinas", "pet_banho_tosa", "pet_vet_clinica", "pet_pdv_rapido", "pet_estoque_lotes", "pet_entrada_xml", "pet_comissoes", "pet_fidelidade", "pet_financeiro", "pet_site_online", "pet_agendamento_online"],
      },
      {
        name: "Rede Pet",
        description: "Para redes e franquias. Múltiplas filiais, estoques descentralizados, gestão de subdomínios e relatórios consolidados",
        amount: 499.90,
        whatsappNumberLimit: 5,
        moduleKeys: [
          "pet_cadastro",
          "pet_vacinas",
          "pet_banho_tosa",
          "pet_vet_clinica",
          "pet_hotel_creche",
          "pet_taxi_dog",
          "pet_pdv_rapido",
          "pet_estoque_lotes",
          "pet_entrada_xml",
          "pet_comissoes",
          "pet_fidelidade",
          "pet_financeiro",
          "pet_site_online",
          "pet_agendamento_online",
          "pet_multi_lojas",
        ],
      },
    ],
  },

  {
    slug: "rephub",
    name: "Navor RepHub",
    icon: Package,
    color: "from-cyan-500 to-blue-600",
    badgeColor: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    defaultModules: [
      { key: "crm_leads", name: "Leads e Prospecção", description: "Funil comercial, captação e qualificação de oportunidades" },
      { key: "crm_clientes", name: "Gestão de Clientes", description: "Base cadastral completa, histórico comercial e compras" },
      { key: "crm_marcas", name: "Marcas e Representadas", description: "Catálogos, comissões por fábrica e portfólio" },
      { key: "crm_pedidos", name: "Pedidos de Venda", description: "Emissão de pedidos com sincronização e envio PDF" },
      { key: "crm_faturamento", name: "Faturamento e Notas", description: "Acompanhamento de notas fiscais e entregas" },
      { key: "crm_comissoes", name: "Comissões e Repasses", description: "Cálculo automático de comissões liquidadas e a faturar" },
      { key: "whatsapp_bot", name: "Agente IA WhatsApp", description: "Disparos inteligentes e triagem automática de leads" },
      { key: "radar_colecoes", name: "Radar de Coleções", description: "Lançamentos sazonais e acompanhamento de estoques" },
    ],
    defaultPlans: [
      {
        name: "RepHub Inicial",
        description: "Ideal para representantes autônomos iniciando carteira",
        amount: 99.9,
        whatsappNumberLimit: 1,
        moduleKeys: ["crm_leads", "crm_clientes", "crm_marcas", "crm_pedidos"],
      },
      {
        name: "RepHub Comercial Pro",
        description: "Completo para equipes e escritórios de representação",
        amount: 199.9,
        whatsappNumberLimit: 3,
        moduleKeys: [
          "crm_leads",
          "crm_clientes",
          "crm_marcas",
          "crm_pedidos",
          "crm_faturamento",
          "crm_comissoes",
          "radar_colecoes",
        ],
      },
      {
        name: "RepHub Enterprise AI",
        description: "Com agente WhatsApp de inteligência artificial incluso",
        amount: 349.9,
        whatsappNumberLimit: 10,
        moduleKeys: [
          "crm_leads",
          "crm_clientes",
          "crm_marcas",
          "crm_pedidos",
          "crm_faturamento",
          "crm_comissoes",
          "whatsapp_bot",
          "radar_colecoes",
        ],
      },
    ],
  },
  {
    slug: "enghub",
    name: "Navor EngHub",
    icon: HardHat,
    color: "from-amber-500 to-orange-600",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    defaultModules: [
      { key: "obras_gestao", name: "Gestão de Obras", description: "Painel de acompanhamento de canteiros de obras ativas" },
      { key: "diario_obra", name: "Diário de Obra Digital", description: "Registro diário com clima, fotos, mão de obra e ocorrências" },
      { key: "insumos_compras", name: "Insumos e Estoque", description: "Cotações, pedidos de compra e entrada de insumos na obra" },
      { key: "cronograma_fisico", name: "Cronograma Físico-Financeiro", description: "Gantt de execução e curva de avanço" },
      { key: "equipe_rh", name: "Mão de Obra e Terceiros", description: "Alocação de pedreiros, mestres e empresas subcontratadas" },
      { key: "financeiro_obras", name: "Custos e Financeiro", description: "Orçamento planejado vs realizado por centro de custo" },
    ],
    defaultPlans: [
      {
        name: "EngHub Canteiro",
        description: "Controle essencial para pequenas reformas e obras residenciais",
        amount: 149.9,
        whatsappNumberLimit: 1,
        moduleKeys: ["obras_gestao", "diario_obra", "insumos_compras"],
      },
      {
        name: "EngHub Construtora Pro",
        description: "Gestão completa de múltiplas obras e equipes",
        amount: 299.9,
        whatsappNumberLimit: 3,
        moduleKeys: [
          "obras_gestao",
          "diario_obra",
          "insumos_compras",
          "cronograma_fisico",
          "equipe_rh",
          "financeiro_obras",
        ],
      },
    ],
  },
  {
    slug: "barberhub",
    name: "Navor BarberHub",
    icon: Scissors,
    color: "from-orange-500 to-amber-600",
    badgeColor: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    defaultModules: [
      { key: "agenda_profissionais", name: "Agenda e Profissionais", description: "Agenda por profissional, serviços e disponibilidade" },
      { key: "pdv_comandas", name: "PDV e Comandas", description: "Abertura, lançamentos e fechamento de comandas" },
      { key: "comissoes_barbeiros", name: "Comissões", description: "Cálculo e acompanhamento de comissões da equipe" },
      { key: "estoque_insumos", name: "Estoque e Insumos", description: "Controle de produtos, insumos e reposição" },
      { key: "fidelidade_clientes", name: "Fidelidade e Clientes", description: "Cadastro, histórico e programa de fidelidade" },
    ],
    defaultPlans: [
      {
        name: "BarberHub Essencial",
        description: "Agenda, clientes e operação da barbearia",
        amount: 149.9,
        whatsappNumberLimit: 1,
        moduleKeys: ["agenda_profissionais", "pdv_comandas", "fidelidade_clientes"],
      },
      {
        name: "BarberHub Elite & Redes",
        description: "Gestão completa com PDV, comissões, estoque e fidelidade",
        amount: 299.9,
        whatsappNumberLimit: 1,
        moduleKeys: ["agenda_profissionais", "pdv_comandas", "comissoes_barbeiros", "estoque_insumos", "fidelidade_clientes"],
      },
    ],
  },
  {
    slug: "lawhub",
    name: "Navor LawHub",
    icon: Scale,
    color: "from-blue-600 to-indigo-600",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    defaultModules: [
      { key: "processos_casos", name: "Processos e Casos", description: "Sincronização automática de processos judiciais via OAB" },
      { key: "publicacoes_djen", name: "Publicações e Diários (DJEN)", description: "Captura de intimações nos diários com prazo fatal" },
      { key: "financeiro_juridico", name: "Financeiro & Honorários", description: "Separação de contas do escritório vs honorários de clientes" },
      { key: "ia_modelos", name: "Criação de Peças com IA", description: "Assistente inteligente para elaboração de petições e recursos" },
      { key: "jurisprudencia_ia", name: "Jurisprudência & Precedentes", description: "Pesquisa inteligente em tribunais estaduais e superiores" },
      { key: "agenda_audiencias", name: "Agenda & Audiências", description: "Controle de pautas, audiências virtuais e compromissos" },
      { key: "portal_cliente_juridico", name: "Portal do Cliente", description: "Área exclusiva para clientes acompanharem o processo" },
      { key: "equipe_escritorio", name: "Equipe & Associados", description: "Gestão de sócios, advogados associados e estagiários" },
      { key: "calculadora_juridica", name: "Calculadora Jurídica", description: "Cálculos judiciais, rescisórios, juros e demonstrativos" },
      { key: "atendimento_whatsapp", name: "CallCenter (WhatsApp & Filas)", description: "Central unificada de conversas CallCenter com setores, filas, triagem por Bot/IA e transferências" },
      { key: "atendimento_ia", name: "IA de Atendimento & Triagem", description: "Inteligência artificial para triagem em linguagem natural, qualificação e handoff" },
    ],
    defaultPlans: [
      {
        name: "LawHub Autônomo Starter",
        description: "Para advogados autônomos. 150 processos no radar, 1 OAB em diários e 50 créditos IA",
        amount: 125.0,
        whatsappNumberLimit: 1,
        moduleKeys: ["processos_casos", "publicacoes_djen", "financeiro_juridico", "agenda_audiencias", "calculadora_juridica"],
      },
      {
        name: "LawHub Escritório Ágil",
        description: "Para pequenas bancas. 500 processos no radar, 3 OABs em diários, 150 créditos IA e 5 usuários",
        amount: 227.0,
        whatsappNumberLimit: 2,
        moduleKeys: [
          "processos_casos",
          "publicacoes_djen",
          "financeiro_juridico",
          "ia_modelos",
          "agenda_audiencias",
          "calculadora_juridica",
        ],
      },
      {
        name: "LawHub Contencioso Business",
        description: "Para médios escritórios. 1.000 processos no radar, 5 OABs em diários, 350 créditos IA e 10 usuários",
        amount: 413.0,
        whatsappNumberLimit: 5,
        moduleKeys: [
          "processos_casos",
          "publicacoes_djen",
          "financeiro_juridico",
          "ia_modelos",
          "jurisprudencia_ia",
          "agenda_audiencias",
          "portal_cliente_juridico",
          "calculadora_juridica",
          "atendimento_whatsapp",
        ],
      },
      {
        name: "LawHub Full Law Enterprise",
        description: "Alta performance jurídica. 2.000 processos no radar, 10 OABs em diários, 800 créditos IA e 30 usuários",
        amount: 749.0,
        whatsappNumberLimit: 10,
        moduleKeys: [
          "processos_casos",
          "publicacoes_djen",
          "financeiro_juridico",
          "ia_modelos",
          "jurisprudencia_ia",
          "agenda_audiencias",
          "portal_cliente_juridico",
          "equipe_escritorio",
          "calculadora_juridica",
          "atendimento_whatsapp",
          "atendimento_ia",
        ],
      },
    ],
  },
];

function AdminPlanosPage() {
  const [activeSystem, setActiveSystem] = useState<SystemType>("rephub");
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<any | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const {
    data: serverPlansData,
    refetch: refetchServerPlansData,
    isLoading: loadingPlansData,
  } = useQuery({
    queryKey: ["admin_server_plans_data", activeSystem],
    queryFn: () => getAdminPlansData({ data: { productSlug: activeSystem } }),
  });

  const products = serverPlansData?.products || [];

  // Produtos são a fonte de verdade. Catálogos conhecidos só acrescentam cor,
  // ícone e a ação de sincronização; qualquer produto novo já aparece aqui.
  const visibleSystems = useMemo<SystemDefinition[]>(() => {
    const list = [...products];
    if (!list.some((p: any) => p.slug === "pethub")) {
      list.push({ slug: "pethub", name: "PetHub" });
    }
    return list.map((product: any) => {
      const known = SYSTEMS.find((system) => system.slug === product.slug);
      return known ?? {
        slug: product.slug,
        name: product.name,
        icon: LayoutGrid,
        color: "from-slate-500 to-slate-700",
        badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20",
        defaultModules: [],
        defaultPlans: [],
      };
    });
  }, [products]);

  const currentProduct = useMemo(() => {
    return products?.find((p: any) => p.slug === activeSystem) || serverPlansData?.currentProduct;
  }, [products, activeSystem, serverPlansData]);

  const currentSystemDef =
    visibleSystems.find((system) => system.slug === activeSystem) ??
    SYSTEMS.find((system) => system.slug === activeSystem) ??
    { slug: activeSystem, name: currentProduct?.name ?? activeSystem, icon: LayoutGrid, color: "from-slate-500 to-slate-700", badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20", defaultModules: [], defaultPlans: [] };

  const modules = serverPlansData?.modules || [];
  const plans = serverPlansData?.plans || [];
  const loadingModules = loadingPlansData;
  const loadingPlans = loadingPlansData;

  // Sincroniza e repara os módulos e planos canônicos do sistema
  async function handleSeedSystem() {
    setIsInitializing(true);
    try {
      await syncCanonicalProductsModulesPlans({
        data: { systemSlug: activeSystem as any },
      });
      await refetchServerPlansData();
      toast.success(`Módulos e planos canônicos de ${currentSystemDef.name} sincronizados com sucesso!`);
    } catch (err: any) {
      toast.error(`Erro ao sincronizar: ${err.message}`);
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleConfirmDeletePlan() {
    if (!deletingPlan) return;
    setIsDeletingPlan(true);
    try {
      await deletePlan({ data: { id: deletingPlan.id } });
      toast.success(`Plano "${deletingPlan.name}" excluído com sucesso.`);
      setDeletingPlan(null);
      refetchServerPlansData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir plano");
    } finally {
      setIsDeletingPlan(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Planos Comerciais e Módulos
          </h2>
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            Defina a precificação e a distribuição de recursos separadamente para cada produto NAVOR.
          </p>
        </div>

        <button
          onClick={handleSeedSystem}
          disabled={isInitializing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-card dark:text-slate-200 dark:hover:bg-white/5 transition shadow-xs"
          title="Carregar módulos canônicos recomendados para este sistema"
        >
          {isInitializing ? (
            <RotateCw className="size-3.5 animate-spin text-blue-600" />
          ) : (
            <Sparkles className="size-3.5 text-amber-500" />
          )}
          <span>Sincronizar Módulos e Planos ({currentSystemDef.name})</span>
        </button>
      </div>

      {/* Seletor Superior dos produtos com catálogo operacional */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {visibleSystems.map((sys) => {
          const Icon = sys.icon;
          const isSelected = activeSystem === sys.slug;
          return (
            <button
              key={sys.slug}
              onClick={() => setActiveSystem(sys.slug)}
              className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                isSelected
                  ? "bg-white shadow-md border-blue-600 ring-2 ring-blue-500/20 dark:bg-card/60 dark:border-blue-500"
                  : "bg-white/60 border-slate-200 hover:border-slate-300 dark:bg-card/30 dark:border-white/5 dark:hover:border-white/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`grid size-10 place-items-center rounded-xl text-white bg-gradient-to-br ${sys.color} shadow-sm`}
                >
                  <Icon className="size-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{sys.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {sys.slug === "rephub" && "Vendas e CRM"}
                    {sys.slug === "enghub" && "Obras e Engenharia"}
                    {sys.slug === "lawhub" && "Advocacia e Jurídico"}
                    {sys.slug === "barberhub" && "Barbearias e Serviços"}
                    {sys.slug === "pethub" && "Pet Shops e Veterinária"}
                  </p>
                </div>
              </div>

              {isSelected && (
                <div className="grid size-6 place-items-center rounded-full bg-blue-600 text-white">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid Principal: Módulos do Sistema Selecionado & Planos Comerciais */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Coluna 1: Módulos do Sistema */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LayoutGrid className="size-4.5 text-blue-600" />
              <span>Módulos de {currentSystemDef.name}</span>
              <span className="rounded-full bg-slate-100 dark:bg-white/5 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                {modules?.length || 0}
              </span>
            </h3>
            <Button
              size="sm"
              onClick={() => setIsModuleModalOpen(true)}
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-xs text-xs font-semibold"
            >
              <Plus className="size-3.5 mr-1.5" /> Novo Módulo
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-card/40 overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[580px] overflow-y-auto scrollbar-thin">
              {loadingModules ? (
                <div className="p-8 text-center text-sm text-slate-500">Carregando módulos...</div>
              ) : !modules?.length ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-sm text-slate-500">
                    Nenhum módulo cadastrado para <strong>{currentSystemDef.name}</strong>.
                  </p>
                  <button
                    onClick={handleSeedSystem}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 transition"
                  >
                    <Sparkles className="size-3.5" /> Carregar módulos padrão
                  </button>
                </div>
              ) : (
                modules.map((mod: any) => (
                  <div
                    key={mod.id}
                    className="p-4 flex items-start justify-between hover:bg-slate-50/70 dark:hover:bg-white/5 transition"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {mod.name}
                        </p>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${currentSystemDef.badgeColor}`}
                        >
                          {mod.key}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {mod.description}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0">
                      Ativo
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Coluna 2: Planos Comerciais */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="size-4.5 text-amber-500" />
              <span>Planos de {currentSystemDef.name}</span>
              <span className="rounded-full bg-slate-100 dark:bg-white/5 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                {plans?.length || 0}
              </span>
            </h3>
            <Button
              size="sm"
              onClick={() => setIsPlanModalOpen(true)}
              className="bg-amber-600 text-white hover:bg-amber-700 shadow-xs text-xs font-semibold"
            >
              <Plus className="size-3.5 mr-1.5" /> Novo Plano
            </Button>
          </div>

          <div className="space-y-3.5 max-h-[580px] overflow-y-auto scrollbar-thin pr-1">
            {loadingPlans ? (
              <div className="p-8 text-center text-sm text-slate-500">Carregando planos...</div>
            ) : !plans?.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10">
                <p className="text-sm text-slate-500 mb-3">
                  Nenhum plano cadastrado especificamente para{" "}
                  <strong>{currentSystemDef.name}</strong>.
                </p>
                <Button
                  size="sm"
                  onClick={() => setIsPlanModalOpen(true)}
                  className="bg-blue-600 text-white"
                >
                  <Plus className="size-3.5 mr-1.5" /> Criar Primeiro Plano
                </Button>
              </div>
            ) : (
              plans.map((plan: any) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card/40 transition hover:border-blue-500/40"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                          {plan.name}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${currentSystemDef.badgeColor}`}
                        >
                          {plan.products?.name || currentSystemDef.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {plan.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(plan.amount)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">por mês</p>
                      {plan.whatsapp_number_limit && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {plan.whatsapp_number_limit} nº WhatsApp
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quotas Técnicas e Limites Operacionais */}
                  {activeSystem === "lawhub" && (() => {
                    const pName = (plan.name || "").toLowerCase();
                    const isAgil = pName.includes("ágil") || pName.includes("agil") || Number(plan.amount) < 180;
                    const isEnterprise = pName.includes("enterprise") || Number(plan.amount) > 350;
                    const users = isAgil ? "1 usuário" : isEnterprise ? "Até 25 usuários" : "Até 5 usuários";
                    const oabs = isAgil ? "1 OAB no DJEN" : isEnterprise ? "10 OABs no DJEN" : "3 OABs no DJEN";
                    const procs = isAgil ? "200 processos" : isEnterprise ? "10.000+ processos" : "1.000 processos";
                    const ai = isAgil ? "100 créditos IA" : isEnterprise ? "2.500 créditos IA" : "500 créditos IA";
                    const storage = isAgil ? "10 GB Cloud" : isEnterprise ? "200 GB Cloud" : "50 GB Cloud";

                    return (
                      <div className="pt-2.5 pb-2 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-white/5">
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          👥 {users}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                          ⚖️ {oabs}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          📂 {procs}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          ✨ {ai}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          ☁️ {storage}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="pt-3 border-t border-slate-100 dark:border-white/5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Módulos Inclusos ({plan.plan_modules?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.plan_modules?.length ? (
                        plan.plan_modules.map((pm: any) => (
                          <span
                            key={pm.system_modules?.id || Math.random()}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-300"
                          >
                            <Check className="size-3 text-emerald-600 stroke-[3]" />
                            <span>{pm.system_modules?.name || "Módulo"}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Nenhum módulo vinculado especificamente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações de Edição e Exclusão do Plano */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPlan(plan)}
                      className="h-8 text-xs font-semibold border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <Pencil className="size-3.5 mr-1.5 text-blue-600" />
                      Editar Plano
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingPlan(plan)}
                      className="h-8 text-xs font-semibold border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-950 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="size-3.5 mr-1.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modais */}
      <CreateModuleModal
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        onSuccess={() => {
          setIsModuleModalOpen(false);
          refetchServerPlansData();
        }}
        products={products || []}
        defaultProductId={currentProduct?.id}
      />

      <CreatePlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onSuccess={() => {
          setIsPlanModalOpen(false);
          refetchServerPlansData();
        }}
        modules={modules || []}
        products={products || []}
        defaultProductId={currentProduct?.id}
      />

      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSuccess={() => {
            setEditingPlan(null);
            refetchServerPlansData();
          }}
          modules={modules || []}
          products={products || []}
        />
      )}

      {/* Diálogo de Confirmação de Exclusão de Plano */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/60 dark:bg-slate-900">
            <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-2">
              <Trash2 className="size-5" />
              <span>Excluir Plano Comercial</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Tem certeza que deseja excluir o plano <strong>{deletingPlan.name}</strong>?
              Se houver assinaturas ativas vinculadas a este plano, a exclusão será bloqueada para a segurança financeira do SaaS.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingPlan(null)}
                disabled={isDeletingPlan}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 text-white hover:bg-rose-700 font-semibold"
                onClick={handleConfirmDeletePlan}
                disabled={isDeletingPlan}
              >
                {isDeletingPlan ? "Excluindo..." : "Sim, Excluir Plano"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateModuleModal({ isOpen, onClose, onSuccess, products, defaultProductId }: any) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await createSystemModule({
        data: {
          key: fd.get("key") as string,
          name: fd.get("name") as string,
          description: fd.get("description") as string,
          productId: fd.get("productId") as string,
        },
      });
      toast.success("Módulo cadastrado com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Novo Módulo do Sistema
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Sistema / Produto *
            </label>
            <select
              name="productId"
              required
              defaultValue={defaultProductId}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
            >
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nome do Módulo *
            </label>
            <Input
              name="name"
              required
              placeholder="Ex: Gestão de Honorários"
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chave Identificadora (Key) *
            </label>
            <Input
              name="key"
              required
              placeholder="Ex: honorarios_juridicos"
              className="mt-1 font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Descrição
            </label>
            <Input
              name="description"
              required
              placeholder="Descreva o propósito deste módulo no sistema"
              className="mt-1 text-xs"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading} size="sm">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              disabled={loading}
              size="sm"
            >
              {loading ? "Salvando..." : "Salvar Módulo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreatePlanModal({
  isOpen,
  onClose,
  onSuccess,
  modules,
  products,
  defaultProductId,
}: any) {
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    defaultProductId || products[0]?.id || ""
  );
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await createPlan({
        data: {
          name: fd.get("name") as string,
          description: fd.get("description") as string,
          amount: Number(fd.get("amount")),
          whatsappNumberLimit: Number(fd.get("whatsappNumberLimit")),
          productId: selectedProductId,
          modules: selectedModules,
        },
      });
      toast.success("Plano comercial criado com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (!isOpen) return null;

  const filteredModules = modules.filter((m: any) => m.product_id === selectedProductId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 max-h-[90vh] overflow-y-auto scrollbar-thin">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Novo Plano Comercial
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sistema / Produto de Destino *
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setSelectedModules([]);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
              >
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome do Plano *
              </label>
              <Input
                name="name"
                required
                placeholder="Ex: Contencioso Premium"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Valor Mensal (R$) *
              </label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                required
                placeholder="199.90"
                className="mt-1 text-xs font-bold text-emerald-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Limite WhatsApp (Números)
              </label>
              <Input
                name="whatsappNumberLimit"
                type="number"
                min="1"
                required
                defaultValue="3"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Descrição Comercial do Pacote *
            </label>
            <Input
              name="description"
              required
              placeholder="Ex: Pacote para escritórios de médio porte com IA inclusa"
              className="mt-1 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-900 dark:text-white mb-2 block">
              Módulos Inclusos neste Plano ({selectedModules.length} selecionados)
            </label>

            {filteredModules.length === 0 ? (
              <p className="text-xs text-slate-500 italic mt-1">
                Nenhum módulo cadastrado para este produto ainda. Cadastre módulos na aba ao lado.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto scrollbar-thin p-1">
                {filteredModules.map((mod: any) => (
                  <label
                    key={mod.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 cursor-pointer transition text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(mod.id)}
                      onChange={() => toggleModule(mod.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {mod.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading} size="sm">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 text-white hover:bg-amber-700 font-semibold"
              disabled={loading}
              size="sm"
            >
              {loading ? "Criando..." : "Salvar Plano"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPlanModal({
  plan,
  onClose,
  onSuccess,
  modules,
  products,
}: {
  plan: any;
  onClose: () => void;
  onSuccess: () => void;
  modules: any[];
  products: any[];
}) {
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    plan.product_id || products[0]?.id || ""
  );

  const initialModules = useMemo(() => {
    return (plan.plan_modules || [])
      .map((pm: any) => pm.system_modules?.id || pm.module_id)
      .filter(Boolean);
  }, [plan]);

  const [selectedModules, setSelectedModules] = useState<string[]>(initialModules);
  const [name, setName] = useState(plan.name || "");
  const [description, setDescription] = useState(plan.description || "");
  const [amount, setAmount] = useState(plan.amount ?? 149.9);
  const [whatsappLimit, setWhatsappLimit] = useState(plan.whatsapp_number_limit ?? 3);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await updatePlan({
        data: {
          id: plan.id,
          name,
          description,
          amount: Number(amount),
          whatsappNumberLimit: Number(whatsappLimit),
          productId: selectedProductId,
          modules: selectedModules,
        },
      });
      toast.success("Plano atualizado com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar plano");
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const filteredModules = modules.filter(
    (m: any) => !m.product_id || m.product_id === selectedProductId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Editar Plano Comercial
            </h3>
            <p className="text-xs text-slate-500">
              Modifique preços, limites e distribuição de blocos/módulos para este plano.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            ID: {plan.id?.substring(0, 8)}...
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sistema / Produto *
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
              >
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome do Plano *
              </label>
              <Input
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Contencioso Pro"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Valor Mensal (R$) *
              </label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 text-xs font-bold text-emerald-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Limite WhatsApp (Números)
              </label>
              <Input
                name="whatsappNumberLimit"
                type="number"
                min="1"
                required
                value={whatsappLimit}
                onChange={(e) => setWhatsappLimit(Number(e.target.value))}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Descrição Comercial do Pacote *
            </label>
            <Input
              name="description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Pacote para escritórios com IA inclusa"
              className="mt-1 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-900 dark:text-white">
                Módulos Inclusos ({selectedModules.length} selecionados)
              </label>
              <span className="text-[10px] text-slate-400">
                Marque os blocos que os assinantes deste plano terão acesso
              </span>
            </div>

            {filteredModules.length === 0 ? (
              <p className="text-xs text-slate-500 italic mt-1">
                Nenhum módulo encontrado para este produto.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto scrollbar-thin p-1">
                {filteredModules.map((mod: any) => (
                  <label
                    key={mod.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition text-xs ${
                      selectedModules.includes(mod.id)
                        ? "border-blue-500/50 bg-blue-50/60 dark:border-blue-500/40 dark:bg-blue-950/30"
                        : "border-slate-100 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(mod.id)}
                      onChange={() => toggleModule(mod.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                        {mod.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {mod.key}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={loading}
              size="sm"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              disabled={loading}
              size="sm"
            >
              {loading ? "Salvando..." : "Atualizar Plano"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


