// @ts-nocheck — tipos legados do LawHub em migração
import React, { useState } from "react";
import {
  X,
  Zap,
  Search,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Clock,
  Building2,
  User,
  Star,
  Download,
  Copy,
  Code2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  FileText,
  Wallet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EscavadorService } from "@/lib/lawhub/escavador-service";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { LawProcess } from "@/lib/lawhub/types";
import { useQueryClient } from "@tanstack/react-query";

interface EscavadorTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessImported?: (process: LawProcess) => void;
}

export function EscavadorTestModal({
  isOpen,
  onClose,
  onProcessImported,
}: EscavadorTestModalProps) {
  const queryClient = useQueryClient();

  const apiKey = EscavadorService.getApiKey();

  const [queryType, setQueryType] = useState<"cnj" | "movimentacoes" | "oab" | "envolvido" | "saldo">("cnj");
  const [cnjInput, setCnjInput] = useState("1016489-84.2025.4.01.4000");
  const [oabNumber, setOabNumber] = useState("12345");
  const [oabUf, setOabUf] = useState("PI");
  const [envolvidoNome, setEnvolvidoNome] = useState("");
  const [envolvidoCpfCnpj, setEnvolvidoCpfCnpj] = useState("");

  const [loading, setLoading] = useState(false);
  const [resultProcess, setResultProcess] = useState<LawProcess | null>(null);
  const [multipleResults, setMultipleResults] = useState<LawProcess[]>([]);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [executionStats, setExecutionStats] = useState<{
    durationMs?: number;
    source?: string;
    stepCount?: number;
  } | null>(null);

  const [balanceData, setBalanceData] = useState<{
    saldo?: number;
    saldo_creditos?: number;
    tipo?: string;
  } | null>(null);

  const [showRawJson, setShowRawJson] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckBalance = async () => {
    setLoading(true);
    setBalanceData(null);
    try {
      const res = await EscavadorService.getBalance();
      if (res.success) {
        setBalanceData(res.data);
        setRawResponse(res.raw);
        toast.success(`Saldo retornado da Escavador API com sucesso!`);
      } else {
        toast.error(res.error || "Erro ao consultar saldo.");
      }
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTest = async () => {
    if (!apiKey.trim()) {
      toast.error("Token da Escavador não configurado na Retaguarda Administrativa.");
      return;
    }

    setLoading(true);
    setResultProcess(null);
    setMultipleResults([]);
    setRawResponse(null);
    setExecutionStats(null);
    setBalanceData(null);
    setLastError(null);

    const toastId = toast.loading("Consultando Escavador API v2...");

    try {
      if (queryType === "saldo") {
        toast.dismiss(toastId);
        await handleCheckBalance();
        return;
      }

      if (queryType === "cnj") {
        const cleanCnj = cnjInput.trim();
        if (cleanCnj.length < 15) {
          toast.dismiss(toastId);
          toast.error("Informe um CNJ válido.");
          setLoading(false);
          return;
        }

        const res = await EscavadorService.searchByCNJ(cleanCnj);
        toast.dismiss(toastId);

        if (res.success && res.process) {
          setResultProcess(res.process);
          setRawResponse(res.raw);
          setExecutionStats({
            durationMs: res.durationMs,
            source: res.source,
            stepCount: res.process.movements?.length || 0,
          });
          toast.success("Processo localizado com sucesso no Escavador v2!");
        } else {
          setRawResponse(res.raw);
          setLastError(res.error || "Processo não localizado no Escavador.");
          toast.error(res.error || "Processo não localizado no Escavador.");
        }
      } else if (queryType === "movimentacoes") {
        const cleanCnj = cnjInput.trim();
        const res = await EscavadorService.getMovements(cleanCnj);
        toast.dismiss(toastId);

        if (res.success) {
          setRawResponse(res.raw);
          toast.success(`${res.items?.length || 0} movimentações retornadas pelo Escavador!`);
        } else {
          setRawResponse(res.raw);
          setLastError(res.error || "Erro ao consultar movimentações.");
          toast.error(res.error || "Erro ao consultar movimentações.");
        }
      } else if (queryType === "oab") {
        const res = await EscavadorService.searchByOAB(oabNumber.trim(), oabUf.trim());
        toast.dismiss(toastId);

        if (res.success) {
          setMultipleResults(res.processes || []);
          setRawResponse(res.raw);
          if (res.processes && res.processes.length > 0) {
            toast.success(`${res.processes.length} processos encontrados para a OAB/${oabUf} ${oabNumber}!`);
          } else {
            toast.info(`Busca concluída. Nenhum processo indexado retornado para a OAB/${oabUf} ${oabNumber}.`);
          }
        } else {
          setRawResponse(res.raw);
          setLastError(res.error || "Nenhum processo localizado para esta OAB.");
          toast.error(res.error || "Nenhum processo localizado para esta OAB.");
        }
      } else if (queryType === "envolvido") {
        const res = await EscavadorService.searchByEnvolvido({
          nome: envolvidoNome.trim() || undefined,
          cpf_cnpj: envolvidoCpfCnpj.trim() || undefined,
        });
        toast.dismiss(toastId);

        if (res.success) {
          setMultipleResults(res.processes || []);
          setRawResponse(res.raw);
          if (res.processes && res.processes.length > 0) {
            toast.success(`${res.processes.length} processos vinculados ao envolvido encontrados!`);
          } else {
            toast.info("Busca concluída. Nenhum processo localizado para os critérios informados.");
          }
        } else {
          setRawResponse(res.raw);
          setLastError(res.error || "Nenhum processo localizado para este envolvido.");
          toast.error(res.error || "Nenhum processo localizado para este envolvido.");
        }
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      const errMsg = `Erro ao consultar Escavador: ${err.message || String(err)}`;
      setLastError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleImportProcess = async (processToImport: LawProcess) => {
    setImporting(true);
    const toastId = toast.loading("Importando processo para a carteira LawHub...");

    try {
      const cleanDigits = processToImport.cnj_number.replace(/\D/g, "");
      const finalProcess: LawProcess = {
        ...processToImport,
        id: processToImport.id || `escavador-${cleanDigits}`,
        status: "ativo",
        monitoring_type: "automatico",
        court_linked: true,
        is_radar_monitored: true,
        tags: Array.from(new Set([...(processToImport.tags || []), "Escavador v2", "Radar Ativo"])),
      };

      await LawHubService.saveProcess(finalProcess);

      // Consome 1 crédito se configurado
      try {
        LawHubService.useAiCredit(1, `Importação Escavador API: ${finalProcess.cnj_number}`);
      } catch {}

      toast.dismiss(toastId);
      toast.success("Processo importado com sucesso no acervo LawHub!");

      queryClient.invalidateQueries({ queryKey: ["law_processes"] });
      queryClient.invalidateQueries({ queryKey: ["tenant_quotas"] });

      if (onProcessImported) {
        onProcessImported(finalProcess);
      }
      onClose();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Erro na importação: ${err.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Laboratório de Teste · Escavador API v2</h3>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/30">
                  Documentação Oficial 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Teste rotas ao vivo de Processos, Diários Oficiais, OAB, Movimentações e Saldo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {apiKey ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>Token Central Conectado</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-400">
                <AlertTriangle className="size-3.5 text-amber-400" />
                <span>Token Ausente na Retaguarda</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!apiKey && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="size-4.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-0.5">Token não configurado na Retaguarda:</strong>
                A inclusão do Token Bearer da Escavador API v2 é realizada exclusivamente na retaguarda administrativa do LawHub SaaS (Painel de Administração &gt; APIs Jurídicas).
              </div>
            </div>
          )}
          {/* Seletor de Tipo de Consulta */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              onClick={() => setQueryType("cnj")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition",
                queryType === "cnj"
                  ? "border-blue-500 bg-blue-500/10 text-white font-bold"
                  : "border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200"
              )}
            >
              <Scale className="size-4 mb-1 text-blue-400" />
              <span className="text-xs">Processo (CNJ)</span>
              <span className="text-[10px] text-slate-500">Capa & Dados</span>
            </button>

            <button
              onClick={() => setQueryType("movimentacoes")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition",
                queryType === "movimentacoes"
                  ? "border-blue-500 bg-blue-500/10 text-white font-bold"
                  : "border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200"
              )}
            >
              <Clock className="size-4 mb-1 text-cyan-400" />
              <span className="text-xs">Movimentações</span>
              <span className="text-[10px] text-slate-500">Histórico Oficial</span>
            </button>

            <button
              onClick={() => setQueryType("oab")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition",
                queryType === "oab"
                  ? "border-blue-500 bg-blue-500/10 text-white font-bold"
                  : "border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200"
              )}
            >
              <User className="size-4 mb-1 text-emerald-400" />
              <span className="text-xs">Acervo por OAB</span>
              <span className="text-[10px] text-slate-500">Lote Advogado</span>
            </button>

            <button
              onClick={() => setQueryType("envolvido")}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition",
                queryType === "envolvido"
                  ? "border-blue-500 bg-blue-500/10 text-white font-bold"
                  : "border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200"
              )}
            >
              <Building2 className="size-4 mb-1 text-purple-400" />
              <span className="text-xs">Por Envolvido</span>
              <span className="text-[10px] text-slate-500">Nome / CNPJ</span>
            </button>

            <button
              onClick={() => {
                setQueryType("saldo");
                handleCheckBalance();
              }}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition",
                queryType === "saldo"
                  ? "border-blue-500 bg-blue-500/10 text-white font-bold"
                  : "border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200"
              )}
            >
              <Wallet className="size-4 mb-1 text-amber-400" />
              <span className="text-xs">Saldo / Créditos</span>
              <span className="text-[10px] text-slate-500">Conta Escavador</span>
            </button>
          </div>

          {/* Campos de Entrada */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-4">
            {(queryType === "cnj" || queryType === "movimentacoes") && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Número do Processo (CNJ)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cnjInput}
                    onChange={(e) => setCnjInput(e.target.value)}
                    placeholder="Ex: 1016489-84.2025.4.01.4000"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleExecuteTest}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    <span>Testar Rota</span>
                  </button>
                </div>
              </div>
            )}

            {queryType === "oab" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Número da OAB</label>
                  <input
                    type="text"
                    value={oabNumber}
                    onChange={(e) => setOabNumber(e.target.value)}
                    placeholder="Ex: 12345"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">UF da Seccional</label>
                  <input
                    type="text"
                    value={oabUf}
                    onChange={(e) => setOabUf(e.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="PI"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    onClick={handleExecuteTest}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    <span>Buscar Processos por OAB (Escavador v2)</span>
                  </button>
                </div>
              </div>
            )}

            {queryType === "envolvido" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Nome Completo / Razão Social</label>
                    <input
                      type="text"
                      value={envolvidoNome}
                      onChange={(e) => setEnvolvidoNome(e.target.value)}
                      placeholder="Ex: Banco do Brasil SA ou Nome da Pessoa"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">CPF ou CNPJ</label>
                    <input
                      type="text"
                      value={envolvidoCpfCnpj}
                      onChange={(e) => setEnvolvidoCpfCnpj(e.target.value)}
                      placeholder="Somente números ou formatado"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleExecuteTest}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  <span>Buscar Processos do Envolvido</span>
                </button>
              </div>
            )}

            {queryType === "saldo" && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-950/30 border border-blue-500/20">
                <div className="flex items-center gap-3">
                  <Wallet className="size-6 text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Saldo de Créditos Escavador</h4>
                    <p className="text-xs text-slate-400">Endpoint: GET /api/v2/saldo</p>
                  </div>
                </div>
                <button
                  onClick={handleCheckBalance}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition"
                >
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                  <span>Recarregar</span>
                </button>
              </div>
            )}
          </div>

          {/* Banner de Diagnóstico de Erro (HTTP 402 Saldo ou outros) */}
          {lastError && (
            <div className={cn(
              "rounded-xl border p-4.5 text-xs transition animate-in fade-in slide-in-from-top-2",
              lastError.includes("402") || lastError.toLowerCase().includes("saldo")
                ? "border-amber-500/40 bg-amber-950/30 text-amber-200"
                : "border-rose-500/40 bg-rose-950/30 text-rose-200"
            )}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={cn(
                  "size-5 shrink-0 mt-0.5",
                  lastError.includes("402") || lastError.toLowerCase().includes("saldo")
                    ? "text-amber-400"
                    : "text-rose-400"
                )} />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-sm text-white">
                      {lastError.includes("402") || lastError.toLowerCase().includes("saldo")
                        ? "API Escavador Conectada · Sem Saldo de Créditos (HTTP 402)"
                        : "Diagnóstico da Chamada à API"}
                    </h5>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10">
                      {lastError.includes("402") ? "HTTP 402" : "Atenção"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {lastError}
                  </p>

                  {lastError.includes("402") && (
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <a
                        href="https://api.escavador.com/painel/creditos"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                      >
                        <Wallet className="size-3.5" />
                        <span>Recarregar Créditos no Escavador</span>
                        <ExternalLink className="size-3 ml-0.5" />
                      </a>

                      <button
                        onClick={() => {
                          setQueryType("saldo");
                          handleCheckBalance();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                      >
                        <RefreshCw className="size-3" />
                        <span>Ver Saldo Atual</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Exibição do Saldo */}
          {balanceData && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-300">Créditos Disponíveis na Escavador</span>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {balanceData.saldo_creditos ?? balanceData.saldo ?? "—"}
                  <span className="text-xs text-amber-300 font-normal ml-2">créditos</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400">Tipo de Conta</span>
                <div className="text-sm font-bold text-slate-200 capitalize">
                  {balanceData.tipo || "API Business v2"}
                </div>
              </div>
            </div>
          )}

          {/* Resultado Processo Único */}
          {resultProcess && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-400" />
                    <h4 className="text-base font-bold text-white">{resultProcess.title}</h4>
                  </div>
                  <p className="text-xs text-emerald-300 mt-1">
                    CNJ: {resultProcess.cnj_number} • {resultProcess.court} • {resultProcess.judicial_branch}
                  </p>
                </div>
                <button
                  onClick={() => handleImportProcess(resultProcess)}
                  disabled={importing}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md transition disabled:opacity-50"
                >
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  <span>Importar para Acervo do LawHub</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Polo Ativo</span>
                  <p className="font-semibold text-white truncate">{resultProcess.active_pole || "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Polo Passivo</span>
                  <p className="font-semibold text-white truncate">{resultProcess.passive_pole || "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Classe Processual</span>
                  <p className="font-semibold text-white truncate">{resultProcess.procedural_class || "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Andamentos Encontrados</span>
                  <p className="font-semibold text-white">{resultProcess.movements?.length || 0} eventos</p>
                </div>
              </div>

              {resultProcess.movements && resultProcess.movements.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-300 mb-2">Últimas Movimentações Oficiais</h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {resultProcess.movements.slice(0, 5).map((m, idx) => (
                      <div key={idx} className="rounded-lg bg-slate-900/60 border border-slate-800/80 p-2.5 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span className="font-semibold text-blue-300">{m.date}</span>
                          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{m.type || "Andamento"}</span>
                        </div>
                        <p className="text-slate-200 text-xs">{m.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resultado Lista (OAB ou Envolvido) */}
          {multipleResults.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">
                  {multipleResults.length} Processos Retornados pelo Escavador
                </h4>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {multipleResults.map((proc, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 p-3 hover:border-slate-700 transition">
                    <div className="min-w-0 flex-1 pr-3">
                      <h5 className="text-xs font-bold text-white truncate">{proc.title || proc.cnj_number}</h5>
                      <p className="text-[11px] text-slate-400 truncate">
                        CNJ: <strong className="text-blue-400">{proc.cnj_number}</strong> • {proc.court} • {proc.procedural_class}
                      </p>
                      {proc.last_movement && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          Último ato: {proc.last_movement}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleImportProcess(proc)}
                      disabled={importing}
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition"
                    >
                      Importar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resposta Bruta JSON (Inspecionar payload real da API) */}
          {rawResponse && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/60"
              >
                <div className="flex items-center gap-2">
                  <Code2 className="size-4 text-purple-400" />
                  <span>Payload Bruto Escavador API (JSON)</span>
                </div>
                {showRawJson ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showRawJson && (
                <div className="p-4 bg-slate-950 border-t border-slate-800">
                  <pre className="text-[11px] font-mono text-emerald-400 max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(rawResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
