import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import {
  normalizeReferralCode,
  storePendingReferralCode,
} from '@/lib/memvo-referrals';

export default function JoinScreen() {
  const params = useLocalSearchParams<{ ref?: string | string[] }>();
  const [isSaving, setIsSaving] = useState(true);
  const referralCode = useMemo(() => {
    const rawValue = Array.isArray(params.ref) ? params.ref[0] : params.ref;
    return normalizeReferralCode(rawValue ?? null);
  }, [params.ref]);

  useEffect(() => {
    let isMounted = true;

    const persistReferralCode = async () => {
      await storePendingReferralCode(referralCode);
      if (isMounted) {
        setIsSaving(false);
      }
    };

    void persistReferralCode();

    return () => {
      isMounted = false;
    };
  }, [referralCode]);

  return (
    <ScreenContainer className="bg-background px-6 pt-8">
      <View className="flex-1 justify-center gap-6">
        <View className="rounded-[32px] border border-border bg-surface p-6">
          <Text className="text-3xl font-bold text-foreground">You were invited to Memvo</Text>
          <Text className="mt-3 text-base leading-7 text-muted">
            {referralCode
              ? `Your friend's invite code ${referralCode} has been saved. Finish signing up and both of you will receive 30 bonus minutes.`
              : 'We could not read the invite code from this link. You can still continue into Memvo and add a valid code later.'}
          </Text>

          <View className="mt-6 rounded-3xl bg-background px-5 py-5">
            {isSaving ? (
              <View className="flex-row items-center gap-3">
                <ActivityIndicator color="#0F6E56" />
                <Text className="text-sm text-muted">Saving your referral code…</Text>
              </View>
            ) : (
              <Text className="text-sm font-medium text-foreground">
                {referralCode ? `Saved code: ${referralCode}` : 'No valid referral code was found in this link.'}
              </Text>
            )}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => router.replace('/onboarding')}
            className="mt-6 rounded-full bg-primary px-4 py-4"
          >
            <Text className="text-center text-sm font-semibold text-white">Continue to Memvo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
