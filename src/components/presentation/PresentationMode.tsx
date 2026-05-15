import { useEffect, useRef, useState, CSSProperties } from "react";
import { Presentation } from "@/types/presentation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2, Type } from "lucide-react";
import { Slider } from "@/components/ui/slider";
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
  const [fontScale, setFontScale] = useState(() => {
    const saved = localStorage.getItem("presentation-font-scale");
    return saved ? parseFloat(saved) : 1;
  });
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

  useEffect(() => {
    localStorage.setItem("presentation-font-scale", fontScale.toString());
  }, [fontScale]);

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

  const hasImage = !!slide.imageUrl;
  const sideBySide = hasImage && imgRatio !== null && imgRatio <= 1.4;

  // Responsive font sizes that fit any screen, multiplied by user's scale.
  const styleVars = { "--s": fontScale } as CSSProperties;
  const titleStyle: CSSProperties = {
    fontSize: `calc(min(5.5vh, 4.5vw) * var(--s))`,
    lineHeight: 1.15,
  };
  const bodyStyle: CSSProperties = {
    fontSize: `calc(min(2.8vh, 2vw) * var(--s))`,
    lineHeight: 1.5,
  };

  return (
    <div
      ref={containerRef}
      style={styleVars}
      className="fixed inset-0 z-50 bg-background flex flex-col font-serif overflow-hidden"
    >
      {/* Top controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 items-center opacity-30 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5">
          <Type className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Slider
            value={[fontScale]}
            onValueChange={([v]) => setFontScale(v)}
            min={0.75}
            max={1.5}
            step={0.05}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground font-sans w-9 text-right shrink-0">
            {Math.round(fontScale * 100)}%
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Slide content — fits viewport */}
      <div className="flex-1 flex flex-col px-[5vw] pt-[5vh] pb-[8vh] gap-[2.5vh] min-h-0">
        <h1
          style={titleStyle}
          className="font-bold text-foreground tracking-tight shrink-0"
        >
          {slide.title}
        </h1>

        {sideBySide ? (
          <div className="flex-1 flex flex-row gap-[3vw] items-center min-h-0">
            <div
              style={bodyStyle}
              className="flex-1 min-w-0 max-h-full overflow-auto prose max-w-none text-foreground [&_p]:my-[0.4em] [&_li]:my-[0.2em] [&_ul]:my-[0.4em] [&_ol]:my-[0.4em]"
            >
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {slide.content}
              </ReactMarkdown>
            </div>
            <div className="h-full max-w-[45%] flex items-center justify-center shrink-0">
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="max-h-full max-w-full object-contain rounded-xl shadow-lg"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImgRatio(img.naturalWidth / img.naturalHeight);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-[2.5vh] min-h-0">
            {hasImage && (
              <div className="flex justify-center items-start shrink-0" style={{ maxHeight: "45vh" }}>
                <img
                  src={slide.imageUrl}
                  alt={slide.title}
                  className="max-h-[45vh] max-w-full object-contain rounded-xl shadow-lg"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImgRatio(img.naturalWidth / img.naturalHeight);
                  }}
                />
              </div>
            )}
            <div
              style={bodyStyle}
              className="flex-1 min-h-0 overflow-auto prose max-w-none text-foreground [&_p]:my-[0.4em] [&_li]:my-[0.2em] [&_ul]:my-[0.4em] [&_ol]:my-[0.4em]"
            >
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {slide.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-card/90 backdrop-blur-sm border border-border text-sm text-muted-foreground shadow-card font-sans">
        {index + 1} / {total} <span className="mx-2">•</span>
        <span className="text-xs">← → пробел для навигации, Esc — выход</span>
      </div>
    </div>
  );
};
