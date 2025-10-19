import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert markdown to plain text
function markdownToText(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s+(.+)/g, '$1')
    .replace(/^\s*[-•→✓★⚡📌⚠️]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\$\$(.+?)\$\$/g, '$1')
    .replace(/\$(.+?)\$/g, '$1');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { presentation, format } = await req.json();
    
    console.log('Exporting presentation:', { format, topic: presentation.config.topic });

    if (format === 'pdf') {
      // Generate HTML for PDF printing
      const htmlContent = generatePdfHtml(presentation);
      const base64Html = btoa(unescape(encodeURIComponent(htmlContent)));
      
      return new Response(
        JSON.stringify({ 
          html: htmlContent,
          base64: base64Html 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (format === 'pptx') {
      // Generate simple PPTX structure (XML-based)
      const pptxData = await generatePptxData(presentation);
      
      return new Response(
        JSON.stringify({ data: pptxData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    throw new Error('Unsupported format');
    
  } catch (error) {
    console.error('Error in export-presentation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generatePdfHtml(presentation: any): string {
  const colorSchemes: Record<string, { bg: string; text: string; accent: string }> = {
    'минимализм': { bg: '#FFFFFF', text: '#333333', accent: '#6366F1' },
    'школьная тетрадь': { bg: '#F0F4F8', text: '#1E293B', accent: '#3B82F6' },
    'официальный': { bg: '#FFFFFF', text: '#1F2937', accent: '#1E40AF' },
    'комикс': { bg: '#FEF3C7', text: '#78350F', accent: '#F59E0B' },
    '3D-мультфильм': { bg: '#E0E7FF', text: '#312E81', accent: '#8B5CF6' }
  };
  
  const colors = colorSchemes[presentation.config.style] || colorSchemes['минимализм'];
  
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    @page {
      size: A4 landscape;
      margin: 20mm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    .slide {
      page-break-after: always;
      padding: 60px;
      min-height: 500px;
      background: ${colors.bg};
      color: ${colors.text};
      position: relative;
    }
    .slide:last-child {
      page-break-after: avoid;
    }
    h1 {
      font-size: 48px;
      margin-bottom: 30px;
      color: ${colors.accent};
      font-weight: bold;
    }
    .content {
      font-size: 24px;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    .content strong {
      font-weight: bold;
      color: ${colors.accent};
    }
    img {
      max-width: 600px;
      max-height: 400px;
      margin: 30px 0;
      border-radius: 12px;
    }
    ul {
      list-style: none;
      padding-left: 0;
    }
    li {
      margin: 15px 0;
      padding-left: 30px;
      position: relative;
    }
    li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: ${colors.accent};
      font-weight: bold;
      font-size: 30px;
    }
  </style>
</head>
<body>`;
  
  for (const slide of presentation.slides) {
    html += `<div class="slide">`;
    html += `<h1>${escapeHtml(slide.title)}</h1>`;
    
    if (slide.imageUrl) {
      html += `<img src="${slide.imageUrl}" alt="${escapeHtml(slide.title)}" />`;
    }
    
    const content = markdownToText(slide.content)
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        if (line.trim().startsWith('•')) {
          return `<li>${escapeHtml(line.replace(/^•\s*/, ''))}</li>`;
        }
        return `<p>${escapeHtml(line)}</p>`;
      })
      .join('\n');
    
    html += `<div class="content">${content}</div>`;
    html += `</div>`;
  }
  
  html += `</body></html>`;
  return html;
}

async function generatePptxData(presentation: any): Promise<string> {
  // Return presentation data as JSON for client-side PPTX generation
  return JSON.stringify({
    topic: presentation.config.topic,
    subject: presentation.config.subject,
    grade: presentation.config.grade,
    style: presentation.config.style,
    slides: presentation.slides.map((slide: any) => ({
      title: slide.title,
      content: markdownToText(slide.content),
      imageUrl: slide.imageUrl
    }))
  });
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
