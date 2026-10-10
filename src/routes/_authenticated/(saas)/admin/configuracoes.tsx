import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, Button, Input, Label } from "@/components/navor-rephub/ui";
import {
  Settings,
  BellRing,
  Database,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Layers,
  Terminal,
  Code2,
  Copy,
  ExternalLink,
  Zap,
  FileCode,
  ShieldCheck,
  Check,
  ChevronRight,
  Scale,
  Camera,
  Mic,
  Volume2,
  Lock,
  Key,
  Mail,
  RefreshCw,
  Upload,
  Eye,
  Play,
  Square,
  StopCircle,
  Video,
  X,
  History,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { MasterSecurityConfig } from "@/lib/lawhub/types";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  updatePlatformSettings,
  getDatabaseHealth,
  repairAndSyncDatabase,
  getMigrationsList,
  executeMigration,
  executeRawSql,
  saveMasterSecuritySettings,
  getMasterSecuritySettings,
  getAdminPlatformSettings,
} from "@/api/admin-actions";

import { LegalProvidersAdminPanel } from "@/components/admin/LegalProvidersAdminPanel";

export const Route = createFileRoute("/_authenticated/(saas)/admin/configuracoes")({
  component: AdminConfiguracoesPage,
});

function AdminConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<"saude" | "migracoes" | "console" | "cobranca" | "provedores_juridicos" | "seguranca_master">("saude");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [executingMigrationId, setExecutingMigrationId] = useState<string | null>(null);
  const [viewSqlMigration, setViewSqlMigration] = useState<any | null>(null);
  const [customSql, setCustomSql] = useState("");
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [sqlResult, setSqlResult] = useState<any | null>(null);

  // Estados de Segurança do Administrador Geral
  const [masterSec, setMasterSec] = useState<MasterSecurityConfig>(() =>
    LawHubService.getMasterSecurityConfig()
  );
  const [savingSec, setSavingSec] = useState(false);

  // Carrega credenciais salvas na nuvem (banco de dados)
  useEffect(() => {
    getMasterSecuritySettings()
      .then((cloudConfig) => {
        if (cloudConfig) {
          setMasterSec((prev) => ({
            ...prev,
            primary_email: cloudConfig.primary_email || prev.primary_email,
            recovery_email: cloudConfig.recovery_email || prev.recovery_email,
            master_password: cloudConfig.master_password || prev.master_password,
          }));
        }
      })
      .catch(() => {});
  }, []);



  // Funções de Câmera (Face ID)
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: () => getAdminPlatformSettings(),
  });

  const {
    data: dbHealth,
    refetch: refetchHealth,
    isLoading: loadingHealth,
  } = useQuery({
    queryKey: ["admin_database_health"],
    queryFn: async () => {
      return await getDatabaseHealth();
    },
  });

  const {
    data: migrationsData,
    refetch: refetchMigrations,
    isLoading: loadingMigrations,
  } = useQuery({
    queryKey: ["admin_migrations_list"],
    queryFn: async () => {
      return await getMigrationsList();
    },
  });

  async function handleSubmitSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoadingSettings(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updatePlatformSettings({
        data: {
          billingAlertDays: Number(fd.get("billingAlertDays")),
        },
      });
      toast.success("Configurações salvas com sucesso!");
      refetchSettings();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingSettings(false);
    }
  }

  async function handleRepairDatabase() {
    setIsRepairing(true);
    try {
      const res = await repairAndSyncDatabase();
      toast.success("Banco de dados sincronizado e reparado com sucesso!");
      await refetchHealth();
      await refetchMigrations();
    } catch (err: any) {
      toast.error(`Erro ao sincronizar banco: ${err.message}`);
    } finally {
      setIsRepairing(false);
    }
  }

  async function handleRunMigration(migrationId: string) {
    setExecutingMigrationId(migrationId);
    try {
      const res = await executeMigration({ data: { migrationId } });
      if (res.success) {
        toast.success(res.message);
        await refetchHealth();
        await refetchMigrations();
      } else if (res.requiresManualSql) {
        toast.info("Esta migração requer criação direta no Supabase. O script foi carregado para você.");
        setViewSqlMigration({
          title: "Execução DDL",
          sqlSnippet: res.script,
          helperInstruction: res.helperInstruction,
        });
      }
    } catch (err: any) {
      toast.error(`Erro ao executar migração: ${err.message}`);
    } finally {
      setExecutingMigrationId(null);
    }
  }

  async function handleRunCustomSql() {
    if (!customSql.trim()) {
      toast.error("Insira um comando SQL para executar.");
      return;
    }
    setIsExecutingSql(true);
    setSqlResult(null);
    try {
      const res = await executeRawSql({ data: { sql: customSql } });
      toast.success("Comando SQL executado com sucesso!");
      setSqlResult(res);
      await refetchHealth();
      await refetchMigrations();
    } catch (err: any) {
      toast.error(err.message);
      setSqlResult({ error: err.message });
    } finally {
      setIsExecutingSql(false);
    }
  }

  function copyToClipboard(text: string, label: string = "Código SQL") {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  }

  if (!settings) return <div className="p-6 text-card-foreground">Carregando configurações...</div>;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Administração da Plataforma</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
              NAVOR Hub
            </span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">
            Central de Saúde, Migrações do Banco Supabase e Parâmetros Comerciais.
          </p>
        </div>

        {/* Botão de Auto-Reparo Global */}
        <Button
          size="sm"
          onClick={handleRepairDatabase}
          disabled={isRepairing}
          className="bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-xs shrink-0"
        >
          {isRepairing ? (
            <>
              <RotateCw className="size-3.5 mr-1.5 animate-spin" />
              <span>Sincronizando...</span>
            </>
          ) : (
            <>
              <Sparkles className="size-3.5 mr-1.5 text-amber-400" />
              <span>Sincronizar Banco em 1 Clique</span>
            </>
          )}
        </Button>
      </div>

      {/* Navegação por Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("saude")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "saude"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          }`}
        >
          <Database className="size-3.5" />
          <span>Saúde do Banco</span>
        </button>

        <button
          onClick={() => setActiveTab("migracoes")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "migracoes"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          }`}
        >
          <Zap className="size-3.5 text-amber-400" />
          <span>Central de Migrações (1-Clique)</span>
          {migrationsData?.summary?.pendingCount ? (
            <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full">
              {migrationsData.summary.pendingCount}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab("console")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "console"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          }`}
        >
          <Terminal className="size-3.5" />
          <span>Console SQL Administrativo</span>
        </button>

        <button
          onClick={() => setActiveTab("provedores_juridicos")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "provedores_juridicos"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          }`}
        >
          <Scale className="size-3.5 text-blue-400" />
          <span>APIs Jurídicas (Escavador API v2)</span>
          <span className="ml-1 px-1.5 py-0.2 bg-blue-500/20 text-blue-600 dark:text-blue-300 text-[10px] rounded-full font-bold">
            LawHub
          </span>
        </button>

        <button
          onClick={() => setActiveTab("cobranca")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "cobranca"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          }`}
        >
          <Settings className="size-3.5" />
          <span>Preferências de Cobrança</span>
        </button>

        <button
          onClick={() => setActiveTab("seguranca_master")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "seguranca_master"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          }`}
        >
          <ShieldCheck className="size-3.5 text-emerald-400" />
          <span>Administrador Geral & Biometria</span>
          <span className="ml-1 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] rounded-full font-bold">
            statosrep@gmail.com
          </span>
        </button>
      </div>

      {/* ABA 1: SAÚDE DO BANCO DE DADOS */}
      {activeTab === "saude" && (
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Database className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Diagnóstico da Base de Dados Supabase</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Conectado
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Verificação contínua de tabelas, integridade multi-tenant e módulos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetchHealth();
                    refetchMigrations();
                  }}
                  disabled={loadingHealth}
                  className="text-xs font-semibold border-slate-200 dark:border-slate-800"
                >
                  <RotateCw className={`size-3.5 mr-1.5 ${loadingHealth ? "animate-spin" : ""}`} />
                  Atualizar Diagnóstico
                </Button>
              </div>
            </div>

            {/* Resumo de Contadores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-white/5 dark:bg-card/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Produtos
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {dbHealth?.summary?.productsCount ?? 3}
                </p>
                <span className="text-[10px] text-slate-500">RepHub, EngHub, LawHub</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-white/5 dark:bg-card/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Módulos Ativos
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {dbHealth?.summary?.modulesCount ?? 0}
                </p>
                <span className="text-[10px] text-slate-500">Cadastrados no sistema</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-white/5 dark:bg-card/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Planos Comerciais
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {dbHealth?.summary?.plansCount ?? 0}
                </p>
                <span className="text-[10px] text-slate-500">Com módulos vinculados</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-white/5 dark:bg-card/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Assinantes Registrados
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {dbHealth?.summary?.accountsCount ?? 0}
                </p>
                <span className="text-[10px] text-slate-500">
                  {dbHealth?.summary?.unassignedAccounts === 0
                    ? "Todos com produto vinculado"
                    : `${dbHealth?.summary?.unassignedAccounts || 0} pendentes`}
                </span>
              </div>
            </div>

            {/* Checklist de Verificações em Tempo Real */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Status das Tabelas e Integridade Multi-Produto
              </p>

              <div className="rounded-xl border border-slate-200 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
                {(dbHealth?.checks || []).map((check: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-white/[0.02] text-xs transition"
                  >
                    <div className="flex items-center gap-2.5">
                      {check.status === "ok" ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : check.status === "warning" ? (
                        <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="size-4 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          {check.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {check.details}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                        check.status === "ok"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {check.status === "ok" ? "Em Conformidade" : "Ajustável em 1 clique"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ABA 2: CENTRAL DE MIGRAÇÕES (1-CLIQUE) */}
      {activeTab === "migracoes" && (
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="size-5 text-amber-500" />
                  <span>Gerenciador de Migrações do SaaS</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Aplique atualizações estruturais e alinhe módulos diretamente da administração com controle de versão.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await refetchMigrations();
                      await refetchHealth();
                      toast.success("Lista de migrações e tabelas atualizada!");
                    } catch (e: any) {
                      toast.error("Erro ao atualizar: " + (e.message || "tente novamente"));
                    }
                  }}
                  disabled={loadingMigrations}
                  className="text-xs border-slate-200 dark:border-slate-800 shrink-0"
                  title="Atualizar lista de migrações e checagem de tabelas"
                >
                  <RotateCw className={`size-3.5 mr-1.5 ${loadingMigrations ? "animate-spin" : ""}`} />
                  <span>Atualizar Lista</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleRunMigration("all")}
                  disabled={executingMigrationId !== null}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs shrink-0"
                >
                  {executingMigrationId === "all" ? (
                    <>
                      <RotateCw className="size-3.5 mr-1.5 animate-spin" />
                      <span>Aplicando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5 mr-1.5" />
                      <span>Aplicar Todas as Migrações</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Resumo de Status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Catalogadas</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {migrationsData?.summary?.total || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Executadas</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {migrationsData?.summary?.appliedCount || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Pendentes</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {migrationsData?.summary?.pendingCount || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Com Erro</p>
                <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                  {migrationsData?.summary?.errorCount || 0}
                </p>
              </div>
            </div>

            {/* Cards de Migrações */}
            <div className="space-y-3">
              {(migrationsData?.migrations || []).map((mig: any) => {
                const isExecuted = mig.status === "EXECUTADA" || mig.applied;
                const isError = mig.status === "COM ERRO";
                const isIncompatible = mig.status === "INCOMPATIVEL";
                const isUnknown = mig.status === "DESCONHECIDA";

                return (
                  <div
                    key={mig.id}
                    className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isError
                        ? "border-rose-300 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10"
                        : isExecuted
                        ? "border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-white/[0.01]"
                        : "border-slate-200 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.02] hover:border-blue-500/30"
                    }`}
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isExecuted
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : isError
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : isIncompatible
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                              : isUnknown
                              ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {isExecuted
                            ? "✅ EXECUTADA"
                            : isError
                            ? "❌ COM ERRO"
                            : isIncompatible
                            ? "⚠️ INCOMPATÍVEL"
                            : isUnknown
                            ? "❓ DESCONHECIDA"
                            : "⚡ PENDENTE"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {mig.category}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {mig.file.split("/").pop()}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {mig.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {mig.description}
                      </p>

                      {mig.errorMessage && (
                        <div className="p-2 rounded bg-rose-100/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300 font-mono">
                          Erro registrado: {mig.errorMessage}
                        </div>
                      )}

                      {mig.lastExecutedAt && (
                        <p className="text-[11px] text-slate-400">
                          Última execução: {new Date(mig.lastExecutedAt).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewSqlMigration(mig)}
                        className="text-xs border-slate-200 dark:border-slate-800"
                      >
                        <Code2 className="size-3.5 mr-1" />
                        Ver SQL
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleRunMigration(mig.id)}
                        disabled={executingMigrationId === mig.id}
                        className={`text-xs font-semibold ${
                          isExecuted
                            ? "bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700"
                            : isError
                            ? "bg-rose-600 hover:bg-rose-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        {executingMigrationId === mig.id ? (
                          <>
                            <RotateCw className="size-3.5 mr-1.5 animate-spin" />
                            <span>Executando...</span>
                          </>
                        ) : isExecuted ? (
                          <>
                            <RotateCw className="size-3 mr-1" />
                            <span>Re-sincronizar</span>
                          </>
                        ) : isError ? (
                          <>
                            <RotateCw className="size-3 mr-1" />
                            <span>Tentar Novamente</span>
                          </>
                        ) : (
                          <>
                            <Zap className="size-3.5 mr-1.5 text-amber-300" />
                            <span>Aplicar em 1 Clique</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabela de Histórico de Execuções e Auditoria */}
            {Array.isArray(migrationsData?.history) && migrationsData.history.length > 0 && (
              <div className="mt-8 border-t border-slate-200 dark:border-white/10 pt-6">
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="size-4 text-blue-500" />
                    <span>Histórico de Execuções e Auditoria</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Registro de execuções de migrações estruturais realizadas na plataforma.
                  </p>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="p-3">Migração</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Data / Hora</th>
                        <th className="p-3">Usuário</th>
                        <th className="p-3">Duração</th>
                        <th className="p-3">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                      {migrationsData.history.map((hist: any) => (
                        <tr key={hist.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                          <td className="p-3 font-mono text-[11px] text-slate-900 dark:text-white">
                            {hist.migration_id}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                hist.status === "EXECUTADA"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : hist.status === "COM ERRO"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              }`}
                            >
                              {hist.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">
                            {new Date(hist.executed_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="p-3">{hist.executed_by || "Administrador"}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">
                            {hist.execution_time_ms ? `${hist.execution_time_ms}ms` : "-"}
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={hist.error_message || ""}>
                            {hist.error_message ? (
                              <span className="text-rose-600 dark:text-rose-400 font-mono text-[10px]">
                                {hist.error_message}
                              </span>
                            ) : (
                              "Executada com sucesso"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ABA 3: CONSOLE SQL ADMINISTRATIVO */}
      {activeTab === "console" && (
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                  <Terminal className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Console SQL Administrativo
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Execute consultas ou instruções DDL diretamente na instância do Supabase.
                  </p>
                </div>
              </div>

              {/* Botões de Atalho */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomSql(`-- Ativar função segura exec_sql no PostgreSQL:
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;`);
                  }}
                  className="text-[11px] font-mono border-slate-200 dark:border-slate-800"
                >
                  Criar RPC exec_sql
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const aiMig = (migrationsData?.migrations || []).find((m: any) => m.id === "20260919_ai_usage_logs");
                    if (aiMig) setCustomSql(aiMig.sqlSnippet);
                  }}
                  className="text-[11px] font-mono border-slate-200 dark:border-slate-800"
                >
                  Carregar SQL IA Logs
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                  Instrução SQL a Executar:
                </Label>
                <textarea
                  value={customSql}
                  onChange={(e) => setCustomSql(e.target.value)}
                  placeholder="SELECT * FROM public.products; -- ou cole sua instrução DDL aqui"
                  rows={8}
                  className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-900 text-slate-100 dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Execução direta protegida pela chave administrativa Service Role.
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomSql("")}
                    className="text-xs"
                  >
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRunCustomSql}
                    disabled={isExecutingSql}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                  >
                    {isExecutingSql ? (
                      <>
                        <RotateCw className="size-3.5 mr-1.5 animate-spin" />
                        <span>Executando...</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="size-3.5 mr-1.5" />
                        <span>Executar SQL</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {sqlResult && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs border border-white/10 space-y-2">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-bold text-slate-300">Resultado da Execução:</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(sqlResult, null, 2), "Resultado")}
                      className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Copy className="size-3" />
                      Copiar Resultado
                    </button>
                  </div>
                  <pre className="overflow-x-auto max-h-60">
                    {JSON.stringify(sqlResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ABA 4: PREFERÊNCIAS DE COBRANÇA */}
      {activeTab === "cobranca" && (
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-4">
              <Settings className="size-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Preferências de Cobrança e Alertas
              </h3>
            </div>

            <form onSubmit={handleSubmitSettings} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50/60 border border-slate-200 dark:border-white/5 dark:bg-card/40">
                  <div className="mt-1 bg-amber-500/20 p-2 rounded-xl shrink-0 text-amber-500">
                    <BellRing className="size-4" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-slate-900 dark:text-white font-bold">
                      Alerta de Vencimento de Assinaturas
                    </Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 mt-1 leading-relaxed">
                      Defina quantos dias antes da data de vencimento as contas dos clientes devem aparecer na Visão Geral como "Próximas ao vencimento".
                    </p>
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <Input
                        type="number"
                        name="billingAlertDays"
                        defaultValue={settings.billing_alert_days}
                        min={1}
                        max={30}
                        required
                        className="bg-white dark:bg-slate-800 text-xs font-bold"
                      />
                      <span className="text-xs text-slate-500 font-semibold">dias</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={loadingSettings}
                  className="bg-blue-600 text-white hover:bg-blue-700 font-semibold text-xs shadow-xs"
                >
                  {loadingSettings ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ABA 5: PROVEDORES DE DADOS JURÍDICOS (ESCAVADOR V2 & DATAJUD) */}
      {activeTab === "provedores_juridicos" && (
        <LegalProvidersAdminPanel />
      )}

      {/* ABA 6: SEGURANÇA MASTER & E-MAIL DE REDUNDÂNCIA (ADMINISTRADOR GERAL) */}
      {activeTab === "seguranca_master" && (
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Administradores da plataforma e e-mail de recuperação
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
                    Controle de administradores individuais e e-mails de recuperação da plataforma NAVOR.
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Check className="size-3.5" /> Proteção Ativa
              </span>
            </div>

            <div className="space-y-6">
              {/* 1. CREDENCIAIS & E-MAIL DE REDUNDÂNCIA */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20 p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Key className="size-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    E-mails dos administradores da plataforma
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      E-mail Principal do Administrador Geral *
                    </label>
                    <input
                      type="email"
                      required
                      value={masterSec.primary_email}
                      onChange={(e) => setMasterSec({ ...masterSec, primary_email: e.target.value })}
                      placeholder="statosrep@gmail.com"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      E-mail titular master com acesso irrestrito às áreas de faturamento e administração.
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      E-mail de Redundância / Backup de Segurança *
                    </label>
                    <input
                      type="email"
                      value={masterSec.recovery_email}
                      onChange={(e) => setMasterSec({ ...masterSec, recovery_email: e.target.value })}
                      placeholder="matheus_zip@hotmail.com"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-1 font-medium">
                      ✓ E-mail de recuperação cadastrado para a conta administrativa.
                    </span>
                  </div>

                </div>
              </div>

              {/* 2. ISOLAMENTO E AUDITORIA DE ACESSOS */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">
                    Última Autenticação Master Registrada
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Método: <strong>Credenciais individuais</strong> • E-mail: <strong>{masterSec.last_auth_event?.email_used || masterSec.primary_email}</strong> • Horário: <strong>{masterSec.last_auth_event?.timestamp || "Recente"}</strong>
                  </span>
                </div>
                <span className="rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5">
                  Auditado
                </span>
              </div>

              {/* BOTÃO SALVAR */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  disabled={savingSec}
                  onClick={async () => {
                    setSavingSec(true);
                    try {
                      await saveMasterSecuritySettings({
                        data: {
                          primaryEmail: masterSec.primary_email,
                          recoveryEmail: masterSec.recovery_email,
                        },
                      });
                      LawHubService.saveMasterSecurityConfig(masterSec);
                      toast.success("Configurações dos administradores salvas no servidor com sucesso!");
                    } catch (err: any) {
                      toast.error(`Erro ao salvar credenciais: ${err.message || "Tente novamente."}`);
                    } finally {
                      setSavingSec(false);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs px-5 py-2 cursor-pointer"
                >
                  <ShieldCheck className="size-4 mr-1.5" />
                  {savingSec ? "Salvando no servidor..." : "Salvar configurações administrativas"}
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO E CÓPIA DE SQL */}
      {viewSqlMigration && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 px-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="size-5 text-blue-600" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {viewSqlMigration.title}
                </h4>
              </div>
              <button
                onClick={() => setViewSqlMigration(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {viewSqlMigration.helperInstruction && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  {viewSqlMigration.helperInstruction}
                </div>
              )}

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-96 border border-white/10">
                  {viewSqlMigration.sqlSnippet}
                </pre>

                <Button
                  size="sm"
                  onClick={() => copyToClipboard(viewSqlMigration.sqlSnippet)}
                  className="absolute top-3 right-3 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold h-7 shadow-xs"
                >
                  <Copy className="size-3 mr-1" />
                  Copiar SQL
                </Button>
              </div>
            </div>

            <div className="p-4 px-6 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Execute diretamente no SQL Editor do Supabase ou via CLI.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewSqlMigration(null)}
                className="text-xs"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
