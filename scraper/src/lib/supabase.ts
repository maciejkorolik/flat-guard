import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    client = createClient(url, key);
  }
  return client;
}

export interface RawListingRow {
  source: string;
  external_id: string;
  raw_data: string; // JSON string
  scraped_at: string;
}

export async function upsertRaw(rows: RawListingRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const { error, count } = await getClient()
    .from("listings_raw")
    .upsert(rows, { onConflict: "source,external_id", ignoreDuplicates: true, count: "exact" });

  if (error) {
    console.error(`[Supabase] Upsert error:`, error.message);
    return 0;
  }
  return count ?? rows.length;
}
