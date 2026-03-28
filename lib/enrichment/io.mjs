import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeCrawlerRecord,
  normalizeDbRecord,
  flattenEnrichmentForCsv,
} from "./pipeline.mjs";

const RAW_LISTING_SELECT = [
  "id",
  "ingest_run_id",
  "source",
  "source_listing_id",
  "source_url",
  "search_city",
  "listing_title",
  "description_raw",
  "district",
  "district_breadcrumb_raw",
  "district_hint_raw",
  "street_hint_raw",
  "exact_location_available_raw",
  "raw_detail_payload",
].join(",");

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function createTimestampTag(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

export function getSupabaseAdminClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function readCrawlerJsonl(inputPath, limit = null) {
  const content = await readFile(inputPath, "utf8");
  const rows = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(normalizeCrawlerRecord(JSON.parse(trimmed)));
    if (Number.isFinite(limit) && rows.length >= limit) break;
  }
  return rows;
}

export async function fetchRawListingsByIngestRun(
  supabase,
  ingestRunId,
  limit = null,
) {
  const rows = [];
  const pageSize = 200;
  let offset = 0;

  while (true) {
    let query = supabase
      .from("raw_rental_listings")
      .select(RAW_LISTING_SELECT)
      .eq("ingest_run_id", ingestRunId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (Number.isFinite(limit)) {
      const remaining = limit - rows.length;
      if (remaining <= 0) break;
      query = query.range(offset, offset + Math.min(pageSize, remaining) - 1);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    if (!data?.length) break;
    rows.push(...data.map(normalizeDbRecord));

    if (data.length < pageSize) break;
    offset += data.length;
  }

  return rows;
}

export async function lookupRawListingIds(
  supabase,
  ingestRunId,
  sourceListingIds,
) {
  const idMap = new Map();
  if (!ingestRunId || !sourceListingIds.length) {
    return idMap;
  }

  const uniqueIds = [...new Set(sourceListingIds)].filter(Boolean);
  const pageSize = 100;

  for (let index = 0; index < uniqueIds.length; index += pageSize) {
    const slice = uniqueIds.slice(index, index + pageSize);
    const { data, error } = await supabase
      .from("raw_rental_listings")
      .select("id,ingest_run_id,source,source_listing_id")
      .eq("ingest_run_id", ingestRunId)
      .in("source_listing_id", slice);

    if (error) {
      throw error;
    }

    for (const row of data || []) {
      idMap.set(row.source_listing_id, row.id);
    }
  }

  return idMap;
}

export async function insertEnrichmentRun(supabase, payload) {
  const { data, error } = await supabase
    .from("enrichment_runs")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateEnrichmentRun(supabase, runId, payload) {
  const { error } = await supabase
    .from("enrichment_runs")
    .update(payload)
    .eq("id", runId);

  if (error) {
    throw error;
  }
}

export async function upsertListingEnrichments(supabase, rows) {
  if (!rows.length) return [];

  const payload = rows.map((row) => toJson(row));
  const { data, error } = await supabase
    .from("listing_enrichments")
    .upsert(payload, {
      onConflict: "enrichment_run_id,source,source_listing_id",
    })
    .select("id,source_listing_id");

  if (error) {
    throw error;
  }

  return data || [];
}

export async function replaceProximityMatches(supabase, rowsByListingEnrichmentId) {
  const allRows = [];
  for (const [listingEnrichmentId, rows] of rowsByListingEnrichmentId.entries()) {
    const { error: deleteError } = await supabase
      .from("listing_proximity_matches")
      .delete()
      .eq("listing_enrichment_id", listingEnrichmentId);

    if (deleteError) {
      throw deleteError;
    }

    for (const row of rows) {
      allRows.push({
        listing_enrichment_id: listingEnrichmentId,
        ...toJson(row),
      });
    }
  }

  if (!allRows.length) return;

  const { error } = await supabase
    .from("listing_proximity_matches")
    .insert(allRows);

  if (error) {
    throw error;
  }
}

export function buildListingEnrichmentRow({
  enrichmentRunId,
  listing,
  rawListingId,
  geocode,
  weather,
  airQuality,
  sunlight,
}) {
  return {
    enrichment_run_id: enrichmentRunId,
    raw_listing_id: rawListingId ?? listing.rawListingId ?? null,
    ingest_run_id: listing.ingestRunId ?? null,
    source: listing.source,
    source_listing_id: listing.sourceListingId,
    source_url: listing.sourceUrl,
    search_city: listing.searchCity,
    geocode_query: geocode.query,
    geocode_input: geocode.input || {},
    geocode_status: geocode.status,
    geocode_provider: geocode.status === "succeeded" ? "google_maps" : null,
    geocode_formatted_address: geocode.formattedAddress,
    geocode_place_id: geocode.placeId,
    geocode_location_type: geocode.locationType,
    geocode_result_types: geocode.resultTypes || [],
    geocode_partial_match: Boolean(geocode.partialMatch),
    lat: geocode.latitude,
    lng: geocode.longitude,
    geocode_payload: geocode.payload || {},
    geocoded_at:
      geocode.status === "succeeded" ? new Date().toISOString() : null,
    weather_status: weather.status,
    weather_snapshot: weather.snapshot || {},
    weather_payload: weather.payload || {},
    weather_fetched_at: weather.fetchedAt,
    air_quality_status: airQuality.status,
    air_quality_snapshot: airQuality.snapshot || {},
    air_quality_payload: airQuality.payload || {},
    air_quality_fetched_at: airQuality.fetchedAt,
    sunlight_status: sunlight.status,
    sunlight_score: sunlight.score,
    sunlight_confidence: sunlight.confidence,
    sunlight_estimated_orientation_hint: sunlight.estimatedOrientationHint,
    sunlight_reasons: sunlight.reasons || [],
    sunlight_payload: sunlight.payload || {},
    sunlight_fetched_at: sunlight.fetchedAt,
    updated_at: new Date().toISOString(),
  };
}

export async function writeEnrichmentArtifacts({
  outDir,
  outputStem,
  enrichments,
  meta,
}) {
  await mkdir(outDir, { recursive: true });

  const jsonlPath = join(outDir, `${outputStem}.jsonl`);
  const csvPath = join(outDir, `${outputStem}.csv`);
  const metaPath = join(outDir, `${outputStem}.meta.json`);

  const jsonlContent = enrichments
    .map((row) => JSON.stringify(toJson(row)))
    .join("\n");

  const csvRows = flattenEnrichmentForCsv(enrichments);
  const headers = Array.from(
    csvRows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );
  const csvContent = [
    headers.join(","),
    ...csvRows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");

  await Promise.all([
    writeFile(jsonlPath, jsonlContent ? `${jsonlContent}\n` : ""),
    writeFile(csvPath, csvContent ? `${csvContent}\n` : ""),
    writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...meta,
          output_files: [
            basename(jsonlPath),
            basename(csvPath),
          ],
        },
        null,
        2,
      )}\n`,
    ),
  ]);

  return {
    jsonlPath,
    csvPath,
    metaPath,
  };
}
