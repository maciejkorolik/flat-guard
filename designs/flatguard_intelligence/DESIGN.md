# Design System Specification: The Architectural Intelligence

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Curator."** 

Unlike traditional real estate platforms that overwhelm users with "noisy" grids and frantic CTAs, this system adopts an editorial, agentic approach. It is designed to feel like a high-end concierge service—calm, authoritative, and intelligent. We break the "template" look by utilizing intentional white space, asymmetric secondary elements, and a sophisticated layering of surfaces that mimic physical architectural materials rather than flat digital boxes.

**Signature Characteristics:**
*   **Agentic Presence:** AI is not a chatbot; it is a subtle "glow" or a refined badge that guides the eye.
*   **Editorial Spacing:** Use the Spacing Scale to create breathing room that suggests luxury and curated precision.
*   **Structural Depth:** We replace heavy borders with tonal shifts, creating a UI that feels "carved" or "stacked."

---

## 2. Colors & Surface Philosophy
The palette is rooted in a "Deep Indigo" foundation to establish immediate trust, accented by "Emerald" for success metrics and "Amber" for critical alerts.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Definition between content blocks must be achieved through background color shifts or the **Surface Hierarchy.**
*   *Example:* A list of properties (`surface-container-lowest`) should sit on a `surface-container-low` background. The shift in hex value provides all the separation needed.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use these tokens to define depth:
*   **Background (`#f8f9ff`):** The canvas.
*   **Surface-Container-Low (`#eff4ff`):** For large secondary sections or sidebars.
*   **Surface-Container-Lowest (`#ffffff`):** For primary interactive cards and content focus areas.
*   **Surface-Container-Highest (`#d5e3fc`):** For subtle "pressed" states or inset areas.

### The "Glass & Gradient" Rule
To escape the "flat" look, use **Glassmorphism** for floating elements (e.g., a "Compare" bar or a "Filter" chip menu). 
*   **Values:** Use `surface_container_lowest` at 70% opacity with a `24px` backdrop-blur. 
*   **Signature Texture:** Apply a subtle linear gradient to Primary CTAs—from `primary` (`#000666`) to `primary_container` (`#1a237e`)—to give buttons a tactile, high-end "weighted" feel.

---

## 3. Typography: The Editorial Voice
We utilize a dual-font strategy to balance character with functionality.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "tech-architectural" feel. Use `display-lg` and `headline-md` for high-impact value propositions and property titles.
*   **Body & Labels (Inter):** The workhorse. Inter provides maximum legibility for dense rental data. Use `body-md` for descriptions and `label-sm` for technical specs.

**Hierarchy Strategy:** 
High-contrast typography is the primary driver of hierarchy. If a heading is important, make it `headline-lg` in `on_surface` (`#0d1c2e`) rather than adding a box around it. Use `on_surface_variant` (`#454652`) for secondary metadata to create a clear "read-order" without visual clutter.

---

## 4. Elevation & Depth
Depth is a tool for focus, not just decoration.

*   **The Layering Principle:** Stack `surface-container-lowest` cards on top of `surface-container-low` layouts. This "natural lift" is the hallmark of this system.
*   **Ambient Shadows:** For floating elements only (Modals, Dropdowns). 
    *   *Shadow Specs:* `0px 12px 32px rgba(13, 28, 46, 0.06)`. Use a tinted shadow (`on_surface` at 6%) to ensure the shadow feels like a part of the environment, not a grey smudge.
*   **The "Ghost Border" Fallback:** If accessibility requires a border (e.g., Input fields), use `outline_variant` (`#c6c5d4`) at **20% opacity**. Never use a 100% opaque border.
*   **AI Glow:** For AI-assisted insights, apply a soft inner-glow using `secondary` (`#006b5f`) at low opacity to signify the "intelligence" layer.

---

## 5. Components & Logic

### Buttons & Chips
*   **Primary Button:** Gradient-filled (`primary` to `primary_container`), `8px` (DEFAULT) corner radius. Use `primary_fixed` for hover states.
*   **Filter Chips:** Use `surface_container_high` with no border. On selection, transition to `primary` with `on_primary` text.
*   **The Agentic Badge:** A custom component for "AI Match Scores." Use `secondary_container` background with `on_secondary_container` text and a subtle 1px "Ghost Border" of `secondary`.

### Input Fields
*   **Style:** `surface_container_lowest` background. No border. On focus, a 2px `surface_tint` bottom-bar appears. This keeps the form looking clean and "un-boxed."

### Cards & Lists
*   **The Card Rule:** Forbid divider lines within cards. Use `spacing.4` (1rem) and `spacing.6` (1.5rem) to separate the property image from the details.
*   **The "Agentic Insight" Card:** Use a subtle gradient background from `surface` to `secondary_fixed` (at 10% opacity) to denote a property that the AI has specifically flagged for the user.

### Custom Iconography
Icons must be "Fine-Line" (1.5pt stroke). 
*   **Rooms:** Stylized architectural floorplan icon.
*   **Area:** Ruler/Grid hybrid.
*   **Pets:** Minimalist paw-print with an architectural sharp edge.
*   **Furnished:** Iconic "Eames" chair silhouette to signify quality.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts. For example, a property photo can bleed off the left edge while the text is inset on the right.
*   **Do** use `secondary` (Emerald) exclusively for "Success," "Verified," and "High Match" indicators to build a mental model of "Safe/Good."
*   **Do** prioritize vertical whitespace over horizontal lines to separate content groups.

### Don't
*   **Don't** use traditional "Real Estate Blue" or "Neon AI Purple." Stick to the Deep Indigo and Emerald palette.
*   **Don't** use standard shadows. If a card looks like it has a "heavy" shadow, it is wrong. It should look like it is simply "sitting" slightly higher on a table.
*   **Don't** use fully opaque dividers. If you must use a line, use `outline_variant` at 15% opacity and stop it 16px before the container edge.