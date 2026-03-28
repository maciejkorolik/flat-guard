\set ON_ERROR_STOP on

-- Loader for OLX crawler JSONL into the current production-facing listing tables:
-- /Users/bruno/Desktop/work/hackathon/docs/database-schema-reference.md

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
projected as (
  select
    p.line_number,
    coalesce(nullif(p.j ->> 'source', ''), 'olx') as source,
    coalesce(
      nullif(p.j ->> 'listing_id', ''),
      md5(coalesce(p.j ->> 'listing_url', p.j::text))
    ) as external_id,
    nullif(split_part(p.j ->> 'listing_url', '?', 1), '') as url,
    nullif(p.j ->> 'title_raw', '') as title,
    nullif(p.j ->> 'description_raw', '') as description,
    coalesce((p.j ->> 'scraped_at_utc')::timestamptz, now()) as scraped_at,
    case
      when coalesce(p.j ->> 'area_served_raw', '') ilike 'wrocław%' then 'Wrocław'
      when coalesce(p.j ->> 'area_served_raw', '') ilike 'wroclaw%' then 'Wrocław'
      when coalesce(p.j ->> 'city_query', '') <> '' then initcap(p.j ->> 'city_query')
      else null
    end as city,
    coalesce(
      nullif(p.j ->> 'district_breadcrumb_raw', ''),
      nullif(
        btrim(split_part(split_part(coalesce(p.j ->> 'area_served_raw', ''), ',', 2), '-', 1)),
        ''
      )
    ) as district,
    nullif(p.j ->> 'district_hint_raw', '') as neighbourhood,
    nullif(p.j ->> 'street_hint_raw', '') as address,
    nullif(p.j ->> 'area_m2_detail_raw', '')::numeric as area_m2,
    nullif(p.j ->> 'rooms_detail_raw', '')::integer as rooms,
    case
      when nullif(regexp_replace(coalesce(p.j ->> 'floor_raw', ''), '[^0-9-]', '', 'g'), '') is null then null
      else nullif(regexp_replace(coalesce(p.j ->> 'floor_raw', ''), '[^0-9-]', '', 'g'), '')::integer
    end as floor,
    nullif(p.j ->> 'building_type_raw', '') as building_type,
    'rent'::text as offer_type,
    nullif(p.j ->> 'price_numeric_raw', '')::integer as rent_pln,
    case
      when nullif(p.j ->> 'additional_rent_raw', '') is null then null
      else jsonb_build_object(
        'administrative_rent_pln',
        (p.j ->> 'additional_rent_raw')::integer
      )
    end as fees,
    case
      when nullif(p.j ->> 'price_numeric_raw', '') is null then null
      when nullif(p.j ->> 'additional_rent_raw', '') is null then (p.j ->> 'price_numeric_raw')::integer
      else ((p.j ->> 'price_numeric_raw')::integer + (p.j ->> 'additional_rent_raw')::integer)
    end as total_monthly_pln,
    case lower(coalesce(p.j ->> 'elevator_raw', ''))
      when 'tak' then true
      when 'yes' then true
      when 'nie' then false
      when 'no' then false
      else null
    end as has_elevator,
    case lower(coalesce(p.j ->> 'furnished_raw', ''))
      when 'tak' then true
      when 'yes' then true
      when 'nie' then false
      when 'no' then false
      else null
    end as is_furnished,
    nullif(p.j ->> 'parking_raw', '') as parking_type,
    p.j as raw_data
  from parsed p
),
deduped as (
  select distinct on (source, external_id)
    source,
    external_id,
    url,
    title,
    description,
    scraped_at,
    city,
    district,
    neighbourhood,
    address,
    area_m2,
    rooms,
    floor,
    building_type,
    offer_type,
    rent_pln,
    fees,
    total_monthly_pln,
    has_elevator,
    is_furnished,
    parking_type
  from projected
  order by source, external_id, scraped_at desc, line_number desc
),
updated as (
  update public.listings_normalized ln
  set
    url = coalesce(d.url, ln.url),
    title = coalesce(d.title, ln.title),
    description = coalesce(d.description, ln.description),
    is_active = true,
    first_seen_at = case
      when ln.first_seen_at is null then d.scraped_at
      when d.scraped_at < ln.first_seen_at then d.scraped_at
      else ln.first_seen_at
    end,
    last_seen_at = case
      when ln.last_seen_at is null then d.scraped_at
      when d.scraped_at > ln.last_seen_at then d.scraped_at
      else ln.last_seen_at
    end,
    city = coalesce(d.city, ln.city),
    district = coalesce(d.district, ln.district),
    neighbourhood = coalesce(d.neighbourhood, ln.neighbourhood),
    address = coalesce(d.address, ln.address),
    area_m2 = coalesce(d.area_m2, ln.area_m2),
    rooms = coalesce(d.rooms, ln.rooms),
    floor = coalesce(d.floor, ln.floor),
    building_type = coalesce(d.building_type, ln.building_type),
    offer_type = coalesce(d.offer_type, ln.offer_type),
    rent_pln = coalesce(d.rent_pln, ln.rent_pln),
    fees = coalesce(d.fees, ln.fees),
    total_monthly_pln = coalesce(d.total_monthly_pln, ln.total_monthly_pln),
    has_elevator = coalesce(d.has_elevator, ln.has_elevator),
    is_furnished = coalesce(d.is_furnished, ln.is_furnished),
    parking_type = coalesce(d.parking_type, ln.parking_type)
  from deduped d
  where ln.source = d.source
    and ln.external_id = d.external_id
  returning ln.id, ln.source, ln.external_id
),
inserted as (
  insert into public.listings_normalized (
    source,
    external_id,
    url,
    title,
    description,
    is_active,
    first_seen_at,
    last_seen_at,
    city,
    district,
    neighbourhood,
    address,
    area_m2,
    rooms,
    floor,
    building_type,
    offer_type,
    rent_pln,
    fees,
    total_monthly_pln,
    has_elevator,
    is_furnished,
    parking_type
  )
  select
    d.source,
    d.external_id,
    d.url,
    d.title,
    d.description,
    true,
    d.scraped_at,
    d.scraped_at,
    d.city,
    d.district,
    d.neighbourhood,
    d.address,
    d.area_m2,
    d.rooms,
    d.floor,
    d.building_type,
    d.offer_type,
    d.rent_pln,
    d.fees,
    d.total_monthly_pln,
    d.has_elevator,
    d.is_furnished,
    d.parking_type
  from deduped d
  where not exists (
    select 1
    from public.listings_normalized ln
    where ln.source = d.source
      and ln.external_id = d.external_id
  )
  returning id, source, external_id
)
insert into public.listings_raw (
  source,
  external_id,
  raw_data,
  scraped_at,
  normalized_id
)
select
  p.source,
  p.external_id,
  p.raw_data,
  p.scraped_at,
  coalesce(u.id, i.id, resolved.id)
from projected p
left join updated u
  on u.source = p.source
 and u.external_id = p.external_id
left join inserted i
  on i.source = p.source
 and i.external_id = p.external_id
left join lateral (
  select ln.id
  from public.listings_normalized ln
  where ln.source = p.source
    and ln.external_id = p.external_id
  order by ln.last_seen_at desc nulls last, ln.first_seen_at desc nulls last
  limit 1
) resolved on true;
