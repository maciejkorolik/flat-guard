import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateProjectCover } from "@/lib/cover-image";
import { z } from "zod";
import { RESPOND_IN_ENGLISH_RULE } from "@/lib/ai-language-policy";

const SYSTEM_PROMPT = `You are the FlatGuard Curator — a clear, efficient AI assistant helping people define an apartment search in European cities.

Your role: Collect housing search criteria only. Be polite but task-focused — you are not making small talk or getting to know the user personally.

BEHAVIOR RULES:
- Stay strictly on apartment search: city, budget, layout, commute, areas, features, dates. Ask ONE focused question at a time.
- Do NOT ask generic chit-chat or relocation stories (e.g. never "what brings you to [city]?", "why are you moving?", or similar). If you need context for commute, ask only where they work or study — not why they relocated.
- Follow this progression:
  1. City they want to search in (no follow-up about their life story or reasons for the move)
  2. Budget
  3. Rooms / size
  4. Commute & location — where will they work/study, max commute time, preferred transport
  5. Districts / neighbourhoods — suggest well-known ones if relevant
  6. Lifestyle & vibe — lively central vs quiet residential, green spaces, nightlife, safety
  7. Must-have features / deal-breakers
  8. Move-in date
- After EVERY user response that reveals a preference, call updateSearchProfile with what you've learned (only fields with new or confirmed information).
- You may offer short, factual area tips tied to search (e.g. district trade-offs) — not social banter.
- Keep responses concise — 2-3 sentences max, then ONE focused question.
- When you have city + budget + rooms collected, tell the user their profile is taking shape and they can run their first search soon.
- Budget is typically in PLN (Polish Zloty). If user mentions EUR, convert approximately (1 EUR ≈ 4.3 PLN) and note the conversion.

LOCATION & COMMUTE (important — explore after city is known):
- Ask where they'll be working or studying: save as important_locations array with objects like {name: "office", address: "Wola, Warsaw", max_commute_min: 30, transport: "metro"}.
- Ask if they have a max commute time in mind.
- Ask whether they prefer to be central (walkable, lively, cafés) or quieter residential with better space for the price.
- For Warsaw: mention districts like Mokotów (quiet, green, popular with expats), Żoliborz (charming, local vibe), Śródmieście (central, expensive), Wola (new builds, tech hub), Praga (up-and-coming, affordable). Ask which appeals.
- Save neighbourhood preferences to preferred_neighbourhoods and preferred_districts.
- Save lifestyle / vibe notes (e.g. "wants walking distance to coffee shops", "prioritises safety at night", "wants to be near parks") to raw_requirements.neighborhood_vibe.

FEATURES:
- Track in preferred_features: balcony, parking, elevator, storage_room, furnished, internet, dishwasher, washing_machine, air_conditioning, pets_allowed.
- Track in disliked_features: coal_heating, no_elevator (if high floor), heavy_traffic, shared_bathroom.
- Use raw_requirements for housing-relevant notes that do not fit structured fields (e.g. "needs quiet for remote work"). Do not use it to store personal relocation narratives. Merge — never erase previous keys.

FOLLOW-UP (CRITICAL — do not skip):
- Never end your turn with only a tool call. After updateSearchProfile, you MUST still write a normal assistant message: brief acknowledgment, then exactly ONE clear follow-up question (unless the interview is complete).
- If the user was vague, ask a clarifying question before moving on.
- The user must always see new text from you after they send a message.

WHEN USER SENDS EXACTLY "__start__":
- If CURRENT PROFILE STATE shows collected fields: Briefly summarize saved search criteria, then ask about the most important MISSING field. No small talk.
- If CURRENT PROFILE STATE shows nothing: One short line that you will build their search profile through a few questions, then immediately ask which city they want to search in — no "hello, what brings you here" or similar.
Never echo back "__start__" in your response.
Never expose raw UUIDs or internal IDs in any reply — always refer to things by name.`;

