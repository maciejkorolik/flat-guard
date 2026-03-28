#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function printHelp() {
  console.log(`Usage:
  node scripts/upload-raw-listings-to-supabase.mjs [options] [jsonl files...]

Options:
  --env <path>        Explicit env file to load.
  --batch-size <n>    Insert batch size. Default: 50
  --dry-run           Validate, dedupe, and report without uploading.
  --help              Show this message.

Behavior:
  - loads env from .env.local in the current worktree, or falls back to the repo root
  - requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY
  - uploads rows into public.listings_raw
  - deduplicates by (source, external_id), preferring richer records
  - defaults to all non-sample JSONL files in data/raw/ when no files are passed
`);
}

function parseArgs(argv) {
  const args = {
    envPath: null,
    batchSize: 50,
    dryRun: false,
    files: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--env") {
      args.envPath = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (arg === "--batch-size") {
      const value = Number(argv[i + 1] ?? "");
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--batch-size must be a positive integer");
      }
      args.batchSize = value;
      i += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    args.files.push(arg);
  }

  return args;
}

function parseEnvText(text) {
  const env = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function loadEnv(explicitPath) {
  const candidates = [];

  if (explicitPath) {
    candidates.push(explicitPath);
  } else {
    const visited = new Set();
    let cursor = process.cwd();

    while (true) {
      const candidate = resolve(cursor, ".env.local");
      if (!visited.has(candidate)) {
        candidates.push(candidate);
        visited.add(candidate);
      }

      const parent = resolve(cursor, "..");
      if (parent === cursor) break;
      cursor = parent;
    }

    const repoCandidate = resolve(repoRoot, ".env.local");
    if (!visited.has(repoCandidate)) {
      candidates.push(repoCandidate);
    }
  }

  for (const candidate of candidates) {
    const abs = isAbsolute(candidate) ? candidate : resolve(process.cwd(), candidate);
    if (!existsSync(abs)) continue;
    const text = await readFile(abs, "utf8");
    return { path: abs, env: parseEnvText(text) };
  }

  throw new Error("Could not find .env.local in the worktree or repo root");
}

async function resolveInputFiles(cliFiles) {
  if (cliFiles.length > 0) {
    return cliFiles.map((file) => resolve(process.cwd(), file));
  }

  const dir = resolve(repoRoot, "data/raw");
  const entries = await readdir(dir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".jsonl"))
    .filter((name) => !name.includes(".sample."))
    .sort()
    .map((name) => resolve(dir, name));
}

function richness(raw) {
  const signalKeys = [
    "description_raw",
    "area_m2_detail_raw",
    "rooms_detail_raw",
    "floor_raw",
    "building_type_raw",
    "additional_rent_raw",
    "elevator_raw",
    "furnished_raw",
    "parking_raw",
    "street_hint_raw",
    "district_hint_raw",
  ];

  let score = 0;
  for (const key of signalKeys) {
    const value = raw[key];
    if (value !== null && value !== undefined && value !== "") score += 1;
  }

  if (raw.raw_detail_json && Object.keys(raw.raw_detail_json).length > 0) score += 3;

  return score;
}

async function collectRows(files) {
  const bestByKey = new Map();
  let totalRows = 0;

  for (const file of files) {
    const text = await readFile(file, "utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      totalRows += 1;
      const raw = JSON.parse(line);
      const source = raw.source;
      const externalId = raw.listing_id;

      if (!source || !externalId) {
        throw new Error(`Row in ${file} is missing source or listing_id`);
      }

      const row = {
        source,
        external_id: externalId,
        raw_data: raw,
        scraped_at: raw.scraped_at_utc ?? new Date().toISOString(),
        normalized_id: null,
      };

      const key = `${source}::${externalId}`;
      const current = bestByKey.get(key);

      if (!current) {
        bestByKey.set(key, row);
        continue;
      }

      const currentScore = richness(current.raw_data);
      const nextScore = richness(raw);

      if (nextScore > currentScore) {
        bestByKey.set(key, row);
        continue;
      }

      if (nextScore === currentScore) {
        const currentTs = Date.parse(current.scraped_at) || 0;
        const nextTs = Date.parse(row.scraped_at) || 0;
        if (nextTs >= currentTs) bestByKey.set(key, row);
      }
    }
  }

  return {
    totalRows,
    uniqueRows: [...bestByKey.values()],
    duplicateRows: totalRows - bestByKey.size,
  };
}

async function rest(url, key, path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...options.headers,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  return { res, text };
}

async function fetchCount(url, key) {
  const { res } = await rest(url, key, "listings_raw?select=id", {
    method: "HEAD",
    headers: {
      Prefer: "count=exact",
      Range: "0-0",
    },
  });

  return Number(res.headers.get("content-range")?.split("/")[1] ?? "0");
}

async function uploadRows({ url, key, rows, batchSize }) {
  let attemptedRows = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    await rest(url, key, "listings_raw?on_conflict=source,external_id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    attemptedRows += batch.length;
  }

  return attemptedRows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { path: envPath, env } = await loadEnv(args.envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in the selected env file",
    );
  }

  const files = await resolveInputFiles(args.files);
  if (files.length === 0) {
    throw new Error("No JSONL files found to upload");
  }

  const { totalRows, uniqueRows, duplicateRows } = await collectRows(files);

  const summary = {
    ok: true,
    env_path: envPath,
    files,
    total_rows: totalRows,
    unique_rows: uniqueRows.length,
    duplicate_rows_removed: duplicateRows,
    mode: args.dryRun ? "dry-run" : "upload",
  };

  if (args.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const beforeCount = await fetchCount(url, key);
  const attemptedRows = await uploadRows({
    url,
    key,
    rows: uniqueRows,
    batchSize: args.batchSize,
  });
  const afterCount = await fetchCount(url, key);

  console.log(
    JSON.stringify(
      {
        ...summary,
        attempted_upload_rows: attemptedRows,
        before_count: beforeCount,
        after_count: afterCount,
        count_delta: afterCount - beforeCount,
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
