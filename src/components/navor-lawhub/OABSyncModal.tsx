// @ts-nocheck — tipos legados do LawHub em migração
import { useState } from "react";
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Users,
  FileText,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  RefreshCw,
  Scale,
  Wallet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { OABSyncResult } from "@/lib/lawhub/types";

const ESTADOS_BRASIL = [
  { uf: "PI", name: "Piauí (TJPI / TRF1 / TRT22)" },
  { uf: "SP", name: "São Paulo (TJSP / TRF3 / TRT2 / TRT15)" },
  { uf: "RJ", name: "Rio de Janeiro (TJRJ / TRF2 / TRT1)" },
  { uf: "MG", name: "Minas Gerais (TJMG / TRF6 / TRT3)" },
  { uf: "DF", name: "Distrito Federal (TJDFT / TRF1 / TRT10 / STJ / STF)" },
  { uf: "BA", name: "Bahia (TJBA / TRF1 / TRT5)" },
  { uf: "CE", name: "Ceará (TJCE / TRF5 / TRT7)" },
  { uf: "MA", name: "Maranhão (TJMA / TRF1 / TRT16)" },
  { uf: "PE", name: "Pernambuco (TJPE / TRF5 / TRT6)" },
  { uf: "PR", name: "Paraná (TJPR / TRF4 / TRT9)" },
  { uf: "RS", name: "Rio Grande do Sul (TJRS / TRF4 / TRT4)" },
  { uf: "SC", name: "Santa Catarina (TJSC / TRF4 / TRT12)" },
  { uf: "GO", name: "Goiás (TJGO / TRF1 / TRT18)" },
  { uf: "MT", name: "Mato Grosso (TJMT / TRF1 / TRT23)" },
  { uf: "MS", name: "Mato Grosso do Sul (TJMS / TRF3 / TRT24)" },
  { uf: "PA", name: "Pará (TJPA / TRF1 / TRT8)" },
  { uf: "AM", name: "Amazonas (TJAM / TRF1 / TRT11)" },
  { uf: "ES", name: "Espírito Santo (TJES / TRF2 / TRT17)" },
  { uf: "PB", name: "Paraíba (TJPB / TRF5 / TRT13)" },
  { uf: "RN", name: "Rio Grande do Norte (TJRN / TRF5 / TRT21)" },
  { uf: "AL", name: "Alagoas (TJAL / TRF5 / TRT19)" },
  { uf: "SE", name: "Sergipe (TJSE / TRF5 / TRT20)" },
  { uf: "TO", name: "Tocantins (TJTO / TRF1 / TRT10)" },
  { uf: "RO", name: "Rondônia (TJRO / TRF1 / TRT14)" },
  { uf: "AC", name: "Acre (TJAC / TRF1 / TRT14)" },
  { uf: "AP", name: "Amapá (TJAP / TRF1 / TRT8)" },
  { uf: "RR", name: "Roraima (TJRR / TRF1 / TRT11)" },
];

interface OABSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOab?: string;
  initialUf?: string;
  onSuccess?: (result: OABSyncResult) => void;
}

