import type { NormalizedListing, BuildingType, OfferType, ParkingType, Fee } from "./types";

// OLX uses ASCII city slugs in city_query — map to proper Polish names
const CITY_SLUG_MAP: Record<string, string> = {
  wroclaw: "Wrocław",
  warszawa: "Warszawa",
  krakow: "Kraków",
  gdansk: "Gdańsk",
  gdynia: "Gdynia",
  sopot: "Sopot",
  poznan: "Poznań",
  lodz: "Łódź",
  szczecin: "Szczecin",
  bydgoszcz: "Bydgoszcz",
  lublin: "Lublin",
  katowice: "Katowice",
  rzeszow: "Rzeszów",
  bialystok: "Białystok",
  olsztyn: "Olsztyn",
  torun: "Toruń",
  kielce: "Kielce",
};

const KNOWN_CITIES = Object.values(CITY_SLUG_MAP);

function parseNum(s: string): number | null {
  const n = parseInt(s.replace(/[\s\u00a0]/g, ""), 10);
  return isNaN(n) ? null : n;
}

// ─── Card scrape (source=olx.pl) ─────────────────────────────────────────────
// Format: { source, title_raw, listing_url, listing_id, price_numeric_raw,
//           city_query, raw_offer_json.location_raw, ... }

function parseLocationRaw(locationRaw: string): { city: string | null; district: string | null } {
  // "Wrocław, Krzyki - Odświeżono dnia 26 marca 2026"
  const beforeDash = locationRaw.split(" - ")[0]?.trim() ?? "";
  const parts = beforeDash.split(", ");
  return {
    city: parts[0]?.trim() || null,
    district: parts[1]?.trim() || null,
  };
}

function parseRoomsFromTitle(title: string): number | null {
  const lower = title.toLowerCase();
  if (/kawalerka/.test(lower)) return 1;
  const patterns = [
    /(\d+)\s*-\s*pokojo/,
    /(\d+)\s+pokoje/,
    /(\d+)\s+pokoj/,
    /(\d+)\s+pok\./,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match?.[1]) {
      const n = parseInt(match[1], 10);
      if (n >= 1 && n <= 10) return n;
    }
  }
  return null;
}

function parseAreaFromTitle(title: string): number | null {
  const lower = title.toLowerCase();
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*m[²2]/,
    /(\d+(?:[.,]\d+)?)\s*mkw/,
    /(\d+(?:[.,]\d+)?)\s*metr/,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match?.[1]) {
      const n = parseFloat(match[1].replace(",", "."));
      if (n > 10 && n < 1000) return n;
    }
  }
  return null;
}

function parseOlxCard(rawData: Record<string, unknown>): NormalizedListing {
  const rawOfferJson = rawData.raw_offer_json as Record<string, unknown> | null;
  const locationRaw =
    (rawOfferJson?.location_raw as string | null) ??
    (rawData.area_served_raw as string | null);

  const { city: cityFromLocation, district } = locationRaw
    ? parseLocationRaw(locationRaw)
    : { city: null, district: null };

  const citySlug = rawData.city_query as string | null;
  const city =
    cityFromLocation ??
    (citySlug ? (CITY_SLUG_MAP[citySlug.toLowerCase()] ?? null) : null);

  const title = (rawData.title_raw as string | null) ?? null;
  const rentPln =
    rawData.price_currency_raw === "PLN" &&
    typeof rawData.price_numeric_raw === "number"
      ? rawData.price_numeric_raw
      : null;

  const rooms = title ? parseRoomsFromTitle(title) : null;
  const area = title ? parseAreaFromTitle(title) : null;

  return {
    source: "olx.pl",
    external_id: (rawData.listing_id as string) ?? "",
    url: (rawData.listing_url as string | null) ?? null,
    title,
    description: null,
    is_active: true,
    city,
    district,
    neighbourhood: null,
    address: null,
    lat: null,
    lng: null,
    area_m2: area,
    rooms,
    floor: null,
    total_floors: null,
    building_type: null,
    offer_type: null,
    has_provision: null,
    provision_total_pln: null,
    rent_pln: rentPln,
    deposit_pln: null,
    fees: null,
    total_monthly_pln: rentPln,
    available_from: null,
    has_balcony: null,
    has_terrace: null,
    has_elevator: null,
    has_storage_room: null,
    is_furnished: null,
    has_internet: null,
    has_tv: null,
    heating_type: null,
    parking_type: null,
    kitchen_equipment: null,
    bathroom_features: null,
    living_room_features: null,
    extra_features: null,
    nearby: null,
  };
}

