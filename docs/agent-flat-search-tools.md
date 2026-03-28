# Agent Flat Search Tools

This file defines the agent-facing tool layer that should sit on top of `public.listings_normalized` during flat search.

The goal is simple:

- search from the canonical listing table only
- use enrichment columns that are already persisted in Supabase
- avoid calling Google APIs at search time
- keep tool outputs small, deterministic, and UI-ready

## Source Of Truth

Use `public.listings_normalized` as the only read model for flat search.

Relevant persisted enrichment columns:

- geocoding:
  - `geocode_status`
  - `geocode_provider`
  - `geocode_query`
  - `geocode_formatted_address`
  - `geocode_place_id`
  - `geocode_location_type`
  - `geocode_result_types`
  - `geocode_partial_match`
  - `geocode_lat`
  - `geocode_lng`
  - `geocoded_at`
- weather:
  - `weather_status`
  - `weather_summary_time`
  - `weather_condition_type`
  - `weather_condition_text`
  - `weather_temperature_c`
  - `weather_precipitation_probability_percent`
  - `weather_next12h_rain_hours`
  - `weather_next12h_max_precip_probability_percent`
  - `weather_fetched_at`
- air quality:
  - `air_quality_status`
  - `air_quality_summary_time`
  - `air_quality_aqi_index_code`
  - `air_quality_aqi_display_name`
  - `air_quality_aqi_value`
  - `air_quality_aqi_category`
  - `air_quality_dominant_pollutant`
  - `air_quality_fetched_at`
- sunlight:
  - `sunlight_status`
  - `sunlight_score`
  - `sunlight_confidence`
  - `sunlight_estimated_orientation_hint`
  - `sunlight_reasons`
  - `sunlight_fetched_at`
- proximity:
  - `proximity_matches`
  - `proximity_fetched_at`

Static proximity categories currently produced by enrichment:

- `park`
- `gym`
- `grocery`

`grocery` is intentionally limited to nearby `Biedronka`, `Lidl`, and `Żabka`.

## Tool Set

### `searchFlats(input)`

Primary search tool. Returns ranked flat candidates from `listings_normalized`.

Use when:

- the user asks to find flats
- the user refines budget, rooms, district, commute, or quality preferences
- the agent needs a shortlist candidate set before drilling into enrichment details

Suggested filters:

- `city`
- `districts[]`
- `neighbourhoods[]`
- `rent_max_pln`
- `total_monthly_max_pln`
- `rooms_min`
- `rooms_max`
- `area_min_m2`
- `area_max_m2`
- `offer_type`
- `is_furnished`
- `has_elevator`
- `has_balcony`
- `geocode_required`
- `active_only`

Suggested output shape:

```ts
type SearchFlatsResult = {
  id: string
  source: string | null
  externalId: string | null
  url: string | null
  title: string | null
  city: string | null
  district: string | null
  neighbourhood: string | null
  address: string | null
  rentPln: number | null
  totalMonthlyPln: number | null
  rooms: number | null
  areaM2: number | null
  geocodeStatus: string | null
  geocodeLat: number | null
  geocodeLng: number | null
  sunlightScore: number | null
  airQualityAqiValue: number | null
  weatherNext12hRainHours: number | null
}
```

### `getFlatSearchCardData(listingId)`

Fetches the compact card payload for one listing.

Use when:

- rendering search results
- rebuilding a shortlist card
- the agent needs one listing summarized in plain language

This should join base listing facts and top-line enrichment into one payload.

Recommended fields:

- title, price, rooms, area, district, address
- `geocode_status`, `geocode_formatted_address`
- `sunlight_score`, `sunlight_confidence`
- `air_quality_aqi_value`, `air_quality_aqi_category`
- `weather_next12h_rain_hours`
- closest `park`, `gym`, `grocery` from `proximity_matches`

### `getGeoData(listingId)`

Returns only geocoding quality and coordinates.

Use when:

- deciding whether a listing can be shown on a map
- deciding whether proximity comparisons are trustworthy
- deciding whether to hide location-sensitive UX

Recommended output:

- `geocode_status`
- `geocode_formatted_address`
- `geocode_location_type`
- `geocode_partial_match`
- `geocode_lat`
- `geocode_lng`
- `geocoded_at`

