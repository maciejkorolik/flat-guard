#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveRequestedCategories } from "../lib/enrichment/category-config.mjs";
import { getSupabaseAdminKeyFromEnv } from "../lib/enrichment/io.mjs";
import {
  buildGeocodeInput,
  describeGeocodeQueryRequirements,
  ENRICHMENT_QUERY_COMPONENTS,
  enrichListing,
  normalizeNormalizedRecord,
} from "../lib/enrichment/pipeline.mjs";
import { projectOlxRecord } from "./lib/olx-ingest.mjs";

const RECOMMENDED_NORMALIZED_COLUMNS = [
  {
    name: "exact_location_available",
    type: "boolean",
    reason: "preserves whether the source exposed precise location data",
  },
  {
    name: "image_urls",
    type: "text[]",
    reason: "keeps source images available for review and later ranking work",
  },
  {
    name: "source_business_type",
    type: "text",
    reason: "preserves source-side listing type without hard-coding provider names",
  },
  {
    name: "source_offer_payload",
    type: "jsonb",
    reason: "keeps the source offer block for debugging and future extraction",
  },
  {
    name: "source_detail_payload",
    type: "jsonb",
    reason: "lets enrichment reuse provider detail payload without going back to raw_data",
  },
  {
    name: "last_enrichment_run_id",
    type: "uuid",
    reason: "links the canonical row to the most recent enrichment batch",
  },
  {
    name: "geocode_status",
    type: "public.geocode_status",
    reason: "tracks whether the listing currently has usable geocoding",
  },
  {
    name: "geocode_provider",
    type: "text",
    reason: "records which provider produced the current geocode summary",
  },
  {
    name: "geocode_query",
    type: "text",
    reason: "keeps the exact address query used for the latest geocode pass",
  },
  {
    name: "geocode_formatted_address",
    type: "text",
    reason: "stores the provider-normalized address string used downstream",
  },
  {
    name: "geocode_place_id",
    type: "text",
    reason: "preserves the provider place identifier for later refreshes",
  },
  {
    name: "geocode_location_type",
    type: "text",
    reason: "captures geocode precision so downstream logic can discount weak matches",
  },
  {
    name: "geocode_result_types",
    type: "jsonb",
    reason: "stores provider result types for later filtering and QA",
  },
  {
    name: "geocode_partial_match",
    type: "boolean",
    reason: "flags approximate geocodes that should be treated more conservatively",
  },
  {
    name: "geocoded_at",
    type: "timestamptz",
    reason: "timestamps the latest geocoding snapshot",
  },
  {
    name: "weather_status",
    type: "public.enrichment_signal_status",
    reason: "tracks whether a weather snapshot was successfully fetched",
  },
  {
    name: "weather_summary_time",
    type: "timestamptz",
    reason: "preserves the provider timestamp for the current weather summary",
  },
  {
    name: "weather_condition_type",
    type: "text",
    reason: "stores the structured provider weather condition code",
  },
  {
    name: "weather_condition_text",
    type: "text",
    reason: "stores the display weather summary used in ranking and UI",
  },
  {
    name: "weather_temperature_c",
    type: "double precision",
    reason: "keeps the current temperature for current-condition ranking",
  },
  {
    name: "weather_precipitation_probability_percent",
    type: "double precision",
    reason: "captures near-term rain risk from the current weather response",
  },
  {
    name: "weather_next12h_rain_hours",
    type: "integer",
    reason: "summarizes expected rainy hours over the next 12 hours",
  },
  {
    name: "weather_next12h_max_precip_probability_percent",
    type: "double precision",
    reason: "keeps the worst short-horizon rain probability for quick filtering",
  },
  {
    name: "weather_fetched_at",
    type: "timestamptz",
    reason: "timestamps the latest weather fetch",
  },
  {
    name: "air_quality_status",
    type: "public.enrichment_signal_status",
    reason: "tracks whether an air-quality snapshot was successfully fetched",
  },
  {
    name: "air_quality_summary_time",
    type: "timestamptz",
    reason: "preserves the provider timestamp for the current AQ summary",
  },
  {
    name: "air_quality_aqi_index_code",
    type: "text",
    reason: "stores which AQI scale produced the summary value",
  },
  {
    name: "air_quality_aqi_display_name",
    type: "text",
    reason: "keeps the provider AQI index label for presentation",
  },
  {
    name: "air_quality_aqi_value",
    type: "double precision",
    reason: "stores the current AQI value for ranking and alerts",
  },
  {
    name: "air_quality_aqi_category",
    type: "text",
    reason: "stores the user-facing AQI category",
  },
  {
    name: "air_quality_dominant_pollutant",
    type: "text",
    reason: "captures the main pollutant driving the AQI summary",
  },
  {
    name: "air_quality_fetched_at",
    type: "timestamptz",
    reason: "timestamps the latest AQ fetch",
  },
  {
    name: "sunlight_status",
    type: "public.enrichment_signal_status",
    reason: "tracks whether the sunlight estimate was produced successfully",
  },
  {
    name: "sunlight_score",
    type: "numeric(5,2)",
    reason: "stores the coarse sunlight score used for shortlist ranking",
  },
  {
    name: "sunlight_confidence",
    type: "public.enrichment_confidence_level",
    reason: "preserves how trustworthy the sunlight estimate is",
  },
  {
    name: "sunlight_estimated_orientation_hint",
    type: "text",
    reason: "stores the best available directional hint from text or solar context",
  },
  {
    name: "sunlight_reasons",
    type: "text[]",
    reason: "keeps human-readable reasons for the sunlight estimate",
  },
  {
    name: "sunlight_fetched_at",
    type: "timestamptz",
    reason: "timestamps the latest sunlight estimation pass",
  },
  {
    name: "proximity_matches",
    type: "jsonb",
    reason: "stores the best amenity match per requested category with walk time and distance",
  },
  {
    name: "proximity_fetched_at",
    type: "timestamptz",
    reason: "timestamps the latest amenity proximity evaluation",
  },
];

