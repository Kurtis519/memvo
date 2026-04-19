import { useCallback, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type UseAuthOptions = {
  autoFetch?: boolean;
};

type AuthUser = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
};

function mapSupabaseUser(): AuthUser | null {
  return null;
}

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isSupabaseConfigured) {
        setUser(null);
        return;
      }

      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw userError;
      }

      const authUser = data.user;
      if (!authUser) {
        setUser(null);
        return;
      }

      const identity = authUser.identities?.[0];
      setUser({
        id: authUser.id,
        openId: authUser.id,
        name:
          (authUser.user_metadata?.full_name as string | undefined) ??
          (authUser.user_metadata?.name as string | undefined) ??
          null,
        email: authUser.email ?? null,
        loginMethod: identity?.provider ?? authUser.app_metadata?.provider ?? null,
        lastSignedIn: new Date(authUser.last_sign_in_at ?? authUser.created_at ?? Date.now()),
      });
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to fetch user');
      setError(nextError);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (isSupabaseConfigured) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          throw signOutError;
        }
      }
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to sign out');
      setError(nextError);
      throw nextError;
    } finally {
      setUser(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }

    void fetchUser();

    if (!isSupabaseConfigured) {
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user;
      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const identity = authUser.identities?.[0];
      setUser({
        id: authUser.id,
        openId: authUser.id,
        name:
          (authUser.user_metadata?.full_name as string | undefined) ??
          (authUser.user_metadata?.name as string | undefined) ??
          null,
        email: authUser.email ?? null,
        loginMethod: identity?.provider ?? authUser.app_metadata?.provider ?? null,
        lastSignedIn: new Date(authUser.last_sign_in_at ?? authUser.created_at ?? Date.now()),
      });
      setLoading(false);
      setError(null);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
