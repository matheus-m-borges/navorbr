import { X, Printer, RotateCw, CheckCircle2, Scale, Clock, ShieldCheck, HelpCircle } from "lucide-react";
import { formatCurrency, formatPercent } from "@/products/lawhub/domain/calculator-utils";
import { CalculationRecord } from "@/modules/legal-calculator/types";
import { toast } from "sonner";
import { LegalCalculatorService } from "@/lib/lawhub/legal-calculator-service";

interface CalculationDetailsModalProps {
  calculation: CalculationRecord | null;
  onClose: () => void;
}

export function CalculationDetailsModal({ calculation, onClose }: CalculationDetailsModalProps) {
  if (!calculation) return null;

  const result = calculation.result;

  const handleReproduce = () => {
    try {
      const res = LegalCalculatorService.reproduceRecord(calculation);
      if (res.match) {
        toast.success(
          `Cálculo 100% idêntico e homologado! Total: ${formatCurrency(res.reproducedTotal)} (Hash: ${res.reproducedHash}).`,
          { duration: 5000 }
        );
      } else {
        toast.error(`Divergência detectada: ${formatCurrency(res.diff)}`);
      }
    } catch (e: any) {
      toast.error(`Erro na reprodução: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Scale className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {calculation.processNumber || "Processo Extrajudicial"}
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  VALIDADO
                </span>
                <span className="text-xs text-slate-400">• {calculation.legalArea}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {calculation.calculationName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReproduce}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              title="Executa novamente o motor com a versão idêntica dos índices"
            >
              <RotateCw className="size-3 text-blue-600" />
              <span>Reproduzir Prova</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs"
            >
              <Printer className="size-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo com Rolagem */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card Resumo */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  TOTAL LIQUIDADO CONSOLIDADO
                </span>
                <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(calculation.totalResult || result?.total)}
                </h4>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Hash Determinístico: <strong>{calculation.deterministicHash || "N/A"}</strong>
                </p>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <p>
                  Cliente: <strong className="text-slate-900 dark:text-white">{calculation.clientName}</strong>
                </p>
                <p>
                  Tribunal: <strong className="text-slate-900 dark:text-white">{calculation.tribunal}</strong>
                </p>
                <p>
                  Motor: <strong className="text-slate-900 dark:text-white">{calculation.engineVersion}</strong>
                </p>
              </div>
            </div>

            {/* Componentes Principais com formatCurrency */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 font-bold">Principal Original</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatCurrency(calculation.originalAmount || result?.principal)}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 font-bold">Correção Monetária</span>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  + {formatCurrency(result?.correction || 0)}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 font-bold">Juros Moratórios</span>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  + {formatCurrency(result?.interest || 0)}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 font-bold">Honorários & Multas</span>
                <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                  + {formatCurrency((result?.honorary || 0) + (result?.penalty || 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Memória Período a Período se existir */}
          {result?.items?.[0]?.periods && result.items[0].periods.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Demonstrativo Discriminado Mês a Mês (Art. 524 CPC)
                </h4>
                <span className="text-[11px] text-slate-400">Critério Pro Rata Die / Simples</span>
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">MÊS/ANO</th>
                      <th className="py-2.5 px-3">DIAS</th>
                      <th className="py-2.5 px-3 text-right">PRINCIPAL</th>
                      <th className="py-2.5 px-3 text-right">ÍNDICE (%)</th>
                      <th className="py-2.5 px-3 text-right">CORREÇÃO</th>
                      <th className="py-2.5 px-3 text-right">JUROS (%)</th>
                      <th className="py-2.5 px-3 text-right">JUROS (R$)</th>
                      <th className="py-2.5 px-3 text-right">SALDO FINAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {result.items[0].periods.map((p) => (
                      <tr key={p.periodIndex} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{p.periodLabel}</td>
                        <td className="py-2 px-3 text-slate-400">{p.daysCount}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(p.openingPrincipal)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatPercent(p.indexRatePercent)}</td>
                        <td className="py-2 px-3 text-right font-semibold">{formatCurrency(p.correctionAmount)}</td>
                        <td className="py-2 px-3 text-right text-indigo-600">{formatPercent(p.interestRatePercent, 4)}</td>
                        <td className="py-2 px-3 text-right font-semibold">{formatCurrency(p.interestAmount)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {formatCurrency(p.closingBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <p>Este cálculo foi homologado e arquivado com saldo consolidado de <strong>{formatCurrency(calculation.totalResult)}</strong>.</p>
              <p className="mt-1">Clique em "Reproduzir Prova" acima para rodar a reconstituição matemática do cálculo a qualquer momento.</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end border-t border-slate-100 px-6 py-3.5 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
