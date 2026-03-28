import { extractLinks, buildRawData } from "../lib/parse.js";
import type { Source } from "../types.js";

const BASE_URL = "https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/mazowieckie/warszawa/warszawa/warszawa";
const MAX_PAGES = 15;

const LINK_REGEX = /\(https:\/\/www\.otodom\.pl\/pl\/oferta\/([^)\s]+)\)/g;
const ID_REGEX = /-ID(\d+)$/;

export const otodom: Source = {
  name: "otodom",

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
        const slug = match[1].split("?")[0].replace(/\/$/, "");
        return slug.match(ID_REGEX)?.[1]
          ?? slug.split("/").pop()
          ?? null;
      },
      (match) => {
        const slug = match[1].split("?")[0].replace(/\/$/, "");
        return `https://www.otodom.pl/pl/oferta/${slug}`;
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
      source: "otodom",
      external_id: resolvedId,
      raw_data: buildRawData(url, markdown, metadata),
      scraped_at: new Date().toISOString(),
    };
  },
};
