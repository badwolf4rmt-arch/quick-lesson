import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PresentationConfig } from "@/types/presentation";
import { Sparkles, ChevronDown, Settings, Paperclip, X, Loader2, FileText } from "lucide-react";
import { reachGoal } from "@/utils/analytics";
import { parseFileToText, ACCEPTED_FILE_TYPES } from "@/utils/fileParser";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

interface AttachedFile {
  name: string;
  size: number;
  mimeType: string;
  /** base64 без data: префикса (для PDF/изображений отдаём в модель напрямую) */
  dataBase64?: string;
  /** извлечённый текст (для txt/md/docx/pptx) */
  text?: string;
}

const trackInput = (inputName: string) => {
  reachGoal('aip_edit_form_input', { aip_edit_form_input: { input_name: inputName } });
};

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
  { value: "минимализм", label: "Сказочный" },
  { value: "скетч", label: "Скетч" },
  { value: "реализм", label: "Реализм" },
  { value: "комикс", label: "Комикс" },
  { value: "3D-мультфильм", label: "3D-мультфильм" }
];

const FORMATS = [
  { value: "вопрос-ответ", label: "Вопрос-ответ" },
  { value: "теория-практика", label: "Теория-практика" },
  { value: "сторителлинг", label: "Сторителлинг" },
  { value: "визуальные образы", label: "Визуальные образы" },
  { value: "формальный", label: "Формальный" }
];

const MIN_SLIDES = 1;
const MAX_SLIDES = 30;
const DEFAULT_SLIDES = 10;

const clampSlideCount = (value: number) => Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, value));

export const PresentationForm = ({ onSubmit, isLoading }: PresentationFormProps) => {
  const [config, setConfig] = useState<PresentationConfig>({
    subject: "Математика",
    grade: 5,
    topic: "",
    style: "комикс",
    format: "теория-практика",
    slideCount: DEFAULT_SLIDES,
  });

  const [slideCountInput, setSlideCountInput] = useState(String(DEFAULT_SLIDES));

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const idx = result.indexOf(",");
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    if (attachedFiles.length + files.length > MAX_FILES) {
      toast.error(`Можно прикрепить не более ${MAX_FILES} файлов`);
      return;
    }

    setIsParsingFiles(true);
    try {
      const parsed: AttachedFile[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`Файл ${file.name} больше 10 МБ`);
          continue;
        }
        const lower = file.name.toLowerCase();
        const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
        const isImage = file.type.startsWith("image/");

        try {
          if (isPdf || isImage) {
            // Отдаём файл модели в исходном виде — она сама прочитает (без локального парсинга)
            const dataBase64 = await fileToBase64(file);
            parsed.push({
              name: file.name,
              size: file.size,
              mimeType: isPdf ? "application/pdf" : file.type,
              dataBase64,
            });
          } else {
            // Для txt/md/docx/pptx достаём текст локально
            const text = await parseFileToText(file);
            if (!text.trim()) {
              toast.error(`Не удалось прочитать ${file.name}`);
              continue;
            }
            parsed.push({
              name: file.name,
              size: file.size,
              mimeType: file.type || "text/plain",
              text,
            });
          }
          reachGoal('aip_attach_file');
        } catch (err: any) {
          toast.error(err?.message || `Ошибка чтения ${file.name}`);
        }
      }
      if (parsed.length) {
        setAttachedFiles((prev) => [...prev, ...parsed]);
        toast.success(`Прикреплено файлов: ${parsed.length}`);
      }
    } finally {
      setIsParsingFiles(false);
    }
  };

  const removeFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSlideCountInputChange = (value: string) => {
    if (value === "") {
      setSlideCountInput("");
      return;
    }
    if (!/^\d+$/.test(value)) return;

    setSlideCountInput(value);
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue >= MIN_SLIDES && numericValue <= MAX_SLIDES) {
      setConfig({ ...config, slideCount: numericValue });
    }
  };

  const normalizeSlideCountInput = () => {
    if (slideCountInput === "") {
      setSlideCountInput(String(DEFAULT_SLIDES));
      setConfig({ ...config, slideCount: DEFAULT_SLIDES });
      return;
    }
    const next = clampSlideCount(Number(slideCountInput) || DEFAULT_SLIDES);
    setSlideCountInput(String(next));
    setConfig({ ...config, slideCount: next });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedSlideCount = clampSlideCount(Number(slideCountInput) || DEFAULT_SLIDES);

    onSubmit({
      ...config,
      slideCount: normalizedSlideCount,
      attachments: attachedFiles.length
        ? attachedFiles.map((f) => ({
            name: f.name,
            mimeType: f.mimeType,
            dataBase64: f.dataBase64,
            text: f.text,
          }))
        : undefined,
    });
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
                onValueChange={(value) => { setConfig({ ...config, subject: value }); trackInput('subject'); }}
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
                onValueChange={(value) => { setConfig({ ...config, grade: parseInt(value) }); trackInput('grade'); }}
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
              onBlur={() => { if (config.topic) trackInput('topic'); }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slideCount">Количество слайдов</Label>
            <Input
              id="slideCount"
              type="number"
              inputMode="numeric"
              min={MIN_SLIDES}
              max={MAX_SLIDES}
              value={slideCountInput}
              onChange={(e) => handleSlideCountInputChange(e.target.value)}
              onBlur={() => { normalizeSlideCountInput(); trackInput('slideCount'); }}
              disabled={isLoading}
            />
          </div>

          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm">Дополнительные параметры</span>
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="style">Стиль оформления</Label>
                  <Select
                    value={config.style}
                    onValueChange={(value) => { setConfig({ ...config, style: value }); trackInput('style'); }}
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
                    onValueChange={(value) => { setConfig({ ...config, format: value }); trackInput('format'); }}
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
                <Label htmlFor="additionalPrompt">Дополнительные требования</Label>
                <Textarea
                  id="additionalPrompt"
                  placeholder="Например: для объяснения новой темы, с акцентом на практические примеры"
                  value={config.additionalPrompt}
                  onChange={(e) => setConfig({ ...config, additionalPrompt: e.target.value })}
                  onBlur={() => { if (config.additionalPrompt) trackInput('additionalPrompt'); }}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mainText">Основной текст</Label>
                <Textarea
                  id="mainText"
                  placeholder="Можете вставить основной текст урока для увеличения достоверности"
                  value={config.mainText}
                  onChange={(e) => setConfig({ ...config, mainText: e.target.value })}
                  onBlur={() => { if (config.mainText) trackInput('mainText'); }}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Прикрепить файлы</Label>
                <p className="text-xs text-muted-foreground">
                  TXT, MD, PDF, DOCX, PPTX, изображения (до 10 МБ, не более {MAX_FILES} файлов). Файл передаётся в ИИ как есть — без локальной обработки.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingFiles || attachedFiles.length >= MAX_FILES}
                  className="gap-2"
                >
                  {isParsingFiles ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                  {isParsingFiles ? "Чтение файлов..." : "Выбрать файлы"}
                </Button>

                {attachedFiles.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {attachedFiles.map((f, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm"
                      >
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(f.text.length / 1000).toFixed(1)}k симв.
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          aria-label="Удалить файл"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

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