#!/usr/bin/env node

import path from "node:path";
import {
  ACTIVE_NORMALIZED_COLUMNS,
  CURRENTLY_UNFILLED_NORMALIZED_COLUMNS,
  buildColumnCompleteness,
  dedupeProjectedRows,
  projectOlxRecord,
  readJsonl,
} from "./lib/olx-ingest.mjs";

function printSection(title, rows) {
  console.log(`\n${title}`);
  for (const row of rows) {
    console.log(
      `${row.column.padEnd(22)} ${String(row.filledCount).padStart(4)}/${String(row.totalCount).padEnd(4)} ${String(
        row.percentFilled.toFixed(1),
      ).padStart(5)}%`,
    );
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const jsonlPath = args.find((arg) => !arg.startsWith("--"));
  const topFlagIndex = args.findIndex((arg) => arg === "--top");
  const top = topFlagIndex >= 0 ? Number.parseInt(args[topFlagIndex + 1] || "5", 10) : 5;
  if (!jsonlPath) {
    throw new Error("Usage: node scripts/report-olx-ingest-completeness.mjs <jsonl-path> [--top N]");
  }
  return {
    jsonlPath,
    top: Number.isFinite(top) && top > 0 ? top : 5,
  };
}

try {
  const { jsonlPath, top } = parseArgs(process.argv);
  const rawRows = readJsonl(jsonlPath);
  const projectedRows = rawRows.map(projectOlxRecord);
  const normalizedRows = dedupeProjectedRows(projectedRows);

  const rawColumns = [...new Set(rawRows.flatMap((row) => Object.keys(row)))].sort();
  const rawCompleteness = buildColumnCompleteness(rawRows, rawColumns);
  const normalizedCompleteness = buildColumnCompleteness(normalizedRows, ACTIVE_NORMALIZED_COLUMNS);
  const expectedNullCompleteness = buildColumnCompleteness(normalizedRows, CURRENTLY_UNFILLED_NORMALIZED_COLUMNS);

  const duplicateCount = projectedRows.length - normalizedRows.length;
  const requiredFailures = projectedRows.filter(
    (row) => !row.source || !row.external_id || !row.scraped_at || !row.offer_type,
  ).length;

  console.log(`Dataset: ${path.resolve(jsonlPath)}`);
  console.log(`Raw rows: ${rawRows.length}`);
  console.log(`Projected normalized rows: ${normalizedRows.length}`);
  console.log(`Duplicate source/external_id rows collapsed during projection: ${duplicateCount}`);
  console.log(`Required-field compatibility failures: ${requiredFailures}`);

  printSection("Best raw columns", rawCompleteness.slice(0, top));
  printSection("Worst raw columns", rawCompleteness.slice(-top).reverse());
  printSection("Best mapped normalized columns", normalizedCompleteness.slice(0, top));
  printSection("Worst mapped normalized columns", normalizedCompleteness.slice(-top).reverse());
  printSection("Currently unfilled normalized columns", expectedNullCompleteness);

  if (requiredFailures > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
