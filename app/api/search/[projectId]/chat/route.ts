import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { ScoredListing, NormalizedListing } from "@/lib/types/flatguard";

function firstLine(value: string | null): string | null {
  if (!value) return null;
  return value.split("\n")[0].trim() || null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

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

  // Build compact listing context for system prompt
  const listingContext = scoredListings.length > 0
    ? scoredListings
        .map((s, i) =>
          `[${i + 1}] id=${s.listing.id} | "${s.listing.title ?? "Untitled"}" | ` +
          `${s.listing.district ?? s.listing.city} | ` +
          `${s.listing.rent_pln ? s.listing.rent_pln + " PLN/mo" : "?"} | ` +
          `${s.listing.rooms ?? "?"}R ${s.listing.area_m2 ?? "?"}m² | ` +
          `score=${s.overallScore} (${s.recommendation})`
        )
        .join("\n")
    : "No scored listings yet.";

  const systemPrompt = `You are the FlatGuard Search Assistant — an expert apartment advisor helping a user review their search results and build a shortlist.

CURRENT SEARCH RESULTS (${scoredListings.length} listings):
${listingContext}

YOUR CAPABILITIES:
- Answer questions about listings: compare them, explain scores, give relocation advice
- Use getListingDetails to fetch full specs for any listing
- Use getListings to return the full list to the user
- Use addToShortlist to save a listing — always confirm which listing before adding
- Be concise and direct. Max 2-3 sentences + action.
- When user says "add [title/number] to shortlist", call addToShortlist immediately.
- When adding to shortlist, say which listing you're adding and why it's a good pick.`;

  const result = streamText({
    model: openai("gpt-5.4-mini"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0]),
    tools: {
      getListings: {
        description: "Return the full list of scored listings from this search run.",
        inputSchema: z.object({}),
        execute: async () => {
          return scoredListings.map((s) => ({
            id: s.listing.id,
            title: s.listing.title,
            district: s.listing.district,
            rent_pln: s.listing.rent_pln,
            rooms: s.listing.rooms,
            area_m2: s.listing.area_m2,
            overallScore: s.overallScore,
            recommendation: s.recommendation,
            reasoning: s.reasoning,
          }));
        },
      },
      getListingDetails: {
        description: "Fetch full details for a specific listing by its ID.",
        inputSchema: z.object({
          listing_id: z.string(),
        }),
        execute: async ({ listing_id }) => {
          const { data } = await supabase
            .from("listings_normalized")
            .select("*")
            .eq("id", listing_id)
            .single();

          if (!data) return { error: "Listing not found" };

          const l = data as NormalizedListing;
          return {
            id: l.id,
            title: l.title,
            source: l.source,
            url: l.url,
            city: l.city,
            district: firstLine(l.district),
            neighbourhood: l.neighbourhood,
            address: firstLine(l.address),
            rent_pln: l.rent_pln,
            deposit_pln: l.deposit_pln,
            total_monthly_pln: l.total_monthly_pln,
            rooms: l.rooms,
            area_m2: l.area_m2 != null ? parseFloat(String(l.area_m2)) || null : null,
            floor: l.floor,
            total_floors: l.total_floors,
            building_type: l.building_type,
            offer_type: l.offer_type,
            is_furnished: l.is_furnished,
            has_balcony: l.has_balcony,
            has_terrace: l.has_terrace,
            has_elevator: l.has_elevator,
            has_storage_room: l.has_storage_room,
            has_internet: l.has_internet,
            heating_type: l.heating_type,
            parking_type: l.parking_type,
            kitchen_equipment: l.kitchen_equipment,
            extra_features: l.extra_features,
            available_from: l.available_from,
            nearby: l.nearby,
            score: scoredListings.find((s) => s.listing.id === listing_id),
          };
        },
      },
      addToShortlist: {
        description: "Add a listing to the user's shortlist. Confirm the listing title before calling.",
        inputSchema: z.object({
          listing_id: z.string(),
          notes: z.string().optional(),
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
              notes: notes ?? null,
            });

          if (error) return { error: error.message };
          return { ok: true, listing_id, title: scored.listing.title };
        },
      },
    },
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
