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
            content: `Создай 8 коротких прикольных фраз для анимации загрузки презентации по теме "${subject}: ${topic}". 
Фразы должны быть:
- Забавными и игривыми
- Связаны с темой урока
- С эмодзи
- Короткие (до 50 символов)
- Мотивирующие и позитивные

Верни только массив строк в JSON формате: {"phrases": ["фраза1", "фраза2", ...]}`
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
    let content = data.choices[0].message.content;
    
    console.log('Raw API response:', content);
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('Cleaned content:', content);
    
    // Try to parse, if fails return default
    try {
      const parsed = JSON.parse(content);
      console.log('Successfully parsed:', parsed);
      return new Response(
        JSON.stringify(parsed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse response:', content);
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
