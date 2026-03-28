import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { firstLine, parseFlatPicturesUrlColumn } from "@/lib/listing-normalize";
import type { ScoredListing } from "@/lib/types/flatguard";

/** listings_normalized without PostGIS `location` (not JSON-safe in API). Matches remote Supabase (no lat/lng columns — use geocode_lat/geocode_lng). */
export const LISTING_WITH_ENRICHMENT_COLUMNS =
  "id, source, external_id, url, title, description, is_active, first_seen_at, last_seen_at, " +
  "city, district, neighbourhood, address, area_m2, rooms, floor, total_floors, building_type, " +
  "offer_type, has_provision, provision_total_pln, rent_pln, deposit_pln, fees, total_monthly_pln, " +
  "available_from, has_balcony, has_terrace, has_elevator, has_storage_room, is_furnished, has_internet, " +
  "has_tv, heating_type, parking_type, kitchen_equipment, bathroom_features, living_room_features, " +
  "extra_features, nearby, last_enrichment_run_id, " +
  "geocode_status, geocode_provider, geocode_query, geocode_formatted_address, geocode_place_id, geocode_location_type, " +
  "geocode_result_types, geocode_partial_match, geocoded_at, geocode_lat, geocode_lng, " +
  "weather_status, weather_summary_time, weather_condition_type, weather_condition_text, weather_temperature_c, " +
  "weather_precipitation_probability_percent, weather_next12h_rain_hours, weather_next12h_max_precip_probability_percent, weather_fetched_at, " +
  "air_quality_status, air_quality_summary_time, air_quality_aqi_index_code, air_quality_aqi_display_name, air_quality_aqi_value, " +
  "air_quality_aqi_category, air_quality_dominant_pollutant, air_quality_fetched_at, " +
  "sunlight_status, sunlight_score, sunlight_confidence, sunlight_estimated_orientation_hint, sunlight_reasons, sunlight_fetched_at, " +
  "proximity_matches, proximity_fetched_at, " +
  "flat_pictures_url, flat_description_pictures";

export const searchFlatsInputSchema = z.object({
  city: z.string().optional(),
  districts: z.array(z.string()).optional(),
  neighbourhoods: z.array(z.string()).optional(),
  rent_max_pln: z.number().optional(),
  total_monthly_max_pln: z.number().optional(),
  rooms_min: z.number().optional(),
  rooms_max: z.number().optional(),
  area_min_m2: z.number().optional(),
  area_max_m2: z.number().optional(),
  offer_type: z.string().optional(),
  is_furnished: z.boolean().optional(),
  has_elevator: z.boolean().optional(),
  has_balcony: z.boolean().optional(),
  geocode_required: z.boolean().optional(),
  active_only: z.boolean().optional(),
});

export type SearchFlatsResultRow = {
  id: string;
  source: string | null;
  externalId: string | null;
  url: string | null;
  title: string | null;
  city: string | null;
  district: string | null;
  neighbourhood: string | null;
  address: string | null;
  rentPln: number | null;
  totalMonthlyPln: number | null;
  rooms: number | null;
  areaM2: number | null;
  geocodeStatus: string | null;
  geocodeLat: number | null;
  geocodeLng: number | null;
  sunlightScore: number | null;
  airQualityAqiValue: number | null;
  weatherNext12hRainHours: number | null;
};

export type NearbyPlaceRow = {
  categoryKey: string;
  placeName: string | null;
  placeFormattedAddress: string | null;
  placePrimaryType: string | null;
  walkingDistanceMeters: number | null;
  walkingDurationSeconds: number | null;
  routeCondition: string | null;
};

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v);
  return t.length ? t : null;
}

function n(v: unknown): number | null {
  if (v == null) return null;
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : null;
}

function ni(v: unknown): number | null {
  if (v == null) return null;
  const x = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(x) ? x : null;
}

function normalizeRow(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...r,
    district: firstLine(r.district as string | null),
    address: firstLine(r.address as string | null),
    area_m2: r.area_m2 != null ? parseFloat(String(r.area_m2)) || null : null,
  };
}

