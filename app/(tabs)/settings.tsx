import { router } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { useMemvo } from '@/lib/memvo-store';

const sections = [
  {
    title: 'Account',
    rows: [
      { label: 'Name and email', helper: 'Signed-in identity and contact details' },
      { label: 'Subscription status', helper: 'Current Memvo plan and limits' },
      { label: 'Billing history', helper: 'Receipts and renewal history' },
    ],
  },
  {
    title: 'Privacy',
    rows: [
      { label: 'Audio deletion policy', helper: 'How long local recordings are kept' },
      { label: 'Data export', helper: 'Download your notes and transcripts' },
      { label: 'Delete account', helper: 'Permanently remove your profile and notes' },
    ],
  },
  {
    title: 'App',
    rows: [
      { label: 'Notifications', helper: 'Control reminders and processing alerts' },
      { label: 'Offline sync status', helper: 'Review pending uploads and retries' },
      { label: 'Support and FAQ', helper: 'Get help with Memvo' },
    ],
  },
] as const;

export default function SettingsScreen() {
  const { userProfile } = useMemvo();
  const bonusMinutes = Math.round(userProfile?.bonusMinutes ?? 0);
  const visibleSections = userProfile?.isAdmin
    ? [
        ...sections,
        {
          title: 'Admin',
          rows: [{ label: 'Admin panel', helper: 'Review usage stats, referrals, and Manual Pro access' }],
        },
      ]
    : sections;

  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Settings</Text>
            <Text className="text-base leading-6 text-muted">
              Manage your plan, referrals, privacy controls, and future admin tools in one place.
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => router.push('/invite')}
            className="rounded-[28px] border border-border bg-surface p-5"
          >
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1 gap-2">
                <Text className="text-lg font-semibold text-foreground">Invite friends & earn minutes</Text>
                <Text className="text-sm leading-6 text-muted">
                  Share your referral link, track bonuses, and unlock extra free minutes each month.
                </Text>
              </View>
              <View className="rounded-full bg-[#EEF8F4] px-3 py-1.5">
                <Text className="text-xs font-semibold text-primary">+{bonusMinutes} min</Text>
              </View>
            </View>
            <View className="mt-4 rounded-2xl bg-background px-4 py-4">
              <Text className="text-sm font-medium text-foreground">
                {userProfile?.referralCode ?? 'Referral code will appear here once your profile is ready.'}
              </Text>
              <Text className="mt-2 text-sm text-muted">Open your invite dashboard</Text>
            </View>
          </TouchableOpacity>

          {visibleSections.map((section) => (
            <View key={section.title} className="rounded-2xl border border-border bg-surface p-4">
              <Text className="text-base font-semibold text-foreground">{section.title}</Text>
              <View className="mt-3 gap-3">
                {section.rows.map((row) => {
                  const isAdminPanelRow = row.label === 'Admin panel';

                  return (
                    <TouchableOpacity
                      key={row.label}
                      accessibilityRole={isAdminPanelRow ? 'button' : undefined}
                      activeOpacity={isAdminPanelRow ? 0.85 : 1}
                      className="rounded-2xl bg-background px-4 py-4"
                      onPress={isAdminPanelRow ? () => router.push('/admin') : undefined}
                    >
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="text-sm font-medium text-foreground">{row.label}</Text>
                        <Text className="text-base text-muted">›</Text>
                      </View>
                      <Text className="mt-1 text-sm leading-6 text-muted">{row.helper}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
