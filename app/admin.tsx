import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { useMemvo } from '@/lib/memvo-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AdminStatsResponse = {
  total_users: number;
  total_notes: number;
  total_minutes: number;
  whisper_notes: number;
  on_device_notes: number;
  total_referrals: number;
  total_bonus_minutes_awarded: number;
  top_referrers: Array<{
    referral_code: string;
    total_referrals: number;
    total_bonus_minutes_awarded: number;
  }>;
  recent_referrals: Array<{
    referral_code: string | null;
    bonus_minutes_awarded: number;
    created_at: string | null;
  }>;
  recent_signups: Array<{
    email: string | null;
    signup_date: string | null;
    referral_code: string | null;
    is_admin: boolean;
    manual_pro: boolean;
    plan: string;
  }>;
};

type UserLookupResult = {
  id: string;
  email: string | null;
  plan: string | null;
  is_admin: boolean;
  manual_pro: boolean;
};

const cardClassName = 'rounded-3xl border border-border bg-surface p-5';

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getUserStatus(user: UserLookupResult | null) {
  if (!user) {
    return 'Unknown';
  }

  if (user.is_admin) {
    return 'Admin';
  }

  if (user.manual_pro) {
    return 'Manual Pro';
  }

  if (user.plan === 'pro') {
    return 'Paying Pro';
  }

  return 'Free';
}

