export interface ParsedLink {
  detailUrl: string;
  externalId: string;
}

/**
 * Extract unique links from Firecrawl markdown using a regex.
 * The regex must have at least one capture group for externalId extraction.
 */
export function extractLinks(
  markdown: string,
  linkRegex: RegExp,
  extractId: (match: RegExpExecArray) => string | null,
  buildUrl: (match: RegExpExecArray) => string,
): ParsedLink[] {
  const found = new Map<string, ParsedLink>();
  let match: RegExpExecArray | null;

  // Reset the regex state
  linkRegex.lastIndex = 0;

  while ((match = linkRegex.exec(markdown)) !== null) {
    const externalId = extractId(match);
    if (externalId && !found.has(externalId)) {
      found.set(externalId, {
        detailUrl: buildUrl(match),
        externalId,
      });
    }
  }

  return Array.from(found.values());
}

/**
 * Build raw_data JSON payload for a scraped detail page.
 */
export function buildRawData(
  url: string,
  markdown: string,
  metadata: Record<string, unknown>,
): string {
  return JSON.stringify({
    url,
    markdown,
    metadata,
    scraped_at: new Date().toISOString(),
  });
}
