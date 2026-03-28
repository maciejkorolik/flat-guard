create table search_runs (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects(id) on delete cascade,
  search_profile_id uuid not null references search_profiles(id),
  profile_snapshot  jsonb not null,  -- frozen copy of profile at run time
  total_matched     int,             -- listings that were scored
  total_scored      int,             -- listings returned in results
  status            text not null default 'running',  -- 'running','completed','failed'
  created_at        timestamptz not null default now()
);

create table search_run_results (
  id                uuid primary key default uuid_generate_v4(),
  search_run_id     uuid not null references search_runs(id) on delete cascade,
  listing_id        uuid not null references listings_normalized(id),
  listing_snapshot  jsonb not null,  -- frozen listing copy at run time
  rank              int,
  total_score       numeric,
  score_breakdown   jsonb,  -- {price:25, size:15, features:20, location:{office:{dist_km:2.3, score:18}}}
  created_at        timestamptz not null default now()
);
