import * as SplashScreen from 'expo-splash-screen';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { readHasSeenOnboarding } from '@/lib/memvo-auth-flow';
import { resolveAuthGateTarget } from '@/lib/memvo-auth-routing';

function readInitialOnboardingState() {
  try {
<<<<<<< Updated upstream
=======
    // On Android, window exists but localStorage does not — must check both
>>>>>>> Stashed changes
    if (
      typeof window === 'undefined' ||
      typeof window.localStorage === 'undefined' ||
      window.localStorage === null
    ) {
      return null;
    }

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

<<<<<<< Updated upstream
=======
  // Return null not false — null means unknown, false means definitely not seen
>>>>>>> Stashed changes
  return null;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, loading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(
    () => readInitialOnboardingState(),
  );
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
          // Use null not false — unknown state, let index.tsx decide
          setHasSeenOnboarding(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const routeDecision = useMemo(
    () =>
      resolveAuthGateTarget({
        pathname,
        isAuthenticated,
        loading,
        hasSeenOnboarding,
      }),
    [hasSeenOnboarding, isAuthenticated, loading, pathname],
  );

  useEffect(() => {
    if (!routeDecision.ready || !rootNavigationState?.key) {
      return;
    }

    if (routeDecision.target && routeDecision.target !== pathname) {
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

  const shouldShowLoadingShell =
    routeDecision.target !== null && routeDecision.target !== pathname;

  return (
    <>
      {children}
      {shouldShowLoadingShell ? (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Text style={styles.loadingEyebrow}>Memvo</Text>
            <Text style={styles.loadingTitle}>Loading your workspace</Text>
            <Text style={styles.loadingBody}>
              We are checking onboarding and account state so you land on the right screen without a
              flash.
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
