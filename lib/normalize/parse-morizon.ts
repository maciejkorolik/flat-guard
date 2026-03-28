import type { NormalizedListing, BuildingType, OfferType, ParkingType, Fee } from "./types";

// Morizon markdown format is nearly identical to Gratka:
// - Price: "7 000 zł101 zł/m²" (rent + price-per-sqm concatenated)
// - Cards: Pokoje **N**, Powierzchnia **N m²**, Piętro **N z N**
// - Location: ## Street  voivodeship, City, District[, Neighbourhood]
// - Details section (flat KV): Dostępne od\n\nDD.MM.YYYY, Piętro\n\nN/N

function parseNum(s: string): number | null {
  const n = parseInt(s.replace(/[\s\u00a0]/g, ""), 10);
  return isNaN(n) ? null : n;
}

const KNOWN_CITIES = [
  "Warszawa", "Wrocław", "Kraków", "Gdańsk", "Gdynia", "Sopot",
  "Poznań", "Łódź", "Szczecin", "Bydgoszcz", "Lublin", "Katowice",
  "Rzeszów", "Białystok", "Olsztyn", "Toruń", "Kielce",
];

const STRIP_WORDS = [
  "Mazowieckie", "mazowieckie", "Małopolskie", "małopolskie",
  "Dolnośląskie", "dolnośląskie", "Pomorskie", "pomorskie",
  "Wielkopolskie", "wielkopolskie", "Śląskie", "śląskie",
  "Lubelskie", "lubelskie", "Podkarpackie", "podkarpackie",
  "Podlaskie", "podlaskie", "Warmińsko", "Kujawsko",
  "Zobacz", "Sprawdź", "Opis", "Pokaż",
];

