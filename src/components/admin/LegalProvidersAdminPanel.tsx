import { useState } from "react";
import {
  Scale,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  FileText,
  DollarSign,
  HelpCircle,
  Save,
  Check,
} from "lucide-react";
import { GlassCard, Button, Input, Label } from "@/components/navor-rephub/ui";
import {
  LegalProviderManager,
  COMPARISON_MATRIX,
  type LegalDataProviderType,
  type LegalProviderConfig,
} from "@/lib/lawhub/legal-provider-manager";
import { EscavadorTestModal } from "@/components/navor-lawhub/EscavadorTestModal";
import { toast } from "sonner";

export function LegalProvidersAdminPanel() {
  const [config, setConfig] = useState<LegalProviderConfig>(() =>
    LegalProviderManager.getConfig()
  );
  const [isTestingEscavador, setIsTestingEscavador] = useState(false);
  const [isRouteTesterOpen, setIsRouteTesterOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    provider: "escavador";
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      LegalProviderManager.saveConfig(config);
      toast.success("Configurações do Escavador API v2 salvas com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestEscavador() {
    setIsTestingEscavador(true);
    setTestResult(null);
    try {
      const res = await LegalProviderManager.testProviderConnection("escavador");
      setTestResult({
        provider: "escavador",
        success: res.success,
        message: res.message,
        details: res.details,
      });
      if (res.success) {
        toast.success("Conexão com Escavador validada!");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Falha no teste: ${err.message}`);
    } finally {
      setIsTestingEscavador(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal com Indicador do Provedor Selecionado */}
      <GlassCard className="p-6 border-blue-500/20 bg-linear-to-r from-blue-500/5 via-transparent to-purple-500/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
                <Scale className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Motor Oficial de Dados Jurídicos: Escavador API v2
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecione o motor de dados para consultas de processos, diários oficiais (DJe/DJEN) e monitoramentos no LawHub.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold text-xs"
            >
              {isSaving ? (
                <>
                  <RotateCw className="size-3.5 mr-1.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5" />
                  <span>Salvar Parâmetros do SaaS</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* SELETOR DO PROVEDOR OFICIAL */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>1. Modo de Operação do SaaS NAVOR LawHub</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
              MODO ATIVO: {config.activeProvider.toUpperCase()}
            </span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O Escavador é o motor contratado oficial. O DataJud atua como opção gratuita de consulta inicial para os clientes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Opção Escavador */}
          <div
            onClick={() => setConfig({ ...config, activeProvider: "escavador" })}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              config.activeProvider === "escavador"
                ? "border-purple-600 bg-purple-50/70 dark:border-purple-500 dark:bg-purple-950/40 shadow-xs ring-2 ring-purple-500/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400">
                Escavador API v2 (Oficial)
              </span>
              {config.activeProvider === "escavador" && (
                <CheckCircle2 className="size-4 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Diários Oficiais, Processos & Autos
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Varredura de diários oficiais às primeiras horas do dia, monitoramento de termos/OAB, busca de processos e baixa de autos com 60% do custo do Astrea.
            </p>
          </div>

          {/* Opção DataJud Gratuita */}
          <div
            onClick={() => setConfig({ ...config, activeProvider: "datajud" })}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              config.activeProvider === "datajud"
                ? "border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/40 shadow-xs ring-2 ring-emerald-500/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                DataJud / DJEN (CNJ Gratuito)
              </span>
              {config.activeProvider === "datajud" && (
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Consultas Públicas sem Custo
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Custo zero de API para consultas básicas de metadados disponibilizados pelo Conselho Nacional de Justiça.
            </p>
          </div>
        </div>
      </div>

      {/* CONFIGURAÇÃO DE CREDENCIAIS & TESTE AO VIVO */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 grid place-items-center font-bold text-xs">
              ESC
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                Credenciais Escavador API v2
              </h5>
              <span className="text-[10px] text-slate-500">api.escavador.com/v2</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestEscavador}
              disabled={isTestingEscavador}
              className="text-xs h-7.5"
            >
              {isTestingEscavador ? (
                <>
                  <RotateCw className="size-3 mr-1 animate-spin" />
                  <span>Testando...</span>
                </>
              ) : (
                <>
                  <Zap className="size-3 mr-1 text-purple-600" />
                  <span>Testar Conexão</span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="default"
              onClick={() => setIsRouteTesterOpen(true)}
              className="text-xs h-7.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs"
            >
              <Zap className="size-3 mr-1" />
              <span>Laboratório de Teste de Rotas</span>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          O token do Escavador é uma credencial interna da NAVOR e fica somente nos segredos do servidor. Nenhuma chave é exibida, digitada ou salva neste navegador.
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-lg border text-xs ${
              testResult.success
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 text-red-900 dark:text-red-200"
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold mb-1">
              {testResult.success ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <XCircle className="size-4 text-red-600" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.details && (
              <pre className="text-[10px] font-mono mt-1 overflow-x-auto p-1.5 bg-black/5 dark:bg-black/40 rounded">
                {JSON.stringify(testResult.details, null, 2)}
              </pre>
            )}
          </div>
        )}
      </GlassCard>

      {/* Matriz Comparativa */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          2. Especificações do Provedor Oficial vs Gratuito
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPARISON_MATRIX.map((item) => (
            <GlassCard key={item.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                    {item.name}
                  </h5>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                    {item.badge}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {item.recommendedFor}
              </p>
              <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-2">
                {item.pros.map((p, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <Check className="size-3 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Modal de Teste e Extração de Rotas Oficial da Retaguarda */}
      <EscavadorTestModal
        isOpen={isRouteTesterOpen}
        onClose={() => setIsRouteTesterOpen(false)}
      />
    </div>
  );
}
