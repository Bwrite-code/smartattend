import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Profile } from '../types';
import { backend } from '../services';

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<Profile>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await backend.getCurrentProfile();
    setProfile(p);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const p = await backend.signIn(email, password);
    setProfile(p);
    return p;
  }, []);

  const signOut = useCallback(async () => {
    await backend.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ profile, loading, refresh, signIn, signOut }),
    [profile, loading, refresh, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function homeForRole(role: Profile['role']): string {
  return role === 'admin' ? '/admin' : role === 'lecturer' ? '/lecturer' : '/student';
}
