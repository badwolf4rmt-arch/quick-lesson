import { Presentation } from "@/types/presentation";
import PptxGenJS from "pptxgenjs";
import katex from "katex";
import "katex/dist/katex.min.css";
import html2canvas from "html2canvas";
import { validatePPTXBlob, validatePDFLayout } from "./exportValidators";

// Render markdown+LaTeX content as a PNG dataURI via offscreen DOM + KaTeX + html2canvas
async function renderContentToImage(
  markdown: string,
  opts: { widthPx: number; color: string; fontSizePx: number; bg: string }
): Promise<{ dataUrl: string; widthPx: number; heightPx: number } | null> {
  try {
    const html = markdownToHTML(markdown);
    const paragraphs = html
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => `<p style="margin:0 0 8px 0;">${l}</p>`) // tight paragraph spacing
      .join('');

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-100000px';
    container.style.top = '0';
    container.style.width = `${opts.widthPx}px`;
    container.style.padding = '0';
    container.style.background = opts.bg;
    container.style.color = opts.color;
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = `${opts.fontSizePx}px`;
    container.style.lineHeight = '1.4';
    container.innerHTML = paragraphs;
    document.body.appendChild(container);

    // Wait a tick for fonts/layout
    await new Promise((r) => setTimeout(r, 30));

    const canvas = await html2canvas(container, {
      backgroundColor: opts.bg,
      scale: 2, // higher DPI for crisp formulas
      logging: false,
      useCORS: true,
    });
    const dataUrl = canvas.toDataURL('image/png');
    const widthPx = canvas.width / 2;
    const heightPx = canvas.height / 2;
    document.body.removeChild(container);
    return { dataUrl, widthPx, heightPx };
  } catch (e) {
    console.error('renderContentToImage failed', e);
    return null;
  }
}

// Plain-text version (used for PPTX which can't render HTML/MathML)
function markdownToText(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s+(.+)/g, '$1')
    .replace(/^\s*[-•→✓★⚡📌⚠️]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => simplifyLatex(f))
    .replace(/\$([^$\n]+?)\$/g, (_, f) => simplifyLatex(f));
}

// HTML version with KaTeX-rendered formulas (used for PDF)
function markdownToHTML(markdown: string): string {
  const placeholders: string[] = [];
  const stash = (html: string) => {
    placeholders.push(html);
    return `\u0000${placeholders.length - 1}\u0000`;
  };

  let s = markdown
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, f) => {
      try {
        return stash(katex.renderToString(f.trim(), { throwOnError: false, displayMode: true, output: 'html' }));
      } catch {
        return stash(`<code>${escapeHtml(f)}</code>`);
      }
    })
    .replace(/\$([^$\n]+?)\$/g, (_m, f) => {
      try {
        return stash(katex.renderToString(f.trim(), { throwOnError: false, displayMode: false, output: 'html' }));
      } catch {
        return stash(`<code>${escapeHtml(f)}</code>`);
      }
    });

  s = escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => placeholders[Number(i)]);
  return s;
}

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ',
  'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ',
  't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ',
  'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ',
};

function toScript(input: string, map: Record<string, string>): string {
  return input.split('').map(ch => map[ch] ?? map[ch.toLowerCase()] ?? ch).join('');
}

