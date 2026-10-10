/**
 * Utilitário de exportação de petições e peças processuais para Microsoft Word (.doc)
 * Formatação rigorosamente alinhada às normas forenses ABNT e práticas dos Tribunais (PJe/Projudi):
 * - Papel A4 com margens: Superior 3cm, Esquerda 3cm, Direita 2cm, Inferior 2cm
 * - Tipografia: Times New Roman 12pt, entrelinhas 1,5, recuo de 2,0cm na 1ª linha
 * - Citações longas e jurisprudência: Recuo de 4,0cm à esquerda, fonte 10pt, entrelinhas simples
 * - Compatibilidade total com Microsoft Word, LibreOffice Writer e Google Docs sem inchaço de dependências.
 */

export interface ExportLegalWordOptions {
  title: string;
  content: string;
  clientName?: string;
  oppositeParty?: string;
  court?: string;
  cnj?: string;
  fileName?: string;
}

export function downloadLegalPetitionWord(options: ExportLegalWordOptions): void {
  const {
    title,
    content,
    clientName,
    oppositeParty,
    court,
    cnj,
    fileName,
  } = options;

  // Sanitização de conteúdo
  const cleanContent = content
    .replace(/^={3,}.*$/gm, "")
    .replace(/^-{3,}.*$/gm, "")
    .trim();

  const paragraphs = cleanContent
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Geração do corpo HTML compatível com WordprocessingML
  const htmlBody = paragraphs
    .map((p) => {
      const isCourt = /^EXCELENT[ÍI]SSIM/i.test(p) || /^AO\s+JU[ÍI]ZO/i.test(p);
      const isTitle =
        (/^(?:PEDIDO\s+DE\s+ALVAR|CONTESTA|PETI|A[ÇC][ÃA]O|RECURSO|EMBARGOS|RECLAMA)/i.test(p) && p.length < 140) ||
        p.includes("PEDIDO DE ALVARÁ JUDICIAL");
      const isSection =
        /^(?:[I|V|X]+\.|\bDOS PEDIDOS\b|\bPRELIMINAR|\bDO M[ÉE]RITO|\bDOS FATOS|\bDO DIREITO|\bDA NECESSIDADE|\bDA PROTE|\bDA TUTELA|\bDOS REQUERIMENTOS|\bDAS PROVAS|\bDO VALOR)/i.test(p) &&
        p.length < 130;
      const isQuote =
        p.startsWith('"') ||
        /^AGRAVO\s+DE\s+INSTRUMENTO/i.test(p) ||
        /^APELA[ÇC][ÃA]O/i.test(p) ||
        /^RECURSO\s+ESPECIAL/i.test(p) ||
        /^HABEAS\s+CORPUS/i.test(p) ||
        /^S[ÚU]MULA/i.test(p) ||
        p.startsWith("Art.") ||
        (p.length > 180 && (p.includes("STJ") || p.includes("STF") || p.includes("TRT") || p.includes("TJPI") || p.includes("TRF")));
      const isClosing =
        /^Nestes termos/i.test(p) ||
        /^Pede deferimento/i.test(p) ||
        /^Termos em que/i.test(p);
      const isSigner =
        /^ADVOGADO/i.test(p) ||
        /^OAB\//i.test(p) ||
        p.includes("OAB/") ||
        /^[A-Z\s]{4,}\s*-\s*OAB/i.test(p);

      // Endereçamento
      if (isCourt) {
        return `<p class="MsoCourt"><strong>${escapeHtml(p.toUpperCase())}</strong></p>`;
      }

      // Título da Peça
      if (isTitle) {
        return `<p class="MsoTitle"><strong>${escapeHtml(p.toUpperCase())}</strong></p>`;
      }

      // Seções e Tópicos (Ex: DOS FATOS, DO DIREITO)
      if (isSection) {
        return `<p class="MsoSection"><strong>${escapeHtml(p)}</strong></p>`;
      }

      // Citações Jurisprudenciais e Doutrinárias com recuo forense de 4cm
      if (isQuote) {
        return `<p class="MsoQuote"><em>${escapeHtml(p)}</em></p>`;
      }

      // Encerramento
      if (isClosing) {
        return `<p class="MsoClosing">${escapeHtml(p)}</p>`;
      }

      // Bloco de Assinatura
      if (isSigner) {
        return `<p class="MsoSigner"><strong>${escapeHtml(p)}</strong></p>`;
      }

      // Parágrafo Comum Justificado com Recuo de 2cm
      return `<p class="MsoNormal">${escapeHtml(p)}</p>`;
    })
    .join("\n");

  const nowFormatted = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const documentHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 21.0cm 29.7cm;
      margin: 3.0cm 2.0cm 2.0cm 3.0cm;
      mso-header-margin: 1.5cm;
      mso-footer-margin: 1.5cm;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12.0pt;
      color: #000000;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }
    p.MsoNormal {
      font-size: 12.0pt;
      font-family: 'Times New Roman', serif;
      line-height: 150%;
      text-align: justify;
      text-indent: 2.0cm;
      margin-top: 0cm;
      margin-bottom: 0.35cm;
      mso-pagination: widow-orphan;
    }
    p.MsoCourt {
      font-size: 12.0pt;
      font-family: 'Times New Roman', serif;
      line-height: 150%;
      text-align: justify;
      text-indent: 0cm;
      margin-top: 0cm;
      margin-bottom: 1.2cm;
      letter-spacing: 0.5pt;
    }
    p.MsoTitle {
      font-size: 13.0pt;
      font-family: 'Times New Roman', serif;
      line-height: 150%;
      text-align: center;
      text-indent: 0cm;
      margin-top: 0.8cm;
      margin-bottom: 0.8cm;
      letter-spacing: 1.0pt;
    }
    p.MsoSection {
      font-size: 12.0pt;
      font-family: 'Times New Roman', serif;
      line-height: 150%;
      text-align: left;
      text-indent: 0cm;
      margin-top: 0.6cm;
      margin-bottom: 0.25cm;
    }
    p.MsoQuote {
      font-size: 10.0pt;
      font-family: 'Times New Roman', serif;
      line-height: 115%;
      text-align: justify;
      text-indent: 0cm;
      margin-left: 4.0cm;
      margin-right: 0cm;
      margin-top: 0.3cm;
      margin-bottom: 0.35cm;
      background: #fafafa;
      padding: 4pt 6pt;
      border-left: 2pt solid #cccccc;
    }
    p.MsoClosing {
      font-size: 12.0pt;
      font-family: 'Times New Roman', serif;
      line-height: 150%;
      text-align: right;
      text-indent: 0cm;
      margin-top: 0.8cm;
      margin-bottom: 0.8cm;
    }
    p.MsoSigner {
      font-size: 12.0pt;
      font-family: 'Times New Roman', serif;
      line-height: 130%;
      text-align: center;
      text-indent: 0cm;
      margin-top: 0.4cm;
      margin-bottom: 0.1cm;
    }
    .header-box {
      border-bottom: 1.0pt solid #b0b0b0;
      padding-bottom: 6pt;
      margin-bottom: 24pt;
      font-family: Arial, sans-serif;
      font-size: 8.5pt;
      color: #666666;
      display: flex;
      justify-content: space-between;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20pt;
      font-size: 9.5pt;
      font-family: Arial, sans-serif;
    }
    .meta-table td {
      padding: 3pt 6pt;
      border: 0.5pt solid #dddddd;
      background-color: #fcfcfc;
    }
    .meta-label {
      font-weight: bold;
      color: #333333;
      width: 28%;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <div class="header-box">
      <span>NAVOR LAWHUB &bull; ADVOCACIA & CONSULTORIA JUR&Iacute;DICA</span>
      <span style="float: right;">DATA: ${nowFormatted}</span>
    </div>

    ${
      cnj || clientName || court
        ? `
    <table class="meta-table">
      ${cnj ? `<tr><td class="meta-label">PROCESSO JUDICIAL (CNJ):</td><td><strong>${escapeHtml(cnj)}</strong></td></tr>` : ""}
      ${court ? `<tr><td class="meta-label">JU&Iacute;ZO / COMARCA:</td><td>${escapeHtml(court)}</td></tr>` : ""}
      ${clientName ? `<tr><td class="meta-label">PARTE / CLIENTE:</td><td>${escapeHtml(clientName)}</td></tr>` : ""}
      ${oppositeParty ? `<tr><td class="meta-label">PARTE ADVERSA / REQUERIDO:</td><td>${escapeHtml(oppositeParty)}</td></tr>` : ""}
    </table>
    `
        : ""
    }

    ${htmlBody}

    <br/><br/>
    <p style="text-align: center; margin-top: 2cm;">
      ____________________________________________________<br/>
      <strong>NAVOR LAWHUB &bull; ADVOCACIA</strong><br/>
      <span style="font-size: 10pt; color: #555555;">Advogado Responsável &bull; OAB</span>
    </p>
  </div>
</body>
</html>
`.trim();

  const safeFileName =
    fileName ||
    `Peticao_${title.replace(/[\s/\\:*?"<>|]/g, "_")}_${Date.now()}`;

  // Utiliza BOM UTF-8 (\ufeff) para correta renderização de acentos no Microsoft Word
  const blob = new Blob(["\ufeff", documentHtml], {
    type: "application/msword;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName.endsWith(".doc")
    ? safeFileName
    : `${safeFileName}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