const NOT_IMPLEMENTED_SIGNAL_NOTES = [
  "traffic is not currently produced by the Google enrichment client; the Routes integration only computes walking matrices for amenity proximity.",
];

const REQUIRED_DATASET_FIELDS_FOR_ENRICHMENT = [
  {
    query_component: "street",
    normalized_columns: ["address"],
    reason: "required to build the geocoding street component",
  },
  {
    query_component: "district",
    normalized_columns: ["district", "neighbourhood"],
    reason: "required to anchor the geocoding query to the right district",
  },
  {
    query_component: "city",
    normalized_columns: ["city"],
    reason: "required to build the geocoding city component",
  },
];

function loadEnvFileIfPresent(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }

  process.loadEnvFile(filePath);
  return true;
}

function loadLocalEnvFiles() {
  const visited = new Set();
  let currentDir = process.cwd();

  while (!visited.has(currentDir)) {
    visited.add(currentDir);

    const envLocalPath = resolve(currentDir, ".env.local");
    const envPath = resolve(currentDir, ".env");

    const loadedEnvLocal = loadEnvFileIfPresent(envLocalPath);
    const loadedEnv = loadEnvFileIfPresent(envPath);
    if (loadedEnvLocal || loadedEnv) {
      break;
    }

    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
}

function parseArgs(argv) {
  const args = {
    limit: 10,
    source: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--limit" && next) {
      args.limit = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (arg === "--source" && next) {
      args.source = next;
      index += 1;
      continue;
    }

    if (arg === "--help") {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/validate-live-enrichment-readiness.mjs [--limit 10] [--source olx.pl]
`);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = (hash * 31 + char.charCodeAt(0)) % 10000;
  }
  return hash;
}

function buildFakeGoogleClient() {
  return {
    async geocodeAddress({ query }) {
      const hash = hashString(query);
      const latitude = 51.05 + (hash % 500) / 10000;
      const longitude = 16.9 + (hash % 700) / 10000;
      return {
        status: "OK",
        results: [
          {
            formatted_address: query,
            geometry: {
              location: {
                lat: latitude,
                lng: longitude,
              },
              location_type: "RANGE_INTERPOLATED",
            },
            place_id: `fixture-geocode-${slugify(query)}`,
            types: ["street_address"],
          },
        ],
      };
    },

    async getCurrentWeather() {
      return {
        currentTime: "2026-03-28T13:00:00Z",
        weatherCondition: {
          type: "PARTLY_CLOUDY",
          description: {
            text: "Partly cloudy",
          },
        },
        temperature: {
          degrees: 12,
        },
        precipitation: {
          probability: {
            percent: 35,
          },
        },
      };
    },

    async getHourlyForecast() {
      return {
        forecastHours: [
          {
            weatherCondition: {
              type: "CLOUDY",
            },
            precipitation: {
              probability: {
                percent: 10,
              },
            },
          },
          {
            weatherCondition: {
              type: "LIGHT_RAIN",
            },
            precipitation: {
              probability: {
                percent: 58,
              },
            },
          },
        ],
      };
    },

    async getCurrentAirQuality() {
      return {
        dateTime: "2026-03-28T13:00:00Z",
        dominantPollutant: {
          code: "pm25",
        },
        indexes: [
          {
            code: "uaqi",
            aqi: 42,
            category: {
              displayName: "Good",
            },
          },
        ],
      };
    },

    async getBuildingInsights() {
      return {
        solarPotential: {
          maxSunshineHoursPerYear: 1800,
          wholeRoofStats: {
            sunshineQuantiles: [1200, 1400, 1600, 1700, 1750],
          },
          roofSegmentStats: [
            {
              azimuthDegrees: 230,
              sunshineQuantiles: [1300, 1500, 1650, 1750, 1800],
            },
          ],
        },
      };
    },

    async searchPlacesByText({ textQuery, latitude, longitude }) {
      return {
        places: [
          {
            id: `${slugify(textQuery)}-1`,
            name: `places/${slugify(textQuery)}-1`,
            displayName: {
              text: `${textQuery} One`,
            },
            formattedAddress: "Fixture A",
            primaryType: "point_of_interest",
            types: ["point_of_interest"],
            location: {
              latitude: latitude + 0.002,
              longitude: longitude + 0.002,
            },
          },
          {
            id: `${slugify(textQuery)}-2`,
            name: `places/${slugify(textQuery)}-2`,
            displayName: {
              text: `${textQuery} Two`,
            },
            formattedAddress: "Fixture B",
            primaryType: "point_of_interest",
            types: ["point_of_interest"],
            location: {
              latitude: latitude + 0.001,
              longitude: longitude + 0.001,
            },
          },
        ],
      };
    },

    async computeWalkingMatrix({ destinations }) {
      return destinations.map((destination, destinationIndex) => ({
        destinationIndex,
        distanceMeters: 300 + destinationIndex * 150,
        duration: `${240 + destinationIndex * 180}s`,
        condition: "ROUTE_EXISTS",
        originIndex: 0,
        destination,
      }));
    },
  };
}

async function fetchOpenApiSchema({ supabaseUrl, supabaseKey }) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI schema: ${response.status}`);
  }

  return response.json();
}

async function fetchLiveRawSample({ supabaseUrl, supabaseKey, limit, source }) {
  const query = new URLSearchParams({
    select: "*",
    limit: String(limit),
  });

  if (source) {
    query.set("source", `eq.${source}`);
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/listings_raw?${query.toString()}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch listings_raw sample: ${response.status}`);
  }

  return response.json();
}

function getTableDefinition(openApiSchema, tableName) {
  return openApiSchema?.definitions?.[tableName] || null;
}

function printTableDefinition(tableName, definition) {
  const properties = definition?.properties || {};
  const required = new Set(definition?.required || []);

  console.log(`\n${tableName}`);
  for (const [columnName, columnDefinition] of Object.entries(properties)) {
    const typeLabel = columnDefinition.format || columnDefinition.type || "unknown";
    const requiredLabel = required.has(columnName) ? "required" : "optional";
    console.log(`- ${columnName}: ${typeLabel} (${requiredLabel})`);
  }
}

async function main() {
  loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = getSupabaseAdminKeyFromEnv();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY.",
    );
  }

  const openApiSchema = await fetchOpenApiSchema({
    supabaseUrl,
    supabaseKey,
  });
  const listingsRawDefinition = getTableDefinition(openApiSchema, "listings_raw");
  const listingsNormalizedDefinition = getTableDefinition(openApiSchema, "listings_normalized");
  const sampleRows = await fetchLiveRawSample({
    supabaseUrl,
    supabaseKey,
    limit: args.limit,
    source: args.source,
  });

  const normalizedRows = sampleRows.map((row) =>
    projectOlxRecord(row.raw_data || {}),
  );
  const enrichmentListings = normalizedRows.map((row, index) =>
    normalizeNormalizedRecord({
      id: sampleRows[index].normalized_id ?? null,
      raw_listing_id: sampleRows[index].id,
      ...row,
    }),
  );

  const readinessRows = enrichmentListings.map((listing) => {
    const geocodeInput = buildGeocodeInput(listing);
    const requirements = describeGeocodeQueryRequirements(listing);
    return {
      source_listing_id: listing.sourceListingId,
      source: listing.source,
      raw_listing_id: listing.rawListingId,
      geocode_status: geocodeInput.status,
      geocode_query: geocodeInput.query,
      missing_query_components: requirements.missingComponents,
    };
  });

  const readyCount = readinessRows.filter((row) => row.geocode_status === "ready").length;
  const categories = resolveRequestedCategories([]);
  const fakeGoogleClient = buildFakeGoogleClient();
  const enrichmentResults = [];

  for (const listing of enrichmentListings) {
    enrichmentResults.push(
      await enrichListing({
        googleClient: fakeGoogleClient,
        listing,
        categories,
      }),
    );
  }

  const geocodeStatuses = enrichmentResults.reduce((counts, result) => {
    const key = result.geocode.status;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const normalizedProperties = listingsNormalizedDefinition?.properties || {};
  const missingNormalizedColumns = RECOMMENDED_NORMALIZED_COLUMNS.filter(
    (column) => !Object.hasOwn(normalizedProperties, column.name),
  );
  const missingQueryComponentCounts = readinessRows.reduce((counts, row) => {
    for (const component of row.missing_query_components) {
      counts[component] = (counts[component] || 0) + 1;
    }
    return counts;
  }, {});

  printTableDefinition("listings_raw", listingsRawDefinition);
  printTableDefinition("listings_normalized", listingsNormalizedDefinition);

  console.log("\nlistings_raw sample");
  console.log(`- rows_fetched: ${sampleRows.length}`);
  console.log(`- live_sources: ${[...new Set(sampleRows.map((row) => row.source))].join(", ")}`);
  console.log(`- normalized_links_present: ${sampleRows.filter((row) => row.normalized_id !== null).length}`);

  console.log("\nlocal normalization");
  console.log(`- projected_rows: ${normalizedRows.length}`);
  console.log(`- geocode_ready_rows: ${readyCount}/${normalizedRows.length}`);
  console.log(
    `- required_geocode_query_components: ${ENRICHMENT_QUERY_COMPONENTS.join(", ")}`,
  );
  for (const row of readinessRows) {
    console.log(
      `- ${row.source_listing_id}: ${row.geocode_status}${
        row.geocode_query ? ` | ${row.geocode_query}` : ""
      }${
        row.missing_query_components.length
          ? ` | missing=${row.missing_query_components.join(",")}`
          : ""
      }`,
    );
  }

  console.log("\ndataset fields required for enrichment-ready queries");
  for (const field of REQUIRED_DATASET_FIELDS_FOR_ENRICHMENT) {
    console.log(
      `- ${field.query_component}: columns=${field.normalized_columns.join(" | ")} | missing_rows=${missingQueryComponentCounts[field.query_component] || 0} | ${field.reason}`,
    );
  }

  console.log("\ndeterministic enrichment");
  for (const [status, count] of Object.entries(geocodeStatuses)) {
    console.log(`- geocode_${status}: ${count}`);
  }
  console.log(`- baseline_categories: ${categories.map((category) => category.key).join(", ")}`);

  console.log("\nmissing listings_normalized columns");
  if (!missingNormalizedColumns.length) {
    console.log("- none");
  } else {
    for (const column of missingNormalizedColumns) {
      console.log(`- ${column.name} (${column.type}): ${column.reason}`);
    }
  }

  console.log("\nnot implemented by current enrichment");
  for (const note of NOT_IMPLEMENTED_SIGNAL_NOTES) {
    console.log(`- ${note}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
