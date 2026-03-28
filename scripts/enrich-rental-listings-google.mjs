#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createGoogleMapsClient } from "../lib/enrichment/google-maps.mjs";
import { resolveRequestedCategories } from "../lib/enrichment/category-config.mjs";
import { enrichListing } from "../lib/enrichment/pipeline.mjs";
import {
  buildListingEnrichmentRow,
  createTimestampTag,
  fetchRawListingsByIngestRun,
  getSupabaseAdminClientFromEnv,
  insertEnrichmentRun,
  lookupRawListingIds,
  readCrawlerJsonl,
  replaceProximityMatches,
  updateEnrichmentRun,
  upsertListingEnrichments,
  writeEnrichmentArtifacts,
} from "../lib/enrichment/io.mjs";

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
    inputFile: null,
    ingestRunId: null,
    outDir: "data/enriched",
    categories: [],
    limit: null,
    skipDbWrites: false,
    skipFileWrites: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--input-file" && next) {
      args.inputFile = next;
      index += 1;
      continue;
    }

    if (arg === "--ingest-run-id" && next) {
      args.ingestRunId = next;
      index += 1;
      continue;
    }

    if (arg === "--out-dir" && next) {
      args.outDir = next;
      index += 1;
      continue;
    }

    if (arg === "--category" && next) {
      args.categories.push(next);
      index += 1;
      continue;
    }

    if (arg === "--limit" && next) {
      args.limit = Number(next);
      index += 1;
      continue;
    }

    if (arg === "--skip-db-writes") {
      args.skipDbWrites = true;
      continue;
    }

    if (arg === "--skip-file-writes") {
      args.skipFileWrites = true;
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
  node scripts/enrich-rental-listings-google.mjs --input-file data/raw/<file>.jsonl [--ingest-run-id <uuid>] [--category gym] [--category "climbing gym"]
  node scripts/enrich-rental-listings-google.mjs --ingest-run-id <uuid> [--category gym]

Options:
  --input-file <path>      Read crawler JSONL rows from disk.
  --ingest-run-id <uuid>   Read raw rows from Supabase or map file rows back to a DB ingest run.
  --category <value>       Add curated or free-text proximity categories. Repeatable.
  --limit <n>              Restrict the number of rows processed.
  --out-dir <path>         Directory for JSONL/CSV/meta outputs. Default: data/enriched
  --skip-db-writes         Do not create enrichment_runs or insert enrichment tables.
  --skip-file-writes       Do not emit JSONL/CSV/meta output files.
`);
}

function buildFailureResult(listing, error) {
  return {
    listing,
    geocode: {
      status: "failed",
      query: null,
      input: {},
      partialMatch: false,
      formattedAddress: null,
      placeId: null,
      locationType: null,
      resultTypes: [],
      latitude: null,
      longitude: null,
      payload: {
        error: String(error.message || error),
      },
    },
    weather: {
      status: "skipped",
      snapshot: {},
      payload: {},
      fetchedAt: null,
    },
    airQuality: {
      status: "skipped",
      snapshot: {},
      payload: {},
      fetchedAt: null,
    },
    sunlight: {
      status: "skipped",
      score: null,
      confidence: null,
      estimatedOrientationHint: null,
      reasons: [],
      payload: {},
      fetchedAt: null,
    },
    proximityMatches: [],
  };
}

async function main() {
  let enrichmentRun = null;
  let supabase = null;

  try {
    loadLocalEnvFiles();
    const args = parseArgs(process.argv.slice(2));

    if (args.help || (!args.inputFile && !args.ingestRunId)) {
      printHelp();
      process.exit(args.help ? 0 : 1);
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error("GOOGLE_MAPS_API_KEY is required.");
    }

    const sourceMode = args.inputFile ? "file" : "db";
    supabase = getSupabaseAdminClientFromEnv();

    if (sourceMode === "db" && !supabase) {
      throw new Error(
        "DB input mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    const writeToDb = Boolean(supabase && !args.skipDbWrites);
    const googleClient = createGoogleMapsClient({
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    });
    const categories = resolveRequestedCategories(args.categories);

    const listings =
      sourceMode === "file"
        ? await readCrawlerJsonl(args.inputFile, args.limit)
        : await fetchRawListingsByIngestRun(
            supabase,
            args.ingestRunId,
            args.limit,
          );

    if (!listings.length) {
      throw new Error("No listings were found for enrichment.");
    }

    console.log(
      `Enriching ${listings.length} listing(s) using ${categories.length} proximity categories...`,
    );

    const dbRawIdMap =
      writeToDb && args.ingestRunId
        ? await lookupRawListingIds(
            supabase,
            args.ingestRunId,
            listings.map((listing) => listing.sourceListingId),
          )
        : new Map();

    if (writeToDb) {
      enrichmentRun = await insertEnrichmentRun(supabase, {
        source_mode: sourceMode,
        status: "running",
        input_file: args.inputFile ? resolve(args.inputFile) : null,
        input_ingest_run_id: args.ingestRunId,
        search_city: listings[0]?.searchCity || null,
        selected_categories: categories,
        requested_listing_count: listings.length,
        notes: {
          write_to_files: !args.skipFileWrites,
          write_to_db: writeToDb,
        },
      });
    }

    const enrichments = [];
    let failedCount = 0;

    for (const [index, listing] of listings.entries()) {
      console.log(
        `[${index + 1}/${listings.length}] ${listing.sourceListingId ?? "unknown"}...`,
      );
      try {
        const enrichment = await enrichListing({
          googleClient,
          listing,
          categories,
        });
        enrichments.push(enrichment);
        if (enrichment.geocode.status === "failed") {
          failedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        enrichments.push(buildFailureResult(listing, error));
      }
    }

    let artifactPaths = null;
    if (!args.skipFileWrites) {
      const outputStem = `olx_wroclaw_rental_enrichments_${createTimestampTag()}`;
      artifactPaths = await writeEnrichmentArtifacts({
        outDir: args.outDir,
        outputStem,
        enrichments,
        meta: {
          source_mode: sourceMode,
          input_file: args.inputFile ? resolve(args.inputFile) : null,
          input_ingest_run_id: args.ingestRunId,
          listing_count: enrichments.length,
          failed_count: failedCount,
          requested_categories: args.categories,
          resolved_categories: categories,
        },
      });
    }

    if (writeToDb && enrichmentRun) {
      const listingRows = enrichments.map((enrichment) =>
        buildListingEnrichmentRow({
          enrichmentRunId: enrichmentRun.id,
          listing: enrichment.listing,
          rawListingId:
            dbRawIdMap.get(enrichment.listing.sourceListingId) ??
            enrichment.listing.rawListingId,
          geocode: enrichment.geocode,
          weather: enrichment.weather,
          airQuality: enrichment.airQuality,
          sunlight: enrichment.sunlight,
        }),
      );

      const upsertedRows = await upsertListingEnrichments(supabase, listingRows);
      const enrichmentIdBySourceListingId = new Map(
        upsertedRows.map((row) => [row.source_listing_id, row.id]),
      );

      const proximityRowsByEnrichmentId = new Map();
      for (const enrichment of enrichments) {
        const listingEnrichmentId = enrichmentIdBySourceListingId.get(
          enrichment.listing.sourceListingId,
        );
        if (!listingEnrichmentId) continue;
        proximityRowsByEnrichmentId.set(
          listingEnrichmentId,
          enrichment.proximityMatches,
        );
      }
      await replaceProximityMatches(supabase, proximityRowsByEnrichmentId);

      await updateEnrichmentRun(supabase, enrichmentRun.id, {
        status: "completed",
        processed_listing_count: enrichments.length,
        succeeded_listing_count: enrichments.length - failedCount,
        failed_listing_count: failedCount,
        completed_at: new Date().toISOString(),
        notes: {
          write_to_files: !args.skipFileWrites,
          write_to_db: true,
          artifact_paths: artifactPaths,
        },
      });
    }

    console.log("Enrichment complete.");
    if (artifactPaths) {
      console.log(`JSONL: ${artifactPaths.jsonlPath}`);
      console.log(`CSV:   ${artifactPaths.csvPath}`);
      console.log(`META:  ${artifactPaths.metaPath}`);
    }
  } catch (error) {
    if (supabase && enrichmentRun) {
      await updateEnrichmentRun(supabase, enrichmentRun.id, {
        status: "failed",
        completed_at: new Date().toISOString(),
        notes: {
          fatal_error: String(error.message || error),
        },
      }).catch(() => {});
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
