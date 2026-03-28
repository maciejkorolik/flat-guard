import "dotenv/config";
import pLimit from "p-limit";
import { scrapeUrl } from "./lib/firecrawl.js";
import { upsertRaw, type RawListingRow } from "./lib/supabase.js";
import type { Source } from "./types.js";
import { olx } from "./sources/olx.js";
import { otodom } from "./sources/otodom.js";
import { gratka } from "./sources/gratka.js";
import { morizon } from "./sources/morizon.js";
import { domiporta } from "./sources/domiporta.js";

const ALL_SOURCES: Source[] = [olx, otodom, gratka, morizon, domiporta];

const DETAIL_CONCURRENCY = 3;

async function runSource(source: Source): Promise<{ source: string; scraped: number; upserted: number }> {
  const limit = pLimit(DETAIL_CONCURRENCY);
  let scraped = 0;
  let upserted = 0;

  const pageUrls = source.buildUrls();
  console.log(`[${source.name}] Scraping ${pageUrls.length} listing pages…`);

  for (const pageUrl of pageUrls) {
    const pageResult = await scrapeUrl(pageUrl);
    if (!pageResult?.markdown) {
      console.warn(`[${source.name}] No markdown for page: ${pageUrl}`);
      continue;
    }

    const links = source.parseLinks(pageResult.markdown);
    console.log(`[${source.name}] Found ${links.length} links on ${pageUrl}`);

    if (links.length === 0) continue;

    const rows: RawListingRow[] = [];

    await Promise.all(
      links.map((link) =>
        limit(async () => {
          const detail = await scrapeUrl(link.detailUrl);
          if (!detail?.markdown) {
            console.warn(`[${source.name}] No markdown for detail: ${link.detailUrl}`);
            return;
          }

          scraped++;

          const row = source.prepareRaw(link.externalId, link.detailUrl, detail);
          if (row) {
            rows.push(row);
          } else {
            console.warn(`[${source.name}] Skipped (no id/markdown): ${link.detailUrl}`);
          }
        }),
      ),
    );

    if (rows.length > 0) {
      const count = await upsertRaw(rows);
      upserted += count;
      console.log(`[${source.name}] Upserted ${count} rows from page ${pageUrl}`);
    }
  }

  return { source: source.name, scraped, upserted };
}

export async function runScraper(sourceNames?: string[]): Promise<void> {
  const sources = sourceNames
    ? ALL_SOURCES.filter((s) => sourceNames.includes(s.name))
    : ALL_SOURCES;

  if (sources.length === 0) {
    console.error(`No matching sources found. Available: ${ALL_SOURCES.map((s) => s.name).join(", ")}`);
    return;
  }

  console.log(`Starting scraper for: ${sources.map((s) => s.name).join(", ")}`);

  const results = await Promise.allSettled(sources.map(runSource));

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { source, scraped, upserted } = result.value;
      console.log(`[${source}] Done — scraped: ${scraped}, upserted: ${upserted}`);
    } else {
      console.error(`Source failed:`, result.reason);
    }
  }
}

// CLI entry point
const args = process.argv.slice(2);
runScraper(args.length > 0 ? args : undefined).catch(console.error);
