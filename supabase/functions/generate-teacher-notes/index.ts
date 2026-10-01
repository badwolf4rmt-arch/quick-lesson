import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { subject, grade, topic, lessonPlan, slides } = body ?? {};
    if (!Array.isArray(slides) || slides.length === 0 || slides.length > 40) {
      return json({ error: 'slides: ожидается массив из 1–40 слайдов' }, 400);
    }
    const key = Deno.env.get('OPENROUTER_API_KEY');
    if (!key) throw new Error('OPENROUTER_API_KEY is not configured');

    const plan = clean(lessonPlan).slice(0, 30000);
    const slidesText = slides
      .map((s: any, i: number) => `Слайд ${i + 1}. ${clean(s?.title)}\n${clean(s?.content).slice(0, 1500)}`)
      .join('\n\n---\n\n');

    const systemPrompt = `Ты — опытный методист и учитель. Пишешь методические заметки для учителя к каждому слайду готовой презентации, по которым учитель ведёт урок без дополнительной подготовки.

Для каждого слайда верни объект с полями:
- "stage": название этапа урока и хронометраж в скобках, например «Актуализация знаний (4–5 мин)».
- "teacher": деятельность учителя — речь и действия в рекомендательной форме: «Объясните…», «Расскажите…», «Побудите…», «Предложите…», «Обратите внимание…». 2–4 предложения.
- "students": деятельность учащихся — что делают ученики (слушают, отвечают с места, записывают, работают в парах) и приём (фронтальная беседа, опрос, разбор у доски, взаимопроверка).
- "extra": дополнительно — только когда есть что сказать: типичная ошибка, правильный ответ к заданию, контрольный вопрос, связь с другим предметом. Иначе пустая строка.
- "transition": переход к следующему слайду — одна фраза-подводка, только если она нужна. Иначе пустая строка.

Требования:
1. Методическая корректность. Структура урока по ФГОС: организационный момент → актуализация знаний → целеполагание → изучение нового материала → первичное закрепление → самостоятельная работа с проверкой → рефлексия → домашнее задание. Хронометраж суммарно укладывается в 45 минут (40 для 1–4 классов).
2. Привязка к слайду. Заметка раскрывает именно этот слайд, а не тему в целом; текст слайда дословно не повторяй.
3. Деятельность учителя — рекомендация, а не жёсткий сценарий, обращение на «вы». Формулы проговаривай словами по-русски («корень из трёх», «НОД чисел 12 и 18») — без LaTeX, markdown и спецсимволов разметки.
4. Поля "extra" и "transition" не заполняй формально. На слайдах с заданиями в "extra" обязательно правильный ответ и типичная ошибка.
5. Грамотный русский язык. Объём заметки — до 100 слов.
${plan ? `6. ОПОРА НА ПЛАН УРОКА (главное):
   - названия и хронометраж этапов бери из плана дословно, в его порядке;
   - деятельность учителя и учащихся соответствует тому, что запланировано на этом этапе (если в плане «организует работу в парах» — так и пиши);
   - если план содержит конкретные задания, номера, примеры, ответы — используй их, не подменяя своими;
   - если этап плана не требует экрана и объединён с другим, заметка всё равно называет этап плана;
   - там, где презентация добавляет новое, которого нет в плане, в "extra" укажи, что это дополнение к плану.` : ''}

Верни строго JSON: {"notes":[{"stage":"","teacher":"","students":"","extra":"","transition":""}, ...]} — ровно ${slides.length} элементов, в порядке слайдов.`;

    const userPrompt = `Предмет: ${clean(subject)}\nКласс: ${clean(String(grade ?? ''))}\nТема: ${clean(topic)}\n${plan ? `\nПЛАН УРОКА:\n${plan}\n` : ''}\nСЛАЙДЫ ПРЕЗЕНТАЦИИ (${slides.length}):\n\n${slidesText}`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-5.6-luna',
        reasoning: { effort: 'minimal' },
        response_format: { type: 'json_object' },
        max_tokens: 12000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!resp.ok) {
      console.error('AI error', resp.status, await resp.text());
      return json({ error: 'Не удалось сгенерировать заметки' }, resp.status === 429 ? 429 : 500);
    }
    const data = await resp.json();
    const content = String(data?.choices?.[0]?.message?.content ?? '').replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(content);
    const items: any[] = Array.isArray(parsed?.notes) ? parsed.notes : [];

    const notes = slides.map((_: unknown, i: number) => {
      const n = items[i] ?? {};
      const blocks: Array<[string, string]> = [
        ['Этап', clean(n.stage)],
        ['Деятельность учителя', clean(n.teacher)],
        ['Деятельность учащихся', clean(n.students)],
        ['Дополнительно', clean(n.extra)],
        ['Переход к следующему слайду', clean(n.transition)],
      ];
      return blocks.filter(([, v]) => v).map(([h, v]) => `${h}\n${v}`).join('\n\n');
    });

    return json({ notes });
  } catch (e) {
    console.error('generate-teacher-notes error', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
