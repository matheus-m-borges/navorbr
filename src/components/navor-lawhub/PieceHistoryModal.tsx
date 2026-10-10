import { useState, useMemo, useEffect } from "react";
import {
  History,
  X,
  Search,
  FileText,
  Copy,
  Check,
  Download,
  Trash2,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCode,
  FileDown,
  RotateCw,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LawHubDraftHistoryService,
  type LawHubAiDraftRecord,
} from "@/lib/lawhub/draft-history-service";
import { downloadLegalPetitionPdf } from "@/products/lawhub/documents/legal-pdf-exporter";

interface PieceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDraft?: (draft: LawHubAiDraftRecord) => void;
}

export function PieceHistoryModal({
  isOpen,
  onClose,
  onSelectDraft,
}: PieceHistoryModalProps) {
  const [history, setHistory] = useState<LawHubAiDraftRecord[]>(() =>
    LawHubDraftHistoryService.getDraftHistory()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Escuta instantaneamente qualquer peça salva e sincroniza com a nuvem
  useEffect(() => {
    // 1. Carrega o estado local atual de imediato
    setHistory(LawHubDraftHistoryService.getDraftHistory());

    // 2. Inscreve ouvinte reativo para refletir qualquer salvamento IMEDIATAMENTE (sem F5!)
    const unsubscribe = LawHubDraftHistoryService.subscribe((updated) => {
      setHistory(updated);
    });

    // 3. Ao abrir o modal, sincroniza silenciosamente com o Supabase na nuvem (compartilhado entre máquinas)
    if (isOpen) {
      setIsLoadingCloud(true);
      LawHubDraftHistoryService.syncWithCloud()
        .then((cloudList) => {
          if (cloudList) setHistory(cloudList);
        })
        .finally(() => {
          setIsLoadingCloud(false);
        });
    }

    return () => unsubscribe();
  }, [isOpen]);

  // Recarrega sempre que o modal abre
  if (!isOpen) return null;

  const refreshHistory = () => {
    setHistory(LawHubDraftHistoryService.getDraftHistory());
  };

  const filteredHistory = history.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.pieceType?.toLowerCase().includes(query) ||
      item.userPrompt?.toLowerCase().includes(query) ||
      item.clientName?.toLowerCase().includes(query) ||
      item.oppositeParty?.toLowerCase().includes(query) ||
      item.cnj?.toLowerCase().includes(query) ||
      item.fileName?.toLowerCase().includes(query)
    );
  });

  const handleCopy = (item: LawHubAiDraftRecord) => {
    navigator.clipboard.writeText(item.draft);
    setCopiedId(item.id);
    toast.success("Peça copiada para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (item: LawHubAiDraftRecord) => {
    const blob = new Blob([item.draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Historico_${item.pieceType.replace(/[\s/]/g, "_")}_${new Date(item.createdAt).toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Minuta baixada com sucesso!");
  };

  const handleDownloadPdf = async (item: LawHubAiDraftRecord) => {
    const toastId = toast.loading("Gerando PDF da petição com formatação jurídica...");
    try {
      await downloadLegalPetitionPdf({
        title: item.pieceType,
        content: item.draft,
        clientName: item.clientName,
        oppositeParty: item.oppositeParty,
        court: item.court,
        cnj: item.cnj,
        fileName: `Historico_${item.pieceType.replace(/[\s/]/g, "_")}_${item.cnj ? item.cnj.replace(/[^\d]/g, "") : Date.now()}`,
      });
      toast.dismiss(toastId);
      toast.success("Petição em PDF baixada com sucesso!");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Falha ao gerar PDF: " + (err.message || "Erro desconhecido"));
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Deseja realmente remover esta peça do histórico?")) {
      LawHubDraftHistoryService.deleteDraftFromHistory(id);
      refreshHistory();
      toast.success("Peça removida do histórico.");
    }
  };

  const handleClearAll = () => {
    if (
      confirm(
        "Atenção: Deseja apagar TODO o histórico de peças geradas? Essa ação não pode ser desfeita."
      )
    ) {
      LawHubDraftHistoryService.clearDraftHistory();
      refreshHistory();
      toast.success("Histórico de peças limpo com sucesso.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="flex h-[90vh] max-h-[850px] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <History className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Histórico de Peças Criadas por IA
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {history.length} {history.length === 1 ? "peça salva" : "peças salvas"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consulte e reutilize as minutas, pedidos e diretrizes geradas pela IA do escritório.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-slate-500 hover:text-red-600 transition px-2 py-1"
                title="Limpar todas as peças salvas"
              >
                Limpar Histórico
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div className="border-b border-slate-100 p-4 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por tipo de peça, partes, CNJ, comando do advogado ou nome do PDF..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Lista de Peças */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <FileCode className="size-7" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                {searchQuery ? "Nenhuma peça encontrada para esta busca" : "Nenhuma peça criada ainda"}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                {searchQuery
                  ? "Tente outros termos como o nome das partes, número do processo ou tipo da peça."
                  : "Todas as peças que você redigir com a IA (com ou sem PDF) serão salvas automaticamente aqui para consultas posteriores."}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isExpanded = expandedId === item.id;
              const formattedDate = new Date(item.createdAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 shadow-xs overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="p-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.pieceType}
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Calendar className="size-3" /> {formattedDate}
                          </span>
                          {item.fileName && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300">
                              PDF Lido: {item.fileName} ({item.pageCount || 1} pág)
                            </span>
                          )}
                          {item.source && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              {item.source}
                            </span>
                          )}
                        </div>

                        {/* Partes e CNJ */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-0.5">
                          {item.oppositeParty && (
                            <span>
                              <strong>Autor:</strong> {item.oppositeParty}
                            </span>
                          )}
                          {item.clientName && (
                            <>
                              <span>•</span>
                              <span>
                                <strong>Réu/Cliente:</strong> {item.clientName}
                              </span>
                            </>
                          )}
                          {item.cnj && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[11px]">CNJ: {item.cnj}</span>
                            </>
                          )}
                        </div>

                        {/* O que o advogado pediu */}
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 pt-1 italic">
                          "{item.userPrompt}"
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(item);
                          }}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 transition"
                          title="Copiar texto da minuta"
                        >
                          {copiedId === item.id ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPdf(item);
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950 dark:text-red-300 transition"
                          title="Baixar em PDF"
                        >
                          <FileDown className="size-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item);
                          }}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 transition"
                          title="Baixar arquivo .txt"
                        >
                          <Download className="size-3.5" />
                        </button>

                        {onSelectDraft && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDraft(item);
                              onClose();
                            }}
                            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="Reabrir esta peça para solicitar correções e novas versões com a IA"
                          >
                            <Sparkles className="size-3.5" />
                            <span>Reabrir e Corrigir com IA</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition"
                          title="Excluir do histórico"
                        >
                          <Trash2 className="size-3.5" />
                        </button>

                        <div className="pl-1 text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes Expandidos da Minuta */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <FileText className="size-3.5 text-blue-600" />
                          Íntegra da Minuta Gerada:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadPdf(item)}
                            className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700 shadow-xs transition"
                          >
                            <FileDown className="size-3" /> Baixar PDF
                          </button>
                          <button
                            onClick={() => handleCopy(item)}
                            className="inline-flex items-center gap-1 rounded bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                          >
                            {copiedId === item.id ? (
                              <Check className="size-3 text-emerald-600" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            Copiar
                          </button>
                          {onSelectDraft && (
                            <button
                              onClick={() => {
                                onSelectDraft(item);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                            >
                              <Sparkles className="size-3" /> Reabrir e Corrigir com IA
                            </button>
                          )}
                          <button
                            onClick={() => handleDownloadPdf(item)}
                            className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 shadow-xs"
                          >
                            <FileDown className="size-3" /> Baixar PDF
                          </button>
                        </div>
                      </div>

                      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 font-mono text-[11px] leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 whitespace-pre-wrap select-text">
                        {item.draft}
                      </div>

                      <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                        * O arquivo PDF anexado no momento da redação foi lido em memória provisória e não ficou armazenado. O histórico retém a minuta processual completa e as instruções do advogado para consultas permanentes.
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
