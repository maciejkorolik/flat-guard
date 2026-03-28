create table projects (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  status     text not null default 'active',  -- 'active','archived'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table search_profiles (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  version    int not null default 1,

  -- all preferences are soft (affect scoring only, nothing is excluded)

  -- location preferences
  preferred_cities         text[],  -- strong positive score for these
  preferred_districts      text[],
  preferred_neighbourhoods text[],
  important_locations      jsonb[], -- [{label:'office', lat:52.2, lng:21.0, max_commute_min:30, weight:10}]
                                    -- empty array if user doesn't use POI scoring

  -- budget & size preferences (deviation from target scores lower)
  budget_target_pln  int,      -- ideal monthly total; listings above/below score lower
  rooms_preferred    int,      -- ideal number of rooms
  area_m2_preferred  numeric,  -- ideal size

  -- availability preference
  availability_preferred text,  -- 'immediate' or a target date range

  -- feature preferences
  preferred_features      text[],  -- draws from extra_features, equipment arrays, feature column names
  disliked_features       text[],  -- score penalty (e.g. 'coal_heating') — not excluded, just scored lower
  preferred_offer_type    text,    -- 'any','agency','private'
  preferred_heating_types text[],

  -- full structured output from interview AI
  raw_requirements jsonb,

  is_current bool not null default true,
  created_at timestamptz not null default now()
);

create table interview_sessions (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects(id) on delete cascade,
  search_profile_id uuid references search_profiles(id),
  messages          jsonb[] not null default '{}',  -- [{role:'user'|'assistant', content, ts}]
  status            text not null default 'in_progress',  -- 'in_progress','completed'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
