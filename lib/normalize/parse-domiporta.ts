import type { NormalizedListing, BuildingType, OfferType, ParkingType, Fee } from "./types";

// Domiporta markdown structure:
// - Price: "3 400 zł85 zł/m2" (rent + price-per-sqm concatenated, "m2" not "m²")
// - Card items (uppercase): POWIERZCHNIA, PIĘTRO (N / N), LICZBA POKOI, PARKING
// - Szczegóły list: "- Lokalizacja[mazowieckie](...), [Warszawa](...), [Ursynów](...), Kabaty, Al. ..."
//                  "Czynsz administracyjny\n\n600 zł"
//                  "Dostępne od1.01.2026r." (concatenated!)
//                  "Typ budynkuapartamentowiec" (concatenated!)
// - Informacje dodatkowe: "balkon, garaż, garaż podziemny, winda, umeblowane, ..." (comma list)
// - ## Lokalizacja section: "![...](...)Warszawa, Ursynów, Kabaty, Al. Komisji Edukacji Narodowej 11"
// - Title: first large photo alt text up to the city name

function parseNum(s: string): number | null {
  const n = parseInt(s.replace(/[\s\u00a0]/g, ""), 10);
  return isNaN(n) ? null : n;
}

const KNOWN_CITIES = [
  "Warszawa", "Wrocław", "Kraków", "Gdańsk", "Gdynia", "Sopot",
  "Poznań", "Łódź", "Szczecin", "Bydgoszcz", "Lublin", "Katowice",
  "Rzeszów", "Białystok", "Olsztyn", "Toruń", "Kielce",
];

