# Database Schema Reference

This file is the local reference for agents working in this repo.

It mirrors the current production-facing schema shared in the project brief and replaces the earlier local assumption that scraping data lands in `raw_ingest_runs` and `raw_rental_listings`.

## Core Tables

### `public.projects`

Top-level rental search project owned by a user.

Relevant fields:

- `id`
- `user_id`
- `name`
- `status`
- `created_at`
- `updated_at`

### `public.search_profiles`

Versioned search preferences per project.

Relevant fields:

- `id`
- `project_id`
- `version`
- `preferred_cities`
- `preferred_districts`
- `preferred_neighbourhoods`
- `important_locations`
- `budget_target_pln`
- `rooms_preferred`
- `area_m2_preferred`
- `availability_preferred`
- `preferred_features`
- `disliked_features`
- `preferred_offer_type`
- `preferred_heating_types`
- `raw_requirements`
- `is_current`
- `created_at`

### `public.interview_sessions`

Stores conversational requirements-capture history.

Relevant fields:

- `id`
- `project_id`
- `search_profile_id`
- `messages`
- `status`
- `created_at`
- `updated_at`

### `public.search_runs`

Immutable search execution snapshot for a given profile.

Relevant fields:

- `id`
- `project_id`
- `search_profile_id`
- `profile_snapshot`
- `total_matched`
- `total_scored`
- `status`
- `created_at`

### `public.search_run_results`

Ranked listing results for a search run.

Relevant fields:

- `id`
- `search_run_id`
- `listing_id`
- `listing_snapshot`
- `rank`
- `total_score`
- `score_breakdown`
- `created_at`

### `public.shortlist_entries`

Saved listings and follow-up state.

Relevant fields:

- `id`
- `project_id`
- `listing_id`
- `listing_snapshot`
- `search_run_id`
- `status`
- `notes`
- `contact_info`
- `contacted_at`
- `created_at`
- `updated_at`

## Listing Ingest Model

### `public.listings_raw`

This is the landing table for scraper output.

Required insert shape:

- `source`
- `external_id`
- `raw_data`
- `scraped_at`
- `normalized_id` is nullable and can be filled after the normalized row exists

Rules:

- one row per observed source record
- keep the full crawler payload in `raw_data`
- do not flatten away source-specific evidence
- `external_id` must prefer the source-native stable id
- keep `normalized_id` null only if normalization failed or was intentionally skipped

### `public.listings_normalized`

This is the canonical listing table used by search and shortlist features.

Important fields for the current OLX ingest:

- identity:
  - `source`
  - `external_id`
  - `url`
- descriptive:
  - `title`
  - `description`
  - `is_active`
  - `first_seen_at`
  - `last_seen_at`
- location:
  - `city`
  - `district`
  - `neighbourhood`
  - `address`
  - `lat`
  - `lng`
  - `location`
- apartment facts:
  - `area_m2`
  - `rooms`
  - `floor`
  - `total_floors`
  - `building_type`
  - `offer_type`
- pricing:
  - `has_provision`
  - `provision_total_pln`
  - `rent_pln`
  - `deposit_pln`
  - `fees`
  - `total_monthly_pln`
  - `available_from`
- booleans and amenities:
  - `has_balcony`
  - `has_terrace`
  - `has_elevator`
  - `has_storage_room`
  - `is_furnished`
  - `has_internet`
  - `has_tv`
  - `heating_type`
  - `parking_type`
  - `kitchen_equipment`
  - `bathroom_features`
  - `living_room_features`
  - `extra_features`
  - `nearby`

Rules:

- only write facts explicitly present in the source
- prefer null over guesses
- do not geocode into `lat`, `lng`, or `location` during the raw scrape
- set `first_seen_at` and `last_seen_at` from scrape timestamps until a richer freshness pipeline exists
- `fees` should stay structured JSON, not free text

## OLX Mapping

Current crawler JSONL fields map as follows:

### `listings_raw`

- `source` <- `source`
- `external_id` <- `listing_id`
- `scraped_at` <- `scraped_at_utc`
- `raw_data` <- full crawler record JSON

### `listings_normalized`

- `source` <- `source`
- `external_id` <- `listing_id`
- `url` <- canonicalized `listing_url`
- `title` <- `title_raw`
- `description` <- `description_raw`
- `is_active` <- `true` for rows returned by a successful crawl
- `first_seen_at` <- `scraped_at_utc`
- `last_seen_at` <- `scraped_at_utc`
- `city` <- parsed from `area_served_raw`, fallback `Wrocław`
- `district` <- `district_breadcrumb_raw`, fallback parsed district from `area_served_raw`
- `neighbourhood` <- `district_hint_raw`
- `address` <- `street_hint_raw`
- `area_m2` <- `area_m2_detail_raw`
- `rooms` <- `rooms_detail_raw`
- `floor` <- parsed `floor_raw`
- `building_type` <- `building_type_raw`
- `offer_type` <- `'rent'`
- `rent_pln` <- `price_numeric_raw`
- `fees` <- JSON built from `additional_rent_raw` when present
- `total_monthly_pln` <- `price_numeric_raw + additional_rent_raw` when both are present
- `has_elevator` <- parsed from `elevator_raw`
- `is_furnished` <- parsed from `furnished_raw`
- `parking_type` <- `parking_raw`
- `extra_features` <- optional text array for explicit source facts not modeled elsewhere

Fields to leave null for the current OLX pipeline unless explicit extraction is added:

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

## Current Status

Anything in this repo that still points to `raw_ingest_runs` or `raw_rental_listings` should be treated as historical scaffolding, not the target schema.
