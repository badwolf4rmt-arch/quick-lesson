import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PresentationConfig } from "@/types/presentation";
import { Sparkles } from "lucide-react";

interface PresentationFormProps {
  onSubmit: (config: PresentationConfig) => void;
  isLoading: boolean;
}

const SUBJECTS = [
  "Математика", "Русский язык", "Литература", "История", "Обществознание",
  "Физика", "Химия", "Биология", "География", "Английский язык",
  "Информатика", "Музыка", "ИЗО", "Технология", "Физкультура"
];

const STYLES = [
  { value: "минимализм", label: "Минимализм" },
  { value: "школьная тетрадь", label: "Школьная тетрадь" },
  { value: "официальный", label: "Официальный" },
  { value: "комикс", label: "Комикс" },
  { value: "3D-мультфильм", label: "3D-мультфильм" }
];

const FORMATS = [
  { value: "вопрос-ответ", label: "Вопрос-ответ" },
  { value: "теория-практика", label: "Теория-практика" },
  { value: "сторителлинг", label: "Сторителлинг" },
  { value: "визуальные образы", label: "Визуальные образы" },
  { value: "формализм", label: "Формализм" }
];

export const PresentationForm = ({ onSubmit, isLoading }: PresentationFormProps) => {
  const [config, setConfig] = useState<PresentationConfig>({
    subject: "Математика",
    grade: 5,
    topic: "",
    style: "минимализм",
    format: "теория-практика",
    slideCount: 10,
    additionalPrompt: "",
    mainText: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <Card className="w-full max-w-3xl shadow-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Создание презентации
        </CardTitle>
        <CardDescription>
          Настройте параметры для автоматической генерации презентации
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Предмет *</Label>
              <Select
                value={config.subject}
                onValueChange={(value) => setConfig({ ...config, subject: value })}
              >
                <SelectTrigger id="subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {SUBJECTS.map(subject => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade">Класс *</Label>
              <Select
                value={config.grade.toString()}
                onValueChange={(value) => setConfig({ ...config, grade: parseInt(value) })}
              >
                <SelectTrigger id="grade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Array.from({ length: 11 }, (_, i) => i + 1).map(grade => (
                    <SelectItem key={grade} value={grade.toString()}>{grade} класс</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Тема урока *</Label>
            <Input
              id="topic"
              placeholder="Например: Дроби. Сложение и вычитание"
              value={config.topic}
              onChange={(e) => setConfig({ ...config, topic: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="style">Стиль оформления</Label>
              <Select
                value={config.style}
                onValueChange={(value) => setConfig({ ...config, style: value })}
              >
                <SelectTrigger id="style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {STYLES.map(style => (
                    <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Формат подачи</Label>
              <Select
                value={config.format}
                onValueChange={(value) => setConfig({ ...config, format: value })}
              >
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {FORMATS.map(format => (
                    <SelectItem key={format.value} value={format.value}>{format.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slideCount">Количество слайдов</Label>
            <Input
              id="slideCount"
              type="number"
              min={3}
              max={30}
              value={config.slideCount}
              onChange={(e) => setConfig({ ...config, slideCount: parseInt(e.target.value) || 10 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalPrompt">Дополнительные требования</Label>
            <Textarea
              id="additionalPrompt"
              placeholder="Например: для объяснения новой темы, с акцентом на практические примеры"
              value={config.additionalPrompt}
              onChange={(e) => setConfig({ ...config, additionalPrompt: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mainText">Основной текст (опционально)</Label>
            <Textarea
              id="mainText"
              placeholder="Можете вставить основной текст урока для увеличения достоверности"
              value={config.mainText}
              onChange={(e) => setConfig({ ...config, mainText: e.target.value })}
              rows={4}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !config.topic}
          >
            {isLoading ? "Генерация презентации..." : "Создать презентацию"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
