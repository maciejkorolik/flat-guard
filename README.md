# Hackathon — Next.js + Supabase (auth template)

Minimal starter for building quickly: **sign-in** (Google OAuth and email/password) and an **empty authenticated app**. Everything under `/` is protected except `/auth/*`.

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
