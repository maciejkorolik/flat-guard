# FlatGuard MVP Plan

## Summary

Build FlatGuard as a project-based rental search workflow on top of the current auth starter. One project represents one apartment hunt. MVP covers:

1. Interview - conversational requirements capture with visible typed fields
2. Search - query an internal normalized listings base and rank results
3. Shortlist - save liked flats with contact data and notes

Deal-flow is explicitly post-MVP.

The core product rule is: LLM never invents listing facts. It can only extract requirements, explain stored facts, compare listings, and narrate search results backed by typed data.

## Key Changes

### Product and process model

- Introduce `Project` as the root entity for a rental search.
- Each project owns:
  - one current `SearchProfile`
  - one `InterviewSession` transcript
  - many immutable `SearchRun` snapshots
  - many `ShortlistEntry` records
- Use a nested process model:
  - `Interview` produces `SearchProfile vN`
  - `SearchRun vN` executes against that profile
  - `Shortlist` always points to a specific search run snapshot
- Keep search runs immutable so conversational follow-ups stay consistent even if the profile changes later.

### Typed schema and interfaces

- Add a hard-typed normalized listing contract:
  - `ListingNormalized`
  - `listingId`, `source`, `externalId`, `sourceUrl`, `title`, `description`
  - `city`, `district`, `addressText`, `lat`, `lng`
  - `rentBaseMonthly`, `feesMonthly`, `deposit`, `currency`
  - `areaM2`, `rooms`, `floor`, `buildingType`
  - `availableFrom`, `furnished`, `petFriendly`
  - `photos[]`
  - `contactName`, `contactPhone`, `contactEmail`
  - `completenessScore`, `parseConfidence`, `normalizedAt`, `sourceFreshnessAt`
- Add `SearchProfile` as the authoritative output of the interview:
  - `city`
  - `budgetMonthlyMax`
  - `budgetAllInMax`
  - `minAreaM2`
  - `minRooms`
  - `maxCommuteMinutes` as reserved field for post-MVP use
  - `districtsPreferred[]`, `districtsAvoided[]`
  - `furnishedRequired`, `petsAllowedRequired`
  - `moveInFrom`
  - `mustHaves[]`, `niceToHaves[]`, `dealBreakers[]`
  - `freeTextPriorities`
- Add `SearchResult` / `ListingScore`:
  - `completeness`
  - `confidence`
  - `quality`
  - `priceFit`
  - `safety`
  - `overall`
  - `reasons[]`
- Add `ShortlistEntry`:
  - `projectId`, `searchRunId`, `listingId`
  - frozen listing snapshot summary
  - contact fields
  - user notes
  - shortlist status: `saved | contacted | rejected`
- Use shared runtime validation for all external and AI-produced data. AI output must always be parsed into the typed contracts above.

### Retrieval and conversational search behavior

- Use deterministic filtering + scoring, not embedding-first retrieval, for MVP.
- Search flow:
  - filter normalized listings by typed profile constraints
  - rank survivors with score breakdown
  - persist a `SearchRun` snapshot
- Conversational interaction after search uses tool-backed operations over the stored run:
  - `listTopResults`
  - `explainListing`
  - `compareListings`
  - `whyExcluded`
  - `refineProfile`
- Chat can update the search profile, but every update creates a new profile version and triggers a new search run.
- The assistant may summarize and compare results, but every answer must cite stored listing facts internally from the current run data.

### Workflow boundaries

- Use normal Next.js server routes/actions for synchronous UX:
  - project creation
  - interview messages
  - shortlist actions
- Use Workflow only for background tasks:
  - source import job
  - normalization + validation pipeline
  - bulk search rerun if profile changes require non-trivial recompute
- Do not put core request-response chat inside Workflow for MVP.

## Sub-Team Split and Handoffs

### 1. Data sourcing team

Own the listing base as a product-quality dataset.

Deliverables:
- `ListingRaw` and `ListingNormalized` storage model
- batch import path into the internal DB
- source provenance and freshness fields
- dedupe key on `(source, externalId)`
- sample seeded dataset large enough for a convincing demo