function parseLocation(md: string): {
  city: string | null;
  district: string | null;
  address: string | null;
} {
  // ## Lokalizacja section: "![...](...)City, District, Neighbourhood, Street"
  const locSectionMatch = md.match(/## Lokalizacja[\s\S]{0,300}?!\[[^\]]*\]\([^)]+\)([^\n]+)/);
  if (locSectionMatch) {
    const line = locSectionMatch[1].trim();
    const parts = line.split(",").map((p) => p.trim());
    const cityIdx = parts.findIndex((p) => KNOWN_CITIES.includes(p));
    if (cityIdx >= 0) {
      const remaining = parts.slice(cityIdx + 2).join(", ").trim();
      return {
        city: parts[cityIdx],
        district: parts[cityIdx + 1] || null,
        address: remaining || null,
      };
    }
    // If no known city found, first part might still be the city
    if (parts[0] && parts[1]) {
      return { city: parts[0], district: parts[1], address: parts.slice(2).join(", ") || null };
    }
  }
  return { city: null, district: null, address: null };
}

function parseBuildingType(raw: string): BuildingType | null {
  const r = raw.toLowerCase();
  if (r.includes("apartamentowiec") || r.includes("blok")) return "block";
  if (r.includes("kamienica")) return "tenement";
  if (r.includes("dom") || r.includes("szeregowy")) return "house";
  if (r.includes("nowe") || r.includes("deweloper")) return "new_development";
  return null;
}

function parseParkingType(raw: string, lowerMd: string): ParkingType | null {
  const r = raw.toLowerCase();
  if (r.includes("podziemny") || r.includes("garaż")) return "underground";
  if (r.includes("naziemn") || r.includes("parking") || r.includes("miejsce")) return "surface";
  if (r === "brak") return "none";
  // Also check features list
  if (lowerMd.includes("garaż podziemny") || lowerMd.includes("parking podziemny")) return "underground";
  if (lowerMd.includes("garaż") || lowerMd.includes("miejsce parkingowe") || lowerMd.includes("miejsce postojowe")) return "surface";
  return null;
}

function parseDate(d: string, m: string, y: string): string {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function parseDomiportaListing(rawData: Record<string, unknown>): NormalizedListing {
  const md = (rawData.markdown as string) ?? "";
  const url = (rawData.url as string | null) ?? null;

  // Title: first large photo alt text up to the city name
  // e.g. "Nowoczesne 2-pokojowe mieszkanie z garażem i basenem Warszawa, Ursynów, ..."
  let title: string | null = null;
  const firstAltMatch = md.match(/!\[([^\]]{20,})\]/);
  if (firstAltMatch) {
    const alt = firstAltMatch[1];
    for (const city of KNOWN_CITIES) {
      const idx = alt.indexOf(city);
      if (idx > 0) {
        title = alt.slice(0, idx).trim() || null;
        break;
      }
    }
  }

  // Price: "3 400 zł85 zł/m2" — rent before "zł\d+ zł/m2"
  const priceMatch = md.match(/([\d\s\u00a0]+)zł\d+\s*zł\/m2/);
  const rentPln = priceMatch ? parseNum(priceMatch[1]) : null;

  // Card items (uppercase labels)
  const areaCardMatch = md.match(/POWIERZCHNIA\s*\n+([\d.,]+)\s*m2/);
  const areaM2 = areaCardMatch ? parseFloat(areaCardMatch[1].replace(",", ".")) : null;

  const floorCardMatch = md.match(/PIĘTRO\s*\n+(\d+)\s*\/\s*(\d+)/);
  const floor = floorCardMatch ? parseInt(floorCardMatch[1], 10) : null;
  const totalFloorsCard = floorCardMatch ? parseInt(floorCardMatch[2], 10) : null;

  const roomsCardMatch = md.match(/LICZBA POKOI\s*\n+(\d+)/);
  const rooms = roomsCardMatch ? parseInt(roomsCardMatch[1], 10) : null;

  const parkingCardRaw = md.match(/PARKING\s*\n+([^\n]+)/)?.[1] ?? "";

  // Szczegóły section (flat concatenated KV pairs)
  // "Liczba pięter w budynku 6", "Piętro 5", "Liczba pokoi 2" — inline format
  const totalFloorsInline = md.match(/Liczba pięter[^\n]*?(\d+)/)?.[1];
  const totalFloors = totalFloorsCard ?? (totalFloorsInline ? parseInt(totalFloorsInline, 10) : null);

  // Building type: "Typ budynkuapartamentowiec" or "Typ budynku apartamentowiec"
  const buildingRaw = md.match(/Typ budynku\s*([\w\s]+?)(?:\n|-\s|\d)/)?.[1]?.trim() ?? "";
  const buildingType = buildingRaw ? parseBuildingType(buildingRaw) : null;

  // Admin fee: "Czynsz administracyjny\n\n600 zł"
  const adminMatch = md.match(/Czynsz administracyjny\s*\n+([\d\s\u00a0]+)\s*zł/);
  const adminFee = adminMatch ? parseNum(adminMatch[1]) : null;

  // Deposit: "Kaucja zwrotna w wysokości X zł" or "Kaucja: X zł"
  const depositMatch = md.match(/[Kk]aucja[^:]*:\s*([\d\s\u00a0]+)\s*zł/)
    ?? md.match(/[Kk]aucja[^\n]*w wysoko[śs]ci\s*([\d\s\u00a0]+)\s*zł/);
  const depositPln = depositMatch ? parseNum(depositMatch[1]) : null;

  const fees: Fee[] = [];
  if (adminFee) fees.push({ fee_type: "czynsz", amount_pln: adminFee });
  const totalMonthlyPln = rentPln !== null
    ? rentPln + fees.reduce((sum, f) => sum + f.amount_pln, 0)
    : null;

  // Available from: "Dostępne od1.01.2026r." or "Dostępne od 1.01.2026"
  const availableMatch = md.match(/Dostępne od\s*(\d{1,2})\.(\d{2})\.(\d{4})/);
  const availableFrom = availableMatch
    ? parseDate(availableMatch[1], availableMatch[2], availableMatch[3])
    : null;

  // Features from "Informacje dodatkowe:" comma-separated list
  const featuresRaw = md.match(/Informacje dodatkowe:\s*([^\n]+)/)?.[1] ?? "";
  const features = featuresRaw.toLowerCase();

  // Also use full markdown for features that appear in description
  const lowerMd = md.toLowerCase();
  const allFeatures = features + " " + lowerMd;

  const hasBalcony = allFeatures.includes("balkon") ? true : null;
  const hasTerrace = allFeatures.includes("taras") ? true : null;
  const hasElevator = allFeatures.includes("winda") ? true : null;
  const hasStorageRoom = allFeatures.includes("komórka lokatorska") || allFeatures.includes("piwnica") ? true : null;
  const isFurnished = allFeatures.includes("umeblowane") || allFeatures.includes("umeblowany") || allFeatures.includes("kuchnia wyposażona") ? true : null;
  const hasInternet = allFeatures.includes("internet") ? true : null;
  const hasTv = allFeatures.includes("kablówka") || allFeatures.includes("telewizj") ? true : null;

  // Offer type: not always present — check for agency/private indicators
  const isPrivate = /oferta prywatna|osoba prywatna|właściciel/i.test(md) && !/agencj[aą]/i.test(md);
  const isAgency = /agencj[aą]|biuro nieruchomości|pośredni/i.test(md);
  const offerType: OfferType | null = isPrivate ? "private" : isAgency ? "agency" : null;

  const parkingType = parseParkingType(parkingCardRaw, allFeatures);

  const kitchenEquipment: string[] = [];
  if (allFeatures.includes("zmywarka") || allFeatures.includes("zmywarką")) kitchenEquipment.push("dishwasher");
  if (allFeatures.includes("lodówka") || allFeatures.includes("lodówkę")) kitchenEquipment.push("fridge");
  if (allFeatures.includes("piekarnik")) kitchenEquipment.push("oven");
  if (allFeatures.includes("indukcyjn") || allFeatures.includes("indukcję")) kitchenEquipment.push("induction_hob");
  if (allFeatures.includes("mikrofal")) kitchenEquipment.push("microwave");

  const bathroomFeatures: string[] = [];
  if (allFeatures.includes("pralka") || allFeatures.includes("pralką") || allFeatures.includes("pralki")) bathroomFeatures.push("washing_machine");
  if (allFeatures.includes("wanna")) bathroomFeatures.push("bathtub");
  if (allFeatures.includes("prysznic")) bathroomFeatures.push("shower");

  const { city, district, address } = parseLocation(md);

  return {
    source: "domiporta",
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

    area_m2: areaM2,
    rooms,
    floor,
    total_floors: totalFloors,
    building_type: buildingType,

    offer_type: offerType,
    has_provision: offerType === "private" ? false : offerType === "agency" ? true : null,
    provision_total_pln: null,

    rent_pln: rentPln,
    deposit_pln: depositPln,
    fees: fees.length > 0 ? fees : null,
    total_monthly_pln: totalMonthlyPln,

    available_from: availableFrom,

    has_balcony: hasBalcony,
    has_terrace: hasTerrace,
    has_elevator: hasElevator,
    has_storage_room: hasStorageRoom,
    is_furnished: isFurnished,
    has_internet: hasInternet,
    has_tv: hasTv,
    heating_type: null,
    parking_type: parkingType,

    kitchen_equipment: kitchenEquipment.length > 0 ? kitchenEquipment : null,
    bathroom_features: bathroomFeatures.length > 0 ? bathroomFeatures : null,
    living_room_features: null,
    extra_features: null,

    nearby: null,
  };
}
