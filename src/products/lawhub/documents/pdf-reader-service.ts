import type { ExtractedPdfData } from "@/products/lawhub/types/domain";

let pdfjsLibInstance: any = null;

async function getPdfJs() {
  if (pdfjsLibInstance) return pdfjsLibInstance;
  try {
    const lib = await import("pdfjs-dist");
    try {
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      lib.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
    } catch {
      // Fallback para cdn público caso o import local de worker falhe
      lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version || "4.10.38"}/build/pdf.worker.min.mjs`;
    }
    pdfjsLibInstance = lib;
    return pdfjsLibInstance;
  } catch (err) {
    console.warn("Falha ao carregar pdfjs-dist dinamicamente:", err);
    return null;
  }
}

/**
 * Serviço de leitura, indexação e extração semântica de peças processuais em PDF
 */
export const PdfReaderService = {
  /**
   * Lê um arquivo PDF e extrai o texto integral e metadados jurídicos
   */
  async extractTextFromPdf(file: File): Promise<ExtractedPdfData> {
    const fileName = file.name;
    const fileSize = this.formatFileSize(file.size);
    let extractedText = "";
    let pageCount = 1;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjs = await getPdfJs();

      if (pdfjs) {
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          useSystemFonts: true,
        });
        const pdf = await loadingTask.promise;
        pageCount = pdf.numPages;

        const textParts: string[] = [];
        // Lê a íntegra de todas as páginas da peça processual (até 150 páginas)
        for (let pageNum = 1; pageNum <= Math.min(pageCount, 150); pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str || "")
              .join(" ");

            if (pageText.trim()) {
              textParts.push(`--- PÁGINA ${pageNum} ---\n${pageText}`);
            }
          } catch (pageErr) {
            console.warn(`Erro ao extrair página ${pageNum}:`, pageErr);
          }
        }
        if (textParts.length > 0) {
          extractedText = textParts.join("\n\n");
        }
      }
    } catch (e) {
      console.warn("Falha no parser padrão pdfjs:", e);
    }

    // NUNCA carregar fluxo binário cru do PDF (%PDF-, obj, stream, /Filter)
    // Se o pdfjs não extraiu texto (ex: documento escaneado/imagem), NÃO ler via file.text()
    const isBinaryGarbage = (txt: string) => {
      return (
        txt.includes("%PDF-") ||
        txt.includes("/BitsPerComponent") ||
        txt.includes("/ColorSpace") ||
        txt.includes("/DCTDecode") ||
        txt.includes("/Filter") ||
        txt.includes("stream\n") ||
        txt.includes("stream\r") ||
        txt.includes("endobj") ||
        txt.includes("JFIF") ||
        /\b\d+\s+0\s+obj\b/.test(txt)
      );
    };

    if (extractedText && isBinaryGarbage(extractedText)) {
      extractedText = "";
    }

    // Se o arquivo for puramente texto (ex: .txt renomeado ou simples), só lê se NÃO for binário
    if (!extractedText || extractedText.length < 50) {
      try {
        const rawText = await file.text();
        if (!isBinaryGarbage(rawText)) {
          const clean = rawText.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ");
          if (clean.length > 50) {
            extractedText = clean.replace(/[ \t]+/g, " ");
          }
        }
      } catch {}
    }

    // Se o arquivo for um PDF escaneado (sem camada OCR embutida), gera metadados limpos e sem lixo binário
    if (!extractedText.trim() || isBinaryGarbage(extractedText)) {
      extractedText = `[Peça Processual Anexada: "${fileName}" • ${pageCount} página(s) digitalizadas dos autos]\n` +
        `O arquivo foi carregado com sucesso. Como se trata de documento escaneado/digitalizado, a inteligência artificial formulará a peça processual com base nas diretrizes fornecidas e no objeto dos autos.`;
    }

    // Análise semântica e jurídica dos dados contidos na peça
    const detectedCnj = this.detectCnj(extractedText) || this.detectCnj(fileName);
    const detectedCourt = this.detectCourt(extractedText);
    const { detectedAuthor, detectedDefendant } = this.detectParties(extractedText, fileName);
    const detectedValue = this.detectValue(extractedText);
    const summary = this.generateExecutiveSummary(extractedText, detectedAuthor, detectedDefendant, fileName);

    return {
      fileName,
      fileSize,
      pageCount,
      extractedText,
      detectedCnj,
      detectedCourt,
      detectedAuthor,
      detectedDefendant,
      detectedValue,
      summary,
    };
  },

  detectCnj(text: string): string | undefined {
    const cnjRegex = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;
    const match = text.match(cnjRegex);
    return match ? match[0] : undefined;
  },

  detectCourt(text: string): string | undefined {
    // Procura varas de família, sucessões, cíveis ou federais
    const courtRegex = /(?:EXCELENT[ÍI]SSIM[OA][\s\S]{1,60}?)(?:AO\s+)?(JU[ÍI]ZO\s+D[EA]|VARA\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\dªº\.\-]+(?:DA\s+COMARCA\s+DE\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+|FEDERAL|DO\s+TRABALHO|DE\s+FAM[ÍI]LIA(?:\s+E\s+SUCESS[ÕO]ES)?))/i;
    const match = text.match(courtRegex);
    if (match && match[1]) {
      const clean = match[1].replace(/\s+/g, " ").trim();
      if (clean.length > 5 && clean.length < 100) return clean.toUpperCase();
    }

    if (/vara\s+de\s+fam[íi]lia/i.test(text)) {
      return "1ª VARA DE FAMÍLIA E SUCESSÕES DA COMARCA COMPETENTE";
    }
    if (text.includes("VARA CÍVEL") || text.includes("Vara Cível")) {
      return "VARA CÍVEL DA COMARCA COMPETENTE";
    }
    if (text.includes("VARA FEDERAL") || text.includes("Vara Federal")) {
      return "VARA FEDERAL DA SEÇÃO JUDICIÁRIA COMPETENTE";
    }
    if (text.includes("VARA DO TRABALHO") || text.includes("Vara do Trabalho")) {
      return "VARA DO TRABALHO COMPETENTE";
    }
    return undefined;
  },

  detectParties(text: string, fileName?: string): { detectedAuthor?: string; detectedDefendant?: string } {
    let detectedAuthor: string | undefined;
    let detectedDefendant: string | undefined;

    // Detecta Autor / Requerente
    const authorRegex = /(?:AUTOR|REQUERENTE|EXEQUENTE|EMBARGANTE|RECLAMANTE|PROMOVENTE|CURADORA?S?)\s*[:\-]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\.\-\/]{3,60}?)(?:,|\s+brasileir|\s+pessoa|\s+inscrit|\s+devidamente|\n|\r)/i;
    const authorMatch = text.match(authorRegex);
    if (authorMatch && authorMatch[1]) {
      detectedAuthor = authorMatch[1].trim();
    }

    // Detecta Réu / Requerido / Curatelado
    const defRegex = /(?:RÉU|RÉ|REQUERIDO|EXECUTADO|EMBARGADO|RECLAMADO|PROMOVIDO|CURATELADO|INTERDITO)\s*[:\-]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\.\-\/]{3,60}?)(?:,|\s+brasileir|\s+pessoa|\s+inscrit|\s+devidamente|\n|\r)/i;
    const defMatch = text.match(defRegex);
    if (defMatch && defMatch[1]) {
      detectedDefendant = defMatch[1].trim();
    }

    // Se arquivo for de interdição (ex: "Processo interdição Jean.pdf")
    const combined = `${fileName || ""} ${text}`;
    if (!detectedDefendant && /interdi[çc][aã]o\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+)/i.test(combined)) {
      const m = combined.match(/interdi[çc][aã]o\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{3,35})/i);
      if (m && m[1]) {
        detectedDefendant = m[1].replace(/\.pdf$/i, "").trim();
      }
    }

    return { detectedAuthor, detectedDefendant };
  },

  detectValue(text: string): number | undefined {
    const valRegex = /(?:d[áa]-se\s+[àa]\s+causa\s+o\s+valor\s+de|valor\s+da\s+causa\s*[:\-]?)\s*R\$\s*([\d\.,]+)/i;
    const match = text.match(valRegex);
    if (match && match[1]) {
      const cleanVal = match[1].replace(/\./g, "").replace(",", ".");
      const parsed = parseFloat(cleanVal);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return undefined;
  },

  generateExecutiveSummary(text: string, author?: string, defendant?: string, fileName?: string): string {
    const cleanLines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 20 && !l.startsWith("--- PÁGINA") && !l.includes("%PDF") && !l.includes("/Bits"));

    const sample = cleanLines.slice(0, 10).join(" ");
    if (sample.length > 50) {
      return (
        sample.slice(0, 320) +
        (sample.length > 320 ? "..." : "")
      );
    }

    if (fileName && /interdi/i.test(fileName)) {
      return `Autos do processo de interdição e curatela (${fileName})${defendant ? ` referente a ${defendant}` : ""}. Contém termos de curatela e histórico de capacidade civil.`;
    }

    return `Peça processual${author ? ` proposta por ${author}` : ""}${defendant ? ` em face de ${defendant}` : ""}. Autos instruídos para elaboração de manifestação e peça judicial.`;
  },

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
};
