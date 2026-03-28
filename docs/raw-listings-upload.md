# Raw Listings Upload

This repo now has a direct uploader for `public.listings_raw` using the Supabase service role key.

Use it when:

- you want to push crawler JSONL into Supabase without a direct Postgres connection
- you are working from a detached worktree that does not have its own `.env.local`
- you need duplicate-safe uploads across overlapping crawler snapshots

Command:

```bash
node scripts/upload-raw-listings-to-supabase.mjs
```

Behavior:

- loads env from `.env.local` in the current worktree, then falls back to the repo root
- requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- scans `data/raw/*.jsonl` by default and skips `*.sample.jsonl`
- deduplicates by `(source, external_id)` before upload
- prefers the richer source row when the same listing appears in multiple files
- writes only to `public.listings_raw`
- leaves `normalized_id` as `null`

Useful variants:

```bash
node scripts/upload-raw-listings-to-supabase.mjs --dry-run
node scripts/upload-raw-listings-to-supabase.mjs data/raw/olx_wroclaw_rentals_raw_20260328T112643436Z.jsonl
node scripts/upload-raw-listings-to-supabase.mjs --batch-size 25
node scripts/upload-raw-listings-to-supabase.mjs --env ../../../.env.local
```

Current known behavior:

- `public.listings_raw` has a uniqueness constraint on `(source, external_id)`
- overlapping crawl snapshots will fail if uploaded naively without deduplication
- the checked-in OLX files currently collapse from 175 raw rows to 160 unique rows
