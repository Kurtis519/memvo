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
  return (
    matchesRoute(pathname, '/onboarding') ||
    matchesRoute(pathname, '/signup') ||
    matchesRoute(pathname, '/login')
  );
}

export function getEntryTarget({ isAuthenticated, hasSeenOnboarding }: EntryRouteContext) {
  if (hasSeenOnboarding === null) {
    return null;
  }
  // Always send authenticated users to tabs — never to '/' which causes routing loops
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
  // Still loading auth or onboarding state — wait
  if (loading || hasSeenOnboarding === null) {
    return { ready: false, target: null };
  }

  // Authenticated — send to home feed if on a signed-out screen or root
  // NEVER redirect to '/' — that causes a routing loop back to onboarding
  if (isAuthenticated) {
    const needsRedirect = isSignedOutRoute(pathname) || pathname === '/';
    return {
      ready: true,
      target: needsRedirect ? '/(tabs)' : null,
    };
  }

  // Allow public utility routes without redirect
  if (isPublicUtilityRoute(pathname)) {
    return { ready: true, target: null };
  }

  // Not authenticated, never seen onboarding — go to onboarding
  if (!hasSeenOnboarding) {
    return {
      ready: true,
      target:
        matchesRoute(pathname, '/onboarding') || matchesRoute(pathname, '/signup')
          ? null
          : '/onboarding',
    };
  }

  // Not authenticated, has seen onboarding — go to login
  return {
    ready: true,
    target:
      matchesRoute(pathname, '/login') || matchesRoute(pathname, '/signup') ? null : '/login',
  };
}
