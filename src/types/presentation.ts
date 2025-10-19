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
}

export interface Presentation {
  config: PresentationConfig;
  slides: Slide[];
}
