import { extractLinks, buildRawData } from "../lib/parse.js";
import type { Source } from "../types.js";

const BASE_URL = "https://www.olx.pl/nieruchomosci/mieszkania/wynajem/warszawa/";
const MAX_PAGES = 20;

const LINK_REGEX = /\(https:\/\/www\.olx\.pl\/d\/oferta\/([^)]+)\)/g;
const ID_REGEX = /-ID([A-Za-z0-9]+)\.html$/;

export const olx: Source = {
  name: "olx",

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
      (match) => {
        const path = match[1].split("?")[0];
        return path.match(ID_REGEX)?.[1]
          ?? path.replace(".html", "").split("-").pop()
          ?? null;
      },
      (match) => {
        const path = match[1].split("?")[0];
        return `https://www.olx.pl/d/oferta/${path}`;
      },
    );
  },

  prepareRaw(externalId, detailUrl, { markdown, metadata }) {
    const url = (metadata.url as string) ?? (metadata.sourceURL as string) ?? detailUrl;
    const resolvedId = externalId
      || url.match(ID_REGEX)?.[1]
      || null;

    if (!markdown || !resolvedId) return null;

    return {
      source: "olx",
      external_id: resolvedId,
      raw_data: buildRawData(url, markdown, metadata),
      scraped_at: new Date().toISOString(),
    };
  },
};
