import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { config, slideIndex, currentSlide } = await req.json();
    
    console.log('Regenerating slide:', { slideIndex, currentTitle: currentSlide.title });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Ты опытный методист и педагог, который создаёт презентации для школьных уроков на русском языке.

КРИТИЧЕСКИ ВАЖНО - ГРАМОТНОСТЬ РУССКОГО ЯЗЫКА:
- Существительные пишутся только с маленькой буквы (кроме имён собственных и начала предложения)
- Никаких случайных заглавных букв в середине предложений
- Соблюдай все правила пунктуации
- Используй корректные падежи и согласования

АКАДЕМИЧЕСКАЯ ДОСТОВЕРНОСТЬ - ПРИОРИТЕТ №1:
- Вся информация должна быть точной и проверенной
- Формулы, даты, определения должны быть абсолютно корректными
- Объяснения должны быть научно обоснованными, но доступными для возраста
- При объяснении сложных концепций используй понятные аналогии

ФОРМАТИРОВАНИЕ И СТРУКТУРА:
- Используй markdown для структурирования: **жирный**, *курсив*, списки
- Применяй эмодзи для визуального выделения ключевых моментов
- Разделяй текст на абзацы для лучшей читаемости
- Используй нумерованные и маркированные списки
- Добавляй примеры и пояснения там, где это необходимо

Параметры урока:
Предмет: ${config.subject}
Класс: ${config.grade}
Тема: ${config.topic}
Формат: ${config.format}
${config.additionalPrompt ? `Дополнительно: ${config.additionalPrompt}` : ''}

Перегенерируй слайд №${slideIndex}, улучшив его содержание, но сохраняя общую структуру презентации.`;

    const userPrompt = `Перегенерируй слайд на основе текущего содержания, улучшив его качество, структуру и академическую точность.

Текущий слайд:
Заголовок: ${currentSlide.title}
Содержание: ${currentSlide.content}

Создай улучшенную версию этого слайда с:
- Более точными формулировками
- Лучшей структурой
- Корректным форматированием markdown
- Уместными эмодзи
- Академически достоверной информацией

Верни JSON с полями: title (строка), content (строка с markdown), imagePrompt (описание для генерации изображения на русском)`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "regenerate_slide",
              description: "Перегенерировать один слайд презентации",
              parameters: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Заголовок слайда"
                  },
                  content: {
                    type: "string",
                    description: "Содержание слайда с форматированием markdown"
                  },
                  imagePrompt: {
                    type: "string",
                    description: "Описание для генерации изображения"
                  }
                },
                required: ["title", "content", "imagePrompt"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "regenerate_slide" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте позже.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Недостаточно средств для генерации.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error('Failed to regenerate slide');
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error('No slide data in response');
    }

    const slideData = JSON.parse(toolCall.function.arguments);
    console.log('Slide regenerated successfully');

    return new Response(
      JSON.stringify(slideData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in regenerate-slide:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
