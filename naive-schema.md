# Listing Ingest Contract

This file keeps its old filename for compatibility, but it now documents the actual production-facing listing ingest contract.

Authoritative schema reference:

- [docs/database-schema-reference.md](/Users/bruno/Desktop/work/hackathon/docs/database-schema-reference.md)

## Purpose

Scraping work in this repo feeds two listing tables:

- `public.listings_raw`
- `public.listings_normalized`

`listings_raw` stores the untouched source evidence.

`listings_normalized` stores the typed facts used by search, ranking, and shortlist features.

## Required Scraper Landing Contract

Every scraper run must be able to produce values for `public.listings_raw`:

| Column | Type | Meaning |
| --- | --- | --- |
| `source` | text | Source identifier such as `olx` |
| `external_id` | text | Stable source-native listing identifier |
| `raw_data` | jsonb | Full source record as collected by the crawler |
| `scraped_at` | timestamptz | When the record was captured |
| `normalized_id` | uuid | Nullable reference to `listings_normalized.id` once projection succeeds |

Rules:

- keep all source-specific evidence in `raw_data`
- do not collapse raw evidence into only typed fields
- do not geocode or infer non-explicit facts during scraping
- prefer null in normalized fields over weak guesses

## Normalized Listing Contract

Scrapers or loaders may project into the following `public.listings_normalized` columns when the source explicitly exposes the values:

| Column | Meaning |
| --- | --- |
| `source` | Source identifier |
| `external_id` | Source-native listing identifier |
| `url` | Canonical listing URL |
| `title` | Listing title |
| `description` | Listing description |
| `exact_location_available` | Whether the source exposed precise location data |
| `image_urls` | Source image URLs when explicit |
| `source_business_type` | Source-side listing type or seller class |
| `source_offer_payload` | Provider offer payload kept as structured JSON |
| `source_detail_payload` | Provider detail payload kept as structured JSON |
| `is_active` | Whether the listing is currently active at scrape time |
| `first_seen_at` | First observed timestamp |
| `last_seen_at` | Most recent observed timestamp |
| `city` | City label |
| `district` | District label |
| `neighbourhood` | Finer-grained locality when explicit |
| `address` | Street/address hint when explicit |
| `lat` / `lng` / `location` | Spatial fields, leave null unless source explicitly provides them |
| `area_m2` | Area |
| `rooms` | Room count |
| `floor` | Floor number |
| `total_floors` | Building height if explicit |
| `building_type` | Building type |
| `offer_type` | For current rentals use `rent` |
| `has_provision` | Broker commission flag |
| `provision_total_pln` | Broker commission amount |
| `rent_pln` | Monthly rent |
| `deposit_pln` | Deposit amount |
| `fees` | Structured JSON fees object |
| `total_monthly_pln` | Rent plus explicit recurring fees |
| `available_from` | Explicit availability date |
| `has_balcony` / `has_terrace` / `has_elevator` / `has_storage_room` | Amenity booleans |
| `is_furnished` | Furnishing flag |
| `has_internet` / `has_tv` | Connectivity/media flags |
| `heating_type` | Heating type |
| `parking_type` | Parking description |
| `kitchen_equipment` | Explicit kitchen equipment list |
| `bathroom_features` | Explicit bathroom features |
| `living_room_features` | Explicit living-space features |
| `extra_features` | Explicit residual facts worth preserving as text labels |
| `nearby` | Structured nearby places or POIs |

## Current OLX Field Mapping

The current OLX crawler emits source-specific JSONL. Loaders should map it like this:

| Crawler Field | `listings_raw` / `listings_normalized` Target |
| --- | --- |
| `source` | `listings_raw.source`, `listings_normalized.source` |
| `listing_id` | `listings_raw.external_id`, `listings_normalized.external_id` |
| `scraped_at_utc` | `listings_raw.scraped_at`, `listings_normalized.first_seen_at`, `listings_normalized.last_seen_at` |
| full crawler row | `listings_raw.raw_data` |
| `listing_url` | `listings_normalized.url` |
| `title_raw` | `listings_normalized.title` |
| `description_raw` | `listings_normalized.description` |
| `exact_location_available_raw` | `listings_normalized.exact_location_available` |
| `image_urls_raw` | `listings_normalized.image_urls` |
| `source_business_type_raw` | `listings_normalized.source_business_type` |
| `raw_offer_json` | `listings_normalized.source_offer_payload` |
| `raw_detail_json` | `listings_normalized.source_detail_payload` |
| `area_m2_detail_raw` | `listings_normalized.area_m2` |
| `rooms_detail_raw` | `listings_normalized.rooms` |
| `floor_raw` | `listings_normalized.floor` |
| `building_type_raw` | `listings_normalized.building_type` |
| `price_numeric_raw` | `listings_normalized.rent_pln` |
| `additional_rent_raw` | `listings_normalized.fees`, `listings_normalized.total_monthly_pln` |
| `district_breadcrumb_raw` | `listings_normalized.district` |
| `district_hint_raw` | `listings_normalized.neighbourhood` |
| `street_hint_raw` | `listings_normalized.address` |
| `elevator_raw` | `listings_normalized.has_elevator` |
| `furnished_raw` | `listings_normalized.is_furnished` |
| `parking_raw` | `listings_normalized.parking_type` |

## Current OLX Gaps

The present crawler does not reliably fill these normalized columns and should leave them null until explicit extraction exists:

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

## References

- [docs/database-schema-reference.md](/Users/bruno/Desktop/work/hackathon/docs/database-schema-reference.md)
- [subagent-scraping.md](/Users/bruno/Desktop/work/hackathon/subagent-scraping.md)
- [docs/subagent-scraping.md](/Users/bruno/Desktop/work/hackathon/docs/subagent-scraping.md)
- [supabase/sql/load_olx_raw_jsonl.sql](/Users/bruno/Desktop/work/hackathon/supabase/sql/load_olx_raw_jsonl.sql)
