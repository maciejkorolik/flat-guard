# Subagent Scraping Plan

## Scope

This branch is limited to **raw acquisition** for rental listings in the Wroclaw city area.

Generic raw contract reference:

- [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md)

Do not implement:

- normalization
- ranking
- search profile logic
- transformation logic
- UI work

Those are separate tasks and should run later from Supabase or downstream jobs.

## Chosen Method

Use **OLX rental search result pages** as the first proof-of-ingest source for Wroclaw.

Why this source:

- public search pages are reachable without login
- pagination is explicit with `?page=N`
- card markup is server-rendered enough to parse reliably
- search volume is well above the current target of 150 raw rows

Current target URL shape:

```text
https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/
https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/?page=2
```

## Extraction Strategy

Collect only raw search-result facts for now.

Minimum extracted fields per row:

- `source`
- `source_listing_id`
- `source_url`
- `search_url`
- `search_city`
- `search_page`
- `position_on_page`
- `title`
- `price_amount`
- `price_currency`
- `location_label`
- `district`
- `street_hint`
- `area_m2`
- `rooms`
- `description_raw`
- `image_urls_raw`
- `seller_name_raw`
- `seller_profile_url`
- `seller_member_since_raw`
- `seller_last_seen_raw`
- `contact_phone_masked_raw`
- `contact_phone_raw`
- `contact_email_raw`
- `is_promoted`
- `scraped_at`
- `raw_payload`

Recommended parser anchors from OLX HTML:

- card root: `data-cy="l-card"`
- title area: `data-cy="ad-card-title"`
- pagination links: `?page=N`
- listing links: `href="/d/oferta/..."`

Raw payload should preserve the original text fragments used to derive typed columns.
For future sources, keep the field set aligned with [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md).

Current OLX detail-page additions:

- image gallery links
- full description text
- seller display name and profile URL
- seller account age and last-seen text
- masked phone text when exposed server-side
- district breadcrumb id and label
- finer location hints such as street or district names from explicit text
- property parameter chips such as area, rooms, building type, furnished, floor, and additional rent

## Storage Rules

Persist into Postgres with strong typing at the raw layer.

Requirements:

- append-only ingest runs
- typed raw listing table
- one row per listing per ingest run
- unique key on `(source, source_listing_id, ingest_run_id)`
- raw source fragment stored as `jsonb`
- source-specific enums and run status enums

Normalization is intentionally out of scope for this branch.

## Operational Sequence

1. Start a local Postgres instance.
2. Apply the raw-ingest schema.
3. Crawl paginated OLX Wroclaw rental pages until at least 150 rows are collected.
4. Insert raw rows into Postgres.
5. Record ingest-run metadata and counts.

## Local Commands

Initialize and start Postgres locally:

```bash
initdb --locale=C -E UTF8 -D .postgres-data
pg_ctl -D .postgres-data -l .postgres-data/server.log -o "-k /Users/bruno/Desktop/work/hackathon/.postgres-data -p 55432" start
createdb -h 127.0.0.1 -p 55432 flatguard_raw
```

Apply schema:

```bash
psql -h 127.0.0.1 -p 55432 -d flatguard_raw -f supabase/migrations/20260328123500_raw_ingest.sql
```

Run crawl:

```bash
node scripts/crawl-olx-wroclaw-raw.mjs --target 150 --max-pages 10 --delay-ms 900
```

Load the latest JSONL into typed raw tables:

```bash
psql -h 127.0.0.1 -p 55432 -d flatguard_raw -v jsonl_path=/absolute/path/to/data/raw/olx_wroclaw_rentals_raw_<timestamp>.jsonl -f supabase/sql/load_olx_raw_jsonl.sql
```

## Exit Criteria

This branch is successful when:

- at least 150 Wroclaw rental raw rows are captured
- rows are stored in local Postgres
- raw table columns are strongly typed
- normalization remains unimplemented

## Notes

- Expect duplicated or cross-posted listings across portals in later sources.
- Some cards may point to external domains; keep `source_url` and `raw_payload` so filtering decisions can happen later.
- Contact details are not required at the search-result stage.
- For OLX SSR pages, tested detail pages exposed masked phone text such as `xxx xxx xxx`, but not a clear phone number or email address.
