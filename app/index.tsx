import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { readHasSeenOnboarding, recoverPendingSignupTransition } from '@/lib/memvo-auth-flow';
import { getEntryTarget } from '@/lib/memvo-auth-routing';

export default function IndexRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [shouldResumeSignup, setShouldResumeSignup] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([readHasSeenOnboarding(), recoverPendingSignupTransition()])
      .then(([value, recovery]) => {
        if (isMounted) {
          setHasSeenOnboarding(value);
          setShouldResumeSignup(recovery.shouldResumeSignup);

          if (recovery.clearedCorruptedState) {
            console.warn('Memvo cleared an interrupted onboarding transition before startup routing.');
          }
        }
      })
      .catch((error) => {
        console.error('Memvo startup state recovery failed:', error);
        if (isMounted) {
          setHasSeenOnboarding(false);
          setShouldResumeSignup(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const target = shouldResumeSignup && !isAuthenticated
      ? '/signup'
      : getEntryTarget({
          isAuthenticated,
          hasSeenOnboarding,
        });

    if (!target) {
      return;
    }

    console.log('Memvo startup navigation target', {
      isAuthenticated,
      hasSeenOnboarding,
      shouldResumeSignup,
      target,
    });

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.replace(target);
        return;
      }

      router.replace(target as Parameters<typeof router.replace>[0]);
    } catch (error) {
      console.error('Memvo startup navigation error:', error);
    }
  }, [hasSeenOnboarding, isAuthenticated, router, shouldResumeSignup]);

  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <Text style={styles.loadingEyebrow}>Memvo</Text>
        <Text style={styles.loadingTitle}>Preparing your space</Text>
        <Text style={styles.loadingBody}>
          We are checking whether to continue onboarding, return you to sign in, or open your library.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    flex: 1,
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
