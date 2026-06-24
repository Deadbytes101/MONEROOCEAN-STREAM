const API_ORIGIN = "https://api.moneroocean.stream/";
const UPTIME_ORIGIN = "https://stats.uptimerobot.com/api/getMonitorList/BrD44hEJx";
const USD_THB_ORIGIN = "https://api.frankfurter.app/latest?from=USD&to=THB";
const API_CACHE_SECONDS = 20;
const FX_CACHE_SECONDS = 1800;
const STATIC_CACHE_SECONDS = 604800;
const API_RE = /^\/api\//;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (API_RE.test(url.pathname)) {
      return relayApi(request, url, ctx);
    }

    const response = await env.ASSETS.fetch(request);
    return withStaticHeaders(response);
  }
};

async function relayApi(request, url, ctx) {
  if (!isAllowedMethod(request.method)) {
    return json({ error: "method not allowed" }, 405, 0);
  }

  const target = targetFor(url);
  if (!target) {
    return json({ error: "not found" }, 404, 0);
  }

  const cacheKey = new Request(target.toString(), { method: "GET" });
  const canCache = request.method === "GET";
  const cache = caches.default;
  const maxAge = cacheSecondsFor(url);

  if (canCache) {
    const cached = await cache.match(cacheKey);
    if (cached) return withApiHeaders(cached, true);
  }

  const upstream = await fetch(target, upstreamInit(request));
  const body = await upstream.arrayBuffer();
  const response = new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstreamHeaders(upstream, canCache ? maxAge : 0)
  });

  if (canCache && upstream.ok) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return withApiHeaders(response, false);
}

function targetFor(url) {
  if (url.pathname === "/api/uptime/status") return new URL(UPTIME_ORIGIN);
  if (url.pathname === "/api/fx/usd-thb") return new URL(USD_THB_ORIGIN);

  const path = url.pathname.replace(/^\/api\//, "");
  if (!path || path.includes("..")) return null;

  const target = new URL(path, API_ORIGIN);
  target.search = url.search;
  return target;
}

function cacheSecondsFor(url) {
  return url.pathname.startsWith("/api/fx/") ? FX_CACHE_SECONDS : API_CACHE_SECONDS;
}

function upstreamInit(request) {
  const headers = new Headers(request.headers);
  headers.set("accept", "application/json");
  headers.delete("host");
  headers.delete("origin");
  headers.delete("referer");
  headers.delete("cookie");

  return {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow"
  };
}

function upstreamHeaders(upstream, maxAge) {
  const headers = new Headers();
  const type = upstream.headers.get("content-type") || "application/json; charset=utf-8";
  headers.set("content-type", type);
  headers.set("cache-control", maxAge ? `public, max-age=${maxAge}, stale-while-revalidate=600` : "no-store");
  return headers;
}

function withApiHeaders(response, cached) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,HEAD,POST,OPTIONS");
  headers.set("access-control-allow-headers", "accept,content-type");
  headers.set("x-relay-cache", cached ? "hit" : "miss");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function withStaticHeaders(response) {
  const headers = new Headers(response.headers);
  const type = headers.get("content-type") || "";
  if (type.includes("text/html")) {
    headers.set("cache-control", "no-cache");
  } else {
    headers.set("cache-control", `public, max-age=${STATIC_CACHE_SECONDS}, immutable`);
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function isAllowedMethod(method) {
  return method === "GET" || method === "HEAD" || method === "POST" || method === "OPTIONS";
}

function json(value, status, maxAge) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store"
    }
  });
}
