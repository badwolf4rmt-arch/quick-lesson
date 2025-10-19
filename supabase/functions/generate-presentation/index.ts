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

ФОРМАТИРОВАНИЕ И СТРУКТУРА:
- Используй markdown для форматирования текста: **жирный**, *курсив*, \`код\`
- Применяй эмоджи для визуального выделения ключевых моментов 
- НЕ злоупотребляй эмодзи - только там где они усиливают понимание
- Разделяй текст на абзацы для лучшей читаемости
- Для списков используй маркеры: •, ◆, ► или нумерацию
- Для математики используй Unicode символы: ∑, ∫, ≈, ≤, ≥, π, α, β, etc.
- Используй нумерованные и маркированные списки для структурирования
- Добавляй примеры и пояснения там, где это необходимо

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
