import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard, Button, Input } from "@/components/navor-rephub/ui";
import { Package, Users, Activity, Settings, Plus, Pencil, Trash2, Sparkles, RotateCw, Bot, ShieldCheck, Headphones, CheckCircle2, Database, ExternalLink, Link2, PawPrint, Scissors, Scale, HardHat, LayoutGrid, Clock } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  repairAndSyncDatabase,
  getLawHubServiceConfig,
  saveLawHubServiceConfig,
  getAdminProducts,
} from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/produtos")({
  component: AdminProdutosPage,
});

function AdminProdutosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["admin_products"],
    queryFn: () => getAdminProducts(),
  });

  const renderedProducts = useMemo(() => {
    if (!products) return [];
    const list = [...products];
    if (!list.some((p: any) => p.slug === "pethub")) {
      list.push({
        id: "pethub-canonical-prod",
        name: "PetHub",
        slug: "pethub",
        description: "Plataforma integrada para administrar vendas, banho e tosa, clientes, pets, estoque, financeiro, fiscal, equipe, franquias e vendas online.",
        short_description: "Gestão integrada para pet shops, do caixa ao e-commerce.",
        status: "coming_soon",
        accounts_count: 0,
        admin_app_url: "https://app.pethub.navorbr.com",
        client_portal_url: "https://pethub.navorbr.com",
      });
    }
    return list;
  }, [products]);

  async function handleDeleteProduct(prod: any) {
    if (prod.accounts_count > 0) {
      toast.error(`Não é possível excluir '${prod.name}' pois existem ${prod.accounts_count} empresa(s) vinculada(s).`);
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o produto '${prod.name}' (${prod.slug})?`)) {
      return;
    }

    try {
      await deleteProduct({ data: { id: prod.id } });
      toast.success(`Produto '${prod.name}' excluído com sucesso!`);
      refetch();
    } catch (err: any) {
      toast.error(`Erro ao excluir produto: ${err.message}`);
    }
  }

  async function handleCleanDuplicates() {
    setIsCleaning(true);
    try {
      const res = await repairAndSyncDatabase();
      toast.success("Produtos sincronizados e duplicatas removidas com sucesso!");
      refetch();
    } catch (err: any) {
      toast.error(`Erro ao limpar duplicados: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Produtos NAVOR</h2>
          <p className="text-sm text-muted-foreground">Gestão multiproduto da plataforma.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanDuplicates}
            disabled={isCleaning}
            className="border-slate-200 dark:border-slate-800 text-xs font-semibold"
          >
            {isCleaning ? (
              <RotateCw className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 size-3.5 text-amber-500" />
            )}
            Limpar Duplicados
          </Button>

          <Button variant="outline" size="sm" className="bg-ink-2 text-card-foreground border-border text-xs font-semibold" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            Novo Produto
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="text-muted-foreground">Carregando produtos...</div>
        ) : (
          renderedProducts.map((product) => {
            const isPet = product.slug === "pethub" || product.slug?.includes("pet");
            const isBarber = product.slug === "barberhub";
            const isLaw = product.slug === "lawhub";
            const isEng = product.slug === "enghub";
            const ProdIcon = isPet ? PawPrint : isBarber ? Scissors : isLaw ? Scale : isEng ? HardHat : Package;
            const iconBg = isPet
              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20"
              : isBarber
              ? "bg-orange-500/10 text-orange-600 border border-orange-500/20"
              : isLaw
              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
              : isEng
              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
              : "bg-brand/10 text-brand border border-brand/20";
            const isComingSoon = product.status === "coming_soon";
            const isActive = product.status === "active";

            return (
            <GlassCard key={product.id} className="p-6 flex flex-col h-full hover:border-brand/30 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${iconBg}`}>
                    <ProdIcon className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-card-foreground text-lg leading-tight">{product.name}</h3>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono bg-ink-3 px-2 py-0.5 rounded mt-1 inline-block">
                      {product.slug}
                    </span>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isActive
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                    : isComingSoon
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-gold/10 text-gold'
                }`}>
                  {isActive ? 'Ativo' : isComingSoon ? 'EM BREVE' : product.status}
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-6 flex-1">
                {product.description || "Sem descrição informada."}
              </p>

              <div className="mb-6 rounded-xl border border-sky-200/80 bg-sky-50/50 p-3 dark:border-sky-900/60 dark:bg-sky-950/20">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                  <Link2 className="size-3.5" />
                  Acessos do produto
                </div>
                <div className="space-y-1.5 text-xs">
                  {product.admin_app_url ? (
                    <a href={product.admin_app_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-md bg-white/80 px-2 py-1.5 font-medium text-slate-700 hover:text-blue-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:text-blue-300">
                      <span className="truncate">Administrativo</span><ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : <p className="px-2 text-muted-foreground">Administrativo: não informado</p>}
                  {product.client_portal_url ? (
                    <a href={product.client_portal_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-md bg-white/80 px-2 py-1.5 font-medium text-slate-700 hover:text-blue-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:text-blue-300">
                      <span className="truncate">Portal do cliente</span><ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : <p className="px-2 text-muted-foreground">Portal do cliente: não informado</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-ink-3/50 p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Activity className="size-3.5" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Empresas</span>
                  </div>
                  <p className="text-2xl font-bold text-card-foreground">{product.accounts_count}</p>
                </div>
                
                <div className="bg-ink-3/50 p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="size-3.5" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Status</span>
                  </div>
                  <p className="text-base font-bold text-card-foreground capitalize">{product.status || "Ativo"}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-border mt-auto flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-slate-200 dark:border-slate-800 text-xs font-semibold"
                  onClick={() => setEditingProduct(product)}
                >
                  <Pencil className="size-3.5 mr-1" />
                  Editar
                </Button>
                {(product.slug === "lawhub" || product.name?.toLowerCase().includes("lawhub")) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-300 bg-blue-50/60 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-semibold"
                    onClick={() => {
                      setEditingProduct(product);
                    }}
                    title="Configurar Inteligência Artificial do LawHub"
                  >
                    <Sparkles className="size-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                    Configurar IA
                  </Button>
                )}
                <Link to="/admin/planos" className="flex-1">
                  <Button size="sm" className="w-full bg-brand text-primary-foreground hover:bg-brand/90 text-xs font-semibold">
                    <Settings className="size-3.5 mr-1" />
                    Planos
                  </Button>
                </Link>
                {product.accounts_count === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 text-xs px-2.5"
                    title="Excluir Produto sem empresas vinculadas"
                    onClick={() => handleDeleteProduct(product)}
                  >
                    <Trash2 className="size-3.5 text-rose-600" />
                  </Button>
                )}
              </div>
            </GlassCard>
          );
        })
        )}
      </div>

      <CreateProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          setIsModalOpen(false);
          refetch();
        }}
      />

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function EditProductModal({ product, onClose, onSuccess }: { product: any; onClose: () => void; onSuccess: () => void }) {
  const isLawHub = product?.slug === "lawhub" || product?.name?.toLowerCase().includes("lawhub");

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"geral" | "ai" | "callcenter" | "legaldata">(isLawHub ? "ai" : "geral");
  const [name, setName] = useState(product.name || "");
  const [slug, setSlug] = useState(product.slug || "");
  const [description, setDescription] = useState(product.description || "");
  const [status, setStatus] = useState<"active" | "inactive">(product.status || "active");
  const [adminAppUrl, setAdminAppUrl] = useState(product.admin_app_url || "");
  const [clientPortalUrl, setClientPortalUrl] = useState(product.client_portal_url || "");

  // Configurações de IA Centralizadas do LawHub (Peças Processuais)
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">("gemini");
  const [aiModel, setAiModel] = useState("gemini-2.0-flash");

  // Configurações do Motor do CALL CENTER (Bot & IA Rápida)
  const [ccMode, setCcMode] = useState<"ai" | "bot" | "hybrid" | "human">("ai");
  const [ccAiProvider, setCcAiProvider] = useState<"google" | "openai">("google");
  const [ccAiModel, setCcAiModel] = useState("google/gemini-2.5-flash");
  const [ccLeadRule, setCcLeadRule] = useState<"instant" | "qualified" | "immediate" | "manual">("qualified");

  // Dados jurídicos são um terceiro motor, independente das IAs de peças e atendimento.
  const [legalDataQuota, setLegalDataQuota] = useState(150);

  useEffect(() => {
    if (isLawHub) {
      Promise.all([
        getLawHubServiceConfig({ data: { service: "pieces_ai" } }),
        getLawHubServiceConfig({ data: { service: "callcenter_ai" } }),
        getLawHubServiceConfig({ data: { service: "legal_data" } }),
      ]).then(([pieces, callcenter, legalData]) => {
        if (pieces?.provider) setAiProvider(pieces.provider as any);
        if (pieces?.model) setAiModel(pieces.model);
        if (callcenter?.provider) setCcAiProvider((callcenter.provider === "gemini" ? "google" : callcenter.provider) as any);
        if (callcenter?.model) setCcAiModel(callcenter.model);
        if (callcenter?.receptionMode) setCcMode(callcenter.receptionMode);
        if (callcenter?.leadRule) setCcLeadRule(callcenter.leadRule);
        if (typeof legalData?.monthlyQuota === "number") setLegalDataQuota(legalData.monthlyQuota);
      }).catch(() => {});
    }
  }, [isLawHub]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLawHub) {
        await Promise.all([
          saveLawHubServiceConfig({ data: {
            service: "pieces_ai", provider: aiProvider as any, model: aiModel, reviewRequired: true,
          } }),
          saveLawHubServiceConfig({ data: {
            service: "callcenter_ai", provider: (ccAiProvider === "google" ? "gemini" : ccAiProvider) as any, model: ccAiModel, receptionMode: ccMode, leadRule: ccLeadRule,
          } }),
          saveLawHubServiceConfig({ data: {
            service: "legal_data", provider: "datajud", monthlyQuota: legalDataQuota,
          } }),
        ]);
      }

      await updateProduct({
        data: {
          id: product.id,
          name,
          slug,
          description,
          status,
          adminAppUrl,
          clientPortalUrl,
        },
      });

      toast.success(isLawHub ? "Produto e configurações de IA salvos com sucesso!" : "Produto atualizado com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar produto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className={`w-full ${isLawHub ? "max-w-xl" : "max-w-md"} p-6 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden`}>
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white">
              <Package className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Editar Produto: {product.name}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isLawHub ? "Gestão cadastral e inteligência artificial forense" : "Configurações gerais do produto"}
              </p>
            </div>
          </div>
          {isLawHub && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              LawHub
            </span>
          )}
        </div>

        {/* Abas quando for LawHub */}
        {isLawHub && (
          <div className="flex items-center gap-1.5 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === "ai"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>IA de Peças (Jurídica)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("legaldata")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === "legaldata"
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Database className="size-3.5" />
              <span>Dados Jurídicos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("callcenter")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === "callcenter"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Headphones className="size-3.5" />
              <span>Motor CallCenter (Bot / IA)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("geral")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === "geral"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Settings className="size-3.5" />
              <span>Dados Cadastrais</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
          {/* ABA IA: Configuração exclusiva da IA do LawHub */}
          {isLawHub && activeTab === "ai" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <Bot className="size-4 text-blue-600 dark:text-blue-400" />
                    <span>Motor de Inteligência Artificial para Peças</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-200/70 text-blue-900 dark:bg-blue-900 dark:text-blue-200">
                    {aiProvider === "gemini" ? "Google Gemini (Padrão)" : "OpenAI (GPT-4o)"}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Defina qual inteligência artificial redigirá as petições e recursos no LawHub. O advogado na ponta não precisará configurar chaves individuais.
                </p>

                {/* Seleção de Provedor */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Provedor de IA Selecionado:
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => {
                      const p = e.target.value as any;
                      setAiProvider(p);
                      if (p === "openai") setAiModel("gpt-4o");
                      if (p === "gemini") setAiModel("gemini-2.0-flash");
                    }}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
                  >
                    
                    <option value="openai">OpenAI (ChatGPT / GPT-4o Forense)</option>
                    <option value="gemini">Google Gemini (Gemini 2.0 Flash / Pro)</option>
                  </select>
                </div>

                

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Credencial do provedor</label>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Gerenciada exclusivamente pelos segredos da NAVOR. Nenhuma chave é digitada, exibida ou salva no navegador.
                  </div>
                </div>

                {/* Modelo de Linguagem */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Modelo de Linguagem:
                  </label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                  >
                    {aiProvider === "openai" && (
                      <>
                        <option value="gpt-4o">gpt-4o (Recomendado para Petições & Recursos)</option>
                        <option value="gpt-4o-mini">gpt-4o-mini (Econômico)</option>
                        <option value="o1-preview">o1-preview (Raciocínio Jurídico Complexo)</option>
                        <option value="gpt-4-turbo">gpt-4-turbo</option>
                      </>
                    )}
                    {aiProvider === "gemini" && (
                      <>
                        <option value="gemini-2.0-flash">gemini-2.0-flash (Recomendado)</option>
                        <option value="gemini-1.5-pro">gemini-1.5-pro (Leitura de Peças Extensas até 1M tokens)</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <strong>Motor Jurídico Fallback Ativo:</strong> Caso qualquer API externa esteja temporariamente indisponível ou sem saldo, o LawHub aciona automaticamente o motor nativo especializado em CPC/15, garantindo que o advogado nunca fique sem sua peça processual.
                </div>
              </div>
            </div>
          )}

          {/* ABA CALL CENTER: Recepção WhatsApp, Bot e IA */}
          {isLawHub && activeTab === "callcenter" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-800/60 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Headphones className="size-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
                      Motor de Atendimento CallCenter
                    </h3>
                  </div>
                  <span className="rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300">
                    SEPARADO DE PEÇAS
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Configure se a recepção no WhatsApp opera via <strong>Bot Estruturado</strong> (menu com opções fixas sem gasto de tokens) ou <strong>IA Conversacional Leve</strong> (respostas humanas e triagem inteligente).
                </p>
              </div>

              {/* Modo de Recepção */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Modo de Operação da Recepção
                </label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCcMode("bot")}
                    className={`p-3 text-left rounded-xl border transition cursor-pointer ${
                      ccMode === "bot"
                        ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">🤖 Bot Estruturado</span>
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded">0 TOKENS</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Menu numerado rápido. Não consome IA. Coleta dados e já envia o lead ao funil.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCcMode("ai")}
                    className={`p-3 text-left rounded-xl border transition cursor-pointer ${
                      ccMode === "ai"
                        ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">✨ IA Conversacional</span>
                      <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded">LEVE / RÁPIDA</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Linguagem natural ágil (Flash/Mini). Analisa sentimentos e urgência jurídica.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCcMode("hybrid")}
                    className={`p-3 text-left rounded-xl border transition cursor-pointer ${
                      ccMode === "hybrid"
                        ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">⚡ Híbrido Bot + IA</span>
                      <span className="text-[10px] bg-amber-600 text-white font-bold px-1.5 py-0.5 rounded">RECOMENDADO</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Inicia com menu guiado. Se o cliente fizer pergunta aberta, a IA responde.
                    </p>
                  </button>
                </div>
              </div>

              {/* Se IA ou Híbrido estiver ativo, permite configurar a IA específica do Call Center */}
              {ccMode !== "bot" && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Provedor de IA do Call Center:
                      </label>
                      <select
                        value={ccAiProvider}
                        onChange={(e) => setCcAiProvider(e.target.value as "google" | "openai")}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        
                        <option value="google">Google Gemini API (Direto)</option>
                        <option value="openai">OpenAI (GPT-4o Mini)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Modelo de Linguagem (Alta Velocidade):
                      </label>
                      <select
                        value={ccAiModel}
                        onChange={(e) => setCcAiModel(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                      >
                        <option value="gemini-2.0-flash">gemini-2.0-flash (Recomendado)</option>
                        <option value="gpt-4o-mini">gpt-4o-mini (Latência Mínima)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Regra de Incorporação em Leads */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Regra de Incorporação em Leads (Funil Comercial)
                </label>
                <div className="mt-2 space-y-2">
                  <label className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 cursor-pointer">
                    <input
                      type="radio"
                      name="ccLeadRule"
                      value="instant"
                      checked={ccLeadRule === "instant"}
                      onChange={() => setCcLeadRule("instant")}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        Incorporação Instantânea (Recomendado)
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Assim que o WhatsApp recebe a primeira mensagem, cria automaticamente o registro na tabela de Leads com canal "WhatsApp CALL CENTER" e etapa "Triagem Inicial".
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 cursor-pointer">
                    <input
                      type="radio"
                      name="ccLeadRule"
                      value="qualified"
                      checked={ccLeadRule === "qualified"}
                      onChange={() => setCcLeadRule("qualified")}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        Incorporação Pós-Qualificação (Bot ou IA)
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        O lead só é inserido no pipeline depois que o Bot ou a IA extrai pelo menos o Nome completo e o Resumo da Demanda/Área Jurídica.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 cursor-pointer">
                    <input
                      type="radio"
                      name="ccLeadRule"
                      value="manual"
                      checked={ccLeadRule === "manual"}
                      onChange={() => setCcLeadRule("manual")}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        Incorporação Manual pelo Atendente
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        O atendente humano clica no botão "Criar Lead a partir do Chat" no painel lateral do Call Center quando julgar procedente.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {isLawHub && activeTab === "legaldata" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-800/60 dark:bg-violet-950/20">
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white text-sm">
                  <Database className="size-5 text-violet-600 dark:text-violet-400" />
                  Dados jurídicos: Processos, Casos e Publicações
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Este motor é separado das IAs. Ele abastece exclusivamente Processos e Casos, Publicações e monitoramentos; não participa da triagem do WhatsApp nem da redação de peças.
                </p>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                <strong>Base contínua: DataJud + DJEN.</strong> O monitoramento regular de Processos e Casos funciona sempre por fontes oficiais. Não há escolha de provedor para desligar ou substituir essa base.
              </div>

              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-[11px] text-violet-900 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
                <strong>Complemento seletivo: Escavador.</strong> A API paga é acionada apenas quando um processo ou publicação for marcado para consulta/monitoramento aprofundado, histórico ampliado ou cobertura adicional.
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">Franquia mensal de consultas avançadas (Escavador)</label>
                <input type="number" min={0} value={legalDataQuota} onChange={(e) => setLegalDataQuota(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                Credenciais do Escavador e do DataJud ficam apenas nos segredos do servidor NAVOR. A franquia limita somente as consultas avançadas selecionadas do Escavador; ela não limita o DataJud/DJEN contínuo.
              </div>
            </div>
          )}

          {/* ABA GERAL: Dados do Produto */}
          {(!isLawHub || activeTab === "geral") && (
            <div className="space-y-4">
              <div>
                <label className="text-slate-600 dark:text-slate-300 font-semibold">Nome do Produto</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-300 font-semibold">Slug (Identificador URL)</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-300 font-semibold">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900/60 dark:bg-sky-950/20">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-200">
                  <Link2 className="size-3.5" /> Acessos oficiais
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-sky-800 dark:text-sky-300">Links informativos da Retaguarda NAVOR. Use apenas URLs HTTPS; nenhuma senha, token ou chave de API deve ser inserida aqui.</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-600 dark:text-slate-300 font-semibold">Acesso Administrativo / Retaguarda</label>
                    <input type="url" value={adminAppUrl} onChange={(e) => setAdminAppUrl(e.target.value)} placeholder="https://produto.navorbr.com" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-300 font-semibold">Portal do Cliente</label>
                    <input type="url" value={clientPortalUrl} onChange={(e) => setClientPortalUrl(e.target.value)} placeholder="https://produto.navorbr.com/cliente" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-300 font-semibold">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-semibold shadow-sm cursor-pointer inline-flex items-center gap-1.5 transition ${
                "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {loading ? (
                <>
                  <RotateCw className="size-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateProductModal({ isOpen, onClose, onSuccess }: any) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await createProduct({ data: {
        name: fd.get("name") as string,
        slug: fd.get("slug") as string,
        description: fd.get("description") as string,
        adminAppUrl: fd.get("adminAppUrl") as string,
        clientPortalUrl: fd.get("clientPortalUrl") as string,
      }});
      toast.success("Produto criado com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <GlassCard className="w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-card-foreground mb-4">Novo Produto</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Nome do Produto</label>
            <Input name="name" required placeholder="Ex: Navor Admin" className="bg-secondary mt-1" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Slug (Identificador na URL)</label>
            <Input name="slug" required placeholder="Ex: navor-admin" className="bg-secondary mt-1 font-mono" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Descrição</label>
            <Input name="description" required placeholder="Para que serve este produto?" className="bg-secondary mt-1" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Acesso Administrativo / Retaguarda</label>
            <Input name="adminAppUrl" type="url" placeholder="https://produto.navorbr.com" className="bg-secondary mt-1" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Portal do Cliente</label>
            <Input name="clientPortalUrl" type="url" placeholder="https://produto.navorbr.com/cliente" className="bg-secondary mt-1" />
          </div>
          
          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" className="bg-brand text-primary-foreground hover:bg-brand/90" disabled={loading}>
              Salvar Produto
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
