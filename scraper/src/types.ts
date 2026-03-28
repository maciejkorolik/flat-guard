import type { ParsedLink } from "./lib/parse.js";
import type { RawListingRow } from "./lib/supabase.js";

export interface ScrapeResult {
  markdown: string;
  metadata: Record<string, unknown>;
}

export interface Source {
  name: string;
  buildUrls: () => string[];
  parseLinks: (markdown: string) => ParsedLink[];
  prepareRaw: (
    externalId: string,
    detailUrl: string,
    scrapeResult: ScrapeResult,
  ) => RawListingRow | null;
}
