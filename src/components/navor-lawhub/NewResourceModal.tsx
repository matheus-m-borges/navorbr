import React, { useState } from "react";
import {
  X,
  Scale,
  GitBranch,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type {
  LawProcess,
  LawResourceType,
  LawResourceCategory,
  LawResourceStatus,
} from "@/lib/lawhub/types";

interface NewResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  process: LawProcess;
  initialCategory?: LawResourceCategory;
  onSuccess: () => void;
}

const RESOURCE_TYPES_BY_CATEGORY: Record<
  LawResourceCategory,
  Array<{ value: LawResourceType; label: string }>
> = {
  recurso: [
    { value: "apelacao", label: "Apelação Cível" },
    { value: "agravo_instrumento", label: "Agravo de Instrumento" },
    { value: "embargos_declaracao", label: "Embargos de Declaração" },
    { value: "recurso_especial", label: "Recurso Especial (STJ)" },
    { value: "recurso_extraordinario", label: "Recurso Extraordinário (STF)" },
    { value: "recurso_ordinario", label: "Recurso Ordinário" },
    { value: "outro", label: "Outro Recurso" },
  ],
  desdobramento: [
    { value: "cumprimento_sentenca", label: "Cumprimento de Sentença" },
    { value: "incidente", label: "Incidente Processual (ex: Desconsideração de PJ)" },
    { value: "outro", label: "Outro Desdobramento" },
  ],
  apenso: [
    { value: "apenso", label: "Processo Apenso / Conexo" },
    { value: "outro", label: "Outro Apenso" },
  ],
};

