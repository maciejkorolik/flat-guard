# Naive Raw Source Schema

This file is the source-agnostic raw schema reference for adding future listing sources.

It is intentionally naive:

- raw-first
- source-agnostic
- append-only
- no normalization assumptions
- no transformation logic

Use it as the minimum contract when adding another crawler.

## Purpose

Every source should be able to emit into the same raw contract before any downstream normalization.

That means a crawler for OLX, Otodom, Gratka, Domiporta, or another source should all be able to produce these fields even if many values are null.

## Required Raw Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | text / enum | Source system identifier, for example `olx`, `otodom`, `gratka` |
| `source_entity` | text | Kind of object being captured, for example `flat_rental_listing` |
| `crawl_run_id` | uuid / text | Ingest run identifier shared by all rows from one crawl |
| `source_listing_id` | text | Stable source-native listing id if available |
| `source_url` | text | Canonical listing URL |
| `search_url` | text | Search page URL that produced the row |
| `search_city` | text | Search city used by the crawl |
| `search_region` | text | Search region or broader area label |
| `search_page` | integer | Page number that produced the row |
| `position_on_page` | integer | Listing position within the page |
| `listing_title` | text | Raw listing title |
| `listing_price_amount` | numeric | Parsed numeric price if present |
| `listing_price_currency` | text | Currency code such as `PLN` |
| `location_label` | text | Raw location text from the source |
| `district` | text | Raw district text if directly available |
| `street_hint` | text | Street hint explicitly exposed by the source or extracted from raw listing text |
| `area_m2` | numeric | Raw parsed area if directly available |
| `rooms` | numeric | Raw parsed room count if directly available |
| `description_raw` | text | Full raw description when exposed on the listing detail page |
| `image_urls_raw` | jsonb / array | Raw image links from the source listing |
| `seller_name_raw` | text | Seller name as exposed by the source |
| `seller_profile_url` | text | Seller profile URL if available |
| `seller_member_since_raw` | text | Raw seller account-age text |
| `seller_last_seen_raw` | text | Raw seller recency text |
| `contact_phone_masked_raw` | text | Masked phone if the source hides the full number |
| `contact_phone_raw` | text | Unmasked phone when actually exposed |
| `contact_email_raw` | text | Email when actually exposed |
| `raw_detail_payload` | jsonb | Full raw detail-page fragment or payload |
| `is_promoted` | boolean | Whether the listing was marked as promoted |
| `scraped_at` | timestamptz | When the row was captured |
| `content_hash` | text | Hash of the raw record used for duplicate detection |
| `raw_payload` | jsonb | Full source fragment or source record payload |

## Rules

- Keep original source facts in `raw_payload` even when typed columns are also filled.
- Do not infer missing values.
- Do not geocode, normalize districts, or harmonize currencies here.
- Null is acceptable for any field that is not explicitly present in the source.
- `source_listing_id` should prefer a stable native id over a derived hash.
- `content_hash` should be derived from the raw record payload, not from normalized values.

## Mapping Notes

- `source_listing_id` may come from:
  - URL token
  - HTML attribute
  - JSON payload id
  - fallback deterministic hash if the source has no exposed id
- `location_label` should keep the source text as shown to users.
- `district` should only be filled when the source explicitly exposes it.
- `street_hint` should only be filled from explicit source text, not from geocoding.
- `area_m2` and `rooms` should stay null unless the source page provides parseable values.

## Current Reference Implementation

The current Wroclaw OLX raw path should be treated as the first implementation of this contract:

- [subagent-scraping.md](/Users/bruno/Desktop/work/hackathon/subagent-scraping.md)
- [docs/subagent-scraping.md](/Users/bruno/Desktop/work/hackathon/docs/subagent-scraping.md)
- [20260328123500_raw_ingest.sql](/Users/bruno/Desktop/work/hackathon/supabase/migrations/20260328123500_raw_ingest.sql)
- [load_olx_raw_jsonl.sql](/Users/bruno/Desktop/work/hackathon/supabase/sql/load_olx_raw_jsonl.sql)
