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
        'X-Title': 'Presentation Generator'
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini-2025-08-07',
        max_completion_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Создай ровно 8 коротких прикольных фраз для анимации загрузки презентации по теме "${subject}: ${topic}". 

КРИТИЧЕСКИ ВАЖНО:
- Фразы должны быть забавными, игривыми, с эмодзи
- Каждая фраза связана с темой урока
- Короткие (до 50 символов каждая)
- Мотивирующие и позитивные

ВЕРНИ СТРОГО В ЭТОМ ФОРМАТЕ (только JSON, без текста до и после):
{"phrases": ["фраза 1", "фраза 2", "фраза 3", "фраза 4", "фраза 5", "фраза 6", "фраза 7", "фраза 8"]}

Пример для темы "Математика: Дроби":
{"phrases": ["🧮 Делю целое на части...", "🍕 Режу пиццу на доли...", "✨ Считаю дробные чудеса...", "🎯 Превращаю числа в дроби...", "🔢 Складываю половинки...", "💫 Упрощаю дробные магии...", "🎨 Рисую дробные узоры...", "🚀 Дроби готовы к взлету!"]}`
          }
        ]
      }),
    });

    if (!response.ok) {
      console.error('API error:', response.status);
      // Fallback to default phrases
      return new Response(
        JSON.stringify({
          phrases: [
            "✨ Готовлю что-то особенное...",
            "🎨 Рисую слайды...",
            "🧠 AI думает...",
            "📚 Собираю материал...",
            "🚀 Почти готово...",
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
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
