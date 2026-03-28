-- Raw-ingest typed schema for the source-agnostic contract in:
-- /Users/bruno/Desktop/work/hackathon/naive-schema.md

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'listing_source'
  ) then
    create type public.listing_source as enum (
      'olx'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ingest_run_status'
  ) then
    create type public.ingest_run_status as enum (
      'running',
      'completed',
      'failed'
    );
  end if;
end $$;

create table if not exists public.raw_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source public.listing_source not null,
  search_city text not null,
  search_region text,
  search_url text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status public.ingest_run_status not null default 'running',
  requested_target_count integer not null default 150,
  pages_fetched integer not null default 0,
  listings_seen integer not null default 0,
  listings_inserted integer not null default 0,
  runner_version text,
  notes jsonb not null default '{}'::jsonb,
  check (requested_target_count > 0),
  check (pages_fetched >= 0),
  check (listings_seen >= 0),
  check (listings_inserted >= 0),
  check (completed_at is null or completed_at >= started_at)
);

create index if not exists raw_ingest_runs_source_city_started_idx
  on public.raw_ingest_runs (source, search_city, started_at desc);

create table if not exists public.raw_rental_listings (
  id bigserial primary key,
  ingest_run_id uuid not null references public.raw_ingest_runs(id) on delete cascade,
  source public.listing_source not null,
  source_listing_id text not null,
  source_url text not null,
  search_url text not null,
  search_city text not null,
  search_region text,
  search_page integer not null,
  position_on_page integer not null,
  listing_title text not null,
  listing_price_amount numeric(12, 2),
  listing_price_currency char(3),
  location_label text,
  district text,
  area_m2 numeric(8, 2),
  rooms numeric(4, 1),
  is_promoted boolean not null default false,
  scraped_at timestamptz not null default now(),
  content_hash text not null,
  raw_payload jsonb not null,
  check (search_page > 0),
  check (position_on_page > 0),
  check (listing_price_amount is null or listing_price_amount >= 0),
  check (area_m2 is null or area_m2 > 0),
  check (rooms is null or rooms > 0),
  check (
    listing_price_currency is null
    or listing_price_currency = upper(listing_price_currency)
  ),
  check (jsonb_typeof(raw_payload) = 'object')
);

create unique index if not exists raw_rental_listings_source_listing_run_uidx
  on public.raw_rental_listings (source, source_listing_id, ingest_run_id);

create unique index if not exists raw_rental_listings_content_hash_uidx
  on public.raw_rental_listings (ingest_run_id, content_hash);

create index if not exists raw_rental_listings_source_city_idx
  on public.raw_rental_listings (source, search_city);

create index if not exists raw_rental_listings_scraped_at_idx
  on public.raw_rental_listings (scraped_at desc);

create index if not exists raw_rental_listings_payload_gin_idx
  on public.raw_rental_listings
  using gin (raw_payload jsonb_path_ops);
