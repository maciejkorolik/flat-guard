create table listings_raw (
  id            uuid primary key default uuid_generate_v4(),
  source        text not null,
  external_id   text not null,
  raw_data      jsonb not null,
  scraped_at    timestamptz not null default now(),
  normalized_id uuid,
  unique(source, external_id)
);

create table listings_normalized (
  -- identity
  id            uuid primary key default uuid_generate_v4(),
  source        text not null,
  external_id   text not null,
  url           text,
  title         text,
  description   text,
  is_active     bool not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  -- location
  city          text,
  district      text,       -- administrative district, e.g. 'Fabryczna'
  neighbourhood text,       -- finer-grained area, e.g. 'Ołbin'
  address       text,
  lat           numeric,
  lng           numeric,
  location      geography(Point, 4326),  -- PostGIS point computed from lat/lng

  -- physical
  area_m2       numeric,
  rooms         int,
  floor         int,
  total_floors  int,
  building_type text,       -- 'block','house','tenement','new_development'

  -- offer
  offer_type          text,  -- 'agency','private','developer'
  has_provision       bool,  -- null=unknown, false=no provision, true=provision required
  provision_total_pln int,   -- total provision value in PLN

  -- pricing
  rent_pln          int,
  deposit_pln       int,
  fees              jsonb,   -- [{fee_type: 'gas', amount_pln: 100}, ...]
  total_monthly_pln int,     -- rent_pln + sum of fees[*].amount_pln

  -- availability
  available_from date,       -- null = immediately or unknown

  -- features
  -- null=unknown, false=confirmed absent, true=confirmed present
  has_balcony      bool,
  has_terrace      bool,
  has_elevator     bool,
  has_storage_room bool,
  is_furnished     bool,
  has_internet     bool,
  has_tv           bool,
  heating_type     text,     -- 'gas','electric','district','coal','heat_pump','other'
  parking_type     text,     -- 'none','surface','underground','garage'

  -- equipment & extras
  -- null=unknown, empty array=explicitly none, populated=known items
  kitchen_equipment    text[],  -- ['fridge','oven','dishwasher','microwave','induction_hob','washing_machine']
  bathroom_features    text[],  -- ['bathtub','shower','washing_machine','dryer']
  living_room_features text[],  -- ['sofa','ac','smart_tv']
  extra_features       text[],  -- ['gym','pool','concierge','bike_room','open_space','garden']

  -- nearby (as declared by listing source, not computed)
  nearby jsonb,               -- {grocery_m: 300, park_m: 500, public_transport_m: 150}

  unique(source, external_id)
);

create index listings_normalized_location_idx on listings_normalized using gist(location);
create index listings_normalized_active_idx   on listings_normalized(is_active) where is_active = true;
create index listings_normalized_city_idx     on listings_normalized(city);

alter table listings_raw
  add constraint listings_raw_normalized_id_fkey
  foreign key (normalized_id) references listings_normalized(id);
