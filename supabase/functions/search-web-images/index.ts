import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageResult {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  sourceUrl?: string;
}

async function getKeywords(slideTitle: string, slideContent: string, topic: string, subject: string): Promise<string> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) return `${topic} ${slideTitle}`;

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Image Search Keywords',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        max_tokens: 200,
        reasoning: { effort: 'minimal' },
        messages: [
          {
            role: 'user',
            content: `Сгенерируй 3 ключевых слова на АНГЛИЙСКОМ для поиска картинок к слайду образовательной презентации.
Предмет: ${subject}
Тема презентации: ${topic}
Заголовок слайда: ${slideTitle}
Содержимое слайда: ${slideContent.slice(0, 400)}

Верни СТРОГО JSON: {"keywords": "word1 word2 word3"} — три простых конкретных существительных через пробел, без знаков препинания, на английском.`,
          },
        ],
      }),
    });
    const data = await resp.json();
    let content = data?.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(content);
    if (parsed.keywords && typeof parsed.keywords === 'string') return parsed.keywords;
  } catch (e) {
    console.error('Keywords generation failed:', e);
  }
  return `${topic} ${slideTitle}`;
}

async function searchOpenverse(query: string): Promise<ImageResult[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=24&license_type=all`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'QuickLesson/1.0 (educational presentations)' },
  });
  if (!resp.ok) {
    console.error('Openverse error:', resp.status, await resp.text());
    return [];
  }
  const data = await resp.json();
  const results: ImageResult[] = (data.results || []).map((item: any) => ({
    url: item.url,
    thumbnail: item.thumbnail || item.url,
    title: item.title || '',
    source: item.source || item.provider || 'openverse',
    sourceUrl: item.foreign_landing_url,
  }));
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slideTitle = '', slideContent = '', topic = '', subject = '', customQuery } = await req.json();

    const query = (customQuery && String(customQuery).trim())
      || await getKeywords(slideTitle, slideContent, topic, subject);

    const images = await searchOpenverse(query);

    return new Response(
      JSON.stringify({ query, images }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in search-web-images:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error', images: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
