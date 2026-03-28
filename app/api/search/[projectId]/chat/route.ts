import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { firstLine, parseFlatPicturesUrlColumn } from "@/lib/listing-normalize";
import {
  LISTING_WITH_ENRICHMENT_COLUMNS,
  searchFlatsInputSchema,
  execSearchFlats,
  execGetFlatSearchCardData,
  execGetGeoData,
  execGetSunData,
  execGetWeatherData,
  execGetAirQualityData,
  execGetPlacesNearby,
  execGetSearchExplainability,
  execGetEnrichmentCoverage,
  type FlatSearchToolsCtx,
} from "@/lib/flat-search-chat-tools";
import { z } from "zod";
import type { ScoredListing } from "@/lib/types/flatguard";
import { RESPOND_IN_ENGLISH_RULE } from "@/lib/ai-language-policy";
import { buildSearchAssistantSystemPrompt } from "@/lib/search-chat-system-prompt";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return new Response("OpenAI API key not configured", { status: 503 });
  }

  const { projectId } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) return new Response("Not found", { status: 404 });

  const { messages, scoredListings } = await req.json() as {
    messages: unknown[];
    scoredListings: ScoredListing[];
  };

  const allowedListingIds = new Set(scoredListings.map((s) => s.listing.id));
  const flatCtx: FlatSearchToolsCtx = { allowedListingIds, scoredListings };

  const listingIndex = scoredListings
    .map((s, i) => {
      const aqi = s.listing.air_quality_aqi_value;
      const aqiCode = s.listing.air_quality_aqi_index_code;
      const aqiLabel =
        aqi != null
          ? "AQI=" +
            String(aqi) +
            (aqiCode ? " idx=" + String(aqiCode) : "") +
            (s.listing.air_quality_aqi_category_en
              ? " (" + s.listing.air_quality_aqi_category_en + ")"
              : s.listing.air_quality_aqi_category
                ? " (" + s.listing.air_quality_aqi_category + ")"
                : "")
          : "AQI=n/a";
      const sun =
        s.listing.sunlight_score != null
          ? "sun=" + String(s.listing.sunlight_score)
          : "sun=n/a";
      const rain =
        s.listing.weather_next12h_rain_hours != null
          ? "rain12h=" + String(s.listing.weather_next12h_rain_hours) + "h"
          : "rain12h=n/a";
      return (
        "[" +
        String(i + 1) +
        "] id=" +
        s.listing.id +
        ' | "' +
        (s.listing.title ?? "Untitled") +
        '" | ' +
        (s.listing.district ?? s.listing.city ?? "?") +
        " | " +
        (s.listing.rent_pln != null ? String(s.listing.rent_pln) + " PLN/mo" : "?") +
        " | " +
        String(s.listing.rooms ?? "?") +
        "R " +
        String(s.listing.area_m2 ?? "?") +
        "m² | " +
        aqiLabel +
        " | " +
        sun +
        " | " +
        rain +
        " | " +
        "score=" +
        String(s.overallScore) +
        " (" +
        s.recommendation +
        ")"
      );
    })
    .join("\n");

  const fullResultsJson =
    scoredListings.length > 0
      ? JSON.stringify(scoredListings, null, 2)
      : "[]";

  const systemPrompt = buildSearchAssistantSystemPrompt({
    listingCount: scoredListings.length,
    listingIndex: listingIndex || "No listings in this run.",
    fullResultsJson,
    englishRule: RESPOND_IN_ENGLISH_RULE,
  });

  const result = streamText({
    model: openai("gpt-5.4-mini"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0]),
    tools: {
      searchFlats: {
        description:
          "Filter listings in the current search run using persisted listings_normalized fields (including enrichment). Use for refined shortlists by budget, rooms, district, geocode_required, etc.",
        inputSchema: searchFlatsInputSchema,
        execute: async (input) => execSearchFlats(supabase, flatCtx, input),
      },
      getFlatSearchCardData: {
        description:
          "Compact card: title, price, rooms, area, district, geocode summary, sunlight, AQI, rain hours, closest park/gym/grocery from proximity_matches, plus normalized picture URLs and photo-inspection notes when stored.",
        inputSchema: z.object({ listing_id: z.string().uuid() }),
        execute: async ({ listing_id }) => execGetFlatSearchCardData(supabase, flatCtx, listing_id),
      },
      getGeoData: {
        description: "Geocode trust and coordinates for map UX. listing_id must be from current results.",
        inputSchema: z.object({ listing_id: z.string().uuid() }),
        execute: async ({ listing_id }) => execGetGeoData(supabase, flatCtx, listing_id),
      },
      getSunData: {
        description: "Persisted sunlight score, confidence, orientation hint, reasons.",
        inputSchema: z.object({ listing_id: z.string().uuid() }),
        execute: async ({ listing_id }) => execGetSunData(supabase, flatCtx, listing_id),
      },
      getWeatherData: {
        description: "Short-horizon weather snapshot and rain hours for the listing area.",
        inputSchema: z.object({ listing_id: z.string().uuid() }),
        execute: async ({ listing_id }) => execGetWeatherData(supabase, flatCtx, listing_id),
      },
      getAirQualityData: {
        description:
          "Persisted Google Air Quality API row: AQI value, index code, category, dominant pollutant — interpret value only with index code (uaqi vs local).",
        inputSchema: z.object({ listing_id: z.string().uuid() }),
        execute: async ({ listing_id }) => execGetAirQualityData(supabase, flatCtx, listing_id),
      },
      getPlacesNearby: {
        description: "Park, gym, grocery from proximity_matches only (no live Places API).",
        inputSchema: z.object({ listing_id: z.string().uuid() }),
        execute: async ({ listing_id }) => execGetPlacesNearby(supabase, flatCtx, listing_id),
      },
      getSearchExplainability: {
        description: "Compact signals for why a flat ranks well or poorly (geocode, sun, AQI, rain, proximity walk hints).",
        inputSchema: z.object({ listing_id: z.string().uuid() }),
        execute: async ({ listing_id }) => execGetSearchExplainability(supabase, flatCtx, listing_id),
      },
      getEnrichmentCoverage: {
        description: "Status + timestamps for geocode, weather, air, sunlight, proximity — avoid overclaiming.",
        inputSchema: z.object({ listing_id: z.string().uuid() }),
        execute: async ({ listing_id }) => execGetEnrichmentCoverage(supabase, flatCtx, listing_id),
      },
      getListings: {
        description:
          "Return every scored listing from this search run (same data as in context, including breakdown and reasoning).",
        inputSchema: z.object({}),
        execute: async () => scoredListings,
      },
      getListingDetails: {
        description:
          "Load complete database data for one listing: normalized row (with enrichment), AI score, listings_raw scrape when present. Only listing IDs from the current results.",
        inputSchema: z.object({
          listing_id: z.string().uuid(),
        }),
        execute: async ({ listing_id }) => {
          if (!allowedListingIds.has(listing_id)) {
            return {
              error:
                "That listing is not part of the current search results. Use ids from the INDEX above.",
            };
          }

          const { data, error } = await supabase
            .from("listings_normalized")
            .select(LISTING_WITH_ENRICHMENT_COLUMNS)
            .eq("id", listing_id)
            .single();

          if (error || !data) {
            return { error: error?.message ?? "Listing not found" };
          }

          const row = data as unknown as Record<string, unknown>;

          const normalized = {
            ...row,
            district: firstLine(row.district as string | null),
            address: firstLine(row.address as string | null),
            area_m2:
              row.area_m2 != null
                ? parseFloat(String(row.area_m2)) || null
                : null,
            image_urls: parseFlatPicturesUrlColumn(row.flat_pictures_url),
          };

          const { data: rawScrape } = await supabase
            .from("listings_raw")
            .select("source, external_id, scraped_at, raw_data")
            .eq("normalized_id", listing_id)
            .order("scraped_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            normalized,
            ai_score: scoredListings.find((s) => s.listing.id === listing_id) ?? null,
            source_scrape: rawScrape ?? null,
          };
        },
      },
      addToShortlist: {
        description:
          "Add a listing to the user's shortlist. Confirm the listing title before calling. " +
          "notes is required: markdown for the shortlist page — why saved, ## Questions for the landlord (bullets), ## Things to double-check (bullets); use **bold** for key figures.",
        inputSchema: z.object({
          listing_id: z.string(),
          notes: z
            .string()
            .min(1, "Provide markdown notes: why saved, questions for landlord, things to double-check."),
        }),
        execute: async ({ listing_id, notes }) => {
          const scored = scoredListings.find((s) => s.listing.id === listing_id);
          if (!scored) return { error: "Listing not found in current results" };

          const { data: existing } = await supabase
            .from("shortlist_entries")
            .select("id")
            .eq("project_id", projectId)
            .eq("listing_id", listing_id)
            .maybeSingle();

          if (existing) {
            return { ok: true, alreadyExists: true, listing_id, title: scored.listing.title };
          }

          const { error } = await supabase
            .from("shortlist_entries")
            .insert({
              project_id: projectId,
              listing_id,
              listing_snapshot: scored,
              status: "saved",
              notes,
            });

          if (error) return { error: error.message };
          return { ok: true, listing_id, title: scored.listing.title };
        },
      },
    },
    stopWhen: stepCountIs(18),
    providerOptions: {
      openai: { parallelToolCalls: false },
    },
  });

  return result.toUIMessageStreamResponse();
}
