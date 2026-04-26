import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

import { ScreenContainer } from '@/components/screen-container';
import { useMemvo } from '@/lib/memvo-store';
import {
  getRevenueCatOfferings,
  hasRevenueCatProAccess,
  isRevenueCatConfigured,
  isRevenueCatPurchasingSupported,
  purchaseRevenueCatPackage,
} from '@/lib/revenuecat';

function buildContextMessage(trigger: string | undefined, featureName: string | undefined) {
  if (trigger === 'minutes') {
    return 'You have used your free minutes for this month. Upgrade to Pro to keep transcribing without interruptions.';
  }

  if (trigger === 'folders') {
    return 'You reached the free folder limit. Upgrade to Pro for unlimited folders and more room to organise every note.';
  }

  if (trigger === 'feature' && featureName) {
    return `${featureName} is part of Memvo Pro. Upgrade now to unlock it instantly.`;
  }

  return 'Upgrade when you need more transcription power, more languages, and more room for every recording.';
}

function getPackageLabel(selectedPackage: PurchasesPackage | null) {
  const packagePrice = selectedPackage?.product.priceString;
  if (packagePrice) {
    return `${packagePrice} / month`;
  }

  return '$8.99 / month';
}

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ trigger?: string; feature?: string }>();
  const { userProfile, refreshUserProfile } = useMemvo();
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const contextMessage = useMemo(
    () => buildContextMessage(params.trigger, typeof params.feature === 'string' ? params.feature : undefined),
    [params.feature, params.trigger],
  );

  useEffect(() => {
    let isMounted = true;

    const loadOfferings = async () => {
      if (!isRevenueCatConfigured() || !userProfile?.id || !isRevenueCatPurchasingSupported()) {
        return;
      }

      setIsLoadingOfferings(true);
      setLoadError(null);

      try {
        const nextOfferings = await getRevenueCatOfferings(userProfile.id);
        if (!isMounted || !nextOfferings) {
          return;
        }

        setOfferings(nextOfferings);
        setSelectedPackage(nextOfferings.current?.availablePackages?.[0] ?? null);
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load subscription options right now.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingOfferings(false);
        }
      }
    };

    void loadOfferings();

    return () => {
      isMounted = false;
    };
  }, [userProfile?.id]);

  const handleDismiss = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
  };

  const handleStartPro = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Development build required',
        'Memvo can preview the paywall on web, but real RevenueCat purchases require an iOS or Android development build with store testing enabled.',
      );
      return;
    }

    if (!isRevenueCatConfigured()) {
      Alert.alert('RevenueCat not configured', 'The purchase SDK key is missing for this platform, so billing cannot start yet.');
      return;
    }

    if (!userProfile?.id) {
      Alert.alert('Sign in required', 'Please sign in again before starting a subscription.');
      return;
    }

    if (!selectedPackage) {
      Alert.alert('No package available', 'RevenueCat did not return an available package for this paywall yet.');
      return;
    }

    setIsPurchasing(true);
    setLoadError(null);

    try {
      const result = await purchaseRevenueCatPackage(userProfile.id, selectedPackage);
      if (!hasRevenueCatProAccess(result.customerInfo)) {
        throw new Error('Purchase completed, but Pro access is not active yet. Please try restoring purchases from Settings in your development build.');
      }

      await refreshUserProfile();
      Alert.alert('Welcome to Pro!', 'All features are now unlocked.');
      handleDismiss();
    } catch (error) {
      const maybeCancelled = typeof error === 'object' && error !== null && 'userCancelled' in error && Boolean((error as { userCancelled?: boolean }).userCancelled);
      if (maybeCancelled) {
        handleDismiss();
        return;
      }

      const message = error instanceof Error ? error.message : 'Purchase could not be completed right now.';
      setLoadError(message);
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Upgrade to Pro</Text>
            <Text className="text-base leading-7 text-muted">{contextMessage}</Text>
          </View>

          <View className="rounded-[30px] border border-primary/10 bg-primary px-5 py-6">
            <Text className="text-sm font-semibold uppercase tracking-[1.1px] text-white/80">Memvo Pro</Text>
            <Text className="mt-3 text-4xl font-bold text-white">{getPackageLabel(selectedPackage)}</Text>
            <Text className="mt-3 text-sm leading-6 text-white/85">
              No hidden fees · Cancel anytime from Settings · Receipt sent automatically
            </Text>
          </View>

          <View className="gap-3">
            {[
              'Unlimited transcription',
              '99+ languages with Whisper',
              'All AI features',
              'Unlimited folders and 10 GB storage',
              'PDF export',
            ].map((item) => (
              <View key={item} className="rounded-[24px] border border-border bg-surface px-5 py-4">
                <Text className="text-sm leading-6 text-foreground">{item}</Text>
              </View>
            ))}
          </View>

          {offerings?.current?.identifier ? (
            <View className="rounded-2xl border border-border bg-surface px-4 py-4">
              <Text className="text-sm font-semibold text-foreground">Current offering</Text>
              <Text className="mt-2 text-sm leading-6 text-muted">{offerings.current.identifier}</Text>
            </View>
          ) : null}

          {isLoadingOfferings ? (
            <View className="rounded-2xl border border-border bg-surface px-4 py-4">
              <View className="flex-row items-center gap-3">
                <ActivityIndicator color="#0F6E56" />
                <Text className="text-sm text-muted">Loading subscription options…</Text>
              </View>
            </View>
          ) : null}

          {loadError ? (
            <View className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3">
              <Text className="text-sm leading-6 text-error">{loadError}</Text>
            </View>
          ) : null}

          {!isRevenueCatPurchasingSupported() ? (
            <View className="rounded-2xl border border-border bg-surface px-4 py-4">
              <Text className="text-sm leading-6 text-muted">
                Web preview can show the paywall, but real purchases need an iOS or Android development build. RevenueCat is wired so the live purchase path can be tested there.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => {
              void handleStartPro();
            }}
            disabled={isPurchasing}
            className={`rounded-full px-5 py-4 ${isPurchasing ? 'bg-primary/40' : 'bg-primary'}`}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-center text-sm font-semibold text-white">Start Pro</Text>
            )}
          </TouchableOpacity>

          <Text className="text-center text-sm text-muted">No ads — ever.</Text>

          <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={handleDismiss}>
            <Text className="text-center text-sm font-semibold text-muted">Maybe later</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
