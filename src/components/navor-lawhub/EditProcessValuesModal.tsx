import React, { useState } from "react";
import { X, DollarSign, Folder, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { LawProcess } from "@/lib/lawhub/types";

interface EditProcessValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  process: LawProcess;
  onSuccess: () => void;
}

export function EditProcessValuesModal({
  isOpen,
  onClose,
  process,
  onSuccess,
}: EditProcessValuesModalProps) {
  const [caseValue, setCaseValue] = useState<string>(
    process.case_value !== undefined ? String(process.case_value) : ""
  );
  const [condemnationValue, setCondemnationValue] = useState<string>(
    process.condemnation_value !== undefined ? String(process.condemnation_value) : ""
  );
  const [riskValue, setRiskValue] = useState<string>(
    process.estimated_risk_value !== undefined ? String(process.estimated_risk_value) : ""
  );
  const [feeValue, setFeeValue] = useState<string>(
    process.agreed_fee_value !== undefined ? String(process.agreed_fee_value) : ""
  );
  const [folderNumber, setFolderNumber] = useState<string>(
    process.folder_number || process.folder_name || ""
  );
  const [judicialBranch, setJudicialBranch] = useState<string>(
    process.judicial_branch || ""
  );
  const [judicialDistrict, setJudicialDistrict] = useState<string>(
    process.judicial_district || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setCaseValue(process.case_value !== undefined ? String(process.case_value) : "");
      setCondemnationValue(process.condemnation_value !== undefined ? String(process.condemnation_value) : "");
      setRiskValue(process.estimated_risk_value !== undefined ? String(process.estimated_risk_value) : "");
      setFeeValue(process.agreed_fee_value !== undefined ? String(process.agreed_fee_value) : "");
      setFolderNumber(process.folder_number || process.folder_name || "");
      setJudicialBranch(process.judicial_branch || "");
      setJudicialDistrict(process.judicial_district || "");
    }
  }, [isOpen, process]);

  if (!isOpen) return null;

  const parseMoneyOrZero = (val: string): number => {
    if (!val || !val.trim()) return 0;
    const clean = val.trim().replace(/\./g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await LawHubService.updateProcess(process.id, {
        case_value: parseMoneyOrZero(caseValue),
        condemnation_value: parseMoneyOrZero(condemnationValue),
        estimated_risk_value: parseMoneyOrZero(riskValue),
        agreed_fee_value: parseMoneyOrZero(feeValue),
        folder_number: folderNumber.trim() || undefined,
        folder_name: folderNumber.trim() || undefined,
        judicial_branch: judicialBranch.trim() || process.judicial_branch,
        judicial_district: judicialDistrict.trim() || process.judicial_district,
      });

      toast.success("Valores e dados da ficha atualizados com sucesso!");
      onSuccess();
      onClose();
    } catch {
      toast.error("Erro ao atualizar dados do processo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <DollarSign className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Editar Valores & Dados da Ficha
              </h3>
              <p className="text-xs text-slate-500">
                Processo {process.cnj_number || process.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 text-xs">
          {/* Campo Pasta Física / Arquivo */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Pasta Física / Código de Arquivo do Escritório
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: Pasta 104-B, ARQUIVO-2026/01"
                value={folderNumber}
                onChange={(e) => setFolderNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Localização física do processo nos arquivos do escritório (Artigo 983334).
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2 uppercase text-[10px] tracking-wider text-blue-700 dark:text-blue-400">
              Valores Econômicos da Demanda (Artigo 644948)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Valor da Causa */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Valor da Causa (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={caseValue}
                    onChange={(e) => setCaseValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Valor de Condenação / Acordo */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Valor de Condenação / Acordo (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={condemnationValue}
                    onChange={(e) => setCondemnationValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold text-emerald-700 dark:text-emerald-400"
                  />
                </div>
              </div>

              {/* Risco Estimado */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Valor em Risco / Estimado (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={riskValue}
                    onChange={(e) => setRiskValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Honorários Contratados */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Honorários Contratados (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={feeValue}
                    onChange={(e) => setFeeValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold text-blue-700 dark:text-blue-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dados do Juízo e Comarca */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <h4 className="font-bold text-slate-900 dark:text-white mb-2 uppercase text-[10px] tracking-wider text-slate-500">
              Juízo Competente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Vara / Juízo
                </label>
                <input
                  type="text"
                  placeholder="Ex: 5ª Vara Cível"
                  value={judicialBranch}
                  onChange={(e) => setJudicialBranch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Comarca / Foro
                </label>
                <input
                  type="text"
                  placeholder="Ex: Teresina"
                  value={judicialDistrict}
                  onChange={(e) => setJudicialDistrict(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" />
              <span>{isSubmitting ? "Salvando..." : "Salvar Alterações"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
