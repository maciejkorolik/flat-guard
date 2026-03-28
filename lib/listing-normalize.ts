import type { ListingFeeRow, NormalizedListing } from "@/lib/types/flatguard";

export function firstLine(value: string | null): string | null {
  if (!value) return null;
  return value.split("\n")[0].trim() || null;
}

export function parseDbNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Coerce Postgres numeric / string to finite number for lat/lng. */
export function parseCoordinate(v: unknown): number | null {
  return parseDbNumber(v);
}

const MAX_IMAGE_URLS = 24;
const HTTP = /^https?:\/\//i;

function isProbableImageUrl(s: string): boolean {
  const t = s.trim();
  if (!HTTP.test(t)) return false;
  if (/\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i.test(t)) return true;
  if (/photo|thumbnail|gallery|cdn|storage|cloudinary|img\.|images\//i.test(t)) return true;
  return false;
}

/**
 * Parse listings_normalized.flat_pictures_url (comma-separated CDN URLs from the pipeline).
 */
export function parseFlatPicturesUrlColumn(value: unknown): string[] {
  if (value == null) return [];
  const s = String(value).trim();
  if (!s) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of s.split(/,\s+/)) {
    const u = part.trim();
    if (!u || !isProbableImageUrl(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= MAX_IMAGE_URLS) break;
  }
  return out;
}

export function normalizeListingFromDb(l: NormalizedListing): NormalizedListing {
  const feesRaw = l.fees as unknown;
  const fees =
    feesRaw == null ? null : Array.isArray(feesRaw) ? (feesRaw as ListingFeeRow[]) : null;
  const raw = l as unknown as Record<string, unknown>;

  const nInt = (v: unknown): number | null => {
    if (v == null) return null;
    const x = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(x) ? x : null;
  };

  const flatDesc = l.flat_description_pictures;
  const descStr =
    flatDesc == null || !String(flatDesc).trim() ? null : String(flatDesc).trim();

  const image_urls = parseFlatPicturesUrlColumn(l.flat_pictures_url);

  return {
    ...l,
    district: firstLine(l.district),
    address: firstLine(l.address),
    area_m2: l.area_m2 != null ? parseDbNumber(l.area_m2) : null,
    lat: parseCoordinate(raw.geocode_lat),
    lng: parseCoordinate(raw.geocode_lng),
    provision_total_pln:
      l.provision_total_pln == null
        ? null
        : (() => {
            const n = parseDbNumber(l.provision_total_pln);
            return n != null ? Math.round(n) : null;
          })(),
    fees,
    flat_description_pictures: descStr,
    image_urls: image_urls.length > 0 ? image_urls : undefined,
    geocode_lat: parseCoordinate(raw.geocode_lat),
    geocode_lng: parseCoordinate(raw.geocode_lng),
    sunlight_score: raw.sunlight_score != null ? parseDbNumber(raw.sunlight_score) : null,
    air_quality_aqi_value:
      raw.air_quality_aqi_value != null ? parseDbNumber(raw.air_quality_aqi_value) : null,
    weather_temperature_c:
      raw.weather_temperature_c != null ? parseDbNumber(raw.weather_temperature_c) : null,
    weather_next12h_rain_hours: nInt(raw.weather_next12h_rain_hours),
    weather_next12h_max_precip_probability_percent:
      raw.weather_next12h_max_precip_probability_percent != null
        ? parseDbNumber(raw.weather_next12h_max_precip_probability_percent)
        : null,
  };
}
