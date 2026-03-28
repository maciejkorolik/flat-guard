import type { NormalizedListing, BuildingType, OfferType, HeatingType, ParkingType, Fee } from "./types";

const KNOWN_CITIES = [
  "Warszawa", "Wrocław", "Kraków", "Gdańsk", "Gdynia", "Sopot",
  "Poznań", "Łódź", "Szczecin", "Bydgoszcz", "Lublin", "Katowice",
  "Rzeszów", "Białystok", "Olsztyn", "Toruń", "Kielce",
];

function parseNum(s: string): number | null {
  // handles "5 200", "8 000", non-breaking spaces
  const n = parseInt(s.replace(/[\s\u00a0]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parseLocation(md: string): {
  city: string | null;
  district: string | null;
  neighbourhood: string | null;
  address: string | null;
} {
  // Matches: [al. Aleja Polski Walczącej, Czerniaków, Mokotów, Warszawa, mazowieckie](url#map)
  const linkMatch = md.match(/\[([^\]]+)\]\([^)]+otodom\.pl[^)]+#map\)/);
  const locationStr = linkMatch?.[1] ?? "";
  const parts = locationStr.split(",").map((s) => s.trim()).filter(Boolean);

  const cityIdx = parts.findIndex((p) => KNOWN_CITIES.includes(p));
  if (cityIdx === -1) return { city: null, district: null, neighbourhood: null, address: null };

  return {
    city: parts[cityIdx] ?? null,
    district: parts[cityIdx - 1] ?? null,
    neighbourhood: parts[cityIdx - 2] ?? null,
    address: parts[cityIdx - 3] ?? null,
  };
}

function parseBuildingType(raw: string): BuildingType | null {
  const r = raw.toLowerCase();
  if (r.includes("blok") || r.includes("apartamentowiec")) return "block";
  if (r.includes("kamienica")) return "tenement";
  if (r.includes("dom") || r.includes("wolnostojący")) return "house";
  if (r.includes("nowe") || r.includes("deweloper")) return "new_development";
  return null;
}

function parseHeatingType(raw: string): HeatingType | null {
  const r = raw.toLowerCase();
  if (r.includes("gazowe") || r.includes("gaz")) return "gas";
  if (r.includes("elektryczne") || r.includes("elektryczn")) return "electric";
  if (r.includes("miejskie") || r.includes("centralne")) return "district";
  if (r.includes("węgl") || r.includes("piec kaflowy")) return "coal";
  if (r.includes("pompa ciepła")) return "heat_pump";
  return null;
}

export function parseOtodomListing(rawData: Record<string, unknown>): NormalizedListing {
  const md = (rawData.markdown as string) ?? "";
  const url = (rawData.url as string | null) ?? null;

  // Title: # Mokotów \| 3 pok. \| ...
  const title = md.match(/^#\s+(.+)$/m)?.[1]?.replace(/\\\|/g, "|").trim() ?? null;

  // Rent: **5 200 zł**/miesiąc
  const rentMatch = md.match(/\*\*([\d\s\u00a0]+)\s*zł\*\*\/miesiąc/);
  const rentPln = rentMatch ? parseNum(rentMatch[1]) : null;

  // Czynsz (admin fee): + Czynsz 850 zł
  const czynszMatch = md.match(/\+\s*Czynsz\s+([\d\s\u00a0]+)\s*zł/);
  const czynsz = czynszMatch ? parseNum(czynszMatch[1]) : null;

  // Area: Powierzchnia:\n\n52m²
  const areaMatch = md.match(/Powierzchnia:\s*\n+\s*([\d.,]+)\s*m[²2]/);
  const areaM2 = areaMatch ? parseFloat(areaMatch[1].replace(",", ".")) : null;

  // Rooms: Liczba pokoi:\n\n3
  const roomsMatch = md.match(/Liczba pokoi:\s*\n+\s*(\d+)/);
  const rooms = roomsMatch ? parseInt(roomsMatch[1], 10) : null;

  // Floor: Piętro:\n\n2/5
  const floorMatch = md.match(/Piętro:\s*\n+\s*(\d+)\/(\d+)/);
  const floor = floorMatch ? parseInt(floorMatch[1], 10) : null;
  const totalFloors = floorMatch ? parseInt(floorMatch[2], 10) : null;

  // Available from: Dostępne od:\n\n2026-04-01
  const availableFrom = md.match(/Dostępne od:\s*\n+\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

  // Deposit: Kaucja:\n\n8 000 zł
  const depositMatch = md.match(/Kaucja:\s*\n+\s*([\d\s\u00a0]+)\s*(?:zł|PLN)/);
  const depositPln = depositMatch ? parseNum(depositMatch[1]) : null;

  // Offer type: Typ ogłoszeniodawcy:\n\nprywatny
  const offerTypeRaw = md.match(/Typ ogłoszeniodawcy:\s*\n+\s*([^\n]+)/)?.[1]?.toLowerCase().trim() ?? "";
  const offerType: OfferType | null = offerTypeRaw.includes("prywatny") ? "private"
    : offerTypeRaw.includes("agencja") ? "agency"
    : offerTypeRaw.includes("deweloper") ? "developer"
    : null;

  // Elevator: Winda:\n\ntak
  const elevatorRaw = md.match(/Winda:\s*\n+\s*(tak|nie)/i)?.[1]?.toLowerCase();
  const hasElevator = elevatorRaw === "tak" ? true : elevatorRaw === "nie" ? false : null;

  // Building type: Rodzaj zabudowy:\n\nblok
  const buildingRaw = md.match(/Rodzaj zabudowy:\s*\n+\s*([^\n]+)/)?.[1] ?? "";
  const buildingType = parseBuildingType(buildingRaw);

  // Heating: Ogrzewanie:\n\n...
  const heatingRaw = md.match(/Ogrzewanie:\s*\n+\s*([^\n]+)/)?.[1] ?? "";
  const heatingType = parseHeatingType(heatingRaw);

  // Extra info: Informacje dodatkowe:\n\nbalkon garaż/miejsce parkingowe
  const extraInfoRaw = md.match(/Informacje dodatkowe:\s*\n+\s*([^\n]+)/)?.[1]?.toLowerCase() ?? "";
  const hasBalcony = extraInfoRaw.includes("balkon") ? true : null;
  const hasTerrace = extraInfoRaw.includes("taras") ? true : null;
  const hasStorageRoom = extraInfoRaw.includes("piwnica") || extraInfoRaw.includes("komórka") ? true : null;
  const parkingType: ParkingType | null = extraInfoRaw.includes("garaż podziemny") ? "underground"
    : extraInfoRaw.includes("garaż") || extraInfoRaw.includes("miejsce parkingowe") ? "surface"
    : null;

  // Equipment: Wyposażenie:\n\nmeble pralka zmywarka lodówka...
  const equipRaw = md.match(/Wyposażenie:\s*\n+\s*([^\n]+)/)?.[1]?.toLowerCase() ?? "";
  const isFurnished = equipRaw.includes("meble") ? true : null;

  const kitchenEquipment: string[] = [];
  if (equipRaw.includes("zmywarka")) kitchenEquipment.push("dishwasher");
  if (equipRaw.includes("lodówka")) kitchenEquipment.push("fridge");
  if (equipRaw.includes("piekarnik")) kitchenEquipment.push("oven");
  if (equipRaw.includes("indukcj") || equipRaw.includes("kuchenka")) kitchenEquipment.push("induction_hob");
  if (equipRaw.includes("mikrofalówka") || equipRaw.includes("mikrofala")) kitchenEquipment.push("microwave");

  const bathroomFeatures: string[] = [];
  if (equipRaw.includes("pralka")) bathroomFeatures.push("washing_machine");
  if (equipRaw.includes("suszarka")) bathroomFeatures.push("dryer");

  const livingRoomFeatures: string[] = [];
  if (equipRaw.includes("klimatyzacja")) livingRoomFeatures.push("ac");

  // Media: internet telewizja kablowa
  const mediaRaw = md.match(/Media:\s*\n+\s*([^\n]+)/)?.[1]?.toLowerCase() ?? "";
  const hasInternet = mediaRaw.includes("internet") ? true : null;
  const hasTv = mediaRaw.includes("telewizja") ? true : null;

  // Location
  const { city, district, neighbourhood, address } = parseLocation(md);

  // Fees
  const fees: Fee[] = [];
  if (czynsz) fees.push({ fee_type: "czynsz", amount_pln: czynsz });
  const totalMonthlyPln = rentPln !== null
    ? rentPln + fees.reduce((sum, f) => sum + f.amount_pln, 0)
    : null;

  return {
    source: "otodom",
    external_id: "",       // overridden by normalize.ts
    url,
    title,
    description: null,
    is_active: true,

    city,
    district,
    neighbourhood,
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
    heating_type: heatingType,
    parking_type: parkingType,

    kitchen_equipment: kitchenEquipment.length > 0 ? kitchenEquipment : null,
    bathroom_features: bathroomFeatures.length > 0 ? bathroomFeatures : null,
    living_room_features: livingRoomFeatures.length > 0 ? livingRoomFeatures : null,
    extra_features: null,

    nearby: null,
  };
}
