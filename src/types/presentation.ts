export interface Slide {
  id: string;
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl?: string;
  notes?: string;
}

export interface PresentationConfig {
  subject: string;
  grade: number;
  topic: string;
  style: string;
  format: string;
  slideCount: number;
  additionalPrompt?: string;
  mainText?: string;
  attachments?: Array<{
    name: string;
    mimeType: string;
    /** base64-encoded file contents (without data: prefix) */
    dataBase64?: string;
    /** extracted text fallback for формats Gemini не понимает напрямую */
    text?: string;
  }>;
}

export interface Presentation {
  config: PresentationConfig;
  slides: Slide[];
}
