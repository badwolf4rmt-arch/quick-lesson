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
    const { subject, grade, topic, style, format, slideCount, additionalPrompt, mainText } = await req.json();
    
    console.log('Generating presentation:', { subject, grade, topic, style, format, slideCount });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Создаем детальный промпт для генерации презентации с акцентом на академическую достоверность
    const systemPrompt = `Ты — эксперт по созданию образовательных презентаций для школьных учителей.

КРИТИЧЕСКИ ВАЖНО - ГРАМОТНОСТЬ РУССКОГО ЯЗЫКА:
- Существительные пишутся только с маленькой буквы (кроме имён собственных и начала предложения)
- Никаких случайных заглавных букв в середине предложений
- Соблюдай все правила пунктуации
- Используй корректные падежи и согласования
- Пример ПРАВИЛЬНО: "что такое дробь", "виды дробей", "сложение дробей"
- Пример НЕПРАВИЛЬНО: "Что Такое Дробь", "Виды Дробей", "Сложение Дробей"

КРИТИЧЕСКИ ВАЖНО - АКАДЕМИЧЕСКАЯ ДОСТОВЕРНОСТЬ - ПРИОРИТЕТ №1:
- Используй только проверенные, научно обоснованные факты
- Избегай упрощений, которые искажают суть
- Для математики, физики, химии - проверяй все формулы и законы
- Для истории - используй достоверные даты, имена, события
- Для гуманитарных предметов - опирайся на признанные источники
- Если тема сложная, не упрощай до искажения, лучше разбей на шаги

Твоя задача — создать структуру презентации в JSON формате.

КРИТИЧЕСКИ ВАЖНО - ФОРМАТИРОВАНИЕ:
- Используй двойной перенос строки (\\n\\n) между абзацами и блоками
- Используй одинарный перенос (\\n) внутри списков
- Математические формулы оборачивай в LaTeX: $формула$ для inline, $$формула$$ для блочных
- Примеры формул: $x^2 + y^2 = z^2$, $$\\frac{a}{b} = c$$, $\\sqrt{x}$, $$\\int_{0}^{\\infty} e^{-x} dx$$
- Используй markdown: **жирный**, *курсив*, списки (-, 1.), подзаголовки (###)

Требования:
1. Академическая достоверность: вся информация должна быть точной, проверенной, соответствовать учебным программам
2. Адаптация под возраст: язык и сложность должны соответствовать указанному классу
3. Структурированность: активно используй списки, подзаголовки, переносы строк для читаемости
4. Визуальность: для каждого слайда создай промпт для генерации иллюстрации (минимум текста на изображении, текст только на русском)
5. Форматирование: активно используй markdown, LaTeX для формул, эмодзи для визуальной привлекательности
6. Практическая ценность: включай примеры, задачи, вопросы для закрепления
7. Разделяй текст на небольшие абзацы с переносами между ними

Формат вывода должен быть строго JSON:
{
  "slides": [
    {
      "id": "unique-id",
      "title": "Заголовок слайда",
      "content": "Основной текст с markdown и эмоджи",
      "imagePrompt": "Детальное описание для генерации изображения в выбранном стиле",
      "notes": "Заметки для учителя (опционально)"
    }
  ]
}

Стиль оформления: ${style}
Формат подачи: ${format}

Рекомендации по содержанию в зависимости от формата:
- "вопрос-ответ": чередуй слайды с вопросами и ответами
- "теория-практика": сначала теоретические слайды, затем примеры и задачи
- "сторителлинг": создай историю/нарратив, связывающий слайды
- "визуальные образы": минимум текста, акцент на описании ярких иллюстраций
- "формализм": строгая структура, определения, теоремы, доказательства`;

    const userPrompt = `Создай презентацию для урока:

Предмет: ${subject}
Класс: ${grade}
Тема: ${topic}
Количество слайдов: ${slideCount}
${additionalPrompt ? `Дополнительные требования: ${additionalPrompt}` : ''}
${mainText ? `Основной текст для использования:\n${mainText}` : ''}

Создай ${slideCount} слайдов. Первый слайд должен быть титульным с темой урока.
Последний слайд должен содержать выводы или итоги.

Для каждого imagePrompt создавай детальное описание в стиле "${style}", чтобы изображение соответствовало теме и было образовательным.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
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
          JSON.stringify({ error: 'Недостаточно средств. Пополните баланс в настройках.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error('Failed to generate presentation');
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    console.log('Generated presentation structure');

    return new Response(
      generatedContent,
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-presentation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
