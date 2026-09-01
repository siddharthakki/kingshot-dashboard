const API_BASE = "https://api.kingshotstats.com/v1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/player") {
      if (request.method !== "GET") return json({ ok:false, error:"Method not allowed" }, 405);
      if (!env.KINGSHOT_STATS_API_KEY) return json({ ok:false, error:"Server secret KINGSHOT_STATS_API_KEY is not configured." }, 500);

      const id = (url.searchParams.get("id") || "").trim();
      const idType = (url.searchParams.get("id_type") || "governor_id").trim();

      if (!/^\d+$/.test(id)) return json({ ok:false, error:"Player ID must be numeric." }, 400);
      if (!["governor_id", "uid"].includes(idType)) return json({ ok:false, error:"Invalid id_type." }, 400);

      const upstream = new URL(`${API_BASE}/players/${encodeURIComponent(id)}`);
      upstream.searchParams.set("id_type", idType);
      upstream.searchParams.set("include", "base,heroes,ranks,gov_gear");

      try {
        const response = await fetch(upstream, {
          headers: {
            "Authorization": `Bearer ${env.KINGSHOT_STATS_API_KEY}`,
            "Accept": "application/json"
          }
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
        return json({ ok:false, error:`Upstream request failed: ${error.message}` }, 502);
      }
    }

    if (url.pathname === "/api/health") {
      return json({ ok:true, configured:Boolean(env.KINGSHOT_STATS_API_KEY) });
    }

    return env.ASSETS.fetch(request);
  }
};
