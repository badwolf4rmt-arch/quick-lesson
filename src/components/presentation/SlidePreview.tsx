import { Slide } from "@/types/presentation";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SlidePreviewProps {
  slide: Slide;
  compact?: boolean;
  imageSlot?: ReactNode;
  className?: string;
}

/** Visual slide surface used in the editor list, thumbnails and the edit dialog. */
export const SlidePreview = ({ slide, compact, imageSlot, className }: SlidePreviewProps) => {
  if (compact) {
    return (
      <div className={cn("aspect-video w-full rounded-xl bg-card border border-border overflow-hidden p-3 flex gap-2", className)}>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold leading-tight text-foreground line-clamp-3">{slide.title}</p>
          <p className="mt-1 text-[7px] leading-snug text-muted-foreground line-clamp-4">
            {slide.content.replace(/[#*_`$\\]/g, "")}
          </p>
        </div>
        {slide.imageUrl && (
          <img src={slide.imageUrl} alt="" className="w-2/5 self-start rounded-md object-contain" />
        )}
      </div>
    );
  }

  const image = imageSlot ?? (slide.imageUrl ? (
    <img src={slide.imageUrl} alt={slide.title} className="w-full h-auto block rounded-xl" />
  ) : null);

  return (
    <div className={cn("w-full min-h-[22rem] rounded-2xl bg-card border border-border shadow-card p-8 md:p-10 flex flex-col", className)}>
      <h2 className="text-3xl md:text-4xl font-semibold leading-tight text-foreground mb-5">{slide.title}</h2>
      <div className={cn("flex-1 grid gap-6", image && "md:grid-cols-[1fr_minmax(0,0.9fr)] items-start")}>
        <div className="prose prose-base max-w-none text-foreground [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
            {slide.content}
          </ReactMarkdown>
        </div>
        {image && <div>{image}</div>}
      </div>
    </div>
  );
};

export const SlideNotes = ({ notes }: { notes?: string }) => {
  if (!notes) return <p className="text-sm text-muted-foreground">Заметок нет</p>;
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {notes.split(/\n\s*\n/).map((block, i) => {
        const [heading, ...rest] = block.split("\n");
        return (
          <div key={i}>
            <p className="font-semibold text-foreground">{heading.replace(/\*\*/g, "")}</p>
            <p className="text-foreground/80 whitespace-pre-line">{rest.join("\n")}</p>
          </div>
        );
      })}
    </div>
  );
};
