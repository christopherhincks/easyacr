import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseEnabled = Boolean(supabaseUrl && supabasePublishableKey);
let supabasePromise: Promise<SupabaseClient | null> | undefined;

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

export async function signOutOfSupabase() {
  const supabase = await getSupabase();
  if (supabase) await supabase.auth.signOut();
}
