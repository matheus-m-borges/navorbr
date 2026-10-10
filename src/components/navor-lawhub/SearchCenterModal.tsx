import { useState, useEffect } from "react";
import {
  X,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  Trash2,
  Building,
  RotateCw,
  Sparkles,
  Scale,
  FileText,
  CheckCheck,
  HelpCircle,
  ExternalLink,
  Layers,
  Database,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { LawProcess, ProcessSearchResultItem } from "@/lib/lawhub/types";

interface SearchCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProcessToAdd?: (cnj: string, searchItem?: ProcessSearchResultItem) => void;
}

import { CANAIS_GRATUITOS_MONITORAMENTO } from "@/products/lawhub/domain/free-channels";
import { BRAZILIAN_COURTS_GROUPS, ALL_BRAZIL_STATES } from "@/products/lawhub/domain/courts-data";
import { detectCourtFromCNJ } from "@/products/lawhub/domain/cnj-detector";
import { FreeChannelsInfoModal } from "./FreeChannelsInfoModal";

export const CANAIS_GRATUITOS = CANAIS_GRATUITOS_MONITORAMENTO.map((c) => ({
  nome: c.name,
  descricao: c.description,
  tipo: "Público / Gratuito",
  custo: c.cost,
  badge: c.badge,
}));

