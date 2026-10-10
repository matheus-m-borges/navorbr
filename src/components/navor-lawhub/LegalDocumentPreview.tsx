import { useState } from "react";
import {
  FileDown,
  Copy,
  Check,
  Download,
  RotateCcw,
  BookOpen,
  FileCode,
  Printer,
  BookmarkPlus,
  BookmarkCheck,
  Trash2,
  Sparkles,
  RotateCw,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { downloadLegalPetitionPdf } from "@/products/lawhub/documents/legal-pdf-exporter";
import { downloadLegalPetitionWord } from "@/products/lawhub/documents/legal-word-exporter";

interface LegalDocumentPreviewProps {
  title: string;
  content: string;
  source?: string;
  clientName?: string;
  oppositeParty?: string;
  court?: string;
  cnj?: string;
  fileName?: string;
  onReset?: () => void;
  onSaveToHistory?: () => void;
  onDiscard?: () => void;
  isSavedToHistory?: boolean;
  onApplyAiCorrection?: (instructions: string) => Promise<void>;
  isCorrecting?: boolean;
}

export function LegalDocumentPreview({
  title,
  content,
  source,
  clientName,
  oppositeParty,
  court,
  cnj,
  fileName,
  onReset,
  onSaveToHistory,
  onDiscard,
  isSavedToHistory = false,
  onApplyAiCorrection,
  isCorrecting = false,
}: LegalDocumentPreviewProps) {
  const [viewMode, setViewMode] = useState<"abnt" | "raw">("abnt");
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [correctionInput, setCorrectionInput] = useState("");

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Petição copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Peticao_${title.replace(/[\s/]/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Arquivo de texto (.txt) baixado com sucesso!");
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    const toastId = toast.loading("Gerando arquivo PDF da petição com formatação forense...");
    try {
      await downloadLegalPetitionPdf({
        title,
        content,
        clientName,
        oppositeParty,
        court,
        cnj,
        fileName: `Peticao_${title.replace(/[\s/]/g, "_")}_${Date.now()}`,
      });
      toast.dismiss(toastId);
      toast.success("Petição baixada em PDF formatada juridicamente!");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Falha ao exportar PDF: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadWord = () => {
    try {
      downloadLegalPetitionWord({
        title,
        content,
        clientName,
        oppositeParty,
        court,
        cnj,
        fileName: `Peticao_${title.replace(/[\s/]/g, "_")}_${Date.now()}`,
      });
      toast.success("Petição baixada em formato Word (.doc) com margens ABNT!");
    } catch (err: any) {
      toast.error("Falha ao exportar Word: " + (err.message || "Erro desconhecido"));
    }
  };

  // Separa o texto em blocos de parágrafos
  const cleanContent = content
    .replace(/^={3,}.*$/gm, "")
    .replace(/^-{3,}.*$/gm, "");

  const paragraphs = cleanContent
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Barra de Ações Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              ✓ Peça Jurídica Pronta para Protocolo
            </span>
            {source && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Origem: <strong>{source}</strong>
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
            {title} {cnj ? `• Autos: ${cnj}` : ""}
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Modo de Exibição */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 text-xs">
            <button
              onClick={() => setViewMode("abnt")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
                viewMode === "abnt"
                  ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <BookOpen className="size-3.5" />
              <span>Padrão Forense (ABNT)</span>
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
                viewMode === "raw"
                  ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <FileCode className="size-3.5" />
              <span>Texto Puro</span>
            </button>
          </div>

          {/* Botões Principais: Salvar no Histórico e Descartar */}
          {onSaveToHistory && (
            <button
              onClick={onSaveToHistory}
              disabled={isSavedToHistory}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer ${
                isSavedToHistory
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 cursor-default"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              }`}
              title={isSavedToHistory ? "Peça já salva no histórico de consultas" : "Gravar esta peça no histórico para consultas posteriores"}
            >
              {isSavedToHistory ? (
                <>
                  <BookmarkCheck className="size-4" />
                  <span>✓ Salva no Histórico</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="size-4" />
                  <span>Salvar no Histórico</span>
                </>
              )}
            </button>
          )}

          {onDiscard && (
            <button
              onClick={onDiscard}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 cursor-pointer shadow-xs transition"
              title="Descartar minuta sem gravar no histórico"
            >
              <Trash2 className="size-3.5" />
              <span>Descartar</span>
            </button>
          )}

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Baixar a petição em PDF já formatada com parágrafos, recuos e cabeçalho forense"
          >
            <FileDown className="size-4" />
            <span>Baixar PDF</span>
          </button>

          <button
            onClick={handleDownloadWord}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-800 transition shadow-sm cursor-pointer"
            title="Baixar a petição em Word (.doc) com margens e recuos ABNT para edição livre"
          >
            <FileText className="size-4" />
            <span>Baixar Word</span>
          </button>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer shadow-xs"
            title="Copiar petição"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Copiado!" : "Copiar"}</span>
          </button>

          <button
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer shadow-xs"
            title="Baixar em formato .TXT"
          >
            <Download className="size-3.5" />
            <span>.TXT</span>
          </button>

          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer shadow-xs"
              title="Iniciar nova minuta"
            >
              <RotateCcw className="size-3.5" />
              <span>Novo</span>
            </button>
          )}
        </div>
      </div>

      {/* Modo 1: Visualização Forense Autêntica (Padrão Folha A4 Petição) */}
      {viewMode === "abnt" ? (
        <div className="rounded-xl border border-slate-300 bg-slate-100/70 p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-950/40 overflow-x-auto">
          <div className="mx-auto max-w-[800px] rounded-lg border border-slate-200/90 bg-white p-8 sm:p-14 shadow-md text-slate-900 font-serif leading-relaxed dark:border-slate-700 dark:bg-white dark:text-slate-900">
            {/* Cabeçalho da Folha */}
            <div className="border-b border-slate-200 pb-2 mb-8 flex items-center justify-between text-[10px] text-slate-400 font-sans uppercase tracking-wider">
              <span>NAVOR LAWHUB • PEÇA PROCESSUAL</span>
              <span>{cnj ? `PROCESSO: ${cnj}` : "PETIÇÃO JUDICIAL"}</span>
            </div>

            {/* Conteúdo Formatado por Parágrafos Jurídicos */}
            <div className="space-y-4 text-justify text-[13.5px] leading-[1.65]">
              {paragraphs.map((p, idx) => {
                const isCourt = /^EXCELENT[ÍI]SSIM/i.test(p) || /^AO\s+JU[ÍI]ZO/i.test(p);
                const isTitle =
                  (/^(?:PEDIDO\s+DE\s+ALVAR|CONTESTA|PETI|A[ÇC][ÃA]O|RECURSO)/i.test(p) && p.length < 120) ||
                  p.includes("PEDIDO DE ALVARÁ JUDICIAL");
                const isSection =
                  /^(?:[I|V|X]+\.|\bDOS PEDIDOS\b|\bPRELIMINAR|\bDO M[ÉE]RITO|\bDOS FATOS|\bDO DIREITO|\bDA NECESSIDADE|\bDA PROTE|\bDA INTERVEN)/i.test(p) &&
                  p.length < 120;
                const isQuote =
                  p.startsWith('"') ||
                  /^AGRAVO\s+DE\s+INSTRUMENTO/i.test(p) ||
                  /^APELA[ÇC][ÃA]O/i.test(p) ||
                  /^Art\.\s*\d/i.test(p) ||
                  /\(TJ-[A-Z]{2}/i.test(p);
                const isListItem = /^[a-z]\)\s+/i.test(p);
                const isClosing =
                  /^Nesses termos,/i.test(p) ||
                  /^Termos em que,/i.test(p) ||
                  /^ARTHUR CARVALHO/i.test(p) ||
                  /^Advogado/i.test(p) ||
                  /^OAB\//i.test(p);

                if (isCourt) {
                  return (
                    <div
                      key={idx}
                      className="font-bold text-center uppercase tracking-wide text-slate-900 pb-4 pt-1"
                    >
                      {p}
                    </div>
                  );
                }

                if (isTitle) {
                  return (
                    <div
                      key={idx}
                      className="my-6 py-2 border-y-2 border-slate-900 text-center font-bold text-base uppercase tracking-wider text-slate-900"
                    >
                      {p}
                    </div>
                  );
                }

                if (isSection) {
                  return (
                    <h3
                      key={idx}
                      className="pt-4 font-bold text-sm uppercase tracking-wide text-slate-900 not-italic"
                    >
                      {p}
                    </h3>
                  );
                }

                if (isQuote) {
                  return (
                    <blockquote
                      key={idx}
                      className="my-3 ml-8 border-l-4 border-slate-300 pl-4 py-1.5 text-xs text-slate-700 italic bg-slate-50/60 rounded-r leading-relaxed"
                    >
                      {p}
                    </blockquote>
                  );
                }

                if (isListItem) {
                  return (
                    <div key={idx} className="ml-4 pl-2 text-[13px] leading-relaxed">
                      <span className="font-semibold text-slate-900">{p.slice(0, 3)}</span>
                      <span>{p.slice(3)}</span>
                    </div>
                  );
                }

                if (isClosing) {
                  return (
                    <div key={idx} className="pt-4 text-left font-sans text-xs text-slate-800 space-y-1">
                      {p.split("\n").map((line, li) => (
                        <div key={li} className={line.includes("ARTHUR") || line.includes("Advogado") ? "font-bold" : ""}>
                          {line}
                        </div>
                      ))}
                    </div>
                  );
                }

                // Parágrafo Padrão com recuo clássico de primeira linha (indent-8 / 2rem)
                return (
                  <p key={idx} className="indent-8 text-slate-800">
                    {p}
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Modo 2: Texto Puro / Editável */
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-[600px] overflow-y-auto">
          {content}
        </div>
      )}

      {/* Bloco Interativo: Solicitar Correções e Ajustes para a IA */}
      {onApplyAiCorrection && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 p-4 dark:border-indigo-900/40 dark:bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                Solicitar Correções ou Ajustes para a IA
              </h4>
            </div>
            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded">
              Refinamento Interativo
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Deseja alterar valores, incluir novas preliminares, ajustar a qualificação das partes ou retificar algum capítulo? Digite as correções abaixo e a IA atualizará a peça mantendo todo o rigor jurídico:
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              rows={2}
              value={correctionInput}
              onChange={(e) => setCorrectionInput(e.target.value)}
              placeholder="Ex: Altere o valor da causa para R$ 150.000,00, retifique o nome do réu e adicione preliminar de impugnação ao valor da causa..."
              className="w-full rounded-lg border border-indigo-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-indigo-900 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              disabled={isCorrecting || !correctionInput.trim()}
              onClick={async () => {
                if (!correctionInput.trim()) return;
                await onApplyAiCorrection(correctionInput);
                setCorrectionInput("");
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isCorrecting ? (
                <>
                  <RotateCw className="size-3.5 animate-spin" />
                  <span>Aplicando Correções...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Aplicar Correções com IA</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Banner Inferior de Conclusão e Decisão da Minuta */}
      {(onSaveToHistory || onDiscard) && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles className="size-4 text-blue-600 dark:text-blue-400" />
              <span>Fim da Leitura da Peça Jurídica</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Revise os termos e decida se deseja salvar esta petição no histórico de consultas ou descartá-la.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-end">
            {onSaveToHistory && (
              <button
                onClick={onSaveToHistory}
                disabled={isSavedToHistory}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer ${
                  isSavedToHistory
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 cursor-default"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                }`}
              >
                {isSavedToHistory ? (
                  <>
                    <BookmarkCheck className="size-4" />
                    <span>✓ Salva no Histórico</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="size-4" />
                    <span>Salvar Peça no Histórico</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FileDown className="size-4" />
              <span>Baixar PDF Formatado</span>
            </button>

            {onDiscard && (
              <button
                onClick={onDiscard}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-xs dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400"
              >
                <Trash2 className="size-3.5" />
                <span>Descartar Peça</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
