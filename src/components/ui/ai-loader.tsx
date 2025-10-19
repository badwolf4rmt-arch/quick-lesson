import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const LOADING_PHRASES = [
  "✨ Готовлю что-то особенное для вас...",
  "🎨 Рисую слайды с душой...",
  "🧠 AI думает над идеальной структурой...",
  "📚 Собираю знания со всего интернета...",
  "🚀 Запускаю турбо-режим генерации...",
  "🎯 Подбираю идеальные формулировки...",
  "💡 Озарение приходит... почти здесь!",
  "🎪 Устраиваю магию образования...",
  "🌟 Добавляю капельку волшебства...",
  "🎭 Превращаю знания в искусство...",
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
    <div className={`flex flex-col items-center justify-center gap-6 p-8 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
        <Sparkles className="h-12 w-12 text-primary relative animate-pulse" />
      </div>
      <div className="text-center max-w-md">
        <p className="text-xl font-medium text-foreground animate-fade-in bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          {text || LOADING_PHRASES[phraseIndex]}
        </p>
      </div>
    </div>
  );
};
