do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'enrichment_source_mode'
  ) then
    create type public.enrichment_source_mode as enum (
      'file',
      'db'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'enrichment_run_status'
  ) then
    create type public.enrichment_run_status as enum (
      'running',
      'completed',
      'failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'geocode_status'
  ) then
    create type public.geocode_status as enum (
      'succeeded',
      'insufficient_input',
      'zero_results',
      'failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'enrichment_signal_status'
  ) then
    create type public.enrichment_signal_status as enum (
      'succeeded',
      'skipped',
      'failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'enrichment_confidence_level'
  ) then
    create type public.enrichment_confidence_level as enum (
      'low',
      'medium',
      'high'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'proximity_category_source'
  ) then
    create type public.proximity_category_source as enum (
      'baseline',
      'curated_custom',
      'free_text_custom'
    );
  end if;
end $$;

create table if not exists public.enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  source_mode public.enrichment_source_mode not null,
  status public.enrichment_run_status not null default 'running',
  input_file text,
  search_city text,
  selected_categories jsonb not null default '[]'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  requested_listing_count integer not null default 0,
  processed_listing_count integer not null default 0,
  succeeded_listing_count integer not null default 0,
  failed_listing_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (jsonb_typeof(selected_categories) = 'array'),
  check (jsonb_typeof(notes) = 'object'),
  check (requested_listing_count >= 0),
  check (processed_listing_count >= 0),
  check (succeeded_listing_count >= 0),
  check (failed_listing_count >= 0),
  check (completed_at is null or completed_at >= started_at)
);

create table if not exists public.listing_enrichments (
  id bigserial primary key,
  enrichment_run_id uuid not null references public.enrichment_runs(id) on delete cascade,
  raw_listing_id uuid references public.listings_raw(id) on delete set null,
  normalized_listing_id uuid references public.listings_normalized(id) on delete set null,
  source text not null,
  source_listing_id text not null,
  source_url text not null,
  search_city text,
  geocode_query text,
  geocode_input jsonb not null default '{}'::jsonb,
  geocode_status public.geocode_status not null default 'insufficient_input',
  geocode_provider text,
  geocode_formatted_address text,
  geocode_place_id text,
  geocode_location_type text,
  geocode_result_types jsonb not null default '[]'::jsonb,
  geocode_partial_match boolean not null default false,
  lat double precision,
  lng double precision,
  geocode_payload jsonb not null default '{}'::jsonb,
  geocoded_at timestamptz,
  weather_status public.enrichment_signal_status not null default 'skipped',
  weather_snapshot jsonb not null default '{}'::jsonb,
  weather_payload jsonb not null default '{}'::jsonb,
  weather_fetched_at timestamptz,
  air_quality_status public.enrichment_signal_status not null default 'skipped',
  air_quality_snapshot jsonb not null default '{}'::jsonb,
  air_quality_payload jsonb not null default '{}'::jsonb,
  air_quality_fetched_at timestamptz,
  sunlight_status public.enrichment_signal_status not null default 'skipped',
  sunlight_score numeric(5, 2),
  sunlight_confidence public.enrichment_confidence_level,
  sunlight_estimated_orientation_hint text,
  sunlight_reasons jsonb not null default '[]'::jsonb,
  sunlight_payload jsonb not null default '{}'::jsonb,
  sunlight_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(geocode_input) = 'object'),
  check (jsonb_typeof(geocode_result_types) = 'array'),
  check (jsonb_typeof(geocode_payload) = 'object'),
  check (jsonb_typeof(weather_snapshot) = 'object'),
  check (jsonb_typeof(weather_payload) = 'object'),
  check (jsonb_typeof(air_quality_snapshot) = 'object'),
  check (jsonb_typeof(air_quality_payload) = 'object'),
  check (jsonb_typeof(sunlight_reasons) = 'array'),
  check (jsonb_typeof(sunlight_payload) = 'object'),
  check (lat is null or lat between -90 and 90),
  check (lng is null or lng between -180 and 180),
  check (sunlight_score is null or (sunlight_score >= 0 and sunlight_score <= 100))
);

create unique index if not exists listing_enrichments_run_source_listing_uidx
  on public.listing_enrichments (enrichment_run_id, source, source_listing_id);

create unique index if not exists listing_enrichments_run_raw_listing_uidx
  on public.listing_enrichments (enrichment_run_id, raw_listing_id)
  where raw_listing_id is not null;

create index if not exists listing_enrichments_raw_listing_idx
  on public.listing_enrichments (raw_listing_id);

create index if not exists listing_enrichments_normalized_listing_idx
  on public.listing_enrichments (normalized_listing_id);

create index if not exists listing_enrichments_run_idx
  on public.listing_enrichments (enrichment_run_id);

create index if not exists listing_enrichments_geocode_status_idx
  on public.listing_enrichments (geocode_status);

create table if not exists public.listing_proximity_matches (
  id bigserial primary key,
  listing_enrichment_id bigint not null references public.listing_enrichments(id) on delete cascade,
  category_key text not null,
  category_label text not null,
  category_source public.proximity_category_source not null,
  search_method text not null,
  search_confidence public.enrichment_confidence_level not null default 'high',
  requested_query text not null,
  requested_query_payload jsonb not null default '{}'::jsonb,
  place_id text,
  place_resource_name text,
  place_name text,
  place_formatted_address text,
  place_primary_type text,
  place_types jsonb not null default '[]'::jsonb,
  place_lat double precision,
  place_lng double precision,
  straight_line_distance_meters integer,
  walking_distance_meters integer,
  walking_duration_seconds integer,
  route_condition text,
  route_payload jsonb not null default '{}'::jsonb,
  place_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(requested_query_payload) = 'object'),
  check (jsonb_typeof(place_types) = 'array'),
  check (jsonb_typeof(route_payload) = 'object'),
  check (jsonb_typeof(place_payload) = 'object'),
  check (place_lat is null or place_lat between -90 and 90),
  check (place_lng is null or place_lng between -180 and 180),
  check (straight_line_distance_meters is null or straight_line_distance_meters >= 0),
  check (walking_distance_meters is null or walking_distance_meters >= 0),
  check (walking_duration_seconds is null or walking_duration_seconds >= 0)
);

create unique index if not exists listing_proximity_matches_enrichment_category_uidx
  on public.listing_proximity_matches (listing_enrichment_id, category_key);

create index if not exists listing_proximity_matches_category_idx
  on public.listing_proximity_matches (category_key, walking_duration_seconds);
