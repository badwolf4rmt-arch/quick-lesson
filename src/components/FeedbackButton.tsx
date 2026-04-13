import { useState } from "react";
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const FEEDBACK_API_URL = "https://quick-lesson.lovable.app/api/external/feedback";
const FEEDBACK_API_KEY = "fyI2K26aTOeIJkw_m_vBaoHm7Y8B3J5EjunFJZCepmY";
const TOOL_NAME = "worksheets";

const getSessionId = () => {
  let id = sessionStorage.getItem("feedback_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("feedback_session_id", id);
  }
  return id;
};

export const FeedbackButton = () => {
  const [open, setOpen] = useState(false);
  const [isUseful, setIsUseful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
    if (isUseful === null) {
      toast.error("Пожалуйста, укажите, полезен ли сервис");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(FEEDBACK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": FEEDBACK_API_KEY,
        },
        body: JSON.stringify({
          tool_name: TOOL_NAME,
          session_id: getSessionId(),
          is_useful: isUseful,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      toast.success("Спасибо за отзыв!");
      setOpen(false);
      setIsUseful(null);
      setComment("");
    } catch (e) {
      console.error("Feedback error:", e);
      toast.error("Не удалось отправить отзыв");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity font-medium text-sm"
      >
        <Star className="h-5 w-5" />
        Оставить отзыв
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Оставьте отзыв
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Вам полезен этот сервис? Ваше мнение важно для нас!
          </p>

          <div className="flex gap-3">
            <Button
              type="button"
              variant={isUseful === true ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIsUseful(true)}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Да, полезен
            </Button>
            <Button
              type="button"
              variant={isUseful === false ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIsUseful(false)}
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              Нет
            </Button>
          </div>

          <Textarea
            placeholder="Что можно улучшить? (необязательно)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          <Button
            onClick={handleSubmit}
            disabled={isSending || isUseful === null}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSending ? "Отправка..." : "Отправить отзыв"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
