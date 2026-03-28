/**
 * Polish (and similar) air-quality labels from enrichment APIs → English UI copy.
 * Source data often stays in Polish (e.g. GIOŚ-style phrases); we normalize for the UI only.
 */
export function displayAirQualityCategory(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const n = s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const KNOWN: Record<string, string> = {
    "dobra jakosc powietrza": "Good air quality",
    "bardzo dobra jakosc powietrza": "Very good air quality",
    "zla jakosc powietrza": "Poor air quality",
    "bardzo zla jakosc powietrza": "Very poor air quality",
    "srednia jakosc powietrza": "Moderate air quality",
    "umiarkowana jakosc powietrza": "Moderate air quality",
    "dostateczna jakosc powietrza": "Fair air quality",
  };
  if (KNOWN[n]) return KNOWN[n];

  if (n.includes("niedobra") || n.includes("niekorzystna")) return "Poor air quality";
  if (n.includes("bardzo zla")) return "Very poor air quality";
  if (n.includes("zla jakosc")) return "Poor air quality";
  if (n.includes("dostateczn")) return "Fair air quality";
  if (n.includes("umiarkowan") || (n.includes("srednia") && n.includes("jakosc"))) return "Moderate air quality";
  if (n.includes("bardzo dobra") && n.includes("jakosc")) return "Very good air quality";
  if (/\bdobra jakosc\b/.test(n) && !n.includes("niedobra")) return "Good air quality";

  if (/unhealthy|hazardous|moderate|good|sensitive|fair/i.test(s)) return s;

  return s;
}

/** For UI badges: true when category text indicates unhealthy/poor air (works across uaqi and local Google indexes). */
export function isAirQualityCategoryConcerning(raw: string | null | undefined): boolean {
  const e = displayAirQualityCategory(raw);
  if (!e) return false;
  const x = e.toLowerCase();
  if (/\b(excellent|very good|good)\b/i.test(x) && !/\b(unhealthy|poor|bad|low air)/i.test(x)) return false;
  return /\b(poor|unhealthy|hazardous|low air quality|very poor|very bad|bad air|extremely|severe|high air pollution|very high air pollution)\b/i.test(
    x
  );
}

type CoordsListing = {
  geocode_lat?: number | null;
  geocode_lng?: number | null;
};

function finiteCoord(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Map embed / links: remote DB stores coordinates only as geocode_lat / geocode_lng. */
export function pickListingMapCoordinates(listing: CoordsListing): { lat: number; lng: number } | null {
  const glat = finiteCoord(listing.geocode_lat);
  const glng = finiteCoord(listing.geocode_lng);
  if (glat != null && glng != null && Math.abs(glat) <= 90 && Math.abs(glng) <= 180) {
    return { lat: glat, lng: glng };
  }
  return null;
}
