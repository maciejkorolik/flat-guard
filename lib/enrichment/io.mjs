import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { projectOlxRecord } from "../../scripts/lib/olx-ingest.mjs";
import {
  normalizeCrawlerRecord,
  normalizeNormalizedRecord,
  flattenEnrichmentForCsv,
} from "./pipeline.mjs";

const LIVE_RAW_LISTING_SELECT = [
  "id",
  "source",
  "external_id",
  "raw_data",
  "scraped_at",
  "normalized_id",
].join(",");

export const NORMALIZED_ENRICHMENT_INPUT_COLUMNS = [
  "id",
  "source",
  "external_id",
  "url",
  "title",
  "description",
  "city",
  "district",
  "neighbourhood",
  "address",
  "exact_location_available",
  "source_detail_payload",
  "is_active",
  "last_seen_at",
];

export const NORMALIZED_ENRICHMENT_OUTPUT_COLUMNS = [
  "last_enrichment_run_id",
  "geocode_status",
  "geocode_provider",
  "geocode_query",
  "geocode_formatted_address",
  "geocode_place_id",
  "geocode_location_type",
  "geocode_result_types",
  "geocode_partial_match",
  "geocoded_at",
  "weather_status",
  "weather_summary_time",
  "weather_condition_type",
  "weather_condition_text",
  "weather_temperature_c",
  "weather_precipitation_probability_percent",
  "weather_next12h_rain_hours",
  "weather_next12h_max_precip_probability_percent",
  "weather_fetched_at",
  "air_quality_status",
  "air_quality_summary_time",
  "air_quality_aqi_index_code",
  "air_quality_aqi_display_name",
  "air_quality_aqi_value",
  "air_quality_aqi_category",
  "air_quality_dominant_pollutant",
  "air_quality_fetched_at",
  "sunlight_status",
  "sunlight_score",
  "sunlight_confidence",
  "sunlight_estimated_orientation_hint",
  "sunlight_reasons",
  "sunlight_fetched_at",
  "proximity_matches",
  "proximity_fetched_at",
];

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

export function getSupabaseAdminKeyFromEnv(env = process.env) {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || null;
}

export function getSupabaseAdminClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = getSupabaseAdminKeyFromEnv();
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

