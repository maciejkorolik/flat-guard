alter table public.listings_normalized
  add column if not exists exact_location_available boolean,
  add column if not exists image_urls text[],
  add column if not exists source_business_type text,
  add column if not exists source_offer_payload jsonb,
  add column if not exists source_detail_payload jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_source_offer_payload_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_source_offer_payload_check
      check (
        source_offer_payload is null
        or jsonb_typeof(source_offer_payload) = 'object'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_normalized_source_detail_payload_check'
  ) then
    alter table public.listings_normalized
      add constraint listings_normalized_source_detail_payload_check
      check (
        source_detail_payload is null
        or jsonb_typeof(source_detail_payload) = 'object'
      );
  end if;
end $$;
