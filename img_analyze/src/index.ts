import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── CLI flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

// ── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ── Prompts ─────────────────────────────────────────────────────────────────

const EXTRACT_PHOTOS_PROMPT = `Extract apartment photo URLs from the raw listing data below.

Rules:
- Include only photos of the apartment itself (rooms, kitchen, bathroom, etc.)
- Exclude UI assets: icons, arrows, pins, logos, thumbnails, navigation graphics
- Prefer full-size URLs over thumbnail variants
- Return at least 5 links if available

Output format (strict): comma-separated URLs on a single line, no newlines between them.
Example: https://img1.example.com/photo1.jpg, https://img2.example.com/photo2.jpg

Raw listing data:
`;

const VISION_SYSTEM_PROMPT = `You are a professional apartment inspector analyzing rental listing photos.
Examine this image carefully and extract every observable detail about the apartment.

Report on ALL of the following that are visible — skip only what is truly not visible:

KITCHEN:
- Stove type (gas burners visible = gas, smooth glass top = induction/electric)
- Oven present? Built-in or freestanding?
- Dishwasher present?
- Fridge size and type
- Counter material and condition
- Cabinet condition (scratches, damage, wear)
- Sink condition

BATHROOM:
- Shower cabin vs bathtub vs both
- Toilet type (floor-mounted, wall-hung)
- Washing machine present?
- Ventilation (window vs vent grille)
- Tiles condition (cracks, grout quality)
- Any signs of mold, moisture, or water damage

WALLS & CEILING:
- Paint condition (peeling, stains, cracks)
- Any visible mold, dark spots, or moisture marks
- Wallpaper present? Condition?
- Ceiling height (estimate: low/normal/high)

FLOORS:
- Floor type (hardwood, laminate, tiles, carpet)
- Condition (scratches, gaps, damage)

WINDOWS:
- Frame type (PVC/wooden/aluminum)
- Single or double glazing (visible frame thickness)
- Roller blinds or curtains present?

HEATING:
- Radiator type visible? (cast iron = old central, panel = newer, electric heater)
- Underfloor heating visible (no radiators at all)?
- Air conditioning unit present?

FURNITURE & EQUIPMENT (if furnished):
- List all visible furniture
- Approximate age/condition (new, decent, worn, IKEA-style, vintage)
- TV present? Size estimate?

LIGHTING:
- Natural light level (bright/medium/dark)
- Window direction clues (shadow angle)
- Artificial lighting type (ceiling lamp, spots, LED strips)

SPACE & LAYOUT:
- Room type shown (kitchen, bathroom, bedroom, living room, hallway)
- Estimated room size (small/medium/large)
- Storage space visible (wardrobes, shelves)
- Open plan or separate rooms?

CONDITION SUMMARY:
- Overall condition: excellent / good / fair / poor
- Top 3 positive observations
- Top 3 red flags or concerns

Odpowiedz po polsku. Bądź konkretny i rzeczowy — opisuj tylko to, co faktycznie widzisz.
Jeśli coś jest nieczytelne, napisz "nieczytelne" lub "niewidoczne".`;

// ── Step 3: Extract photo URLs via OpenAI ───────────────────────────────────

async function extractPhotoUrls(rawData: string): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: EXTRACT_PHOTOS_PROMPT + rawData },
      ],
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const urls = text
      .split(",")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));

    if (urls.length === 0) return null;
    return urls.join(", ");
  } catch (err) {
    console.error(`  [OpenAI] Extraction failed:`, err);
    return null;
  }
}

// ── Step 4: Analyze photos via Gemini Vision ────────────────────────────────

const GEMINI_MAX_RETRIES = 5;
const GEMINI_RETRY_DELAY_MS = 5000;

