import { createClient } from '@supabase/supabase-js';

// Public (anon) credentials only — the service_role key must NEVER live in the
// frontend (doc §37). Privileged operations go through the manage-user Edge
// Function and security-definer SQL functions instead.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

/**
 * In mock mode we still construct a client with placeholder values so the
 * module graph loads; it is never used unless Supabase mode is active.
 */
export const supabase = createClient(
  url ?? 'https://placeholder.invalid',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