// ─── Detail page scrape (source=olx) ─────────────────────────────────────────
// Format: { url, markdown, metadata, scraped_at }
// Markdown structure:
//   KV block: "Powierzchnia: 30 m²", "Poziom: 3", "Winda: Tak", ...
//   ### Opis\n\nTitle\n\nDescription...
//   ### 3 400 zł  (price near contact section)
//   Lokalizacja\n...\nWarszawa, Wola\n\nMazowieckie

function kv(md: string, key: string): string | null {
  // Matches "Key: Value\n" with flexible whitespace
  const match = md.match(new RegExp(key + ":\\s*([^\\n]+)", "i"));
  return match?.[1]?.trim() ?? null;
}

function parseRoomsOlx(raw: string | null): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "kawalerka") return 1;
  const n = parseInt(lower, 10);
  return isNaN(n) ? null : n;
}

function parseBuildingTypeOlx(raw: string | null): BuildingType | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes("apartamentowiec") || r.includes("blok")) return "block";
  if (r.includes("kamienica")) return "tenement";
  if (r.includes("dom") || r.includes("szereg")) return "house";
  if (r.includes("nowe") || r.includes("deweloper")) return "new_development";
  return null;
}

function parseParkingOlx(raw: string | null): ParkingType | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes("podziemny") || r.includes("garaż")) return "underground";
  if (r.includes("naziemn") || r.includes("parking") || r.includes("strefa")) return "surface";
  if (r.includes("brak") || r === "nie") return "none";
  return "surface"; // any parking mentioned is likely surface
}

