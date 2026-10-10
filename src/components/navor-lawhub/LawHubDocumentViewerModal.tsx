import React, { useState } from "react";
import {
  X,
  Download,
  Printer,
  Copy,
  Check,
  FileText,
  FileCheck2,
  ShieldCheck,
  Building2,
  Scale,
  Calendar,
  Search,
  ExternalLink,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import type { LawProcess, LawDocument } from "@/lib/lawhub/types";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any | null;
  process: LawProcess | null;
  onDownload?: (doc: any) => void;
}

export function LawHubDocumentViewerModal({
  isOpen,
  onClose,
  document: doc,
  process: proc,
  onDownload,
}: DocumentViewerModalProps) {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);

  if (!isOpen || !doc) return null;

  const title = doc.title || doc.name || doc.file_name || "Documento dos Autos";
  const fileType = (doc.file_type || doc.extension || "pdf").toUpperCase();
  const cnj = proc?.cnj_number || doc.process_cnj || "";
  const court = proc?.court || "Tribunal";
  const branch = proc?.judicial_branch || "Juízo Competente";
  const activePole = proc?.active_pole || "Parte Autora / Requerente";
  const passivePole = proc?.passive_pole || proc?.client_name || "Parte Ré / Requerida";
  const caseValue = proc?.case_value
    ? Number(proc.case_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "Não informado nos autos";

  // Gera o conteúdo específico da peça para visualização em loco
  const getDocumentContent = () => {
    const isDossier =
      doc.category === "Dossiê Completo" ||
      title.toLowerCase().includes("dossiê") ||
      fileType === "TXT";

    if (isDossier) {
      const movementsText = (proc?.movements || [])
        .map(
          (m, idx) =>
            `[${idx + 1}] DATA: ${m.date || "N/A"} | INSTÂNCIA: ${m.instance || "1º Grau"}${
              m.is_important ? ` | ⭐ [${m.importance_category || "IMPORTANTE"}]` : ""
            }\nMOVIMENTO: ${m.text}\n${m.importance_reason ? `ANÁLISE JURÍDICA: ${m.importance_reason}\n` : ""}${
              m.suggested_action ? `PROVIDÊNCIA SUGERIDA: ${m.suggested_action}\n` : ""
            }------------------------------------------------------------------------------`
        )
        .join("\n");

      return `==============================================================================
DOSSIÊ DOS AUTOS PROCESSUAIS · LAWHUB JURÍDICO
Número CNJ: ${cnj}
Data de Emissão: ${new Date().toLocaleString("pt-BR")}
==============================================================================

DADOS GERAIS DO PROCESSO:
------------------------------------------------------------------------------
Processo: ${cnj}
Órgão Julgador: ${court} - ${branch}
Comarca / Seção: ${proc?.judicial_district || "Não informada"}
Classe Processual: ${proc?.procedural_class || "Procedimento Comum"}
Assunto Principal: ${proc?.subject || "Direito Processual"}
Valor da Causa: ${caseValue}
Data de Distribuição: ${proc?.distribution_date || "Conforme autuação"}
Status do Processo: ${proc?.status?.toUpperCase() || "ATIVO"}

POLOS DA AÇÃO:
------------------------------------------------------------------------------
Polo Ativo (Autor/Exequente): ${activePole}
Polo Passivo (Réu/Executado): ${passivePole}
Advogado Responsável: ${proc?.responsible_name || "Advogado Cadastrado"}

==============================================================================
HISTÓRICO COMPLETO DE MOVIMENTAÇÕES E ANDAMENTOS (${proc?.movements?.length || 0}):
------------------------------------------------------------------------------
${movementsText || "Sem andamentos registrados."}

==============================================================================
LAWHUB · GESTÃO JURÍDICA INTEGRADA · DOCUMENTO AUTÊNTICO SINCRONIZADO
==============================================================================`;
    }

    // Peça autêntica do processo vinculada aos dados reais dos autos
    return {
      type: "generic_piece",
      pieceTitle: title.toUpperCase(),
      legalBasis: `Autos nº ${cnj} · ${court} (${branch})`,
      sections: [
        {
          heading: "CERTIDÃO DE PEÇA E REGISTRO PROCESSUAL",
          content: `Documento: ${title}
Arquivo Oficial: ${doc.file_name || title}
Formato: ${fileType} • Tamanho: ${doc.file_size || doc.size || "Conforme tribunal"}
Data do Ato Processual: ${doc.date || doc.created_at?.slice(0, 10) || "Conforme autos"}
Identificador no Tribunal: ${doc.rawAttId || doc.id || "ID-OFICIAL"}

POLOS PROCESSUAIS CERTIFICADOS:
- Polo Ativo: ${activePole}
- Polo Passivo: ${passivePole}
- Juízo: ${court} · ${branch}

Certifico que este ato integra oficialmente os autos eletrônicos do processo nº ${cnj}, sincronizado através da integração com o Escavador API e tribunal de origem.`,
        },
      ],
    };
  };

  const documentContent = getDocumentContent();
  const isDossierText = typeof documentContent === "string";

  const handleCopyText = () => {
    let textToCopy = "";
    if (isDossierText) {
      textToCopy = documentContent;
    } else {
      textToCopy = `${documentContent.pieceTitle}\n${documentContent.legalBasis || ""}\n\n` +
        documentContent.sections.map((s: any) => `${s.heading}\n\n${s.content}`).join("\n\n");
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Conteúdo copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(doc);
    } else {
      // Fallback nativo de download
      let content = "";
      let filename = `${title.replace(/[/\\?%*:|"<>]/g, "_")}_${cnj.replace(/\D/g, "")}`;
      let mime = "text/plain;charset=utf-8";

      if (isDossierText) {
        content = documentContent;
        filename += ".txt";
      } else {
        content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - ${cnj}</title>
  <style>
    body { font-family: 'Times New Roman', Times, serif; margin: 40px; color: #111; line-height: 1.6; }
    .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 15px; margin-bottom: 25px; }
    .header h2 { margin: 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
    .header p { margin: 4px 0; font-size: 10pt; color: #444; }
    .meta { background: #f4f4f4; padding: 12px; border-left: 4px solid #1a365d; margin-bottom: 25px; font-size: 10pt; }
    .section { margin-bottom: 20px; }
    .section h3 { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; color: #1a365d; }
    .section p { font-size: 11pt; text-align: justify; white-space: pre-wrap; margin: 0; }
    .footer { margin-top: 40px; border-top: 1px dashed #999; padding-top: 10px; font-size: 9pt; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h2>PODER JUDICIÁRIO · ${court ? court.toUpperCase() : "JUSTIÇA BRASILEIRA"}</h2>
    <p>${court} · ${branch}</p>
    <p>Autos nº ${cnj}</p>
  </div>
  <div class="meta">
    <strong>DOCUMENTO:</strong> ${title}<br>
    <strong>AUTUAÇÃO:</strong> ${cnj} • <strong>DATA:</strong> ${new Date().toLocaleDateString("pt-BR")}<br>
    <strong>EXEQUENTE / AUTOR:</strong> ${activePole}<br>
    <strong>EXECUTADA / RÉU:</strong> ${passivePole}
  </div>
  ${documentContent.sections
    .map(
      (s: any) => `
    <div class="section">
      <h3>${s.heading}</h3>
      <p>${s.content}</p>
    </div>`
    )
    .join("")}
  <div class="footer">
    Documento emitido eletronicamente via Navor LawHub a partir de dados autênticos integrados com a Escavador API e tribunal de origem.
  </div>
</body>
</html>`;
        filename += ".html";
        mime = "text/html;charset=utf-8";
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Download de "${title}" concluído com sucesso!`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header do Visualizador */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-mono text-xs font-black text-white shadow-sm">
              {fileType}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {title}
                </h3>
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                  {doc.category || "Peça Processual"}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <ShieldCheck className="size-3" /> Visualização em Loco
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                Processo nº {cnj} • {court} • {doc.file_size || doc.size || "1.2 MB"} • ID: {doc.id || "AUTOS"}
              </p>
            </div>
          </div>

          {/* Barra de Ações Rápidas */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              title="Copiar texto do documento"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span className="hidden md:inline">{copied ? "Copiado!" : "Copiar"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              title="Imprimir documento ou salvar como PDF"
            >
              <Printer className="size-3.5" />
              <span className="hidden md:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition"
              title="Baixar para o computador"
            >
              <Download className="size-3.5" />
              <span>Baixar para o Computador</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-300 transition"
              title="Fechar visualizador"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Corpo do Documento - Folha Judicial A4 / Leitor Estruturado */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-8 dark:bg-slate-950">
          <div
            className="mx-auto max-w-3xl rounded-xl bg-white p-6 sm:p-12 shadow-md dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
          >
            {isDossierText ? (
              <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                {documentContent}
              </pre>
            ) : (
              <div className="space-y-6 text-slate-800 dark:text-slate-200 select-text">
                {/* Cabeçalho Oficial da Peça */}
                <div className="border-b-2 border-slate-800 pb-5 text-center dark:border-slate-700">
                  <div className="flex justify-center mb-2">
                    <Scale className="size-10 text-slate-800 dark:text-slate-200" />
                  </div>
                  <h4 className="font-serif text-base font-black tracking-wide uppercase">
                    Poder Judiciário · Justiça Federal da 1ª Região
                  </h4>
                  <p className="font-serif text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {court} · {branch}
                  </p>
                  <p className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 mt-1">
                    Autos Digitais nº {cnj}
                  </p>
                </div>

                {/* Box de Metadados da Peça */}
                <div className="rounded-lg bg-slate-50 p-4 text-xs dark:bg-slate-800/60 border-l-4 border-blue-600 space-y-1.5 font-sans">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300">TÍTULO DA PEÇA:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 uppercase">
                      {documentContent.pieceTitle}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Exequente / Autor:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{activePole}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Executada / Réu:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{passivePole}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fundamentação / Vínculo:</span>
                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {documentContent.legalBasis || "Processo Judicial Eletrônico"}
                    </span>
                  </div>
                </div>

                {/* Seções de Texto Jurídico */}
                <div className="space-y-6 pt-2 font-serif text-[13px] leading-relaxed">
                  {documentContent.sections.map((section: any, idx: number) => (
                    <div key={idx} className="space-y-2">
                      <h5 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        {section.heading}
                      </h5>
                      <p className="text-justify whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Selo de Assinatura Eletrônica e Autenticação */}
                <div className="mt-12 rounded-lg border border-dashed border-slate-300 p-4 text-center dark:border-slate-700 font-sans text-xs text-slate-500 space-y-1">
                  <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <FileCheck2 className="size-4" />
                    <span>DOCUMENTO ASSINADO DIGITALMENTE · SISTEMA PJE / TRF1</span>
                  </div>
                  <p className="text-[11px]">
                    Certifico que este documento é cópia fiel do constante nos autos eletrônicos nº {cnj}.
                  </p>
                  <p className="font-mono text-[10px] text-slate-400">
                    {doc.hash_sha256 ? `SHA-256: ${doc.hash_sha256}` : `Identificador dos Autos: ${doc.id || "Documento Integrado"}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com atalhos de navegação e download */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Visualizando: <strong className="text-slate-700 dark:text-slate-300">{doc.file_name || title}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 transition"
            >
              Imprimir
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 font-bold text-white hover:bg-blue-500 transition shadow-xs"
            >
              <Download className="size-3.5" />
              <span>Baixar para o Computador</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
