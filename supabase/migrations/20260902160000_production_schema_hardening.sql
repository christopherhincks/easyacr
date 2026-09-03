-- Production-facing schema hardening for the public easyACR beta.
-- This migration follows 20260902_initial_self_service.sql. It preserves the
-- initial RPC API while moving terms acceptance and operational ownership to
-- the individual authenticated user.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text check (display_name is null or char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null check (char_length(version) between 1 and 64),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

create table if not exists public.target_authorizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  origin text not null check (origin ~ '^https://[^/]+$' and char_length(origin) <= 2048),
  declared_by uuid not null references auth.users(id) on delete cascade,
  declaration text not null default 'I own or am authorized to scan this public website.' check (char_length(declaration) between 1 and 500),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (workspace_id, origin)
);

create table if not exists public.scan_job_events (
  id bigint generated always as identity primary key,
  scan_job_id uuid not null references public.scan_jobs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 96),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- A signed browser cookie is the primary session. This table is intentionally
-- narrow: it retains only server-side revocation state, never bearer tokens.
create table if not exists public.webmcp_session_revocations (
  session_id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz not null default now(),
  reason text not null default 'user_sign_out' check (char_length(reason) <= 96)
);

alter table public.workspaces add column if not exists scan_quota_per_day integer not null default 3 check (scan_quota_per_day between 1 and 100);
alter table public.workspaces add column if not exists scan_page_limit integer not null default 10 check (scan_page_limit between 1 and 10);
alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check check (role in ('owner', 'admin', 'member', 'viewer'));

create index if not exists target_authorizations_active_origin on public.target_authorizations (workspace_id, origin) where revoked_at is null;
create index if not exists scan_job_events_job_created_at on public.scan_job_events (scan_job_id, created_at desc);
create index if not exists webmcp_session_revocations_expiry on public.webmcp_session_revocations (expires_at);

