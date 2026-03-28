#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const SOURCE = "olx.pl";
const CITY = "wroclaw";
const BASE_URL =
  "https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/";

function parseArgs(argv) {
  const args = {
    target: 150,
    maxPages: 25,
    delayMs: 900,
    detailDelayMs: 250,
    outDir: "data/raw",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--target" && next) args.target = Number(next);
    if (arg === "--max-pages" && next) args.maxPages = Number(next);
    if (arg === "--delay-ms" && next) args.delayMs = Number(next);
    if (arg === "--detail-delay-ms" && next) args.detailDelayMs = Number(next);
    if (arg === "--out-dir" && next) args.outDir = next;
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pageUrl(page) {
  if (page <= 1) return BASE_URL;
  return `${BASE_URL}?page=${page}`;
}

function toIsoSafeTs(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function extractListingIdFromUrl(url) {
  const match = url.match(/-ID([A-Za-z0-9]+)\.html/i);
  return match ? match[1] : null;
}

function parseNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMaxPageFromHtml(html) {
  const matches = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1]));
  if (!matches.length) return 1;
  return Math.max(...matches.filter(Number.isFinite), 1);
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const regex =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(regex)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  return blocks;
}

function offersFromJsonLd(jsonLdBlocks) {
  const offers = [];
  for (const block of jsonLdBlocks) {
    if (!block || typeof block !== "object") continue;
    if (block["@type"] !== "Product") continue;
    const nestedOffers = block?.offers?.offers;
    if (!Array.isArray(nestedOffers)) continue;
    for (const offer of nestedOffers) {
      if (!offer || typeof offer !== "object") continue;
      offers.push(offer);
    }
  }
  return offers;
}

