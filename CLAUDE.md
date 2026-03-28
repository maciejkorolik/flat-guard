# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev      # start dev server (localhost:3000)
pnpm build    # production build
pnpm lint     # ESLint
```

No test suite is configured. Validate logic manually against the test scenarios in `plan.md`.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY
```

## Architecture

FlatGuard is a Next.js 15 (App Router) + Supabase + AI rental search app. One `Project` represents one apartment hunt. Projects progress through three stages: **Interview → Search → Shortlist**.

**Core invariant:** The LLM never invents listing facts. It only extracts requirements, explains stored data, and compares listings backed by typed records from the DB.

### Route structure

```
app/(auth)/auth/…        # public auth flows (login, sign-up, OAuth callback)
app/(protected)/…        # session-gated app
  dashboard/             # project list
  project/[id]/
    interview/           # AI interview chat + profile panel
    search/              # scored listings + conversational follow-up
    shortlist/           # saved listings with notes
```

Route groups `(auth)` / `(protected)` don't affect URLs. Session refresh runs via `proxy.ts` (Next.js middleware) + `lib/supabase/proxy.ts`.

### API routes

| Route | Purpose |
|---|---|
| `POST /api/projects` | Create project |
| `POST /api/interview/[projectId]` | Streaming AI interview (`streamText` + `updateSearchProfile` tool → writes to `search_profiles`) |
| `POST /api/search/[projectId]/run` | Score up to 20 listings via SSE stream (`generateObject` per listing) |
| `POST /api/search/[projectId]/chat` | AI chat over search results (`streamText` + tools: `getListings`, `getListingDetails`, `addToShortlist`) |
| `GET/POST /api/search/[projectId]/listings` | Listings CRUD |
| `GET/POST/DELETE /api/shortlist/[projectId]` | Shortlist CRUD |

### AI integration

Uses **Vercel AI SDK** (`ai` package) with OpenAI. `@ai-sdk/google` is also installed but not default — only use it when explicitly requested.

- Interview: `streamText` with `updateSearchProfile` tool; each user turn may update `search_profiles` in Supabase. After the LLM collects a city, a cover image is generated in the background via `after()`.
- Search run: streams `ScoredListing` objects one-by-one as SSE (`data: …\n\n` / `data: [DONE]\n\n`). Each listing scored independently via `generateObject`.
- Search chat: receives `scoredListings` array in request body as context; LLM never queries DB for listing facts directly.

### Database

Tables: `projects`, `search_profiles`, `listings_normalized`, `shortlist_entries`. Migrations in `supabase/migrations/`. RLS enforced via `20260328_006_rls.sql`.

Supabase clients:
- `lib/supabase/server.ts` — Server Components and Route Handlers
- `lib/supabase/client.ts` — Client Components (browser)

### Types

All shared types live in `lib/types/flatguard.ts`. There are two layers:

- **DB-native types** (`DbProject`, `DbSearchProfile`, `NormalizedListing`, `DbShortlistEntry`) — snake_case, match Supabase schema exactly.
- **UI types** (`Project`, `Listing`, `ShortlistEntry`) — camelCase, used in frontend components. Many have `// TODO: connect to DB` comments indicating mocks are still in use.

`ScoredListing` wraps a `NormalizedListing` pick with `overallScore`, `breakdown[]`, `reasoning`, and `recommendation` (`"strong" | "good" | "weak"`).

### Mocks

`lib/mock/` contains `projects.ts`, `listings.ts`, `interview.ts` — used for UI development before real APIs. The integration pattern is mock-first: build UI against mocked DTOs, then swap in real API calls.

## Installed Skills

Read these before writing code in their domains — APIs may differ from training data:

- **AI SDK** — `.agents/skills/ai-sdk/` — streaming, tool calling, `useChat`
- **Vercel React Best Practices** — `.agents/skills/vercel-react-best-practices/`
- **Supabase Postgres** — `.agents/skills/supabase-postgres-best-practices/`
- **shadcn/ui** — `.agents/skills/shadcn/` — style: `new-york`, icons: `lucide`, paths: `@/components/ui`; add via `pnpm dlx shadcn@latest add <component>`
- **Gemini API** — `.agents/skills/gemini-api-dev/` — only use when explicitly requested
