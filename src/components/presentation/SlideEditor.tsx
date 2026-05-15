import { useState, useRef } from "react";
import { Slide } from "@/types/presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Image, RefreshCw, Trash2, Upload, X, Wand2, Globe, Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { invokeBackendFunction } from "@/utils/backendFunctions";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { toast } from "sonner";
import { AILoader } from "@/components/ui/ai-loader";
import { reachGoal } from "@/utils/analytics";

interface SlideEditorProps {
  slide: Slide;
  onUpdate: (slide: Slide) => void;
  onDelete: () => void;
  onGenerateImage: (slideId: string, prompt: string) => Promise<void>;
  onRegenerateSlide: (slideId: string) => Promise<void>;
  isGeneratingImage: boolean;
  isRegeneratingSlide: boolean;
  style: string;
  topic?: string;
  subject?: string;
  imageLoadingPhrases?: string[];
  slideLoadingPhrases?: string[];
}

interface WebImageResult {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  sourceUrl?: string;
}

export const SlideEditor = ({
  slide,
  onUpdate,
  onDelete,
  onGenerateImage,
  onRegenerateSlide,
  isGeneratingImage,
  isRegeneratingSlide,
  style,
  topic,
  subject,
  imageLoadingPhrases,
  slideLoadingPhrases
}: SlideEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlide, setEditedSlide] = useState(slide);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [webSearchOpen, setWebSearchOpen] = useState(false);
  const [webSearchQuery, setWebSearchQuery] = useState("");
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [webImages, setWebImages] = useState<WebImageResult[]>([]);

  const runWebSearch = async (customQuery?: string) => {
    setWebSearchLoading(true);
    try {
      const data = await invokeBackendFunction<{ query?: string; images?: WebImageResult[] }>(
        'search-web-images',
        {
          slideTitle: slide.title,
          slideContent: slide.content,
          topic: topic || '',
          subject: subject || '',
          customQuery: customQuery,
        }
      );
      if (data?.query) setWebSearchQuery(data.query);
      setWebImages(data?.images || []);
      if (!data?.images || data.images.length === 0) {
        toast.info("Ничего не найдено, попробуйте другой запрос");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Ошибка поиска изображений");
    } finally {
      setWebSearchLoading(false);
    }
  };

  const openWebSearch = () => {
    reachGoal('aip_search_web_image');
    setWebSearchOpen(true);
    setWebImages([]);
    setWebSearchQuery("");
    runWebSearch();
  };

  const pickWebImage = (img: WebImageResult) => {
    const updatedSlide = { ...editedSlide, imageUrl: img.url };
    setEditedSlide(updatedSlide);
    onUpdate(updatedSlide);
    reachGoal('aip_select_web_image');
    setWebSearchOpen(false);
    toast.success("Изображение добавлено");
  };


  const handleSave = () => {
    onUpdate(editedSlide);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedSlide(slide);
    setIsEditing(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Пожалуйста, выберите файл изображения");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      const updatedSlide = { ...editedSlide, imageUrl };
      setEditedSlide(updatedSlide);
      onUpdate(updatedSlide);
      reachGoal('aip_upload_image');
      toast.success("Изображение загружено");
    };
    reader.readAsDataURL(file);
  };

  if (isRegeneratingSlide) {
    return (
      <Card className="p-6 space-y-4 shadow-card">
        <AILoader customPhrases={slideLoadingPhrases} text="Перегенерация слайда..." />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4 shadow-card hover:shadow-soft transition-shadow">
      <div className="flex justify-between items-start gap-4">
        {isEditing ? (
          <Input
            value={editedSlide.title}
            onChange={(e) => setEditedSlide({ ...editedSlide, title: e.target.value })}
            className="flex-1 text-xl font-semibold"
          />
        ) : (
          <h3 className="text-xl font-semibold text-foreground flex-1">{slide.title}</h3>
        )}
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRegenerateSlide(slide.id)}
            title="Перегенерировать содержание"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            title="Удалить слайд"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          {isEditing ? (
            <Textarea
              value={editedSlide.content}
              onChange={(e) => setEditedSlide({ ...editedSlide, content: e.target.value })}
              rows={8}
              className="w-full"
            />
          ) : (
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {slide.content}
              </ReactMarkdown>
            </div>
          )}

          {isEditing ? (
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm">Сохранить</Button>
              <Button onClick={handleCancel} variant="outline" size="sm">Отмена</Button>
            </div>
          ) : (
            <Button onClick={() => { reachGoal('aip_edit_text'); setIsEditing(true); }} variant="outline" size="sm">
              Редактировать текст
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {isGeneratingImage ? (
            <div className="aspect-video rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted">
              <AILoader customPhrases={imageLoadingPhrases} text="Генерация изображения..." className="py-8" />
            </div>
          ) : slide.imageUrl ? (
            <div className="relative rounded-lg overflow-hidden bg-muted group">
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="w-full h-auto block"
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  const updatedSlide = { ...editedSlide, imageUrl: undefined };
                  setEditedSlide(updatedSlide);
                  onUpdate(updatedSlide);
                  toast.success("Изображение удалено");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="aspect-video rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted">
              <div className="text-center p-4">
                <Image className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Нет изображения</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {isEditing && (
              <Textarea
                value={editedSlide.imagePrompt}
                onChange={(e) => setEditedSlide({ ...editedSlide, imagePrompt: e.target.value })}
                rows={3}
                placeholder="Описание для генерации изображения"
                className="text-sm"
              />
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={() => onGenerateImage(slide.id, editedSlide.imagePrompt)}
                disabled={isGeneratingImage}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {slide.imageUrl ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Перегенерировать
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Сгенерировать
                  </>
                )}
              </Button>

              <Button
                onClick={openWebSearch}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Globe className="h-4 w-4 mr-2" />
                Найти в интернете
              </Button>

              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Загрузить
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={webSearchOpen} onOpenChange={setWebSearchOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Поиск изображений в интернете</DialogTitle>
            <DialogDescription>
              Выберите подходящее изображение для слайда. Источник: Openverse (свободные лицензии).
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runWebSearch(webSearchQuery);
            }}
            className="flex gap-2"
          >
            <Input
              value={webSearchQuery}
              onChange={(e) => setWebSearchQuery(e.target.value)}
              placeholder="Ключевые слова для поиска"
              className="flex-1"
            />
            <Button type="submit" disabled={webSearchLoading}>
              {webSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>

          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            {webSearchLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : webImages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Изображения не найдены
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {webImages.map((img, idx) => (
                  <button
                    key={`${img.url}-${idx}`}
                    type="button"
                    onClick={() => pickWebImage(img)}
                    className="group relative aspect-square rounded-md overflow-hidden bg-muted border border-border hover:border-primary transition-colors"
                    title={img.title || img.source}
                  >
                    <img
                      src={img.thumbnail}
                      alt={img.title || 'web image'}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                      }}
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate">{img.source}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

