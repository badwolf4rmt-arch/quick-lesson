import { useState, useRef } from "react";
import { Slide } from "@/types/presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SlidePreview, SlideNotes } from "./SlidePreview";
import { Image, RefreshCw, Trash2, Upload, X, Wand2, Globe, Search, Loader2, Pencil } from "lucide-react";
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
  index?: number;
  total?: number;
  readOnly?: boolean;
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
  slideLoadingPhrases,
  index = 0,
  total = 1,
  readOnly = false,
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
    setEditedSlide({ ...editedSlide, imageUrl: img.url });
    onUpdate({ ...slide, imageUrl: img.url });
    reachGoal('aip_select_web_image');
    setWebSearchOpen(false);
    toast.success("Изображение добавлено");
  };


  const handleSave = () => {
    onUpdate({ ...editedSlide, imageUrl: slide.imageUrl });
    setIsEditing(false);
  };

  const openEdit = () => {
    reachGoal('aip_edit_text');
    setEditedSlide(slide);
    setIsEditing(true);
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
      setEditedSlide({ ...editedSlide, imageUrl });
      onUpdate({ ...slide, imageUrl });
      reachGoal('aip_upload_image');
      toast.success("Изображение загружено");
    };
    reader.readAsDataURL(file);
  };

  if (isRegeneratingSlide) {

  const iconBtn = "h-9 w-9 rounded-full text-foreground/70 hover:text-primary hover:bg-card";

  const imageArea = (s: Slide, inDialog = false) => {
    if (isGeneratingImage) {
      return (
        <div className="aspect-video rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted">
          <AILoader customPhrases={imageLoadingPhrases} text="Генерация изображения..." className="py-6" />
        </div>
      );
    }
    if (s.imageUrl) {
      return (
        <div className="relative rounded-xl overflow-hidden bg-muted group">
          <img src={s.imageUrl} alt={s.title} className="w-full h-auto block" />
          {inDialog && (
            <Button
              size="sm"
              variant="destructive"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                const updated = { ...editedSlide, imageUrl: undefined };
                setEditedSlide(updated);
                onUpdate({ ...slide, imageUrl: undefined });
                toast.success("Изображение удалено");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    }
    if (!inDialog) return null;
    return (
      <div className="aspect-video rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted">
        <div className="text-center p-4">
          <Image className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Нет изображения</p>
        </div>
      </div>
    );
  };

  // keep dialog preview image in sync with externally generated/uploaded images
  const dialogSlide = { ...editedSlide, imageUrl: slide.imageUrl };

  return (
    <section className="rounded-3xl bg-muted/60 p-3 md:p-4">
      <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <span className="text-base text-muted-foreground">слайд {index + 1}/{total}</span>
        {!readOnly && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className={iconBtn} onClick={openEdit} title="Редактировать слайд">
              <Pencil className="h-[18px] w-[18px]" />
            </Button>
            <Button size="icon" variant="ghost" className={iconBtn} onClick={() => onRegenerateSlide(slide.id)} disabled={isRegeneratingSlide} title="Перегенерировать содержание">
              <RefreshCw className="h-[18px] w-[18px]" />
            </Button>
            <Button size="icon" variant="ghost" className={iconBtn} onClick={onDelete} title="Удалить слайд">
              <Trash2 className="h-[18px] w-[18px]" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        {isRegeneratingSlide ? (
          <Card className="p-6 rounded-2xl min-h-[22rem] flex items-center justify-center">
            <AILoader customPhrases={slideLoadingPhrases} text="Перегенерация слайда..." />
          </Card>
        ) : (
          <SlidePreview slide={slide} imageSlot={imageArea(slide) ?? undefined} />
        )}
        <div className="px-3 py-2">
          <h4 className="text-base font-semibold text-foreground mb-3">Заметки для учителя</h4>
          <SlideNotes notes={slide.notes} />
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={(o) => { if (!o) handleCancel(); }}>
        <DialogContent className="max-w-[min(96vw,1400px)] w-full h-[92vh] p-0 gap-0 bg-muted border-0 overflow-hidden">
          <div className="grid h-full gap-3 p-3 pt-10 lg:grid-cols-[minmax(0,1fr)_26rem] min-h-0">
            <div className="rounded-3xl bg-card p-6 md:p-8 overflow-y-auto min-h-0">
              <DialogHeader className="mb-6 text-left">
                <DialogTitle className="text-2xl md:text-3xl font-medium">Редактирование слайда {index + 1}</DialogTitle>
                <DialogDescription className="sr-only">Изменения отображаются в превью слева</DialogDescription>
              </DialogHeader>
              <div className="rounded-3xl bg-muted/60 p-2">
                <SlidePreview slide={dialogSlide} imageSlot={imageArea(dialogSlide, true) ?? undefined} />
              </div>
            </div>

            <div className="rounded-3xl bg-card flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="space-y-2">
                  <Label>Заголовок<span className="text-destructive">*</span></Label>
                  <Textarea
                    value={editedSlide.title}
                    onChange={(e) => setEditedSlide({ ...editedSlide, title: e.target.value })}
                    rows={2}
                    className="bg-muted/60 border-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Содержание слайда</Label>
                  <Textarea
                    value={editedSlide.content}
                    onChange={(e) => setEditedSlide({ ...editedSlide, content: e.target.value })}
                    rows={8}
                    className="bg-muted/60 border-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Изображение</Label>
                  <Textarea
                    value={editedSlide.imagePrompt}
                    onChange={(e) => setEditedSlide({ ...editedSlide, imagePrompt: e.target.value })}
                    rows={3}
                    placeholder="Описание для генерации изображения"
                    className="bg-muted/60 border-0 text-sm"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={() => onGenerateImage(slide.id, editedSlide.imagePrompt)} disabled={isGeneratingImage} variant="outline" size="sm" className="min-w-0 px-2">
                      {slide.imageUrl ? <RefreshCw className="h-4 w-4 mr-1 shrink-0" /> : <Wand2 className="h-4 w-4 mr-1 shrink-0" />}
                      <span className="truncate">{slide.imageUrl ? "Заново" : "Создать"}</span>
                    </Button>
                    <Button onClick={openWebSearch} variant="outline" size="sm" className="min-w-0 px-2">
                      <Globe className="h-4 w-4 mr-1 shrink-0" />
                      <span className="truncate">Найти</span>
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="min-w-0 px-2">
                      <Upload className="h-4 w-4 mr-1 shrink-0" />
                      <span className="truncate">Загрузить</span>
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Заметки для учителя</Label>
                  <Textarea
                    value={editedSlide.notes || ''}
                    onChange={(e) => setEditedSlide({ ...editedSlide, notes: e.target.value })}
                    rows={10}
                    className="bg-muted/60 border-0 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-6 pt-3">
                <Button variant="secondary" onClick={handleCancel}>Отменить</Button>
                <Button onClick={handleSave} disabled={!editedSlide.title.trim()}>Сохранить</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

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
    </section>
  );
};
