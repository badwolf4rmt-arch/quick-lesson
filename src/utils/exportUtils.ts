import { Presentation } from "@/types/presentation";
import JSZip from "jszip";
import { saveAs } from "file-saver";

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

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate PPTX file
export async function exportToPPTX(presentation: Presentation): Promise<void> {
  const zip = new JSZip();
  
  // Color schemes
  const colorSchemes: Record<string, { bg: string; text: string; accent: string }> = {
    'минимализм': { bg: 'FFFFFF', text: '000000', accent: '6366F1' },
    'школьная тетрадь': { bg: 'F0F4F8', text: '1E293B', accent: '3B82F6' },
    'официальный': { bg: 'FFFFFF', text: '1F2937', accent: '1E40AF' },
    'комикс': { bg: 'FEF3C7', text: '78350F', accent: 'F59E0B' },
    '3D-мультфильм': { bg: 'E0E7FF', text: '312E81', accent: '8B5CF6' }
  };
  
  const colors = colorSchemes[presentation.config.style] || colorSchemes['минимализм'];
  
  // Download images if present
  const imageData: Record<string, { blob: Blob; ext: string }> = {};
  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    if (slide.imageUrl) {
      try {
        const response = await fetch(slide.imageUrl);
        const blob = await response.blob();
        const ext = blob.type.split('/')[1] || 'png';
        imageData[i] = { blob, ext };
      } catch (e) {
        console.error('Failed to fetch image:', e);
      }
    }
  }
  
  // Add [Content_Types].xml with all slides and images
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`;
  
  presentation.slides.forEach((_, index) => {
    contentTypesXml += `
  <Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  });
  
  contentTypesXml += `
</Types>`;
  
  zip.file("[Content_Types].xml", contentTypesXml);
  
  // Add _rels/.rels
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  
  // Add ppt/_rels/presentation.xml.rels
  const pptFolder = zip.folder("ppt");
  const relsFolder = pptFolder?.folder("_rels");
  
  let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  
  presentation.slides.forEach((_, index) => {
    relsXml += `
  <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`;
  });
  
  relsXml += `
</Relationships>`;
  
  relsFolder?.file("presentation.xml.rels", relsXml);
  
  // Add ppt/presentation.xml
  let presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>`;
  
  presentation.slides.forEach((_, index) => {
    presentationXml += `
    <p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`;
  });
  
  presentationXml += `
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;
  
  pptFolder?.file("presentation.xml", presentationXml);
  
  // Add media folder for images
  const mediaFolder = pptFolder?.folder("media");
  
  // Add slides
  const slidesFolder = pptFolder?.folder("slides");
  const slideRelsFolder = slidesFolder?.folder("_rels");
  
  presentation.slides.forEach((slide, index) => {
    const content = markdownToText(slide.content);
    const lines = content.split('\n').filter(line => line.trim());
    
    const hasImage = imageData[index];
    
    // Add image to media folder and create relationship
    let slideRelsXml = '';
    if (hasImage) {
      const imageName = `image${index + 1}.${hasImage.ext}`;
      mediaFolder?.file(imageName, hasImage.blob);
      
      slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imageName}"/>
</Relationships>`;
      
      slideRelsFolder?.file(`slide${index + 1}.xml.rels`, slideRelsXml);
    }
    
    let textElements = '';
    let yPos = hasImage ? 3000000 : 1800000; // Start lower if there's an image
    const fontSize = 1800; // 18pt
    const lineHeight = 450000; // Spacing between lines
    
    lines.forEach((line, lineIndex) => {
      const cleanLine = escapeXml(line.trim());
      textElements += `
        <p:sp>
          <p:nvSpPr>
            <p:cNvPr id="${index * 100 + lineIndex + 3}" name="TextBox ${index * 100 + lineIndex + 3}"/>
            <p:cNvSpPr txBox="1"/>
            <p:nvPr/>
          </p:nvSpPr>
          <p:spPr>
            <a:xfrm>
              <a:off x="${hasImage ? '4800000' : '914400'}" y="${yPos}"/>
              <a:ext cx="${hasImage ? '4000000' : '7315200'}" cy="400000"/>
            </a:xfrm>
            <a:prstGeom prst="rect">
              <a:avLst/>
            </a:prstGeom>
            <a:noFill/>
          </p:spPr>
          <p:txBody>
            <a:bodyPr wrap="square" rtlCol="0">
              <a:spAutoFit/>
            </a:bodyPr>
            <a:lstStyle/>
            <a:p>
              <a:pPr algn="l"/>
              <a:r>
                <a:rPr lang="ru-RU" sz="${fontSize}" dirty="0">
                  <a:solidFill>
                    <a:srgbClr val="${colors.text}"/>
                  </a:solidFill>
                  <a:latin typeface="Arial"/>
                </a:rPr>
                <a:t>${cleanLine}</a:t>
              </a:r>
            </a:p>
          </p:txBody>
        </p:sp>`;
      yPos += lineHeight;
    });
    
    // Add image element if present
    let imageElement = '';
    if (hasImage) {
      imageElement = `
        <p:pic>
          <p:nvPicPr>
            <p:cNvPr id="${index * 100 + 1000}" name="Picture ${index + 1}"/>
            <p:cNvPicPr>
              <a:picLocks noChangeAspect="1"/>
            </p:cNvPicPr>
            <p:nvPr/>
          </p:nvPicPr>
          <p:blipFill>
            <a:blip r:embed="rId1"/>
            <a:stretch>
              <a:fillRect/>
            </a:stretch>
          </p:blipFill>
          <p:spPr>
            <a:xfrm>
              <a:off x="914400" y="1800000"/>
              <a:ext cx="3600000" cy="2400000"/>
            </a:xfrm>
            <a:prstGeom prst="rect">
              <a:avLst/>
            </a:prstGeom>
          </p:spPr>
        </p:pic>`;
    }
    
    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill>
          <a:srgbClr val="${colors.bg}"/>
        </a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${index * 100 + 2}" name="Title ${index + 1}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="914400" y="457200"/>
            <a:ext cx="7315200" cy="1000000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="l"/>
            <a:r>
              <a:rPr lang="ru-RU" sz="3600" b="1" dirty="0">
                <a:solidFill>
                  <a:srgbClr val="${colors.accent}"/>
                </a:solidFill>
                <a:latin typeface="Arial"/>
              </a:rPr>
              <a:t>${escapeXml(slide.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      ${imageElement}
      ${textElements}
    </p:spTree>
  </p:cSld>
</p:sld>`;
    
    slidesFolder?.file(`slide${index + 1}.xml`, slideXml);
  });
  
  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${presentation.config.topic}.pptx`);
}

// Generate PDF by printing
export async function exportToPDF(presentation: Presentation): Promise<void> {
  const colorSchemes: Record<string, { bg: string; text: string; accent: string }> = {
    'минимализм': { bg: '#FFFFFF', text: '#333333', accent: '#6366F1' },
    'школьная тетрадь': { bg: '#F0F4F8', text: '#1E293B', accent: '#3B82F6' },
    'официальный': { bg: '#FFFFFF', text: '#1F2937', accent: '#1E40AF' },
    'комикс': { bg: '#FEF3C7', text: '#78350F', accent: '#F59E0B' },
    '3D-мультфильм': { bg: '#E0E7FF', text: '#312E81', accent: '#8B5CF6' }
  };
  
  const colors = colorSchemes[presentation.config.style] || colorSchemes['минимализм'];
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${presentation.config.topic}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm;
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
      padding: 40px;
      min-height: 170mm;
      background: ${colors.bg};
      color: ${colors.text};
      box-sizing: border-box;
    }
    .slide:last-child {
      page-break-after: avoid;
    }
    h1 {
      font-size: 36px;
      margin: 0 0 30px 0;
      color: ${colors.accent};
      font-weight: bold;
    }
    .content {
      font-size: 18px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .content p {
      margin: 10px 0;
    }
    img {
      max-width: 500px;
      max-height: 300px;
      margin: 20px 0;
      border-radius: 8px;
    }
  </style>
</head>
<body>
${presentation.slides.map(slide => {
  const content = markdownToText(slide.content);
  return `  <div class="slide">
    <h1>${escapeXml(slide.title)}</h1>
    ${slide.imageUrl ? `<img src="${slide.imageUrl}" alt="${escapeXml(slide.title)}" />` : ''}
    <div class="content">${content.split('\n').filter(l => l.trim()).map(l => `<p>${escapeXml(l)}</p>`).join('\n')}</div>
  </div>`;
}).join('\n')}
</body>
</html>`;
  
  // Open in new window and trigger print
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
