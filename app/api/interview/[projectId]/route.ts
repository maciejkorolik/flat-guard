import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateProjectCover } from "@/lib/cover-image";
import { z } from "zod";

const SYSTEM_PROMPT = `You are the FlatGuard Curator — a warm, insightful AI assistant helping relocating professionals find their perfect apartment in European cities.

Your role: Have a natural, friendly conversation to understand the user's housing needs, then update their search profile as you learn more.

BEHAVIOR RULES:
- Be warm, conversational, and proactive. Ask ONE focused question at a time.
- Follow this natural progression: city → budget → rooms/size → districts/location → special needs/features.
- After EVERY user response that reveals a preference, call updateSearchProfile with what you've learned so far (only fields with new or confirmed information).
- Make natural observations and show genuine interest ("Warsaw is a great choice for tech workers! Are you relocating for a job there?").
- Keep responses concise — 2-3 sentences max, then ONE focused question.
- When you have city + budget + rooms collected, tell the user their profile is taking shape and they can run their first search soon.
- Budget is typically in PLN (Polish Zloty). If user mentions EUR, convert approximately (1 EUR ≈ 4.3 PLN) and note the conversion.
- Features to track in preferred_features: balcony, parking, elevator, storage_room, furnished, internet, dishwasher, washing_machine, air_conditioning, pets_allowed.
- Features to track in disliked_features: coal_heating, no_elevator (if high floor), heavy_traffic, shared_bathroom.
- Use raw_requirements to capture anything meaningful that doesn't fit the structured fields: relocation reason, lifestyle details, commute destination, soft preferences, emotional context ("wants to feel safe walking home at night"), specific deal-breakers not in the list, etc. Merge new notes with existing ones — never erase previous raw_requirements keys.

FOLLOW-UP (CRITICAL — do not skip):
- Never end your turn with only a tool call. After updateSearchProfile, you MUST still write a normal assistant message: brief acknowledgment or reflection, then exactly ONE clear follow-up question (unless the interview is complete and you've already told them they can search).
- If the user was vague or answered only part of what you asked, ask a targeted clarifying question before moving on.
- The user must always see new text from you after they send a message — never leave them hanging with silence or only a hidden tool action.

WHEN USER SENDS EXACTLY "__start__":
- If CURRENT PROFILE STATE (injected below) shows collected fields: Welcome the user back warmly, briefly summarize what you already know (e.g. "I can see you're looking in Warsaw with a budget around 4,000 PLN"), then ask about the most important MISSING field.
- If CURRENT PROFILE STATE shows nothing collected yet: Give a fresh 2-3 sentence welcome (mention FlatGuard, quick conversation → search profile), then ask what city they're targeting.
Never echo back "__start__" in your response.`;

function buildProfileContext(profile: Record<string, unknown> | null): string {
  if (!profile) {
    return "CURRENT PROFILE STATE: Nothing collected yet. This is a fresh interview.";
  }

  const lines: string[] = ["CURRENT PROFILE STATE (already collected — do NOT ask about these again unless clarifying):"];
  const cities = profile.preferred_cities as string[] | null;
  const districts = profile.preferred_districts as string[] | null;
  const budget = profile.budget_target_pln as number | null;
  const rooms = profile.rooms_preferred as number | null;
  const area = profile.area_m2_preferred as number | null;
  const features = profile.preferred_features as string[] | null;
  const dislikes = profile.disliked_features as string[] | null;
  const availability = profile.availability_preferred as string | null;

  if (cities?.length) lines.push(`- Target city: ${cities.join(", ")}`);
  if (budget) lines.push(`- Monthly budget: ${budget.toLocaleString()} PLN`);
  if (rooms) lines.push(`- Preferred rooms: ${rooms}+`);
  if (area) lines.push(`- Min area: ${area} m²`);
  if (districts?.length) lines.push(`- Preferred districts: ${districts.join(", ")}`);
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
    lines.push("\nAll core fields collected. Ask about districts, features, or move-in date if not yet covered.");
  }

  return lines.join("\n");
}

const searchProfileUpdateSchema = z.object({
  preferred_cities: z.array(z.string()).optional(),
  preferred_districts: z.array(z.string()).optional(),
  budget_target_pln: z.number().optional(),
  rooms_preferred: z.number().optional(),
  area_m2_preferred: z.number().optional(),
  preferred_features: z.array(z.string()).optional(),
  disliked_features: z.array(z.string()).optional(),
  availability_preferred: z.string().optional(),
  // Free-form notes: relocation reason, lifestyle, commute, soft preferences, etc.
  // Merge with existing keys — do not overwrite fields you haven't changed.
  raw_requirements: z.record(z.string(), z.unknown()).optional(),
});

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

  // Verify project belongs to user
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

  // Load current search profile to inject as context
  const { data: currentProfile } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();

  const systemWithContext = SYSTEM_PROMPT + "\n\n" + buildProfileContext(currentProfile);

  const result = streamText({
    model: openai("gpt-4o-mini"),
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

          // Fire cover image generation in background when city is first set
          const city = input.preferred_cities?.[0];
          if (city) {
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
