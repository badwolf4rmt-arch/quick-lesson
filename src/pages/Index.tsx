import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PresentationForm } from "@/components/presentation/PresentationForm";
import { PresentationConfig, Presentation } from "@/types/presentation";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap } from "lucide-react";
import { AILoader } from "@/components/ui/ai-loader";

const Index = () => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingPhrases, setLoadingPhrases] = useState<string[]>();

  const handleGeneratePresentation = async (config: PresentationConfig) => {
    setIsGenerating(true);
    
    try {
      // Generate custom loading phrases first
      const { data: phrasesData } = await supabase.functions.invoke('generate-loading-phrases', {
        body: { subject: config.subject, topic: config.topic }
      });

      // Set custom phrases if available
      if (phrasesData?.phrases) {
        setLoadingPhrases(phrasesData.phrases);
      }

      // Then generate presentation
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
