import type { NormalizedListing, BuildingType, OfferType, ParkingType, Fee } from "./types";

function parseNum(s: string): number | null {
  const n = parseInt(s.replace(/[\s\u00a0]/g, ""), 10);
  return isNaN(n) ? null : n;
}

const KNOWN_CITIES = [
  "Warszawa", "Wrocław", "Kraków", "Gdańsk", "Gdynia", "Sopot",
  "Poznań", "Łódź", "Szczecin", "Bydgoszcz", "Lublin", "Katowice",
  "Rzeszów", "Białystok", "Olsztyn", "Toruń", "Kielce",
];

// Voivodeships and noise phrases that should never appear in city/district
const STRIP_WORDS = [
  "Mazowieckie", "Małopolskie", "Dolnośląskie", "Pomorskie", "Wielkopolskie",
  "Śląskie", "Lubelskie", "Podkarpackie", "Podlaskie", "Warmińsko", "Kujawsko",
  "Łódzkiie", "Świętokrzyskie", "Lubuskie", "Opolskie", "Zachodniopomorskie",
  "Zobacz", "Sprawdź", "Opis", "Pokaż",
];

function cleanPart(s: string): string | null {
  // Remove any trailing noise words (stop at first noise token)
  const words = s.trim().split(/\s+/);
  const cut = words.findIndex((w) => STRIP_WORDS.some((n) => w.startsWith(n)));
  const clean = (cut === -1 ? words : words.slice(0, cut)).join(" ").trim();
  return clean || null;
}