function cleanPart(s: string): string | null {
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
  // Same ## heading format as Gratka: "## Street  [voivodeship,] City, District[, Neighbourhood]"
  for (const hMatch of md.matchAll(/^##\s+([^\n]+)$/gm)) {
    const line = hMatch[1].trim();
    const twoSpaceIdx = line.search(/\s{2,}/);
    let address: string | null = null;
    let breadcrumb: string;
    if (twoSpaceIdx > -1) {
      address = line.slice(0, twoSpaceIdx).trim();
      breadcrumb = line.slice(twoSpaceIdx).trim();
    } else {
      breadcrumb = line;
    }
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
  if (r.includes("apartamentowiec") || r.includes("blok")) return "block";
  if (r.includes("kamienica")) return "tenement";
  if (r.includes("dom") || r.includes("szeregowy")) return "house";
  if (r.includes("nowe") || r.includes("deweloper")) return "new_development";
  return null;
}

function parseDate(d: string, m: string, y: string): string {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function parseMorizonListing(rawData: Record<string, unknown>): NormalizedListing {
  const md = (rawData.markdown as string) ?? "";
  const url = (rawData.url as string | null) ?? null;

  // Title: # Heading
  const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;

  // Price: "7 000 zł101 zł/m²" — rent before "zł\d+ zł/m²"
  const priceMatch = md.match(/([\d\s\u00a0]+)zł\d+\s*zł\/m[²2]/);
  const rentPln = priceMatch ? parseNum(priceMatch[1]) : null;

  // Card items
  const roomsMatch = md.match(/Pokoje[\s\S]{0,80}\*\*(\d+)\*\*/);
  const rooms = roomsMatch ? parseInt(roomsMatch[1], 10) : null;

  const areaMatch = md.match(/Powierzchnia[\s\S]{0,80}\*\*([\d.,]+)\s*m[²2]\*\*/);
  const areaM2 = areaMatch ? parseFloat(areaMatch[1].replace(",", ".")) : null;

  // Floor from card: "**3 z 5**"
  const floorCardMatch = md.match(/Piętro[\s\S]{0,80}\*\*(\d+)\s*z\s*(\d+)\*\*/);
  const floor = floorCardMatch ? parseInt(floorCardMatch[1], 10) : null;
  const totalFloorsCard = floorCardMatch ? parseInt(floorCardMatch[2], 10) : null;

  // Floor from details section: "Piętro\n\n3/5" (standalone line)
  const floorDetailMatch = md.match(/^Piętro\s*\n+(\d+)\/(\d+)\s*$/m);
  const floorDetail = floorDetailMatch ? parseInt(floorDetailMatch[1], 10) : null;
  const totalFloorsDetail = floorDetailMatch ? parseInt(floorDetailMatch[2], 10) : null;

  // Total floors from dedicated field: "Liczba pięter\n\n5"
  const totalFloorsFieldMatch = md.match(/Liczba pięter\s*\n+\s*(\d+)/);
  const totalFloorsField = totalFloorsFieldMatch ? parseInt(totalFloorsFieldMatch[1], 10) : null;

  // Building type: "Typ domu\n\nBlok" or "Typ budynku\n\napartamentowiec"
  const buildingRaw = md.match(/Typ (?:domu|budynku)\s*\n+([^\n]+)/)?.[1] ?? "";
  const buildingType = buildingRaw ? parseBuildingType(buildingRaw) : null;

  // Available from: "Dostępne od\n\n16.02.2026" (DD.MM.YYYY)
  const availableMatch = md.match(/Dostępne od\s*\n+(\d{1,2})\.(\d{2})\.(\d{4})/);
  const availableFrom = availableMatch
    ? parseDate(availableMatch[1], availableMatch[2], availableMatch[3])
    : null;

  // Deposit: "Kaucja: 7000 zł" or "Kaucja zwrotna: X zł"
  const depositMatch = md.match(/[Kk]aucja[^:]*:\s*([\d\s\u00a0]+)\s*zł/);
  const depositPln = depositMatch ? parseNum(depositMatch[1]) : null;

  // Admin fee: "czynsz administracyjny w wysokości 1500 zł"
  const adminMatch = md.match(/czynsz administracyjny[^:]*w wysoko[śs]ci\s*([\d\s\u00a0]+)\s*zł/i);
  const adminFee = adminMatch ? parseNum(adminMatch[1]) : null;

  // Parking fee: "dodatkowo płatne: 300 zł"
  const parkingFeeMatch = md.match(/dodatkow[oe]\s+płatn[aey][^:]*:\s*([\d\s\u00a0]+)\s*zł/i);
  const parkingFee = parkingFeeMatch ? parseNum(parkingFeeMatch[1]) : null;

  const fees: Fee[] = [];
  if (adminFee) fees.push({ fee_type: "czynsz", amount_pln: adminFee });
  if (parkingFee) fees.push({ fee_type: "parking", amount_pln: parkingFee });
  const totalMonthlyPln = rentPln !== null
    ? rentPln + fees.reduce((sum, f) => sum + f.amount_pln, 0)
    : null;

  // Offer type: "osoba prywatna" → private, "agencja"/"pośrednik" → agency
  const isPrivate = /osoba prywatna/i.test(md);
  const isAgency = /agencj[aą]/i.test(md) && !isPrivate;
  const offerType: OfferType | null = isPrivate ? "private" : isAgency ? "agency" : null;

  // Features from description + amenities block
  const lowerMd = md.toLowerCase();
  const hasBalcony = lowerMd.includes("balkon") ? true : null;
  const hasTerrace = lowerMd.includes("taras") ? true : null;
  const hasElevator = lowerMd.includes("winda") ? true : null;
  const hasStorageRoom = lowerMd.includes("komórka lokatorska") || lowerMd.includes("piwnica") ? true : null;
  const isFurnished = lowerMd.includes("umeblowane") || lowerMd.includes("umeblowany") || lowerMd.includes("meblowane") ? true : null;
  const hasInternet = lowerMd.includes("internet") ? true : null;
  const hasTv = lowerMd.includes("telewizj") || lowerMd.includes("kablówka") ? true : null;

  const parkingType: ParkingType | null =
    lowerMd.includes("garaż podziemny") || lowerMd.includes("parking podziemny") || lowerMd.includes("podziemnym")
      ? "underground"
      : lowerMd.includes("garaż") || lowerMd.includes("miejsce parkingowe") || lowerMd.includes("parking")
      ? "surface"
      : null;

  const kitchenEquipment: string[] = [];
  if (lowerMd.includes("zmywarka") || lowerMd.includes("zmywarką")) kitchenEquipment.push("dishwasher");
  if (lowerMd.includes("lodówka") || lowerMd.includes("lodówkę") || lowerMd.includes("lodówką")) kitchenEquipment.push("fridge");
  if (lowerMd.includes("piekarnik")) kitchenEquipment.push("oven");
  if (lowerMd.includes("indukcyjn") || lowerMd.includes("indukcję")) kitchenEquipment.push("induction_hob");
  if (lowerMd.includes("mikrofalówka") || lowerMd.includes("mikrofal")) kitchenEquipment.push("microwave");

  const bathroomFeatures: string[] = [];
  if (lowerMd.includes("pralka") || lowerMd.includes("pralką") || lowerMd.includes("pralki")) bathroomFeatures.push("washing_machine");

  const { city, district, address } = parseLocation(md);

  return {
    source: "morizon",
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
    floor: floor ?? floorDetail,
    total_floors: totalFloorsCard ?? totalFloorsDetail ?? totalFloorsField,
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
