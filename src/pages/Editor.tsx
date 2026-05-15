import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Presentation, Slide } from "@/types/presentation";
import { SlideEditor } from "@/components/presentation/SlideEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Eye, Edit, Plus, ArrowLeft, GripVertical, Loader2 } from "lucide-react";
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-app">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10 shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const confirmed = window.confirm(
                    "Вы уверены, что хотите выйти? Презентация будет потеряна, если вы её не экспортировали."
                  );
                  if (confirmed) navigate("/");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {presentation.config.topic}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {presentation.config.subject} • {presentation.config.grade} класс
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={isPreview ? "default" : "outline"}
                size="sm"
              onClick={() => {
                if (!isPreview) reachGoal('aip_preview');
                setIsPreview(!isPreview);
              }}
              >
                {isPreview ? (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Вернуться в редактор
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Предпросмотр
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pptx')}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                PPTX
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isPreview ? (
          <div className="max-w-4xl mx-auto space-y-8">
            {presentation.slides.map((slide) => (
              <Card key={slide.id} className="p-8 shadow-card">
                <h2 className="text-3xl font-bold mb-4 text-foreground">{slide.title}</h2>
                {slide.imageUrl && (
                  <div className="mb-6 rounded-lg overflow-hidden">
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-full h-auto block"
                    />
                  </div>
                )}
                <div className="prose prose-lg max-w-none text-foreground whitespace-pre-wrap">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {slide.content}
                  </ReactMarkdown>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {presentation.slides.map((slide, index) => (
              <div
                key={slide.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative ${draggedIndex === index ? 'opacity-50' : ''}`}
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 cursor-move">
                  <GripVertical className="h-6 w-6 text-muted-foreground" />
                </div>
                <SlideEditor
                  slide={slide}
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
            
            <Button
              onClick={handleAddSlide}
              variant="outline"
              className="w-full py-8 border-dashed"
            >
              <Plus className="h-5 w-5 mr-2" />
              Добавить слайд
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Editor;
