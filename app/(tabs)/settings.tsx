import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useMemvo } from '@/lib/memvo-store';
import {
  MEMVO_NOTES_STORAGE_KEY,
  MEMVO_QUEUE_STORAGE_KEY,
} from '@/lib/memvo-recording-utils';
import { getAllowedFreeMinutes } from '@/lib/memvo-transcription';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  MEMVO_FOLDERS_STORAGE_KEY,
  MEMVO_RECENT_SEARCHES_STORAGE_KEY,
} from '@/lib/memvo-organization';

const SETTINGS_PREFERENCES_STORAGE_KEY = 'memvo_settings_preferences_v1';
const SUPPORT_EMAIL = 'support@memvo.app';
const PRIVACY_POLICY_URL = 'https://memvo.app/privacy';
const FAQ_COUNT = 8;

type SettingsPreferences = {
  notificationsEnabled: boolean;
};

const defaultPreferences: SettingsPreferences = {
  notificationsEnabled: true,
};

function Row({
  label,
  helper,
  value,
  onPress,
  destructive = false,
  badge,
  right,
}: {
  label: string;
  helper?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  badge?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      accessibilityRole={onPress ? 'button' : undefined}
      activeOpacity={onPress ? 0.85 : 1}
      className="rounded-2xl bg-background px-4 py-4"
      onPress={onPress}
      disabled={!onPress}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className={`text-sm font-medium ${destructive ? 'text-error' : 'text-foreground'}`}>{label}</Text>
            {badge ? (
              <View className="rounded-full bg-[#EEF8F4] px-2 py-1">
                <Text className="text-[11px] font-semibold text-primary">{badge}</Text>
              </View>
            ) : null}
          </View>
          {helper ? <Text className="text-sm leading-6 text-muted">{helper}</Text> : null}
        </View>
        {right ?? (onPress ? <Text className="text-base text-muted">›</Text> : null)}
      </View>
      {value ? <Text className="mt-2 text-sm font-medium text-foreground">{value}</Text> : null}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-[28px] border border-border bg-surface p-4">
      <Text className="text-base font-semibold text-foreground">{title}</Text>
      <View className="mt-3 gap-3">{children}</View>
    </View>
  );
}

function formatMinutes(value: number) {
  return `${Math.max(0, Math.round(value))} min`;
}

function formatStorageSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function formatVersion() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return `Version ${version}`;
}

