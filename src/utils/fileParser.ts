import JSZip from "jszip";

const MAX_CHARS_PER_FILE = 50_000;

const truncate = (s: string) => {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > MAX_CHARS_PER_FILE ? clean.slice(0, MAX_CHARS_PER_FILE) + "…" : clean;
};

const parseTxt = async (file: File) => await file.text();

const parsePdf = async (file: File): Promise<string> => {
  const pdfjs: any = await import("pdfjs-dist");
  // Use bundled worker via Vite ?url import
  // @ts-ignore
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = "";
  const maxPages = Math.min(pdf.numPages, 50);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
    if (text.length > MAX_CHARS_PER_FILE) break;
  }
  return text;
};

const parsePptx = async (file: File): Promise<string> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort();
  let text = "";
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    const slideText = matches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ");
    text += slideText + "\n\n";
    if (text.length > MAX_CHARS_PER_FILE) break;
  }
  return text;
};

const parseDocx = async (file: File): Promise<string> => {
  const mammoth: any = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
};

export const parseFileToText = async (file: File): Promise<string> => {
  const name = file.name.toLowerCase();
  let raw = "";
  if (name.endsWith(".pdf")) raw = await parsePdf(file);
  else if (name.endsWith(".pptx")) raw = await parsePptx(file);
  else if (name.endsWith(".docx")) raw = await parseDocx(file);
  else if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    file.type.startsWith("text/")
  )
    raw = await parseTxt(file);
  else throw new Error(`Неподдерживаемый формат: ${file.name}`);
  return truncate(raw);
};

export const ACCEPTED_FILE_TYPES =
  ".txt,.md,.pdf,.pptx,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
