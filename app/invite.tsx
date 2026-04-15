import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import type { MemvoReferral } from '@/lib/memvo-domain';
import { useMemvo } from '@/lib/memvo-store';
import {
  buildReferralShareMessage,
  getReferralLink,
} from '@/lib/memvo-referrals';
import { getAllowedFreeMinutes } from '@/lib/memvo-transcription';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function formatMinutes(value: number) {
  return `${Math.max(0, Math.round(value))} min`;
}

function formatReferralDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export default function InviteScreen() {
  const { userProfile } = useMemvo();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<MemvoReferral[]>([]);
  const referralCode = userProfile?.referralCode ?? null;
  const referralLink = useMemo(() => getReferralLink(referralCode), [referralCode]);

  useEffect(() => {
    let isMounted = true;

    const loadReferrals = async () => {
      if (!isSupabaseConfigured || !userProfile?.id) {
        if (isMounted) {
          setReferrals([]);
        }
        return;
      }

      const { data, error } = await supabase
        .from('referrals')
        .select('id,referrer_user_id,referred_user_id,referral_code,bonus_minutes_awarded,created_at,updated_at')
        .eq('referrer_user_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (!isMounted) {
        return;
      }

      if (error || !Array.isArray(data)) {
        setReferrals([]);
        return;
      }

      setReferrals(
        data.map((entry) => ({
          id: entry.id,
          referrerUserId: entry.referrer_user_id,
          referredUserId: entry.referred_user_id,
          referralCode: entry.referral_code,
          bonusMinutesAwarded: Number(entry.bonus_minutes_awarded ?? 30),
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
        })),
      );
    };

    void loadReferrals();

    return () => {
      isMounted = false;
    };
  }, [userProfile?.id]);

  const stats = useMemo(() => {
    const friendsReferred = referrals.length;
    const bonusMinutesEarned = referrals.reduce((sum, referral) => sum + referral.bonusMinutesAwarded, 0);
    const minutesUsedThisMonth = userProfile?.minutesUsedThisMonth ?? 0;
    const totalAllowance = userProfile ? getAllowedFreeMinutes(userProfile) : 120;

    return {
      friendsReferred,
      bonusMinutesEarned,
      minutesUsedThisMonth,
      totalAvailableThisMonth: totalAllowance - minutesUsedThisMonth,
    };
  }, [referrals, userProfile]);

  const handleCopyCode = async () => {
    if (!referralCode) {
      Alert.alert('Referral code unavailable', 'Your referral code will appear here after your profile is ready.');
      return;
    }

    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleShare = async () => {
    if (!referralCode) {
      Alert.alert('Referral code unavailable', 'Your referral code will appear here after your profile is ready.');
      return;
    }

    try {
      await Share.share({
        message: buildReferralShareMessage(referralCode),
        url: referralLink,
      });
    } catch (error) {
      Alert.alert(
        'Unable to share',
        error instanceof Error ? error.message : 'Please try copying your referral link instead.',
      );
    }
  };

  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Invite friends and earn minutes</Text>
            <Text className="text-base leading-6 text-muted">
              Share Memvo in a privacy-first way. Every successful referral adds 30 bonus minutes for you and 30 for your friend.
            </Text>
          </View>

          <View className="rounded-[28px] border border-border bg-surface p-5">
            <Text className="text-sm font-semibold uppercase tracking-[1px] text-muted">Your referral code</Text>
            <View className="mt-4 rounded-3xl bg-background px-5 py-6">
              <Text className="text-center text-3xl font-bold tracking-[2px] text-foreground">
                {referralCode ?? 'MEMVO-......'}
              </Text>
            </View>
            <Text className="mt-4 text-sm leading-6 text-muted">{referralLink}</Text>

            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={handleCopyCode}
                className="flex-1 rounded-full border border-border px-4 py-4"
              >
                <Text className="text-center text-sm font-semibold text-foreground">{copied ? 'Copied!' : 'Copy code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={handleShare}
                className="flex-1 rounded-full bg-primary px-4 py-4"
              >
                <Text className="text-center text-sm font-semibold text-white">Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="rounded-[28px] border border-border bg-surface p-5">
            <Text className="text-lg font-semibold text-foreground">How it works</Text>
            <View className="mt-4 gap-3">
              {[
                'Share your code with a friend',
                'They sign up using your link',
                'You both get 30 free bonus minutes',
              ].map((step, index) => (
                <View key={step} className="flex-row items-start gap-3 rounded-2xl bg-background px-4 py-4">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-[#EEF8F4]">
                    <Text className="text-sm font-semibold text-primary">{index + 1}</Text>
                  </View>
                  <Text className="flex-1 text-sm leading-6 text-foreground">{step}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="rounded-[28px] border border-border bg-surface p-5">
            <Text className="text-lg font-semibold text-foreground">Your stats</Text>
            <View className="mt-4 gap-3">
              {[
                ['Friends referred', `${stats.friendsReferred}`],
                ['Bonus minutes earned', formatMinutes(stats.bonusMinutesEarned)],
                ['Minutes used this month', `${Math.round(stats.minutesUsedThisMonth)} / 120 min`],
                ['Total available this month', formatMinutes(stats.totalAvailableThisMonth)],
              ].map(([label, value]) => (
                <View key={label} className="flex-row items-center justify-between rounded-2xl bg-background px-4 py-4">
                  <Text className="text-sm text-muted">{label}</Text>
                  <Text className="text-sm font-semibold text-foreground">{value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="rounded-[28px] border border-border bg-surface p-5">
            <Text className="text-lg font-semibold text-foreground">Referral activity</Text>
            <View className="mt-4 gap-3">
              {referrals.length === 0 ? (
                <View className="rounded-2xl bg-background px-4 py-5">
                  <Text className="text-sm leading-6 text-muted">
                    No successful referrals yet. Once a friend joins with your link, the reward will appear here.
                  </Text>
                </View>
              ) : (
                referrals.map((referral) => (
                  <View key={referral.id} className="rounded-2xl bg-background px-4 py-4">
                    <Text className="text-sm font-medium text-foreground">
                      Friend joined {formatReferralDate(referral.createdAt)} · +{referral.bonusMinutesAwarded} min earned
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
