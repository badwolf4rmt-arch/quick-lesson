import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PresentationForm } from "@/components/presentation/PresentationForm";
import { PresentationConfig, Presentation } from "@/types/presentation";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { AILoader } from "@/components/ui/ai-loader";
import { reachGoal } from "@/utils/analytics";
import { invokeBackendFunction } from "@/utils/backendFunctions";

const GENERATION_TIMEOUT_MS = 300_000;

const createLocalLoadingPhrases = (config: PresentationConfig) => [
  `📚 Собираю материал: ${config.topic}...`,
  "🧠 Выстраиваю логику урока...",
  "✍️ Формулирую слайды без лишней воды...",
  "🎯 Подбираю примеры для класса...",
  "✨ Проверяю структуру презентации...",
  "🧩 Складываю теорию и практику...",
  "🚀 Финализирую результат...",
];

const invokeGeneratePresentation = async (config: PresentationConfig) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  try {
    return await invokeBackendFunction<{ slides?: Presentation['slides'] }>(
      'generate-presentation',
      config,
      { signal: controller.signal },
    );
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Генерация заняла больше 5 минут. Попробуйте ещё раз или временно уменьшите количество слайдов.');
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
    setLoadingPhrases(createLocalLoadingPhrases(config));

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
    
    try {
      const invokePromise = invokeGeneratePresentation(config);

      // Запускаем аналитику только после старта основного запроса: на Safari/WebKit
      // сторонние скрипты иногда задерживают дальнейшее выполнение обработчика клика.
      window.setTimeout(sendAnalytics, 300);

      const data = await invokePromise;

      if (!data || !data.slides) {
        console.error('Invalid response data:', data);
        throw new Error("Некорректный ответ от сервера");
      }

      let slides = data.slides;
      try {
        const notesRes = await invokeBackendFunction<{ notes?: string[] }>('generate-teacher-notes', {
          subject: config.subject,
          grade: config.grade,
          topic: config.topic,
          lessonPlan: config.lessonPlan,
          slides: slides.map((s) => ({ title: s.title, content: s.content })),
        });
        if (Array.isArray(notesRes?.notes)) {
          slides = slides.map((s, i) => ({ ...s, notes: notesRes.notes![i] || s.notes }));
        }
      } catch (err) {
        console.warn('Teacher notes generation failed', err);
        toast.error("Не удалось создать заметки для учителя — презентация готова без них");
      }

      const presentation: Presentation = {
        config,
        slides
      };

      reachGoal('aip_generate_presentation_success', {
        aip_generate_presentation_success: {
          slides_count: String(data.slides.length),
        }
      });

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
    <div className="min-h-screen bg-gradient-app">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="bg-gradient-hero rounded-3xl shadow-soft px-6 py-10 md:py-12 mb-8 text-center space-y-3">
          <div className="flex justify-center mb-1">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary blur-xl opacity-40 rounded-2xl" />
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center">
                <GraduationCap className="h-7 w-7 text-primary-foreground" strokeWidth={2.2} />
              </div>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            AI-генератор презентаций
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
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
