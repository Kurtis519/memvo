import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

const sections = [
  {
    title: 'Account',
    rows: ['Name and email', 'Subscription status', 'Billing history'],
  },
  {
    title: 'Invite friends & earn minutes',
    rows: ['Referral code', 'Share message', 'Bonus minutes earned'],
  },
  {
    title: 'Privacy',
    rows: ['Audio deletion policy', 'Data export', 'Delete account'],
  },
  {
    title: 'App',
    rows: ['Notifications', 'Offline sync status', 'Support and FAQ'],
  },
];

export default function SettingsScreen() {
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

          {sections.map((section) => (
            <View key={section.title} className="rounded-2xl border border-border bg-surface p-4">
              <Text className="text-base font-semibold text-foreground">{section.title}</Text>
              <View className="mt-3 gap-3">
                {section.rows.map((row) => (
                  <View key={row} className="flex-row items-center justify-between">
                    <Text className="text-sm text-foreground">{row}</Text>
                    <Text className="text-base text-muted">›</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
