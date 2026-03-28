#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { dedupeProjectedRows, projectOlxRecord, readJsonl } from "./lib/olx-ingest.mjs";

function parseEnvFile(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) {
    return env;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    env[key] = rest.join("=");
  }

  return env;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const jsonlPath = args.find((arg) => !arg.startsWith("--"));
  const envFlagIndex = args.findIndex((arg) => arg === "--env-file");
  const envFile = envFlagIndex >= 0 ? args[envFlagIndex + 1] : ".env.local";

  if (!jsonlPath) {
    throw new Error("Usage: node scripts/upload-olx-jsonl-to-supabase.mjs <jsonl-path> [--env-file .env.local]");
  }

  return {
    jsonlPath,
    envFile,
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function compactNullish(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== null && value !== undefined),
  );
}

function encodeInValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function createSupabaseRestClient({ supabaseUrl, supabaseKey }) {
  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

  async function request(method, table, { query = "", body, prefer } = {}) {
    const response = await fetch(`${baseUrl}/${table}${query}`, {
      method,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const message =
        (typeof payload === "object" && payload !== null && (payload.message || payload.error)) ||
        text ||
        `${method} ${table} failed`;
      throw new Error(message);
    }

    return payload;
  }

  return {
    async selectNormalizedIds(source, externalIds) {
      const encodedIds = externalIds.map(encodeInValue).join(",");
      const query = `?select=id,source,external_id&source=eq.${encodeURIComponent(source)}&external_id=in.(${encodedIds})`;
      return request("GET", "listings_normalized", { query });
    },
    async insertNormalized(rows) {
      return request("POST", "listings_normalized?select=id,source,external_id", {
        body: rows,
        prefer: "return=representation",
      });
    },
    async updateNormalized(row) {
      const query = `?source=eq.${encodeURIComponent(row.source)}&external_id=eq.${encodeURIComponent(row.external_id)}`;
      return request("PATCH", "listings_normalized", {
        query,
        body: row,
      });
    },
    async insertRaw(rows) {
      return request("POST", "listings_raw", {
        body: rows,
        prefer: "return=minimal",
      });
    },
  };
}

async function fetchExistingNormalizedIds(client, rows) {
  const keyToId = new Map();
  const rowsBySource = rows.reduce((acc, row) => {
    const list = acc.get(row.source) || [];
    list.push(row.external_id);
    acc.set(row.source, list);
    return acc;
  }, new Map());

  for (const [source, externalIds] of rowsBySource.entries()) {
    for (const idsChunk of chunk([...new Set(externalIds)], 100)) {
      const data = await client.selectNormalizedIds(source, idsChunk);
      for (const row of data || []) {
        keyToId.set(`${row.source}:${row.external_id}`, row.id);
      }
    }
  }

  return keyToId;
}

async function insertNormalizedRows(client, rows) {
  if (rows.length === 0) {
    return [];
  }

  return (
    (await client.insertNormalized(
      rows.map((row) => ({
        source: row.source,
        external_id: row.external_id,
        url: row.url,
        title: row.title,
        description: row.description,
        exact_location_available: row.exact_location_available,
        image_urls: row.image_urls,
        source_business_type: row.source_business_type,
        source_offer_payload: row.source_offer_payload,
        source_detail_payload: row.source_detail_payload,
        is_active: true,
        first_seen_at: row.scraped_at,
        last_seen_at: row.scraped_at,
        city: row.city,
        district: row.district,
        neighbourhood: row.neighbourhood,
        address: row.address,
        area_m2: row.area_m2,
        rooms: row.rooms,
        floor: row.floor,
        building_type: row.building_type,
        offer_type: row.offer_type,
        rent_pln: row.rent_pln,
        fees: row.fees,
        total_monthly_pln: row.total_monthly_pln,
        has_elevator: row.has_elevator,
        is_furnished: row.is_furnished,
        parking_type: row.parking_type,
      })),
    )) || []
  );
}

async function updateNormalizedRow(client, row) {
  const payload = compactNullish({
    url: row.url,
    title: row.title,
    description: row.description,
    exact_location_available: row.exact_location_available,
    image_urls: row.image_urls,
    source_business_type: row.source_business_type,
    source_offer_payload: row.source_offer_payload,
    source_detail_payload: row.source_detail_payload,
    is_active: true,
    last_seen_at: row.scraped_at,
    city: row.city,
    district: row.district,
    neighbourhood: row.neighbourhood,
    address: row.address,
    area_m2: row.area_m2,
    rooms: row.rooms,
    floor: row.floor,
    building_type: row.building_type,
    offer_type: row.offer_type,
    rent_pln: row.rent_pln,
    fees: row.fees,
    total_monthly_pln: row.total_monthly_pln,
    has_elevator: row.has_elevator,
    is_furnished: row.is_furnished,
    parking_type: row.parking_type,
  });

  await client.updateNormalized({
    source: row.source,
    external_id: row.external_id,
    ...payload,
  });
}

try {
  const { jsonlPath, envFile } = parseArgs(process.argv);
  const envPath = path.resolve(envFile);
  const env = {
    ...parseEnvFile(envPath),
    ...process.env,
  };

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY, or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const rawRows = readJsonl(jsonlPath);
  const projectedRows = dedupeProjectedRows(rawRows.map(projectOlxRecord));
  const client = createSupabaseRestClient({ supabaseUrl, supabaseKey });

  const existingIds = await fetchExistingNormalizedIds(client, projectedRows);
  const inserts = projectedRows.filter((row) => !existingIds.has(`${row.source}:${row.external_id}`));
  const updates = projectedRows.filter((row) => existingIds.has(`${row.source}:${row.external_id}`));

  for (const row of updates) {
    await updateNormalizedRow(client, row);
  }

  const inserted = await insertNormalizedRows(client, inserts);
  for (const row of inserted) {
    existingIds.set(`${row.source}:${row.external_id}`, row.id);
  }

  const rawPayload = rawRows.map((row) => {
    const projected = projectOlxRecord(row);
    return {
      source: projected.source,
      external_id: projected.external_id,
      raw_data: row,
      scraped_at: projected.scraped_at,
      normalized_id: existingIds.get(`${projected.source}:${projected.external_id}`) || null,
    };
  });

  for (const batch of chunk(rawPayload, 100)) {
    await client.insertRaw(batch);
  }

  console.log(`Uploaded ${rawRows.length} raw rows from ${path.resolve(jsonlPath)}`);
  console.log(`Inserted normalized rows: ${inserts.length}`);
  console.log(`Updated normalized rows: ${updates.length}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