### `getSunData(listingId)`

Returns only the persisted sunlight summary.

Use when:

- the user asks for sunny, bright, south-facing, or well-lit flats
- ranking should reward likely sun exposure
- the agent needs to explain the sunlight score

Recommended output:

- `sunlight_status`
- `sunlight_score`
- `sunlight_confidence`
- `sunlight_estimated_orientation_hint`
- `sunlight_reasons`
- `sunlight_fetched_at`

### `getWeatherData(listingId)`

Returns the current short-horizon weather snapshot for the listing area.

Use when:

- the user asks about rain risk today
- ranking should avoid rainy areas for immediate move/viewing decisions
- the agent needs to explain why a listing is marked weather-risky

Recommended output:

- `weather_status`
- `weather_summary_time`
- `weather_condition_type`
- `weather_condition_text`
- `weather_temperature_c`
- `weather_precipitation_probability_percent`
- `weather_next12h_rain_hours`
- `weather_next12h_max_precip_probability_percent`
- `weather_fetched_at`

### `getAirQualityData(listingId)`

Returns the air-quality snapshot for one listing.

Use when:

- the user asks for cleaner air
- ranking should penalize high AQI
- the agent wants to compare two listings on air quality

Recommended output:

- `air_quality_status`
- `air_quality_summary_time`
- `air_quality_aqi_index_code`
- `air_quality_aqi_display_name`
- `air_quality_aqi_value`
- `air_quality_aqi_category`
- `air_quality_dominant_pollutant`
- `air_quality_fetched_at`

### `getPlacesNearby(listingId)`

Returns the persisted proximity winners only.

Do not call Google Places from the agent at search time.

Use when:

- the user asks “how close is the nearest park/gym/grocery?”
- the agent needs to compare amenity convenience between shortlisted flats

Read from `proximity_matches`.

Recommended normalized output:

```ts
type NearbyPlace = {
  categoryKey: "park" | "gym" | "grocery"
  placeName: string | null
  placeFormattedAddress: string | null
  placePrimaryType: string | null
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  routeCondition: string | null
}
```

### `getSearchExplainability(listingId)`

Returns a compact explanation payload for why a listing is strong or weak.

Use when:

- the agent must justify ranking
- the user asks “why is this one better?”
- the UI needs an expandable “why this flat” section

Suggested derived explanation inputs:

- geocode trust:
  - `geocode_status`
  - `geocode_location_type`
  - `geocode_partial_match`
- sunlight:
  - `sunlight_score`
  - `sunlight_confidence`
- air quality:
  - `air_quality_aqi_value`
  - `air_quality_aqi_category`
- rain:
  - `weather_next12h_rain_hours`
  - `weather_next12h_max_precip_probability_percent`
- proximity:
  - `proximity_matches`

### `getEnrichmentCoverage(listingId)`

Returns only status fields and timestamps.

Use when:

- the agent should avoid overclaiming
- the UI needs to show “available”, “missing”, or “stale”
- debugging search quality for a specific listing

Recommended output:

- `geocode_status`, `geocoded_at`
- `weather_status`, `weather_fetched_at`
- `air_quality_status`, `air_quality_fetched_at`
- `sunlight_status`, `sunlight_fetched_at`
- `proximity_fetched_at`

## Ranking Guidance

Use these persisted columns as ranking signals, not as hard business rules unless the user asked for strict filtering.

Recommended soft signals:

- reward lower `air_quality_aqi_value`
- reward lower `weather_next12h_rain_hours`
- reward higher `sunlight_score`
- reward valid `proximity_matches` with shorter `walkingDurationSeconds`
- penalize `geocode_partial_match = true`
- penalize weak `geocode_location_type`

Recommended hard filters only when explicitly requested:

- `geocode_status = 'succeeded'`
- `sunlight_score >= threshold`
- AQI under a threshold
- max walking minutes to `park`, `gym`, or `grocery`

## Agent Rules

- never call live Google APIs from the search agent if data already exists in `listings_normalized`
- prefer persisted columns over recomputation
- if a status is `failed`, surface that as unavailable instead of guessing
- if geocoding is not `succeeded`, do not present map or proximity claims as factual
- proximity is limited to the static enrichment categories; do not imply broader amenity coverage
