// Deterministic validators for exports — catch broken PPTX/PDF without regen.
import JSZip from "jszip";
import { Presentation } from "@/types/presentation";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  details?: Record<string, unknown>;
}

/**
 * Validate a PPTX Blob:
 *  - Must be a valid ZIP
 *  - Must contain required OOXML parts
 *  - Each slide XML must parse without errors
 *  - Slide count must match expected
 */
export async function validatePPTXBlob(
  blob: Blob,
  expectedSlideCount: number
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, unknown> = { size: blob.size };

  if (blob.size < 1000) {
    errors.push(`PPTX слишком маленький (${blob.size} байт) — вероятно битый файл.`);
    return { ok: false, errors, warnings, details };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(blob);
  } catch (e) {
    errors.push(`Не удалось распаковать PPTX как ZIP: ${(e as Error).message}`);
    return { ok: false, errors, warnings, details };
  }

  const required = [
    "[Content_Types].xml",
    "_rels/.rels",
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels",
  ];
  for (const path of required) {
    if (!zip.file(path)) errors.push(`Отсутствует обязательный файл: ${path}`);
  }

  // Slide files
  const slideFiles = Object.keys(zip.files).filter(
    (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)
  );
  details.slideFiles = slideFiles.length;

  if (slideFiles.length === 0) {
    errors.push("Нет ни одного слайда в PPTX.");
  } else if (slideFiles.length !== expectedSlideCount) {
    warnings.push(
      `Ожидалось ${expectedSlideCount} слайдов, в файле ${slideFiles.length}.`
    );
  }

  // Validate XML parses
  const parser = new DOMParser();
  const xmlFiles = [
    "ppt/presentation.xml",
    "[Content_Types].xml",
    ...slideFiles,
  ];
  for (const path of xmlFiles) {
    const f = zip.file(path);
    if (!f) continue;
    const txt = await f.async("string");
    const doc = parser.parseFromString(txt, "application/xml");
    const parseErr = doc.getElementsByTagName("parsererror")[0];
    if (parseErr) {
      errors.push(`Битый XML в ${path}: ${parseErr.textContent?.slice(0, 120)}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, details };
}

/**
 * Validate that PDF slides will fit on a single A4-landscape page each.
 * Renders the same HTML/CSS used by the PDF export into an offscreen iframe
 * and measures overflow per slide. Returns list of overflowing slide indices.
 *
 * NOTE: must be called from a browser context.
 */
export async function validatePDFLayout(
  html: string,
  presentation: Presentation
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, unknown> = {};

  const iframe = document.createElement("iframe");
  // A4 landscape at 96dpi ≈ 1123 x 794 css px
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1123px;height:794px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for images
    const imgs = Array.from(doc.images);
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((r) => {
                img.onload = img.onerror = () => r();
              })
      )
    );
    // Layout settle
    await new Promise((r) => setTimeout(r, 50));

    const slides = Array.from(doc.querySelectorAll<HTMLElement>(".slide"));
    details.renderedSlides = slides.length;

    if (slides.length !== presentation.slides.length) {
      errors.push(
        `Слайдов в HTML (${slides.length}) ≠ в презентации (${presentation.slides.length}).`
      );
    }

    const overflowing: { index: number; title: string; overflowPx: number }[] = [];
    slides.forEach((el, i) => {
      const content = el.querySelector<HTMLElement>(".content");
      if (content) {
        const overflow = content.scrollHeight - content.clientHeight;
        if (overflow > 4) {
          overflowing.push({
            index: i,
            title: presentation.slides[i]?.title ?? `Слайд ${i + 1}`,
            overflowPx: overflow,
          });
        }
      }
      // Whole-slide overflow (e.g. title too long pushing body)
      if (el.scrollHeight - el.clientHeight > 4) {
        const t = presentation.slides[i]?.title ?? `Слайд ${i + 1}`;
        warnings.push(`Слайд ${i + 1} «${t}» переполнен по высоте.`);
      }
    });

    if (overflowing.length > 0) {
      details.overflowing = overflowing;
      for (const o of overflowing) {
        warnings.push(
          `Слайд ${o.index + 1} «${o.title}»: текст обрезан на ~${o.overflowPx}px.`
        );
      }
    }
  } finally {
    iframe.remove();
  }

  return { ok: errors.length === 0, errors, warnings, details };
}