function parseOlxDetail(rawData: Record<string, unknown>): NormalizedListing {
  const md = (rawData.markdown as string) ?? "";
  const url = (rawData.url as string | null) ?? null;

  // Title: #### Some Title (4 hashes — nearest to contact section)
  const title = md.match(/####\s+(.+)/)?.[1]?.trim() ?? null;

  // Price: ### 3 400 zł  (appears near contact/phone section)
  const priceMatch = md.match(/###\s+([\d\s\u00a0]+)\s*zł/);
  const rentPln = priceMatch ? parseNum(priceMatch[1]) : null;

  // KV block fields
  const areaRaw = kv(md, "Powierzchnia");
  const areaM2 = areaRaw ? parseFloat(areaRaw.replace(",", ".").replace(/[^\d.]/g, "")) : null;

  const roomsRaw = kv(md, "Liczba pokoi");
  const rooms = parseRoomsOlx(roomsRaw);

  const floorRaw = kv(md, "Poziom");
  const floor = floorRaw ? parseInt(floorRaw, 10) : null;

  const elevatorRaw = kv(md, "Winda");
  const hasElevator = elevatorRaw?.toLowerCase() === "tak" ? true
    : elevatorRaw?.toLowerCase() === "nie" ? false : null;

  const furnishedRaw = kv(md, "Umeblowane");
  const isFurnished = furnishedRaw?.toLowerCase() === "tak" ? true
    : furnishedRaw?.toLowerCase() === "nie" ? false : null;

  const buildingRaw = kv(md, "Rodzaj zabudowy");
  const buildingType = parseBuildingTypeOlx(buildingRaw);

  const parkingRaw = kv(md, "Parking");
  const parkingType = parseParkingOlx(parkingRaw);

  const hasBalcony = /\bbalkon\b/i.test(md) ? true : null;

  // Admin fee: "Czynsz (dodatkowo): 500 zł"
  const adminFeeRaw = kv(md, "Czynsz \\(dodatkowo\\)");
  const adminFee = adminFeeRaw ? parseNum(adminFeeRaw) : null;

  const fees: Fee[] = [];
  if (adminFee) fees.push({ fee_type: "czynsz", amount_pln: adminFee });
  const totalMonthlyPln = rentPln !== null
    ? rentPln + fees.reduce((sum, f) => sum + f.amount_pln, 0)
    : null;

  // Offer type: line containing "Prywatne" or "Agencja" (standalone line)
  const isPrivate = /^Prywatne\s*$/m.test(md) || /osoba prywatna/i.test(md);
  const isAgency = /^Agencja\s*$/m.test(md) || /agencja nieruchomości/i.test(md);
  const offerType: OfferType | null = isPrivate ? "private" : isAgency ? "agency" : null;

  // Location: OLX KV block — standalone "Lokalizacja" (no colon/dash) followed by:
  //   ![Location](...)\n\nCity, District\n\nVoivodeship
  // Only match the structured block; skip user-written "Lokalizacja: street, district" variants.
  // OLX KV block structure:
  //   Lokalizacja
  //   ![Location](...)
  //   Krzyżówki 11          ← street address (no comma)
  //   Warszawa, Białołęka   ← city, district (with comma)
  // OLX KV block structure:
  //   Lokalizacja
  //   ![Location](...)
  //   Krzyżówki 11          ← street address (no comma, optional)
  //   Warszawa, Białołęka   ← city, district (with comma)
  let city: string | null = null;
  let district: string | null = null;
  let address: string | null = null;
  const locBlockMatch = md.match(/^Lokalizacja\n([\s\S]{0,400})/m);
  if (locBlockMatch) {
    let addressCandidate: string | null = null;
    for (const line of locBlockMatch[1].split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("[") || trimmed.startsWith("\\")) continue;
      if (!trimmed.includes(",")) {
        // Line without comma — likely a street address preceding the city/district line
        addressCandidate = trimmed;
        continue;
      }
      const parts = trimmed.split(",").map(p => p.trim());
      const cityIdx = parts.findIndex(p => KNOWN_CITIES.includes(p));
      if (cityIdx >= 0) {
        city = parts[cityIdx];
        district = parts[cityIdx + 1] || null;
        address = addressCandidate;
        break;
      }
    }
  }

  // Fallback: extract address from markdown when not in KV block.
  // OLX sellers write "ul./al. X N" in image alt text, title, or description.
  // Cut before OLX footer to avoid false positives from nav links.
  if (!address) {
    const footerIdx = md.indexOf("Aplikacje mobilne");
    const searchArea = footerIdx > 0 ? md.slice(0, footerIdx) : md;
    // Match "ul./al./os./pl. StreetName Number"
    // Exclude: . ] ( in street name (stops at sentence endings and URLs)
    // Require 1-4 digit address number, not followed by more digits or "m" (area unit)
    const addrMatch = searchArea.match(/\b(?:ul|al|os|pl)\.\s+[^,\n\.\]\(]{2,60}? \d{1,3}(?![0-9m])[a-zA-Z]?\b/);
    if (addrMatch) {
      const candidate = addrMatch[0].trim();
      // Reject matches containing two street names ("ul. A i ul. B")
      if (!candidate.includes(" i ul.") && !candidate.includes(" i al.")) {
        address = candidate;
      }
    }
  }

  return {
    source: "olx",
    external_id: "",       // overridden by normalize.ts
    url,
    title,
    description: null,
    is_active: true,
    city,
    district,
    neighbourhood: null,
    address,
    lat: null,
    lng: null,
    area_m2: isNaN(areaM2 as number) ? null : areaM2,
    rooms,
    floor: isNaN(floor as number) ? null : floor,
    total_floors: null,
    building_type: buildingType,
    offer_type: offerType,
    has_provision: offerType === "private" ? false : offerType === "agency" ? true : null,
    provision_total_pln: null,
    rent_pln: rentPln,
    deposit_pln: null,
    fees: fees.length > 0 ? fees : null,
    total_monthly_pln: totalMonthlyPln,
    available_from: null,
    has_balcony: hasBalcony,
    has_terrace: null,
    has_elevator: hasElevator,
    has_storage_room: null,
    is_furnished: isFurnished,
    has_internet: null,
    has_tv: null,
    heating_type: null,
    parking_type: parkingType,
    kitchen_equipment: null,
    bathroom_features: null,
    living_room_features: null,
    extra_features: null,
    nearby: null,
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────
// Auto-detects format based on presence of "markdown" key

export function parseOlxListing(rawData: Record<string, unknown>): NormalizedListing {
  if (typeof rawData.markdown === "string") {
    return parseOlxDetail(rawData);
  }
  return parseOlxCard(rawData);
}
