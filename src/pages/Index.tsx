import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PresentationForm } from "@/components/presentation/PresentationForm";
import { PresentationConfig, Presentation } from "@/types/presentation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap } from "lucide-react";
import { AILoader } from "@/components/ui/ai-loader";
import { reachGoal } from "@/utils/analytics";

const GENERATION_TIMEOUT_MS = 120_000;

const invokeGeneratePresentation = async (config: PresentationConfig) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-presentation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(config),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(payload?.error || `Ошибка генерации (${response.status})`);
    }

    return payload;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Превышено время ожидания. Попробуйте уменьшить количество слайдов или повторите попытку.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const Index = () => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingPhrases, setLoadingPhrases] = useState<string[]>();

  const handleGeneratePresentation = async (config: PresentationConfig) => {
    setIsGenerating(true);
    setLoadingPhrases(undefined); // Reset to defaults first

    const sendAnalytics = () => {
      reachGoal('aip_generate_presentation', {
        aip_generate_presentation: {
          slides_count: String(config.slideCount),
          style: config.style || '',
          format: config.format || '-',
          additional_requirements: config.additionalPrompt || ' ',
          main_text: config.mainText || ' ',
        }
      });
    };
    
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

    try {
      const invokePromise = invokeGeneratePresentation(config);

      // Запускаем аналитику и фразы только после старта основного запроса: на Safari/WebKit
      // сторонние скрипты иногда задерживают дальнейшее выполнение обработчика клика.
      window.setTimeout(sendAnalytics, 300);
      window.setTimeout(generatePhrases, 500);

      const data = await invokePromise;

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
