import { useState } from "react";
import { Slide } from "@/types/presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Image, RefreshCw, Trash2, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SlideEditorProps {
  slide: Slide;
  onUpdate: (slide: Slide) => void;
  onDelete: () => void;
  onGenerateImage: (slideId: string, prompt: string) => Promise<void>;
  onRegenerateSlide: (slideId: string) => Promise<void>;
  isGeneratingImage: boolean;
  style: string;
}

export const SlideEditor = ({
  slide,
  onUpdate,
  onDelete,
  onGenerateImage,
  onRegenerateSlide,
  isGeneratingImage,
  style
}: SlideEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlide, setEditedSlide] = useState(slide);

  const handleSave = () => {
    onUpdate(editedSlide);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedSlide(slide);
    setIsEditing(false);
  };

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
              <ReactMarkdown>{slide.content}</ReactMarkdown>
            </div>
          )}

          {isEditing ? (
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm">Сохранить</Button>
              <Button onClick={handleCancel} variant="outline" size="sm">Отмена</Button>
            </div>
          ) : (
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
              Редактировать текст
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {slide.imageUrl ? (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="w-full h-full object-cover"
              />
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
            
            <Button
              onClick={() => onGenerateImage(slide.id, editedSlide.imagePrompt)}
              disabled={isGeneratingImage}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {slide.imageUrl ? "Перегенерировать" : "Сгенерировать"} изображение
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