function rowToSearchFlat(r: Record<string, unknown>): SearchFlatsResultRow {
  const glat = n(r.geocode_lat);
  const glng = n(r.geocode_lng);
  return {
    id: String(r.id),
    source: s(r.source),
    externalId: s(r.external_id),
    url: s(r.url),
    title: s(r.title),
    city: s(r.city),
    district: s(r.district),
    neighbourhood: s(r.neighbourhood),
    address: s(r.address),
    rentPln: ni(r.rent_pln),
    totalMonthlyPln: ni(r.total_monthly_pln),
    rooms: ni(r.rooms),
    areaM2: r.area_m2 != null ? n(r.area_m2) : null,
    geocodeStatus: s(r.geocode_status),
    geocodeLat: glat,
    geocodeLng: glng,
    sunlightScore: r.sunlight_score != null ? n(r.sunlight_score) : null,
    airQualityAqiValue: n(r.air_quality_aqi_value),
    weatherNext12hRainHours: ni(r.weather_next12h_rain_hours),
  };
}

function matchesSearchFilters(
  row: Record<string, unknown>,
  f: z.infer<typeof searchFlatsInputSchema>
): boolean {
  if (f.active_only && row.is_active === false) return false;

  if (f.city) {
    const c = (s(row.city) ?? "").toLowerCase();
    if (!c.includes(f.city.toLowerCase())) return false;
  }
  if (f.districts?.length) {
    const d = (s(row.district) ?? "").toLowerCase();
    if (!f.districts.some((x) => d.includes(x.toLowerCase()))) return false;
  }
  if (f.neighbourhoods?.length) {
    const nb = (s(row.neighbourhood) ?? "").toLowerCase();
    if (!f.neighbourhoods.some((x) => nb.includes(x.toLowerCase()))) return false;
  }
  const rent = ni(row.rent_pln);
  if (f.rent_max_pln != null && rent != null && rent > f.rent_max_pln) return false;
  const total = ni(row.total_monthly_pln);
  if (f.total_monthly_max_pln != null && total != null && total > f.total_monthly_max_pln) return false;
  const rooms = ni(row.rooms);
  if (f.rooms_min != null && rooms != null && rooms < f.rooms_min) return false;
  if (f.rooms_max != null && rooms != null && rooms > f.rooms_max) return false;
  const area = row.area_m2 != null ? n(row.area_m2) : null;
  if (f.area_min_m2 != null && area != null && area < f.area_min_m2) return false;
  if (f.area_max_m2 != null && area != null && area > f.area_max_m2) return false;
  if (f.offer_type) {
    const ot = (s(row.offer_type) ?? "").toLowerCase();
    if (ot !== f.offer_type.toLowerCase()) return false;
  }
  if (f.is_furnished != null && row.is_furnished !== f.is_furnished) return false;
  if (f.has_elevator != null && row.has_elevator !== f.has_elevator) return false;
  if (f.has_balcony != null && row.has_balcony !== f.has_balcony) return false;
  if (f.geocode_required) {
    const ok =
      String(row.geocode_status ?? "").toLowerCase() === "succeeded" ||
      (n(row.geocode_lat) != null && n(row.geocode_lng) != null);
    if (!ok) return false;
  }
  return true;
}

export function parseProximityMatches(raw: unknown): NearbyPlaceRow[] {
  if (!Array.isArray(raw)) return [];
  const out: NearbyPlaceRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    out.push({
      categoryKey: s(o.category_key ?? o.categoryKey) ?? "unknown",
      placeName: s(o.place_name ?? o.placeName),
      placeFormattedAddress: s(o.place_formatted_address ?? o.placeFormattedAddress),
      placePrimaryType: s(o.place_primary_type ?? o.placePrimaryType),
      walkingDistanceMeters: ni(o.walking_distance_meters ?? o.walkingDistanceMeters),
      walkingDurationSeconds: ni(o.walking_duration_seconds ?? o.walkingDurationSeconds),
      routeCondition: s(o.route_condition ?? o.routeCondition),
    });
  }
  return out;
}

export type FlatSearchToolsCtx = {
  allowedListingIds: Set<string>;
  scoredListings: ScoredListing[];
};

async function fetchListingRow(
  supabase: SupabaseClient,
  listingId: string
): Promise<{ row: Record<string, unknown> | null; error?: string }> {
  const { data, error } = await supabase
    .from("listings_normalized")
    .select(LISTING_WITH_ENRICHMENT_COLUMNS)
    .eq("id", listingId)
    .single();
  if (error || !data) return { row: null, error: error?.message ?? "Listing not found" };
  return { row: normalizeRow(data as unknown as Record<string, unknown>) };
}

function notAllowed() {
  return { error: "That listing is not in the current search results. Use ids from the INDEX." };
}

