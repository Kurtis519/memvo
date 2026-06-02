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

type AuthSnapshot = {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
};

type AuthListener = (snapshot: AuthSnapshot) => void;

const authListeners = new Set<AuthListener>();
let authSnapshot: AuthSnapshot = {
  user: null,
  loading: true,
  error: null,
};
let authBootstrapPromise: Promise<void> | null = null;
let authStateSubscription: { unsubscribe: () => void } | null = null;

function mapSupabaseUser(authUser: {
  id: string;
  email?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  identities?: Array<{ provider?: string | null }>;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
} | null): AuthUser | null {
  if (!authUser) {
    return null;
  }

  const metadata = authUser.user_metadata ?? {};
  const appMetadata = authUser.app_metadata ?? {};
  const identity = authUser.identities?.[0];

  return {
    id: authUser.id,
    openId: authUser.id,
    name:
      (typeof metadata.full_name === 'string' ? metadata.full_name : undefined) ??
      (typeof metadata.name === 'string' ? metadata.name : undefined) ??
      null,
    email: authUser.email ?? null,
    loginMethod:
      (typeof identity?.provider === 'string' ? identity.provider : undefined) ??
      (typeof appMetadata.provider === 'string' ? appMetadata.provider : undefined) ??
      null,
    lastSignedIn: new Date(authUser.last_sign_in_at ?? authUser.created_at ?? Date.now()),
  };
}

function emitAuthSnapshot(partial?: Partial<AuthSnapshot>) {
  authSnapshot = {
    ...authSnapshot,
    ...partial,
  };

  for (const listener of authListeners) {
    listener(authSnapshot);
  }
}

async function refreshSharedAuthState() {
  try {
    emitAuthSnapshot({ loading: true, error: null });

    if (!isSupabaseConfigured) {
      emitAuthSnapshot({ user: null, loading: false, error: null });
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    emitAuthSnapshot({
      user: mapSupabaseUser(session?.user ?? null),
      loading: false,
      error: null,
    });
  } catch (error) {
    emitAuthSnapshot({
      user: null,
      loading: false,
      error: error instanceof Error ? error : new Error('Failed to fetch user'),
    });
  }
}

function ensureSharedBootstrap() {
  if (!authBootstrapPromise) {
    authBootstrapPromise = refreshSharedAuthState().finally(() => {
      authBootstrapPromise = null;
    });
  }

  if (!authStateSubscription && isSupabaseConfigured) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      emitAuthSnapshot({
        user: mapSupabaseUser(session?.user ?? null),
        loading: false,
        error: null,
      });
    });

    authStateSubscription = data.subscription;
  }

  return authBootstrapPromise ?? Promise.resolve();
}

function subscribeToAuth(listener: AuthListener) {
  authListeners.add(listener);
  listener(authSnapshot);

  return () => {
    authListeners.delete(listener);
  };
}

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [state, setState] = useState<AuthSnapshot>(authSnapshot);

  useEffect(() => {
    const unsubscribe = subscribeToAuth(setState);

    if (autoFetch) {
      void ensureSharedBootstrap();
    } else {
      emitAuthSnapshot({ loading: false });
    }

    return unsubscribe;
  }, [autoFetch]);

  const refresh = useCallback(async () => {
    await refreshSharedAuthState();
  }, []);

  const logout = useCallback(async () => {
    try {
      emitAuthSnapshot({ loading: true, error: null });

      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      }

      emitAuthSnapshot({ user: null, loading: false, error: null });
    } catch (error) {
      const nextError = error instanceof Error ? error : new Error('Failed to sign out');
      emitAuthSnapshot({ user: null, loading: false, error: nextError });
      throw nextError;
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(state.user), [state.user]);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated,
    refresh,
    logout,
  };
}
