\set source_name 'olx'

with base as (
  select *
  from public.listings_normalized
  where source = :'source_name'
),
totals as (
  select count(*)::integer as total_rows
  from base
),
stats as (
  select 'url'::text as column_name, count(*) filter (where url is not null and btrim(url) <> '')::integer as filled_count from base
  union all
  select 'title', count(*) filter (where title is not null and btrim(title) <> '')::integer from base
  union all
  select 'description', count(*) filter (where description is not null and btrim(description) <> '')::integer from base
  union all
  select 'city', count(*) filter (where city is not null and btrim(city) <> '')::integer from base
  union all
  select 'district', count(*) filter (where district is not null and btrim(district) <> '')::integer from base
  union all
  select 'neighbourhood', count(*) filter (where neighbourhood is not null and btrim(neighbourhood) <> '')::integer from base
  union all
  select 'address', count(*) filter (where address is not null and btrim(address) <> '')::integer from base
  union all
  select 'area_m2', count(*) filter (where area_m2 is not null)::integer from base
  union all
  select 'rooms', count(*) filter (where rooms is not null)::integer from base
  union all
  select 'floor', count(*) filter (where floor is not null)::integer from base
  union all
  select 'building_type', count(*) filter (where building_type is not null and btrim(building_type) <> '')::integer from base
  union all
  select 'offer_type', count(*) filter (where offer_type is not null and btrim(offer_type) <> '')::integer from base
  union all
  select 'rent_pln', count(*) filter (where rent_pln is not null)::integer from base
  union all
  select 'fees', count(*) filter (where fees is not null and fees <> '{}'::jsonb)::integer from base
  union all
  select 'total_monthly_pln', count(*) filter (where total_monthly_pln is not null)::integer from base
  union all
  select 'has_elevator', count(*) filter (where has_elevator is not null)::integer from base
  union all
  select 'is_furnished', count(*) filter (where is_furnished is not null)::integer from base
  union all
  select 'parking_type', count(*) filter (where parking_type is not null and btrim(parking_type) <> '')::integer from base
)
select
  s.column_name,
  s.filled_count,
  t.total_rows,
  case
    when t.total_rows = 0 then 0
    else round((s.filled_count::numeric / t.total_rows::numeric) * 100, 1)
  end as percent_filled
from stats s
cross join totals t
order by percent_filled desc, column_name asc;
