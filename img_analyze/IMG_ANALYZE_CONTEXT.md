# Image Analyze — Workflow Context

## Purpose

This document describes the `Image Analyze.json` n8n workflow so it can be rewritten as a native TypeScript script within the FlatGuard codebase.

The pipeline enriches apartment listings by extracting photo URLs from raw scraped HTML and running visual AI inspection on each photo. Results are written back to the normalized listings table in Supabase.

---

## Pipeline Overview

```
listings_raw (Supabase)
  └─ loop over each row
       └─ extract photo URLs from raw_data  [OpenAI GPT]
            └─ analyze photos               [Gemini Vision]
                 └─ update listings_normalized (Supabase)
```

---

## Step-by-Step Logic

### Step 1 — Fetch all raw listings

- Table: `listings_raw`
- Returns all rows, no filter
- Each row contains at minimum:
  - `external_id` — dedupe key, used to match the target row in `listings_normalized`
  - `raw_data` — raw scraped HTML/text of the listing page

### Step 2 — Loop over items (sequential, batch size 1)

Process one listing at a time to avoid rate limits on downstream AI APIs.

### Step 3 — Extract photo URLs

**Model:** OpenAI (configured as `gpt-5.4` in n8n — use `gpt-4o` or latest available)

**Input:** `raw_data` field of the current row

**Task:** Extract a comma-separated list of apartment photo URLs from the raw HTML/text.

**Rules for extraction:**
- Include only photos of the apartment itself (rooms, kitchen, bathroom, etc.)
- Exclude UI assets: icons, arrows, pins, logos, thumbnails, navigation graphics
- Prefer full-size URLs over thumbnail variants
- Return at least 5 links if available

**Output format (strict):**
```
www.link1.pl, www.link2.pl, www.link3.pl, ...
```
Links must be comma-separated, no newlines between them.

**If extraction fails or returns fewer than 1 URL:** skip this listing, log the error, continue to next.

### Step 4 — Analyze photos with Gemini Vision

**Model:** `gemini-2.0-flash` (or latest available flash-tier model)

**Input:** comma-separated image URL string from Step 3

**Retry policy:** 5 attempts, 5 seconds between retries

**On error:** `continueRegularOutput` — log the error, write null/empty to DB, continue loop

**System prompt (Polish, verbatim):**

```
You are a professional apartment inspector analyzing rental listing photos.
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
Jeśli coś jest nieczytelne, napisz "nieczytelne" lub "niewidoczne".
```

### Step 5 — Write results to Supabase

- Table: `listings_normalized`
- Match row by: `external_id` (must equal `external_id` from the source `listings_raw` row)
- Fields to update:
  - `flat_description_pictures` ← full text response from Gemini Vision
  - `flat_pictures_url` ← comma-separated URL string from Step 3

---

## Data Contracts

### Input row (`listings_raw`)

| Field | Type | Notes |
|-------|------|-------|
| `external_id` | string | Dedupe key |
| `raw_data` | string | Raw HTML/text of the listing page |

### Output fields written to `listings_normalized`

| Field | Type | Notes |
|-------|------|-------|
| `flat_description_pictures` | text | Gemini Vision analysis in Polish |
| `flat_pictures_url` | text | Comma-separated photo URLs |

---

## Error Handling

| Failure point | Behavior |
|---------------|----------|
| URL extraction returns 0 URLs | Skip listing, log warning, continue |
| Gemini call fails after 5 retries | Write null to both fields, log error, continue |
| Supabase update fails | Log error with `external_id`, continue |

No failure should stop the entire run. Every row must be attempted.

---

## Environment Variables Required

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

---

## Implementation Notes for Claude Code

- Process listings **sequentially**, not in parallel — both OpenAI and Gemini have rate limits
- Add a `--dry-run` flag: run full logic but skip Supabase writes, log what would be written
- Add a `--limit N` flag: process only the first N rows (useful for smoke testing)
- Print a summary at the end: `X processed / Y skipped / Z failed`
- Dependencies: `@supabase/supabase-js`, `openai`, `@google/generative-ai`