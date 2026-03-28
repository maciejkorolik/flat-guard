\set ON_ERROR_STOP on

-- Loader for OLX JSONL records mapped into the generic raw contract in:
-- /Users/bruno/Desktop/work/hackathon/naive-schema.md

create temporary table if not exists temp_raw_json_lines (
  line_number bigserial primary key,
  line text not null
);

truncate temp_raw_json_lines;

copy temp_raw_json_lines (line) from :'jsonl_path';

with parsed as (
  select
    line_number,
    line::jsonb as j
  from temp_raw_json_lines
),
upsert_run as (
  insert into public.raw_ingest_runs (
    id,
    source,
    search_city,
    search_region,
    search_url,
    started_at,
    completed_at,
    status,
    requested_target_count,
    pages_fetched,
    listings_seen,
    listings_inserted,
    runner_version,
    notes
  )
  select
    (array_agg((j ->> 'crawl_run_id')::uuid order by line_number))[1] as id,
    'olx'::public.listing_source,
    min(j ->> 'city_query') as search_city,
    'wroclaw'::text as search_region,
    'https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/'::text as search_url,
    min((j ->> 'scraped_at_utc')::timestamptz) as started_at,
    max((j ->> 'scraped_at_utc')::timestamptz) as completed_at,
    'completed'::public.ingest_run_status,
    count(*)::integer as requested_target_count,
    max((j ->> 'page_number')::integer) as pages_fetched,
    count(*)::integer as listings_seen,
    count(*)::integer as listings_inserted,
    'scripts/crawl-olx-wroclaw-raw.mjs'::text as runner_version,
    jsonb_build_object(
      'input_file',
      :'jsonl_path',
      'loaded_at',
      now()
    ) as notes
  from parsed
  on conflict (id) do update
    set completed_at = excluded.completed_at,
        status = excluded.status,
        requested_target_count = excluded.requested_target_count,
        pages_fetched = excluded.pages_fetched,
        listings_seen = excluded.listings_seen,
        listings_inserted = excluded.listings_inserted,
        runner_version = excluded.runner_version,
        notes = public.raw_ingest_runs.notes || excluded.notes
  returning id
)
insert into public.raw_rental_listings (
  ingest_run_id,
  source,
  source_listing_id,
  source_url,
  search_url,
  search_city,
  search_region,
  search_page,
  position_on_page,
  listing_title,
  listing_price_amount,
  listing_price_currency,
  location_label,
  district,
  area_m2,
  rooms,
  detail_html_sha256,
  description_raw,
  image_urls_raw,
  seller_name_raw,
  seller_profile_url,
  seller_member_since_raw,
  seller_last_seen_raw,
  source_business_type_raw,
  contact_phone_masked_raw,
  contact_phone_raw,
  contact_email_raw,
  contact_preference_raw,
  exact_location_available_raw,
  district_breadcrumb_raw,
  district_breadcrumb_id_raw,
  district_hint_raw,
  street_hint_raw,
  animals_raw,
  elevator_raw,
  parking_raw,
  floor_raw,
  furnished_raw,
  building_type_raw,
  area_m2_detail_raw,
  rooms_detail_raw,
  additional_rent_raw,
  is_promoted,
  scraped_at,
  content_hash,
  raw_payload,
  raw_detail_payload
)
select
  (select id from upsert_run),
  'olx'::public.listing_source,
  coalesce(
    nullif(j ->> 'listing_id', ''),
    md5(coalesce(j ->> 'listing_url', j::text))
  ) as source_listing_id,
  j ->> 'listing_url' as source_url,
  case
    when (j ->> 'page_number')::integer = 1 then
      'https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/'
    else
      format(
        'https://www.olx.pl/nieruchomosci/mieszkania/wynajem/q-mieszkania-wroclaw/?page=%s',
        j ->> 'page_number'
      )
  end as search_url,
  j ->> 'city_query' as search_city,
  'wroclaw'::text as search_region,
  (j ->> 'page_number')::integer as search_page,
  row_number() over (
    partition by (j ->> 'page_number')::integer
    order by line_number
  )::integer as position_on_page,
  j ->> 'title_raw' as listing_title,
  nullif(j ->> 'price_numeric_raw', '')::numeric(12, 2) as listing_price_amount,
  nullif(upper(j ->> 'price_currency_raw'), '')::char(3) as listing_price_currency,
  nullif(j ->> 'area_served_raw', '') as location_label,
  case
    when coalesce(j ->> 'district_breadcrumb_raw', '') <> '' then j ->> 'district_breadcrumb_raw'
    when coalesce(j ->> 'district_hint_raw', '') <> '' then j ->> 'district_hint_raw'
    when coalesce(j ->> 'area_served_raw', '') in ('Wrocław', 'wroclaw') then null
    else nullif(j ->> 'area_served_raw', '')
  end as district,
  nullif(j ->> 'area_m2_detail_raw', '')::numeric(8, 2) as area_m2,
  nullif(j ->> 'rooms_detail_raw', '')::numeric(4, 1) as rooms,
  nullif(j ->> 'detail_html_sha256', '') as detail_html_sha256,
  nullif(j ->> 'description_raw', '') as description_raw,
  coalesce(j -> 'image_urls_raw', '[]'::jsonb) as image_urls_raw,
  nullif(j ->> 'seller_name_raw', '') as seller_name_raw,
  nullif(j ->> 'seller_profile_url', '') as seller_profile_url,
  nullif(j ->> 'seller_member_since_raw', '') as seller_member_since_raw,
  nullif(j ->> 'seller_last_seen_raw', '') as seller_last_seen_raw,
  nullif(j ->> 'source_business_type_raw', '') as source_business_type_raw,
  nullif(j ->> 'contact_phone_masked_raw', '') as contact_phone_masked_raw,
  nullif(j ->> 'contact_phone_raw', '') as contact_phone_raw,
  nullif(j ->> 'contact_email_raw', '') as contact_email_raw,
  nullif(j ->> 'contact_preference_raw', '') as contact_preference_raw,
  case
    when j ? 'exact_location_available_raw' then (j ->> 'exact_location_available_raw')::boolean
    else null
  end as exact_location_available_raw,
  nullif(j ->> 'district_breadcrumb_raw', '') as district_breadcrumb_raw,
  nullif(j ->> 'district_breadcrumb_id_raw', '') as district_breadcrumb_id_raw,
  nullif(j ->> 'district_hint_raw', '') as district_hint_raw,
  nullif(j ->> 'street_hint_raw', '') as street_hint_raw,
  nullif(j ->> 'animals_raw', '') as animals_raw,
  nullif(j ->> 'elevator_raw', '') as elevator_raw,
  nullif(j ->> 'parking_raw', '') as parking_raw,
  nullif(j ->> 'floor_raw', '') as floor_raw,
  nullif(j ->> 'furnished_raw', '') as furnished_raw,
  nullif(j ->> 'building_type_raw', '') as building_type_raw,
  nullif(j ->> 'area_m2_detail_raw', '')::numeric(8, 2) as area_m2_detail_raw,
  nullif(j ->> 'rooms_detail_raw', '')::numeric(4, 1) as rooms_detail_raw,
  nullif(j ->> 'additional_rent_raw', '')::numeric(12, 2) as additional_rent_raw,
  coalesce((j -> 'raw_offer_json' ->> 'promoted')::boolean, false) as is_promoted,
  (j ->> 'scraped_at_utc')::timestamptz as scraped_at,
  md5(j::text) as content_hash,
  jsonb_build_object('crawler_record', j) as raw_payload,
  coalesce(j -> 'raw_detail_json', '{}'::jsonb) as raw_detail_payload
from parsed
on conflict (source, source_listing_id, ingest_run_id) do nothing;
