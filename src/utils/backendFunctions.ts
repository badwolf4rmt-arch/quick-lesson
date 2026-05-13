const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getFunctionsOrigin = () => {
  if (PROJECT_ID) {
    return `https://${PROJECT_ID}.functions.supabase.co`;
  }

  const hostname = new URL(SUPABASE_URL).hostname;
  const projectRef = hostname.split(".")[0];
  return `https://${projectRef}.functions.supabase.co`;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const doFetch = async (functionName: string, body: unknown, signal?: AbortSignal) => {
  return fetch(`${getFunctionsOrigin()}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });
};

export const invokeBackendFunction = async <T>(
  functionName: string,
  body: unknown,
  options?: { signal?: AbortSignal; retries?: number },
): Promise<T> => {
  const maxAttempts = (options?.retries ?? 2) + 1;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await doFetch(functionName, body, options?.signal);

      const text = await response.text();
      let payload: any = null;

      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error("Некорректный JSON-ответ от сервера");
        }
      }

      if (!response.ok) {
        // Не ретраим клиентские ошибки (4xx, кроме 408/429)
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          throw new Error(payload?.error || `Ошибка запроса (${response.status})`);
        }
        throw new Error(payload?.error || `Ошибка запроса (${response.status})`);
      }

      return payload as T;
    } catch (error: any) {
      lastError = error;

      // Не ретраим, если запрос отменён вручную
      if (error?.name === "AbortError") throw error;

      // Не ретраим клиентские ошибки
      if (error?.message?.match(/Ошибка запроса \(4\d\d\)/) && !error.message.match(/\(408\)|\(429\)/)) {
        throw error;
      }

      if (attempt < maxAttempts) {
        await sleep(1000 * attempt);
        continue;
      }
    }
  }

  throw lastError ?? new Error("Не удалось выполнить запрос");
};
