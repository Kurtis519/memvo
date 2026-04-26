import * as SplashScreen from 'expo-splash-screen';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { readHasSeenOnboarding } from '@/lib/memvo-auth-flow';

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function readInitialOnboardingState() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem('memvo_onboarding_seen_v1');
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  } catch (_error) {
    return null;
  }

  return false;
}

function isPublicUtilityRoute(pathname: string) {
  return matchesRoute(pathname, '/join') || matchesRoute(pathname, '/oauth/callback');
}

function isSignedOutRoute(pathname: string) {
  return matchesRoute(pathname, '/onboarding') || matchesRoute(pathname, '/signup') || matchesRoute(pathname, '/login');
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, loading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(() => readInitialOnboardingState());
  const splashHiddenRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    readHasSeenOnboarding()
      .then((value) => {
        if (isMounted) {
          setHasSeenOnboarding(value);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasSeenOnboarding(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const routeDecision = useMemo(() => {
    if (loading || hasSeenOnboarding === null) {
      return { ready: false, target: null as string | null };
    }

    if (isAuthenticated) {
      const shouldRedirectToApp = isSignedOutRoute(pathname);
      return {
        ready: true,
        target: shouldRedirectToApp ? '/' : null,
      };
    }

    if (isPublicUtilityRoute(pathname)) {
      return { ready: true, target: null as string | null };
    }

    if (!hasSeenOnboarding) {
      const shouldStayOnOnboarding = matchesRoute(pathname, '/onboarding');
      return {
        ready: true,
        target: shouldStayOnOnboarding ? null : '/onboarding',
      };
    }

    const shouldStaySignedOut = matchesRoute(pathname, '/login') || matchesRoute(pathname, '/signup');
      return {
        ready: true,
        target: shouldStaySignedOut ? null : '/login',
      };

  }, [hasSeenOnboarding, isAuthenticated, loading, pathname]);

  useEffect(() => {
    if (!routeDecision.ready || !rootNavigationState?.key) {
      return;
    }

    if (pathname !== '/' && routeDecision.target && routeDecision.target !== pathname) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.replace(routeDecision.target);
      } else {
        router.replace(routeDecision.target as Parameters<typeof router.replace>[0]);
      }
      return;
    }

    if (!splashHiddenRef.current) {
      splashHiddenRef.current = true;
      void SplashScreen.hideAsync().catch(() => {
        splashHiddenRef.current = true;
      });
    }
  }, [pathname, rootNavigationState?.key, routeDecision, router]);

  const shouldShowLoadingShell = pathname !== '/' && routeDecision.target !== null && routeDecision.target !== pathname;

  return (
    <>
      {children}
      {shouldShowLoadingShell ? (
        <View className="absolute inset-0 items-center justify-center bg-background px-8">
          <View className="w-full max-w-sm rounded-[28px] border border-border bg-surface px-6 py-8">
            <Text className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Memvo
            </Text>
            <Text className="mt-4 text-center text-2xl font-semibold text-foreground">Loading your workspace</Text>
            <Text className="mt-3 text-center text-sm leading-6 text-muted">
              We are checking onboarding and account state so you land on the right screen without a flash.
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );
}
