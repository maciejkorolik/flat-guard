# Hackathon — Next.js + Supabase (auth template)

Minimal starter for building quickly: **sign-in** (Google OAuth and email/password) and an **empty authenticated app**. Everything under `/` is protected except `/auth/*`.

## Raw Scraping Workstream

This repo now also contains the first raw-ingest path for flat-rental sourcing in Poland.

Current scope:

- raw acquisition only
- first source: OLX Wroclaw rental listings
- Supabase/Postgres raw storage with strong typing
- no normalization and no transformation logic in this branch

Primary handoff files:

- [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md) — source-agnostic raw contract for future crawlers
- [subagent-scraping.md](/Users/bruno/Desktop/work/hackathon/subagent-scraping.md) — working method and operational notes
- [docs/subagent-scraping.md](/Users/bruno/Desktop/work/hackathon/docs/subagent-scraping.md) — concise crawler runbook
- [20260328123500_raw_ingest.sql](/Users/bruno/Desktop/work/hackathon/supabase/migrations/20260328123500_raw_ingest.sql) — typed raw-ingest schema
- [20260328134500_raw_ingest_detail_fields.sql](/Users/bruno/Desktop/work/hackathon/supabase/migrations/20260328134500_raw_ingest_detail_fields.sql) — detail-page field extensions for the raw listing table
- [load_olx_raw_jsonl.sql](/Users/bruno/Desktop/work/hackathon/supabase/sql/load_olx_raw_jsonl.sql) — JSONL-to-Postgres loader
- [crawl-olx-wroclaw-raw.mjs](/Users/bruno/Desktop/work/hackathon/scripts/crawl-olx-wroclaw-raw.mjs) — OLX Wroclaw raw crawler

## Enrichment Workstream

This branch also adds a Google-backed enrichment runner for raw listings.

Current scope:

- strict geocoding from `street + district + city`
- short-horizon weather snapshot
- short-horizon air-quality snapshot
- conservative sunlight estimate with confidence and reasons
- nearest lifestyle places ranked by walking time
- baseline proximity categories: park, grocery, library
- curated extra categories: gym, climbing
- optional free-text custom categories

What the enrichment runner actually does:

1. Reads raw OLX listings either from checked-in JSONL or from `raw_rental_listings` in Supabase.
2. Builds a strict geocode query from `street + district + city`.
3. Resolves coordinates with Google Geocoding or marks the row as `insufficient_input`, `zero_results`, or `failed`.
4. Fetches short-horizon weather and air-quality snapshots for successfully geocoded listings.
5. Builds a conservative sunlight estimate from location context, Google solar data, and listing text hints. This is an estimate for how sunny the area and listing may feel, not a factual flat orientation.
6. Finds the closest lifestyle places for baseline and user-requested categories by combining Google Places candidate search with walking-time ranking from Google Routes.
7. Persists run-level and listing-level enrichment records to Supabase and can also emit JSONL, CSV, and metadata artifacts under `data/enriched/`.

Stored outputs:

- `enrichment_runs` records batch metadata, requested categories, counts, and run status.
- `listing_enrichments` stores geocode, weather, air quality, and sunlight results per listing.
- `listing_proximity_matches` stores the best winning place per category, ranked by walking travel time.
- `data/enriched/*.jsonl`, `*.csv`, and `*.meta.json` provide local inspection/export artifacts when file writes are enabled.

Current limitations:

- no long-term rainfall climatology or annual pollution history yet
- no precise apartment-facing orientation unless explicitly stated in the source listing
- no transit-aware or bike-accessibility scoring yet
- no route-level ranking or meetup-area optimization yet; this work is listing-level enrichment only

Primary files:

- [20260328153000_listing_enrichments.sql](/Users/bruno/Desktop/work/hackathon/supabase/migrations/20260328153000_listing_enrichments.sql) — enrichment tables
- [enrich-rental-listings-google.mjs](/Users/bruno/Desktop/work/hackathon/scripts/enrich-rental-listings-google.mjs) — file/DB enrichment CLI
- [data/enriched/README.md](/Users/bruno/Desktop/work/hackathon/data/enriched/README.md) — local output contract

Run the sample file locally:

```bash
pnpm enrich:sample -- --skip-db-writes
```

The enrichment CLI auto-loads `.env.local` and `.env` from the current worktree and parent directories, so a repo-root `/Users/bruno/Desktop/work/hackathon/.env.local` is picked up from this `.dmux/worktrees/...` checkout.

Run against DB rows for one ingest run:

```bash
node scripts/enrich-rental-listings-google.mjs --ingest-run-id <uuid> --category gym
```

Environment required for enrichment:

- `GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` when reading from or writing to Supabase

Google Cloud setup required for enrichment:

- enable `Geocoding API`
- enable `Places API`
- enable `Routes API`
- enable `Weather API`
- enable `Air Quality API`
- enable `Solar API`

## Layouts

| Area     | Path                         | Purpose                                                                           |
| -------- | ---------------------------- | --------------------------------------------------------------------------------- |
| **Auth** | `app/(auth)/layout.tsx`      | Wraps all `/auth/*` routes — centered, branded shell for login and related flows. |
| **App**  | `app/(protected)/layout.tsx` | Wraps the main app — checks the session and shows a minimal header with sign out. |

URLs are unchanged by the parentheses: `(auth)` and `(protected)` are [route groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups).

## Routes

- **`/`** — Protected home (placeholder copy only; replace with your UI).
- **`/auth/login`** — Google + email/password.
- **`/auth/sign-up`**, **`/auth/forgot-password`**, **`/auth/update-password`**, **`/auth/sign-up-success`**, **`/auth/error`** — Email flows.
- **`/auth/callback`** — OAuth code exchange (Google).
- **`/auth/confirm`** — Email OTP / magic-link verification.

Session refresh and redirects are handled in `proxy.ts` (Next.js proxy / middleware) plus `lib/supabase/proxy.ts`.

## Setup

1. Create a [Supabase](https://supabase.com/dashboard) project.

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from **Project Settings → API** (publishable or anon key both work with this variable name).

3. **Google sign-in** (optional): In the Supabase dashboard, open **Authentication → Sign In / Providers → Google**, enable it, and add these **Redirect URLs** (adjust for production):
   - `http://localhost:3000/auth/callback`
   - `https://<your-production-domain>/auth/callback`

4. Install and run:

   ```bash
   pnpm install
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) — you should be redirected to `/auth/login` until signed in.

## Where to build

- Add protected pages under `app/(protected)/` (e.g. `app/(protected)/dashboard/page.tsx` → `/dashboard`).
- Keep auth-only UI under `app/(auth)/auth/`.
- Shared forms live in `components/` (`login-form.tsx`, `sign-up-form.tsx`, etc.).

## Stack

Next.js (App Router), Supabase Auth with `@supabase/ssr`, Tailwind CSS, shadcn-style UI primitives in `components/ui/`.
