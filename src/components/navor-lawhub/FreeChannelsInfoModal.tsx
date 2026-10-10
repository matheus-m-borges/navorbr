import React from "react";
import {
  X,
  Database,
  FileText,
  Scale,
  ShieldCheck,
  Building,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  CANAIS_GRATUITOS_MONITORAMENTO,
  type FreeChannelDefinition,
} from "@/products/lawhub/domain/free-channels";
import { cn } from "@/lib/utils";

interface FreeChannelsInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FreeChannelsInfoModal({ isOpen, onClose }: FreeChannelsInfoModalProps) {
  if (!isOpen) return null;

  const renderIcon = (iconName: FreeChannelDefinition["iconName"]) => {
    switch (iconName) {
      case "Database":
        return <Database className="size-5 text-blue-600 dark:text-blue-400" />;
      case "FileText":
        return <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />;
      case "ShieldCheck":
        return <ShieldCheck className="size-5 text-indigo-600 dark:text-indigo-400" />;
      case "Scale":
        return <Scale className="size-5 text-sky-600 dark:text-sky-400" />;
      case "Building":
        return <Building className="size-5 text-purple-600 dark:text-purple-400" />;
      default:
        return <Database className="size-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Scale className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Canais Gratuitos de Busca & Monitoramento
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-black border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  0 Créditos de IA
                </span>
              </div>
               <p className="text-xs text-slate-500 dark:text-slate-400">
                 Fontes públicas oficiais do Poder Judiciário disponíveis para consulta sob demanda
               </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Banner de Esclarecimento e Transparência */}
          <div className="rounded-xl border border-blue-200/70 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-white dark:border-blue-900/50 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 p-4">
            <div className="flex items-start gap-3">
              <Info className="size-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  Transparência total nas fontes de dados processuais:
                </p>
                <p>
                  O nosso <strong>Bot de Andamentos Processuais</strong> monitora o acervo e localiza novos processos utilizando exclusivamente <strong>APIs e bases públicas gratuitas oficiais</strong> mantidas pelo <strong>Conselho Nacional de Justiça (CNJ)</strong>, <strong>Tribunais Regionais de todos os 27 estados</strong> e pelo <strong>Conselho Federal da OAB</strong>.
                </p>
               <p className="text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                 🌐 <strong>Consulta sob demanda:</strong> Buscas manuais estão disponíveis para tribunais públicos via APIs oficiais, sem consumo de créditos de IA.
               </p>
               <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                 Monitoramento automático e varredura contínua requerem o crawler server-side configurado. Consulte a equipe técnica para ativação.
               </p>
              </div>
            </div>
          </div>

          {/* Lista dos 5 Canais Oficiais Gratuitos */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              5 Canais Gratuitos Integrados ao Bot
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {CANAIS_GRATUITOS_MONITORAMENTO.map((canal) => (
                <div
                  key={canal.id}
                  className="rounded-xl border border-slate-200/80 bg-white dark:bg-slate-900/90 dark:border-slate-800 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                        {renderIcon(canal.iconName)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {canal.name}
                          </h4>
                          <span className="text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 border border-slate-200 dark:border-slate-700">
                            {canal.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {canal.institution} · {canal.fullName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-1 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="size-3 text-emerald-500" />
                        {canal.cost}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {canal.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-300 shrink-0">O que rastreia:</strong>
                      <span>{canal.whatItTracks}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-300 shrink-0">Frequência:</strong>
                      <span>{canal.frequency}</span>
                    </div>
                  </div>

                  {canal.legalBasis && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="font-semibold">Base Normativa:</span>
                      <span>{canal.legalBasis}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Comparativo Didático: Canais Gratuitos vs. Consultas com Créditos de IA */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="size-3.5 text-blue-500" />
              Diferença entre Canais Gratuitos e Buscas com Crédito de IA
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-white dark:bg-slate-800 p-3 border border-emerald-200/80 dark:border-emerald-900/60 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Canais Gratuitos do Bot (0 Créditos)
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                 <li>Consulta manual de andamentos processuais</li>
                 <li>Busca em diários oficiais via APIs públicas</li>
                 <li>Importação de acervo pela inscrição da OAB (sob demanda)</li>
                 <li>Visualização de despachos e decisões retornados</li>
                 <li><strong>Consultas gratuitas e ilimitadas (sem monitoramento automático)</strong></li>
                </ul>
              </div>

              <div className="rounded-lg bg-white dark:bg-slate-800 p-3 border border-purple-200/80 dark:border-purple-900/60 space-y-1.5">
                <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-bold">
                  <Sparkles className="size-4 text-purple-500" />
                  API Escavador (Consome Créditos de IA)
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                  <li>Dossiês e rastreamento de patrimônio de terceiros</li>
                  <li>Buscas de processos por CPF / CNPJ de contrapartes</li>
                  <li>Enriquecimento em lote de pessoas jurídicas</li>
                  <li>Sempre sinalizado com o selo roxo de IA</li>
                  <li><strong>Consome 1 crédito por consulta ativa</strong></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50 dark:bg-slate-900">
         <p className="text-[11px] text-slate-500 dark:text-slate-400">
           Consultas via APIs públicas oficiais. Monitoramento automático e integração contínua pendentes de configuração server-side.
         </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
