alter table public.raw_rental_listings
  add column if not exists detail_html_sha256 text,
  add column if not exists description_raw text,
  add column if not exists image_urls_raw jsonb not null default '[]'::jsonb,
  add column if not exists seller_name_raw text,
  add column if not exists seller_profile_url text,
  add column if not exists seller_member_since_raw text,
  add column if not exists seller_last_seen_raw text,
  add column if not exists source_business_type_raw text,
  add column if not exists contact_phone_masked_raw text,
  add column if not exists contact_phone_raw text,
  add column if not exists contact_email_raw text,
  add column if not exists contact_preference_raw text,
  add column if not exists exact_location_available_raw boolean,
  add column if not exists district_breadcrumb_raw text,
  add column if not exists district_breadcrumb_id_raw text,
  add column if not exists district_hint_raw text,
  add column if not exists street_hint_raw text,
  add column if not exists animals_raw text,
  add column if not exists elevator_raw text,
  add column if not exists parking_raw text,
  add column if not exists floor_raw text,
  add column if not exists furnished_raw text,
  add column if not exists building_type_raw text,
  add column if not exists area_m2_detail_raw numeric(8, 2),
  add column if not exists rooms_detail_raw numeric(4, 1),
  add column if not exists additional_rent_raw numeric(12, 2),
  add column if not exists raw_detail_payload jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'raw_rental_listings_image_urls_raw_check'
  ) then
    alter table public.raw_rental_listings
      add constraint raw_rental_listings_image_urls_raw_check
      check (jsonb_typeof(image_urls_raw) = 'array');
  end if;
end $$;

create index if not exists raw_rental_listings_district_breadcrumb_idx
  on public.raw_rental_listings (district_breadcrumb_raw);

create index if not exists raw_rental_listings_seller_name_idx
  on public.raw_rental_listings (seller_name_raw);
