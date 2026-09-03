-- Persist the minimum onboarding state needed for the authenticated product.
-- This intentionally does not introduce plans, billing, schedules, or ACR
-- authoring; those require separate durable services.

alter table public.user_profiles
  add column if not exists onboarding_completed_at timestamptz;

drop policy if exists "owners update own workspace" on public.workspaces;
create policy "owners update own workspace" on public.workspaces
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