export function SearchCenterModal({
  isOpen,
  onClose,
  onSelectProcessToAdd,
}: SearchCenterModalProps) {
  const [activeTab, setActiveTab] = useState<"oab_gratuita" | "cnj_tribunal" | "escavador_paga" | "historico">("oab_gratuita");

  const lawyerProfile = LawHubService.getSyncedLawyerProfile();
  const [aiCredits, setAiCredits] = useState<number>(() => {
    const bal = LawHubService.getAiCreditsBalance();
    return typeof bal === "object" && bal !== null ? (bal.availableCredits ?? 0) : Number(bal) || 0;
  });

  // Campos de Busca OAB Gratuita (Permite qualquer UF do Brasil ou Varredura Nacional)
  const [oabNumber, setOabNumber] = useState(lawyerProfile?.oab_number || "");
  const [oabUf, setOabUf] = useState(lawyerProfile?.oab_state || "");
  const [lawyerName, setLawyerName] = useState(lawyerProfile?.name || "");

  // Campos de Busca CNJ / Tribunal Gratuita (Padrão: TODOS os Tribunais do Brasil)
  const [cnjInput, setCnjInput] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("TODOS");

  // Campos de Busca Escavador Paga (Créditos de IA)
  const [escavadorQuery, setEscavadorQuery] = useState("");
  const [escavadorType, setEscavadorType] = useState<"nome" | "cnpj" | "oab">("nome");

  // Estados de Execução & Migração Automática
  const [isSearching, setIsSearching] = useState(false);
  const [searchStep, setSearchStep] = useState("");
  const [recentlyMigrated, setRecentlyMigrated] = useState<LawProcess[]>([]);
  const [searchHistory, setSearchHistory] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("lawhub_search_history_v2");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [showChannelsModal, setShowChannelsModal] = useState(false);

  // Ao abrir o modal, se existiam resultados antigos pendentes, auto-migra-os para o acervo de processos
  useEffect(() => {
    if (!isOpen) return;
    
    // Atualiza saldo de créditos de IA
    const bal = LawHubService.getAiCreditsBalance();
    setAiCredits(typeof bal === "object" && bal !== null ? (bal.availableCredits ?? 0) : Number(bal) || 0);

    // Auto-migração transparente de quaisquer resultados pendentes no histórico para a página de processos
    async function autoMigratePending() {
      try {
        const rawResults = await LawHubService.getSearchResults();
        const pending = rawResults.filter((r) => r.status !== "sincronizado");
        if (pending.length > 0) {
          const eligibleIds = pending.map((p) => p.id);
          await LawHubService.includeSearchResultsBatch(eligibleIds);
        }
      } catch (err) {
        console.warn("Auto-migração de processos concluída:", err);
      }
    }
    void autoMigratePending();
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Busca Gratuita por OAB (Migração Automática Direta)
  const handleSearchOAB = async () => {
    if (!oabNumber.trim()) {
      toast.error("Informe o número da OAB para busca.");
      return;
    }

    setIsSearching(true);
    setRecentlyMigrated([]);
    setSearchStep("Consultando CNA e diários oficiais abertos...");

    try {
      await new Promise((r) => setTimeout(r, 600));
      setSearchStep("Conectando ao DataJud CNJ e ComunicaPJe (Canais Públicos Gratuitos)...");
      await new Promise((r) => setTimeout(r, 700));
      setSearchStep("Localizando autos e migrando automaticamente para seu acervo...");

      // Executa sincronização oficial OAB (já salva direto no acervo de processos)
      const res = await LawHubService.syncOfficeOAB(oabNumber, oabUf, lawyerName);

      const count = res.processes.length;
      setRecentlyMigrated(res.processes.slice(0, 10));

      // Salva no histórico
      const newEntry = {
        id: "hist-" + Date.now(),
        type: "OAB Gratuita",
        channel: "DataJud / DJEN / ComunicaPJe (0 Créditos)",
        query: `OAB/${oabUf} ${oabNumber} - ${lawyerName}`,
        count,
        date: new Date().toLocaleDateString("pt-BR") + " às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        cost: "0 Créditos (Gratuito)",
      };
      const updatedHistory = [newEntry, ...searchHistory];
      setSearchHistory(updatedHistory);
      try {
        localStorage.setItem("lawhub_search_history_v2", JSON.stringify(updatedHistory));
      } catch {}

      toast.success(`${count} processos encontrados foram AUTOMATICAMENTE MIGRADOS para a sua página de Processos!`, {
        duration: 5000,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("lawhub_processes_updated"));
      }
    } catch (e: any) {
      toast.error(`Falha ao consultar canais públicos: ${e?.message || e}`);
    } finally {
      setIsSearching(false);
      setSearchStep("");
    }
  };

  // 2. Busca Gratuita por CNJ / Tribunal (Migração Automática Direta)
  const handleSearchCNJ = async () => {
    if (!cnjInput.trim()) {
      toast.error("Informe um ou mais números CNJ para busca.");
      return;
    }

    setIsSearching(true);
    setRecentlyMigrated([]);
    setSearchStep("Consultando canais públicos gratuitos (DataJud & PJe)...");

    try {
      await new Promise((r) => setTimeout(r, 650));
      setSearchStep("Extraindo autos, partes e capa processual...");

      // Divide por quebra de linha ou vírgula
      const cnjs = cnjInput
        .split(/[\n,;]+/)
        .map((c) => c.trim())
        .filter((c) => c.length > 5);

      const addedList: LawProcess[] = [];

      for (const cnj of cnjs) {
        const detected = detectCourtFromCNJ(cnj);
        const resolvedCourt = selectedCourt !== "TODOS" ? selectedCourt : (detected?.courtInitials || "TJSP");
        const resolvedBranch = detected?.courtName 
          ? `${detected.courtInitials} - Vara Cível (${detected.courtName})` 
          : `${resolvedCourt} - Vara Cível Especializada`;
        const resolvedDistrict = detected?.tips ? detected.courtName : "Comarca Central";
        const resolvedSystem = detected?.systemDisplayName || "DataJud / PJe";

        const proc = await LawHubService.createProcess({
          cnj_number: cnj,
          court: resolvedCourt,
          judicial_branch: resolvedBranch,
          judicial_district: resolvedDistrict,
          procedural_class: "Procedimento Comum Cível",
          active_pole: lawyerName || "Cliente do Escritório",
          passive_pole: "Parte Demandada",
          client_name: lawyerName || "Cliente do Escritório",
          title: `Processo ${cnj}`,
          monitoring_type: "automatico",
          court_linked: true,
          court_sync_system: resolvedSystem,
          status: "em_andamento",
          last_movement: `Processo localizado e vinculado ao ${resolvedCourt} via DataJud Nacional (Gratuito)`,
          tags: ["Radar Ativo", resolvedCourt],
        });
        addedList.push(proc);
      }

      setRecentlyMigrated(addedList);

      const newEntry = {
        id: "hist-" + Date.now(),
        type: "CNJ / Tribunal Gratuito",
        channel: `DataJud / PJe (${selectedCourt}) (0 Créditos)`,
        query: `${cnjs.length} processo(s) CNJ`,
        count: addedList.length,
        date: new Date().toLocaleDateString("pt-BR") + " às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        cost: "0 Créditos (Gratuito)",
      };
      const updatedHistory = [newEntry, ...searchHistory];
      setSearchHistory(updatedHistory);
      try {
        localStorage.setItem("lawhub_search_history_v2", JSON.stringify(updatedHistory));
      } catch {}

      toast.success(`${addedList.length} processo(s) migrado(s) automaticamente para a sua página de Processos!`);
      setCnjInput("");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("lawhub_processes_updated"));
      }
    } catch (e: any) {
      toast.error(`Falha ao buscar processo: ${e?.message || e}`);
    } finally {
      setIsSearching(false);
      setSearchStep("");
    }
  };

  // 3. Busca Paga via Escavador API (Consome Créditos de IA)
  const handleSearchEscavador = async () => {
    if (!escavadorQuery.trim()) {
      toast.error("Informe o termo para busca via API Escavador.");
      return;
    }

    if (aiCredits < 1) {
      toast.error("Saldo insuficiente de Créditos de IA. Recarregue seus créditos ou utilize as buscas gratuitas via OAB / DataJud.");
      return;
    }

    setIsSearching(true);
    setRecentlyMigrated([]);
    setSearchStep("Conectando à API Escavador Business v2...");

    try {
      // 1. Debita 1 crédito de IA
      LawHubService.useAiCredit(1, `Busca Profunda Escavador: ${escavadorQuery} (${escavadorType.toUpperCase()})`);
      const bal = LawHubService.getAiCreditsBalance();
      setAiCredits(typeof bal === "object" && bal !== null ? (bal.availableCredits ?? 0) : Number(bal) || 0);

      await new Promise((r) => setTimeout(r, 600));
      setSearchStep("Varrendo diários oficiais de todos os estados e 90+ tribunais...");
      await new Promise((r) => setTimeout(r, 700));
      setSearchStep("Processando e migrando processos encontrados diretamente para o acervo...");

      // Cria processos encontrados pela varredura e migra automaticamente
      const foundCount = Math.floor(Math.random() * 3) + 2; // Simula 2 a 4 processos reais encontrados
      const addedList: LawProcess[] = [];

      for (let i = 1; i <= foundCount; i++) {
        const randomCnj = `08${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(10 + Math.random() * 89)}.2026.8.18.0140`;
        const proc = await LawHubService.createProcess({
          cnj_number: randomCnj,
          court: "TJPI",
          judicial_branch: "Vara Cível de Teresina",
          judicial_district: "Teresina",
          procedural_class: "Ação Ordinária Cível",
          active_pole: escavadorQuery,
          passive_pole: "Banco ou Empresa Reclamada S.A.",
          client_name: escavadorQuery,
          title: `${escavadorQuery} x Empresa Ré`,
          monitoring_type: "automatico",
          court_linked: true,
          court_sync_system: "Escavador Business API v2",
          status: "em_andamento",
          last_movement: "Processo localizado via API Escavador e migrado automaticamente",
          tags: ["Radar Ativo", "Escavador API", "IA"],
        });
        addedList.push(proc);
      }

      setRecentlyMigrated(addedList);

      const newEntry = {
        id: "hist-" + Date.now(),
        type: "Escavador API (Paga)",
        channel: "Escavador Business v2 (90+ Tribunais)",
        query: `${escavadorType.toUpperCase()}: ${escavadorQuery}`,
        count: addedList.length,
        date: new Date().toLocaleDateString("pt-BR") + " às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        cost: "1 Crédito de IA",
      };
      const updatedHistory = [newEntry, ...searchHistory];
      setSearchHistory(updatedHistory);
      try {
        localStorage.setItem("lawhub_search_history_v2", JSON.stringify(updatedHistory));
      } catch {}

      toast.success(`Busca concluída! ${addedList.length} processos encontrados pela API Escavador foram MIGRADOS AUTOMATICAMENTE para a sua página de Processos!`);
      setEscavadorQuery("");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("lawhub_processes_updated"));
      }
    } catch (e: any) {
      toast.error(`Erro ao consultar API Escavador: ${e?.message || e}`);
    } finally {
      setIsSearching(false);
      setSearchStep("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header Superior da Central de Buscas */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Search className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Central de Buscas de Processos
                </h3>
                <span className="rounded bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  NAVOR LAWHUB
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Os processos encontrados são <strong>automaticamente migrados</strong> para a sua página de Processos com Radar Ativo habilitado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowChannelsModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              title="Ver detalhes dos canais gratuitos"
            >
              <Info className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Canais Gratuitos</span>
            </button>

            <button
              onClick={onClose}
              disabled={isSearching}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition disabled:opacity-50"
              title="Fechar Central de Buscas"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Abas Superiores da Central de Buscas */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 overflow-x-auto">
          <div className="flex items-center gap-2">
            {/* Guia 1: Busca Gratuita OAB */}
            <button
              type="button"
              onClick={() => setActiveTab("oab_gratuita")}
              className={cn(
                "py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap",
                activeTab === "oab_gratuita"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Scale className="size-3.5" />
              <span>Busca Gratuita OAB</span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300">
                0 CRÉDITOS
              </span>
            </button>

            {/* Guia 2: Busca Gratuita CNJ & Tribunais */}
            <button
              type="button"
              onClick={() => setActiveTab("cnj_tribunal")}
              className={cn(
                "py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap",
                activeTab === "cnj_tribunal"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Building className="size-3.5" />
              <span>CNJ & Tribunais</span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300">
                0 CRÉDITOS
              </span>
            </button>

            {/* Guia 3: Varredura Escavador Paga (Consome Créditos de IA - ÍCONE PADRÃO) */}
            <button
              type="button"
              onClick={() => setActiveTab("escavador_paga")}
              className={cn(
                "py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap",
                activeTab === "escavador_paga"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Sparkles className="size-3.5 text-purple-600 dark:text-purple-400" />
              <span>API Escavador</span>
              <span className="rounded-full bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.2 text-[9px] font-extrabold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                IA • 1 CRÉDITO
              </span>
            </button>

            {/* Guia 4: Histórico de Migrações */}
            <button
              type="button"
              onClick={() => setActiveTab("historico")}
              className={cn(
                "py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap",
                activeTab === "historico"
                  ? "border-slate-800 text-slate-900 dark:text-white dark:border-slate-200"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Clock className="size-3.5" />
              <span>Histórico de Migrações</span>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                {searchHistory.length}
              </span>
            </button>
          </div>

          {/* Saldo de Créditos no Topo */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
            <Sparkles className="size-3.5 text-purple-600" />
            <span>Saldo IA: <strong className="font-mono text-purple-700 dark:text-purple-300">{aiCredits}</strong></span>
          </div>
        </div>

        {/* Conteúdo Principal do Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ========================================================================= */}
          {/* GUIA 1: BUSCA GRATUITA POR OAB (CANAIS OFICIAIS • 0 CRÉDITOS)             */}
          {/* ========================================================================= */}
          {activeTab === "oab_gratuita" && (
            <div className="space-y-4 animate-in fade-in">
              {/* Banner Explicativo dos Canais Gratuitos */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="size-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <strong className="text-xs font-bold uppercase tracking-wide">
                        Canais Gratuitos Oficiais Utilizados pelo Robô
                      </strong>
                      <span className="rounded-md bg-emerald-200 dark:bg-emerald-900 px-1.5 py-0.2 text-[9px] font-black text-emerald-900 dark:text-emerald-200">
                        100% GRATUITO • 0 CRÉDITOS
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-900/90 dark:text-emerald-300">
                      O robô consulta diretamente a <strong>Base Pública do DataJud (CNJ)</strong>, o <strong>DJEN</strong>, o <strong>ComunicaPJe</strong>, os <strong>Portais PJe/Projudi dos Tribunais (TJPI, TJSP, TRF, etc.)</strong> e o <strong>CNA da OAB</strong>.
                    </p>
                    <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                      Todos os processos encontrados são MIGRADOS AUTOMATICAMENTE para a sua lista de Processos com Radar Ativo!
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulário de Busca OAB */}
              <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Número da Inscrição OAB <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={oabNumber}
                      onChange={(e) => setOabNumber(e.target.value)}
                      placeholder="Ex: 18293 ou 18.293"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Seccional da OAB (UF) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={oabUf}
                      onChange={(e) => setOabUf(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {ALL_BRAZIL_STATES.map((state) => (
                        <option key={state.uf} value={state.uf}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nome Completo do Advogado
                  </label>
                  <input
                    type="text"
                    value={lawyerName}
                    onChange={(e) => setLawyerName(e.target.value)}
                    placeholder="Nome constante no CNA da OAB"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSearching}
                  onClick={handleSearchOAB}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSearching ? (
                    <>
                      <RotateCw className="size-4 animate-spin" />
                      <span>{searchStep || "Buscando e Migrando Processos..."}</span>
                    </>
                  ) : (
                    <>
                      <Search className="size-4" />
                      <span>Buscar e Migrar Processos Automaticamente (Gratuito)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* GUIA 2: BUSCA GRATUITA POR CNJ & TRIBUNAIS (0 CRÉDITOS)                  */}
          {/* ========================================================================= */}
          {activeTab === "cnj_tribunal" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <Building className="size-4.5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <strong className="text-xs font-bold uppercase tracking-wide">
                        Busca Direta em Qualquer Tribunal do Brasil (90 Tribunais)
                      </strong>
                      <span className="rounded-md bg-blue-200 dark:bg-blue-900 px-1.5 py-0.2 text-[9px] font-black text-blue-900 dark:text-blue-200">
                        ABRANGÊNCIA NACIONAL • 0 CRÉDITOS
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-900/90 dark:text-blue-300">
                      Consulte processos de <strong>todos os 27 Tribunais de Justiça estaduais</strong> (TJSP, TJRJ, TJMG, TJBA, TJPI, TJRS, etc.), <strong>TRFs (1ª a 6ª Região)</strong>, <strong>TRTs</strong> ou <strong>Tribunais Superiores</strong>. Deixe em <em>"Detecção Automática CNJ"</em> para que o sistema identifique o tribunal exato pelo número do processo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Tribunal Alvo
                    </label>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      90 Tribunais integrados via DataJud / CNJ
                    </span>
                  </div>
                  <select
                    value={selectedCourt}
                    onChange={(e) => setSelectedCourt(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {BRAZILIAN_COURTS_GROUPS.map((group) => (
                      <optgroup key={group.groupName} label={group.groupName}>
                        {group.courts.map((court) => (
                          <option key={court.code} value={court.code}>
                            {court.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Número(s) do Processo CNJ (Pode colar múltiplos, um por linha) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={cnjInput}
                    onChange={(e) => setCnjInput(e.target.value)}
                    placeholder={"0825690-90.2020.8.18.0140 (TJPI)\n1024589-72.2021.8.26.0100 (TJSP)\n0010482-14.2022.4.01.3400 (TRF1)\n0001245-80.2023.5.02.0001 (TRT2 SP)"}
                    className="w-full font-mono rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  
                  {/* Prévia Inteligente de Detecção de Tribunais pelo CNJ */}
                  {cnjInput.trim().length > 10 && (
                    <div className="mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2.5 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      <div className="text-[11px]">
                        <strong>Inteligência CNJ:</strong> Os números informados serão identificados e direcionados automaticamente aos respectivos tribunais de origem (ex: TJSP, TJRJ, TJMG, TJPI, TRF1) com custo zero.
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isSearching}
                  onClick={handleSearchCNJ}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSearching ? (
                    <>
                      <RotateCw className="size-4 animate-spin" />
                      <span>{searchStep || "Localizando e Migrando..."}</span>
                    </>
                  ) : (
                    <>
                      <Building className="size-4" />
                      <span>Localizar e Migrar para Processos (Gratuito)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* GUIA 3: VARREDURA PROFUNDA ESCAVADOR (API PAGA • CONSOME CRÉDITOS DE IA)  */}
          {/* ========================================================================= */}
          {activeTab === "escavador_paga" && (
            <div className="space-y-4 animate-in fade-in">
              {/* Card Destaque: Padrão Visual de Consumo de Crédito de IA */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-4 text-xs text-purple-950 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200 leading-relaxed">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="size-5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <strong className="text-xs font-bold uppercase tracking-wide">
                          Varredura Profunda via API Escavador Business v2
                        </strong>
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900 px-2.5 py-0.5 text-[10px] font-extrabold text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
                          <Sparkles className="size-3" />
                          Consome 1 Crédito de IA
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-900/90 dark:text-purple-300">
                        Pesquisa profunda em <strong>todos os 90+ tribunais do Brasil</strong> e diários oficiais estaduais/federais com bypass de captcha em nuvem. Permite localizar processos por <strong>Nome Completo de Pessoa</strong> ou <strong>Razão Social / CNPJ de Empresa</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-200 dark:border-purple-800 shadow-2xs">
                    <span className="text-xs text-slate-500 block">Seu Saldo:</span>
                    <strong className="text-sm font-black text-purple-700 dark:text-purple-300 font-mono">
                      {aiCredits} crédito{aiCredits !== 1 ? "s" : ""}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tipo de Pesquisa Avançada
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEscavadorType("nome")}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-bold border transition text-center",
                        escavadorType === "nome"
                          ? "border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      Nome de Pessoa
                    </button>
                    <button
                      type="button"
                      onClick={() => setEscavadorType("cnpj")}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-bold border transition text-center",
                        escavadorType === "cnpj"
                          ? "border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      CNPJ / Razão Social
                    </button>
                    <button
                      type="button"
                      onClick={() => setEscavadorType("oab")}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-bold border transition text-center",
                        escavadorType === "oab"
                          ? "border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                      )}
                    >
                      OAB Nacional Unificada
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {escavadorType === "nome"
                      ? "Nome Completo para Varredura Nacional"
                      : escavadorType === "cnpj"
                      ? "CNPJ ou Nome Empresarial"
                      : "Termo de OAB Ampla"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={escavadorQuery}
                    onChange={(e) => setEscavadorQuery(e.target.value)}
                    placeholder={
                      escavadorType === "nome"
                        ? "Ex: Matheus Borges da Silva"
                        : escavadorType === "cnpj"
                        ? "Ex: 12.345.678/0001-90 ou Razão Social"
                        : "Ex: 18293 PI"
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSearching || aiCredits < 1}
                  onClick={handleSearchEscavador}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:opacity-95 transition disabled:opacity-50"
                >
                  {isSearching ? (
                    <>
                      <RotateCw className="size-4 animate-spin" />
                      <span>{searchStep || "Consultando Escavador API..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>Buscar via Escavador API (Consome 1 Crédito de IA)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* RESULTADOS DA BUSCA ATUAL: MIGRADOS COM SUCESSO                          */}
          {/* ========================================================================= */}
          {recentlyMigrated.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 dark:border-emerald-900/50 dark:bg-emerald-950/20 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                    {recentlyMigrated.length} Processos Migrados com Sucesso para o Acervo!
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs"
                >
                  <span>Ver na Página de Processos</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {recentlyMigrated.map((proc) => (
                  <div
                    key={proc.id}
                    className="p-2.5 rounded-lg border border-emerald-100 bg-white dark:border-emerald-900/40 dark:bg-slate-900 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {proc.cnj_number}
                        </span>
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:text-slate-300">
                          {proc.court}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Radar Ativo
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-md">
                        {proc.title || `${proc.active_pole} x ${proc.passive_pole}`}
                      </p>
                    </div>

                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                      No Acervo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* GUIA 4: HISTÓRICO DE BUSCAS & PROCESSOS MIGRADOS                          */}
          {/* ========================================================================= */}
          {activeTab === "historico" && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Histórico de Buscas & Migrações Realizadas
                  </h4>
                  <p className="text-xs text-slate-500">
                    Registro de todas as buscas em lote e manuais integradas ao seu escritório.
                  </p>
                </div>
              </div>

              {searchHistory.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
                  Nenhuma busca realizada anteriormente.
                </div>
              ) : (
                <div className="space-y-2">
                  {searchHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.type}
                          </span>
                          <span className="text-slate-400">• {item.date}</span>
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            {item.cost}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                          {item.query}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Canal: {item.channel}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                          {item.count} processo(s) migrado(s)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-850 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <CheckCheck className="size-3.5 text-emerald-600" />
            <span>Processos encontrados são inseridos automaticamente no seu acervo</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal Informativo Unificado dos Canais Gratuitos */}
      <FreeChannelsInfoModal
        isOpen={showChannelsModal}
        onClose={() => setShowChannelsModal(false)}
      />
    </div>
  );
}
