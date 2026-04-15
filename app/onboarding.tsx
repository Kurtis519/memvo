import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { readPendingReferralCode } from '@/lib/memvo-referrals';

export default function OnboardingScreen() {
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadReferralCode = async () => {
      const storedCode = await readPendingReferralCode();
      if (isMounted) {
        setPendingReferralCode(storedCode);
      }
    };

    void loadReferralCode();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
        <View className="gap-6">
          <View className="h-14 w-14 rounded-2xl bg-primary/10" />
          <View className="gap-3">
            <Text className="text-4xl font-bold text-foreground">Memvo</Text>
            <Text className="text-base leading-7 text-muted">
              Private voice notes with transparent pricing, calm design, and AI help only where it adds value.
            </Text>
          </View>

          {pendingReferralCode ? (
            <View className="rounded-[28px] border border-border bg-surface p-5">
              <Text className="text-sm font-semibold uppercase tracking-[1px] text-muted">Referral saved</Text>
              <Text className="mt-3 text-2xl font-bold text-foreground">{pendingReferralCode}</Text>
              <Text className="mt-3 text-sm leading-6 text-muted">
                Finish signing up with this invite and both of you will receive 30 bonus minutes after your account is created.
              </Text>
            </View>
          ) : null}

          <View className="gap-3">
            {[
              'Record quickly with one hand.',
              'Read clear transcripts and summaries.',
              'Keep privacy controls visible and understandable.',
            ].map((line) => (
              <View key={line} className="rounded-2xl border border-border bg-surface p-4">
                <Text className="text-sm leading-6 text-foreground">{line}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3 pt-8">
          <View className="rounded-full bg-primary px-5 py-4">
            <Text className="text-center text-sm font-semibold text-white">Continue with Google</Text>
          </View>
          <View className="rounded-full border border-border px-5 py-4">
            <Text className="text-center text-sm font-semibold text-foreground">Continue with email</Text>
          </View>
          <Text className="text-center text-sm text-muted">
            {pendingReferralCode
              ? 'Your invite code will be applied automatically after sign-up finishes.'
              : 'Sign in to start recording and unlock bonus minutes when friends join through your invite link.'}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
