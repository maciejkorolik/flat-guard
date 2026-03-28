# Subagent Scraping Plan

## Scope

This branch owns listing-source ingestion only.

Required references:

- [docs/database-schema-reference.md](/Users/bruno/Desktop/work/hackathon/docs/database-schema-reference.md)
- [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md)

Out of scope:

- project creation
- interview storage
- search profile logic
- ranking
- search run persistence
- shortlist UX

## Target Schema

Scraping work must align to:

- `public.listings_raw`
- `public.listings_normalized`

Do not build new work on `raw_ingest_runs` or `raw_rental_listings`.

## Chosen Source

Use OLX rental search results for Wroclaw as the first seeded source:

```text
https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/
https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/?page=2
```

Why this source:

- public listing pages
- explicit pagination
- server-rendered card markup
- enough volume for demo seeding

## Extraction Strategy

Collect the full raw crawler row and project only explicit facts.

### Raw landing table

Every source row must be insertable into `listings_raw` with:

- `source`
- `external_id`
- `raw_data`
- `scraped_at`

### Normalized projection

Current OLX mapping should fill:

- `source`
- `external_id`
- `url`
- `title`
- `description`
- `is_active`
- `first_seen_at`
- `last_seen_at`
- `city`
- `district`
- `neighbourhood`
- `address`
- `area_m2`
- `rooms`
- `floor`
- `building_type`
- `offer_type`
- `rent_pln`
- `fees`
- `total_monthly_pln`
- `has_elevator`
- `is_furnished`
- `parking_type`

Leave null for fields without explicit source evidence.

## Operational Sequence

1. Crawl paginated OLX Wroclaw rental pages.
2. Save source-specific JSONL and CSV in `data/raw/`.
3. Load each crawler row into `public.listings_raw`.
4. Project explicit typed values into `public.listings_normalized`.
5. Update `listings_raw.normalized_id` to the linked normalized row.
6. Verify row counts and nullability against the schema reference.

## Local Commands

Run crawl:

```bash
node scripts/crawl-olx-wroclaw-raw.mjs --target 150 --max-pages 10 --delay-ms 900
```

Load JSONL into the current listing tables:

```bash
psql "$SUPABASE_DB_URL" \
  -v jsonl_path=/absolute/path/to/data/raw/olx_wroclaw_rentals_raw_<timestamp>.jsonl \
  -f supabase/sql/load_olx_raw_jsonl.sql
```

## Exit Criteria

This path is complete when:

- checked-in crawl artifacts remain usable as source records
- loader SQL targets `listings_raw` and `listings_normalized`
- docs describe the current schema exactly
- no active instructions direct new work toward the old experimental raw tables
