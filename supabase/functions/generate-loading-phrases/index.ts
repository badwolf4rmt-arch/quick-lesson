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
    const { subject, topic } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Loading Phrases Generator'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-mini-2025-04-14',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Создай ровно 15 коротких прикольных фраз для анимации загрузки презентации по теме "${subject}: ${topic}". 

КРИТИЧЕСКИ ВАЖНО:
- Фразы должны быть забавными, игривыми, с разными эмодзи (все эмодзи должны правильно отображаться)
- Каждая фраза связана с темой урока
- Короткие (до 50 символов каждая)
- Мотивирующие и позитивные
- Используй разнообразные эмодзи для каждой фразы (🎨, ✨, 🚀, 💡, 🌟, 🎉, 📚, 🧠, 💫, 🔥, 🎯, ⚡, 🌈, 🎭, 🎪)

ВЕРНИ СТРОГО В ЭТОМ ФОРМАТЕ (только JSON, без markdown кода):
{"phrases": ["фраза 1", "фраза 2", "фраза 3", "фраза 4", "фраза 5", "фраза 6", "фраза 7", "фраза 8", "фраза 9", "фраза 10", "фраза 11", "фраза 12", "фраза 13", "фраза 14", "фраза 15"]}

Пример для темы "Математика: Дроби":
{"phrases": ["🧮 Делю целое на части...", "🍕 Режу пиццу на доли...", "✨ Считаю дробные чудеса...", "🎯 Превращаю числа в дроби...", "🔢 Складываю половинки...", "💫 Упрощаю дробные магии...", "🎨 Рисую дробные узоры...", "🚀 Дроби готовы к взлету!", "💡 Понимаю части целого...", "🌟 Дробная магия близко!", "🎪 Цирк дробных чисел!", "⚡ Молниеносные дроби!", "🌈 Радуга из долей!", "🎭 Дробная драма!", "🔥 Дроби на максимум!"]}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      // Fallback to default phrases
      return new Response(
        JSON.stringify({
          phrases: [
            "✨ Готовлю что-то особенное...",
            "🎨 Рисую слайды...",
            "🧠 AI думает...",
            "📚 Собираю материал...",
            "🚀 Почти готово...",
            "💡 Идеи формируются...",
            "🌟 Создаю волшебство...",
            "🎯 Подбираю контент...",
            "⚡ Энергия творчества...",
            "🌈 Краски готовы...",
            "🎪 Шоу начинается...",
            "🔥 Разгоняю процессор...",
            "💫 Магия в процессе...",
            "🎭 Готовлю сюрприз...",
            "📖 Пишу историю..."
          ]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    console.log('Full API response:', JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response structure');
      throw new Error('Invalid response structure');
    }
    
    let content = data.choices[0].message.content;
    
    if (!content || content.trim() === '') {
      console.error('Empty content from API');
      throw new Error('Empty content from API');
    }
    
    console.log('Raw API response:', content);
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('Cleaned content:', content);
    
    // Try to parse, if fails return default
    try {
      const parsed = JSON.parse(content);
      console.log('Successfully parsed:', parsed);
      
      if (!parsed.phrases || !Array.isArray(parsed.phrases) || parsed.phrases.length === 0) {
        throw new Error('Invalid phrases structure');
      }
      
      return new Response(
        JSON.stringify(parsed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse response:', content, 'Error:', parseError);
      throw parseError;
    }
  } catch (error) {
    console.error('Error generating phrases:', error);
    // Fallback to default phrases
    return new Response(
      JSON.stringify({
        phrases: [
          "✨ Готовлю что-то особенное...",
          "🎨 Рисую слайды...",
          "🧠 AI думает...",
          "📚 Собираю материал...",
          "🚀 Почти готово...",
          "💡 Идеи формируются...",
          "🌟 Создаю волшебство...",
          "🎯 Подбираю контент...",
          "⚡ Энергия творчества...",
          "🌈 Краски готовы...",
          "🎪 Шоу начинается...",
          "🔥 Разгоняю процессор...",
          "💫 Магия в процессе...",
          "🎭 Готовлю сюрприз...",
          "📖 Пишу историю..."
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
