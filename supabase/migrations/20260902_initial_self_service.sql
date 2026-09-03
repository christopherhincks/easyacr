-- easyACR self-service foundation. Run with the Supabase SQL editor or CLI.
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists workspaces_one_personal_workspace
  on public.workspaces (owner_user_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  target_url text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'partial', 'failed')),
  page_limit integer not null check (page_limit between 1 and 10),
  pages_crawled integer not null default 0,
  finding_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  terms_version text not null,
  attempt_count integer not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

alter table public.workspaces add column if not exists terms_accepted_at timestamptz;
alter table public.workspaces add column if not exists terms_version text;
alter table public.scan_jobs add column if not exists expires_at timestamptz not null default now() + interval '30 days';
alter table public.scan_jobs add column if not exists attempt_count integer not null default 0;
alter table public.scan_jobs add column if not exists lease_token uuid;
alter table public.scan_jobs add column if not exists lease_expires_at timestamptz;

create table if not exists public.scan_findings (
  id uuid primary key default gen_random_uuid(),
  scan_job_id uuid not null references public.scan_jobs(id) on delete cascade,
  sequence integer not null check (sequence between 1 and 500),
  page text not null check (char_length(page) <= 2048),
  rule_id text not null check (char_length(rule_id) <= 128),
  impact text not null check (impact in ('critical', 'serious', 'moderate', 'minor', 'unknown')),
  help text not null check (char_length(help) <= 500),
  help_url text not null check (char_length(help_url) <= 2048),
  target jsonb not null,
  failure_summary text,
  created_at timestamptz not null default now(),
  unique (scan_job_id, sequence)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  event_type text not null check (char_length(event_type) <= 96),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scan_jobs_workspace_created_at on public.scan_jobs (workspace_id, created_at desc);
create index if not exists scan_jobs_requested_by_created_at on public.scan_jobs (requested_by, created_at desc);
create index if not exists scan_jobs_expiry on public.scan_jobs (expires_at);
create index if not exists scan_findings_job_sequence on public.scan_findings (scan_job_id, sequence);

-- Every user gets exactly one personal workspace on first authenticated API use.
create or replace function public.bootstrap_personal_workspace()
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare result public.workspaces;
begin
  insert into public.workspaces (name, owner_user_id)
  values (coalesce(nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), ''), 'My workspace'), auth.uid())
  on conflict (owner_user_id) do update set name = public.workspaces.name
  returning * into result;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (result.id, auth.uid(), 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return result;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.scan_jobs enable row level security;
alter table public.scan_findings enable row level security;
alter table public.audit_events enable row level security;

create policy "members read workspaces" on public.workspaces for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = auth.uid()));
create policy "members read memberships" on public.workspace_members for select to authenticated
  using (user_id = auth.uid());
create policy "members read scan jobs" on public.scan_jobs for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid()));
create policy "members read scan findings" on public.scan_findings for select to authenticated
  using (exists (select 1 from public.scan_jobs j join public.workspace_members m on m.workspace_id = j.workspace_id where j.id = scan_job_id and m.user_id = auth.uid()));

create or replace function public.easyacr_bootstrap_workspace(p_user_id uuid, p_email text)
returns table (workspace_id uuid, terms_accepted_at timestamptz, terms_version text)
language plpgsql security definer set search_path = public as $$
declare workspace public.workspaces;
begin
  insert into public.workspaces (name, owner_user_id)
  values (coalesce(nullif(left(split_part(coalesce(p_email, ''), '@', 1), 120), ''), 'My workspace'), p_user_id)
  on conflict (owner_user_id) do update set name = public.workspaces.name
  returning * into workspace;
  insert into public.workspace_members (workspace_id, user_id, role) values (workspace.id, p_user_id, 'owner') on conflict do nothing;
  insert into public.audit_events (user_id, workspace_id, event_type) values (p_user_id, workspace.id, 'workspace_bootstrapped');
  return query select workspace.id, workspace.terms_accepted_at, workspace.terms_version;
end;
$$;

