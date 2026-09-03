-- Immutable, automated evidence artifacts. These are intentionally not ACRs:
-- they snapshot only the completed scan's automated metrics and retain the
-- human-review warning in the stored artifact itself.

create table if not exists public.scan_evidence_artifacts (
  id uuid primary key default gen_random_uuid(),
  scan_job_id uuid not null references public.scan_jobs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  template text not null check (template in ('WCAG_2_2')),
  state text not null default 'automated_draft' check (state = 'automated_draft'),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (scan_job_id, template)
);

create index if not exists scan_evidence_artifacts_owner_lookup
  on public.scan_evidence_artifacts (scan_job_id, created_by, template);

alter table public.scan_evidence_artifacts enable row level security;

create policy "members read scan evidence artifacts" on public.scan_evidence_artifacts
  for select to authenticated
  using (public.easyacr_is_workspace_member(workspace_id));

create or replace function public.easyacr_create_draft_evidence(
  p_user_id uuid,
  p_scan_id uuid,
  p_template text
)
returns public.scan_evidence_artifacts
language plpgsql security definer set search_path = public as $$
declare
  job public.scan_jobs;
  result public.scan_evidence_artifacts;
  impact_counts jsonb;
begin
  if p_template <> 'WCAG_2_2' then raise exception 'unsupported evidence template'; end if;

  -- The initial public beta exposes a personal workspace. Require the user
  -- who requested the scan, not merely another workspace member, so a WebMCP
  -- session cannot mint artifacts from somebody else's scan.
  select * into job from public.scan_jobs
  where id = p_scan_id and requested_by = p_user_id;
  if job.id is null then raise exception 'scan not found'; end if;
  if job.status not in ('completed', 'partial') then raise exception 'scan is not ready for evidence'; end if;

  select coalesce(jsonb_object_agg(impact, count), '{}'::jsonb) into impact_counts
  from (
    select impact, count(*)::integer as count
    from public.scan_findings
    where scan_job_id = job.id
    group by impact
  ) as grouped;

  insert into public.scan_evidence_artifacts (
    scan_job_id, workspace_id, created_by, template, content
  ) values (
    job.id, job.workspace_id, p_user_id, p_template,
    jsonb_build_object(
      'schemaVersion', '1.0',
      'kind', 'automated_scan_evidence',
      'scanId', job.id,
      'target', job.target_url,
      'scanStatus', job.status,
      'generatedAt', now(),
      'template', p_template,
      'automatedEvidence', jsonb_build_object(
        'pagesCrawled', job.pages_crawled,
        'findingsByImpact', impact_counts,
        'totalFindings', job.finding_count
      ),
      'humanReviewRequired', true,
      'warning', 'This is automated draft evidence, not an accessibility conformance determination or completed ACR. Human review is required.'
    )
  ) on conflict (scan_job_id, template) do nothing
  returning * into result;

  if result.id is null then
    select * into result from public.scan_evidence_artifacts
    where scan_job_id = job.id and template = p_template;
  else
    insert into public.scan_job_events (scan_job_id, workspace_id, actor_user_id, event_type, details)
    values (job.id, job.workspace_id, p_user_id, 'automated_evidence_created', jsonb_build_object('artifact_id', result.id, 'template', p_template));
    insert into public.audit_events (user_id, workspace_id, event_type, details)
    values (p_user_id, job.workspace_id, 'automated_evidence_created', jsonb_build_object('artifact_id', result.id, 'scan_id', job.id, 'template', p_template));
  end if;
  return result;
end;
$$;

grant execute on function public.easyacr_create_draft_evidence(uuid, uuid, text) to service_role;
