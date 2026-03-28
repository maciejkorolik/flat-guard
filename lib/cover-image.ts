import { generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";

/**
 * Generates a small DALL-E 2 cover image for a city and stores it as a
 * base64 data URL in projects.cover_image. Safe to fire-and-forget via after().
 */
export async function generateProjectCover(
  projectId: string,
  city: string
): Promise<void> {
  const supabase = await createClient();

  // Skip if the project already has a cover
  const { data: project } = await supabase
    .from("projects")
    .select("cover_image")
    .eq("id", projectId)
    .single();

  if (project?.cover_image) return;

  const { images } = await generateImage({
    model: openai.image("dall-e-2"),
    prompt: `Aerial cityscape of ${city}, European architecture, golden hour warm light, clean minimal travel photography style`,
    size: "256x256",
    n: 1,
  });

  const base64 = images[0]?.base64;
  if (!base64) return;

  await supabase
    .from("projects")
    .update({ cover_image: `data:image/png;base64,${base64}` })
    .eq("id", projectId);
}
