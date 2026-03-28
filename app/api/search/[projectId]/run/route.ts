import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { NormalizedListing, ScoredListing } from "@/lib/types/flatguard";

const CITY_NAME_MAP: Record<string, string> = {
  warsaw: "Warszawa",
  krakow: "Kraków",
  cracow: "Kraków",
  wroclaw: "Wrocław",
  gdansk: "Gdańsk",
  poznan: "Poznań",
  lodz: "Łódź",
};

function normalizeCity(input: string): string {
  return CITY_NAME_MAP[input.toLowerCase()] ?? input;
}

function firstLine(value: string | null): string | null {
  if (!value) return null;
  return value.split("\n")[0].trim() || null;
}

const scoringSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  breakdown: z.array(
    z.object({
      criterion: z.string(),
      score: z.number().int().min(0).max(10),
      note: z.string(),
    })
  ),
  reasoning: z.string(),
  recommendation: z.enum(["strong", "good", "weak"]),
});

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { projectId } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) return new Response("Not found", { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return new Response("OpenAI API key not configured", { status: 503 });
  }

  const { data: profile } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();

  const rawCity = (profile?.preferred_cities as string[] | null)?.[0];
  const budget = profile?.budget_target_pln as number | null;
  const dbCity = rawCity ? normalizeCity(rawCity) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("listings_normalized")
    .select("*")
    .eq("is_active", true)
    .lt("rent_pln", 20000)
    .limit(20);

  if (dbCity) query = query.ilike("city", `%${dbCity}%`);
  if (budget) query = query.lte("total_monthly_pln", Math.round(budget * 1.3));

  const { data: rawListings } = await query;

  if (!rawListings || rawListings.length === 0) {
    return new Response("No listings found", { status: 404 });
  }

  const listings: NormalizedListing[] = (rawListings as NormalizedListing[]).map((l) => ({
    ...l,
    district: firstLine(l.district),
    address: firstLine(l.address),
    area_m2: l.area_m2 != null ? parseFloat(String(l.area_m2)) || null : null,
  }));

  // Build profile summary
  const preferredCities = profile?.preferred_cities as string[] | null;
  const preferredDistricts = profile?.preferred_districts as string[] | null;
  const preferredFeatures = profile?.preferred_features as string[] | null;
  const dislikedFeatures = profile?.disliked_features as string[] | null;
  const rooms = profile?.rooms_preferred as number | null;
  const area = profile?.area_m2_preferred as number | null;

  const profileSummary = [
    preferredCities?.length ? `City: ${preferredCities.join(", ")}` : null,
    budget ? `Budget: ${budget.toLocaleString()} PLN/mo max` : null,
    rooms ? `Rooms: ${rooms}+` : null,
    area ? `Min area: ${area} m²` : null,
    preferredDistricts?.length ? `Districts: ${preferredDistricts.join(", ")}` : null,
    preferredFeatures?.length ? `Must-haves: ${preferredFeatures.join(", ")}` : null,
    dislikedFeatures?.length ? `Deal-breakers: ${dislikedFeatures.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n") || "No profile — use general quality criteria.";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const listing of listings) {
        const listingDesc = [
          listing.title ? `Title: ${listing.title}` : null,
          listing.district ? `District: ${listing.district}` : null,
          listing.address ? `Address: ${listing.address}` : null,
          listing.rent_pln ? `Rent: ${listing.rent_pln} PLN/mo` : null,
          listing.total_monthly_pln ? `Total monthly: ${listing.total_monthly_pln} PLN` : null,
          listing.rooms != null ? `Rooms: ${listing.rooms}` : null,
          listing.area_m2 != null ? `Area: ${listing.area_m2} m²` : null,
          listing.floor != null ? `Floor: ${listing.floor}` : null,
          `Furnished: ${listing.is_furnished ? "yes" : listing.is_furnished === false ? "no" : "unknown"}`,
          `Balcony: ${listing.has_balcony ? "yes" : listing.has_balcony === false ? "no" : "unknown"}`,
          `Elevator: ${listing.has_elevator ? "yes" : listing.has_elevator === false ? "no" : "unknown"}`,
          listing.heating_type ? `Heating: ${listing.heating_type}` : null,
          listing.parking_type ? `Parking: ${listing.parking_type}` : null,
          listing.extra_features?.length ? `Extras: ${listing.extra_features.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        try {
          const { object } = await generateObject({
            model: openai("gpt-5.4-mini"),
            schema: scoringSchema,
            system: `You score apartment listings for relocating professionals. Be concise and accurate.
Score 0–100. Provide 3–5 breakdown criteria (Budget Fit, Size, Location, Features, etc.), each 0–10.
Recommendation: "strong" ≥80, "good" 60–79, "weak" <60.

USER PROFILE:
${profileSummary}`,
            prompt: `Score this listing:\n\n${listingDesc}`,
          });

          const scored: ScoredListing = {
            listing: {
              id: listing.id,
              title: listing.title,
              city: listing.city,
              district: listing.district,
              address: listing.address,
              url: listing.url,
              rent_pln: listing.rent_pln,
              total_monthly_pln: listing.total_monthly_pln,
              rooms: listing.rooms,
              area_m2: listing.area_m2,
              floor: listing.floor,
              lat: listing.lat,
              lng: listing.lng,
              has_balcony: listing.has_balcony,
              has_elevator: listing.has_elevator,
              is_furnished: listing.is_furnished,
              parking_type: listing.parking_type,
              heating_type: listing.heating_type,
              offer_type: listing.offer_type,
              extra_features: listing.extra_features,
              available_from: listing.available_from,
            },
            overallScore: object.overallScore,
            breakdown: object.breakdown,
            reasoning: object.reasoning,
            recommendation: object.recommendation,
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(scored)}\n\n`)
          );
        } catch {
          // Skip failed listings silently
        }
      }

      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
