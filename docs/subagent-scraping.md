# Subagent Scraping Method: Wroclaw Rental Listings

## Scope

- Source acquisition plus schema-aligned projection notes.
- Source: OLX rental search pages for Wroclaw.
- Authoritative local schema references:
  - [docs/database-schema-reference.md](/Users/bruno/Desktop/work/hackathon/docs/database-schema-reference.md)
  - [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md)

Scraping is responsible for:

- collecting raw source evidence
- preserving the full source row in `listings_raw.raw_data`
- extracting only explicit typed facts that fit `listings_normalized`

Scraping is not responsible for:

- projects, interview sessions, or search profile writes
- ranking logic
- search run creation
- shortlist logic
- geocoding or inferred enrichment

## Target Tables

The current schema expects scraper output to land in:

- `public.listings_raw`
- `public.listings_normalized`

`listings_raw` is the append-only source evidence table.

`listings_normalized` is the canonical listing table used later by search and shortlist flows.

## Method

1. Crawl OLX Wroclaw rental search pages:
   - `https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/`
   - paginated with `?page=N`
2. Parse listing cards from server-rendered HTML blocks with `data-cy="l-card"`.
3. Fallback to embedded `application/ld+json` offer data only if card parsing fails.
4. Deduplicate by canonical listing URL.
5. Fetch detail pages to enrich only explicit source facts.
6. Persist the crawler row as JSONL and CSV under `data/raw/`.
7. Load JSONL into `public.listings_raw` and project explicit typed values into `public.listings_normalized`.

## Crawler Output Contract

The current OLX crawler emits source-specific JSONL. Required fields:

- `crawl_run_id`
- `source`
- `source_entity`
- `city_query`
- `page_number`
- `listing_id`
- `listing_url`
- `title_raw`
- `price_raw`
- `price_currency_raw`
- `price_numeric_raw`
- `area_served_raw`
- `availability_raw`
- `price_valid_until_raw`
- `scraped_at_utc`
- `page_html_sha256`
- `detail_html_sha256`
- `description_raw`
- `image_urls_raw`
- `seller_name_raw`
- `seller_profile_url`
- `seller_member_since_raw`
- `seller_last_seen_raw`
- `source_business_type_raw`
- `contact_phone_masked_raw`
- `contact_phone_raw`
- `contact_email_raw`
- `contact_preference_raw`
- `exact_location_available_raw`
- `district_breadcrumb_raw`
- `district_breadcrumb_id_raw`
- `district_hint_raw`
- `street_hint_raw`
- `animals_raw`
- `elevator_raw`
- `parking_raw`
- `floor_raw`
- `furnished_raw`
- `building_type_raw`
- `area_m2_detail_raw`
- `rooms_detail_raw`
- `additional_rent_raw`
- `raw_offer_json`
- `raw_detail_json`

## Exact Schema Mapping

### `listings_raw`

- `source` <- `source`
- `external_id` <- `listing_id`
- `scraped_at` <- `scraped_at_utc`
- `raw_data` <- full crawler record
- `normalized_id` <- linked after normalized projection succeeds

### `listings_normalized`

- `source` <- `source`
- `external_id` <- `listing_id`
- `url` <- canonicalized `listing_url`
- `title` <- `title_raw`
- `description` <- `description_raw`
- `is_active` <- `true`
- `first_seen_at` <- `scraped_at_utc`
- `last_seen_at` <- `scraped_at_utc`
- `city` <- parsed from `area_served_raw`, fallback `Wrocław`
- `district` <- `district_breadcrumb_raw`, fallback parsed district from `area_served_raw`
- `neighbourhood` <- `district_hint_raw`
- `address` <- `street_hint_raw`
- `area_m2` <- `area_m2_detail_raw`
- `rooms` <- `rooms_detail_raw`
- `floor` <- parsed integer from `floor_raw`
- `building_type` <- `building_type_raw`
- `offer_type` <- `rent`
- `rent_pln` <- `price_numeric_raw`
- `fees` <- JSON object from `additional_rent_raw` when present
- `total_monthly_pln` <- `price_numeric_raw + additional_rent_raw` when both are present
- `has_elevator` <- `Tak/Yes => true`, `Nie/No => false`
- `is_furnished` <- `Tak/Yes => true`, `Nie/No => false`
- `parking_type` <- `parking_raw`

Leave null unless the source explicitly exposes them and the parser was updated:

- `lat`
- `lng`
- `location`
- `total_floors`
- `has_provision`
- `provision_total_pln`
- `deposit_pln`
- `available_from`
- `has_balcony`
- `has_terrace`
- `has_storage_room`
- `has_internet`
- `has_tv`
- `heating_type`
- `kitchen_equipment`
- `bathroom_features`
- `living_room_features`
- `nearby`

## Review of Current Checked-In Results

- `data/raw/olx_wroclaw_rentals_raw_20260328T112643436Z.jsonl`
  - 170 rows
  - search-card coverage only
  - enough for `listings_raw`
  - enough for partial `listings_normalized` fields such as `source`, `external_id`, `url`, `title`, `rent_pln`, `city`, and some `district`
  - some historical rows still carry OLX query params in `listing_url`; the loader canonicalizes them
- `data/raw/olx_wroclaw_rentals_raw_20260328T113702845Z.jsonl`
  - 5 rows
  - enriched detail-page sample
  - fills many more normalized columns including `description`, `area_m2`, `rooms`, `floor`, `building_type`, `fees`, `has_elevator`, `is_furnished`, and `parking_type`
- `data/raw/olx_wroclaw_rentals_raw.sample.jsonl`
  - tiny source-format preview
  - useful for loader-contract sanity checks

## Loader

Use the repo loader to map current OLX JSONL into the production tables:

```bash
psql "$SUPABASE_DB_URL" \
  -v jsonl_path=/absolute/path/to/data/raw/olx_wroclaw_rentals_raw_<timestamp>.jsonl \
  -f supabase/sql/load_olx_raw_jsonl.sql
```

## Run

```bash
node scripts/crawl-olx-wroclaw-raw.mjs --target 150 --max-pages 25 --delay-ms 900
```

Optional flags:

- `--out-dir data/raw`
- `--target <int>`
- `--max-pages <int>`
- `--delay-ms <int>`
- `--detail-delay-ms <int>`

## Notes

- The crawler still emits source-specific JSONL by design; the loader is responsible for table-shaped inserts.
- The old `raw_ingest_runs` and `raw_rental_listings` path is obsolete for current work.
- On tested OLX SSR pages, phone is exposed only as masked text such as `xxx xxx xxx`; a clear phone number or email was not present in the server-rendered HTML.