export default function SettingsScreen() {
  const { userProfile, notes, syncQueue } = useMemvo();
  const { user, logout } = useAuth();
  const [preferences, setPreferences] = useState<SettingsPreferences>(defaultPreferences);
  const [referralCount, setReferralCount] = useState(0);
  const [isGoogleRowVisible, setIsGoogleRowVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState(userProfile?.fullName ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    setNameDraft(userProfile?.fullName ?? '');
  }, [userProfile?.fullName]);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(SETTINGS_PREFERENCES_STORAGE_KEY)
      .then((stored) => {
        if (!isMounted || !stored) {
          return;
        }

        try {
          const parsed = JSON.parse(stored) as Partial<SettingsPreferences>;
          setPreferences({
            notificationsEnabled: parsed.notificationsEnabled ?? true,
          });
        } catch (_error) {
          setPreferences(defaultPreferences);
        }
      })
      .catch(() => {
        setPreferences(defaultPreferences);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(SETTINGS_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences)).catch((error) => {
      console.error('Failed to persist settings preferences', error);
    });
  }, [preferences]);

  useEffect(() => {
    let isMounted = true;

    const loadReferralCount = async () => {
      if (!isSupabaseConfigured || !userProfile?.id) {
        if (isMounted) {
          setReferralCount(0);
        }
        return;
      }

      const { count } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_user_id', userProfile.id);

      if (isMounted) {
        setReferralCount(count ?? 0);
      }
    };

    const loadAuthProviders = async () => {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setIsGoogleRowVisible(false);
        }
        return;
      }

      const { data } = await supabase.auth.getUser();
      const providers = data.user?.identities?.map((identity) => identity.provider) ?? [];
      if (isMounted) {
        setIsGoogleRowVisible(!providers.includes('google'));
      }
    };

    void loadReferralCount();
    void loadAuthProviders();

    return () => {
      isMounted = false;
    };
  }, [userProfile?.id]);

  const displayName = userProfile?.fullName?.trim() || user?.name || userProfile?.email || 'Memvo User';
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || 'M';
  const allowedMinutes = userProfile ? getAllowedFreeMinutes(userProfile) : 120;
  const minutesUsed = userProfile?.minutesUsedThisMonth ?? 0;
  const minutesRemaining = Math.max(0, allowedMinutes - minutesUsed);
  const usageRatio = allowedMinutes > 0 ? Math.min(1, minutesUsed / allowedMinutes) : 0;
  const currentPlanLabel = userProfile?.isAdmin
    ? 'Admin access'
    : userProfile?.manualPro
      ? 'Manual Pro'
      : userProfile?.plan === 'pro'
        ? 'Memvo Pro'
        : 'Free plan';
  const approximateStoredBytes = syncQueue.reduce((sum, item) => sum + (item.fileSizeBytes ?? 0), 0);
  const storageLimitBytes = userProfile?.plan === 'pro' || userProfile?.manualPro || userProfile?.isAdmin ? 10 * 1024 * 1024 * 1024 : 1024 * 1024 * 1024;
  const storageSummary = `${formatStorageSize(approximateStoredBytes)} of ${userProfile?.plan === 'pro' || userProfile?.manualPro || userProfile?.isAdmin ? '10 GB' : '1 GB'} used`;
  const versionLabel = formatVersion();
  const syncSummary = syncQueue.length === 0 ? 'All notes are synced or waiting locally.' : `${syncQueue.length} item${syncQueue.length === 1 ? '' : 's'} waiting to sync or retry.`;
  const audioDeletionValue = 'Always on';

  const clearLocalMemvoData = async () => {
    await AsyncStorage.multiRemove([
      MEMVO_NOTES_STORAGE_KEY,
      MEMVO_QUEUE_STORAGE_KEY,
      MEMVO_FOLDERS_STORAGE_KEY,
      MEMVO_RECENT_SEARCHES_STORAGE_KEY,
      SETTINGS_PREFERENCES_STORAGE_KEY,
    ]);
  };

  const handleSaveName = async () => {
    const nextName = nameDraft.trim();
    if (!userProfile?.id || !isSupabaseConfigured) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: nextName.length > 0 ? nextName : null })
        .eq('id', userProfile.id);

      if (error) {
        throw error;
      }

      await supabase.auth.updateUser({ data: { full_name: nextName.length > 0 ? nextName : null } });
      setIsEditingName(false);
      Alert.alert('Profile updated', 'Your display name has been saved.');
    } catch (error) {
      Alert.alert('Unable to save name', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!userProfile?.email || !isSupabaseConfigured) {
      Alert.alert('Password reset unavailable', 'Sign in with email to request a password reset.');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userProfile.email);
      if (error) {
        throw error;
      }

      Alert.alert('Password reset sent', 'Check your inbox for a secure reset email.');
    } catch (error) {
      Alert.alert('Unable to send reset email', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleGoogleRow = () => {
    Alert.alert(
      'Google sign-in',
      'Google account linking is reserved for the dedicated sign-in flow. Use the onboarding screen if you want to switch providers later.',
    );
  };

  const handleOpenPrivacyPolicy = async () => {
    try {
      await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
    } catch (error) {
      Alert.alert('Unable to open policy', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleContactSupport = async () => {
    try {
      const isAvailable = await MailComposer.isAvailableAsync();
      if (isAvailable) {
        await MailComposer.composeAsync({
          recipients: [SUPPORT_EMAIL],
          subject: 'Memvo support request',
          body: `Hi Memvo team,\n\nI need help with:\n\nAccount email: ${userProfile?.email ?? 'Unknown'}\nApp version: ${versionLabel}\n`,
        });
        return;
      }
    } catch (_error) {
      // Fall back to mailto below.
    }

    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Memvo support request')}`;
    void WebBrowser.openBrowserAsync(mailtoUrl).catch(() => {
      Alert.alert('Support email unavailable', `Please email ${SUPPORT_EMAIL} from your preferred mail app.`);
    });
  };

  const handleRateMemvo = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Review unavailable', 'App review prompts are available after Memvo is published to the iOS App Store or Google Play.');
      return;
    }

    try {
      const available = await StoreReview.isAvailableAsync();
      if (!available) {
        Alert.alert('Review unavailable', 'Your device cannot open an in-app review prompt right now.');
        return;
      }

      await StoreReview.requestReview();
    } catch (error) {
      Alert.alert('Review unavailable', error instanceof Error ? error.message : 'Please try again later.');
    }
  };

  const handleExportData = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert('Export unavailable', 'Connect Supabase before exporting your data.');
      return;
    }

    setIsExporting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/export-user-data`;

      if (!token || !functionUrl) {
        throw new Error('Your session is unavailable. Please sign in again and retry.');
      }

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Export failed.');
      }

      const bytes = new Uint8Array(await response.arrayBuffer());

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([bytes], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `memvo-export-${new Date().toISOString().slice(0, 10)}.zip`;
        anchor.click();
        window.URL.revokeObjectURL(url);
        Alert.alert('Export ready', 'Your ZIP export has started downloading.');
        return;
      }

      const filename = `memvo-export-${Date.now()}.zip`;
      const destination = `${FileSystem.cacheDirectory}${filename}`;
      const binaryString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
      const base64 = globalThis.btoa(binaryString);
      await FileSystem.writeAsStringAsync(destination, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(destination, {
          mimeType: 'application/zip',
          dialogTitle: 'Export your Memvo data',
          UTI: 'public.zip-archive',
        });
      } else {
        Alert.alert('Export saved', 'Your ZIP export was prepared, but this device cannot open a share sheet.');
      }
    } catch (error) {
      Alert.alert('Unable to export data', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const executeSignOut = async () => {
    await clearLocalMemvoData();
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    await logout();
    router.replace('/login');
  };

  const handleSignOut = () => {
    const confirmMessage = 'This will clear local Memvo data from this device and return you to sign in.';

    const runSignOut = () => {
      void executeSignOut().catch((error) => {
        Alert.alert('Unable to sign out', error instanceof Error ? error.message : 'Please try again.');
      });
    };

    if (Platform.OS === 'web') {
      runSignOut();
      return;
    }

    Alert.alert('Sign out?', confirmMessage, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: runSignOut,
      },
    ]);
  };

  const executeDeleteAccount = async () => {
    if (!isSupabaseConfigured) {
      throw new Error('Account deletion requires a configured Supabase project.');
    }

    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user-account');
      if (error) {
        throw error;
      }

      await clearLocalMemvoData();
      await supabase.auth.signOut();
      await logout();
      router.replace('/onboarding');
      Alert.alert('Account deleted', 'Your Memvo account and exported content have been removed.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account permanently?',
      'This removes your profile, folders, notes, referrals, queued recordings, and stored audio. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void executeDeleteAccount().catch((error) => {
              Alert.alert('Unable to delete account', error instanceof Error ? error.message : 'Please try again.');
            });
          },
        },
      ],
    );
  };

  const usageWidth = `${Math.max(8, usageRatio * 100)}%` as const;

  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="items-center gap-3 rounded-[28px] border border-border bg-surface px-5 py-6">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <Text className="text-4xl font-bold text-primary">{avatarInitial}</Text>
            </View>
            <View className="items-center gap-1">
              <Text className="text-2xl font-bold text-foreground">{displayName}</Text>
              <Text className="text-sm text-muted">{userProfile?.email ?? 'No email connected yet'}</Text>
            </View>
          </View>

          <Section title="Account">
            <Row
              label="Display name"
              helper="Edit the name shown at the top of your profile"
              value={userProfile?.fullName?.trim() || 'Not set'}
              onPress={() => setIsEditingName(true)}
            />
            <Row
              label="Email"
              helper="Email sign-in stays read-only for security"
              value={userProfile?.email ?? 'Unavailable'}
            />
            <Row
              label="Change password"
              helper="Send yourself a secure reset email"
              onPress={handleChangePassword}
            />
            {isGoogleRowVisible ? (
              <Row
                label="Sign in with Google"
                helper="Shown only for email-password accounts"
                onPress={handleGoogleRow}
              />
            ) : null}
          </Section>

          <Section title="Subscription">
            <View className="rounded-2xl bg-background px-4 py-4">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm text-muted">Current plan</Text>
                  <Text className="mt-1 text-base font-semibold text-foreground">{currentPlanLabel}</Text>
                </View>
                {userProfile?.plan === 'free' && !userProfile?.manualPro && !userProfile?.isAdmin ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={() => router.push('/paywall')}
                    className="rounded-full bg-primary px-4 py-3"
                  >
                    <Text className="text-sm font-semibold text-white">Upgrade to Pro</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {userProfile?.plan === 'free' && !userProfile?.manualPro && !userProfile?.isAdmin ? (
                <View className="mt-4 gap-3">
                  <View className="h-2 overflow-hidden rounded-full bg-border">
                    <View className="h-full rounded-full bg-primary" style={{ width: usageWidth }} />
                  </View>
                  <Text className="text-sm leading-6 text-muted">
                    {formatMinutes(minutesUsed)} of {formatMinutes(allowedMinutes)} used this month · {formatMinutes(minutesRemaining)} remaining
                  </Text>
                </View>
              ) : userProfile?.isAdmin ? (
                <Text className="mt-4 text-sm leading-6 text-muted">
                  Admin accounts always unlock Pro-level access, summaries, and account controls.
                </Text>
              ) : userProfile?.manualPro ? (
                <Text className="mt-4 text-sm leading-6 text-muted">
                  Your access is managed manually by the Memvo owner, so billing controls are hidden on this device.
                </Text>
              ) : (
                <Text className="mt-4 text-sm leading-6 text-muted">
                  Pro features are active. Billing history and management will populate automatically once live billing data is available.
                </Text>
              )}
            </View>

            {userProfile?.plan === 'pro' && !userProfile?.manualPro && !userProfile?.isAdmin ? (
              <>
                <Row
                  label="Manage subscription"
                  helper="Open billing management once live subscriptions are connected"
                  onPress={() => Alert.alert('Billing management unavailable', 'RevenueCat billing management will appear here after the live billing connection is enabled.')}
                />
                <Row
                  label="Billing history"
                  helper="Receipts will appear here once a live store purchase exists"
                  value="No billing records are available on this build yet."
                />
                <Row
                  label="Cancel subscription"
                  helper="Cancellation will use the live store billing connection once enabled"
                  destructive
                  onPress={() => Alert.alert('Cancellation unavailable', 'Live store cancellation cannot be tested until the production billing connection is enabled.')}
                />
              </>
            ) : null}
          </Section>

          <Section title="Invite friends">
            <Row
              label="Invite friends & earn minutes"
              helper="Share your referral code and track successful invites"
              value={userProfile?.referralCode ?? 'Your referral code will appear after profile setup.'}
              badge={referralCount > 0 ? `${referralCount} joined` : null}
              onPress={() => router.push('/invite')}
            />
          </Section>

          <Section title="Privacy & data">
            <Row
              label="Delete audio after transcription"
              helper="Locked on to minimize retained voice data across devices"
              value={audioDeletionValue}
              onPress={() => Alert.alert('Audio deletion is locked on', 'Memvo keeps this setting enabled to reduce stored voice data after transcription completes. Original recordings are not meant to remain available indefinitely.')}
              right={<Text className="text-base text-muted">🔒</Text>}
            />
            <Row
              label="Privacy policy"
              helper="Open Memvo’s privacy policy in an in-app browser"
              onPress={handleOpenPrivacyPolicy}
            />
            <Row
              label={isExporting ? 'Preparing export…' : 'Export my data'}
              helper="Create a ZIP with your notes, transcripts, and referral history"
              onPress={isExporting ? undefined : handleExportData}
              right={isExporting ? <ActivityIndicator /> : <Text className="text-base text-muted">›</Text>}
            />
            <Row
              label={isDeletingAccount ? 'Deleting account…' : 'Delete account'}
              helper="Permanently remove your account, notes, folders, referrals, and stored audio"
              destructive
              onPress={isDeletingAccount ? undefined : handleDeleteAccount}
              right={isDeletingAccount ? <ActivityIndicator /> : <Text className="text-base text-muted">›</Text>}
            />
          </Section>

          <Section title="Preferences">
            <Row
              label="Push notifications"
              helper="Toggle processing and reminder notifications on this device"
              right={
                <Switch
                  value={preferences.notificationsEnabled}
                  onValueChange={(value) => setPreferences((current) => ({ ...current, notificationsEnabled: value }))}
                />
              }
            />
            <Row
              label="Storage used"
              helper="Approximate local recording cache for this device"
              value={storageSummary}
            />
            <Row
              label="Offline sync"
              helper="Memvo keeps unsynced notes locally and retries when you reconnect"
              value={syncSummary}
            />
          </Section>

          <Section title="Support">
            <Row
              label="FAQ"
              helper={`${FAQ_COUNT} quick answers about sync, billing, privacy, and transcription`}
              onPress={() => router.push('/faq')}
            />
            <Row
              label="Contact support"
              helper="Open your mail app with a prefilled support message"
              onPress={handleContactSupport}
            />
            <Row
              label="Rate Memvo"
              helper="Open an in-app review prompt on supported devices"
              onPress={handleRateMemvo}
            />
            <Row label="App version" value={versionLabel} helper="Build information for debugging and support" />
          </Section>

          {userProfile?.isAdmin ? (
            <Section title="Admin">
              <Row
                label="Admin panel"
                helper="Protected owner tools, usage stats, referral metrics, and Manual Pro access"
                onPress={() => router.push('/admin')}
              />
            </Section>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={handleSignOut}
            className="rounded-full border border-border px-4 py-4"
          >
            <Text className="text-center text-sm font-semibold text-foreground">Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent visible={isEditingName} onRequestClose={() => setIsEditingName(false)}>
        <Pressable className="flex-1 justify-end bg-black/35" onPress={() => setIsEditingName(false)}>
          <Pressable className="rounded-t-[32px] bg-background px-5 pb-10 pt-5">
            <Text className="text-xl font-semibold text-foreground">Edit display name</Text>
            <Text className="mt-2 text-sm leading-6 text-muted">This updates the name shown in your Memvo profile and support exports.</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              className="mt-5 rounded-2xl border border-border px-4 py-4 text-base text-foreground"
            />
            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => setIsEditingName(false)}
                className="flex-1 rounded-full border border-border px-4 py-4"
              >
                <Text className="text-center text-sm font-semibold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => {
                  void handleSaveName();
                }}
                className="flex-1 rounded-full bg-primary px-4 py-4"
                disabled={isSavingName}
              >
                <Text className="text-center text-sm font-semibold text-white">{isSavingName ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
