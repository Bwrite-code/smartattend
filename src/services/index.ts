import { supabaseConfigured } from '../lib/supabase';
import { MockBackend } from './mockBackend';
import { SupabaseBackend } from './supabaseBackend';
import type { Backend } from './types';

// Backend selection (doc §5, §33):
//   VITE_BACKEND_MODE=mock      → demo backend with seeded sample data
//   VITE_BACKEND_MODE=supabase  → real Supabase project
// If VITE_BACKEND_MODE is unset, Supabase is used automatically when its
// environment variables are present.

const envMode = (import.meta.env.VITE_BACKEND_MODE as string | undefined)?.toLowerCase();

export const backendMode: 'mock' | 'supabase' =
  envMode === 'supabase'
    ? 'supabase'
    : envMode === 'mock'
      ? 'mock'
      : supabaseConfigured
        ? 'supabase'
        : 'mock';

export const backend: Backend = backendMode === 'supabase' ? new SupabaseBackend() : new MockBackend();

/** Quick-fill accounts shown on the login page in demo mode. */
export const DEMO_ACCOUNTS = [
  { role: 'admin', label: 'Admin', email: 'admin@smartattend.test', password: 'demo1234' },
  { role: 'lecturer', label: 'Lecturer', email: 'lecturer@smartattend.test', password: 'demo1234' },
  { role: 'student', label: 'Student', email: 'student@smartattend.test', password: 'demo1234' },
] as const;

export type { Backend } from './types';
