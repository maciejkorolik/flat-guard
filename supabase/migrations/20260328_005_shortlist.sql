create table shortlist_entries (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references projects(id) on delete cascade,
  listing_id       uuid not null references listings_normalized(id),
  listing_snapshot jsonb not null,  -- frozen listing copy at time of shortlisting
  search_run_id    uuid references search_runs(id),
  status           text not null default 'saved',  -- 'saved','contacted','rejected','rented'
  notes            text,
  contact_info     jsonb,       -- {name, phone, email, agency_name}
  contacted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
