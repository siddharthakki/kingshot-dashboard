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