export function NewResourceModal({
  isOpen,
  onClose,
  process,
  initialCategory = "recurso",
  onSuccess,
}: NewResourceModalProps) {
  const [category, setCategory] = useState<LawResourceCategory>(initialCategory);
  const [resourceType, setResourceType] = useState<LawResourceType>(
    initialCategory === "desdobramento"
      ? "cumprimento_sentenca"
      : initialCategory === "apenso"
      ? "apenso"
      : "apelacao"
  );
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [court, setCourt] = useState(
    process.court ? `${process.court} - 2º Grau / Câmara Cível` : "TJPI - 1ª Câmara Especializada Cível"
  );
  const [chamber, setChamber] = useState("1ª Câmara Cível");
  const [rapporteur, setRapporteur] = useState("");
  const [interpositionDate, setInterpositionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [value, setValue] = useState<string>(
    process.case_value ? String(process.case_value) : ""
  );
  const [status, setStatus] = useState<LawResourceStatus>("ativo");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincronizar estado quando o modal abre ou a categoria inicial muda
  React.useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      const available = RESOURCE_TYPES_BY_CATEGORY[initialCategory];
      if (available && available.length > 0 && available[0]) {
        setResourceType(available[0].value);
      }
      setTitle("");
      setNumber("");
      setNotes("");
      setCourt(process.court ? `${process.court} - 2º Grau / Câmara Cível` : "TJPI - 1ª Câmara Especializada Cível");
      setInterpositionDate(new Date().toISOString().slice(0, 10));
      setValue(process.case_value ? String(process.case_value) : "");
      setStatus("ativo");
    }
  }, [isOpen, initialCategory, process]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: LawResourceCategory) => {
    setCategory(newCat);
    const available = RESOURCE_TYPES_BY_CATEGORY[newCat];
    if (available && available.length > 0 && available[0]) {
      setResourceType(available[0].value);
    }
  };

  const parseMoney = (val: string): number | undefined => {
    if (!val || !val.trim()) return undefined;
    const clean = val.trim().replace(/\./g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle =
      title.trim() ||
      `${RESOURCE_TYPES_BY_CATEGORY[category]?.find((r) => r.value === resourceType)?.label || "Recurso"} - ${process.title || process.cnj_number || "Autos"}`;

    setIsSubmitting(true);
    try {
      await LawHubService.addProcessResource(process.id, {
        parent_process_id: process.id,
        title: finalTitle,
        category,
        resource_type: resourceType,
        number: number.trim() || undefined,
        court: court.trim() || undefined,
        chamber_or_section: chamber.trim() || undefined,
        rapporteur: rapporteur.trim() || undefined,
        interposition_date: interpositionDate || undefined,
        status,
        value: parseMoney(value),
        notes: notes.trim() || undefined,
      });

      toast.success(
        category === "recurso"
          ? "Recurso cadastrado e vinculado aos autos com sucesso!"
          : category === "desdobramento"
          ? "Desdobramento cadastrado com sucesso!"
          : "Processo apenso vinculado com sucesso!"
      );
      onSuccess();
      onClose();
    } catch {
      toast.error("Erro ao cadastrar recurso. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <GitBranch className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cadastrar Recurso ou Desdobramento
              </h3>
              <p className="text-xs text-slate-500">
                Vinculado ao processo principal {process.cnj_number || process.title}
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
          {/* Categoria: Recurso | Desdobramento | Apenso */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Tipo de Vínculo Processual
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleCategoryChange("recurso")}
                className={cn(
                  "p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1",
                  category === "recurso"
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700 shadow-2xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
              >
                <Scale className="size-4" />
                <span>Recurso (2º Grau / STJ / STF)</span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("desdobramento")}
                className={cn(
                  "p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1",
                  category === "desdobramento"
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700 shadow-2xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
              >
                <GitBranch className="size-4" />
                <span>Desdobramento / Execução</span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("apenso")}
                className={cn(
                  "p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1",
                  category === "apenso"
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700 shadow-2xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
              >
                <FileText className="size-4" />
                <span>Processo Apenso</span>
              </button>
            </div>
          </div>

          {/* Espécie do Recurso / Desdobramento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Espécie / Classe
              </label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value as LawResourceType)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {RESOURCE_TYPES_BY_CATEGORY[category].map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Status Atual
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LawResourceStatus)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="ativo">Ativo / Em Tramitação</option>
                <option value="julgado">Julgado</option>
                <option value="provido">Provido / Procedente</option>
                <option value="nao_provido">Não Provido / Improvido</option>
                <option value="encerrado">Encerrado / Baixado</option>
                <option value="suspenso">Suspenso</option>
              </select>
            </div>
          </div>

          {/* Título Identificador */}
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Identificação / Título do Recurso
            </label>
            <input
              type="text"
              placeholder={`Ex: ${
                category === "recurso"
                  ? "Apelação Cível da Parte Autora"
                  : "Cumprimento Definitivo de Sentença"
              }`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Número Próprio (CNJ 2º Grau ou Numeração Incidente) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Número do Recurso / Incidente (CNJ)
              </label>
              <input
                type="text"
                placeholder={process.cnj_number ? `${process.cnj_number}/01` : "0000000-00.0000.8.18.0000"}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Data de Interposição / Protocolo
              </label>
              <input
                type="date"
                value={interpositionDate}
                onChange={(e) => setInterpositionDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Tribunal e Câmara / Seção Julgadora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Tribunal / Foro
              </label>
              <input
                type="text"
                placeholder="Ex: TJPI, TRF1, STJ"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Câmara / Turma / Relator
              </label>
              <input
                type="text"
                placeholder="Ex: 1ª Câmara Cível - Des. Relator"
                value={rapporteur}
                onChange={(e) => setRapporteur(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Valor da Causa do Recurso / Execução */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Valor Envolvido (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 dark:bg-slate-800/50 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white">Partes herdadas:</span>{" "}
                {process.active_pole || "Autor"} x {process.passive_pole || "Réu"}
              </div>
            </div>
          </div>

          {/* Observações / Estratégia */}
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Notas e Observações Estratégicas
            </label>
            <textarea
              rows={2}
              placeholder="Anotações internas, fundamentos do recurso ou prazos de resposta..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Footer Actions */}
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" />
              <span>{isSubmitting ? "Salvando..." : "Salvar Registro"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
