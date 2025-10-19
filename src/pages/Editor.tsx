import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Presentation, Slide } from "@/types/presentation";
import { SlideEditor } from "@/components/presentation/SlideEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Eye, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

const Editor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [presentation, setPresentation] = useState<Presentation | null>(
    location.state?.presentation || null
  );
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (!presentation) {
      navigate("/");
    }
  }, [presentation, navigate]);

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
    toast.success("Слайд добавлен");
  };

  const handleGenerateImage = async (slideId: string, prompt: string) => {
    if (!presentation) return;
    
    setGeneratingImages(prev => new Set(prev).add(slideId));
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-slide-image', {
        body: { 
          prompt,
          style: presentation.config.style 
        }
      });

      if (error) throw error;

      const imageUrl = data.imageUrl;
      
      const newSlides = presentation.slides.map(slide =>
        slide.id === slideId ? { ...slide, imageUrl } : slide
      );
      
      setPresentation({ ...presentation, slides: newSlides });
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
    }
  };

  const handleRegenerateSlide = async (slideId: string) => {
    if (!presentation) return;
    
    toast.info("Перегенерация содержания пока не реализована");
  };

  const handleExport = (format: 'pdf' | 'pptx') => {
    toast.info(`Экспорт в ${format.toUpperCase()} будет добавлен в следующей версии`);
  };

  if (!presentation) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
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
                variant="outline"
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {isPreview ? "Редактор" : "Предпросмотр"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pptx')}
              >
                <Download className="h-4 w-4 mr-2" />
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
                      className="w-full aspect-video object-cover"
                    />
                  </div>
                )}
                <div className="prose prose-lg max-w-none text-foreground">
                  <ReactMarkdown>{slide.content}</ReactMarkdown>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {presentation.slides.map((slide, index) => (
              <SlideEditor
                key={slide.id}
                slide={slide}
                onUpdate={(updatedSlide) => handleUpdateSlide(index, updatedSlide)}
                onDelete={() => handleDeleteSlide(index)}
                onGenerateImage={handleGenerateImage}
                onRegenerateSlide={handleRegenerateSlide}
                isGeneratingImage={generatingImages.has(slide.id)}
                style={presentation.config.style}
              />
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
