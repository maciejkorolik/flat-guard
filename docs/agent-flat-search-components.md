# Agent Flat Search Components

This file maps each search/enrichment feature to a presentation component strategy.

The repo currently has these UI primitives checked in already:

- `Button`
- `Card`
- `Input`
- `Label`

For flat-search UX, the agent should keep using `Card` as the base shell and add a small set of shadcn components as needed.

## Component Policy

Use these labels in planning:

- `available now`: already in the repo
- `recommended add`: strong fit, but not installed yet

## Feature To Component Map

### Search Result Summary

Feature:

- title, rent, area, rooms, district, top-line enrichment

Best component:

- `Card`

Status:

- `available now`

Presentation pattern:

- `CardHeader` for title + district
- `CardContent` for price, area, rooms
- compact enrichment badges under the core facts

Why:

- this repo already uses `Card`
- it is the right outer container for every listing row or grid tile

### Enrichment Status Chips

Feature:

- geocode status
- AQ status
- sunlight confidence
- weather availability

Best component:

- `Badge`

Status:

- `recommended add`

Presentation pattern:

- one badge per signal
- use neutral/secondary/destructive variants to show state

Why:

- status needs a small scan-friendly token, not full text

### Sunlight Quality

Feature:

- `sunlight_score`
- `sunlight_confidence`
- `sunlight_estimated_orientation_hint`
- `sunlight_reasons`

Best components:

- primary: `Card`
- secondary detail: `Accordion`

Status:

- `Card` is `available now`
- `Accordion` is `recommended add`

Presentation pattern:

- show score and orientation in the card body
- reveal reasons in an accordion row such as `Why this sunlight score`

Why:

- sunlight has both a top-line score and supporting explanation

### Air Quality

Feature:

- `air_quality_aqi_value`
- `air_quality_aqi_category`
- `air_quality_dominant_pollutant`

Best components:

- primary: `Badge`
- comparison view: `Table`

Status:

- both are `recommended add`

Presentation pattern:

- badge on the listing card for the AQ category
- table in compare mode for AQI across multiple flats

Why:

- AQI is glanceable on cards but comparative in shortlist views

### Weather Risk

Feature:

- `weather_condition_text`
- `weather_temperature_c`
- `weather_next12h_rain_hours`
- `weather_next12h_max_precip_probability_percent`

Best components:

- primary: `Alert`
- compact view: `Badge`

Status:

- both are `recommended add`

Presentation pattern:

- if rain risk is elevated, show an inline `Alert`
- otherwise show a simple badge like `2 rainy hours`

Why:

- weather only needs strong emphasis when it is risky

### Nearby Amenities

Feature:

- closest `park`
- closest `gym`
- closest `grocery`
- walk time and distance

Best components:

- primary: `Tabs`
- compact alternative: `Accordion`

Status:

- both are `recommended add`

Presentation pattern:

- one tab per category: `Park`, `Gym`, `Grocery`
- inside each tab show place name, minutes, distance, and route condition

Why:

- proximity is structured and category-based, so tabs map cleanly to the current static model

### Map / Exact Position

Feature:

- `geocode_lat`
- `geocode_lng`
- `geocode_formatted_address`
- geocode trust metadata

Best components:

- primary shell: `Card`
- helper detail: `Tooltip`
- deep detail: `Sheet`

Status:

- `Card` is `available now`
- `Tooltip` and `Sheet` are `recommended add`

Presentation pattern:

- show a map preview or location summary inside a card
- use tooltip for `partial match` or weak location type warnings
- use a sheet for full location diagnostics

Why:

- coordinate quality needs a compact warning path plus an optional deep-inspection path

### Comparison View

Feature:

- comparing 2-10 shortlisted flats across enrichment signals

Best component:

- `Table`

Status:

- `recommended add`

Presentation pattern:

- columns:
  - price
  - rooms
  - area
  - sunlight
  - AQI
  - rain
  - park walk
  - gym walk
  - grocery walk

Why:

- comparison is naturally tabular

### Listing Detail Drilldown

Feature:

- full explanation of enrichment signals and caveats

Best components:

- primary: `Sheet`
- secondary sections: `Separator`

Status:

- both are `recommended add`

Presentation pattern:

- keep search results dense
- open a right-side sheet for the full explanation

Why:

- the detail view should not expand every search result card inline

### Empty / Missing Enrichment

Feature:

- missing geocode
- failed weather
- failed nearby search

Best components:

- `Alert`
- `Empty`

Status:

- both are `recommended add`

Presentation pattern:

- use `Alert` for one failed signal on an otherwise usable card
- use `Empty` when a whole search state lacks enrichment support

Why:

- this prevents the agent from silently omitting unavailable signals

## Recommended Minimal Add Set

If the team wants one clean search UI pass without overbuilding, add these first:

- `Badge`
- `Tooltip`
- `Accordion`
- `Tabs`
- `Table`
- `Alert`
- `Sheet`

That set is enough to present all persisted enrichment signals well.

## Suggested Feature Wiring

### Result Card

Use:

- `Card`
- `Badge`
- `Tooltip`

Show:

- title
- price
- district
- sunlight badge
- AQ badge
- rain badge
- one-line proximity summary

### Compare Screen

Use:

- `Table`
- `Badge`

Show:

- one row per listing
- one comparable metric per column

### Detail Panel

Use:

- `Sheet`
- `Accordion`
- `Separator`

Show:

- geocode trust
- sunlight reasons
- AQ breakdown
- rain summary
- park/gym/grocery winners

## Agent UI Rules

- use the listing `Card` as the default shell
- use `Badge` for signal summaries, not custom styled spans
- use `Table` only for comparison, not for the primary browse experience
- use `Sheet` for drilldown so result cards stay dense
- when a signal failed, present an explicit unavailable state instead of hiding the section
