import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

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
    <View className="flex-1 items-center justify-center bg-background px-8">
      <View className="w-full max-w-sm rounded-[28px] border border-border bg-surface px-6 py-8">
        <Text className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-primary">Memvo</Text>
        <Text className="mt-4 text-center text-2xl font-semibold text-foreground">Preparing your space</Text>
        <Text className="mt-3 text-center text-sm leading-6 text-muted">
          We are checking whether to continue onboarding, return you to sign in, or open your library.
        </Text>
      </View>
    </View>
  );
}
