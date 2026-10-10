import { useState, useEffect } from "react";
import {
  RotateCw,
  Play,
  Pause,
  Bot,
  Scale,
  Clock,
  Sparkles,
  ShieldCheck,
  Building,
  Info,
  CheckCircle2,
  Database,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LawHubProcessBot, type ProcessBotStatus } from "@/lib/lawhub/process-bot";
import { toast } from "sonner";
import { FreeChannelsInfoModal } from "./FreeChannelsInfoModal";

interface ProcessBotStatusBarProps {
  className?: string;
  onScanCompleted?: () => void;
}

export function ProcessBotStatusBar({ className, onScanCompleted }: ProcessBotStatusBarProps) {
  const [status, setStatus] = useState<ProcessBotStatus>(() => LawHubProcessBot.getStatus());
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);

  useEffect(() => {
    // Inicia o bot automaticamente se não estiver rodando
    LawHubProcessBot.start();

    const unsubscribe = LawHubProcessBot.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleBot = () => {
    if (status.isRunning) {
      LawHubProcessBot.stop();
      toast.info("Radar contínuo de andamentos pausado.");
    } else {
      LawHubProcessBot.start();
      toast.success("Radar contínuo de andamentos processuais reativado!");
    }
  };

  const handleForceScan = async () => {
    toast.loading("Bot checando novos andamentos em tribunais e PJe...", { id: "proc-bot-scan" });
    await LawHubProcessBot.scanNow(false);
    toast.dismiss("proc-bot-scan");
    if (onScanCompleted) {
      onScanCompleted();
    }
  };

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-blue-100 bg-linear-to-r from-blue-50/80 via-white to-indigo-50/50 p-3.5 shadow-xs transition-all dark:border-blue-950/60 dark:from-slate-900/90 dark:via-slate-900 dark:to-blue-950/30",
          className
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Status Indicador & Informações */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Bot className={cn("size-5", status.isScanning && "animate-bounce")} />
              {status.isRunning ? (
                <span className="absolute -top-1 -right-1 flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </span>
              ) : (
                <span className="absolute -top-1 -right-1 flex size-3 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  {status.isRunning ? "Bot de Andamentos Processuais · Radar Ativo" : "Radar em Pausa Manual"}
                </span>

                {/* Badge de Varredura */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                    status.isRunning
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", status.isRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                  {status.isRunning ? "Varredura Nacional (90 Tribunais)" : "Pausado"}
                </span>

                {/* Badge Custo Zero / Gratuito */}
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  0 Créditos de IA (Gratuito)
                </span>

                {/* Badge com os Canais Gratuitos Nacionais Clicável */}
                <button
                  type="button"
                  onClick={() => setIsChannelsModalOpen(true)}
                  className="group inline-flex items-center gap-1.5 rounded-md bg-blue-100/80 dark:bg-blue-950/70 hover:bg-blue-200 dark:hover:bg-blue-900 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition"
                  title="Clique para ver os detalhes da cobertura nacional gratuita dos 90 tribunais"
                >
                  <Scale className="size-3 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                  <span>Cobertura Nacional: Todos os 27 TJs Estaduais · TRFs 1-6 · TRTs · DataJud / DJEN</span>
                  <Info className="size-3 text-blue-500 ml-0.5" />
                </button>
              </div>

              {/* Informações de Ciclos e Contadores */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-slate-400" />
                  Última checagem:{" "}
                  <strong className="text-slate-700 dark:text-slate-300 font-mono">
                    {status.lastCheckTime || "Monitorando acervo..."}
                  </strong>
                </span>

                {status.isRunning && (
                  <span className="flex items-center gap-1">
                    Próxima varredura em:{" "}
                    <strong className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                      {status.nextCheckSeconds}s
                    </strong>
                  </span>
                )}

                <span>
                  Processos no radar:{" "}
                  <strong className="text-slate-700 dark:text-slate-300 font-bold">
                    {status.monitoredProcessesCount} ativos
                  </strong>
                </span>

                <button
                  type="button"
                  onClick={() => setIsChannelsModalOpen(true)}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
                >
                  (Saiba como funciona a busca gratuita)
                </button>
              </div>
            </div>
          </div>

          {/* Ações do Bot */}
          <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={handleToggleBot}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs",
                status.isRunning
                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  : "border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {status.isRunning ? (
                <>
                  <Pause className="size-3.5 text-slate-500" />
                  <span>Pausar Radar</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  <span>Reativar Radar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleForceScan}
              disabled={status.isScanning}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
            >
              <RotateCw className={cn("size-3.5", status.isScanning && "animate-spin")} />
              <span>{status.isScanning ? "Varrendo Tribunais..." : "Buscar Andamentos Agora"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detalhado dos Canais Gratuitos */}
      <FreeChannelsInfoModal
        isOpen={isChannelsModalOpen}
        onClose={() => setIsChannelsModalOpen(false)}
      />
    </>
  );
}