export async function execSearchFlats(
  supabase: SupabaseClient,
  ctx: FlatSearchToolsCtx,
  input: z.infer<typeof searchFlatsInputSchema>
) {
  const ids = [...ctx.allowedListingIds];
  if (ids.length === 0) return { results: [] as SearchFlatsResultRow[], count: 0 };

  const { data, error } = await supabase
    .from("listings_normalized")
    .select(LISTING_WITH_ENRICHMENT_COLUMNS)
    .in("id", ids);

  if (error) return { error: error.message, results: [], count: 0 };

  const scoreIndex = new Map<string, number>();
  ctx.scoredListings.forEach((s, i) => scoreIndex.set(s.listing.id, i));

  const rows = (data ?? [])
    .map((r) => normalizeRow(r as unknown as Record<string, unknown>))
    .filter((r) => matchesSearchFilters(r, input))
    .sort((a, b) => {
      const ia = scoreIndex.get(String(a.id)) ?? 999;
      const ib = scoreIndex.get(String(b.id)) ?? 999;
      return ia - ib;
    });

  const results = rows.map(rowToSearchFlat);
  return { results, count: results.length };
}

export async function execGetFlatSearchCardData(supabase: SupabaseClient, ctx: FlatSearchToolsCtx, listingId: string) {
  if (!ctx.allowedListingIds.has(listingId)) return notAllowed();
  const { row, error } = await fetchListingRow(supabase, listingId);
  if (error || !row) return { error: error ?? "Not found" };

  const proximity = parseProximityMatches(row.proximity_matches);
  const byCat = (k: string) => proximity.find((p) => p.categoryKey.toLowerCase() === k);

  return {
    title: s(row.title),
    rentPln: ni(row.rent_pln),
    totalMonthlyPln: ni(row.total_monthly_pln),
    rooms: ni(row.rooms),
    areaM2: row.area_m2 != null ? n(row.area_m2) : null,
    district: s(row.district),
    address: s(row.address),
    geocodeStatus: s(row.geocode_status),
    geocodeFormattedAddress: s(row.geocode_formatted_address),
    sunlightScore: row.sunlight_score != null ? n(row.sunlight_score) : null,
    sunlightConfidence: s(row.sunlight_confidence),
    airQualityAqiValue: n(row.air_quality_aqi_value),
    airQualityCategory: s(row.air_quality_aqi_category),
    weatherNext12hRainHours: ni(row.weather_next12h_rain_hours),
    closestPark: byCat("park") ?? null,
    closestGym: byCat("gym") ?? null,
    closestGrocery: byCat("grocery") ?? null,
    pictureUrls: parseFlatPicturesUrlColumn(row.flat_pictures_url),
    pictureInspectionNotes: s(row.flat_description_pictures),
  };
}

export async function execGetGeoData(supabase: SupabaseClient, ctx: FlatSearchToolsCtx, listingId: string) {
  if (!ctx.allowedListingIds.has(listingId)) return notAllowed();
  const { row, error } = await fetchListingRow(supabase, listingId);
  if (error || !row) return { error: error ?? "Not found" };
  return {
    geocodeStatus: s(row.geocode_status),
    geocodeFormattedAddress: s(row.geocode_formatted_address),
    geocodeLocationType: s(row.geocode_location_type),
    geocodePartialMatch: row.geocode_partial_match === true,
    geocodeLat: n(row.geocode_lat),
    geocodeLng: n(row.geocode_lng),
    geocodedAt: s(row.geocoded_at),
  };
}

export async function execGetSunData(supabase: SupabaseClient, ctx: FlatSearchToolsCtx, listingId: string) {
  if (!ctx.allowedListingIds.has(listingId)) return notAllowed();
  const { row, error } = await fetchListingRow(supabase, listingId);
  if (error || !row) return { error: error ?? "Not found" };
  const reasons = row.sunlight_reasons;
  const reasonsList = Array.isArray(reasons) ? reasons.map((x) => String(x)) : [];
  return {
    sunlightStatus: s(row.sunlight_status),
    sunlightScore: row.sunlight_score != null ? n(row.sunlight_score) : null,
    sunlightConfidence: s(row.sunlight_confidence),
    sunlightEstimatedOrientationHint: s(row.sunlight_estimated_orientation_hint),
    sunlightReasons: reasonsList,
    sunlightFetchedAt: s(row.sunlight_fetched_at),
  };
}