function parseLocation(md: string): {
  city: string | null;
  district: string | null;
  address: string | null;
} {
  // Iterate only over ## headings (single line, no newline bleed).
  // Gratka location breadcrumb formats:
  //   "Street  City"
  //   "Street  City, District"
  //   "Street  Voivodeship, City, District, Neighbourhood"
  //   "City, District"
  for (const hMatch of md.matchAll(/^##\s+([^\n]+)$/gm)) {
    const line = hMatch[1].trim();

    // Split address from breadcrumb at first double-space
    const twoSpaceIdx = line.search(/\s{2,}/);
    let address: string | null = null;
    let breadcrumb: string;

    if (twoSpaceIdx > -1) {
      address = line.slice(0, twoSpaceIdx).trim();
      breadcrumb = line.slice(twoSpaceIdx).trim();
    } else {
      breadcrumb = line;
    }

    // Split breadcrumb by comma → find the known city, take next part as district
    const parts = breadcrumb.split(",").map((p) => p.trim());
    const cityIdx = parts.findIndex((p) => KNOWN_CITIES.includes(p));
    if (cityIdx === -1) continue;

    return {
      address: address || null,
      city: parts[cityIdx],
      district: cleanPart(parts[cityIdx + 1] ?? "") ?? null,
    };
  }

  return { city: null, district: null, address: null };
}

function parseBuildingType(raw: string): BuildingType | null {
  const r = raw.toLowerCase();
  if (r.includes("blok") || r.includes("apartamentowiec")) return "block";
  if (r.includes("kamienica")) return "tenement";
  if (r.includes("dom") || r.includes("szeregowy")) return "house";
  if (r.includes("nowe") || r.includes("deweloper")) return "new_development";
  return null;
}

export function parseGratkaListing(rawData: Record<string, unknown>): NormalizedListing {
  const md = (rawData.markdown as string) ?? "";
  const url = (rawData.url as string | null) ?? null;

  // Title: # Saska Kępa \| 2 pokojowe \| nowe do wynajęcia
  const title = md.match(/^#\s+(.+)$/m)?.[1]?.replace(/\\\|/g, "|").trim() ?? null;

  // Price: "4 800 zł109 zł/m²" — rent is before "zł\d+ zł/m²"
  const priceMatch = md.match(/([\d\s\u00a0]+)zł\d+\s*zł\/m[²2]/);
  const rentPln = priceMatch ? parseNum(priceMatch[1]) : null;

  // Rooms card: Pokoje ... **2**
  const roomsMatch = md.match(/Pokoje[\s\S]{0,80}\*\*(\d+)\*\*/);
  const rooms = roomsMatch ? parseInt(roomsMatch[1], 10) : null;

  // Area card: Powierzchnia ... **44 m²**
  const areaMatch = md.match(/Powierzchnia[\s\S]{0,80}\*\*([\d.,]+)\s*m[²2]\*\*/);
  const areaM2 = areaMatch ? parseFloat(areaMatch[1].replace(",", ".")) : null;

  // Floor card: Piętro ... **2 z 5**
  const floorMatch = md.match(/Piętro[\s\S]{0,80}\*\*(\d+)\s*z\s*(\d+)\*\*/);
  const floor = floorMatch ? parseInt(floorMatch[1], 10) : null;
  const totalFloors = floorMatch ? parseInt(floorMatch[2], 10) : null;

  // Total floors (structural field): Liczba pięter\n\n5
  const totalFloorsMatch = md.match(/Liczba pięter\s*\n+\s*(\d+)/);
  const totalFloorsFromField = totalFloorsMatch ? parseInt(totalFloorsMatch[1], 10) : null;

  // Building type: Typ domu\n\nInny / Blok / Kamienica
  const buildingRaw = md.match(/Typ domu\s*\n+([^\n]+)/)?.[1] ?? "";
  const buildingType = parseBuildingType(buildingRaw);

  // Deposit from description: "Kaucja zwrotna: 6 000 zł" or "Kaucja: X zł"
  const depositMatch = md.match(/[Kk]aucja[^:]*:\s*([\d\s\u00a0]+)\s*zł/);
  const depositPln = depositMatch ? parseNum(depositMatch[1]) : null;

  // Admin fees: "Opłaty do administracji: ok. 650 zł"
  const adminMatch = md.match(/[Oo]płaty do administracji[^:]*:\s*(?:ok\.\s*)?([\d\s\u00a0]+)\s*zł/);
  const adminFee = adminMatch ? parseNum(adminMatch[1]) : null;

  // Parking fee — extract separately from description if mentioned
  const parkingMatch = md.match(/[Mm]iejsce parkingowe[^:]*:\s*(?:ok\.\s*)?([\d\s\u00a0]+)\s*zł/);
  const parkingFee = parkingMatch ? parseNum(parkingMatch[1]) : null;

  // Fees array
  const fees: Fee[] = [];
  if (adminFee) fees.push({ fee_type: "czynsz", amount_pln: adminFee });
  if (parkingFee) fees.push({ fee_type: "parking", amount_pln: parkingFee });
  const totalMonthlyPln = rentPln !== null
    ? rentPln + fees.reduce((sum, f) => sum + f.amount_pln, 0)
    : null;

  // Offer type: "Oferta prywatna" → private
  const isPrivate = /[Oo]ferta prywatna/i.test(md);
  const isAgency = /agencj[aą]/i.test(md) && !isPrivate;
  const offerType: OfferType | null = isPrivate ? "private" : isAgency ? "agency" : null;

  // Features from description text
  const lowerMd = md.toLowerCase();
  const hasBalcony = lowerMd.includes("balkon") || lowerMd.includes("balkonu") ? true : null;
  const hasTerrace = lowerMd.includes("taras") ? true : null;
  const isFurnished = lowerMd.includes("umeblowany") || lowerMd.includes("umeblowanym") || lowerMd.includes("w pełni umeblowane") ? true : null;

  const parkingType: ParkingType | null = lowerMd.includes("garażu podziemnym") || lowerMd.includes("garaż podziemny") ? "underground"
    : lowerMd.includes("garaż") || lowerMd.includes("miejsce parkingowe") ? "surface"
    : null;

  // Kitchen equipment from description
  const kitchenEquipment: string[] = [];
  if (lowerMd.includes("zmywarka") || lowerMd.includes("zmywarką")) kitchenEquipment.push("dishwasher");
  if (lowerMd.includes("lodówka") || lowerMd.includes("lodówkę") || lowerMd.includes("lodówką")) kitchenEquipment.push("fridge");
  if (lowerMd.includes("piekarnik")) kitchenEquipment.push("oven");
  if (lowerMd.includes("indukcyjn") || lowerMd.includes("indukcję")) kitchenEquipment.push("induction_hob");
  if (lowerMd.includes("mikrofal")) kitchenEquipment.push("microwave");

  const bathroomFeatures: string[] = [];
  if (lowerMd.includes("pralka") || lowerMd.includes("pralką") || lowerMd.includes("pralki")) bathroomFeatures.push("washing_machine");

  // Location
  const { city, district, address } = parseLocation(md);

  return {
    source: "gratka",
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
    total_floors: totalFloors ?? totalFloorsFromField,
    building_type: buildingType,

    offer_type: offerType,
    has_provision: offerType === "private" ? false : offerType === "agency" ? true : null,
    provision_total_pln: null,

    rent_pln: rentPln,
    deposit_pln: depositPln,
    fees: fees.length > 0 ? fees : null,
    total_monthly_pln: totalMonthlyPln,

    available_from: null,

    has_balcony: hasBalcony,
    has_terrace: hasTerrace,
    has_elevator: null,
    has_storage_room: null,
    is_furnished: isFurnished,
    has_internet: null,
    has_tv: null,
    heating_type: null,
    parking_type: parkingType,

    kitchen_equipment: kitchenEquipment.length > 0 ? kitchenEquipment : null,
    bathroom_features: bathroomFeatures.length > 0 ? bathroomFeatures : null,
    living_room_features: null,
    extra_features: null,

    nearby: null,
  };
}