function buildProfileContext(profile: Record<string, unknown> | null): string {
  if (!profile) {
    return "CURRENT PROFILE STATE: Nothing collected yet. This is a fresh interview.";
  }

  const lines: string[] = ["CURRENT PROFILE STATE (already collected — do NOT ask about these again unless clarifying):"];
  const cities = profile.preferred_cities as string[] | null;
  const districts = profile.preferred_districts as string[] | null;
  const neighbourhoods = profile.preferred_neighbourhoods as string[] | null;
  const budget = profile.budget_target_pln as number | null;
  const rooms = profile.rooms_preferred as number | null;
  const area = profile.area_m2_preferred as number | null;
  const features = profile.preferred_features as string[] | null;
  const dislikes = profile.disliked_features as string[] | null;
  const availability = profile.availability_preferred as string | null;
  const importantLocations = profile.important_locations as Record<string, unknown>[] | null;

  if (cities?.length) lines.push(`- Target city: ${cities.join(", ")}`);
  if (budget) lines.push(`- Monthly budget: ${budget.toLocaleString()} PLN`);
  if (rooms) lines.push(`- Preferred rooms: ${rooms}+`);
  if (area) lines.push(`- Min area: ${area} m²`);
  if (districts?.length) lines.push(`- Preferred districts: ${districts.join(", ")}`);
  if (neighbourhoods?.length) lines.push(`- Preferred neighbourhoods: ${neighbourhoods.join(", ")}`);
  if (importantLocations?.length) lines.push(`- Important locations: ${JSON.stringify(importantLocations)}`);
  if (features?.length) lines.push(`- Preferred features: ${features.join(", ")}`);
  if (dislikes?.length) lines.push(`- Disliked features: ${dislikes.join(", ")}`);
  if (availability) lines.push(`- Move-in: ${availability}`);

  const raw = profile.raw_requirements as Record<string, unknown> | null;
  if (raw && Object.keys(raw).length > 0) {
    lines.push(`- Additional notes: ${JSON.stringify(raw)}`);
  }

  const missing: string[] = [];
  if (!cities?.length) missing.push("city");
  if (!budget) missing.push("budget");
  if (!rooms) missing.push("rooms");

  if (lines.length === 1) {
    return "CURRENT PROFILE STATE: Nothing collected yet. This is a fresh interview.";
  }

  if (missing.length) {
    lines.push(`\nSTILL MISSING: ${missing.join(", ")} — ask about these next.`);
  } else {
    const secondaryMissing: string[] = [];
    if (!importantLocations?.length) secondaryMissing.push("commute/workplace");
    if (!districts?.length && !neighbourhoods?.length) secondaryMissing.push("district preference");
    if (secondaryMissing.length) {
      lines.push(`\nCore fields collected. Still worth asking about: ${secondaryMissing.join(", ")}.`);
    } else {
      lines.push("\nAll key fields collected. Ask about features, deal-breakers, or move-in date if not covered.");
    }
  }

  return lines.join("\n");
}

const searchProfileUpdateSchema = z.object({
  preferred_cities: z.array(z.string()).optional(),
  preferred_districts: z.array(z.string()).optional(),
  preferred_neighbourhoods: z.array(z.string()).optional(),
  important_locations: z
    .array(
      z.object({
        name: z.string(),
        address: z.string().optional(),
        max_commute_min: z.number().optional(),
        transport: z.string().optional(),
      })
    )
    .optional(),
  budget_target_pln: z.number().optional(),
  rooms_preferred: z.number().optional(),
  area_m2_preferred: z.number().optional(),
  preferred_features: z.array(z.string()).optional(),
  disliked_features: z.array(z.string()).optional(),
  availability_preferred: z.string().optional(),
  raw_requirements: z.record(z.string(), z.unknown()).optional(),
});

// Generic project names that should be replaced once we know the city
const GENERIC_NAMES = new Set(["apartment hunt", "new project", "my search", "search"]);

function buildProjectName(city: string): string {
  return `${city} — Apartment Search`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { messages } = await req.json();
  const { projectId } = await params;

  // Verify project belongs to user (also fetch name for rename logic)
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return new Response("Not found", { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return new Response("OpenAI API key not configured", { status: 503 });
  }

  // Load current search profile to inject as context
  const { data: currentProfile } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();

  const systemWithContext =
    SYSTEM_PROMPT + "\n\n" + RESPOND_IN_ENGLISH_RULE + "\n\n" + buildProfileContext(currentProfile);

  const result = streamText({
    model: openai("gpt-5.4-mini"),
    system: systemWithContext,
    messages: await convertToModelMessages(messages),
    tools: {
      updateSearchProfile: {
        description:
          "Update the apartment search profile with newly extracted preferences. Call when the user's message reveals any preference. You must still write a user-visible reply with your next question after the tool runs.",
        inputSchema: searchProfileUpdateSchema,
        execute: async (input) => {
          const { data: existing } = await supabase
            .from("search_profiles")
            .select("*")
            .eq("project_id", projectId)
            .eq("is_current", true)
            .maybeSingle();

          const cleanInput = Object.fromEntries(
            Object.entries(input).filter(([, v]) => v !== undefined)
          );

          let saved;
          if (existing) {
            const { data } = await supabase
              .from("search_profiles")
              .update(cleanInput)
              .eq("id", existing.id)
              .select()
              .single();
            saved = data;
          } else {
            const { data } = await supabase
              .from("search_profiles")
              .insert({ project_id: projectId, ...cleanInput })
              .select()
              .single();
            saved = data;
          }

          const city = input.preferred_cities?.[0];
          if (city) {
            // Rename project if it still has a generic placeholder name
            const currentName = (project as { name: string }).name ?? "";
            if (GENERIC_NAMES.has(currentName.toLowerCase().trim())) {
              after(
                Promise.resolve(
                  supabase
                    .from("projects")
                    .update({ name: buildProjectName(city) })
                    .eq("id", projectId)
                )
              );
            }
            // Generate cover image in background
            after(generateProjectCover(projectId, city));
          }

          return saved;
        },
      },
    },
    stopWhen: stepCountIs(12),
    providerOptions: {
      openai: { parallelToolCalls: false },
    },
  });

  return result.toUIMessageStreamResponse();
}