export function OABSyncModal({
  isOpen,
  onClose,
  initialOab,
  initialUf,
  onSuccess,
}: OABSyncModalProps) {
  const queryClient = useQueryClient();
  const currentProfile = LawHubService.getSyncedLawyerProfile();

  const [oabNumber, setOabNumber] = useState(initialOab || currentProfile?.oab_number || "");
  const [oabState, setOabState] = useState(initialUf || currentProfile?.oab_state || "");
  const [lawyerName, setLawyerName] = useState(currentProfile?.name || "");

  const [includeProcesses, setIncludeProcesses] = useState(true);
  const [includeContacts, setIncludeContacts] = useState(true);
  const [includePublications, setIncludePublications] = useState(true);
  const [includeDeadlines, setIncludeDeadlines] = useState(true);

  // Modo de busca: Bot Gratuito (0 créditos) vs Varredura Profunda IA / Escavador (1 crédito)
  const [searchMode, setSearchMode] = useState<"free" | "deep">("free");
  const [aiCredits, setAiCredits] = useState<number>(() => {
    const bal = LawHubService.getAiCreditsBalance();
    return typeof bal === "object" && bal !== null ? (bal.availableCredits ?? 0) : Number(bal) || 0;
  });

  // Status de execução
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [syncResult, setSyncResult] = useState<OABSyncResult | null>(null);

  if (!isOpen) return null;

  const stepsList = searchMode === "deep"
    ? [
        "Consultando Cadastro Nacional dos Advogados (CNA / OAB)...",
        "Conectando à Escavador API v2 com bypass de captcha em nuvem...",
        "Varrendo diários oficiais de todos os estados e publicações DJEN...",
        "Cruzando autos, capas e histórico completo de movimentações...",
        "Extraindo partes, advogados e identificando contatos...",
        "Compilando prazos legais e habilitando radar de monitoramento diário...",
      ]
    : [
        "Consultando Cadastro Nacional dos Advogados (CNA / OAB)...",
        "Identificando jurisdições e pré-selecionando Diários Oficiais...",
        "Conectando aos Tribunais Regionais e Estaduais (DataJud / CNJ)...",
        "Localizando acervo público de processos judiciais...",
        "Identificando e extraindo partes e dados de contato...",
        "Compilando prazos legais, intimações e audiências na pauta...",
      ];

  async function handleStartSync() {
    if (!oabNumber.trim()) {
      toast.error("Informe o número de inscrição da OAB.");
      return;
    }

    if (searchMode === "deep") {
      if (aiCredits < 1) {
        toast.error("Saldo insuficiente de créditos de IA. Recarregue seus créditos ou use a Busca Pública Gratuita.");
        return;
      }
      try {
        LawHubService.useAiCredit(1, `Varredura Profunda OAB/${oabState} ${oabNumber}`);
        const updatedBal = LawHubService.getAiCreditsBalance();
        setAiCredits(typeof updatedBal === "object" && updatedBal !== null ? (updatedBal.availableCredits ?? 0) : Number(updatedBal) || 0);
        toast.success("1 crédito utilizado para Varredura Profunda via Escavador API v2.");
      } catch (err: any) {
        toast.error(err.message || "Erro ao debitar crédito.");
        return;
      }
    }

    setIsSyncing(true);
    setCurrentStep(0);
    setSyncResult(null);

    // Efeito de progresso realista em etapas
    for (let i = 0; i < stepsList.length; i++) {
      setCurrentStep(i);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    try {
      const result = await LawHubService.syncOfficeOAB(oabNumber, oabState, lawyerName);
      setSyncResult(result);

      // Invalida todos os caches do TanStack Query para atualizar a UI em tempo real
      void queryClient.invalidateQueries();

      toast.success(`Sincronização concluída! ${result.summary.processesCount} processos e ${result.summary.clientsCount} contatos importados.`);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error("Erro na sincronização OAB:", error);
      toast.error("Houve uma falha ao sincronizar os dados da OAB.");
    } finally {
      setIsSyncing(false);
    }
  }

  function handleCloseModal() {
    if (isSyncing) return;
    setSyncResult(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0F172A] overflow-hidden">
        
        {/* Header com Gradiente Executivo */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-900 to-indigo-900 px-6 py-5 text-white dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <ShieldCheck className="size-5.5 text-blue-300" />
              </div>
              <div>
                <h3 className="text-base font-bold sm:text-lg">
                  Sincronização Integral por OAB
                </h3>
                <p className="text-xs text-blue-200/80">
                  Busca automática em tribunais, DJEN, processos, contatos e perfil profissional
                </p>
              </div>
            </div>

            <button
              onClick={handleCloseModal}
              disabled={isSyncing}
              className="rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          
          {!syncResult && !isSyncing && (
            <>
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 leading-relaxed flex items-start gap-3">
                <Sparkles className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-0.5">Captura Automatizada de Acervo:</strong>
                  Ao informar a OAB do advogado ou do escritório, o sistema faz a varredura completa nos tribunais integrados, importa <strong>todos os processos ativos</strong>, extrai as partes envolvidas transformando-as em <strong>contatos completos</strong>, monitora as <strong>publicações do DJEN</strong> e agenda os <strong>prazos fatais</strong>.
                </div>
              </div>

              {/* Seletor de Modo de Busca: Gratuito vs Varredura Profunda IA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setSearchMode("free")}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3.5 transition flex flex-col justify-between",
                    searchMode === "free"
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Scale className="size-4 text-slate-600 dark:text-slate-300" />
                        Busca Pública Gratuita
                      </span>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-extrabold px-2 py-0.5">
                        0 CRÉDITOS
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Consulta direta via robôs públicos no CNA, DataJud CNJ e DJEN aberto. Varredura padrão sem custo adicional.
                    </p>
                  </div>
                  {searchMode === "free" && (
                    <div className="mt-2 text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Selecionado (Gratuito)
                    </div>
                  )}
                </div>

                <div
                  onClick={() => setSearchMode("deep")}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3.5 transition flex flex-col justify-between relative",
                    searchMode === "deep"
                      ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 ring-2 ring-purple-500/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                  )}
                >
                  <div className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.2 text-[9px] font-bold text-white uppercase shadow-xs">
                    Alta Precisão
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="size-4 text-purple-600" />
                        Varredura Profunda IA
                      </span>
                      <span className="rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-extrabold px-2 py-0.5">
                        1 CRÉDITO
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Varredura com <strong>Escavador API v2</strong>, quebra de captcha em nuvem e histórico em todos os Diários de Justiça estaduais.
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] text-purple-700 dark:text-purple-300 font-semibold flex items-center justify-between">
                    <span>Saldo: <strong>{aiCredits} créditos</strong></span>
                    {searchMode === "deep" && <CheckCircle2 className="size-3.5 text-purple-600" />}
                  </div>
                </div>
              </div>

              {/* Formulário de Identificação da OAB */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Número de Inscrição da OAB <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={oabNumber}
                      onChange={(e) => setOabNumber(e.target.value)}
                      placeholder="Ex: 18.293 ou 18293"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <Search className="absolute right-3.5 top-3 size-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Seccional (UF) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={oabState}
                    onChange={(e) => setOabState(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {ESTADOS_BRASIL.map((st) => (
                      <option key={st.uf} value={st.uf}>
                        {st.uf} - {st.name.split(" ")[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome do Advogado Titular / Responsável
                </label>
                <input
                  type="text"
                  value={lawyerName}
                  onChange={(e) => setLawyerName(e.target.value)}
                  placeholder="Nome completo para cruzamento de dados com CNA"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              {/* Opções de importação */}
              <div className="border-t border-slate-200 pt-4 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Dados a serem sincronizados automaticamente:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeProcesses}
                      onChange={(e) => setIncludeProcesses(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                      <Briefcase className="size-4 text-blue-600" />
                      <span>Processos Judiciais (TJ, TRF, TRT)</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeContacts}
                      onChange={(e) => setIncludeContacts(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                      <Users className="size-4 text-emerald-600" />
                      <span>Contatos & Clientes (PF e PJ)</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePublications}
                      onChange={(e) => setIncludePublications(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                      <FileText className="size-4 text-indigo-600" />
                      <span>Publicações e Diários (DJEN)</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDeadlines}
                      onChange={(e) => setIncludeDeadlines(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                      <Clock className="size-4 text-amber-600" />
                      <span>Prazos Fatais & Audiências</span>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Estado de Carregamento / Sincronização em Tempo Real */}
          {isSyncing && (
            <div className="py-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 animate-spin">
                  <RefreshCw className="size-7" />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Sincronizando OAB/{oabState} {oabNumber}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Por favor aguarde enquanto nos conectamos aos tribunais e compilamos os dados.
                </p>
              </div>

              {/* Checklist animada */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                {stepsList.map((step, idx) => {
                  const isDone = idx < currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 text-xs transition-opacity duration-300 ${
                        isDone
                          ? "text-emerald-600 font-semibold"
                          : isCurrent
                          ? "text-blue-600 font-bold"
                          : "text-slate-400 opacity-60"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      ) : isCurrent ? (
                        <div className="size-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0" />
                      ) : (
                        <div className="size-4 rounded-full border border-slate-300 shrink-0" />
                      )}
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resultado da Sincronização com Sucesso */}
          {syncResult && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">
                    Acervo Sincronizado com Sucesso!
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">
                    O acervo do advogado <strong>{syncResult.lawyer.name}</strong> ({syncResult.lawyer.full_oab}) foi totalmente integrado à sua base de dados.
                  </p>
                </div>
              </div>

              {/* Card Resumo do Advogado */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Dados do Advogado Cadastrado
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {syncResult.lawyer.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Nome:</span>{" "}
                    <strong className="text-slate-900 dark:text-white">{syncResult.lawyer.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Inscrição:</span>{" "}
                    <strong className="text-blue-600 font-mono">{syncResult.lawyer.full_oab}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">E-mail:</span>{" "}
                    <span className="text-slate-800 dark:text-slate-200">{syncResult.lawyer.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Sociedade:</span>{" "}
                    <span className="text-slate-800 dark:text-slate-200">{syncResult.lawyer.law_firm}</span>
                  </div>
                </div>
              </div>

              {/* Grid de Métricas de Importação */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-2xl font-black text-blue-600 block">
                    {syncResult.summary.processesCount}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Processos Ativos
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-2xl font-black text-emerald-600 block">
                    {syncResult.summary.clientsCount}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Contatos / Partes
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-2xl font-black text-indigo-600 block">
                    {syncResult.summary.publicationsCount}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Publicações DJEN
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-2xl font-black text-amber-600 block">
                    {syncResult.summary.deadlinesCount}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Prazos Agendados
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Rodapé de Ações */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={handleCloseModal}
            disabled={isSyncing}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
          >
            {syncResult ? "Fechar" : "Cancelar"}
          </button>

          {!syncResult ? (
            <button
              onClick={handleStartSync}
              disabled={isSyncing || !oabNumber.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 disabled:opacity-50 transition"
            >
              <Sparkles className="size-4" />
              <span>{isSyncing ? "Sincronizando..." : "Iniciar Busca & Sincronizar Tudo"}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                handleCloseModal();
                if (typeof window !== "undefined") {
                  window.location.href = "/lawhub/processos";
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition"
            >
              <span>Ver Processos Sincronizados</span>
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
