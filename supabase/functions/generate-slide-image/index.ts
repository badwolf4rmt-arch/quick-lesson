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
    const { prompt, style } = await req.json();
    
    console.log('Generating image:', { prompt, style });

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    // Формируем финальный промпт с учетом стиля
    const styleDescriptions = {
      'минимализм': 'fairy tale style, warm and colorful in the manner of Thomas Kinkade, cozy glowing lights, magical atmosphere, dreamy enchanted feeling, vibrant warm colors, soft illumination',
      'скетч': 'light watercolor and marker style, soft pastel colors, gentle brushstrokes, airy and pleasant atmosphere, delicate ink lines, luminous watercolor washes, bright and cheerful artistic quality',
      'реализм': 'photorealistic, no artifacts, extremely high detail, crystal clear, sharp focus, natural accurate lighting, true-to-life rendering, professional photography quality',
      'комикс': 'comic book style with visual metaphors, bold vibrant colors, dynamic composition, strong outlines, expressive symbolic imagery, pop art energy, graphic novel aesthetic',
      '3D-мультфильм': 'Pixar style 3D animation, highly colorful and vibrant, volumetric depth, soft rounded shapes, glossy materials, cinematic lighting, playful detailed rendering'
    };

    const styleModifier = styleDescriptions[style as keyof typeof styleDescriptions] || 'educational, clean, modern';
    const finalPrompt = `${prompt}. Style: ${styleModifier}. Educational illustration. High quality. STRICT REQUIREMENTS: Generate strictly in 16:9 aspect ratio (widescreen, horizontal landscape orientation, 1920x1080 proportions). The composition MUST fully fit within the 16:9 frame — do NOT crop, cut off, or truncate any subject, object, or important element. All key elements must be entirely visible inside the frame with comfortable margins. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO CAPTIONS, NO LABELS, NO WATERMARKS, NO SIGNATURES anywhere on the image. Pure visual content only: icons, shapes, diagrams, illustrations, symbols, scenes. Focus on visual metaphors and imagery.`;


    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Presentation Generator'
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image',
        messages: [
          {
            role: 'user',
            content: finalPrompt
          }
        ],
        modalities: ['image', 'text'],
        image_config: {
          aspect_ratio: '16:9'
        }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов на генерацию изображений.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Недостаточно средств для генерации изображения.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI image API error:', response.status, errorText);
      throw new Error('Failed to generate image');
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid AI response structure:', JSON.stringify(data));
      throw new Error('Invalid response from AI');
    }
    
    const imageUrl = data.choices[0].message.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('No image URL in response:', JSON.stringify(data.choices[0].message));
      throw new Error('No image generated');
    }

    console.log('Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-slide-image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
