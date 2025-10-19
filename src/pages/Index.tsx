import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PresentationForm } from "@/components/presentation/PresentationForm";
import { PresentationConfig, Presentation } from "@/types/presentation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Sparkles } from "lucide-react";
import { AILoader } from "@/components/ui/ai-loader";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { mockPresentation } from "@/data/mockPresentation";

const Index = () => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [useAI, setUseAI] = useState(false);

  const handleGeneratePresentation = async (config: PresentationConfig) => {
    setIsGenerating(true);
    
    try {
      // Если AI выключен, используем моковую презентацию
      if (!useAI) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Имитация загрузки
        
        const presentation: Presentation = {
          ...mockPresentation,
          config, // Обновляем конфиг на актуальный
        };

        toast.success("Презентация создана! Перехожу к редактору...");
        
        setTimeout(() => {
          navigate("/editor", { state: { presentation } });
        }, 500);
        return;
      }

      // Реальная AI генерация
      const { data, error } = await supabase.functions.invoke('generate-presentation', {
        body: config
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || "Ошибка вызова функции генерации");
      }

      if (!data || !data.slides) {
        console.error('Invalid response data:', data);
        throw new Error("Некорректный ответ от сервера");
      }

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

        {isGenerating ? (
          <div className="flex justify-center py-20">
            <AILoader />
          </div>
        ) : (
          <div className="flex justify-center flex-col items-center gap-8">
            <div className="w-full max-w-2xl">
              <div className="p-6 rounded-xl bg-card border border-border shadow-card mb-6">
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Switch 
                      id="ai-mode" 
                      checked={useAI}
                      onCheckedChange={setUseAI}
                      className="data-[state=checked]:bg-primary"
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor="ai-mode" 
                        className="text-base font-semibold cursor-pointer flex items-center gap-2"
                      >
                        <Sparkles className={`h-4 w-4 ${useAI ? 'text-primary' : 'text-muted-foreground'}`} />
                        Использовать AI-генерацию
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {useAI ? (
                          <span className="text-amber-600 dark:text-amber-500 font-medium">
                            ⚠️ При использовании AI будут сниматься средства с AI-счета
                          </span>
                        ) : (
                          <span>
                            Демо-режим с примером презентации (бесплатно)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <PresentationForm
              onSubmit={handleGeneratePresentation}
              isLoading={isGenerating}
            />
          </div>
        )}

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
