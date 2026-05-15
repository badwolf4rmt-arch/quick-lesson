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

function normalizeQuery(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_+]+/g, ' ')
    .replace(/["'`«»“”()\[\]{}:;!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const q of queries) {
    const clean = normalizeQuery(q);
    if (clean.length < 2 || clean.length > 90) continue;
    const key = clean.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }

  return result.slice(0, 8);
}

function extractFallbackQueries(slideTitle: string, slideContent: string, topic: string): string[] {
  const lines = `${slideTitle}\n${slideContent}`
    .split(/[\n•✓📌⚡;,.!?]+/)
    .map((line) => normalizeQuery(line))
    .filter((line) => line.length >= 3 && line.length <= 64);

  const properNames = Array.from(
    new Set(
      `${slideTitle} ${slideContent}`
        .match(/[А-ЯЁ][а-яё]{3,}(?:\s+[А-ЯЁ][а-яё]{3,})?|[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,})?/g) || []
    )
  ).slice(0, 4);

  return uniqueQueries([
    topic,
    `${topic} ${slideTitle}`,
    ...properNames.map((name) => `${topic} ${name}`),
    ...properNames,
    ...lines.slice(0, 4).map((line) => `${topic} ${line}`),
  ]);
}

async function getSearchQueries(slideTitle: string, slideContent: string, topic: string, subject: string): Promise<string[]> {
  const fallbackQueries = extractFallbackQueries(slideTitle, slideContent, topic);
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) return fallbackQueries;

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
        max_tokens: 300,
        reasoning: { effort: 'minimal' },
        messages: [
          {
            role: 'user',
            content: `Сгенерируй 5 коротких поисковых запросов для картинок к слайду образовательной презентации.
Предмет: ${subject}
Тема презентации: ${topic}
Заголовок слайда: ${slideTitle}
Содержимое слайда: ${slideContent.slice(0, 700)}

Правила:
- первый запрос — широкий и надежный по теме слайда;
- остальные — отдельные конкретные объекты/места/явления, НЕ склеивай разные объекты в один запрос;
- 2–4 слова в каждом запросе;
- преимущественно английский, но русские географические/исторические названия можно оставить;
- запросы должны искать фотографии/иллюстрации, а не текст;
- ВАЖНО: запросы должны быть безопасными для детей школьного возраста. Запрещено: алкоголь, сигареты, наркотики, оружие, насилие, кровь, трупы, маньяки/преступники/диктаторы (Чикатило, Гитлер и т.п.), эротика/нагота, азартные игры. Если тема может выдать такие результаты — добавляй уточнения ("school", "education", "kids friendly", "illustration", "diagram", "cartoon").

Верни СТРОГО JSON: {"queries":["query one","query two","query three","query four","query five"]}`,
          },
        ],
      }),
    });
    const data = await resp.json();
    let content = data?.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(content);
    const queries = Array.isArray(parsed?.queries) ? parsed.queries : [];
    const normalized = uniqueQueries([...queries, ...fallbackQueries]);
    if (normalized.length > 0) return normalized;
  } catch (e) {
    console.error('Keywords generation failed:', e);
  }

  return fallbackQueries;
}
// Blocklist of unsafe / adult / disturbing terms (RU + EN). Applied to titles, URLs, queries.
const UNSAFE_TERMS = [
  // sexual / nudity
  'nude', 'naked', 'nsfw', 'porn', 'porno', 'erotic', 'erotica', 'sex', 'sexy', 'xxx', 'fetish', 'lingerie', 'topless', 'bikini', 'boobs', 'breast', 'genital', 'penis', 'vagina', 'orgasm', 'escort', 'prostitut', 'hooker', 'strip', 'bdsm',
  'голая', 'голый', 'голые', 'обнаж', 'эрот', 'порно', 'секс', 'интим', 'проститут', 'нагот', 'белье', 'нижнее бель',
  // violence / weapons / gore / death
  'gore', 'blood', 'bloody', 'corpse', 'dead body', 'murder', 'murderer', 'killer', 'serial killer', 'execution', 'massacre', 'torture', 'suicide', 'hanging', 'lynch', 'mutilat', 'autopsy', 'morgue', 'isis', 'terror', 'terrorist', 'beheading', 'gun', 'pistol', 'rifle', 'firearm', 'shooting', 'gunshot',
  'труп', 'убийство', 'убийца', 'маньяк', 'казнь', 'расстрел', 'кровь', 'кровав', 'самоубийс', 'повешен', 'теракт', 'террорист', 'оружие', 'пистолет',
  // notorious criminals / dictators sometimes triggered by random queries
  'chikatilo', 'чикатило', 'битцевский', 'breivik', 'брейвик', 'gacy', 'manson', 'pedo', 'педофил',
  // drugs / alcohol / smoking
  'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'marijuana', 'cannabis', 'weed', 'syringe', 'overdose',
  'beer', 'wine', 'vodka', 'whiskey', 'whisky', 'cocktail', 'alcohol', 'drunk', 'drinking', 'bar party', 'pub',
  'cigar', 'cigarette', 'smoking', 'tobacco', 'vape',
  'наркотик', 'кокаин', 'героин', 'марихуан', 'каннабис', 'шприц',
  'пиво', 'вино', 'водка', 'виски', 'коктейль', 'алкоголь', 'пьян', 'пьющ', 'выпив',
  'сигарет', 'сигар', 'курени', 'табак', 'вейп',
  // hate / racism
  'nazi', 'swastika', 'racist', 'hitler', 'фашис', 'нацис', 'свастик', 'гитлер',
  // misc adult themes
  'casino', 'gambling', 'казино', 'азарт',
];