async function analyzePhotos(photoUrlsCsv: string): Promise<string | null> {
  const urls = photoUrlsCsv.split(",").map((u) => u.trim()).filter(Boolean);

  const imageParts = urls.map((url) => ({
    inlineData: undefined as undefined,
    fileData: undefined as undefined,
    text: undefined as string | undefined,
  }));

  // Build content parts: system prompt + image URLs as image_url parts
  const parts: Array<{ text: string } | { fileData: { mimeType: string; fileUri: string } }> = [
    { text: VISION_SYSTEM_PROMPT + "\n\nAnalyze the following apartment photos:" },
    ...urls.map((url) => ({
      fileData: { mimeType: "image/jpeg", fileUri: url },
    })),
  ];

  // Clear unused variable
  void imageParts;

  for (let attempt = 0; attempt < GEMINI_MAX_RETRIES; attempt++) {
    try {
      const result = await geminiModel.generateContent(parts);
      const text = result.response.text();
      return text || null;
    } catch (err) {
      const isLast = attempt === GEMINI_MAX_RETRIES - 1;
      if (isLast) {
        console.error(`  [Gemini] All ${GEMINI_MAX_RETRIES} attempts failed:`, err);
        return null;
      }
      console.warn(`  [Gemini] Attempt ${attempt + 1} failed, retrying in ${GEMINI_RETRY_DELAY_MS}ms…`);
      await new Promise((r) => setTimeout(r, GEMINI_RETRY_DELAY_MS));
    }
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────

interface ListingRawRow {
  external_id: string;
  raw_data: string;
}

async function main(): Promise<void> {
  console.log(`Image Analyze pipeline${DRY_RUN ? " (DRY RUN)" : ""}${LIMIT ? ` — limit: ${LIMIT}` : ""}`);

  // Step 1: Fetch all raw listings
  let query = supabase.from("listings_raw").select("external_id, raw_data");
  if (LIMIT) query = query.limit(LIMIT);

  const { data: rows, error } = await query;
  if (error) {
    console.error("Failed to fetch listings_raw:", error.message);
    process.exit(1);
  }

  const listings = rows as ListingRawRow[];
  console.log(`Fetched ${listings.length} rows from listings_raw\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // Step 2: Sequential processing
  for (const row of listings) {
    const { external_id, raw_data } = row;
    console.log(`[${processed + skipped + failed + 1}/${listings.length}] external_id=${external_id}`);

    // Step 3: Extract photo URLs
    const photoUrls = await extractPhotoUrls(raw_data);
    if (!photoUrls) {
      console.warn(`  Skipped — no photo URLs extracted`);
      skipped++;
      continue;
    }

    const urlCount = photoUrls.split(",").length;
    console.log(`  Extracted ${urlCount} photo URLs`);

    // Step 4: Analyze with Gemini Vision
    const analysis = await analyzePhotos(photoUrls);
    if (!analysis) {
      console.error(`  Gemini analysis failed — writing nulls`);
      failed++;

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from("listings_normalized")
          .update({ flat_description_pictures: null, flat_pictures_url: null })
          .eq("external_id", external_id);
        if (updateErr) {
          console.error(`  Supabase update failed for ${external_id}:`, updateErr.message);
        }
      }
      continue;
    }

    console.log(`  Gemini analysis: ${analysis.slice(0, 80)}…`);

    // Step 5: Write to Supabase
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would update listings_normalized for external_id=${external_id}`);
      console.log(`    flat_pictures_url: ${photoUrls.slice(0, 100)}…`);
      console.log(`    flat_description_pictures: ${analysis.slice(0, 100)}…`);
    } else {
      const { error: updateErr } = await supabase
        .from("listings_normalized")
        .update({
          flat_description_pictures: analysis,
          flat_pictures_url: photoUrls,
        })
        .eq("external_id", external_id);

      if (updateErr) {
        console.error(`  Supabase update failed for ${external_id}:`, updateErr.message);
        failed++;
        continue;
      }
      console.log(`  Updated listings_normalized`);
    }

    processed++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`${processed} processed / ${skipped} skipped / ${failed} failed`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
