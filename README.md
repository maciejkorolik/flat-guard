# Hackathon — Next.js + Supabase (auth template)

Minimal starter for building quickly: **sign-in** (Google OAuth and email/password) and an **empty authenticated app**. Everything under `/` is protected except `/auth/*`.

## Raw Scraping Workstream

This repo now also contains the first raw-ingest path for flat-rental sourcing in Poland.

Current scope:

- raw acquisition only
- first source: OLX Wroclaw rental listings
- local Postgres raw storage with strong typing
- no normalization and no transformation logic in this branch

Primary handoff files:

- [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md) — source-agnostic raw contract for future crawlers
- [subagent-scraping.md](/Users/bruno/Desktop/work/hackathon/subagent-scraping.md) — working method and operational notes
- [docs/subagent-scraping.md](/Users/bruno/Desktop/work/hackathon/docs/subagent-scraping.md) — concise crawler runbook
- [20260328123500_raw_ingest.sql](/Users/bruno/Desktop/work/hackathon/supabase/migrations/20260328123500_raw_ingest.sql) — typed raw-ingest schema
- [load_olx_raw_jsonl.sql](/Users/bruno/Desktop/work/hackathon/supabase/sql/load_olx_raw_jsonl.sql) — JSONL-to-Postgres loader
- [raw-listings-upload.md](/Users/bruno/Desktop/work/hackathon/.dmux/worktrees/dmux-1774705289774/docs/raw-listings-upload.md) — service-key uploader for `public.listings_raw`
- [crawl-olx-wroclaw-raw.mjs](/Users/bruno/Desktop/work/hackathon/scripts/crawl-olx-wroclaw-raw.mjs) — OLX Wroclaw raw crawler

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
