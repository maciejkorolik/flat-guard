# FlatGuard — AI-assisted apartment search

**FlatGuard** is a hackathon project: an authenticated web app that helps people hunt for rentals in European cities (with a strong focus on Polish markets and PLN). Users capture preferences in a guided **Interview**, run **AI-scored search** against normalized listing data, explore results with a **Search Assistant** (tools + structured context), and curate a **Shortlist** with notes and a map.

## What it does

| Stage | Description |
| -------- | ----------- |
| **Interview** | Streaming chat with the “FlatGuard Curator” collects city, budget, rooms, commute, districts, must-haves, and move-in timing. Preferences are persisted to `search_profiles` via tool calls (no generic small talk — task-focused flow). |
| **Search** | **Run search** loads active rows from `listings_normalized`, filtered by the current profile (city, budget ceiling), then scores each listing with structured output (overall score, criterion breakdown, reasoning, recommendation). Enrichment in the DB (geocoding, weather, sunlight, air quality, etc.) is merged into scoring and chat context. |
| **Search chat** | Assistant answers comparisons and deep dives, can narrow results with tools, fetch per-listing enrichment, and **add listings to the shortlist** with markdown notes (including suggested landlord questions). |
| **Shortlist** | Saved listings with status, notes, and a **Leaflet** map for geocoded properties. |

**Dashboard** lists per-user **projects** from Supabase; each project has its own interview, search, and shortlist.

## Tech stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router), React 19, TypeScript  
- **Auth & data:** [Supabase](https://supabase.com/) (`@supabase/ssr`) — `projects`, `search_profiles`, `shortlist_entries`, `listings_normalized`, RLS in `supabase/migrations/`  
- **AI:** [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`, `@ai-sdk/openai`) — `streamText`, `generateObject`, tool calling, `generateImage` for project covers  
- **Models:** OpenAI `gpt-5.4-mini` (interview, scoring batch, search chat); `gpt-image-1.5` (optional project cover images)  
- **UI:** Tailwind CSS, shadcn-style primitives (`components/ui/`), Lucide icons  

## Prerequisites

1. A **Supabase** project with auth enabled (Google and/or email, same as typical SSR setup).  
2. **Database:** Apply migrations under `supabase/migrations/` so tables, RLS, and extensions match the app. The search pipeline expects a populated **`listings_normalized`** table (active listings); without it, “Run search” returns no results.  
3. An **OpenAI API key** with access to the models above.

## Environment variables

Copy the example file and fill in values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon / publishable key |
| `OPENAI_API_KEY` | Interview, search scoring, search chat, optional cover images |

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to `/auth/login`.

**Auth redirects (Supabase dashboard):** add `http://localhost:3000/auth/callback` (and your production URL) under Authentication → URL configuration / Google provider, as needed.

```bash
pnpm build   # production build
pnpm start   # run production server
pnpm lint    # ESLint
```

## App structure (high level)

- **`app/(auth)/`** — login, sign-up, password flows, OAuth callback  
- **`app/(protected)/dashboard`** — project grid  
- **`app/(protected)/project/[id]/`** — `interview`, `search`, `shortlist`  
- **`app/api/projects`** — list/create projects  
- **`app/api/interview/[projectId]`** — streaming interview + profile updates + cover generation  
- **`app/api/search/[projectId]/run`** — fetch listings, AI scoring  
- **`app/api/search/[projectId]/chat`** — search assistant with tools  
- **`app/api/search/[projectId]/listings`** — scored results for the UI  
- **`app/api/shortlist/[projectId]`** — shortlist CRUD  

Session handling lives in `proxy.ts` and `lib/supabase/`.

## Hackathon submission notes

- **Demo path:** sign in → create a project → complete (or partially complete) **Interview** → **Search** → **Run search** → use **Search** chat to compare listings and add one to **Shortlist** → open **Shortlist** and map.  
- **Data dependency:** judges need either your hosted Supabase with seed data or a short screen recording if listings are empty in a fresh clone.  
- **Optional:** add your team name, demo link, and video link in this section when you submit.

---

*Original scaffold: Next.js + Supabase auth template; extended into FlatGuard for the hackathon.*
