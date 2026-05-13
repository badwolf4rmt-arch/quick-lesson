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

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const systemPrompt = `Ты опытный методист и педагог, который создаёт презентации для школьных уроков на русском языке.

КРИТИЧЕСКИ ВАЖНО - ГРАМОТНОСТЬ РУССКОГО ЯЗЫКА:
- Начало предложения ВСЕГДА с заглавной буквы
- Существительные внутри предложения пишутся с маленькой буквы (кроме имён собственных)
- Никаких случайных заглавных букв в середине предложений
- Соблюдай все правила пунктуации
- Используй корректные падежи и согласования

КРИТИЧЕСКИ ВАЖНО - ФОРМАТИРОВАНИЕ:
- Используй двойной перенос строки (\\n\\n) между абзацами и блоками
- Используй одинарный перенос (\\n) внутри списков
- Математические формулы оборачивай в LaTeX: $формула$ для inline, $$формула$$ для блочных
- ВАЖНО: используй двойной обратный слеш для LaTeX команд: $$\\\\frac{a}{b}$$, $$\\\\sqrt{x}$$, $$\\\\int$$
- Примеры формул: $x^2 + y^2 = z^2$, $$\\\\frac{a}{b} = c$$, $\\\\sqrt{x}$, $$\\\\int_{0}^{\\\\infty} e^{-x} dx$$
- Используй markdown: **жирный**, *курсив*, списки (-, 1.), подзаголовки (###)
- Активно используй спецсимволы для структуры: →, •, ✓, ★, ⚡, 📌, ⚠️

АКАДЕМИЧЕСКАЯ ДОСТОВЕРНОСТЬ - ПРИОРИТЕТ №1:
- Вся информация должна быть точной и проверенной
- Формулы, даты, определения должны быть абсолютно корректными
- Объяснения должны быть научно обоснованными, но доступными для возраста
- При объяснении сложных концепций используй понятные аналогии

КРИТИЧЕСКИ ВАЖНО - ОБЪЁМ ТЕКСТА:
- Каждый слайд должен содержать 3-5 ключевых пунктов
- Максимум 150-200 слов на слайд
- Избегай длинных абзацев - дробь на короткие блоки
- Используй маркированные списки для структурирования

Требования:
1. Структурированность: активно используй списки, подзаголовки, переносы строк, спецсимволы (→, •, ✓)
2. Визуальность: создай новый промпт для генерации иллюстрации (минимум текста, текст только на русском)
3. Форматирование: активно используй markdown, LaTeX для формул, эмодзи для визуальной привлекательности
4. Создай альтернативный вариант содержания, отличающийся от текущего, но раскрывающий ту же тему
5. Разделяй текст на небольшие абзацы с переносами между ними

Параметры урока:
Предмет: ${config.subject}
Класс: ${config.grade}
Тема: ${config.topic}
Стиль оформления изображений: ${config.style || 'комикс'}
${config.style === 'минимализм' ? '- Генерируй imagePrompt в СКАЗОЧНОМ стиле: теплые красочные образы в стиле Томаса Кинкейджа с уютным свечением, магической атмосферой, мечтательным очарованием' : ''}
${config.style === 'скетч' ? '- Генерируй imagePrompt в АКВАРЕЛЬНО-МАРКЕРНОМ стиле: свободные мазки, текучие цвета, рукотворное ощущение, выразительные чернильные линии' : ''}
${config.style === 'реализм' ? '- Генерируй imagePrompt в РЕАЛИСТИЧНОМ стиле: фотореалистичность, без артефактов, максимально высокая детализация, четкость, естественное освещение' : ''}
${config.style === 'комикс' ? '- Генерируй imagePrompt в стиле КОМИКСА С МЕТАФОРАМИ: яркие насыщенные цвета, динамичная композиция, выразительные символы и образы, энергия поп-арта' : ''}
${config.style === '3D-мультфильм' ? '- Генерируй imagePrompt в стиле PIXAR: высокая красочность, объемная глубина, мягкие округлые формы, глянцевые материалы, кинематографичное освещение' : ''}
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Slide Regenerator'
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
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
                required: ["title", "content", "imagePrompt"]
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
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid AI response structure:', JSON.stringify(data));
      throw new Error('Invalid response from AI');
    }
    
    const toolCalls = data.choices[0].message.tool_calls;
    
    if (!toolCalls || !toolCalls[0]?.function?.arguments) {
      console.error('No tool calls in response:', JSON.stringify(data.choices[0].message));
      throw new Error('No slide data in response');
    }

    const slideData = JSON.parse(toolCalls[0].function.arguments);
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