export async function fetchSupabaseOpenApiSchema({ supabaseUrl, supabaseKey }) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Supabase OpenAPI schema: ${response.status}`);
  }

  return response.json();
}

export function getTableDefinition(openApiSchema, tableName) {
  return openApiSchema?.definitions?.[tableName] || null;
}

export function getTableColumnNames(openApiSchema, tableName) {
  return new Set(
    Object.keys(getTableDefinition(openApiSchema, tableName)?.properties || {}),
  );
}

export function intersectColumnNames(requestedColumns, availableColumns) {
  return requestedColumns.filter((columnName) => availableColumns.has(columnName));
}

export function buildNormalizedEnrichmentSelect(availableColumns) {
  return intersectColumnNames(
    NORMALIZED_ENRICHMENT_INPUT_COLUMNS,
    availableColumns,
  ).join(",");
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

export function projectRawListingRowToNormalizedRecord(row) {
  const projected = projectOlxRecord(row.raw_data || {});

  return {
    id: row.normalized_id ?? null,
    raw_listing_id: row.id ?? null,
    ...projected,
    source: projected.source || row.source || null,
    external_id: projected.external_id || row.external_id || null,
  };
}

export async function fetchLatestRawListings(
  supabase,
  { limit = null, source = null } = {},
) {
  const rows = [];
  const pageSize = 200;
  let offset = 0;

  while (true) {
    let query = supabase
      .from("listings_raw")
      .select(LIVE_RAW_LISTING_SELECT)
      .order("scraped_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (source) {
      query = query.eq("source", source);
    }

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
    rows.push(
      ...data.map((row) =>
        normalizeNormalizedRecord(projectRawListingRowToNormalizedRecord(row)),
      ),
    );

    if (data.length < pageSize) break;
    offset += data.length;
  }

  return rows;
}

export async function fetchNormalizedListingsForEnrichment(
  supabase,
  {
    availableColumns,
    limit = null,
    offset = 0,
    source = null,
    onlyActive = true,
    onlyMissing = true,
  } = {},
) {
  const select = buildNormalizedEnrichmentSelect(availableColumns);
  if (!select) {
    throw new Error("No compatible listings_normalized columns are available.");
  }

  let query = supabase
    .from("listings_normalized")
    .select(select)
    .range(offset, offset + (Number.isFinite(limit) ? limit : 200) - 1);

  if (availableColumns.has("last_seen_at")) {
    query = query.order("last_seen_at", { ascending: false, nullsFirst: false });
  }
  query = query.order("id", { ascending: true });

  if (source && availableColumns.has("source")) {
    query = query.eq("source", source);
  }

  if (onlyActive && availableColumns.has("is_active")) {
    query = query.eq("is_active", true);
  }

  if (onlyMissing) {
    const missingPredicates = [
      "geocode_status",
      "weather_status",
      "air_quality_status",
      "sunlight_status",
      "proximity_fetched_at",
    ]
      .filter((columnName) => availableColumns.has(columnName))
      .map((columnName) => `${columnName}.is.null`);

    if (missingPredicates.length) {
      query = query.or(missingPredicates.join(","));
    }
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).map((row) => normalizeNormalizedRecord(row));
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

export function buildNormalizedEnrichmentUpdate({
  enrichmentRunId = null,
  enrichment,
  now = new Date().toISOString(),
}) {
  const geocodeSucceeded = enrichment.geocode.status === "succeeded";
  const proximityFetchedAt = geocodeSucceeded ? now : null;
  const payload = {
    geocode_status: enrichment.geocode.status,
    geocode_provider: geocodeSucceeded ? "google_maps" : null,
    geocode_query: enrichment.geocode.query,
    geocode_formatted_address: enrichment.geocode.formattedAddress,
    geocode_place_id: enrichment.geocode.placeId,
    geocode_location_type: enrichment.geocode.locationType,
    geocode_result_types: enrichment.geocode.resultTypes || [],
    geocode_partial_match: Boolean(enrichment.geocode.partialMatch),
    geocoded_at: geocodeSucceeded ? now : null,
    weather_status: enrichment.weather.status,
    weather_summary_time: enrichment.weather.snapshot?.summaryTime ?? null,
    weather_condition_type: enrichment.weather.snapshot?.conditionType ?? null,
    weather_condition_text: enrichment.weather.snapshot?.conditionText ?? null,
    weather_temperature_c: enrichment.weather.snapshot?.temperatureC ?? null,
    weather_precipitation_probability_percent:
      enrichment.weather.snapshot?.precipitationProbabilityPercent ?? null,
    weather_next12h_rain_hours:
      enrichment.weather.snapshot?.next12hRainHourCount ?? null,
    weather_next12h_max_precip_probability_percent:
      enrichment.weather.snapshot?.next12hMaxPrecipProbabilityPercent ?? null,
    weather_fetched_at: enrichment.weather.fetchedAt ?? null,
    air_quality_status: enrichment.airQuality.status,
    air_quality_summary_time: enrichment.airQuality.snapshot?.summaryTime ?? null,
    air_quality_aqi_index_code: enrichment.airQuality.snapshot?.aqiIndexCode ?? null,
    air_quality_aqi_display_name:
      enrichment.airQuality.snapshot?.aqiDisplayName ?? null,
    air_quality_aqi_value: enrichment.airQuality.snapshot?.aqiValue ?? null,
    air_quality_aqi_category: enrichment.airQuality.snapshot?.aqiCategory ?? null,
    air_quality_dominant_pollutant:
      enrichment.airQuality.snapshot?.dominantPollutant ?? null,
    air_quality_fetched_at: enrichment.airQuality.fetchedAt ?? null,
    sunlight_status: enrichment.sunlight.status,
    sunlight_score: enrichment.sunlight.score,
    sunlight_confidence: enrichment.sunlight.confidence,
    sunlight_estimated_orientation_hint:
      enrichment.sunlight.estimatedOrientationHint,
    sunlight_reasons: enrichment.sunlight.reasons || [],
    sunlight_fetched_at: enrichment.sunlight.fetchedAt ?? null,
    proximity_matches: enrichment.proximityMatches || [],
    proximity_fetched_at: proximityFetchedAt,
  };

  if (enrichmentRunId) {
    payload.last_enrichment_run_id = enrichmentRunId;
  }

  return payload;
}

export function filterRecordToAllowedColumns(record, availableColumns) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => availableColumns.has(key)),
  );
}

export async function updateNormalizedListingEnrichment(
  supabase,
  listingId,
  payload,
) {
  const { error } = await supabase
    .from("listings_normalized")
    .update(toJson(payload))
    .eq("id", listingId);

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
    normalized_listing_id: listing.normalizedListingId ?? null,
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