const LATEX_SYMBOLS: Array<[RegExp, string]> = [
  [/\\times/g, '×'], [/\\cdot/g, '·'], [/\\div/g, '÷'], [/\\pm/g, '±'], [/\\mp/g, '∓'],
  [/\\leq/g, '≤'], [/\\geq/g, '≥'], [/\\neq/g, '≠'], [/\\approx/g, '≈'], [/\\equiv/g, '≡'],
  [/\\infty/g, '∞'], [/\\partial/g, '∂'], [/\\nabla/g, '∇'], [/\\forall/g, '∀'], [/\\exists/g, '∃'],
  [/\\in/g, '∈'], [/\\notin/g, '∉'], [/\\subset/g, '⊂'], [/\\supset/g, '⊃'], [/\\cup/g, '∪'], [/\\cap/g, '∩'],
  [/\\rightarrow/g, '→'], [/\\leftarrow/g, '←'], [/\\Rightarrow/g, '⇒'], [/\\Leftarrow/g, '⇐'], [/\\leftrightarrow/g, '↔'],
  [/\\sum/g, '∑'], [/\\prod/g, '∏'], [/\\int/g, '∫'], [/\\oint/g, '∮'],
  [/\\alpha/g, 'α'], [/\\beta/g, 'β'], [/\\gamma/g, 'γ'], [/\\delta/g, 'δ'], [/\\epsilon/g, 'ε'], [/\\varepsilon/g, 'ε'],
  [/\\zeta/g, 'ζ'], [/\\eta/g, 'η'], [/\\theta/g, 'θ'], [/\\vartheta/g, 'ϑ'], [/\\iota/g, 'ι'], [/\\kappa/g, 'κ'],
  [/\\lambda/g, 'λ'], [/\\mu/g, 'μ'], [/\\nu/g, 'ν'], [/\\xi/g, 'ξ'], [/\\pi/g, 'π'], [/\\rho/g, 'ρ'],
  [/\\sigma/g, 'σ'], [/\\tau/g, 'τ'], [/\\upsilon/g, 'υ'], [/\\phi/g, 'φ'], [/\\varphi/g, 'φ'], [/\\chi/g, 'χ'],
  [/\\psi/g, 'ψ'], [/\\omega/g, 'ω'],
  [/\\Gamma/g, 'Γ'], [/\\Delta/g, 'Δ'], [/\\Theta/g, 'Θ'], [/\\Lambda/g, 'Λ'], [/\\Xi/g, 'Ξ'],
  [/\\Pi/g, 'Π'], [/\\Sigma/g, 'Σ'], [/\\Phi/g, 'Φ'], [/\\Psi/g, 'Ψ'], [/\\Omega/g, 'Ω'],
  [/\\degree/g, '°'], [/\\circ/g, '°'], [/\\ldots/g, '…'], [/\\dots/g, '…'],
  [/\\left/g, ''], [/\\right/g, ''], [/\\,|\\;|\\:|\\!/g, ' '], [/\\quad|\\qquad/g, '  '],
  [/\\text\{([^}]*)\}/g, '$1'], [/\\mathrm\{([^}]*)\}/g, '$1'], [/\\mathbf\{([^}]*)\}/g, '$1'],
  [/\\mathop\{([^}]*)\}/g, '$1'], [/\\operatorname\{([^}]*)\}/g, '$1'],
];

function simplifyLatex(formula: string): string {
  let s = formula;
  // Iteratively reduce nested fractions and roots
  for (let i = 0; i < 5; i++) {
    s = s
      .replace(/\\d?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
      .replace(/\\sqrt\s*\[([^\]]+)\]\s*\{([^{}]+)\}/g, '($2)^(1/$1)')
      .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)');
  }
  // Symbols
  for (const [re, rep] of LATEX_SYMBOLS) s = s.replace(re, rep);
  // Superscripts / subscripts -> Unicode
  s = s.replace(/\^\{([^}]+)\}/g, (_m, exp) => toScript(exp, SUPERSCRIPT_MAP));
  s = s.replace(/\^([0-9a-zA-Z+\-])/g, (_m, exp) => toScript(exp, SUPERSCRIPT_MAP));
  s = s.replace(/_\{([^}]+)\}/g, (_m, sub) => toScript(sub, SUBSCRIPT_MAP));
  s = s.replace(/_([0-9a-zA-Z+\-])/g, (_m, sub) => toScript(sub, SUBSCRIPT_MAP));
  // Cleanup leftover braces and backslashes
  s = s.replace(/[{}]/g, '').replace(/\\\\/g, '\n').replace(/\\([a-zA-Z]+)/g, '$1');
  return s.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const colorSchemes: Record<string, { bg: string; text: string; accent: string }> = {
  'минимализм': { bg: 'FFFFFF', text: '333333', accent: '6366F1' },
  'школьная тетрадь': { bg: 'F0F4F8', text: '1E293B', accent: '3B82F6' },
  'официальный': { bg: 'FFFFFF', text: '1F2937', accent: '1E40AF' },
  'комикс': { bg: 'FEF3C7', text: '78350F', accent: 'F59E0B' },
  '3D-мультфильм': { bg: 'E0E7FF', text: '312E81', accent: '8B5CF6' }
};