export default function AdminScreen() {
  const { userProfile } = useMemvo();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emailQuery, setEmailQuery] = useState('');
  const [searchedUser, setSearchedUser] = useState<UserLookupResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    if (userProfile && !userProfile.isAdmin) {
      router.replace('/(tabs)/settings');
    }
  }, [userProfile]);

  const loadStats = useCallback(async (isManualRefresh = false) => {
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured for admin analytics yet.');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setLoadError(null);

    const { data, error } = await supabase.functions.invoke('get-admin-stats');

    if (error) {
      setLoadError(error.message);
      setStats(null);
    } else {
      setStats(data as AdminStatsResponse);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (!userProfile?.isAdmin) {
      return;
    }

    void loadStats();
  }, [loadStats, userProfile?.isAdmin]);

  const handleSearch = useCallback(async () => {
    if (!userProfile?.isAdmin) {
      return;
    }

    const normalizedEmail = emailQuery.trim().toLowerCase();
    if (!normalizedEmail) {
      setSearchError('Enter an email address to search.');
      setSearchedUser(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id,email,plan,is_admin,manual_pro')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      setSearchError(error.message);
      setSearchedUser(null);
    } else if (!data) {
      setSearchError('No user found for that email.');
      setSearchedUser(null);
    } else {
      setSearchedUser(data as UserLookupResult);
      setSearchError(null);
    }

    setIsSearching(false);
  }, [emailQuery, userProfile?.isAdmin]);

  const canGrantManualPro = useMemo(() => {
    if (!searchedUser || searchedUser.is_admin) {
      return false;
    }

    return !(searchedUser.plan === 'pro' && !searchedUser.manual_pro) && !searchedUser.manual_pro;
  }, [searchedUser]);

  const canRevokeManualPro = useMemo(() => {
    if (!searchedUser || searchedUser.is_admin) {
      return false;
    }

    if (searchedUser.plan === 'pro' && !searchedUser.manual_pro) {
      return false;
    }

    return searchedUser.manual_pro;
  }, [searchedUser]);

  const handleManualProUpdate = useCallback((nextValue: boolean) => {
    if (!searchedUser?.email) {
      return;
    }

    const actionLabel = nextValue ? 'Grant Pro' : 'Revoke Pro';
    const actionDescription = nextValue
      ? `Grant Manual Pro access to ${searchedUser.email}?`
      : `Remove Manual Pro access from ${searchedUser.email}?`;

    Alert.alert(actionLabel, actionDescription, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: actionLabel,
        style: nextValue ? 'default' : 'destructive',
        onPress: () => {
          void (async () => {
            setIsMutating(true);
            const { data, error } = await supabase.functions.invoke('set-manual-pro', {
              body: {
                target_email: searchedUser.email,
                manual_pro_value: nextValue,
              },
            });

            if (error || data?.success === false) {
              Alert.alert('Update failed', error?.message ?? data?.error ?? 'The Manual Pro change could not be saved.');
              setIsMutating(false);
              return;
            }

            setSearchedUser((current) =>
              current
                ? {
                    ...current,
                    manual_pro: nextValue,
                  }
                : current,
            );
            setIsMutating(false);
            void loadStats(true);
          })();
        },
      },
    ]);
  }, [loadStats, searchedUser]);

  if (!userProfile) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <ActivityIndicator />
      </ScreenContainer>
    );
  }

  if (!userProfile.isAdmin) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <View className="max-w-md rounded-3xl border border-border bg-surface p-6">
          <Text className="text-xl font-semibold text-foreground">Admin access required</Text>
          <Text className="mt-3 text-sm leading-6 text-muted">
            This panel is only available to the Memvo admin account.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            className="mt-5 rounded-full bg-primary px-5 py-3"
            onPress={() => router.replace('/(tabs)/settings')}
          >
            <Text className="text-center text-sm font-semibold text-background">Back to settings</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadStats(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Admin panel</Text>
            <Text className="text-base leading-6 text-muted">
              Review product health, referral performance, recent users, and manual Pro access from one protected dashboard.
            </Text>
          </View>

          {isLoading ? (
            <View className={cardClassName}>
              <ActivityIndicator />
            </View>
          ) : loadError ? (
            <View className={cardClassName}>
              <Text className="text-base font-semibold text-foreground">Unable to load admin data</Text>
              <Text className="mt-2 text-sm leading-6 text-error">{loadError}</Text>
            </View>
          ) : null}

          {stats ? (
            <>
              <View className={cardClassName}>
                <Text className="text-lg font-semibold text-foreground">App overview</Text>
                <View className="mt-4 flex-row flex-wrap gap-3">
                  {[
                    { label: 'Users', value: stats.total_users },
                    { label: 'Notes', value: stats.total_notes },
                    { label: 'Minutes', value: stats.total_minutes.toFixed(1) },
                    { label: 'Whisper', value: stats.whisper_notes },
                    { label: 'On-device', value: stats.on_device_notes },
                  ].map((item) => (
                    <View key={item.label} className="min-w-[140px] flex-1 rounded-2xl bg-background px-4 py-4">
                      <Text className="text-xs uppercase tracking-[1.4px] text-muted">{item.label}</Text>
                      <Text className="mt-2 text-2xl font-semibold text-foreground">{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className={cardClassName}>
                <Text className="text-lg font-semibold text-foreground">Referral program</Text>
                <View className="mt-4 flex-row flex-wrap gap-3">
                  <View className="min-w-[160px] flex-1 rounded-2xl bg-background px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.4px] text-muted">Total referrals</Text>
                    <Text className="mt-2 text-2xl font-semibold text-foreground">{stats.total_referrals}</Text>
                  </View>
                  <View className="min-w-[160px] flex-1 rounded-2xl bg-background px-4 py-4">
                    <Text className="text-xs uppercase tracking-[1.4px] text-muted">Bonus minutes awarded</Text>
                    <Text className="mt-2 text-2xl font-semibold text-foreground">{stats.total_bonus_minutes_awarded}</Text>
                  </View>
                </View>

                <View className="mt-5 gap-3">
                  <Text className="text-sm font-semibold text-foreground">Top referrers</Text>
                  {stats.top_referrers.length ? stats.top_referrers.map((row) => (
                    <View key={row.referral_code} className="rounded-2xl bg-background px-4 py-4">
                      <Text className="text-sm font-medium text-foreground">{row.referral_code}</Text>
                      <Text className="mt-1 text-sm text-muted">
                        {row.total_referrals} referrals · {row.total_bonus_minutes_awarded} bonus minutes
                      </Text>
                    </View>
                  )) : (
                    <Text className="text-sm text-muted">No referral data yet.</Text>
                  )}
                </View>

                <View className="mt-5 gap-3">
                  <Text className="text-sm font-semibold text-foreground">Recent referrals</Text>
                  {stats.recent_referrals.length ? stats.recent_referrals.map((row, index) => (
                    <View key={`${row.referral_code ?? 'unknown'}-${index}`} className="rounded-2xl bg-background px-4 py-4">
                      <Text className="text-sm font-medium text-foreground">{row.referral_code ?? 'Unknown code'}</Text>
                      <Text className="mt-1 text-sm text-muted">
                        {row.bonus_minutes_awarded} minutes · {formatDate(row.created_at)}
                      </Text>
                    </View>
                  )) : (
                    <Text className="text-sm text-muted">No recent referrals yet.</Text>
                  )}
                </View>
              </View>

              <View className={cardClassName}>
                <Text className="text-lg font-semibold text-foreground">Recent signups</Text>
                <View className="mt-4 gap-3">
                  {stats.recent_signups.map((row, index) => (
                    <View key={`${row.email ?? 'signup'}-${index}`} className="rounded-2xl bg-background px-4 py-4">
                      <Text className="text-sm font-medium text-foreground">{row.email ?? 'No email available'}</Text>
                      <Text className="mt-1 text-sm text-muted">
                        {formatDate(row.signup_date)} · {row.referral_code ?? 'No referral code'}
                      </Text>
                      <Text className="mt-2 text-xs uppercase tracking-[1.2px] text-muted">
                        {row.is_admin ? 'Admin' : row.manual_pro ? 'Manual Pro' : row.plan === 'pro' ? 'Paying Pro' : 'Free'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}

          <View className={cardClassName}>
            <Text className="text-lg font-semibold text-foreground">Pro access management</Text>
            <Text className="mt-2 text-sm leading-6 text-muted">
              Search any user by email, review their status, and grant or revoke Manual Pro access with a confirmation dialog.
            </Text>

            <View className="mt-4 gap-3">
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmailQuery}
                placeholder="name@example.com"
                placeholderTextColor="#8A8F98"
                returnKeyType="search"
                value={emailQuery}
                className="rounded-2xl border border-border bg-background px-4 py-4 text-base text-foreground"
                onSubmitEditing={() => void handleSearch()}
              />
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                className="rounded-full bg-primary px-5 py-3"
                disabled={isSearching}
                onPress={() => void handleSearch()}
              >
                <Text className="text-center text-sm font-semibold text-background">
                  {isSearching ? 'Searching…' : 'Search user'}
                </Text>
              </TouchableOpacity>
            </View>

            {searchError ? <Text className="mt-3 text-sm text-error">{searchError}</Text> : null}

            {searchedUser ? (
              <View className="mt-5 rounded-2xl bg-background px-4 py-4">
                <Text className="text-sm font-medium text-foreground">{searchedUser.email ?? 'Unknown user'}</Text>
                <Text className="mt-1 text-sm text-muted">Current status: {getUserStatus(searchedUser)}</Text>
                {searchedUser.plan === 'pro' && !searchedUser.manual_pro && !searchedUser.is_admin ? (
                  <Text className="mt-3 text-sm text-muted">Paying subscriber — manage via RevenueCat</Text>
                ) : null}
                <View className="mt-4 flex-row gap-3">
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    className={`flex-1 rounded-full px-4 py-3 ${canGrantManualPro ? 'bg-primary' : 'bg-border'}`}
                    disabled={!canGrantManualPro || isMutating}
                    onPress={() => handleManualProUpdate(true)}
                  >
                    <Text className={`text-center text-sm font-semibold ${canGrantManualPro ? 'text-background' : 'text-muted'}`}>
                      Grant Pro
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    className={`flex-1 rounded-full px-4 py-3 ${canRevokeManualPro ? 'bg-[#7F1D1D]' : 'bg-border'}`}
                    disabled={!canRevokeManualPro || isMutating}
                    onPress={() => handleManualProUpdate(false)}
                  >
                    <Text className={`text-center text-sm font-semibold ${canRevokeManualPro ? 'text-white' : 'text-muted'}`}>
                      Revoke Pro
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
