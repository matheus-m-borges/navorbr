import React from "react";
import {
  X,
  Printer,
} from "lucide-react";
import type { LawProcess, LawDeadline, LawHearing, LawProcessResource } from "@/lib/lawhub/types";

interface PrintProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  process: LawProcess;
  deadlines?: LawDeadline[];
  hearings?: LawHearing[];
  resources?: LawProcessResource[];
}

export function PrintProcessModal({
  isOpen,
  onClose,
  process,
  deadlines = [],
  hearings = [],
  resources = [],
}: PrintProcessModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedCaseValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(process.case_value ?? 0);

  const formattedCondemnationValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(process.condemnation_value ?? 0);

  const formattedRiskValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(process.estimated_risk_value ?? 0);

  const formattedFeeValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(process.agreed_fee_value ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:z-auto">
      <style>{`
        @media print {
          @page {
            margin: 1.2cm;
            size: A4 portrait;
          }
          body * {
            visibility: hidden !important;
          }
          #navor-printable-dossier, #navor-printable-dossier * {
            visibility: visible !important;
          }
          #navor-printable-dossier {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none">
        {/* Header - Not printed */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Printer className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Ficha Cadastral e Dossiê do Processo
              </h3>
              <p className="text-xs text-slate-500">
                Visualização para impressão física ou exportação em PDF
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition cursor-pointer"
            >
              <Printer className="size-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div id="navor-printable-dossier" className="overflow-y-auto p-8 font-sans text-slate-900 print:p-0 print:overflow-visible">
          {/* Top Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-lg bg-blue-900 text-white font-black text-sm">
                    N
                  </div>
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase">
                      NAVOR LAWHUB · GESTÃO JURÍDICA
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-600">
                      Ficha Oficial de Autos Processuais e Relatório de Acompanhamento
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <p>Emissão: <strong>{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong></p>
                <p>Status: <strong className="uppercase text-blue-700">{process.status}</strong></p>
                {process.folder_number && (
                  <p>Pasta Física: <strong className="text-slate-900">{process.folder_number}</strong></p>
                )}
              </div>
            </div>
          </div>

          {/* Process Title and CNJ Header */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {process.record_type === "caso" ? "Registro Extrajudicial" : "Processo Judicial"}
                </span>
                <h2 className="text-base font-bold text-slate-950">
                  {process.title || `${process.active_pole} x ${process.passive_pole}`}
                </h2>
              </div>
              {process.cnj_number && (
                <div className="font-mono text-sm font-black text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  {process.cnj_number}
                </div>
              )}
            </div>
          </div>

          {/* Dados Gerais & Partes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Coluna 1: Dados do Juízo */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 uppercase tracking-wide text-[11px] text-blue-900">
                Dados do Juízo & Distribuição
              </h3>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Tribunal / Órgão:</span>
                <span className="font-semibold text-right">{process.court || "Não informado"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Vara / Juízo:</span>
                <span className="font-semibold text-right">{process.judicial_branch || "5ª Vara Cível"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Comarca / Foro:</span>
                <span className="font-semibold text-right">{process.judicial_district || "Teresina"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Classe Processual:</span>
                <span className="font-semibold text-right">{process.procedural_class || "Procedimento Comum Cível"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Assunto:</span>
                <span className="font-semibold text-right">{process.subject || "Cível / Obrigações"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Data de Distribuição:</span>
                <span className="font-semibold text-right">
                  {process.distribution_date ? new Date(process.distribution_date).toLocaleDateString("pt-BR") : "06/11/2020"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Pasta Física / Arquivo:</span>
                <span className="font-bold text-blue-700 text-right">{process.folder_number || process.folder_name || "Geral"}</span>
              </div>
            </div>

            {/* Coluna 2: Partes e Advogados */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 uppercase tracking-wide text-[11px] text-blue-900">
                Partes & Advogados
              </h3>
              <div className="py-0.5">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Polo Ativo (Autor)</span>
                <p className="font-bold text-slate-900">{process.active_pole || "Parte Autora"}</p>
                <p className="text-[11px] text-slate-600">
                  Advogados: {process.responsible_name || "Arthur Carvalho Moura Da Silva"}
                  {process.co_counsel ? `, ${process.co_counsel}` : ""}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-2 py-0.5">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Polo Passivo (Réu)</span>
                <p className="font-bold text-slate-900">{process.passive_pole || "Parte Ré"}</p>
                <p className="text-[11px] text-slate-600">
                  Advogados: {process.opposing_lawyer || "Dyana Carolina Marques Sanches Brianese Port"}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-2 flex justify-between">
                <span className="text-slate-500">Cliente Principal:</span>
                <span className="font-bold text-slate-900">{process.client_name || process.active_pole}</span>
              </div>
            </div>
          </div>

          {/* Resumo Financeiro do Processo */}
          <div className="border border-slate-200 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 uppercase tracking-wide text-[11px] text-blue-900 mb-3">
              Valores do Processo
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Valor da Causa</span>
                <span className="text-sm font-black text-slate-900">{formattedCaseValue}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Condenação / Acordo</span>
                <span className="text-sm font-black text-emerald-700">{formattedCondemnationValue}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Risco Estimado</span>
                <span className="text-sm font-black text-amber-700">{formattedRiskValue}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Honorários Contratados</span>
                <span className="text-sm font-black text-blue-700">{formattedFeeValue}</span>
              </div>
            </div>
          </div>

          {/* Recursos e Desdobramentos Vinculados (se houver) */}
          {resources.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 mb-6 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 uppercase tracking-wide text-[11px] text-blue-900 mb-2">
                Recursos & Desdobramentos Vinculados ({resources.length})
              </h3>
              <div className="space-y-2">
                {resources.map((res) => (
                  <div key={res.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{res.title}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {res.number || "Sem numeração autônoma"} • {res.court || "Tribunal"} {res.chamber_or_section ? `(${res.chamber_or_section})` : ""}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                      {res.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximos Prazos e Audiências */}
          {(deadlines.length > 0 || hearings.length > 0) && (
            <div className="border border-slate-200 rounded-xl p-4 mb-6 text-xs">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 uppercase tracking-wide text-[11px] text-blue-900 mb-2">
                Prazos & Audiências Pendentes
              </h3>
              <div className="space-y-2">
                {deadlines.map((d) => (
                  <div key={d.id} className="p-2 rounded bg-slate-50 border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{d.title}</p>
                      <p className="text-[11px] text-slate-500">Vencimento fatal: <strong>{d.deadline_date}</strong> • Responsável: {d.responsible_name}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800">
                      {d.priority}
                    </span>
                  </div>
                ))}
                {hearings.map((h) => (
                  <div key={h.id} className="p-2 rounded bg-slate-50 border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">Audiência: {h.title}</p>
                      <p className="text-[11px] text-slate-500">Data: {h.hearing_date} às {h.hearing_time} • {h.location}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                      Audiência
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico Recente de Andamentos dos Autos */}
          <div className="border border-slate-200 rounded-xl p-4 text-xs">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 uppercase tracking-wide text-[11px] text-blue-900 mb-3">
              Histórico dos Autos ({process.movements?.length || 0} andamentos registrados)
            </h3>
            <div className="space-y-3">
              {(process.movements || []).slice(0, 10).map((m, idx) => (
                <div key={m.id || idx} className="border-b border-slate-100 pb-2 last:border-b-0">
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 mb-0.5">
                    <span>Data: {m.date || "Conforme autos"}</span>
                    <span>{m.instance || "1º Grau"}</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed">{m.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé Oficial da Certidão Impressa */}
          <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-500">
            <p>Documento emitido eletronicamente pelo Sistema Navor LawHub em {new Date().toLocaleDateString("pt-BR")}.</p>
            <p>Dados sincronizados com o Tribunal de Justiça e Diários Oficiais através do DataJud / PJe.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
