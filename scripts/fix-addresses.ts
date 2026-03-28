/**
 * Aktualizuje TYLKO kolumnę 'address' w listings_normalized dla rekordów gdzie address IS NULL.
 * Nie resetuje bazy — bezpieczne przy równoległej pracy innych.
 *
 * Uruchom: npx tsx --env-file=.env.local scripts/fix-addresses.ts
 */

import { createClient } from "@supabase/supabase-js";
import { parseOlxListing } from "../lib/normalize/parse-olx";
import { parseOtodomListing } from "../lib/normalize/parse-otodom";
import { parseGratkaListing } from "../lib/normalize/parse-gratka";
import { parseMorizonListing } from "../lib/normalize/parse-morizon";
import { parseDomiportaListing } from "../lib/normalize/parse-domiporta";
import type { NormalizedListing } from "../lib/normalize/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function selectParser(source: string): ((raw: Record<string, unknown>) => NormalizedListing) | null {
  if (source === "olx" || source === "olx.pl") return parseOlxListing;
  if (source === "otodom") return parseOtodomListing;
  if (source === "gratka") return parseGratkaListing;
  if (source === "morizon") return parseMorizonListing;
  if (source === "domiporta") return parseDomiportaListing;
  return null;
}

function deserialize(rawData: unknown): Record<string, unknown> {
  let parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed as Record<string, unknown>;
}

async function run() {
  // Fetch all normalized records with NULL address
  const { data: nullRows, error } = await supabase
    .from("listings_normalized")
    .select("id, source, external_id")
    .is("address", null);

  if (error) { console.error("Błąd:", error.message); process.exit(1); }
  console.log(`Znaleziono ${nullRows?.length} rekordów z address=NULL\n`);

  let fixed = 0, stillNull = 0, failed = 0;

  for (const row of nullRows ?? []) {
    const parser = selectParser(row.source);
    if (!parser) continue;

    // Fetch raw_data for this record
    const { data: rawRow } = await supabase
      .from("listings_raw")
      .select("raw_data")
      .eq("source", row.source)
      .eq("external_id", row.external_id)
      .single();

    if (!rawRow) { failed++; continue; }

    let rawData: Record<string, unknown>;
    try {
      rawData = deserialize(rawRow.raw_data);
    } catch {
      failed++;
      continue;
    }

    let parsed: NormalizedListing;
    try {
      parsed = parser(rawData);
    } catch {
      failed++;
      continue;
    }

    if (!parsed.address) {
      stillNull++;
      continue;
    }

    // Update ONLY the address column
    const { error: updateError } = await supabase
      .from("listings_normalized")
      .update({ address: parsed.address })
      .eq("id", row.id);

    if (updateError) {
      console.error(`❌ ${row.source}/${row.external_id}: ${updateError.message}`);
      failed++;
    } else {
      console.log(`✅ [${row.source.padEnd(9)}] ${row.external_id.slice(0, 40).padEnd(40)} → "${parsed.address}"`);
      fixed++;
    }
  }

  console.log(`\nGotowe: ${fixed} zaktualizowano, ${stillNull} nadal NULL (brak danych w źródle), ${failed} błędów`);
}

run().catch(err => { console.error(err); process.exit(1); });
