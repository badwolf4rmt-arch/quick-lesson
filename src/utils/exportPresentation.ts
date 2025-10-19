import { Presentation } from "@/types/presentation";
import PptxGenJS from "pptxgenjs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Helper function to convert markdown to plain text (basic)
function markdownToText(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/#{1,6}\s+(.+)/g, '$1') // Headers
    .replace(/^\s*[-*+]\s+/gm, '• ') // List items
    .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/`(.+?)`/g, '$1') // Code
    .replace(/\$\$(.+?)\$\$/g, '$1') // Block LaTeX
    .replace(/\$(.+?)\$/g, '$1'); // Inline LaTeX
}

// Helper function to parse markdown for PPTX with formatting
function parseMarkdownForPptx(markdown: string): Array<{ text: string; options?: any }> {
  const lines = markdown.split('\n');
  const result: Array<{ text: string; options?: any }> = [];
  
  for (const line of lines) {
    if (!line.trim()) {
      result.push({ text: '\n' });
      continue;
    }
    
    // Headers
    if (line.startsWith('###')) {
      result.push({ text: line.replace(/^###\s+/, ''), options: { bold: true, fontSize: 16 } });
      result.push({ text: '\n' });
      continue;
    }
    
    // List items with special symbols
    if (line.match(/^\s*[-•→✓★⚡📌⚠️]\s+/)) {
      const text = line.replace(/^\s*[-•→✓★⚡📌⚠️]\s+/, '• ');
      result.push({ text, options: { fontSize: 14 } });
      result.push({ text: '\n' });
      continue;
    }
    
    // Regular text with inline formatting
    let processedLine = line;
    const parts: Array<{ text: string; options?: any }> = [];
    
    // Process bold
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(processedLine)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = processedLine.slice(lastIndex, match.index);
        if (beforeText) parts.push({ text: beforeText });
      }
      parts.push({ text: match[1], options: { bold: true } });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < processedLine.length) {
      const remainingText = processedLine.slice(lastIndex);
      if (remainingText) parts.push({ text: remainingText });
    }
    
    if (parts.length > 0) {
      result.push(...parts);
    } else {
      result.push({ text: processedLine });
    }
    
    result.push({ text: '\n' });
  }
  
  return result;
}

export async function exportToPPTX(presentation: Presentation): Promise<void> {
  const pptx = new PptxGenJS();
  
  // Set presentation properties
  pptx.author = 'AI Генератор Презентаций';
  pptx.title = presentation.config.topic;
  pptx.subject = `${presentation.config.subject}, ${presentation.config.grade} класс`;
  
  // Define color scheme based on style
  const colorSchemes: Record<string, { bg: string; text: string; accent: string }> = {
    'минимализм': { bg: 'FFFFFF', text: '333333', accent: '6366F1' },
    'школьная тетрадь': { bg: 'F0F4F8', text: '1E293B', accent: '3B82F6' },
    'официальный': { bg: 'FFFFFF', text: '1F2937', accent: '1E40AF' },
    'комикс': { bg: 'FEF3C7', text: '78350F', accent: 'F59E0B' },
    '3D-мультфильм': { bg: 'E0E7FF', text: '312E81', accent: '8B5CF6' }
  };
  
  const colors = colorSchemes[presentation.config.style] || colorSchemes['минимализм'];
  
  for (const slide of presentation.slides) {
    const pptxSlide = pptx.addSlide();
    
    // Set slide background
    pptxSlide.background = { color: colors.bg };
    
    // Add title
    pptxSlide.addText(slide.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 1,
      fontSize: 32,
      bold: true,
      color: colors.text,
      fontFace: 'Arial'
    });
    
    // Add image if exists
    if (slide.imageUrl) {
      try {
        pptxSlide.addImage({
          data: slide.imageUrl,
          x: 5.5,
          y: 1.8,
          w: 4,
          h: 3,
          sizing: { type: 'contain', w: 4, h: 3 }
        });
      } catch (error) {
        console.error('Error adding image to slide:', error);
      }
    }
    
    // Add content - convert LaTeX and markdown to plain text
    const plainContent = markdownToText(slide.content);
    const textParts = parseMarkdownForPptx(slide.content);
    const textX = 0.5;
    const textY = 1.8;
    const textW = slide.imageUrl ? 4.5 : 9;
    const textH = 4.5;
    
    pptxSlide.addText(textParts, {
      x: textX,
      y: textY,
      w: textW,
      h: textH,
      fontSize: 14,
      color: colors.text,
      fontFace: 'Arial',
      valign: 'top',
      wrap: true
    });
  }
  
  // Download file
  await pptx.writeFile({ fileName: `${presentation.config.topic}.pptx` });
}

export async function exportToPDF(presentation: Presentation): Promise<void> {
  // Create a temporary container for rendering slides
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '1920px';
  container.style.background = 'white';
  document.body.appendChild(container);
  
  // Create PDF with landscape A4 dimensions
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  let isFirstPage = true;
  
  for (const slide of presentation.slides) {
    if (!isFirstPage) {
      pdf.addPage();
    }
    isFirstPage = false;
    
    // Create slide HTML
    container.innerHTML = `
      <div style="padding: 40px; font-family: Arial, sans-serif; min-height: 1080px; background: white;">
        <h1 style="font-size: 48px; margin-bottom: 30px; color: #1a1a1a;">${slide.title}</h1>
        ${slide.imageUrl ? `<img src="${slide.imageUrl}" style="max-width: 600px; max-height: 400px; margin: 20px 0; border-radius: 8px;" />` : ''}
        <div style="font-size: 24px; line-height: 1.6; white-space: pre-wrap;">${markdownToText(slide.content)}</div>
      </div>
    `;
    
    // Wait for images to load
    const images = container.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(img => {
        return new Promise((resolve) => {
          if ((img as HTMLImageElement).complete) {
            resolve(null);
          } else {
            img.addEventListener('load', () => resolve(null));
            img.addEventListener('error', () => resolve(null));
          }
        });
      })
    );
    
    // Render to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    // Add to PDF
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  }
  
  // Remove temporary container
  document.body.removeChild(container);
  
  // Download PDF
  pdf.save(`${presentation.config.topic}.pdf`);
}
