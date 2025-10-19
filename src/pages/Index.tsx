import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PresentationForm } from "@/components/presentation/PresentationForm";
import { PresentationConfig, Presentation } from "@/types/presentation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePresentation = async (config: PresentationConfig) => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-presentation', {
        body: config
      });

      if (error) throw error;

      const presentation: Presentation = {
        config,
        slides: data.slides
      };

      toast.success("Презентация создана! Перехожу к редактору...");
      
      setTimeout(() => {
        navigate("/editor", { state: { presentation } });
      }, 500);
    } catch (error: any) {
      console.error('Error generating presentation:', error);
      toast.error(error.message || "Ошибка генерации презентации");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12 space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-soft">
              <GraduationCap className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            AI-генератор презентаций
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Создавайте презентации к уроку за несколько минут с помощью искусственного интеллекта
          </p>
        </div>

        <div className="flex justify-center">
          <PresentationForm
            onSubmit={handleGeneratePresentation}
            isLoading={isGenerating}
          />
        </div>

        <div className="mt-16 max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-card shadow-card border border-border">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Точная настройка</h3>
              <p className="text-sm text-muted-foreground">
                Укажите предмет, класс, тему и стиль — AI создаст идеально подходящую презентацию
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-card shadow-card border border-border">
              <div className="text-3xl mb-3">✏️</div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Полный контроль</h3>
              <p className="text-sm text-muted-foreground">
                Редактируйте текст, изображения, добавляйте и удаляйте слайды в удобном редакторе
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-card shadow-card border border-border">
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Быстрый экспорт</h3>
              <p className="text-sm text-muted-foreground">
                Готовую презентацию можно скачать в PDF или PPTX формате одним кликом
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
