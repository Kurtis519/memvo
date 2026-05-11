export type AuthRouteDecision = {
  ready: boolean;
  target: string | null;
};

export type EntryRouteContext = {
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean | null;
};

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isPublicUtilityRoute(pathname: string) {
  return matchesRoute(pathname, '/join') || matchesRoute(pathname, '/oauth/callback');
}

function isSignedOutRoute(pathname: string) {
  return matchesRoute(pathname, '/onboarding') || matchesRoute(pathname, '/signup') || matchesRoute(pathname, '/login');
}

export function getEntryTarget({ isAuthenticated, hasSeenOnboarding }: EntryRouteContext) {
  if (hasSeenOnboarding === null) {
    return null;
  }

  return isAuthenticated ? '/(tabs)' : hasSeenOnboarding ? '/login' : '/onboarding';
}

export function resolveAuthGateTarget({
  pathname,
  isAuthenticated,
  loading,
  hasSeenOnboarding,
}: {
  pathname: string;
  isAuthenticated: boolean;
  loading: boolean;
  hasSeenOnboarding: boolean | null;
}): AuthRouteDecision {
  if (loading || hasSeenOnboarding === null) {
    return { ready: false, target: null };
  }

  if (isAuthenticated) {
    return {
      ready: true,
      target: isSignedOutRoute(pathname) ? '/' : null,
    };
  }

  if (isPublicUtilityRoute(pathname)) {
    return { ready: true, target: null };
  }

  if (!hasSeenOnboarding) {
    return {
      ready: true,
      target: matchesRoute(pathname, '/onboarding') || matchesRoute(pathname, '/signup') ? null : '/onboarding',
    };
  }

  return {
    ready: true,
    target: matchesRoute(pathname, '/login') || matchesRoute(pathname, '/signup') ? null : '/login',
  };
}
