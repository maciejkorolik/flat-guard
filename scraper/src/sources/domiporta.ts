import { extractLinks, buildRawData } from "../lib/parse.js";
import type { Source } from "../types.js";

const BASE_URL = "https://www.domiporta.pl/mieszkanie/wynajme/mazowieckie/warszawa";
const MAX_PAGES = 3;

const LINK_REGEX = /\(https:\/\/www\.domiporta\.pl\/nieruchomosci\/([^)\/\s]+)\/(\d+)\)/g;
const ID_REGEX = /\/nieruchomosci\/[^/]+\/(\d+)(?:\/|$)/;

export const domiporta: Source = {
  name: "domiporta",

  buildUrls() {
    return Array.from({ length: MAX_PAGES }, (_, i) => {
      const page = i + 1;
      return page === 1 ? BASE_URL : `${BASE_URL}?PageNumber=${page}`;
    });
  },

  parseLinks(markdown) {
    return extractLinks(
      markdown,
      LINK_REGEX,
      (match) => match[2] ?? null,
      (match) => `https://www.domiporta.pl/nieruchomosci/${match[1]}/${match[2]}`,
    );
  },

  prepareRaw(externalId, detailUrl, { markdown, metadata }) {
    const url = (metadata.url as string) ?? (metadata.sourceURL as string) ?? detailUrl;
    const resolvedId = externalId
      || url.match(ID_REGEX)?.[1]
      || url.split("/").filter((s) => /^\d+$/.test(s)).pop()
      || null;

    if (!markdown || !resolvedId) return null;

    return {
      source: "domiporta",
      external_id: resolvedId,
      raw_data: buildRawData(url, markdown, metadata),
      scraped_at: new Date().toISOString(),
    };
  },
};