export async function execGetWeatherData(supabase: SupabaseClient, ctx: FlatSearchToolsCtx, listingId: string) {
  if (!ctx.allowedListingIds.has(listingId)) return notAllowed();
  const { row, error } = await fetchListingRow(supabase, listingId);
  if (error || !row) return { error: error ?? "Not found" };
  return {
    weatherStatus: s(row.weather_status),
    weatherSummaryTime: s(row.weather_summary_time),
    weatherConditionType: s(row.weather_condition_type),
    weatherConditionText: s(row.weather_condition_text),
    weatherTemperatureC: n(row.weather_temperature_c),
    weatherPrecipitationProbabilityPercent: n(row.weather_precipitation_probability_percent),
    weatherNext12hRainHours: ni(row.weather_next12h_rain_hours),
    weatherNext12hMaxPrecipProbabilityPercent: n(row.weather_next12h_max_precip_probability_percent),
    weatherFetchedAt: s(row.weather_fetched_at),
  };
}

export async function execGetAirQualityData(supabase: SupabaseClient, ctx: FlatSearchToolsCtx, listingId: string) {
  if (!ctx.allowedListingIds.has(listingId)) return notAllowed();
  const { row, error } = await fetchListingRow(supabase, listingId);
  if (error || !row) return { error: error ?? "Not found" };
  return {
    airQualityStatus: s(row.air_quality_status),
    airQualitySummaryTime: s(row.air_quality_summary_time),
    airQualityAqiIndexCode: s(row.air_quality_aqi_index_code),
    airQualityAqiDisplayName: s(row.air_quality_aqi_display_name),
    airQualityAqiValue: n(row.air_quality_aqi_value),
    airQualityAqiCategory: s(row.air_quality_aqi_category),
    airQualityDominantPollutant: s(row.air_quality_dominant_pollutant),
    airQualityFetchedAt: s(row.air_quality_fetched_at),
  };
}

export async function execGetPlacesNearby(supabase: SupabaseClient, ctx: FlatSearchToolsCtx, listingId: string) {
  if (!ctx.allowedListingIds.has(listingId)) return notAllowed();
  const { row, error } = await fetchListingRow(supabase, listingId);
  if (error || !row) return { error: error ?? "Not found" };
  return {
    places: parseProximityMatches(row.proximity_matches),
    proximityFetchedAt: s(row.proximity_fetched_at),
  };
}

export async function execGetSearchExplainability(supabase: SupabaseClient, ctx: FlatSearchToolsCtx, listingId: string) {
  if (!ctx.allowedListingIds.has(listingId)) return notAllowed();
  const { row, error } = await fetchListingRow(supabase, listingId);
  if (error || !row) return { error: error ?? "Not found" };
  const proximity = parseProximityMatches(row.proximity_matches);
  const reasons = Array.isArray(row.sunlight_reasons) ? row.sunlight_reasons.map((x) => String(x)) : [];

  return {
    geocode: {
      status: s(row.geocode_status),
      locationType: s(row.geocode_location_type),
      partialMatch: row.geocode_partial_match === true,
    },
    sunlight: {
      score: row.sunlight_score != null ? n(row.sunlight_score) : null,
      confidence: s(row.sunlight_confidence),
      reasons,
    },
    airQuality: {
      aqi: n(row.air_quality_aqi_value),
      category: s(row.air_quality_aqi_category),
    },
    rain: {
      next12hRainHours: ni(row.weather_next12h_rain_hours),
      maxPrecipProb: n(row.weather_next12h_max_precip_probability_percent),
    },
    proximitySummary: proximity.map((p) => ({
      category: p.categoryKey,
      name: p.placeName,
      walkMin: p.walkingDurationSeconds != null ? Math.round(p.walkingDurationSeconds / 60) : null,
    })),
  };
}

export async function execGetEnrichmentCoverage(supabase: SupabaseClient, ctx: FlatSearchToolsCtx, listingId: string) {
  if (!ctx.allowedListingIds.has(listingId)) return notAllowed();
  const { row, error } = await fetchListingRow(supabase, listingId);
  if (error || !row) return { error: error ?? "Not found" };
  return {
    signals: [
      { name: "geocode", status: s(row.geocode_status), fetchedAt: s(row.geocoded_at) },
      { name: "weather", status: s(row.weather_status), fetchedAt: s(row.weather_fetched_at) },
      { name: "air_quality", status: s(row.air_quality_status), fetchedAt: s(row.air_quality_fetched_at) },
      { name: "sunlight", status: s(row.sunlight_status), fetchedAt: s(row.sunlight_fetched_at) },
      { name: "proximity", status: row.proximity_matches != null ? "present" : null, fetchedAt: s(row.proximity_fetched_at) },
    ],
  };
}
