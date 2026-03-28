import { extractLinks, buildRawData } from "../lib/parse.js";
import type { Source } from "../types.js";

const BASE_URL = "https://gratka.pl/nieruchomosci/mieszkania/warszawa/wynajem";
const MAX_PAGES = 3;

const LINK_REGEX = /\(https:\/\/gratka\.pl\/nieruchomosci\/[^)\s]+?\/(oi|ob)\/(\d+)\)/g;
const ID_REGEX = /\/(?:oi|ob)\/(\d+)(?:\/|$)/;

export const gratka: Source = {
  name: "gratka",

  buildUrls() {
    return Array.from({ length: MAX_PAGES }, (_, i) => {
      const page = i + 1;
      return page === 1 ? BASE_URL : `${BASE_URL}?page=${page}`;
    });
  },

  parseLinks(markdown) {
    return extractLinks(
      markdown,
      LINK_REGEX,
      (match) => match[2] ?? null,
      (match) => match[0].slice(1, -1), // strip surrounding parens
    );
  },

  prepareRaw(externalId, detailUrl, { markdown, metadata }) {
    const url = (metadata.url as string) ?? (metadata.sourceURL as string) ?? detailUrl;
    const resolvedId = externalId
      || url.match(ID_REGEX)?.[1]
      || null;

    if (!markdown || !resolvedId) return null;

    return {
      source: "gratka",
      external_id: resolvedId,
      raw_data: buildRawData(url, markdown, metadata),
      scraped_at: new Date().toISOString(),
    };
  },
};
