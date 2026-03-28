alter table public.listings_normalized
  add column if not exists last_enrichment_run_id uuid,
  add column if not exists geocode_status public.geocode_status,
  add column if not exists geocode_provider text,
  add column if not exists geocode_query text,
  add column if not exists geocode_formatted_address text,
  add column if not exists geocode_place_id text,
  add column if not exists geocode_location_type text,
  add column if not exists geocode_result_types jsonb,
  add column if not exists geocode_partial_match boolean,
  add column if not exists geocode_lat double precision,
  add column if not exists geocode_lng double precision,
  add column if not exists geocoded_at timestamptz,
  add column if not exists weather_status public.enrichment_signal_status,
  add column if not exists weather_summary_time timestamptz,
  add column if not exists weather_condition_type text,
  add column if not exists weather_condition_text text,
  add column if not exists weather_temperature_c double precision,
  add column if not exists weather_precipitation_probability_percent double precision,
  add column if not exists weather_next12h_rain_hours integer,
  add column if not exists weather_next12h_max_precip_probability_percent double precision,
  add column if not exists weather_fetched_at timestamptz,
  add column if not exists air_quality_status public.enrichment_signal_status,
  add column if not exists air_quality_summary_time timestamptz,
  add column if not exists air_quality_aqi_index_code text,
  add column if not exists air_quality_aqi_display_name text,
  add column if not exists air_quality_aqi_value double precision,
  add column if not exists air_quality_aqi_category text,
  add column if not exists air_quality_dominant_pollutant text,
  add column if not exists air_quality_fetched_at timestamptz,
  add column if not exists sunlight_status public.enrichment_signal_status,
  add column if not exists sunlight_score numeric(5, 2),
  add column if not exists sunlight_confidence public.enrichment_confidence_level,
  add column if not exists sunlight_estimated_orientation_hint text,
  add column if not exists sunlight_reasons text[],
  add column if not exists sunlight_fetched_at timestamptz,
  add column if not exists proximity_matches jsonb,
  add column if not exists proximity_fetched_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'enrichment_runs'
      and c.relkind = 'r'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_last_enrichment_run_id_fkey'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_last_enrichment_run_id_fkey
      foreign key (last_enrichment_run_id)
      references public.enrichment_runs(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_geocode_result_types_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_geocode_result_types_check
      check (
        geocode_result_types is null
        or jsonb_typeof(geocode_result_types) = 'array'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_proximity_matches_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_proximity_matches_check
      check (
        proximity_matches is null
        or jsonb_typeof(proximity_matches) = 'array'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_weather_precip_prob_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_weather_precip_prob_check
      check (
        weather_precipitation_probability_percent is null
        or (
          weather_precipitation_probability_percent >= 0
          and weather_precipitation_probability_percent <= 100
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_weather_next12h_rain_hours_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_weather_next12h_rain_hours_check
      check (
        weather_next12h_rain_hours is null
        or weather_next12h_rain_hours >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_weather_next12h_max_precip_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_weather_next12h_max_precip_check
      check (
        weather_next12h_max_precip_probability_percent is null
        or (
          weather_next12h_max_precip_probability_percent >= 0
          and weather_next12h_max_precip_probability_percent <= 100
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_air_quality_aqi_value_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_air_quality_aqi_value_check
      check (
        air_quality_aqi_value is null
        or air_quality_aqi_value >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_sunlight_score_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_sunlight_score_check
      check (
        sunlight_score is null
        or (sunlight_score >= 0 and sunlight_score <= 100)
      );
  end if;
end $$;

create index if not exists listings_normalized_last_enrichment_run_idx
  on public.listings_normalized (last_enrichment_run_id);

create index if not exists listings_normalized_geocode_status_idx
  on public.listings_normalized (geocode_status);

create index if not exists listings_normalized_sunlight_score_idx
  on public.listings_normalized (sunlight_score);
