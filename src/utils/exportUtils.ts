import { Presentation } from "@/types/presentation";
import PptxGenJS from "pptxgenjs";

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

function simplifyLatex(formula: string): string {
  return formula
    .replace(/\\\\?frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
    .replace(/\\\\?sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\^(\{[^}]+\}|[0-9a-zA-Z])/g, (_m, exp) => `^${exp.replace(/[{}]/g, '')}`)
    .replace(/_(\{[^}]+\}|[0-9a-zA-Z])/g, (_m, sub) => `_${sub.replace(/[{}]/g, '')}`)
    .replace(/\\\\?int/g, '∫')
    .replace(/\\\\?sum/g, '∑')
    .replace(/\\\\?pi/g, 'π')
    .replace(/\\\\?alpha/g, 'α')
    .replace(/\\\\?beta/g, 'β')
    .replace(/\\\\?gamma/g, 'γ')
    .replace(/\\\\?delta/g, 'δ')
    .replace(/\\\\?theta/g, 'θ');
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

  await pptx.writeFile({ fileName: `${presentation.config.topic}.pptx` });
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

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  }
}
