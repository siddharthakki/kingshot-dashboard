# My Kingshot Dashboard

A mobile-first Kingshot player dashboard backed by the Kingshot Stats API.

## What it shows

- Governor/FID and internal UID
- Nickname, kingdom, TC, power, VIP, kills, coordinates
- Alliance and rank
- Arena defence heroes
- Kingdom rankings
- Governor gear
- Raw API response for future analysis

## Architecture

The browser never sees the Kingshot Stats API key.

`Mobile browser -> Cloudflare Worker /api/player -> api.kingshotstats.com`

The same Worker serves the static frontend from `public/`, so no CORS configuration is required between the page and the proxy.

## API behavior

`/api/player` is hardened as a public proxy endpoint:

- **Rate limiting** — 30 requests per minute per IP. When the limit is hit the Worker returns `429` with a `Retry-After` header. Limits are tracked in-memory per Worker isolate (fine for a single-player dashboard; move to KV if you ever need a fleet-wide limit).
- **Timeout** — upstream requests to `api.kingshotstats.com` are aborted after 10 seconds and answered with `504`.
- **Generic errors** — any failure is returned as a short, non-specific message (`504` on timeout, `502` on any other upstream failure). Raw upstream errors and stack details are never sent to the client.

## Deploy

1. Create a Kingshot Stats API key at https://api.kingshotstats.com/
2. Install dependencies: `npm install`
3. Authenticate Wrangler: `npx wrangler login`
4. Add the secret: `npx wrangler secret put KINGSHOT_STATS_API_KEY`
5. Deploy: `npm run deploy`

Wrangler will print the `*.workers.dev` URL. Open that URL on Android and use Chrome's **Add to Home screen** if you want it to behave like an app.

## Local development

Create `.dev.vars` containing:

`KINGSHOT_STATS_API_KEY=kss_your_key_here`

Then run:

`npm install`

`npm run dev`

Never commit `.dev.vars` or your API key.
