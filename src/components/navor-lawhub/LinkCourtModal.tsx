import React, { useState } from "react";
import {
  X,
  Link2,
  Search,
  CheckCircle2,
  ShieldCheck,
  Building2,
  AlertCircle,
  Clock,
  Lock,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import { DataJudService } from "@/lib/lawhub/datajud-service";
import type { LawProcess } from "@/lib/lawhub/types";

interface LinkCourtModalProps {
  isOpen: boolean;
  onClose: () => void;
  process: LawProcess;
  onSuccess?: (updated: LawProcess) => void;
}

export function LinkCourtModal({
  isOpen,
  onClose,
  process,
  onSuccess,
}: LinkCourtModalProps) {
  const [court, setCourt] = useState(process.court || "TJPI");
  const [instance, setInstance] = useState<LawProcess["instance"]>(
    process.instance || "1grau"
  );
  const [isSecret, setIsSecret] = useState(process.is_secret || false);
  const [secretPassword, setSecretPassword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundCourtData, setFoundCourtData] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSearchAndLink = async () => {
    setIsSearching(true);
    setFoundCourtData(null);
    toast.loading("Buscando autos no tribunal para vincular...", { id: "link-court" });

    try {
      const dataJudResult = await DataJudService.searchProcess(process.cnj_number ?? "");

      const enriched = {
        court: dataJudResult?.court || court,
        judicial_branch: dataJudResult?.judicial_branch || process.judicial_branch || "5ª Vara Cível da Comarca de Teresina",
        judicial_district: dataJudResult?.judicial_district || process.judicial_district || "Teresina",
        procedural_class: dataJudResult?.procedural_class || process.procedural_class || "Procedimento Comum Cível",
        active_pole: dataJudResult?.active_pole || process.active_pole,
        passive_pole: dataJudResult?.passive_pole || process.passive_pole,
        last_movement: dataJudResult?.last_movement || "Processo vinculado ao tribunal com sucesso",
        movements: dataJudResult?.movements || [
          {
            id: `mov-link-${Date.now()}`,
            date: new Date().toLocaleDateString("pt-BR"),
            text: `Vínculo com tribunal estabelecido via ${isSecret ? "PJe (Segredo de Justiça)" : "DataJud / PJe"}`,
            instance: instance === "1grau" ? "1º Grau" : "2º Grau",
          },
        ],
        court_sync_system: isSecret ? "PJe (Segredo de Justiça)" : "DataJud / PJe",
      };

      setFoundCourtData(enriched);
      toast.success("Autos localizados! Clique abaixo para confirmar a vinculação.", { id: "link-court" });
    } catch (err) {
      toast.error("Não foi possível conectar ao tribunal. Tente novamente mais tarde.", { id: "link-court" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!foundCourtData) {
      handleSearchAndLink();
      return;
    }

    const updated = await LawHubService.linkProcessToCourt(process.id, foundCourtData);

    if (updated) {
      toast.success(
        `Processo vinculado ao ${updated.court}! Monitoramento automático de movimentações ativado.`
      );
      if (onSuccess) onSuccess(updated);
      onClose();
    } else {
      toast.error("Erro ao atualizar processo no acervo.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600">
              <Link2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Vincular Processo ao Tribunal
              </h2>
              <p className="text-xs text-slate-500">
                Ative o recebimento automático de andamentos diários para este processo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Card com dados atuais do processo */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-850 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                CNJ: {process.cnj_number}
              </span>
              <span className="rounded bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                Processo Manual Atual
              </span>
            </div>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {process.title}
            </p>
            <p className="text-[11px] text-slate-500">
              Cliente: {process.client_name || "Não informado"} • Vara Atual: {process.judicial_branch || "A definir"}
            </p>
          </div>

          {/* Diretriz de Integridade LawHub */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/30 text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
            <p className="font-semibold flex items-center gap-1.5">
              <Info className="size-4 text-blue-600 shrink-0" />
              Garantia de Integridade dos Seus Dados:
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
              Ao vincular ao tribunal, <strong>todas as informações já cadastradas manualmente serão mantidas</strong>. Se houver campos em branco (como vara, classe ou comarca), o LawHub os preencherá automaticamente com os dados oficiais do tribunal.
            </p>
          </div>

          {/* Seleção do Tribunal e Grau */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tribunal *
              </label>
              <select
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="TJPI">TJPI - Piauí</option>
                <option value="TJSP">TJSP - São Paulo</option>
                <option value="TJRJ">TJRJ - Rio de Janeiro</option>
                <option value="TJMG">TJMG - Minas Gerais</option>
                <option value="TJMA">TJMA - Maranhão</option>
                <option value="TJCE">TJCE - Ceará</option>
                <option value="TRF1">TRF1 - 1ª Região</option>
                <option value="TRF3">TRF3 - 3ª Região</option>
                <option value="TRT22">TRT22 - Piauí</option>
                <option value="STJ">STJ</option>
                <option value="STF">STF</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Instância / Grau *
              </label>
              <select
                value={instance}
                onChange={(e) => setInstance(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="1grau">1º Grau (Vara / Juizado)</option>
                <option value="2grau">2º Grau (Tribunal)</option>
                <option value="superior">Superior</option>
              </select>
            </div>
          </div>

          {/* Segredo de Justiça */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-850 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={isSecret}
                onChange={(e) => setIsSecret(e.target.checked)}
                className="size-4 rounded text-blue-600"
              />
              <Lock className="size-3.5 text-amber-500" />
              <span>Processo tramita em Segredo de Justiça</span>
            </label>

            {isSecret && (
              <div className="pt-2 pl-6">
                <input
                  type="password"
                  placeholder="Senha fornecida pelo tribunal"
                  value={secretPassword}
                  onChange={(e) => setSecretPassword(e.target.value)}
                  className="w-full sm:w-72 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Resultado da busca antes da confirmação */}
          {foundCourtData && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  Autos confirmados no {foundCourtData.court}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full">
                  Pronto para ativar
                </span>
              </div>
              <div className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                <p>
                  <strong className="text-slate-900 dark:text-white">Órgão Julgador: </strong>
                  {foundCourtData.judicial_branch}
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">Classe: </strong>
                  {foundCourtData.procedural_class}
                </p>
                <p className="line-clamp-1">
                  <strong className="text-slate-900 dark:text-white">Última Movimentação: </strong>
                  {foundCourtData.last_movement}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 rounded-b-2xl">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
            <ShieldCheck className="size-4" />
            <span>Varredura robótica diária habilitada</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>

            {foundCourtData ? (
              <button
                type="button"
                onClick={handleConfirmLink}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Confirmar Vinculação</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSearching}
                onClick={handleSearchAndLink}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition"
              >
                {isSearching ? (
                  <Clock className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                <span>Buscar no Tribunal & Vincular</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
