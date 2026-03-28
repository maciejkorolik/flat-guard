alter table projects            enable row level security;
alter table search_profiles     enable row level security;
alter table interview_sessions  enable row level security;
alter table search_runs         enable row level security;
alter table search_run_results  enable row level security;
alter table shortlist_entries   enable row level security;
alter table listings_normalized enable row level security;
alter table listings_raw        enable row level security;

-- projects: own rows only
create policy "users manage own projects"
  on projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- search_profiles: via project ownership
create policy "users manage own search profiles"
  on search_profiles for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- interview_sessions: via project ownership
create policy "users manage own interview sessions"
  on interview_sessions for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- search_runs: via project ownership
create policy "users manage own search runs"
  on search_runs for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- search_run_results: read only, via search_run → project
create policy "users view own search run results"
  on search_run_results for select
  using (
    search_run_id in (
      select id from search_runs
      where project_id in (select id from projects where user_id = auth.uid())
    )
  );

-- shortlist_entries: via project ownership
create policy "users manage own shortlist"
  on shortlist_entries for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- listings: authenticated read-only, no user writes
create policy "authenticated users read listings"
  on listings_normalized for select
  using (auth.role() = 'authenticated');

create policy "authenticated users read raw listings"
  on listings_raw for select
  using (auth.role() = 'authenticated');
