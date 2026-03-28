/**
 * Normalizacja listings_raw → listings_normalized
 *
 * Wymaga SUPABASE_SERVICE_ROLE_KEY w .env.local
 * Uruchom: npm run normalize
 */

import { createClient } from "@supabase/supabase-js";
import { parseOlxListing } from "../lib/normalize/parse-olx";
import { parseOtodomListing } from "../lib/normalize/parse-otodom";
import { parseGratkaListing } from "../lib/normalize/parse-gratka";
import { parseMorizonListing } from "../lib/normalize/parse-morizon";
import { parseDomiportaListing } from "../lib/normalize/parse-domiporta";
import type { NormalizedListing } from "../lib/normalize/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Brakuje zmiennych środowiskowych:\n" +
    "  NEXT_PUBLIC_SUPABASE_URL\n" +
    "  SUPABASE_SERVICE_ROLE_KEY\n\n" +
    "Dodaj SUPABASE_SERVICE_ROLE_KEY do .env.local\n" +
    "(Supabase Dashboard → Settings → API → service_role)"
  );
  process.exit(1);
}

// Service role key omija RLS — używaj tylko w skryptach backendowych
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function deserialize(rawData: unknown): Record<string, unknown> {
  // Obsługuje podwójną serializację: JSONB może zawierać JSON string zamiast obiektu
  let parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed as Record<string, unknown>;
}

function selectParser(source: string): ((raw: Record<string, unknown>) => NormalizedListing) | null {
  if (source === "olx" || source === "olx.pl") return parseOlxListing;
  if (source === "otodom") return parseOtodomListing;
  if (source === "gratka") return parseGratkaListing;
  if (source === "morizon") return parseMorizonListing;
  if (source === "domiporta") return parseDomiportaListing;
  return null;
}

async function run() {
  console.log("Pobieranie niezanormalizowanych wierszy z listings_raw...\n");

  const { data: rawRows, error: fetchError } = await supabase
    .from("listings_raw")
    .select("id, source, external_id, raw_data")
    .is("normalized_id", null);

  if (fetchError) {
    console.error("Błąd przy pobieraniu listings_raw:", fetchError.message);
    process.exit(1);
  }

  if (!rawRows || rawRows.length === 0) {
    console.log("Brak nowych wierszy do normalizacji.");
    return;
  }

  console.log(`Znaleziono ${rawRows.length} rekordów do przetworzenia.\n`);

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rawRows) {
    const parser = selectParser(row.source);
    if (!parser) {
      console.warn(`⚠️  Pominięto ${row.external_id} — brak parsera dla źródła: ${row.source}`);
      skipped++;
      continue;
    }

    let rawData: Record<string, unknown>;
    try {
      rawData = deserialize(row.raw_data);
    } catch (err) {
      console.error(`❌ ${row.external_id}: błąd deserializacji — ${err}`);
      failed++;
      continue;
    }

    let normalized: NormalizedListing;
    try {
      normalized = {
        ...parser(rawData),
        // Nadpisz kanonicznymi identyfikatorami z listings_raw (zawsze poprawne)
        source: row.source,
        external_id: row.external_id,
      };
    } catch (err) {
      console.error(`❌ ${row.external_id}: błąd parsowania — ${err}`);
      failed++;
      continue;
    }

    // Upsert — bezpieczne przy ponownym uruchomieniu (unique: source + external_id)
    const { data: inserted, error: upsertError } = await supabase
      .from("listings_normalized")
      .upsert(normalized, { onConflict: "source,external_id" })
      .select("id")
      .single();

    if (upsertError || !inserted) {
      console.error(`❌ ${row.external_id}: ${upsertError?.message ?? "brak ID po upsert"}`);
      failed++;
      continue;
    }

    // Zaktualizuj listings_raw.normalized_id → link do znormalizowanego rekordu
    const { error: updateError } = await supabase
      .from("listings_raw")
      .update({ normalized_id: inserted.id })
      .eq("id", row.id);

    if (updateError) {
      console.warn(`⚠️  ${row.external_id}: upsert OK, ale normalized_id nie zaktualizowany: ${updateError.message}`);
    }

    console.log(`✅ [${row.source.padEnd(6)}] ${row.external_id.slice(0, 40).padEnd(40)} → ${inserted.id}`);
    ok++;
  }

  console.log(
    `\nGotowe: ${ok} znormalizowano, ${failed} błędów, ${skipped} pominięto (brak parsera).`
  );
}

run().catch((err) => {
  console.error("Nieoczekiwany błąd:", err);
  process.exit(1);
});
