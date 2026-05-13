import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Прокси Supabase через домен Render, чтобы обойти блокировки в РФ.
// На Render нужен rewrite: /sb/*  ->  https://fahrcihwemfxqlcprupu.supabase.co/*
(() => {
  if (typeof window === "undefined") return;

  const SUPABASE_HOST = "fahrcihwemfxqlcprupu.supabase.co";
  const host = window.location.hostname;

  // Включаем прокси только не на localhost и не на доменах самой Lovable
  // (там Supabase доступен напрямую). На любом другом домене (Render, кастомный) — проксируем.
  const isLovableOrLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.host");
  if (isLovableOrLocal) return;

  const proxyBase = `${window.location.origin}/sb`;
  const originalFetch = window.fetch.bind(window);

  const rewriteUrl = (url: string): string => {
    if (url.includes(SUPABASE_HOST)) {
      return url.replace(/https?:\/\/fahrcihwemfxqlcprupu\.supabase\.co/g, proxyBase);
    }
    return url;
  };

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (typeof input === "string") {
        return originalFetch(rewriteUrl(input), init);
      }
      if (input instanceof URL) {
        return originalFetch(rewriteUrl(input.toString()), init);
      }
      if (input instanceof Request && input.url.includes(SUPABASE_HOST)) {
        const newReq = new Request(rewriteUrl(input.url), input);
        return originalFetch(newReq, init);
      }
    } catch (e) {
      console.warn("[sb-proxy] fetch shim error:", e);
    }
    return originalFetch(input as any, init);
  }) as typeof window.fetch;

  // Проксируем и WebSocket (Supabase Realtime), на случай будущих фич
  const OriginalWS = window.WebSocket;
  if (OriginalWS) {
    const wsProxyBase = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/sb`;
    function PatchedWS(this: any, url: string | URL, protocols?: string | string[]) {
      const u = typeof url === "string" ? url : url.toString();
      const rewritten = u.includes(SUPABASE_HOST)
        ? u.replace(/wss?:\/\/fahrcihwemfxqlcprupu\.supabase\.co/g, wsProxyBase)
        : u;
      return new OriginalWS(rewritten, protocols);
    }
    PatchedWS.prototype = OriginalWS.prototype;
    (PatchedWS as any).CONNECTING = OriginalWS.CONNECTING;
    (PatchedWS as any).OPEN = OriginalWS.OPEN;
    (PatchedWS as any).CLOSING = OriginalWS.CLOSING;
    (PatchedWS as any).CLOSED = OriginalWS.CLOSED;
    (window as any).WebSocket = PatchedWS;
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
