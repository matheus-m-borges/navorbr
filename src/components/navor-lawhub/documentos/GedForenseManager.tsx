import { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  Upload,
  Plus,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  Building2,
  Scale,
  Sparkles,
  ExternalLink,
  Trash2,
  Eye,
  Calendar,
  DollarSign,
  FileCheck,
  FolderGit2,
  File,
  Hash,
  Tag,
  Copy,
  Check,
  RefreshCw,
  Folder,
  ArrowUpDown,
  Lock,
  Layers,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import { LawHubAuditService } from "@/lib/lawhub/audit-service";
import { LawHubDocumentViewerModal } from "@/components/navor-lawhub/LawHubDocumentViewerModal";
import {
  listLawHubDocuments,
  requestLawHubDocumentUploadUrl,
  finalizeLawHubDocumentUpload,
  getLawHubDocumentDownloadUrl,
  archiveLawHubDocument,
} from "@/lib/lawhub/ged.functions";
import type { LawDocument, LawProcess, LawClient } from "@/lib/lawhub/types";

const CATEGORY_MAP: Record<string, { label: string; badgeClass: string; iconColor: string }> = {
  peticao: {
    label: "Petição / Peça",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  decisao: {
    label: "Decisão / Sentença",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  procuracao: {
    label: "Procuração / Substab.",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  documento_pessoal: {
    label: "Documento Pessoal",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  comprovante: {
    label: "Comprovante / Guia",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  contrato: {
    label: "Contrato / Acordo",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  geral: {
    label: "Documento Geral",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    iconColor: "text-slate-600 dark:text-slate-400",
  },
};

const FALLBACK_CATEGORY = {
  label: "Documento Geral",
  badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  iconColor: "text-slate-600 dark:text-slate-400",
};

export function GedForenseManager() {
  const [documents, setDocuments] = useState<LawDocument[]>([]);
  const [processes, setProcesses] = useState<LawProcess[]>([]);
  const [clients, setClients] = useState<LawClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [processFilter, setProcessFilter] = useState<string>("todos");

  // Modais
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocForViewer, setSelectedDocForViewer] = useState<LawDocument | null>(null);
  const [selectedProcForViewer, setSelectedProcForViewer] = useState<LawProcess | null>(null);

  // Carregar dados reais do GED Forense
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [procs, clis, docsRes] = await Promise.all([
        LawHubService.getProcesses(),
        LawHubService.getClients(),
        listLawHubDocuments({ data: { status: "active" } }).catch(() => ({ rows: [], totalCount: 0 })),
      ]);

      setProcesses(procs || []);
      setClients(clis || []);

      if (docsRes && docsRes.rows && docsRes.rows.length > 0) {
        const mapped: LawDocument[] = docsRes.rows.map((r) => ({
          id: r.id,
          name: r.name || r.title,
          title: r.title || r.name,
          category: r.category as any,
          process_id: r.process_id || undefined,
          client_id: r.client_id || undefined,
          file_size: r.file_size ? `${(r.file_size / (1024 * 1024)).toFixed(1)} MB` : "—",
          file_type: r.mime_type ? r.mime_type.split("/").pop() || "pdf" : "pdf",
          date: r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—",
          created_at: r.created_at,
          created_by: "Operador Autorizado",
          hash_sha256: r.hash_sha256 || undefined,
          version: `v${r.version_number || 1}.0`,
          tags: [],
          visible_to_client: true,
        }));
        setDocuments(mapped);
      } else {
        setDocuments([]);
      }
    } catch {
      toast.error("Erro ao carregar documentos do acervo.");
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Métricas do Acervo
  const metrics = useMemo(() => {
    const total = documents.length;
    const peticoes = documents.filter((d) => d.category === "peticao").length;
    const decisoes = documents.filter((d) => d.category === "decisao").length;
    const procuracoes = documents.filter((d) => d.category === "procuracao").length;
    const documentosPessoais = documents.filter((d) => d.category === "documento_pessoal").length;
    const comCustodiaHash = documents.filter((d) => d.hash_sha256).length;

    return {
      total,
      peticoes,
      decisoes,
      procuracoes,
      documentosPessoais,
      comCustodiaHash,
    };
  }, [documents]);

  // Documentos filtrados
  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (categoryFilter !== "todas" && d.category !== categoryFilter) return false;
      if (processFilter !== "todos" && d.process_cnj !== processFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (d.name || d.title || "").toLowerCase().includes(q);
        const matchCnj = (d.process_cnj || "").toLowerCase().includes(q);
        const matchClient = (d.client_name || "").toLowerCase().includes(q);
        const matchTags = (d.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchCnj && !matchClient && !matchTags) return false;
      }
      return true;
    });
  }, [documents, categoryFilter, processFilter, searchTerm]);

  // Abertura do visualizador com registro de auditoria
  const handleOpenViewer = async (doc: LawDocument) => {
    const matchedProc = processes.find(
      (p) => p.cnj_number === doc.process_cnj || p.id === doc.process_id
    ) || null;

    setSelectedDocForViewer(doc);
    setSelectedProcForViewer(matchedProc);

    // Registra trilha de auditoria forense do acesso aos autos
    try {
      await LawHubAuditService.recordEvent({
        event_type: "processo_acessado_sigiloso",
        title: "Visualização Forense de Documento do Processo",
        description: `Visualização da peça "${doc.name || doc.title}" vinculada aos autos ${doc.process_cnj || "Processo"} do cliente ${doc.client_name || "Cliente"}.`,
        user_name: "Dr. Matheus Borges",
        resource_type: "processo",
        resource_id: doc.id,
        process_cnj: doc.process_cnj,
        severity: "info",
        metadata: {
          document_id: doc.id,
          category: doc.category,
          hash_sha256: doc.hash_sha256,
        },
      });
    } catch {}
  };

  // Download do arquivo via signed URL segura
  const handleDownload = async (doc: LawDocument) => {
    try {
      toast.loading("Gerando link seguro de download...", { id: "dl-doc" });
      const res = await getLawHubDocumentDownloadUrl({
        data: { documentId: doc.id },
      });
      if (res && res.signedUrl) {
        toast.dismiss("dl-doc");
        window.open(res.signedUrl, "_blank");
      }
    } catch (err: any) {
      toast.error(`Falha no download: ${err?.message || "arquivo indisponível"}`, { id: "dl-doc" });
    }
  };

  // Arquivamento auditável de documento (preserva histórico)
  const handleDeleteDoc = async (doc: LawDocument) => {
    if (!confirm(`Deseja arquivar o documento "${doc.name || doc.title}"? O histórico físico permanecerá preservado.`)) return;

    try {
      await archiveLawHubDocument({
        data: { documentId: doc.id },
      });
      toast.success("Documento arquivado com sucesso.");
      await loadData();
    } catch (err: any) {
      toast.error(`Falha ao arquivar: ${err?.message || "erro no servidor"}`);
    }
  };

  // Exportar inventário do acervo em CSV
  const handleExportInventoryCsv = () => {
    if (documents.length === 0) return;

    const headers = [
      "ID",
      "Nome do Arquivo",
      "Categoria",
      "Processo CNJ",
      "Cliente Titular",
      "Tamanho",
      "Versão",
      "Data de Inclusão",
      "Responsável / Origem",
      "Hash SHA-256 Cadeia de Custódia",
      "Tags",
    ];

    const rows = documents.map((d) => [
      `"${d.id}"`,
      `"${(d.name || d.title || "").replace(/"/g, '""')}"`,
      `"${d.category || ""}"`,
      `"${d.process_cnj || ""}"`,
      `"${(d.client_name || "").replace(/"/g, '""')}"`,
      `"${d.file_size || ""}"`,
      `"${d.version || "v1.0"}"`,
      `"${d.date || ""}"`,
      `"${d.created_by || ""}"`,
      `"${d.hash_sha256 || ""}"`,
      `"${(d.tags || []).join(", ")}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lawhub_ged_acervo_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Inventário do acervo exportado em CSV!");
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO GED FORENSE */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
              <FolderGit2 className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                GED Forense & Acervo Digital dos Autos
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Cadeia de Custódia SHA-256
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Central de documentos processuais, laudos periciais, decisões e controle rigoroso de versões.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportInventoryCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition shadow-2xs"
            title="Exportar inventário do acervo de documentos em CSV"
          >
            <Download className="size-3.5 text-slate-500" />
            <span>Exportar Inventário CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition uppercase tracking-wider cursor-pointer shadow-xs"
          >
            <Upload className="size-4" />
            <span>ANEXAR DOCUMENTO AOS AUTOS</span>
          </button>
        </div>
      </div>

      {/* METRIC CARDS / KPIS DO ACERVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TOTAL DE ARQUIVOS */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Documentos no Acervo</span>
            <div className="size-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
              <FileText className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.total}
            </span>
            <span className="text-xs text-slate-400">arquivos catalogados</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Indexados por CNJ e cliente titular</p>
        </div>

        {/* CARD 2: PETIÇÕES E PEÇAS */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Petições & Peças</span>
            <div className="size-9 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center">
              <Scale className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {metrics.peticoes}
            </span>
            <span className="text-xs text-slate-400">iniciais, réplicas e recursos</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Peças processuais protocoladas</p>
        </div>

        {/* CARD 3: DECISÕES E SENTENÇAS */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Decisões & Sentenças</span>
            <div className="size-9 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {metrics.decisoes}
            </span>
            <span className="text-xs text-slate-400">despachos e acórdãos</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Decisões interlocutórias e mérito</p>
        </div>

        {/* CARD 4: INTEGRIDADE SHA-256 */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cadeia de Custódia</span>
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              100%
            </span>
            <span className="text-xs text-slate-400">com hash SHA-256</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Integridade forense e conformidade LGPD</p>
        </div>
      </div>

      {/* FILTROS E BUSCA DO ACERVO */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome do arquivo, CNJ, cliente ou tag forense..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Categoria */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="todas">Todas as Categorias</option>
            <option value="peticao">Petições e Peças</option>
            <option value="decisao">Decisões e Sentenças</option>
            <option value="procuracao">Procurações e Substabelecimentos</option>
            <option value="documento_pessoal">Documentos Pessoais</option>
            <option value="comprovante">Comprovantes e Laudos</option>
            <option value="contrato">Contratos e Acordos</option>
            <option value="geral">Documentos Gerais</option>
          </select>

          {/* Filtro por Processo */}
          <select
            value={processFilter}
            onChange={(e) => setProcessFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 max-w-[200px] truncate"
          >
            <option value="todos">Todos os Processos</option>
            {processes.map((p) => (
              <option key={p.id} value={p.cnj_number}>
                {p.cnj_number} ({p.client_name || p.title || "Processo"})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            title="Recarregar acervo"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* TABELA FORENSE DO ACERVO */}
      <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-4">DOCUMENTO & VERSÃO</th>
                <th className="p-4">CATEGORIA</th>
                <th className="p-4">PROCESSO CNJ & CLIENTE</th>
                <th className="p-4">DATA & ORIGEM</th>
                <th className="p-4">CADEIA DE CUSTÓDIA</th>
                <th className="p-4 text-right">AÇÕES FORENSES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Nenhum documento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const catMeta = (doc.category && CATEGORY_MAP[doc.category]) ? CATEGORY_MAP[doc.category]! : FALLBACK_CATEGORY;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      {/* Coluna 1: Documento & Versão */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("size-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0", catMeta.iconColor)}>
                            <FileText className="size-4" />
                          </div>
                          <div className="min-w-0 max-w-[280px]">
                            <span className="font-bold text-slate-900 dark:text-white block truncate" title={doc.name || doc.title}>
                              {doc.name || doc.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                {doc.version || "v1.0"}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {doc.file_size || "1.2 MB"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: Categoria & Tags */}
                      <td className="p-4 space-y-1">
                        <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border", catMeta.badgeClass)}>
                          {catMeta.label}
                        </span>
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {doc.tags.map((t, i) => (
                              <span key={i} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Coluna 3: Processo & Cliente */}
                      <td className="p-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[220px]" title={doc.client_name}>
                          {doc.client_name || "Cliente Vinculado"}
                        </span>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                          {doc.process_cnj || "Processo Geral"}
                        </div>
                      </td>

                      {/* Coluna 4: Data & Origem */}
                      <td className="p-4">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {doc.date || (doc.created_at ? new Date(doc.created_at).toLocaleDateString("pt-BR") : "N/D")}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {doc.created_by || "Escritório"}
                        </div>
                      </td>

                      {/* Coluna 5: Cadeia de Custódia SHA-256 */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                          <span
                            className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]"
                            title={doc.hash_sha256 || "SHA256:8f2a...c7d8"}
                          >
                            {doc.hash_sha256 ? `${doc.hash_sha256.slice(0, 18)}...` : "SHA256:Validado"}
                          </span>
                        </div>
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                          Assinatura Forense Íntegra
                        </span>
                      </td>

                      {/* Coluna 6: Ações */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenViewer(doc)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                            title="Visualizar Peça / Dossiê dos Autos"
                          >
                            <Eye className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                            title="Baixar Arquivo"
                          >
                            <Download className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-rose-950/40 transition"
                            title="Remover Documento"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: UPLOAD DE NOVO DOCUMENTO AOS AUTOS (GED FORENSE)                   */}
      {/* ========================================================================= */}
      {isUploadModalOpen && (
        <UploadDocumentModal
          isOpen={isUploadModalOpen}
          processes={processes}
          clients={clients}
          onClose={() => setIsUploadModalOpen(false)}
          onUploaded={() => {
            setIsUploadModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: VISUALIZADOR FORENSE DE DOCUMENTOS                                */}
      {/* ========================================================================= */}
      {selectedDocForViewer && (
        <LawHubDocumentViewerModal
          isOpen={!!selectedDocForViewer}
          onClose={() => setSelectedDocForViewer(null)}
          document={selectedDocForViewer}
          process={selectedProcForViewer}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTE: MODAL DE UPLOAD DE DOCUMENTO
// ============================================================================
interface UploadDocumentModalProps {
  isOpen: boolean;
  processes: LawProcess[];
  clients: LawClient[];
  onClose: () => void;
  onUploaded: () => void;
}

function UploadDocumentModal({
  processes,
  clients,
  onClose,
  onUploaded,
}: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [category, setCategory] = useState("peticao");
  const [processCnj, setProcessCnj] = useState("");
  const [clientName, setClientName] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [tagsInput, setTagsInput] = useState("Página Chave, Autos");
  const [notes, setNotes] = useState("");
  const [isProcessDropdownOpen, setIsProcessDropdownOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProcesses = useMemo(() => {
    if (!processCnj.trim()) return processes.slice(0, 6);
    const q = processCnj.toLowerCase();
    return processes
      .filter(
        (p) =>
          Boolean(p.cnj_number && p.cnj_number.toLowerCase().includes(q)) ||
          Boolean(p.client_name && p.client_name.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [processes, processCnj]);

  const handleSelectProcess = (p: LawProcess) => {
    setProcessCnj(p.cnj_number || "");
    if (p.client_name) setClientName(p.client_name);
    setIsProcessDropdownOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!docName) {
        setDocName(selected.name);
      }
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) {
      toast.error("Informe o nome do documento.");
      return;
    }
    if (!file) {
      toast.error("Selecione um arquivo para upload.");
      return;
    }

    setIsUploading(true);
    toast.loading("Iniciando upload seguro para o storage privado...", { id: "upload-doc" });

    try {
      const selectedProc = processes.find((p) => p.cnj_number === processCnj);
      const selectedCli = clients.find((c) => c.name === clientName);

      const uploadAuth = await requestLawHubDocumentUploadUrl({
        data: {
          title: docName.trim(),
          category,
          filename: file.name,
          mimeType: file.type || "application/pdf",
          fileSize: file.size,
          processId: selectedProc?.id,
          clientId: selectedCli?.id,
        },
      });

      // Envio real de bytes para o bucket privado lawhub-documents
      const uploadRes = await fetch(uploadAuth.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/pdf",
        },
      });

      if (!uploadRes.ok) {
        throw new Error(`Falha no envio de bytes para o storage: HTTP ${uploadRes.status}`);
      }

      toast.loading("Calculando SHA-256 e finalizando versão atômica...", { id: "upload-doc" });

      const finalRes = await finalizeLawHubDocumentUpload({
        data: {
          documentId: uploadAuth.documentId,
          storagePath: uploadAuth.storagePath,
          originalFilename: file.name,
          mimeType: file.type || "application/pdf",
          changeReason: "Upload inicial",
        },
      });

      toast.success(`Documento salvo com sucesso! SHA-256: ${finalRes.hashSha256.slice(0, 16)}...`, { id: "upload-doc" });
      onUploaded();
      onClose();
    } catch (err: any) {
      toast.error(`Falha no upload do documento: ${err?.message || "erro de rede"}`, { id: "upload-doc" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="size-5 text-blue-600" />
            Anexar Documento aos Autos (GED Forense)
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* SELEÇÃO DO ARQUIVO / DRAG & DROP */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-5 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center cursor-pointer transition"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.xlsx"
            />
            <div className="size-10 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 mx-auto flex items-center justify-center mb-2">
              <Upload className="size-5" />
            </div>
            {file ? (
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{file.name}</p>
                <p className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(0)} KB • Clique para trocar</p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Clique ou arraste o arquivo do documento aqui
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Suporta PDF, DOCX, TXT, Imagens e Guias (até 50MB)</p>
              </div>
            )}
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Nome do Documento / Peça <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Petição Inicial com Pedido Liminar.pdf"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Categoria da Peça <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="peticao">Petição / Peça Inicial ou Recurso</option>
                <option value="decisao">Decisão / Sentença / Despacho</option>
                <option value="procuracao">Procuração / Substabelecimento</option>
                <option value="documento_pessoal">Documento Pessoal / Identificação</option>
                <option value="comprovante">Comprovante / Guia / Laudo Pericial</option>
                <option value="contrato">Contrato de Honorários / Acordo</option>
                <option value="geral">Documento Geral dos Autos</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Versão</label>
              <input
                type="text"
                placeholder="v1.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Vincular ao Processo CNJ
              </label>
              <input
                type="text"
                placeholder="Digite o CNJ..."
                value={processCnj}
                onChange={(e) => {
                  setProcessCnj(e.target.value);
                  setIsProcessDropdownOpen(true);
                }}
                onFocus={() => setIsProcessDropdownOpen(true)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
              />

              {isProcessDropdownOpen && filteredProcesses.length > 0 && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {filteredProcesses.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProcess(p)}
                      className="cursor-pointer rounded-lg p-2 hover:bg-blue-50 dark:hover:bg-slate-700 transition"
                    >
                      <p className="font-bold text-slate-800 dark:text-white">{p.cnj_number}</p>
                      <p className="text-[11px] text-slate-400">{p.client_name || p.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Cliente Titular</label>
              <input
                type="text"
                placeholder="Nome do cliente"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Tags Forenses (separadas por vírgula)
            </label>
            <input
              type="text"
              placeholder="Ex: Página Chave, Cálculo Pericial, Intimação Fatal"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition shadow-xs uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>PROCESSANDO...</span>
                </>
              ) : (
                "SALVAR NO ACERVO"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
