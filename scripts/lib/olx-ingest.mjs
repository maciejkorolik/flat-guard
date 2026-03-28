import fs from "node:fs";
import path from "node:path";

const CITY_REGEX = /^wroc(?:ł|l)aw/i;

export const NORMALIZED_OLX_COLUMNS = [
  "source",
  "external_id",
  "url",
  "title",
  "description",
  "city",
  "district",
  "neighbourhood",
  "address",
  "area_m2",
  "rooms",
  "floor",
  "building_type",
  "offer_type",
  "rent_pln",
  "fees",
  "total_monthly_pln",
  "has_elevator",
  "is_furnished",
  "parking_type",
];

export const ACTIVE_NORMALIZED_COLUMNS = [
  "source",
  "external_id",
  "url",
  "title",
  "description",
  "city",
  "district",
  "neighbourhood",
  "address",
  "area_m2",
  "rooms",
  "floor",
  "building_type",
  "offer_type",
  "rent_pln",
  "fees",
  "total_monthly_pln",
  "has_elevator",
  "is_furnished",
  "parking_type",
];

export const CURRENTLY_UNFILLED_NORMALIZED_COLUMNS = [
  "lat",
  "lng",
  "location",
  "total_floors",
  "has_provision",
  "provision_total_pln",
  "deposit_pln",
  "available_from",
  "has_balcony",
  "has_terrace",
  "has_storage_room",
  "has_internet",
  "has_tv",
  "heating_type",
  "kitchen_equipment",
  "bathroom_features",
  "living_room_features",
  "extra_features",
  "nearby",
];

export function canonicalizeListingUrl(url) {
  if (typeof url !== "string" || url.trim() === "") {
    return null;
  }

  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0]?.trim() || null;
  }
}

function nonEmptyString(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseInteger(value) {
  const raw = nonEmptyString(value);
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/[^\d-]/g, "");
  if (normalized === "" || normalized === "-") {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumeric(value) {
  const raw = nonEmptyString(value);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value) {
  const raw = nonEmptyString(value)?.toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw === "tak" || raw === "yes") {
    return true;
  }
  if (raw === "nie" || raw === "no") {
    return false;
  }
  return null;
}

function deriveCity(record) {
  const areaServed = nonEmptyString(record.area_served_raw);
  if (areaServed && CITY_REGEX.test(areaServed)) {
    return "Wrocław";
  }

  const cityQuery = nonEmptyString(record.city_query);
  if (!cityQuery) {
    return null;
  }

  return cityQuery.charAt(0).toUpperCase() + cityQuery.slice(1).toLowerCase();
}

function deriveDistrict(record) {
  const breadcrumb = nonEmptyString(record.district_breadcrumb_raw);
  if (breadcrumb) {
    return breadcrumb;
  }

  const areaServed = nonEmptyString(record.area_served_raw);
  if (!areaServed) {
    return null;
  }

  const secondPart = areaServed.split(",")[1];
  if (!secondPart) {
    return null;
  }

  const district = secondPart.split("-")[0]?.trim();
  return district || null;
}

export function isFilled(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

export function projectOlxRecord(record) {
  const source = nonEmptyString(record.source) || "olx";
  const listingUrl = canonicalizeListingUrl(record.listing_url);
  const externalId =
    nonEmptyString(record.listing_id) ||
    (listingUrl ? `url:${listingUrl}` : `fallback:${JSON.stringify(record)}`);
  const scrapedAt = nonEmptyString(record.scraped_at_utc) || new Date().toISOString();
  const rent = parseInteger(record.price_numeric_raw);
  const additionalRent = parseInteger(record.additional_rent_raw);

  return {
    source,
    external_id: externalId,
    url: listingUrl,
    title: nonEmptyString(record.title_raw),
    description: nonEmptyString(record.description_raw),
    scraped_at: scrapedAt,
    city: deriveCity(record),
    district: deriveDistrict(record),
    neighbourhood: nonEmptyString(record.district_hint_raw),
    address: nonEmptyString(record.street_hint_raw),
    area_m2: parseNumeric(record.area_m2_detail_raw),
    rooms: parseInteger(record.rooms_detail_raw),
    floor: parseInteger(record.floor_raw),
    building_type: nonEmptyString(record.building_type_raw),
    offer_type: "rent",
    rent_pln: rent,
    fees:
      additionalRent === null
        ? null
        : {
            administrative_rent_pln: additionalRent,
          },
    total_monthly_pln:
      rent === null ? null : rent + (additionalRent === null ? 0 : additionalRent),
    has_elevator: parseBoolean(record.elevator_raw),
    is_furnished: parseBoolean(record.furnished_raw),
    parking_type: nonEmptyString(record.parking_raw),
  };
}

export function readJsonl(jsonlPath) {
  const resolvedPath = path.resolve(jsonlPath);
  const content = fs.readFileSync(resolvedPath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Failed to parse JSONL line ${index + 1}: ${error.message}`);
      }
    });
}

export function buildColumnCompleteness(rows, columns) {
  return columns
    .map((column) => {
      const filledCount = rows.reduce((count, row) => count + (isFilled(row[column]) ? 1 : 0), 0);
      return {
        column,
        filledCount,
        totalCount: rows.length,
        percentFilled: rows.length === 0 ? 0 : Number(((filledCount / rows.length) * 100).toFixed(1)),
      };
    })
    .sort((left, right) => right.percentFilled - left.percentFilled || left.column.localeCompare(right.column));
}

export function dedupeProjectedRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    byKey.set(`${row.source}:${row.external_id}`, row);
  }
  return [...byKey.values()];
}
