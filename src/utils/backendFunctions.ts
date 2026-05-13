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

export const invokeBackendFunction = async <T>(
  functionName: string,
  body: unknown,
  options?: { signal?: AbortSignal },
): Promise<T> => {
  const response = await fetch(`${getFunctionsOrigin()}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

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
    throw new Error(payload?.error || `Ошибка запроса (${response.status})`);
  }

  return payload as T;
};