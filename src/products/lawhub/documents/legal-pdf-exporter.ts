/**
 * Utilitário de exportação e download de petições e peças processuais em formato PDF
 * Suporta jsPDF (CDN dinâmico) com fallback automático para gerador nativo PDF 1.4
 * com formatação jurídica autêntica (Padrão forense PJe/ABNT: recuo de parágrafos,
 * alinhamento justificado, ementas destacadas com recuo especial, cabeçalho e assinatura).
 */

export interface ExportLegalPdfOptions {
  title: string;
  content: string;
  clientName?: string;
  oppositeParty?: string;
  court?: string;
  cnj?: string;
  fileName?: string;
}

/**
 * Tenta carregar o jsPDF dinamicamente caso a internet esteja ativa
 */
async function loadJsPdfInstance(): Promise<any> {
  if (typeof window === "undefined") return null;
  if ((window as any).jspdf?.jsPDF) {
    return (window as any).jspdf.jsPDF;
  }

  return new Promise((resolve) => {
    try {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.async = true;
      script.onload = () => {
        resolve((window as any).jspdf?.jsPDF || null);
      };
      script.onerror = () => {
        resolve(null);
      };
      document.head.appendChild(script);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Codifica caracteres latinos/portugueses para a tabela WinAnsiEncoding do padrão PDF
 */
function escapePdfText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u0080-\uFFFF]/g, (ch) => {
      const code = ch.charCodeAt(0);
      const map: Record<number, string> = {
        0x00e1: "\\341", // á
        0x00e9: "\\351", // é
        0x00ed: "\\355", // í
        0x00f3: "\\363", // ó
        0x00fa: "\\372", // ú
        0x00e3: "\\343", // ã
        0x00f5: "\\365", // õ
        0x00e2: "\\342", // â
        0x00ea: "\\352", // ê
        0x00f4: "\\364", // ô
        0x00e7: "\\347", // ç
        0x00c1: "\\301", // Á
        0x00c9: "\\311", // É
        0x00cd: "\\315", // Í
        0x00d3: "\\323", // Ó
        0x00da: "\\332", // Ú
        0x00c3: "\\303", // Ã
        0x00d5: "\\325", // Õ
        0x00c2: "\\302", // Â
        0x00ca: "\\312", // Ê
        0x00d4: "\\324", // Ô
        0x00c7: "\\307", // Ç
        0x00ba: "\\272", // º
        0x00aa: "\\252", // ª
        0x00a7: "\\247", // §
        0x2013: "-", // en-dash
        0x2014: "--", // em-dash
        0x201c: '"',
        0x201d: '"',
        0x2018: "'",
        0x2019: "'",
      };
      return map[code] || `\\${code.toString(8).padStart(3, "0")}`;
    });
}

/**
 * Construtor nativo de PDF 1.4 estruturado por parágrafos forenses (fallback 100% offline)
 */
function buildNativePdf(title: string, content: string, cnj?: string): Uint8Array {
  // Limpa caracteres divisores ASCII feios
  const cleanContent = content
    .replace(/^={3,}.*$/gm, "")
    .replace(/^-{3,}.*$/gm, "");

  const rawParagraphs = cleanContent
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const formattedLines: { text: string; isBold: boolean; isIndent: boolean; isCenter: boolean }[] = [];

  for (const block of rawParagraphs) {
    const isCourt = /^EXCELENT[ÍI]SSIM/i.test(block) || /^AO\s+JU[ÍI]ZO/i.test(block);
    const isTitle = /^(?:PEDIDO\s+DE\s+ALVAR|CONTESTA|PETI|A[ÇC][ÃA]O|RECURSO)/i.test(block) && block.length < 120;
    const isSection = /^(?:[I|V|X]+\.|\d+\.|\bDOS PEDIDOS\b|\bPRELIMINAR|\bDO M[ÉE]RITO|\bDOS FATOS|\bDO DIREITO)/i.test(block) && block.length < 100;
    const isQuote = block.startsWith('"') || /^AGRAVO\s+DE\s+INSTRUMENTO/i.test(block) || /^Art\.\s*\d/i.test(block);

    const maxChars = isQuote ? 68 : isTitle || isCourt ? 72 : 80;
    const words = block.split(/\s+/);
    let currentLine = "";

    const linesOfBlock: string[] = [];
    for (const w of words) {
      if ((currentLine + " " + w).trim().length <= maxChars) {
        currentLine = (currentLine + " " + w).trim();
      } else {
        linesOfBlock.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) linesOfBlock.push(currentLine);

    linesOfBlock.forEach((l, idx) => {
      formattedLines.push({
        text: (idx === 0 && !isCourt && !isTitle && !isSection && !isQuote ? "        " : isQuote ? "      " : "") + l,
        isBold: isCourt || isTitle || isSection,
        isIndent: isQuote,
        isCenter: isCourt || isTitle,
      });
    });

    // Linha em branco entre parágrafos
    formattedLines.push({ text: "", isBold: false, isIndent: false, isCenter: false });
  }

  const linesPerPage = 42;
  const pages: typeof formattedLines[] = [];
  for (let i = 0; i < formattedLines.length; i += linesPerPage) {
    pages.push(formattedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([{ text: "(Petição em branco)", isBold: false, isIndent: false, isCenter: false }]);

  const totalPages = pages.length;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  // Objeto 1: Catálogo
  offsets.push(pdf.length);
  pdf += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

  // Objeto 2: Pages raiz
  offsets.push(pdf.length);
  const kidsRefs = pages.map((_, idx) => `${3 + idx * 2} 0 R`).join(" ");
  pdf += `2 0 obj\n<< /Type /Pages /Kids [${kidsRefs}] /Count ${totalPages} >>\nendobj\n`;

  // Gera os pares Page + ContentStream
  pages.forEach((pageLines, idx) => {
    const pageObjNum = 3 + idx * 2;
    const streamObjNum = 4 + idx * 2;
    const pageNum = idx + 1;

    offsets.push(pdf.length);
    pdf += `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >> >> >> >>\nendobj\n`;

    let streamContent = "";
    // Cabeçalho discreto
    streamContent += "BT\n/F2 8 Tf\n0.3 0.3 0.3 rg\n50 808 Td\n";
    streamContent += `(${escapePdfText(`NAVOR LAWHUB - ${title.toUpperCase()}`)}${cnj ? ` • CNJ: ${cnj}` : ""}) Tj\n`;
    streamContent += "ET\n";
    streamContent += "0.85 0.85 0.85 RG\n0.5 w\n50 802 m 545 802 l S\n";

    // Corpo
    streamContent += "BT\n/F1 10.5 Tf\n15.5 TL\n0.1 0.1 0.1 rg\n50 775 Td\n";
    for (const item of pageLines) {
      if (!item.text) {
        streamContent += "T*\n";
        continue;
      }
      if (item.isBold) {
        streamContent += `/F2 10.5 Tf (${escapePdfText(item.text)}) Tj /F1 10.5 Tf T*\n`;
      } else {
        streamContent += `(${escapePdfText(item.text)}) Tj T*\n`;
      }
    }
    streamContent += "ET\n";

    // Rodapé
    streamContent += "0.85 0.85 0.85 RG\n0.5 w\n50 45 m 545 45 l S\n";
    streamContent += "BT\n/F1 8 Tf\n0.4 0.4 0.4 rg\n50 32 Td\n";
    streamContent += `(${escapePdfText("Peça processual emitida por Navor LawHub IA")}) Tj\n`;
    streamContent += "440 32 Td\n";
    streamContent += `(${escapePdfText(`Página ${pageNum} de ${totalPages}`)}) Tj\n`;
    streamContent += "ET\n";

    const streamLength = streamContent.length;
    offsets.push(pdf.length);
    pdf += `${streamObjNum} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  const totalObjects = 2 + pages.length * 2;
  pdf += `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const encoder = new TextEncoder();
  return encoder.encode(pdf);
}

/**
 * Gera e realiza o download do arquivo PDF formatado para a petição
 * Implementa padrão forense rigoroso (recuo ABNT de 15mm, ementas destacadas,
 * cabeçalho formal, rol de pedidos e fecho com assinatura)
 */
export async function downloadLegalPetitionPdf(options: ExportLegalPdfOptions): Promise<void> {
  const { title, content, cnj, fileName } = options;
  const safeBaseName = (fileName || title || "Peticao_Processual")
    .replace(/[^\w\d\-_]+/g, "_")
    .replace(/_+/g, "_");
  const finalFileName = safeBaseName.endsWith(".pdf") ? safeBaseName : `${safeBaseName}.pdf`;

  // Limpa divisores ASCII feios
  const cleanContent = content
    .replace(/^={3,}.*$/gm, "")
    .replace(/^-{3,}.*$/gm, "");

  // 1. Tenta usar o jsPDF para renderização forense avançada com quebra de página automática
  try {
    const JsPdfClass = await loadJsPdfInstance();
    if (JsPdfClass) {
      const doc = new JsPdfClass({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 25; // 2,5 cm
      const marginRight = 25;
      const contentWidth = pageWidth - marginLeft - marginRight; // ~160mm
      const topMargin = 28;
      const bottomMargin = 25;

      let cursorY = topMargin;
      let pageIndex = 1;

      const addHeaderAndFooter = (page: number) => {
        // Cabeçalho discreto
        doc.setFont("times", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`NAVOR LAWHUB - ${title.toUpperCase()}${cnj ? ` • CNJ: ${cnj}` : ""}`, marginLeft, 14);
        doc.setDrawColor(215, 215, 215);
        doc.setLineWidth(0.3);
        doc.line(marginLeft, 16, pageWidth - marginRight, 16);

        // Rodapé
        doc.line(marginLeft, pageHeight - 16, pageWidth - marginRight, pageHeight - 16);
        doc.setFont("times", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("Documento processual emitido por Navor LawHub IA", marginLeft, pageHeight - 11);
        doc.text(`Página ${page}`, pageWidth - marginRight - 16, pageHeight - 11);
      };

      addHeaderAndFooter(pageIndex);

      // Divide o texto em blocos de parágrafos
      const paragraphs = cleanContent
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const checkPageBreak = (neededHeight: number) => {
        if (cursorY + neededHeight > pageHeight - bottomMargin) {
          doc.addPage();
          pageIndex++;
          addHeaderAndFooter(pageIndex);
          cursorY = topMargin;
        }
      };

      for (const block of paragraphs) {
        const isCourt = /^EXCELENT[ÍI]SSIM/i.test(block) || /^AO\s+JU[ÍI]ZO/i.test(block);
        const isTitle =
          (/^(?:PEDIDO\s+DE\s+ALVAR|CONTESTA|PETI|A[ÇC][ÃA]O|RECURSO)/i.test(block) && block.length < 120) ||
          block.includes("PEDIDO DE ALVARÁ JUDICIAL");
        const isSection =
          /^(?:[I|V|X]+\.|\bDOS PEDIDOS\b|\bPRELIMINAR|\bDO M[ÉE]RITO|\bDOS FATOS|\bDO DIREITO|\bDA NECESSIDADE|\bDA PROTE|\bDA INTERVEN)/i.test(block) &&
          block.length < 120;
        const isEmentaQuote =
          block.startsWith('"') ||
          /^AGRAVO\s+DE\s+INSTRUMENTO/i.test(block) ||
          /^APELA[ÇC][ÃA]O/i.test(block) ||
          /^Art\.\s*\d/i.test(block) ||
          /\(TJ-[A-Z]{2}/i.test(block);

        const isListItem = /^[a-z]\)\s+/i.test(block);
        const isClosingSignature =
          /^Nesses termos,/i.test(block) ||
          /^Termos em que,/i.test(block) ||
          /^ARTHUR CARVALHO/i.test(block) ||
          /^Advogado/i.test(block) ||
          /^OAB\//i.test(block);

        if (isCourt) {
          checkPageBreak(20);
          doc.setFont("times", "bold");
          doc.setFontSize(11);
          doc.setTextColor(20, 20, 20);
          const lines = doc.splitTextToSize(block, contentWidth);
          for (const l of lines) {
            checkPageBreak(6);
            doc.text(l, marginLeft, cursorY);
            cursorY += 5.8;
          }
          cursorY += 6;
          continue;
        }

        if (isTitle) {
          cursorY += 4;
          checkPageBreak(18);
          doc.setFont("times", "bold");
          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42);
          const lines = doc.splitTextToSize(block, contentWidth - 10);
          for (const l of lines) {
            checkPageBreak(6.5);
            doc.text(l, pageWidth / 2, cursorY, { align: "center" });
            cursorY += 6.5;
          }
          cursorY += 6;
          continue;
        }

        if (isSection) {
          cursorY += 4;
          checkPageBreak(14);
          doc.setFont("times", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          const lines = doc.splitTextToSize(block, contentWidth);
          for (const l of lines) {
            checkPageBreak(6);
            doc.text(l, marginLeft, cursorY);
            cursorY += 6.0;
          }
          cursorY += 3;
          continue;
        }

        if (isEmentaQuote) {
          // Recuo especial para citação jurisprudencial / ementas (25mm a mais à esquerda)
          const quoteIndent = marginLeft + 25;
          const quoteWidth = contentWidth - 25;
          cursorY += 2;
          doc.setFont("times", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(40, 40, 40);

          const lines = doc.splitTextToSize(block, quoteWidth);
          for (const l of lines) {
            checkPageBreak(5);
            doc.text(l, quoteIndent, cursorY, { maxWidth: quoteWidth, align: "justify" });
            cursorY += 5.0;
          }
          cursorY += 3;
          continue;
        }

        if (isListItem) {
          // Alíneas de pedidos a), b), c)...
          const itemIndent = marginLeft + 6;
          const itemWidth = contentWidth - 6;
          doc.setFont("times", "normal");
          doc.setFontSize(11);
          doc.setTextColor(30, 30, 30);

          const lines = doc.splitTextToSize(block, itemWidth);
          for (let li = 0; li < lines.length; li++) {
            checkPageBreak(5.8);
            doc.text(lines[li], itemIndent, cursorY, { maxWidth: itemWidth, align: "justify" });
            cursorY += 5.8;
          }
          cursorY += 2.5;
          continue;
        }

        if (isClosingSignature) {
          cursorY += 5;
          checkPageBreak(25);
          doc.setFont("times", block.includes("ARTHUR") || block.includes("OAB") ? "bold" : "normal");
          doc.setFontSize(11);
          doc.setTextColor(20, 20, 20);
          const lines = doc.splitTextToSize(block, contentWidth);
          for (const l of lines) {
            checkPageBreak(6);
            doc.text(l, marginLeft, cursorY);
            cursorY += 5.8;
          }
          cursorY += 3;
          continue;
        }

        // Parágrafo Forense Padrão: Recuo de 1ª linha de 15mm e texto justificado
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);

        // Separa a primeira linha com recuo e as subsequentes sem recuo
        const firstLineIndent = 15; // 1,5 cm de recuo
        const firstLineWidth = contentWidth - firstLineIndent;
        const allWords = block.split(/\s+/);

        let firstLineWords: string[] = [];
        let remainingWords: string[] = [];
        let lineLength = 0;

        for (let wi = 0; wi < allWords.length; wi++) {
          const w = allWords[wi];
          if (!w) continue;
          if ((lineLength + w.length + 1) * 2.2 <= firstLineWidth) {
            firstLineWords.push(w);
            lineLength += w.length + 1;
          } else {
            remainingWords = allWords.slice(wi);
            break;
          }
        }

        if (remainingWords.length === 0) {
          // Parágrafo curto de 1 linha só
          checkPageBreak(6);
          doc.text(firstLineWords.join(" "), marginLeft + firstLineIndent, cursorY);
          cursorY += 5.8;
        } else {
          // Imprime primeira linha com recuo
          checkPageBreak(6);
          doc.text(firstLineWords.join(" "), marginLeft + firstLineIndent, cursorY, {
            maxWidth: firstLineWidth,
            align: "justify",
          });
          cursorY += 5.8;

          // Imprime linhas restantes a partir da margem normal
          const restText = remainingWords.join(" ");
          const restLines = doc.splitTextToSize(restText, contentWidth);
          for (const rl of restLines) {
            checkPageBreak(6);
            doc.text(rl, marginLeft, cursorY, { maxWidth: contentWidth, align: "justify" });
            cursorY += 5.8;
          }
        }

        cursorY += 3.5; // Espaçamento entre parágrafos
      }

      doc.save(finalFileName);
      return;
    }
  } catch (err) {
    console.warn("jsPDF falhou, utilizando gerador nativo PDF 1.4:", err);
  }

  // 2. Fallback: Gerador nativo PDF 1.4 de alta fidelidade
  const pdfBytes = buildNativePdf(title, content, cnj);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = finalFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
