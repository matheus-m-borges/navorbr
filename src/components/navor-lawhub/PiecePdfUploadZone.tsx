import { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  Sparkles,
  Eye,
  ChevronDown,
  ChevronUp,
  FileCode,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PdfReaderService } from "@/products/lawhub/documents/pdf-reader-service";
import type { ExtractedPdfData } from "@/lib/lawhub/types";

interface PiecePdfUploadZoneProps {
  onPdfLoaded: (data: ExtractedPdfData | null) => void;
  onApplyPromptSuggestion?: (suggestion: string) => void;
  pdfData: ExtractedPdfData | null;
  className?: string;
}

const PROMPT_SUGGESTIONS = [
  {
    label: "Contestação Padrão",
    prompt:
      "Faça a contestação arguindo preliminares de inépcia da inicial e ilegitimidade passiva. No mérito, alegue prescrição quinquenal e impugne especificamente o pedido de danos morais demonstrando mero dissabor.",
  },
  {
    label: "Rebater Danos Morais",
    prompt:
      "Elabore contestação com ênfase na ausência de dano moral indenizável, invocando jurisprudência do STJ sobre mero aborrecimento contratual e requerendo a improcedência total dos pedidos autorais.",
  },
  {
    label: "Prescrição + Impugnação de Valores",
    prompt:
      "Faça a contestação alegando prejudicial de prescrição com base no art. 206 do Código Civil, impugnando expressamente a planilha de cálculos do autor e requerendo honorários de sucumbência em 20%.",
  },
  {
    label: "Ilegitimidade + Sem Provas",
    prompt:
      "Apresente contestação demonstrando a ilegitimidade passiva da empresa requerida, ausência de nexo causal e falta de comprovação mínima dos fatos constitutivos do direito do autor (CPC, art. 373, I).",
  },
  {
    label: "Contestação com Reconvenção",
    prompt:
      "Elabore contestação cumulada com Reconvenção com fulcro no art. 343 do CPC, cobrando os valores devidos pelo autor decorrentes do descumprimento contratual comprovado.",
  },
];

export function PiecePdfUploadZone({
  onPdfLoaded,
  onApplyPromptSuggestion,
  pdfData,
  className,
}: PiecePdfUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileProcess = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Por favor, selecione um arquivo em formato PDF (.pdf).");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("O arquivo excede o limite máximo permitido de 100 MB.");
      return;
    }

    setIsExtracting(true);
    const toastId = toast.loading(`Lendo "${file.name}" na íntegra e extraindo autos com IA...`);

    try {
      const extracted = await PdfReaderService.extractTextFromPdf(file);
      onPdfLoaded(extracted);
      toast.dismiss(toastId);
      toast.success(
        `PDF lido com sucesso na íntegra! (${extracted.pageCount} pág${extracted.pageCount > 1 ? "s" : ""})`,
        {
          description: extracted.detectedAuthor
            ? `Partes identificadas: ${extracted.detectedAuthor} vs ${extracted.detectedDefendant || "Contestante"}`
            : "Texto extraído em memória provisória para a IA.",
        }
      );
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Falha ao ler o PDF: " + (err.message || "Tente outro arquivo."));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPdfLoaded(null);
    setShowSummary(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.info("Peça em PDF removida da memória provisória.");
  };

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileProcess(e.target.files[0]);
          }
        }}
      />

      {/* Box de Upload ou Arquivo Carregado */}
      {!pdfData ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer",
            isDragging
              ? "border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/30"
              : "border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-blue-500"
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-slate-200 text-blue-600 group-hover:scale-110 transition dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400">
            {isExtracting ? (
              <Sparkles className="size-6 animate-spin text-blue-600" />
            ) : (
              <UploadCloud className="size-6" />
            )}
          </div>

          <div className="mt-3 space-y-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isExtracting
                ? "Lendo e indexando PDF com a IA..."
                : "Subir peça em PDF (Petição Inicial, Decisão ou Notificação)"}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Ao subir a peça da parte adversa, a IA lê o documento integralmente para redigir a{" "}
              <strong className="text-blue-600 dark:text-blue-400">Contestação</strong> sem que você precise digitar todos os fatos.
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400">
            <span className="rounded-md bg-blue-100/70 px-2 py-0.5 dark:bg-blue-950 dark:text-blue-300">
              PDF até 100 MB
            </span>
            <span>•</span>
            <span className="text-slate-500 dark:text-slate-400">Processamento Provisório em Memória (Não Armazenado)</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/30 transition">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 font-mono text-xs font-black shadow-xs">
                PDF
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {pdfData.fileName}
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="size-3" /> Peça Indexada
                  </span>
                  <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300" title="O arquivo não fica salvo em servidores">
                    Provisório em Memória
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pdfData.fileSize} • {pdfData.pageCount} página{pdfData.pageCount > 1 ? "s" : ""}{" "}
                  {pdfData.detectedCnj ? `• CNJ: ${pdfData.detectedCnj}` : ""}
                </p>

                {/* Tags de metadados identificados */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {pdfData.detectedAuthor && (
                    <span className="rounded bg-white/90 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <strong>Autor:</strong> {pdfData.detectedAuthor}
                    </span>
                  )}
                  {pdfData.detectedDefendant && (
                    <span className="rounded bg-white/90 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <strong>Réu:</strong> {pdfData.detectedDefendant}
                    </span>
                  )}
                  {pdfData.detectedValue && (
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
                      Valor Causa: R$ {pdfData.detectedValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowSummary(!showSummary)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-xs"
                title="Visualizar a íntegra ou síntese do PDF extraído"
              >
                <Eye className="size-3 text-blue-600" />
                <span>{showSummary ? "Ocultar Texto" : "Ver Íntegra Lida"}</span>
                {showSummary ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>

              <button
                type="button"
                onClick={handleRemove}
                className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition"
                title="Remover este arquivo PDF"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Drawer com a íntegra lida do PDF para a IA */}
          {showSummary && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 animate-in fade-in space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <FileCode className="size-3.5 text-blue-600" />
                  Texto Integral Lido pela IA ({pdfData.pageCount} pág{pdfData.pageCount > 1 ? "s" : ""} •{" "}
                  {pdfData.extractedText?.length.toLocaleString("pt-BR")} caracteres):
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                  Íntegra Disponível para a Redação
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto rounded bg-slate-50 p-2.5 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-950 dark:text-slate-300 border border-slate-100 dark:border-slate-800 whitespace-pre-wrap select-text">
                {pdfData.extractedText || pdfData.summary}
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                * Toda a íntegra acima é transmitida para a IA cruzar com o comando de redação que você definir no campo abaixo.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sugestões rápidas de diretrizes para o prompt */}
      {onApplyPromptSuggestion && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Zap className="size-3 text-amber-500" />
              Diretrizes Rápidas para a Contestação (Clique para preencher):
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PROMPT_SUGGESTIONS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onApplyPromptSuggestion(item.prompt)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400 transition shadow-xs"
              >
                + {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
