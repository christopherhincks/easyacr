-- The per-user daily quota protects individual accounts. This separate cap
-- prevents many new accounts from saturating the single public-beta worker.
-- Keep the value deliberately conservative until production capacity has been
-- observed under monitoring.

create or replace function public.easyacr_enqueue_scan(p_user_id uuid, p_target_url text, p_page_limit integer)
returns public.scan_jobs
language plpgsql security definer set search_path = public as $$
declare workspace public.workspaces; result public.scan_jobs; daily_count integer; active_count integer; target_origin text;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  perform pg_advisory_xact_lock(hashtext('easyacr-public-beta-global-scan-queue'));
  select * into workspace from public.workspaces where owner_user_id = p_user_id;
  if workspace.id is null then raise exception 'workspace missing'; end if;
  if not exists (select 1 from public.user_terms_acceptances where user_id = p_user_id and version = '2026-09-02') then raise exception 'terms acceptance required'; end if;
  if p_page_limit < 1 or p_page_limit > workspace.scan_page_limit then raise exception 'page limit exceeds workspace policy'; end if;
  target_origin := regexp_replace(p_target_url, '^(https://[^/]+).*$','\1');
  if not exists (select 1 from public.target_authorizations where workspace_id = workspace.id and origin = target_origin and revoked_at is null) then raise exception 'target authorization required'; end if;
  select count(*) into daily_count from public.scan_jobs where requested_by = p_user_id and created_at >= date_trunc('day', now());
  if daily_count >= workspace.scan_quota_per_day then raise exception 'daily scan quota reached'; end if;
  select count(*) into active_count from public.scan_jobs where status in ('queued', 'running') and expires_at > now();
  if active_count >= 25 then raise exception 'public beta scan queue is at capacity'; end if;
  insert into public.scan_jobs (workspace_id, requested_by, target_url, status, page_limit, terms_version)
  values (workspace.id, p_user_id, p_target_url, 'queued', p_page_limit, '2026-09-02') returning * into result;
  insert into public.scan_job_events (scan_job_id, workspace_id, actor_user_id, event_type, details)
  values (result.id, workspace.id, p_user_id, 'queued', jsonb_build_object('target_origin', target_origin));
  insert into public.audit_events (user_id, workspace_id, event_type, details)
  values (p_user_id, workspace.id, 'scan_queued', jsonb_build_object('scan_id', result.id, 'host', regexp_replace(target_origin, '^https://', '')));
  return result;
end;
$$;

grant execute on function public.easyacr_enqueue_scan(uuid, text, integer) to service_role;
