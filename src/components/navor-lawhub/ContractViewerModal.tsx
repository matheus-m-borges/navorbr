import React, { useState } from "react";
import {
  X,
  Printer,
  Download,
  Edit3,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  PenTool,
  Save,
  Clock,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LawContract } from "@/lib/lawhub/contract-types";
import { ContractService } from "@/lib/lawhub/contract-service";

interface ContractViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: LawContract;
  onUpdated?: (updated: LawContract) => void;
}

export function ContractViewerModal({
  isOpen,
  onClose,
  contract,
  onUpdated,
}: ContractViewerModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(contract.content);
  const [currentContract, setCurrentContract] = useState<LawContract>(contract);

  if (!isOpen) return null;

  const handleSaveEdit = async () => {
    try {
      const updated = await ContractService.updateContract(currentContract.id, {
        content: editedContent,
      });
      if (updated) {
        setCurrentContract(updated);
        onUpdated?.(updated);
        setIsEditing(false);
        toast.success("Texto do contrato salvo com sucesso!");
      }
    } catch {
      toast.error("Erro ao salvar alterações no contrato.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header Superior */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {currentContract.title}
                </h3>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    currentContract.status === "assinado"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                  )}
                >
                  {currentContract.status === "assinado" ? "Assinado & Vigente" : "Minuta em Elaboração"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Nº: <strong className="text-slate-700 dark:text-slate-200">{currentContract.contract_number}</strong> • Cliente:{" "}
                <strong className="text-slate-700 dark:text-slate-200">{currentContract.client_name}</strong>
                {currentContract.process_cnj && (
                  <span> • Processo: <strong>{currentContract.process_cnj}</strong></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                <Edit3 className="size-3.5 text-blue-600" />
                <span className="hidden sm:inline">Editar Minuta</span>
              </button>
            ) : (
              <button
                onClick={handleSaveEdit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition"
              >
                <Save className="size-3.5" />
                <span>Salvar Texto</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              title="Imprimir ou Salvar PDF"
            >
              <Printer className="size-3.5 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Corpo com o Contrato Estilizado */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 dark:bg-slate-950/60">
          {/* Aviso sobre Assinatura Eletrônica e GED */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300">
            <div className="flex items-center gap-2.5">
              <Clock className="size-4 text-slate-500 shrink-0" />
              <span>
                Status: <strong>{currentContract.status === "assinado" ? "Assinado" : "Minuta em elaboração"}</strong>. Assinatura eletrônica e GED indisponíveis neste bloco (em homologação).
              </span>
            </div>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed shrink-0"
              title="Módulo de assinatura eletrônica indisponível neste ambiente"
            >
              <PenTool className="size-3.5" />
              <span>Assinatura Indisponível</span>
            </button>
          </div>

          {/* Folha do Contrato (Visual de Papel Timbrado) */}
          <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 sm:p-12 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
            {/* Cabeçalho do Escritório */}
            <div className="border-b-2 border-slate-800 pb-4 mb-6 text-center">
              {currentContract.office_name ? (
                <h2 className="text-base font-black tracking-wide uppercase text-slate-900 dark:text-white">
                  {currentContract.office_name}
                </h2>
              ) : null}
              {(currentContract.office_address || currentContract.office_cnpj) && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {[currentContract.office_address, currentContract.office_cnpj ? `CNPJ: ${currentContract.office_cnpj}` : ""].filter(Boolean).join(" • ")}
                </p>
              )}
              {currentContract.lawyer_name && (
                <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mt-0.5">
                  Responsável: {currentContract.lawyer_name} {currentContract.lawyer_oab ? `(${currentContract.lawyer_oab})` : ""}
                </p>
              )}
            </div>

            {/* Conteúdo do Contrato */}
            {isEditing ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  Modo de Edição Livre das Cláusulas:
                </label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={20}
                  className="w-full rounded-xl border border-slate-300 bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-xs sm:text-[13px] leading-relaxed font-serif text-slate-800 dark:text-slate-200">
                {currentContract.content}
              </div>
            )}

            {/* Área de Exibição das Assinaturas Registradas */}
            {currentContract.status === "assinado" && (
              <div className="mt-8 pt-6 border-t-2 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="size-5 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Registro de Assinaturas e Rubricas
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Assinatura do Cliente */}
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Assinatura do Contratante:</p>
                    {currentContract.client_signature_image ? (
                      <div className="my-2 bg-white rounded p-2 border border-slate-200 dark:border-slate-700">
                        <img
                          src={currentContract.client_signature_image}
                          alt="Assinatura Cliente"
                          className="h-16 w-auto object-contain mx-auto"
                        />
                      </div>
                    ) : (
                      <div className="my-2 py-3 border-b border-slate-300 text-center font-cursive text-sm text-blue-800 dark:text-blue-300">
                        {currentContract.signed_by_client_name || currentContract.client_name}
                      </div>
                    )}
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      {currentContract.signed_by_client_name || currentContract.client_name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Registrado em {currentContract.signed_at || "Data do registro"} via{" "}
                      {currentContract.signature_type === "tablet_touch"
                        ? "Rubrica Presencial (Tablet/Tela)"
                        : currentContract.signature_type === "upload_digitalizado"
                        ? `Upload Digitalizado (${currentContract.uploaded_file_name || "PDF"})`
                        : "Registro em Tela"}
                    </p>
                  </div>

                  {/* Assinatura do Advogado */}
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Assinatura do Contratado:</p>
                    <div className="my-2 py-3 border-b border-slate-300 text-center font-cursive text-sm text-blue-800 dark:text-blue-300">
                      {currentContract.signed_by_lawyer_name || currentContract.lawyer_name}
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      {currentContract.signed_by_lawyer_name || currentContract.lawyer_name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {currentContract.lawyer_oab} • Sócio Responsável
                    </p>
                  </div>
                </div>

                {/* Identificador de Registro */}
                {currentContract.digital_certificate_hash && (
                  <div className="mt-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 text-[10px] text-slate-500 font-mono">
                    Identificador de Registro: {currentContract.digital_certificate_hash}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
