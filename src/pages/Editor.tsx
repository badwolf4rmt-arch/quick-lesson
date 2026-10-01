import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Presentation, Slide } from "@/types/presentation";
import { SlideEditor } from "@/components/presentation/SlideEditor";
import { SlidePreview } from "@/components/presentation/SlidePreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Eye, Edit, Plus, ArrowLeft, GripVertical, Loader2, Play } from "lucide-react";
import { PresentationMode } from "@/components/presentation/PresentationMode";
import { toast } from "sonner";
import { exportToPDF, exportToPPTX } from "@/utils/exportUtils";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { AILoader } from "@/components/ui/ai-loader";
import { reachGoal } from "@/utils/analytics";
import { invokeBackendFunction } from "@/utils/backendFunctions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Editor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [presentation, setPresentation] = useState<Presentation | null>(
    location.state?.presentation || null
  );
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [regeneratingSlides, setRegeneratingSlides] = useState<Set<string>>(new Set());
  const [imageLoadingPhrases, setImageLoadingPhrases] = useState<{[key: string]: string[]}>({});
  const [slideLoadingPhrases, setSlideLoadingPhrases] = useState<{[key: string]: string[]}>({});
  const [isPreview, setIsPreview] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  useEffect(() => {
    if (!presentation) {
      navigate("/");
    }
  }, [presentation, navigate]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleUpdateSlide = (index: number, updatedSlide: Slide) => {
    if (!presentation) return;
    
    const newSlides = [...presentation.slides];
    newSlides[index] = updatedSlide;
    setPresentation({ ...presentation, slides: newSlides });
  };

  const handleDeleteSlide = (index: number) => {
    if (!presentation) return;
    
    const newSlides = presentation.slides.filter((_, i) => i !== index);
    setPresentation({ ...presentation, slides: newSlides });
    reachGoal('aip_delete_slide');
    toast.success("Слайд удален");
  };

  const handleAddSlide = () => {
    if (!presentation) return;
    
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: "Новый слайд",
      content: "Добавьте содержание...",
      imagePrompt: "Образовательная иллюстрация",
    };
    
    setPresentation({
      ...presentation,
      slides: [...presentation.slides, newSlide]
    });
    reachGoal('aip_add_slide');
    toast.success("Слайд добавлен");
  };

  const handleGenerateImage = async (slideId: string, prompt: string) => {
    if (!presentation) return;
    
    setGeneratingImages(prev => new Set(prev).add(slideId));
    reachGoal('aip_generate_image');
    
    // Generate loading phrases in background
    invokeBackendFunction<{ phrases?: string[] }>('generate-loading-phrases', {
      subject: "Генерация изображения",
      topic: prompt.slice(0, 100),
    }).then((data) => {
      if (data?.phrases) {
        setImageLoadingPhrases(prev => ({ ...prev, [slideId]: data.phrases }));
      }
    }).catch(() => {});
    
    try {
      const data = await invokeBackendFunction<{ imageUrl?: string }>('generate-slide-image', {
        prompt,
        style: presentation.config.style,
        grade: presentation.config.grade,
      });

      if (!data || !data.imageUrl) {
        console.error('Invalid response data:', data);
        throw new Error("Некорректный ответ от сервера");
      }

      const imageUrl = data.imageUrl;
      
      setPresentation(prev => {
        if (!prev) return prev;
        const newSlides = prev.slides.map(slide =>
          slide.id === slideId ? { ...slide, imageUrl } : slide
        );
        return { ...prev, slides: newSlides };
      });
      
      toast.success("Изображение сгенерировано");
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast.error(error.message || "Ошибка генерации изображения");
    } finally {
      setGeneratingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(slideId);
        return newSet;
      });
      setImageLoadingPhrases(prev => {
        const newPhrases = { ...prev };
        delete newPhrases[slideId];
        return newPhrases;
      });
    }
  };

  // Auto-generate images for ~30% of slides chosen by the AI (needsImage)
  const autoImagesStarted = useRef(false);
  useEffect(() => {
    if (!presentation || autoImagesStarted.current) return;
    autoImagesStarted.current = true;
    const slides = presentation.slides;
    if (slides.some((s) => s.imageUrl)) return;
    const target = Math.max(1, Math.round(slides.length * 0.3));
    let picked = slides.filter((s) => s.needsImage && s.imagePrompt);
    if (picked.length === 0) {
      const step = slides.length / target;
      picked = Array.from({ length: target }, (_, i) => slides[Math.floor(i * step)]);
    }
    picked.slice(0, target).forEach((s, i) => {
      setTimeout(() => handleGenerateImage(s.id, s.imagePrompt), i * 800);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegenerateSlide = async (slideId: string) => {
    if (!presentation) return;
    
    const slideIndex = presentation.slides.findIndex(s => s.id === slideId);
    if (slideIndex === -1) return;

    setRegeneratingSlides(prev => new Set(prev).add(slideId));
    reachGoal('aip_regenerate_slide');
    
    // Generate loading phrases in background
    const currentSlide = presentation.slides[slideIndex];
    invokeBackendFunction<{ phrases?: string[] }>('generate-loading-phrases', {
      subject: presentation.config.subject,
      topic: currentSlide.title,
    }).then((data) => {
      if (data?.phrases) {
        setSlideLoadingPhrases(prev => ({ ...prev, [slideId]: data.phrases }));
      }
    }).catch(() => {});
    
    try {
      const data = await invokeBackendFunction<{ title?: string; content?: string; imagePrompt?: string }>('regenerate-slide', {
        config: presentation.config,
        slideIndex: slideIndex + 1,
        currentSlide: presentation.slides[slideIndex],
      });

      if (!data || !data.title || !data.content) {
        console.error('Invalid response data:', data);
        throw new Error("Некорректный ответ от сервера");
      }

      const regeneratedSlide = {
        ...presentation.slides[slideIndex],
        title: data.title,
        content: data.content,
        imagePrompt: data.imagePrompt
      };
      
      const newSlides = [...presentation.slides];
      newSlides[slideIndex] = regeneratedSlide;
      
      setPresentation({ ...presentation, slides: newSlides });
      toast.success("Слайд перегенерирован");
    } catch (error: any) {
      console.error('Error regenerating slide:', error);
      toast.error(error.message || "Ошибка перегенерации слайда");
    } finally {
      setRegeneratingSlides(prev => {
        const newSet = new Set(prev);
        newSet.delete(slideId);
        return newSet;
      });
      setSlideLoadingPhrases(prev => {
        const newPhrases = { ...prev };
        delete newPhrases[slideId];
        return newPhrases;
      });
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newSlides = [...presentation!.slides];
    const draggedSlide = newSlides[draggedIndex];
    newSlides.splice(draggedIndex, 1);
    newSlides.splice(index, 0, draggedSlide);
    
    setPresentation({ ...presentation!, slides: newSlides });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleExport = async (format: 'pdf' | 'pptx') => {
    if (!presentation) return;
    
    setIsExporting(true);
    reachGoal('aip_download_file', { aip_download_file: { file_type: format } });
    toast.info("⚠️ Экспорт пока не оптимизирован и сделан исключительно для демонстрации функционала");
    
    try {
      if (format === 'pptx') {
        await exportToPPTX(presentation);
        toast.success('Презентация экспортирована в PPTX');
      } else {
        await exportToPDF(presentation);
        toast.success('Используйте Ctrl+P или Cmd+P и выберите "Сохранить как PDF"');
      }
    } catch (error: any) {
      console.error('Error exporting:', error);
      toast.error(error.message || "Ошибка экспорта");
    } finally {
      setIsExporting(false);
    }
  };

  if (!presentation) return null;

  const scrollToSlide = (id: string) => {
    document.getElementById(`slide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-muted/50">
      <header className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md">
        <div className="px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex items-center gap-2 text-sm min-w-0">
            <button onClick={() => setShowLeaveDialog(true)} className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
              Главная
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground truncate max-w-[22rem]">Презентация на тему «{presentation.config.topic}»</span>
          </nav>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (!isPreview) reachGoal('aip_preview');
                setIsPreview(!isPreview);
              }}
            >
              {isPreview ? <><Edit className="h-4 w-4 mr-2" />Вернуться в редактор</> : <><Eye className="h-4 w-4 mr-2" />Предпросмотр</>}
            </Button>
            {isPreview && (
              <Button variant="secondary" onClick={() => { reachGoal('aip_present'); setIsPresenting(true); }}>
                <Play className="h-4 w-4 mr-2 fill-current" />
                Демонстрация
              </Button>
            )}
            <Button variant="secondary" onClick={() => handleExport('pdf')} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              PDF
            </Button>
            <Button onClick={() => handleExport('pptx')} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Скачать в PPTX
            </Button>
          </div>
        </div>
      </header>

      <main className="px-2 md:px-3 pb-3">
        <div className="rounded-3xl bg-card shadow-card p-5 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-medium text-foreground">{presentation.config.topic}</h1>
            <p className="mt-1 text-muted-foreground">
              {presentation.config.subject} • {presentation.config.grade} класс
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
            <aside className="hidden md:block">
              <div className="sticky top-20 space-y-2 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
                {!isPreview && (
                  <Button variant="secondary" className="w-full" onClick={handleAddSlide}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить слайд
                  </Button>
                )}
                {presentation.slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    draggable={!isPreview}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => scrollToSlide(slide.id)}
                    className={`relative block w-full text-left rounded-xl transition hover:ring-2 hover:ring-primary ${draggedIndex === index ? 'opacity-50' : ''}`}
                  >
                    <SlidePreview slide={slide} compact />
                    <span className="absolute bottom-2 left-2 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">{index + 1}</span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="space-y-5">
              {presentation.slides.map((slide, index) => (
                <div key={slide.id} id={`slide-${slide.id}`} className="scroll-mt-20">
                  <SlideEditor
                    slide={slide}
                    index={index}
                    total={presentation.slides.length}
                    readOnly={isPreview}
                    onUpdate={(updatedSlide) => handleUpdateSlide(index, updatedSlide)}
                    onDelete={() => handleDeleteSlide(index)}
                    onGenerateImage={handleGenerateImage}
                    onRegenerateSlide={handleRegenerateSlide}
                    isGeneratingImage={generatingImages.has(slide.id)}
                    isRegeneratingSlide={regeneratingSlides.has(slide.id)}
                    style={presentation.config.style}
                    topic={presentation.config.topic}
                    subject={presentation.config.subject}
                    imageLoadingPhrases={imageLoadingPhrases[slide.id]}
                    slideLoadingPhrases={slideLoadingPhrases[slide.id]}
                  />
                </div>
              ))}
              {!isPreview && (
                <Button onClick={handleAddSlide} variant="outline" className="w-full py-8 border-dashed md:hidden">
                  <Plus className="h-5 w-5 mr-2" />
                  Добавить слайд
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      {isPresenting && (
        <PresentationMode
          presentation={presentation}
          onClose={() => setIsPresenting(false)}
        />
      )}

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выйти из редактора?</AlertDialogTitle>
            <AlertDialogDescription>
              Презентация не сохраняется автоматически. Если вы выйдете сейчас, все изменения будут потеряны.
              Не забудьте сначала экспортировать её в PDF или PPTX.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => navigate("/")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Выйти без сохранения
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Editor;
