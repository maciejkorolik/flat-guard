do $$
begin
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
end $$;
