import { displayAirQualityCategory } from "@/lib/enrichment-display";
import type { NormalizedListing, ScoredListing } from "@/lib/types/flatguard";

/**
 * Attach persisted enrichment from full listing rows onto scored payloads for the search chat API,
 * so the model can rank by AQI / sun / rain without extra tool calls.
 */
export function mergeScoredListingsWithEnrichment(
  scored: ScoredListing[],
  rawListings: NormalizedListing[]
): ScoredListing[] {
  const byId = new Map(rawListings.map((l) => [l.id, l]));
  return scored.map((s) => {
    const full = byId.get(s.listing.id);
    if (!full) return s;
    return {
      ...s,
      listing: {
        ...s.listing,
        air_quality_aqi_index_code: full.air_quality_aqi_index_code ?? null,
        air_quality_aqi_display_name: full.air_quality_aqi_display_name ?? null,
        air_quality_aqi_value: full.air_quality_aqi_value ?? null,
        air_quality_aqi_category: full.air_quality_aqi_category ?? null,
        air_quality_aqi_category_en:
          displayAirQualityCategory(full.air_quality_aqi_category) ?? null,
        sunlight_score: full.sunlight_score ?? null,
        sunlight_confidence: full.sunlight_confidence ?? null,
        weather_next12h_rain_hours: full.weather_next12h_rain_hours ?? null,
        geocode_status: full.geocode_status ?? null,
        geocode_lat: full.geocode_lat ?? null,
        geocode_lng: full.geocode_lng ?? null,
        geocode_formatted_address: full.geocode_formatted_address ?? null,
        lat: full.lat ?? null,
        lng: full.lng ?? null,
        image_urls: full.image_urls,
        flat_description_pictures: full.flat_description_pictures ?? null,
      },
    };
  });
}
