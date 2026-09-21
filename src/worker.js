const API_BASE = "https://api.kingshotstats.com/v1";

// Rate limiting for /api/player: 30 requests per 60 seconds per IP.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_HITS = 30;

// Upstream fetch timeout.
const UPSTREAM_TIMEOUT_MS = 10_000;

// In-memory buckets keyed by IP, shared within a Worker isolate.
// Good enough for a single-player dashboard; swap for KV if you need
// a fleet-wide limit.
const rateBuckets = new Map();

function rateLimited(ip) {
  if (!ip) return { allowed: true, retryAfter: 0 };
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_HITS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    }
  });
}

// Generic messages only — never leak upstream error details to the client.
const RATE_LIMIT_ERROR = {
  ok: false,
  error: "Too many requests. Please slow down and try again.",
};
const TIMEOUT_ERROR = {
  ok: false,
  error: "Player data took too long to load. Please try again.",
};
const UPSTREAM_ERROR = {
  ok: false,
  error: "Something went wrong while fetching player data. Please try again later.",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/player") {
      if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
      if (!env.KINGSHOT_STATS_API_KEY) {
        return json({ ok: false, error: "Server secret KINGSHOT_STATS_API_KEY is not configured." }, 500);
      }

      // 30 requests per minute per IP -> 429 + Retry-After.
      const rate = rateLimited(request.ip || request.headers.get("cf-ip") || "unknown");
      if (!rate.allowed) {
        return json(RATE_LIMIT_ERROR, 429, { "retry-after": String(rate.retryAfter) });
      }

      const id = (url.searchParams.get("id") || "").trim();
      const idType = (url.searchParams.get("id_type") || "governor_id").trim();

      if (!/^\d+$/.test(id)) return json({ ok: false, error: "Player ID must be numeric." }, 400);
      if (!["governor_id", "uid"].includes(idType)) {
        return json({ ok: false, error: "Invalid id_type." }, 400);
      }

      const upstream = new URL(`${API_BASE}/players/${encodeURIComponent(id)}`);
      upstream.searchParams.set("id_type", idType);
      upstream.searchParams.set("include", "base,heroes,ranks,gov_gear");

      try {
        const response = await fetch(upstream, {
          headers: {
            "Authorization": `Bearer ${env.KINGSHOT_STATS_API_KEY}`,
            "Accept": "application/json"
          },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
        });
        const text = await response.text();
        return new Response(text, {
          status: response.status,
          headers: {
            "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff"
          }
        });
      } catch (error) {
        const status = error.name === "AbortError" ? 504 : 502;
        const message = status === 504 ? TIMEOUT_ERROR : UPSTREAM_ERROR;
        return json(message, status);
      }
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, configured: Boolean(env.KINGSHOT_STATS_API_KEY) });
    }

    return env.ASSETS.fetch(request);
  }
};
