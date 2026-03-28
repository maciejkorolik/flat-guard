# Raw Crawl Artifacts

This directory keeps a small checked-in handoff set for the Wroclaw OLX raw-ingest path.

Contract reference:

- [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md)

Checked-in files:

- `olx_wroclaw_rentals_raw_20260328T112643436Z.*`
  - first large crawl snapshot
  - 170 raw rows
  - useful for search-result coverage and loader testing
- `olx_wroclaw_rentals_raw_20260328T113702845Z.*`
  - enriched detail-page sample
  - 5 raw rows
  - includes description, image URLs, seller fields, masked phone, district breadcrumb, and typed detail hints
- `olx_wroclaw_rentals_raw.sample.jsonl`
  - tiny preview sample

All other local crawl outputs are intentionally ignored so repeated crawler runs do not pollute commits.
