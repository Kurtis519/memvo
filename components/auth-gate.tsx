import * as SplashScreen from 'expo-splash-screen';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

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
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Text style={styles.loadingEyebrow}>Memvo</Text>
            <Text style={styles.loadingTitle}>Loading your workspace</Text>
            <Text style={styles.loadingBody}>
              We are checking onboarding and account state so you land on the right screen without a flash.
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 384,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  loadingEyebrow: {
    color: '#0F6E56',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3.3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  loadingTitle: {
    marginTop: 16,
    color: '#1A1A1A',
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingBody: {
    marginTop: 12,
    color: '#555555',
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
  },
});