function decodeHtmlEntities(input) {
  if (!input) return "";
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(input) {
  return decodeHtmlEntities(
    input
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(input, regex) {
  const m = input.match(regex);
  return m ? m[1] : null;
}

function firstMatchGroup(input, regex, group = 1) {
  const match = input.match(regex);
  return match ? match[group] : null;
}

function extractBreadcrumbDistrict(html) {
  const match = html.match(
    /href="[^"]*search%5Bdistrict_id%5D=(\d+)[^"]*"[^>]*>\s*Wynajem - ([^<]+)\s*<\/a>/i,
  );
  if (!match) {
    return { districtId: null, districtLabel: null };
  }
  return {
    districtId: match[1] || null,
    districtLabel: decodeHtmlEntities(match[2] || "").trim() || null,
  };
}

function extractParameterMap(html) {
  const params = {};
  const allowedKeys = new Set([
    "Zwierzęta",
    "Winda",
    "Parking",
    "Poziom",
    "Umeblowane",
    "Rodzaj zabudowy",
    "Powierzchnia",
    "Liczba pokoi",
    "Czynsz (dodatkowo)",
  ]);
  for (const match of html.matchAll(/<p[^>]*class="css-odhutu"[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(match[1] || "");
    if (!text) continue;
    if (!text.includes(":")) {
      params.source_business_type = text;
      continue;
    }
    const separator = text.indexOf(":");
    const key = text.slice(0, separator).trim();
    const value = text.slice(separator + 1).trim();
    if (!key || !value || !allowedKeys.has(key)) continue;
    params[key] = value;
  }
  return params;
}

function extractSellerProfile(html) {
  return {
    sellerName:
      stripTags(firstMatch(html, /data-testid="user-profile-user-name"[^>]*>([\s\S]*?)<\/h4>/i) || "") ||
      null,
    sellerProfilePath:
      firstMatchGroup(html, /href="(\/oferty\/uzytkownik\/[^"]+)"[^>]*data-testid="user-profile-link"/i) ||
      null,
    sellerMemberSinceRaw:
      stripTags(firstMatch(html, /data-testid="member-since"[^>]*>([\s\S]*?)<\/p>/i) || "") || null,
    sellerLastSeenRaw:
      stripTags(firstMatch(html, /data-testid="lastSeenBox"[^>]*>([\s\S]*?)<\/p>/i) || "") || null,
  };
}

function extractMaskedPhone(html) {
  const idx = html.indexOf('data-testid="phones-container"');
  if (idx === -1) return null;
  const snippet = html.slice(idx, idx + 4000);
  return (
    stripTags(firstMatch(snippet, /<p[^>]*class="css-12j5adp"[^>]*>([\s\S]*?)<\/p>/i) || "") || null
  );
}

function extractImageUrlsFromHtml(html) {
  const productBlock = parseJsonLdBlocks(html).find(
    (block) => block && typeof block === "object" && block["@type"] === "Product",
  );
  const images = Array.isArray(productBlock?.image)
    ? productBlock.image.filter((value) => typeof value === "string" && value)
    : [];
  return {
    productBlock,
    imageUrls: Array.from(new Set(images)),
  };
}

function extractDetailDescription(productBlock) {
  if (!productBlock || typeof productBlock !== "object") return null;
  return typeof productBlock.description === "string"
    ? productBlock.description.trim() || null
    : null;
}

function extractStreetHint(text) {
  if (!text) return null;
  const match = text.match(
    /\bul\.?\s+([A-ZĄĆĘŁŃÓŚŹŻ0-9][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9 .-]{1,60}?)(?=(?:\s+we\b|,|\.|;|\n))/u,
  );
  return match ? `ul. ${match[1].trim()}` : null;
}

function extractDistrictHint(text) {
  if (!text) return null;
  const match = text.match(/\bdzielnic(?:y|a)\s+([A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż-]+)/u);
  return match ? match[1].trim() : null;
}

function detectContactPreference(text) {
  if (!text) return null;
  if (/kontakt telefoniczny/i.test(text)) return "phone_only";
  if (/wyślij wiadomość|wiadomość/i.test(text)) return "chat_or_message";
  return null;
}

function parseRoomsOrNull(value) {
  if (!value) return null;
  const match = String(value).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return parseNumberOrNull(match[1]);
}

async function fetchListingDetail(listingUrl, delayMs) {
  const html = await fetchHtml(listingUrl);
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  const detailHtmlSha256 = sha256(html);
  const { productBlock, imageUrls } = extractImageUrlsFromHtml(html);
  const descriptionRaw = extractDetailDescription(productBlock);
  const breadcrumb = extractBreadcrumbDistrict(html);
  const params = extractParameterMap(html);
  const seller = extractSellerProfile(html);
  const maskedPhone = extractMaskedPhone(html);

  return {
    detailHtmlSha256,
    descriptionRaw,
    imageUrls,
    districtBreadcrumbLabel: breadcrumb.districtLabel,
    districtBreadcrumbId: breadcrumb.districtId,
    sellerName: seller.sellerName,
    sellerProfileUrl: seller.sellerProfilePath
      ? `https://www.olx.pl${seller.sellerProfilePath}`
      : null,
    sellerMemberSinceRaw: seller.sellerMemberSinceRaw,
    sellerLastSeenRaw: seller.sellerLastSeenRaw,
    sourceBusinessTypeRaw: params.source_business_type || null,
    contactPhoneMaskedRaw: maskedPhone,
    contactPhoneRaw: null,
    contactEmailRaw: null,
    contactPreferenceRaw: detectContactPreference(descriptionRaw),
    exactLocationAvailable: /Dostępna dokładna lokalizacja/i.test(html),
    districtHint: extractDistrictHint(descriptionRaw),
    streetHint: extractStreetHint(descriptionRaw),
    animalsRaw: params["Zwierzęta"] || null,
    elevatorRaw: params["Winda"] || null,
    parkingRaw: params["Parking"] || null,
    floorRaw: params["Poziom"] || null,
    furnishedRaw: params["Umeblowane"] || null,
    buildingTypeRaw: params["Rodzaj zabudowy"] || null,
    areaM2Raw: parseNumberOrNull(params["Powierzchnia"]),
    roomsRaw: parseRoomsOrNull(params["Liczba pokoi"]),
    additionalRentRaw: parseNumberOrNull(params["Czynsz (dodatkowo)"]),
    rawDetailPayload: {
      product_jsonld: productBlock || null,
      parameters: params,
      seller_profile: seller,
      contact_phone_masked: maskedPhone,
      exact_location_available: /Dostępna dokładna lokalizacja/i.test(html),
    },
  };
}

function parseListingCardsFromHtml(html) {
  const marker = '<div data-cy="l-card"';
  const starts = [];
  let from = 0;

  while (true) {
    const idx = html.indexOf(marker, from);
    if (idx === -1) break;
    starts.push(idx);
    from = idx + marker.length;
  }

  const cards = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : html.length;
    const chunk = html.slice(start, end);

    const relUrl = firstMatch(chunk, /href="(\/d\/oferta\/[^"]+)"/i);
    if (!relUrl) continue;
    const listingUrl = `https://www.olx.pl${decodeHtmlEntities(relUrl)}`;
    const listingId = extractListingIdFromUrl(listingUrl);
    const titleFromAria = firstMatch(chunk, /aria-label="Obserwuj:\s*([^"]+)"/i);
    const titleFromTag = stripTags(firstMatch(chunk, /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) || "");
    const titleRaw = decodeHtmlEntities(titleFromAria || titleFromTag || "").trim() || null;

    const priceText = firstMatch(chunk, /([0-9][0-9\s]{1,12})\s*zł/i);
    const priceNumeric = priceText
      ? parseNumberOrNull(priceText.replace(/\s+/g, ""))
      : null;
    const locationRaw =
      stripTags(firstMatch(chunk, /<p[^>]*data-testid="location-date"[^>]*>([\s\S]*?)<\/p>/i) || "") ||
      null;
    const promoted = /search_reason=search%7Cpromoted/i.test(chunk);

    cards.push({
      listingId,
      listingUrl,
      titleRaw,
      priceRaw: priceText ? `${priceText.replace(/\s+/g, " ")} zł` : null,
      priceNumeric,
      locationRaw,
      promoted,
      rawCardSha256: sha256(chunk.slice(0, 5000)),
    });
  }

  return cards;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!/[,"\n]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function buildRecord({ runId, pageNumber, offer, pageHtmlSha256, scrapedAt }) {
  const listingUrl = offer.url || null;
  const listingId = listingUrl ? extractListingIdFromUrl(listingUrl) : null;
  const areaServed = offer.areaServed?.name || null;

  return {
    crawl_run_id: runId,
    source: SOURCE,
    source_entity: "flat_rental_listing",
    city_query: CITY,
    page_number: pageNumber,
    listing_id: listingId,
    listing_url: listingUrl,
    title_raw: offer.name || null,
    price_raw: offer.price ?? null,
    price_currency_raw: offer.priceCurrency || null,
    price_numeric_raw: parseNumberOrNull(offer.price),
    area_served_raw: areaServed,
    availability_raw: offer.availability || null,
    price_valid_until_raw: offer.priceValidUntil || null,
    scraped_at_utc: scrapedAt,
    page_html_sha256: pageHtmlSha256,
    detail_html_sha256: null,
    description_raw: null,
    image_urls_raw: [],
    seller_name_raw: null,
    seller_profile_url: null,
    seller_member_since_raw: null,
    seller_last_seen_raw: null,
    source_business_type_raw: null,
    contact_phone_masked_raw: null,
    contact_phone_raw: null,
    contact_email_raw: null,
    contact_preference_raw: null,
    exact_location_available_raw: null,
    district_breadcrumb_raw: areaServed,
    district_breadcrumb_id_raw: null,
    district_hint_raw: null,
    street_hint_raw: null,
    animals_raw: null,
    elevator_raw: null,
    parking_raw: null,
    floor_raw: null,
    furnished_raw: null,
    building_type_raw: null,
    area_m2_detail_raw: null,
    rooms_detail_raw: null,
    additional_rent_raw: null,
    raw_offer_json: offer,
    raw_detail_json: null,
  };
}

function buildRecordFromCard({
  runId,
  pageNumber,
  card,
  pageHtmlSha256,
  scrapedAt,
}) {
  return {
    crawl_run_id: runId,
    source: SOURCE,
    source_entity: "flat_rental_listing",
    city_query: CITY,
    page_number: pageNumber,
    listing_id: card.listingId,
    listing_url: card.listingUrl,
    title_raw: card.titleRaw,
    price_raw: card.priceRaw,
    price_currency_raw: "PLN",
    price_numeric_raw: card.priceNumeric,
    area_served_raw: card.locationRaw,
    availability_raw: null,
    price_valid_until_raw: null,
    scraped_at_utc: scrapedAt,
    page_html_sha256: pageHtmlSha256,
    detail_html_sha256: null,
    description_raw: null,
    image_urls_raw: [],
    seller_name_raw: null,
    seller_profile_url: null,
    seller_member_since_raw: null,
    seller_last_seen_raw: null,
    source_business_type_raw: null,
    contact_phone_masked_raw: null,
    contact_phone_raw: null,
    contact_email_raw: null,
    contact_preference_raw: null,
    exact_location_available_raw: null,
    district_breadcrumb_raw: null,
    district_breadcrumb_id_raw: null,
    district_hint_raw: null,
    street_hint_raw: null,
    animals_raw: null,
    elevator_raw: null,
    parking_raw: null,
    floor_raw: null,
    furnished_raw: null,
    building_type_raw: null,
    area_m2_detail_raw: null,
    rooms_detail_raw: null,
    additional_rent_raw: null,
    raw_offer_json: {
      source_record_kind: "html_card",
      promoted: card.promoted,
      location_raw: card.locationRaw,
      raw_card_sha256: card.rawCardSha256,
    },
    raw_detail_json: null,
  };
}

function applyDetailToRecord(record, detail) {
  return {
    ...record,
    detail_html_sha256: detail.detailHtmlSha256,
    description_raw: detail.descriptionRaw,
    image_urls_raw: detail.imageUrls,
    seller_name_raw: detail.sellerName,
    seller_profile_url: detail.sellerProfileUrl,
    seller_member_since_raw: detail.sellerMemberSinceRaw,
    seller_last_seen_raw: detail.sellerLastSeenRaw,
    source_business_type_raw: detail.sourceBusinessTypeRaw,
    contact_phone_masked_raw: detail.contactPhoneMaskedRaw,
    contact_phone_raw: detail.contactPhoneRaw,
    contact_email_raw: detail.contactEmailRaw,
    contact_preference_raw: detail.contactPreferenceRaw,
    exact_location_available_raw: detail.exactLocationAvailable,
    district_breadcrumb_raw: detail.districtBreadcrumbLabel,
    district_breadcrumb_id_raw: detail.districtBreadcrumbId,
    district_hint_raw: detail.districtHint,
    street_hint_raw: detail.streetHint,
    animals_raw: detail.animalsRaw,
    elevator_raw: detail.elevatorRaw,
    parking_raw: detail.parkingRaw,
    floor_raw: detail.floorRaw,
    furnished_raw: detail.furnishedRaw,
    building_type_raw: detail.buildingTypeRaw,
    area_m2_detail_raw: detail.areaM2Raw,
    rooms_detail_raw: detail.roomsRaw,
    additional_rent_raw: detail.additionalRentRaw,
    raw_detail_json: detail.rawDetailPayload,
  };
}

function toCsv(records) {
  const headers = [
    "crawl_run_id",
    "source",
    "source_entity",
    "city_query",
    "page_number",
    "listing_id",
    "listing_url",
    "title_raw",
    "price_raw",
    "price_currency_raw",
    "price_numeric_raw",
    "area_served_raw",
    "availability_raw",
    "price_valid_until_raw",
    "detail_html_sha256",
    "seller_name_raw",
    "contact_phone_masked_raw",
    "district_breadcrumb_raw",
    "district_hint_raw",
    "street_hint_raw",
    "area_m2_detail_raw",
    "rooms_detail_raw",
    "additional_rent_raw",
    "scraped_at_utc",
    "page_html_sha256",
  ];
  const rows = [headers.join(",")];
  for (const row of records) {
    const values = headers.map((h) => csvEscape(row[h]));
    rows.push(values.join(","));
  }
  return rows.join("\n") + "\n";
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "pl-PL,pl;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }

  return response.text();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = randomUUID();
  const scrapedAt = new Date().toISOString();
  const seen = new Set();
  const records = [];

  let detectedMaxPage = args.maxPages;

  for (let page = 1; page <= detectedMaxPage; page += 1) {
    if (records.length >= args.target) break;
    const url = pageUrl(page);
    const html = await fetchHtml(url);
    const pageHtmlSha256 = sha256(html);

    if (page === 1) {
      const fromHtml = parseMaxPageFromHtml(html);
      detectedMaxPage = Math.min(args.maxPages, fromHtml);
    }

    const cards = parseListingCardsFromHtml(html);

    if (cards.length) {
      for (const card of cards) {
        const listingUrl = card.listingUrl;
        if (!listingUrl || seen.has(listingUrl)) continue;
        seen.add(listingUrl);
        records.push(
          buildRecordFromCard({
            runId,
            pageNumber: page,
            card,
            pageHtmlSha256,
            scrapedAt,
          }),
        );
        const lastIndex = records.length - 1;
        try {
          const detail = await fetchListingDetail(listingUrl, args.detailDelayMs);
          records[lastIndex] = applyDetailToRecord(records[lastIndex], detail);
        } catch (error) {
          records[lastIndex].raw_detail_json = {
            detail_fetch_error:
              error instanceof Error ? error.message : String(error),
          };
        }
        if (records.length >= args.target) break;
      }
    } else {
      const jsonLd = parseJsonLdBlocks(html);
      const offers = offersFromJsonLd(jsonLd);

      for (const offer of offers) {
        const listingUrl = offer?.url;
        if (!listingUrl || seen.has(listingUrl)) continue;
        seen.add(listingUrl);
        records.push(
          buildRecord({
            runId,
            pageNumber: page,
            offer,
            pageHtmlSha256,
            scrapedAt,
          }),
        );
        const lastIndex = records.length - 1;
        try {
          const detail = await fetchListingDetail(listingUrl, args.detailDelayMs);
          records[lastIndex] = applyDetailToRecord(records[lastIndex], detail);
        } catch (error) {
          records[lastIndex].raw_detail_json = {
            detail_fetch_error:
              error instanceof Error ? error.message : String(error),
          };
        }
        if (records.length >= args.target) break;
      }
    }

    if (page < detectedMaxPage && records.length < args.target) {
      await sleep(args.delayMs);
    }
  }

  if (!records.length) {
    throw new Error(
      "No listings were extracted. Check network access and source HTML structure.",
    );
  }

  await mkdir(args.outDir, { recursive: true });
  const ts = toIsoSafeTs(new Date());
  const base = `olx_wroclaw_rentals_raw_${ts}`;
  const jsonlPath = join(args.outDir, `${base}.jsonl`);
  const csvPath = join(args.outDir, `${base}.csv`);
  const metaPath = join(args.outDir, `${base}.meta.json`);

  const jsonl = records.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const csv = toCsv(records);
  const meta = {
    crawl_run_id: runId,
    source: SOURCE,
    city_query: CITY,
    requested_target: args.target,
    extracted_rows: records.length,
    max_pages_requested: args.maxPages,
    detail_delay_ms: args.detailDelayMs,
    scraped_at_utc: scrapedAt,
    output_files: [jsonlPath, csvPath],
  };

  await writeFile(jsonlPath, jsonl, "utf8");
  await writeFile(csvPath, csv, "utf8");
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        extracted_rows: records.length,
        crawl_run_id: runId,
        jsonl_path: jsonlPath,
        csv_path: csvPath,
        meta_path: metaPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