async function getImageDimensions(dataUri: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 16, h: img.naturalHeight || 9 });
    img.onerror = () => resolve({ w: 16, h: 9 });
    img.src = dataUri;
  });
}

// Convert image URL to base64 data URI
async function imageToDataUri(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Failed to fetch image:', e);
    return null;
  }
}

// Generate PPTX file using pptxgenjs (reliable, no corruption)
export async function exportToPPTX(presentation: Presentation): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 inches (16:9)
  pptx.title = presentation.config.topic;

  const colors = colorSchemes[presentation.config.style] || colorSchemes['минимализм'];
  const SLIDE_W = 13.333;
  const SLIDE_H = 7.5;

  for (const slide of presentation.slides) {
    const pSlide = pptx.addSlide();
    pSlide.background = { color: colors.bg };

    // Title
    pSlide.addText(slide.title, {
      x: 0.5,
      y: 0.3,
      w: SLIDE_W - 1,
      h: 0.9,
      fontSize: 28,
      bold: true,
      color: colors.accent,
      fontFace: 'Arial',
      align: 'left',
      valign: 'top',
    });


    // Convert image with natural dimensions to keep its real aspect ratio
    let imgInfo: { data: string; w: number; h: number } | null = null;
    if (slide.imageUrl) {
      const data = await imageToDataUri(slide.imageUrl);
      if (data) {
        const dims = await getImageDimensions(data);
        const maxW = 5.5;
        const maxH = 5.5;
        const ratio = dims.w / dims.h;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) {
          h = maxH;
          w = h * ratio;
        }
        imgInfo = { data, w, h };
      }
    }

    const hasMath = /\$[^\n$]+\$|\$\$[\s\S]+?\$\$/.test(slide.content);
    const lines = markdownToText(slide.content).split('\n').filter((l) => l.trim());

    // Layout boxes
    const textX = imgInfo ? 6.3 : 0.5;
    const textY = 1.5;
    const textW = imgInfo ? SLIDE_W - 6.8 : SLIDE_W - 1;
    const textH = 5.5;

    if (imgInfo) {
      const boxX = 0.5;
      const boxY = 1.5;
      const boxW = 5.5;
      const boxH = 5.5;
      pSlide.addImage({
        data: imgInfo.data,
        x: boxX + (boxW - imgInfo.w) / 2,
        y: boxY,
        w: imgInfo.w,
        h: imgInfo.h,
      });
    }

    if (hasMath) {
      // Render content (with KaTeX) to PNG and place it in the text area
      const fontSizePx = imgInfo ? 22 : 24;
      const widthPx = Math.round(textW * 96); // PPTX inch -> px @96dpi
      const rendered = await renderContentToImage(slide.content, {
        widthPx,
        color: '#' + colors.text,
        fontSizePx,
        bg: '#' + colors.bg,
      });

      if (rendered) {
        // Fit into text box, preserving aspect ratio
        const ratio = rendered.widthPx / rendered.heightPx;
        let w = textW;
        let h = w / ratio;
        if (h > textH) {
          h = textH;
          w = h * ratio;
        }
        pSlide.addImage({ data: rendered.dataUrl, x: textX, y: textY, w, h });
      } else {
        // Fallback to plain text if rendering failed
        pSlide.addText(
          lines.map((l) => ({ text: l, options: { bullet: false, breakLine: true } })),
          {
            x: textX, y: textY, w: textW, h: textH,
            fontSize: imgInfo ? 16 : 18,
            color: colors.text, fontFace: 'Arial', align: 'left', valign: 'top', paraSpaceAfter: 6,
          }
        );
      }
    } else {
      pSlide.addText(
        lines.map((l) => ({ text: l, options: { bullet: false, breakLine: true } })),
        {
          x: textX, y: textY, w: textW, h: textH,
          fontSize: imgInfo ? 16 : 18,
          color: colors.text, fontFace: 'Arial', align: 'left', valign: 'top', paraSpaceAfter: 6,
        }
      );
    }
  }

  // Deterministic validation BEFORE writing the file to disk.
  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  const result = await validatePPTXBlob(blob, presentation.slides.length);
  if (!result.ok) {
    console.error("PPTX validation failed", result);
    throw new Error("Битый PPTX: " + result.errors.join(" | "));
  }
  if (result.warnings.length) console.warn("PPTX warnings", result.warnings);

  // Trigger download manually (since we already have the blob)
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${presentation.config.topic}.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Generate PDF by printing — one slide per page, no content split
export async function exportToPDF(presentation: Presentation): Promise<void> {
  const pdfColors: Record<string, { bg: string; text: string; accent: string }> = {
    'минимализм': { bg: '#FFFFFF', text: '#333333', accent: '#6366F1' },
    'школьная тетрадь': { bg: '#F0F4F8', text: '#1E293B', accent: '#3B82F6' },
    'официальный': { bg: '#FFFFFF', text: '#1F2937', accent: '#1E40AF' },
    'комикс': { bg: '#FEF3C7', text: '#78350F', accent: '#F59E0B' },
    '3D-мультфильм': { bg: '#E0E7FF', text: '#312E81', accent: '#8B5CF6' }
  };

  const colors = pdfColors[presentation.config.style] || pdfColors['минимализм'];

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(presentation.config.topic)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
    }
    .slide {
      width: 297mm;
      height: 210mm;
      padding: 12mm 15mm;
      background: ${colors.bg};
      color: ${colors.text};
      page-break-after: always;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .slide:last-child { page-break-after: auto; }
    h1 {
      font-size: 26pt;
      margin: 0 0 8mm 0;
      color: ${colors.accent};
      font-weight: bold;
      line-height: 1.2;
    }
    .body {
      display: flex;
      flex: 1;
      gap: 8mm;
      min-height: 0;
      align-items: flex-start;
    }
    .body.no-image .content { flex: 1; }
    .image-wrap {
      flex: 0 0 45%;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .image-wrap img {
      max-width: 100%;
      max-height: 160mm;
      object-fit: contain;
      border-radius: 6px;
    }
    .content {
      flex: 1;
      font-size: 13pt;
      line-height: 1.45;
      overflow: hidden;
    }
    .content p { margin: 0 0 4mm 0; }
    .katex { font-size: 1em; }
    .katex-display { margin: 4mm 0; text-align: left; }
  </style>
</head>
<body>
${presentation.slides.map(slide => {
  const paragraphs = slide.content.split('\n').filter(l => l.trim())
    .map(l => `<p>${markdownToHTML(l)}</p>`).join('');
  const hasImage = !!slide.imageUrl;
  return `<div class="slide">
    <h1>${escapeHtml(slide.title)}</h1>
    <div class="body ${hasImage ? '' : 'no-image'}">
      ${hasImage ? `<div class="image-wrap"><img src="${slide.imageUrl}" alt="${escapeHtml(slide.title)}" /></div>` : ''}
      <div class="content">${paragraphs}</div>
    </div>
  </div>`;
}).join('\n')}
<script>
  window.addEventListener('load', () => {
    const imgs = Array.from(document.images);
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; })))
      .then(() => setTimeout(() => window.print(), 300));
  });
</script>
</body>
</html>`;

  // Deterministic layout validation: check overflow per slide before printing.
  const layout = await validatePDFLayout(html, presentation);
  if (!layout.ok) {
    console.error("PDF validation failed", layout);
    throw new Error("Битый PDF: " + layout.errors.join(" | "));
  }
  if (layout.warnings.length) {
    console.warn("PDF layout warnings", layout.warnings, layout.details);
    // Surface as a non-fatal issue the caller can show via toast
    (window as unknown as { __lastPdfWarnings?: string[] }).__lastPdfWarnings =
      layout.warnings;
  }

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  }
}
