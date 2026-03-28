import { extractLinks, buildRawData } from "../lib/parse.js";
import type { Source } from "../types.js";

const BASE_URL = "https://www.morizon.pl/do-wynajecia/mieszkania/warszawa/";
const MAX_PAGES = 3;

const LINK_REGEX = /\(https:\/\/www\.morizon\.pl\/oferta\/([^)\s]*?-mzn(\d+))\)/g;
const ID_REGEX = /-mzn(\d+)$/;

export const morizon: Source = {
  name: "morizon",

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
      (match) => `https://www.morizon.pl/oferta/${match[1]}`,
    );
  },

  prepareRaw(externalId, detailUrl, { markdown, metadata }) {
    const url = (metadata.url as string) ?? (metadata.sourceURL as string) ?? detailUrl;
    const resolvedId = externalId
      || url.match(ID_REGEX)?.[1]
      || null;

    if (!markdown || !resolvedId) return null;

    return {
      source: "morizon",
      external_id: resolvedId,
      raw_data: buildRawData(url, markdown, metadata),
      scraped_at: new Date().toISOString(),
    };
  },
};
