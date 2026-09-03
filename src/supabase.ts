import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseEnabled = Boolean(supabaseUrl && supabasePublishableKey);
let supabasePromise: Promise<SupabaseClient | null> | undefined;

export type WorkspaceProfile = {
  email: string | null;
  displayName: string | null;
  workspaceName: string | null;
  onboardingCompletedAt: string | null;
};

async function getSupabase() {
  if (!supabaseEnabled) return null;
  supabasePromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(supabaseUrl!, supabasePublishableKey!));
  return supabasePromise;
}

export async function sendMagicLink(email: string) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase sign-in is not configured.');
  // A magic link is the account entry point: a first-time verified email may
  // create a personal workspace, while returning users simply sign in.
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/tools` } });
  if (error) throw error;
}

export async function exchangeSupabaseSession() {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) return false;
  const response = await fetch('/api/v1/session', { method: 'POST', credentials: 'same-origin', headers: { authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error('Could not create an easyACR session.');
  return true;
}

export async function getSupabaseAccountEmail() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.email ?? null;
}

export async function getWorkspaceProfile(): Promise<WorkspaceProfile | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;
  const [profileResult, workspaceResult] = await Promise.all([
    supabase.from("user_profiles").select("email, display_name, onboarding_completed_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("workspaces").select("name").eq("owner_user_id", user.id).maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (workspaceResult.error) throw workspaceResult.error;
  return {
    email: profileResult.data?.email ?? user.email ?? null,
    displayName: profileResult.data?.display_name ?? null,
    workspaceName: workspaceResult.data?.name ?? null,
    onboardingCompletedAt: profileResult.data?.onboarding_completed_at ?? null,
  };
}

export async function saveWorkspaceProfile({ displayName, workspaceName, completeOnboarding = false }: { displayName: string; workspaceName: string; completeOnboarding?: boolean; }) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase profile storage is not configured.");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in before updating your workspace.");
  const trimmedName = displayName.trim();
  const trimmedWorkspace = workspaceName.trim();
  if (!trimmedName || trimmedName.length > 120 || !trimmedWorkspace || trimmedWorkspace.length > 120) throw new Error("Use names from 1 to 120 characters.");
  const profileUpdate: Record<string, string> = { display_name: trimmedName };
  if (completeOnboarding) profileUpdate.onboarding_completed_at = new Date().toISOString();
  const [profileResult, workspaceResult] = await Promise.all([
    supabase.from("user_profiles").update(profileUpdate).eq("user_id", user.id),
    supabase.from("workspaces").update({ name: trimmedWorkspace }).eq("owner_user_id", user.id),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (workspaceResult.error) throw workspaceResult.error;
  return getWorkspaceProfile();
}

export async function signOutOfSupabase() {
  const supabase = await getSupabase();
  if (supabase) await supabase.auth.signOut();
}
