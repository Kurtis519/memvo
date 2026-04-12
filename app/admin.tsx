import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function AdminScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Admin panel</Text>
            <Text className="text-base leading-6 text-muted">
              Owner-only controls for referrals, manual Pro access, and operational review will be connected to secure server actions.
            </Text>
          </View>

          <View className="flex-row gap-3">
            {[
              ['Users', '128'],
              ['Pro grants', '6'],
              ['Referrals', '19'],
            ].map(([label, value]) => (
              <View key={label} className="flex-1 rounded-2xl border border-border bg-surface p-4">
                <Text className="text-sm text-muted">{label}</Text>
                <Text className="mt-2 text-2xl font-bold text-foreground">{value}</Text>
              </View>
            ))}
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-base font-semibold text-foreground">Manual Pro grant</Text>
            <Text className="mt-2 text-sm leading-6 text-muted">
              Enter an email, verify the user, and apply or revoke access using service-role protected actions.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