-- Use a definer function to avoid recursive RLS checks on workspace_members.
create or replace function public.easyacr_is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.easyacr_is_workspace_admin(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

alter table public.user_profiles enable row level security;
alter table public.user_terms_acceptances enable row level security;
alter table public.target_authorizations enable row level security;
alter table public.scan_job_events enable row level security;
alter table public.webmcp_session_revocations enable row level security;

drop policy if exists "members read workspaces" on public.workspaces;
create policy "members read workspaces" on public.workspaces for select to authenticated
  using (public.easyacr_is_workspace_member(id));

drop policy if exists "members read memberships" on public.workspace_members;
create policy "members read memberships" on public.workspace_members for select to authenticated
  using (public.easyacr_is_workspace_member(workspace_id));

drop policy if exists "members read scan jobs" on public.scan_jobs;
create policy "members read scan jobs" on public.scan_jobs for select to authenticated
  using (public.easyacr_is_workspace_member(workspace_id));

drop policy if exists "members read scan findings" on public.scan_findings;
create policy "members read scan findings" on public.scan_findings for select to authenticated
  using (exists (select 1 from public.scan_jobs j where j.id = scan_job_id and public.easyacr_is_workspace_member(j.workspace_id)));

create policy "users read own profile" on public.user_profiles for select to authenticated using (user_id = auth.uid());
create policy "users update own profile" on public.user_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own terms" on public.user_terms_acceptances for select to authenticated using (user_id = auth.uid());
create policy "members read target authorizations" on public.target_authorizations for select to authenticated using (public.easyacr_is_workspace_member(workspace_id));
create policy "admins manage target authorizations" on public.target_authorizations for all to authenticated using (public.easyacr_is_workspace_admin(workspace_id)) with check (public.easyacr_is_workspace_admin(workspace_id));
create policy "members read scan job events" on public.scan_job_events for select to authenticated using (public.easyacr_is_workspace_member(workspace_id));

-- Update bootstrap to preserve an account profile and return the caller's own
-- acceptance record, not an organization-wide acceptance by a different user.
create or replace function public.easyacr_bootstrap_workspace(p_user_id uuid, p_email text)
returns table (workspace_id uuid, terms_accepted_at timestamptz, terms_version text)
language plpgsql security definer set search_path = public as $$
declare workspace public.workspaces; acceptance public.user_terms_acceptances;
begin
  insert into public.user_profiles (user_id, email)
  values (p_user_id, nullif(left(p_email, 320), ''))
  on conflict (user_id) do update set email = coalesce(excluded.email, public.user_profiles.email), updated_at = now();
  insert into public.workspaces (name, owner_user_id)
  values (coalesce(nullif(left(split_part(coalesce(p_email, ''), '@', 1), 120), ''), 'My workspace'), p_user_id)
  on conflict (owner_user_id) do update set name = public.workspaces.name
  returning * into workspace;
  insert into public.workspace_members (workspace_id, user_id, role) values (workspace.id, p_user_id, 'owner') on conflict do nothing;
  select * into acceptance from public.user_terms_acceptances where user_id = p_user_id and version = '2026-09-02';
  insert into public.audit_events (user_id, workspace_id, event_type) values (p_user_id, workspace.id, 'workspace_bootstrapped');
  return query select workspace.id, acceptance.accepted_at, acceptance.version;
end;
$$;

create or replace function public.easyacr_accept_terms(p_user_id uuid, p_version text)
returns table (workspace_id uuid, accepted_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare workspace public.workspaces; acceptance public.user_terms_acceptances;
begin
  if p_version <> '2026-09-02' then raise exception 'unsupported terms version'; end if;
  select * into workspace from public.workspaces where owner_user_id = p_user_id;
  if workspace.id is null then raise exception 'workspace missing'; end if;
  insert into public.user_terms_acceptances (user_id, version) values (p_user_id, p_version)
  on conflict (user_id, version) do update set accepted_at = excluded.accepted_at
  returning * into acceptance;
  update public.workspaces set terms_accepted_at = acceptance.accepted_at, terms_version = p_version where id = workspace.id;
  insert into public.audit_events (user_id, workspace_id, event_type, details) values (p_user_id, workspace.id, 'terms_accepted', jsonb_build_object('version', p_version));
  return query select workspace.id, acceptance.accepted_at;
end;
$$;

-- Creating an authorization record is deliberately coupled to an accepted
-- public-scan terms version. This provides a per-origin audit trail without
-- ever asking users to submit site credentials or verification tokens.
create or replace function public.easyacr_authorize_target(p_user_id uuid, p_target_url text)
returns public.target_authorizations
language plpgsql security definer set search_path = public as $$
declare workspace public.workspaces; result public.target_authorizations; target_origin text;
begin
  select * into workspace from public.workspaces where owner_user_id = p_user_id;
  if workspace.id is null then raise exception 'workspace missing'; end if;
  if not exists (select 1 from public.user_terms_acceptances where user_id = p_user_id and version = '2026-09-02') then raise exception 'terms acceptance required'; end if;
  target_origin := regexp_replace(p_target_url, '^(https://[^/]+).*$','\1');
  if target_origin !~ '^https://[^/]+$' then raise exception 'invalid target origin'; end if;
  insert into public.target_authorizations (workspace_id, origin, declared_by)
  values (workspace.id, target_origin, p_user_id)
  on conflict (workspace_id, origin) do update set declared_by = excluded.declared_by, declaration = excluded.declaration, created_at = now(), revoked_at = null
  returning * into result;
  insert into public.audit_events (user_id, workspace_id, event_type, details)
  values (p_user_id, workspace.id, 'target_authorized', jsonb_build_object('origin', target_origin));
  return result;
end;
$$;

create or replace function public.easyacr_enqueue_scan(p_user_id uuid, p_target_url text, p_page_limit integer)
returns public.scan_jobs
language plpgsql security definer set search_path = public as $$
declare workspace public.workspaces; result public.scan_jobs; daily_count integer; target_origin text;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select * into workspace from public.workspaces where owner_user_id = p_user_id;
  if workspace.id is null then raise exception 'workspace missing'; end if;
  if not exists (select 1 from public.user_terms_acceptances where user_id = p_user_id and version = '2026-09-02') then raise exception 'terms acceptance required'; end if;
  if p_page_limit < 1 or p_page_limit > workspace.scan_page_limit then raise exception 'page limit exceeds workspace policy'; end if;
  target_origin := regexp_replace(p_target_url, '^(https://[^/]+).*$','\1');
  if not exists (select 1 from public.target_authorizations where workspace_id = workspace.id and origin = target_origin and revoked_at is null) then raise exception 'target authorization required'; end if;
  select count(*) into daily_count from public.scan_jobs where requested_by = p_user_id and created_at >= date_trunc('day', now());
  if daily_count >= workspace.scan_quota_per_day then raise exception 'daily scan quota reached'; end if;
  insert into public.scan_jobs (workspace_id, requested_by, target_url, status, page_limit, terms_version)
  values (workspace.id, p_user_id, p_target_url, 'queued', p_page_limit, '2026-09-02') returning * into result;
  insert into public.scan_job_events (scan_job_id, workspace_id, actor_user_id, event_type, details)
  values (result.id, workspace.id, p_user_id, 'queued', jsonb_build_object('target_origin', target_origin));
  insert into public.audit_events (user_id, workspace_id, event_type, details)
  values (p_user_id, workspace.id, 'scan_queued', jsonb_build_object('scan_id', result.id, 'host', regexp_replace(target_origin, '^https://', '')));
  return result;
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
  update public.scan_jobs set status = p_status, pages_crawled = p_pages_crawled, finding_count = jsonb_array_length(p_findings), errors = p_errors,
    completed_at = now(), lease_token = null, lease_expires_at = null where id = p_scan_id returning * into result;
  insert into public.scan_job_events (scan_job_id, workspace_id, event_type, details)
  values (result.id, result.workspace_id, 'completed', jsonb_build_object('status', p_status, 'findings', result.finding_count, 'pages', p_pages_crawled));
  insert into public.audit_events (workspace_id, event_type, details)
  values (result.workspace_id, 'scan_completed', jsonb_build_object('scan_id', result.id, 'status', p_status, 'findings', result.finding_count));
  return result;
end;
$$;

create or replace function public.easyacr_purge_expired_scans()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  delete from public.webmcp_session_revocations where expires_at <= now();
  delete from public.scan_jobs where expires_at <= now(); get diagnostics affected = row_count; return affected;
end;
$$;

grant execute on function public.easyacr_is_workspace_member(uuid) to authenticated;
grant execute on function public.easyacr_is_workspace_admin(uuid) to authenticated;
grant execute on function public.easyacr_bootstrap_workspace(uuid, text) to service_role;
grant execute on function public.easyacr_accept_terms(uuid, text) to service_role;
grant execute on function public.easyacr_authorize_target(uuid, text) to service_role;
grant execute on function public.easyacr_enqueue_scan(uuid, text, integer) to service_role;
grant execute on function public.easyacr_complete_scan(uuid, uuid, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.easyacr_purge_expired_scans() to service_role;
