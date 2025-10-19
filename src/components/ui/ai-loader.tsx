import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const LOADING_PHRASES = [
  "Анализирую запрос...",
  "Подключаюсь к нейросети...",
  "Генерирую контент...",
  "Применяю креативность...",
  "Почти готово...",
  "Финальные штрихи...",
];

interface AILoaderProps {
  text?: string;
  className?: string;
}

export const AILoader = ({ text, className = "" }: AILoaderProps) => {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <Sparkles className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-foreground animate-fade-in">
          {text || LOADING_PHRASES[phraseIndex]}
        </p>
      </div>
    </div>
  );
};
