import { Presentation } from "@/types/presentation";
import PptxGenJS from "pptxgenjs";
import { validatePPTXBlob, validatePDFLayout } from "./exportValidators";

// Helper to convert markdown to plain text and strip LaTeX
function markdownToText(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s+(.+)/g, '$1')
    .replace(/^\s*[-•→✓★⚡📌⚠️]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\$\$([^$]+)\$\$/g, (_, formula) => simplifyLatex(formula))
    .replace(/\$([^$]+)\$/g, (_, formula) => simplifyLatex(formula));
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

    const content = markdownToText(slide.content);
    const lines = content.split('\n').filter(l => l.trim());

    let imgData: string | null = null;
    if (slide.imageUrl) {
      imgData = await imageToDataUri(slide.imageUrl);
    }

    if (imgData) {
      // Image left, text right
      pSlide.addImage({
        data: imgData,
        x: 0.5,
        y: 1.5,
        w: 5.5,
        h: 5.5,
      });
      pSlide.addText(
        lines.map(l => ({ text: l, options: { bullet: false, breakLine: true } })),
        {
          x: 6.3,
          y: 1.5,
          w: SLIDE_W - 6.8,
          h: 5.5,
          fontSize: 16,
          color: colors.text,
          fontFace: 'Arial',
          align: 'left',
          valign: 'top',
          paraSpaceAfter: 6,
        }
      );
    } else {
      pSlide.addText(
        lines.map(l => ({ text: l, options: { bullet: false, breakLine: true } })),
        {
          x: 0.5,
          y: 1.5,
          w: SLIDE_W - 1,
          h: 5.5,
          fontSize: 18,
          color: colors.text,
          fontFace: 'Arial',
          align: 'left',
          valign: 'top',
          paraSpaceAfter: 8,
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
  </style>
</head>
<body>
${presentation.slides.map(slide => {
  const content = markdownToText(slide.content);
  const paragraphs = content.split('\n').filter(l => l.trim()).map(l => `<p>${escapeHtml(l)}</p>`).join('');
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
