#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createGoogleMapsClient } from "../lib/enrichment/google-maps.mjs";
import { resolveRequestedCategories } from "../lib/enrichment/category-config.mjs";
import { enrichListing } from "../lib/enrichment/pipeline.mjs";
import {
  NORMALIZED_ENRICHMENT_OUTPUT_COLUMNS,
  buildNormalizedEnrichmentUpdate,
  createTimestampTag,
  fetchNormalizedListingsForEnrichment,
  fetchSupabaseOpenApiSchema,
  filterRecordToAllowedColumns,
  getSupabaseAdminClientFromEnv,
  getSupabaseAdminKeyFromEnv,
  getTableColumnNames,
  getTableDefinition,
  insertEnrichmentRun,
  intersectColumnNames,
  updateEnrichmentRun,
  updateNormalizedListingEnrichment,
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
    batchSize: 20,
    categories: [],
    limit: null,
    onlyMissing: true,
    outDir: "data/enriched",
    skipDbWrites: false,
    source: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--batch-size" && next) {
      args.batchSize = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (arg === "--category" && next) {
      args.categories.push(next);
      index += 1;
      continue;
    }

    if (arg === "--limit" && next) {
      args.limit = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (arg === "--out-dir" && next) {
      args.outDir = next;
      index += 1;
      continue;
    }

    if (arg === "--source" && next) {
      args.source = next;
      index += 1;
      continue;
    }

    if (arg === "--all") {
      args.onlyMissing = false;
      continue;
    }

    if (arg === "--skip-db-writes") {
      args.skipDbWrites = true;
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
  node scripts/enrich-listings-normalized-batches.mjs [--limit 20] [--batch-size 20] [--source olx] [--category gym]

Options:
  --limit <n>              Max listings to process. Default: all matching rows.
  --batch-size <n>         Rows per batch. Default: 20.
  --source <value>         Restrict to one listings_normalized source.
  --category <value>       Add curated or free-text proximity categories. Repeatable.
  --all                    Re-enrich all selected rows, not just rows missing enrichment.
  --skip-db-writes         Validate and dump issues without updating listings_normalized.
  --out-dir <path>         Directory for issue/meta output. Default: data/enriched
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

function buildPotentialIssues(enrichment) {
  const issues = [];

  if (enrichment.geocode.status !== "succeeded") {
    issues.push({
      scope: "geocode",
      status: enrichment.geocode.status,
      query: enrichment.geocode.query,
      api: enrichment.geocode.payload?.api || "geocode",
      provider_status: enrichment.geocode.payload?.status || null,
      provider_error_message:
        enrichment.geocode.payload?.error_message ||
        enrichment.geocode.payload?.error ||
        null,
    });
  }

  for (const [scope, signal] of [
    ["weather", enrichment.weather],
    ["air_quality", enrichment.airQuality],
    ["sunlight", enrichment.sunlight],
  ]) {
    if (signal.status === "failed") {
      issues.push({
        scope,
        api: signal.payload?.api || null,
        status: signal.status,
        provider_status: signal.payload?.status || null,
        provider_error_message:
          signal.payload?.error_message || signal.payload?.error || null,
      });
    }
  }

  if (enrichment.geocode.status === "succeeded") {
    for (const match of enrichment.proximityMatches) {
      if (!match.placeId || match.routeCondition !== "ROUTE_EXISTS") {
        issues.push({
          scope: "proximity",
          category_key: match.categoryKey,
          route_condition: match.routeCondition,
          place_name: match.placeName,
        });
      }
    }
  }

  return issues;
}

function dedupeIssueEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = JSON.stringify(entry);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function writeIssueArtifacts({ outDir, outputStem, issues, meta }) {
  await mkdir(outDir, { recursive: true });

  const issuesPath = resolve(outDir, `${outputStem}.issues.jsonl`);
  const metaPath = resolve(outDir, `${outputStem}.meta.json`);
  const issuesContent = issues.map((entry) => JSON.stringify(entry)).join("\n");

  await Promise.all([
    writeFile(issuesPath, issuesContent ? `${issuesContent}\n` : ""),
    writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`),
  ]);

  return {
    issuesPath,
    metaPath,
  };
}

async function main() {
  let enrichmentRun = null;

  loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!Number.isFinite(args.batchSize) || args.batchSize <= 0) {
    throw new Error("--batch-size must be a positive integer.");
  }

  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive integer.");
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is required.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = getSupabaseAdminKeyFromEnv();
  const supabase = getSupabaseAdminClientFromEnv();

  if (!supabaseUrl || !supabaseKey || !supabase) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY.",
    );
  }

  const openApiSchema = await fetchSupabaseOpenApiSchema({
    supabaseUrl,
    supabaseKey,
  });
  const normalizedColumns = getTableColumnNames(openApiSchema, "listings_normalized");
  if (!normalizedColumns.size) {
    throw new Error("Failed to read listings_normalized columns from Supabase.");
  }

  const updateColumns = new Set(
    intersectColumnNames(NORMALIZED_ENRICHMENT_OUTPUT_COLUMNS, normalizedColumns),
  );
  const categories = resolveRequestedCategories(args.categories);
  const googleClient = createGoogleMapsClient({
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  });

  let targetRows = [];
  let offset = 0;
  while (true) {
    const remaining = Number.isFinite(args.limit) ? args.limit - targetRows.length : 200;
    if (remaining <= 0) {
      break;
    }

    const page = await fetchNormalizedListingsForEnrichment(supabase, {
      availableColumns: normalizedColumns,
      limit: Math.min(200, remaining),
      offset,
      source: args.source,
      onlyMissing: args.onlyMissing,
    });

    if (!page.length) {
      break;
    }

    targetRows = targetRows.concat(page);
    offset += page.length;

    if (page.length < Math.min(200, remaining)) {
      break;
    }
  }

  if (!targetRows.length) {
    console.log("No matching listings_normalized rows were found.");
    return;
  }

  const writeToDb = !args.skipDbWrites;
  const hasEnrichmentRunsTable = Boolean(
    getTableDefinition(openApiSchema, "enrichment_runs"),
  );

  console.log(
    `Processing ${targetRows.length} listings_normalized row(s) in batches of ${args.batchSize}.`,
  );
  console.log(
    `Enrichment update columns available: ${Array.from(updateColumns).join(", ") || "none"}`,
  );

  if (writeToDb && hasEnrichmentRunsTable) {
    enrichmentRun = await insertEnrichmentRun(supabase, {
      source_mode: "db",
      status: "running",
      input_file: null,
      search_city: targetRows[0]?.searchCity || null,
      selected_categories: categories,
      requested_listing_count: targetRows.length,
      notes: {
        source: args.source,
        batch_size: args.batchSize,
        only_missing: args.onlyMissing,
        target_table: "listings_normalized",
      },
    });
  }

  const issueEntries = [];
  let updatedCount = 0;
  let failedCount = 0;

  for (let start = 0; start < targetRows.length; start += args.batchSize) {
    const batch = targetRows.slice(start, start + args.batchSize);
    console.log(
      `Batch ${Math.floor(start / args.batchSize) + 1}: ${batch.length} listing(s)`,
    );

    for (const listing of batch) {
      let enrichment;
      try {
        enrichment = await enrichListing({
          googleClient,
          listing,
          categories,
        });
      } catch (error) {
        enrichment = buildFailureResult(listing, error);
        failedCount += 1;
        issueEntries.push({
          listing_id: listing.normalizedListingId,
          source: listing.source,
          external_id: listing.sourceListingId,
          issues: [
            {
              scope: "execution",
              status: "failed",
              error: String(error.message || error),
            },
          ],
        });
      }

      const issues = buildPotentialIssues(enrichment);
      if (issues.length) {
        const deniedIssues = issues.filter(
          (issue) =>
            issue.provider_status === "REQUEST_DENIED" ||
            issue.provider_error_message?.includes("403") ||
            issue.provider_error_message?.includes("Forbidden"),
        );
        for (const issue of deniedIssues) {
          console.error(
            `[denied] listing=${listing.normalizedListingId} source=${listing.source} api=${issue.api || issue.scope} status=${issue.provider_status || "unknown"} message=${issue.provider_error_message || "n/a"}`,
          );
        }

        issueEntries.push({
          listing_id: listing.normalizedListingId,
          source: listing.source,
          external_id: listing.sourceListingId,
          issues: dedupeIssueEntries(issues),
        });
      }

      const updatePayload = filterRecordToAllowedColumns(
        buildNormalizedEnrichmentUpdate({
          enrichmentRunId: enrichmentRun?.id || null,
          enrichment,
        }),
        updateColumns,
      );

      if (!Object.keys(updatePayload).length) {
        issueEntries.push({
          listing_id: listing.normalizedListingId,
          source: listing.source,
          external_id: listing.sourceListingId,
          issues: [
            {
              scope: "db_update",
              status: "skipped",
              error: "No enrichment target columns are present in listings_normalized.",
            },
          ],
        });
        continue;
      }

      if (!writeToDb) {
        continue;
      }

      try {
        await updateNormalizedListingEnrichment(
          supabase,
          listing.normalizedListingId,
          updatePayload,
        );
        updatedCount += 1;
      } catch (error) {
        failedCount += 1;
        issueEntries.push({
          listing_id: listing.normalizedListingId,
          source: listing.source,
          external_id: listing.sourceListingId,
          issues: [
            {
              scope: "db_update",
              status: "failed",
              error: String(error.message || error),
              payload_keys: Object.keys(updatePayload),
            },
          ],
        });
      }
    }
  }

  if (writeToDb && enrichmentRun) {
    await updateEnrichmentRun(supabase, enrichmentRun.id, {
      status: failedCount ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      processed_listing_count: targetRows.length,
      enriched_listing_count: updatedCount,
      failed_listing_count: failedCount,
      notes: {
        ...enrichmentRun.notes,
        issue_count: issueEntries.length,
      },
    });
  }

  const outputStem = `listings-normalized-enrichment-${createTimestampTag()}`;
  const artifactPaths = await writeIssueArtifacts({
    outDir: args.outDir,
    outputStem,
    issues: issueEntries,
    meta: {
      target_count: targetRows.length,
      updated_count: updatedCount,
      failed_count: failedCount,
      issue_count: issueEntries.length,
      batch_size: args.batchSize,
      only_missing: args.onlyMissing,
      source: args.source,
      write_to_db: writeToDb,
      available_update_columns: Array.from(updateColumns),
      enrichment_run_id: enrichmentRun?.id || null,
    },
  });

  console.log(`Updated listings: ${updatedCount}`);
  console.log(`Listings with issues: ${issueEntries.length}`);
  console.log(`Failed listings: ${failedCount}`);
  console.log(`Issue dump: ${artifactPaths.issuesPath}`);
  console.log(`Meta: ${artifactPaths.metaPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
