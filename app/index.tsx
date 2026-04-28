import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { readHasSeenOnboarding } from '@/lib/memvo-auth-flow';

export default function IndexRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (hasSeenOnboarding === null) {
      return;
    }

    const target = isAuthenticated ? '/(tabs)' : hasSeenOnboarding ? '/login' : '/onboarding';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.replace(target);
      return;
    }

    router.replace(target);
  }, [hasSeenOnboarding, isAuthenticated, router]);

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