function isUnsafeText(text: string): boolean {
  if (!text) return false;
  const t = text.toLocaleLowerCase();
  return UNSAFE_TERMS.some((term) => t.includes(term));
}

function filterSafeImages(images: ImageResult[]): ImageResult[] {
  return images.filter((img) => {
    const haystack = `${img.title || ''} ${img.url || ''} ${img.sourceUrl || ''}`;
    return !isUnsafeText(haystack);
  });
}

async function searchOpenverse(query: string): Promise<ImageResult[]> {
  if (isUnsafeText(query)) return [];
  // mature=false hides adult content; filter_dead removes broken links
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=12&license_type=all&mature=false&filter_dead=true`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'QuickLesson/1.0 (educational presentations)' },
  });
  if (!resp.ok) {
    console.error('Openverse error:', resp.status, await resp.text());
    return [];
  }
  const data = await resp.json();
  return (data.results || []).map((item: any) => ({
    url: item.url,
    thumbnail: item.thumbnail || item.url,
    title: item.title || '',
    source: item.source || item.provider || 'openverse',
    sourceUrl: item.foreign_landing_url,
  }));
}

async function searchWikimedia(query: string): Promise<ImageResult[]> {
  if (isUnsafeText(query)) return [];
  // Search Wikimedia Commons for image files
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=24&gsrsearch=${encodeURIComponent(
    query
  )}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&origin=*`;
  const resp = await fetch(searchUrl, {
    headers: { 'User-Agent': 'QuickLesson/1.0 (educational presentations)' },
  });
  if (!resp.ok) {
    console.error('Wikimedia error:', resp.status, await resp.text());
    return [];
  }
  const data = await resp.json();
  const pages = data?.query?.pages || {};
  const results: ImageResult[] = [];
  for (const key of Object.keys(pages)) {
    const p = pages[key];
    const info = p?.imageinfo?.[0];
    if (!info) continue;
    const url = info.url;
    if (!url) continue;
    const lower = url.toLowerCase();
    if (!/\.(jpe?g|png|gif|webp)$/.test(lower)) continue;
    results.push({
      url,
      thumbnail: info.thumburl || url,
      title: (p.title || '').replace(/^File:/, ''),
      source: 'Wikimedia Commons',
      sourceUrl: info.descriptionurl,
    });
  }
  return results;
}

async function searchWikipedia(query: string, lang: 'ru' | 'en'): Promise<ImageResult[]> {
  if (isUnsafeText(query)) return [];
  const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=8&gsrsearch=${encodeURIComponent(
    query
  )}&prop=pageimages|info&pithumbsize=900&pilicense=any&inprop=url&origin=*`;
  const resp = await fetch(apiUrl, {
    headers: { 'User-Agent': 'QuickLesson/1.0 (educational presentations)' },
  });
  if (!resp.ok) {
    console.error('Wikipedia error:', lang, resp.status, await resp.text());
    return [];
  }

  const data = await resp.json();
  const pages = Object.values(data?.query?.pages || {}) as any[];
  return pages
    .filter((p) => p?.thumbnail?.source)
    .map((p) => ({
      url: p.thumbnail.source,
      thumbnail: p.thumbnail.source,
      title: p.title || '',
      source: `${lang}.wikipedia.org`,
      sourceUrl: p.fullurl,
    }));
}

function mergeImages(groups: ImageResult[][]): ImageResult[] {
  const seen = new Set<string>();
  const merged: ImageResult[] = [];
  const max = Math.max(0, ...groups.map((group) => group.length));

  for (let i = 0; i < max; i++) {
    for (const group of groups) {
      const image = group[i];
      if (!image?.url) continue;
      const key = (image.url || image.sourceUrl || image.title).toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(image);
    }
  }

  return merged.slice(0, 36);
}

async function searchAllSources(query: string): Promise<ImageResult[]> {
  const [openverse, wikimedia, wikipediaRu, wikipediaEn] = await Promise.all([
    searchOpenverse(query).catch(() => []),
    searchWikimedia(query).catch(() => []),
    searchWikipedia(query, 'ru').catch(() => []),
    searchWikipedia(query, 'en').catch(() => []),
  ]);

  return filterSafeImages(mergeImages([openverse, wikimedia, wikipediaRu, wikipediaEn]));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slideTitle = '', slideContent = '', topic = '', subject = '', customQuery } = await req.json();

    const queries = customQuery && String(customQuery).trim()
      ? uniqueQueries([String(customQuery), ...extractFallbackQueries(slideTitle, slideContent, topic)])
      : await getSearchQueries(slideTitle, slideContent, topic, subject);

    const searchResults = await Promise.all(queries.map((query) => searchAllSources(query)));
    const images = filterSafeImages(mergeImages(searchResults));
    const query = queries.slice(0, 5).join(' · ');

    return new Response(
      JSON.stringify({ query, queries, images }),
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
