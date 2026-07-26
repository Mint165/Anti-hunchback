import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// One-time diagnostic log so the user (and support) can immediately
// tell from the DevTools console which auth backend the app is using.
// Without this, "no rows in Supabase + can't log in cross-device" was
// hard to root-cause: the app silently falls back to local-only mode
// (oliver_users localStorage) when env vars are missing, which looks
// identical to a Supabase-side misconfiguration from the user's POV.
if (typeof window !== 'undefined') {
  if (isSupabaseConfigured) {
    console.info(
      `[auth] Supabase mode active. URL: ${supabaseUrl!.replace(/^(https?:\/\/[^/]+).*$/, '$1')}`,
    );
  } else {
    console.warn(
      '[auth] Local-only mode active (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing or empty). ' +
        'Accounts are stored in localStorage `oliver_users` only — cross-device login is NOT possible. ' +
        'Add the credentials to .env and rebuild to enable Supabase auth.',
    );
  }
}
