# Subagent Scraping Method: Wroclaw Raw Rentals

## Scope

- Raw data acquisition only.
- No normalization and no transformation logic.
- Source: OLX Wroclaw rental search listing pages.
- Generic raw contract reference: [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md)

## Method

1. Crawl OLX rental search pages for Wroclaw:
   - `https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/`
   - and paginated `?page=N`.
2. Parse listing cards from HTML blocks (`<div data-cy="l-card"...>`), which contain listing URLs and card metadata.
3. Fallback to embedded `application/ld+json` (`Product.offers.offers[]`) if card parsing fails.
4. Deduplicate by `listing_url`.
5. Keep crawling pages until `--target` records are collected (default `150`) or max pages reached.
6. Persist raw outputs into both JSONL and CSV under `data/raw/`.

## Output Contract (Raw)

Primary JSONL fields:

- `crawl_run_id` (UUID)
- `source` (`olx.pl`)
- `source_entity` (`flat_rental_listing`)
- `city_query` (`wroclaw`)
- `page_number`
- `listing_id` (from URL token after `-ID...`)
- `listing_url`
- `title_raw`
- `price_raw`
- `price_currency_raw`
- `price_numeric_raw`
- `area_served_raw`
- `district_breadcrumb_raw`
- `district_hint_raw`
- `street_hint_raw`
- `description_raw`
- `image_urls_raw`
- `seller_name_raw`
- `seller_profile_url`
- `seller_member_since_raw`
- `seller_last_seen_raw`
- `contact_phone_masked_raw`
- `contact_phone_raw`
- `contact_email_raw`
- `area_m2_detail_raw`
- `rooms_detail_raw`
- `additional_rent_raw`
- `availability_raw`
- `price_valid_until_raw`
- `scraped_at_utc`
- `page_html_sha256`
- `detail_html_sha256`
- `raw_offer_json` (raw card metadata or unmodified JSON-LD offer payload)
- `raw_detail_json` (raw detail-page metadata)

This source-specific output should stay compatible with [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md) so other crawlers can land in the same raw Postgres layer.

## Run

```bash
node scripts/crawl-olx-wroclaw-raw.mjs --target 150 --max-pages 25 --delay-ms 900
```

Optional flags:

- `--out-dir data/raw` (default)
- `--target <int>`
- `--max-pages <int>`
- `--delay-ms <int>`

## Generated Files

Each run writes:

- `data/raw/olx_wroclaw_rentals_raw_<timestamp>.jsonl`
- `data/raw/olx_wroclaw_rentals_raw_<timestamp>.csv`
- `data/raw/olx_wroclaw_rentals_raw_<timestamp>.meta.json`

## Notes

- Uses built-in Node APIs only; no external dependencies.
- If network access is blocked, script still serves as deterministic implementation based on the observed OLX page structure and can be run in an environment with outbound HTTPS enabled.
- On tested OLX SSR detail pages, phone is exposed only as a masked string such as `xxx xxx xxx`; a clear phone number or email was not present in the server-rendered HTML.
