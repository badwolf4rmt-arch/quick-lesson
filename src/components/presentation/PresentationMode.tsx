import { useEffect, useRef, useState } from "react";
import { Presentation } from "@/types/presentation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface PresentationModeProps {
  presentation: Presentation;
  onClose: () => void;
}

export const PresentationMode = ({ presentation, onClose }: PresentationModeProps) => {
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgRatio, setImgRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = presentation.slides.length;
  const slide = presentation.slides[index];

  const next = () => setIndex((i) => Math.min(i + 1, total - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  useEffect(() => {
    setImgRatio(null);
  }, [index]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(total - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [total, onClose]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen error", e);
    }
  };

  // Decide layout based on image aspect ratio:
  // - wide image (>1.4): stack on top
  // - portrait/square (<=1.4): side by side
  const hasImage = !!slide.imageUrl;
  const sideBySide = hasImage && imgRatio !== null && imgRatio <= 1.4;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-gradient-to-br from-background via-background to-muted/30 flex flex-col font-serif"
    >
      {/* Top controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-30 hover:opacity-100 transition-opacity">
        <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center px-6 md:px-20 py-10 overflow-auto">
        <div className="w-full max-w-7xl">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-10 text-foreground tracking-tight leading-tight">
            {slide.title}
          </h1>

          {sideBySide ? (
            <div className="flex flex-row gap-10 items-start">
              <div className="flex-1 min-w-0 prose prose-2xl max-w-none text-foreground whitespace-pre-wrap [&_p]:text-2xl md:[&_p]:text-3xl [&_li]:text-2xl md:[&_li]:text-3xl [&_p]:leading-relaxed [&_li]:leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {slide.content}
                </ReactMarkdown>
              </div>
              <div className="w-[42%] shrink-0 rounded-xl overflow-hidden shadow-lg">
                <img
                  src={slide.imageUrl}
                  alt={slide.title}
                  className="w-full h-auto block"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImgRatio(img.naturalWidth / img.naturalHeight);
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              {hasImage && (
                <div className="mb-10 rounded-xl overflow-hidden flex justify-center shadow-lg">
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="max-w-full max-h-[50vh] h-auto block"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImgRatio(img.naturalWidth / img.naturalHeight);
                    }}
                  />
                </div>
              )}
              <div className="prose prose-2xl max-w-none text-foreground whitespace-pre-wrap [&_p]:text-2xl md:[&_p]:text-3xl [&_li]:text-2xl md:[&_li]:text-3xl [&_p]:leading-relaxed [&_li]:leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {slide.content}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <Button
        variant="ghost"
        size="lg"
        className="absolute left-2 top-1/2 -translate-y-1/2 h-16 w-16 rounded-full opacity-30 hover:opacity-100 transition-opacity"
        onClick={prev}
        disabled={index === 0}
      >
        <ChevronLeft className="h-8 w-8" />
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-16 w-16 rounded-full opacity-30 hover:opacity-100 transition-opacity"
        onClick={next}
        disabled={index === total - 1}
      >
        <ChevronRight className="h-8 w-8" />
      </Button>

      {/* Footer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border text-sm text-muted-foreground shadow-card font-sans">
        {index + 1} / {total} <span className="mx-2">•</span>
        <span className="text-xs">← → пробел для навигации, Esc — выход</span>
      </div>
    </div>
  );
};