Boundaries:
- no ranking logic
- no user-facing search UX
- no AI prompting beyond extraction prerequisites

Handoff contract to transformation:
- stable `ListingNormalized` schema
- import job result contract
- documented nullability and source-freshness semantics

Suggested staffing:
- 2 people

### 2. Data transformation team

Own all meaning-making between raw listings and project search output.

Deliverables:
- normalization validators and fallback rules
- profile extraction from interview into `SearchProfile`
- search filtering and ranking engine
- score breakdown model
- conversational tools over `SearchRun`
- profile versioning and search run versioning

Boundaries:
- no ingestion plumbing from source systems
- no page composition or frontend state management

Handoff contract to serving:
- typed APIs for:
  - create/update profile
  - run search
  - list ranked results
  - explain/compare listings
  - shortlist add/remove
- deterministic score explanation payloads

Suggested staffing:
- 2 people

### 3. Data serving team

Own the user-visible process and product coherence.

Deliverables:
- `Projects` dashboard
- project creation flow
- hybrid interview UI: chat + editable typed profile panel
- search results page with filters, score breakdowns, and conversational follow-up
- shortlist page with contact details and notes
- project stage transitions across `Interview -> Search -> Shortlist`

Boundaries:
- no source ingestion internals
- no scoring policy decisions
- no direct parsing logic beyond rendering validated DTOs

Suggested staffing:
- 1 person as full-stack integrator
- this person also owns final demo polish and cross-team contract enforcement

### Integration order

1. Sourcing publishes `ListingNormalized` contract and seeded data.
2. Transformation codes against that contract and ships mocked search APIs first.
3. Serving builds UI against mocked transformation DTOs immediately.
4. Replace mocks with real transformation APIs once seeded data is live.
5. Final integration freezes one demo dataset and one polished demo project path.

## Test Plan

- Create a project and complete an interview that writes a valid `SearchProfile`.
- Edit profile fields manually and verify a new search run is created.
- Import listings with missing fields and verify normalization produces valid typed rows with nulls plus confidence metadata.
- Run search and verify hard filters are respected before scoring.
- Verify every result exposes score breakdown and explanation reasons.
- Ask conversational questions such as:
  - "why is this flat ranked higher?"
  - "show only furnished options"
  - "compare the top 3"
- Verify follow-up questions only reference facts present in the stored result set.
- Add and remove shortlist entries and confirm contact data and notes persist.
- Verify a shortlisted entry still shows the frozen snapshot even if source listing data changes later.
- Verify unauthorized users cannot access another user's projects or shortlist.

## Post-MVP Notes

- Add external data enrichments to listing and search scoring:
  - Citymapper or similar commute-time integration
  - annual sunlight / daylight exposure estimates
  - average local traffic intensity by month
  - crime and neighborhood safety datasets
- Upgrade `safety` from heuristic score to a real composite metric backed by external sources.
- Add `Deal-flow` as a fourth typed stage after shortlist:
  - contact tracking
  - guided visit checklist and visit report
  - deal analysis
  - final landlord rating
- Add outbound landlord calling via Vapi when contact data is incomplete or key listing facts are missing.
- Support proactive gap-filling workflows:
  - detect missing listing fields
  - trigger outreach tasks
  - re-score listing when new facts arrive
- Add source connectors beyond internal imports if legal and operational constraints are acceptable.
- Add collaboration inside a project for multiple renters sharing one search.
- Add saved preference presets and re-usable search profiles across projects.

## Assumptions and defaults

- MVP search source is internal DB only; no live connectors.
- Interview UX is hybrid chat + typed form.
- Deal-flow, Vapi calling, Citymapper, sunlight, traffic, and crime enrichment are post-MVP.
- MVP is single-owner per project; no project collaboration.
- Search is city-agnostic in schema, but demo can launch with one city dataset.
- `Safety` score in MVP is heuristic only, derived from listing completeness and source confidence; no external crime datasets yet.
- The serving team may expose a future `Deal-flow` placeholder in navigation, but no stage-4 functionality is implemented in MVP.
