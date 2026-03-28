import { generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";

/**
 * Project cover via OpenAI GPT Image 1.5 (recommended over DALL·E 2/3 for quality).
 * Stored as a base64 data URL in projects.cover_image. Safe to fire-and-forget via after().
 *
 * @see https://platform.openai.com/docs/guides/image-generation
 */
export async function generateProjectCover(
  projectId: string,
  city: string
): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return;

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("cover_image")
    .eq("id", projectId)
    .single();

  if (project?.cover_image) return;

  const { images } = await generateImage({
    model: openai.image("gpt-image-1.5"),
    prompt: `Aerial cityscape of ${city}, European architecture, golden hour warm light, clean minimal travel photography style`,
    size: "1024x1024",
    n: 1,
    providerOptions: {
      openai: {
        quality: "medium",
      },
    },
  });

  const base64 = images[0]?.base64;
  if (!base64) return;

  await supabase
    .from("projects")
    .update({ cover_image: `data:image/png;base64,${base64}` })
    .eq("id", projectId);
}
