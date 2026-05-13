import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";

const PORT = Number(process.env.PORT || 10000);
const DIST_DIR = join(process.cwd(), "dist");
const SUPABASE_ORIGIN = "https://fahrcihwemfxqlcprupu.supabase.co";

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on("error", reject);
  });
}

function copyProxyHeaders(sourceHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(sourceHeaders)) {
    if (!value || hopByHopHeaders.has(key.toLowerCase()) || key.toLowerCase() === "host") continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

async function proxySupabase(req, res, url) {
  const targetUrl = `${SUPABASE_ORIGIN}${url.pathname.replace(/^\/sb/, "")}${url.search}`;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers: copyProxyHeaders(req.headers),
    body,
    duplex: body ? "half" : undefined,
    redirect: "manual",
  });

  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      res.setHeader(key, value);
    }
  });
  res.setHeader("Access-Control-Allow-Origin", "*");

  const responseBody = Buffer.from(await upstream.arrayBuffer());
  res.end(responseBody);
}

function resolveStaticFile(pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^([.][.][\/\\])+/, "");
  const requestedPath = join(DIST_DIR, safePath);

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) return requestedPath;
  return join(DIST_DIR, "index.html");
}

function serveStatic(req, res, url) {
  const filePath = resolveStaticFile(url.pathname);
  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Build output not found. Run npm run build first.");
    return;
  }

  res.setHeader("Content-Type", mimeTypes[extname(filePath)] || "application/octet-stream");
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/sb/")) {
      await proxySupabase(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    console.error("Server error:", error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Proxy server error" }));
  }
}).listen(PORT, () => {
  console.log(`Render server listening on port ${PORT}`);
});