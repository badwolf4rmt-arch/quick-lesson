import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PresentationForm } from "@/components/presentation/PresentationForm";
import { PresentationConfig, Presentation } from "@/types/presentation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap } from "lucide-react";
import { AILoader } from "@/components/ui/ai-loader";
import { reachGoal } from "@/utils/analytics";

const Index = () => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingPhrases, setLoadingPhrases] = useState<string[]>();

  const handleGeneratePresentation = async (config: PresentationConfig) => {
    setIsGenerating(true);
    setLoadingPhrases(undefined); // Reset to defaults first

    // YM: aip_generate_presentation
    reachGoal('aip_generate_presentation', {
      aip_generate_presentation: {
        slides_count: String(config.slideCount),
        style: config.style || '',
        format: config.format || '-',
        additional_requirements: config.additionalPrompt || ' ',
        main_text: config.mainText || ' ',
      }
    });
    
    // Start phrases generation in background (non-blocking)
    const generatePhrases = async () => {
      try {
        const { data: phrasesData } = await supabase.functions.invoke('generate-loading-phrases', {
          body: { subject: config.subject, topic: config.topic }
        });

        if (phrasesData?.phrases && phrasesData.phrases.length > 0) {
          console.log('Custom phrases loaded:', phrasesData.phrases);
          setLoadingPhrases(phrasesData.phrases);
        } else {
          console.log('No phrases in response, retrying...');
          // Retry once
          const { data: retryData } = await supabase.functions.invoke('generate-loading-phrases', {
            body: { subject: config.subject, topic: config.topic }
          });
          if (retryData?.phrases && retryData.phrases.length > 0) {
            setLoadingPhrases(retryData.phrases);
          }
        }
      } catch (error) {
        console.error('Failed to generate custom phrases:', error);
        // Keep using default phrases
      }
    };

    // Start phrases generation without waiting
    generatePhrases();
    
    try {
      // Client-side timeout (важно для мобильных Safari, где долгие fetch могут зависать)
      const TIMEOUT_MS = 120_000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Превышено время ожидания. Попробуйте уменьшить количество слайдов или повторите попытку.')), TIMEOUT_MS)
      );

      const invokePromise = supabase.functions.invoke('generate-presentation', {
        body: config
      });

      const { data, error } = await Promise.race([
        invokePromise,
        timeoutPromise,
      ]) as Awaited<typeof invokePromise>;

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
            <AILoader customPhrases={loadingPhrases} />
          </div>
        ) : (
          <div className="flex justify-center">
            <PresentationForm
              onSubmit={handleGeneratePresentation}
              isLoading={isGenerating}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