create or replace function public.easyacr_accept_terms(p_user_id uuid, p_version text)
returns table (workspace_id uuid, accepted_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare workspace public.workspaces;
begin
  select * into workspace from public.workspaces where owner_user_id = p_user_id;
  if workspace.id is null then raise exception 'workspace missing'; end if;
  update public.workspaces set terms_accepted_at = now(), terms_version = p_version where id = workspace.id returning * into workspace;
  insert into public.audit_events (user_id, workspace_id, event_type, details) values (p_user_id, workspace.id, 'terms_accepted', jsonb_build_object('version', p_version));
  return query select workspace.id, workspace.terms_accepted_at;
end;
$$;

create or replace function public.easyacr_enqueue_scan(p_user_id uuid, p_target_url text, p_page_limit integer)
returns public.scan_jobs
language plpgsql security definer set search_path = public as $$
declare workspace public.workspaces; result public.scan_jobs; daily_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select * into workspace from public.workspaces where owner_user_id = p_user_id;
  if workspace.id is null then raise exception 'workspace missing'; end if;
  if workspace.terms_accepted_at is null or workspace.terms_version <> '2026-09-02' then raise exception 'terms acceptance required'; end if;
  select count(*) into daily_count from public.scan_jobs where requested_by = p_user_id and created_at >= date_trunc('day', now());
  if daily_count >= 3 then raise exception 'daily scan quota reached'; end if;
  insert into public.scan_jobs (workspace_id, requested_by, target_url, status, page_limit, terms_version)
  values (workspace.id, p_user_id, p_target_url, 'queued', p_page_limit, workspace.terms_version)
  returning * into result;
  insert into public.audit_events (user_id, workspace_id, event_type, details) values (p_user_id, workspace.id, 'scan_queued', jsonb_build_object('scan_id', result.id, 'host', split_part(replace(replace(p_target_url, 'https://', ''), 'http://', ''), '/', 1)));
  return result;
end;
$$;

create or replace function public.easyacr_claim_next_scan()
returns table (id uuid, target_url text, page_limit integer, lease_token uuid)
language plpgsql security definer set search_path = public as $$
begin
  update public.scan_jobs set status = 'failed', completed_at = now(), lease_token = null, lease_expires_at = null,
    errors = errors || jsonb_build_array(jsonb_build_object('message', 'Worker lease expired after three attempts.'))
  where status = 'running' and lease_expires_at <= now() and attempt_count >= 3;
  return query with next_job as (
    select j.id from public.scan_jobs j where (j.status = 'queued' or (j.status = 'running' and j.lease_expires_at <= now())) and j.expires_at > now() and j.attempt_count < 3
    order by j.created_at asc for update skip locked limit 1
  ) update public.scan_jobs j set status = 'running', started_at = coalesce(j.started_at, now()), attempt_count = j.attempt_count + 1,
    lease_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes' from next_job
  where j.id = next_job.id returning j.id, j.target_url, j.page_limit, j.lease_token;
end;
$$;

create or replace function public.easyacr_complete_scan(p_scan_id uuid, p_lease_token uuid, p_status text, p_pages_crawled integer, p_findings jsonb, p_errors jsonb)
returns public.scan_jobs
language plpgsql security definer set search_path = public as $$
declare result public.scan_jobs;
begin
  if p_status not in ('completed', 'partial', 'failed') then raise exception 'invalid completion status'; end if;
  if not exists (select 1 from public.scan_jobs where id = p_scan_id and status = 'running' and lease_token = p_lease_token and lease_expires_at > now()) then raise exception 'scan lease is no longer valid'; end if;
  delete from public.scan_findings where scan_job_id = p_scan_id;
  insert into public.scan_findings (scan_job_id, sequence, page, rule_id, impact, help, help_url, target, failure_summary)
  select p_scan_id, row_number() over (), left(coalesce(item->>'page', '/'), 2048), left(coalesce(item->>'ruleId', 'unknown'), 128),
    case when item->>'impact' in ('critical','serious','moderate','minor') then item->>'impact' else 'unknown' end,
    left(coalesce(item->>'help', 'Automated finding'), 500), left(coalesce(item->>'helpUrl', ''), 2048),
    coalesce(item->'target', '[]'::jsonb), left(nullif(item->>'failureSummary', ''), 1000)
  from jsonb_array_elements(p_findings) item limit 500;
  update public.scan_jobs set status = p_status, pages_crawled = p_pages_crawled, finding_count = jsonb_array_length(p_findings), errors = p_errors, completed_at = now(), lease_token = null, lease_expires_at = null
  where id = p_scan_id returning * into result;
  if result.id is null then raise exception 'scan not found'; end if;
  insert into public.audit_events (workspace_id, event_type, details) values (result.workspace_id, 'scan_completed', jsonb_build_object('scan_id', result.id, 'status', p_status, 'findings', result.finding_count));
  return result;
end;
$$;

create or replace function public.easyacr_purge_expired_scans()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  delete from public.scan_jobs where expires_at <= now(); get diagnostics affected = row_count; return affected;
end;
$$;

grant execute on function public.bootstrap_personal_workspace() to authenticated;
grant execute on function public.easyacr_bootstrap_workspace(uuid, text) to service_role;
grant execute on function public.easyacr_accept_terms(uuid, text) to service_role;
grant execute on function public.easyacr_enqueue_scan(uuid, text, integer) to service_role;
grant execute on function public.easyacr_claim_next_scan() to service_role;
grant execute on function public.easyacr_complete_scan(uuid, uuid, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.easyacr_purge_expired_scans() to service_role;
