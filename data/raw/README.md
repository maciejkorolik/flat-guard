# Raw Crawl Artifacts

This directory keeps only the tiny checked-in preview sample for the Wroclaw OLX raw-ingest path.

Contract reference:

- [docs/database-schema-reference.md](/Users/bruno/Desktop/work/hackathon/docs/database-schema-reference.md)
- [naive-schema.md](/Users/bruno/Desktop/work/hackathon/naive-schema.md)

Checked-in files:

- `olx_wroclaw_rentals_raw.sample.jsonl`
  - tiny preview sample
  - mirrors the full current crawler field set, including nullable detail fields

Local-only artifacts stay in crawler JSONL/CSV format. The loader maps them into `public.listings_raw` and projects explicit typed fields into `public.listings_normalized`.

Useful commands:

- `npm run olx:completeness -- .local-data/olx/olx_wroclaw_rentals_raw_20260328T112643436Z.jsonl`
- `npm run olx:upload -- .local-data/olx/olx_wroclaw_rentals_raw_20260328T112643436Z.jsonl`
- `psql "$SUPABASE_DB_URL" -v source_name=olx -f supabase/sql/report_olx_ingest_completeness.sql`

Full crawl outputs are intentionally kept outside version control so repeated crawler runs do not pollute commits.
