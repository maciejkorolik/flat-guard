# FlatGuard Scraper — migration from n8n to TypeScript

## Task
Rewrite the n8n scraper workflow as a standalone TypeScript module
that can be called as a background job from our Next.js app.

## Tech stack
- TypeScript (strict)
- Firecrawl SDK: `@mendable/firecrawl-js`
- Supabase JS client: `@supabase/supabase-js`
- p-limit for concurrency control
- dotenv for secrets

## Output contract — Supabase table: listings_raw
Fields: source (text), external_id (text), raw_data (jsonb), scraped_at (timestamptz)
Unique constraint: (source, external_id) — use upsert on conflict do nothing

## Sources to scrape
### OLX
- Base URL: https://www.olx.pl/nieruchomosci/mieszkania/wynajem/warszawa/
- Pagination: ?page=N, pages 1–20
- Link regex: \(https://www\.olx\.pl\/d\/oferta\/([^)]+)\)
- ExternalId: -ID([A-Za-z0-9]+)\.html$

### Otodom
- Base URL: https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/mazowieckie/warszawa/warszawa/warszawa
- Pagination: ?page=N, pages 1–15
- Link regex: \(https://www\.otodom\.pl\/pl\/oferta\/([^\)\s]+)\)
- ExternalId: -ID(\d+)$

### Gratka
- Base URL: https://gratka.pl/nieruchomosci/mieszkania/warszawa/wynajem
- Pagination: ?page=N, pages 1–3
- Link regex: /nieruchomosci/[^)\s]+?/(oi|ob)/(\d+)
- ExternalId: numeric segment after /oi/ or /ob/

### Morizon
- Base URL: https://www.morizon.pl/do-wynajecia/mieszkania/warszawa/
- Pagination: ?page=N, pages 1–3

### Domiporta
- Base URL: https://www.domiporta.pl/wynajem/mieszkania/warszawa/
- Pagination: similar

## Behavior
- Skip listings without markdown or externalId (log, don't throw)
- On Supabase upsert conflict — skip silently (DO NOTHING)
- Concurrency: max 3 concurrent Firecrawl requests per source
- Each source runs independently (Promise.allSettled at top level)
- Expose a single async function: `runScraper(sources?: string[])`
```

---

### Krok 2 — Prompt startowy dla Claude Code

Uruchom `claude` w katalogu repo i daj mu ten prompt:
```
Read scraper/SCRAPER_CONTEXT.md and the n8n workflow export at scraper/FlatGuard___Scraper.json.

Create scraper/src/index.ts with a runScraper() function that implements all 5 source pipelines.
Structure:
- scraper/src/sources/ — one file per source (olx.ts, otodom.ts, gratka.ts, morizon.ts, domiporta.ts)
- scraper/src/lib/firecrawl.ts — Firecrawl client wrapper with retry (3x, exponential backoff)
- scraper/src/lib/supabase.ts — upsert helper for listings_raw
- scraper/src/lib/parse.ts — shared link extraction utilities
- scraper/src/index.ts — orchestrator, exports runScraper()
- scraper/package.json — with all deps
- scraper/.env.example

Each source module exports: { name, buildUrls, parseLinks, prepareRaw }
The orchestrator drives the loop: buildUrls → scrape pages → parseLinks → scrape details → prepareRaw → upsert.
Use p-limit(3) for detail scraping concurrency.
Use TypeScript strict mode.