import FirecrawlApp from "@mendable/firecrawl-js";

let client: FirecrawlApp | null = null;

function getClient(): FirecrawlApp {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not set");
    client = new FirecrawlApp({ apiKey });
  }
  return client;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function scrapeUrl(url: string): Promise<{ markdown: string; metadata: Record<string, unknown> } | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await getClient().scrapeUrl(url);
      if (!result.success) {
        console.warn(`[Firecrawl] Scrape failed for ${url}: ${result.error ?? "unknown error"}`);
        return null;
      }
      return {
        markdown: result.markdown ?? "",
        metadata: (result.metadata ?? {}) as Record<string, unknown>,
      };
    } catch (err) {
      const isLast = attempt === MAX_RETRIES - 1;
      if (isLast) {
        console.error(`[Firecrawl] All ${MAX_RETRIES} attempts failed for ${url}:`, err);
        return null;
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[Firecrawl] Attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}
