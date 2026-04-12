import { ScrollView, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function SearchScreen() {
  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Search</Text>
            <Text className="text-base leading-6 text-muted">
              Find moments, themes, and exact phrases across your transcripts.
            </Text>
          </View>

          <View className="rounded-xl border border-border bg-surface px-4 py-3">
            <TextInput autoFocus editable={false} placeholder="Search notes" placeholderTextColor="#888888" className="text-base text-foreground" />
          </View>

          <View className="flex-row flex-wrap gap-2">
            {['All tags', 'This week', 'Meetings', 'Ideas'].map((filter) => (
              <View key={filter} className="rounded-full border border-border px-3 py-2">
                <Text className="text-xs font-medium text-foreground">{filter}</Text>
              </View>
            ))}
          </View>

          <View className="gap-3">
            <View className="rounded-2xl border border-border bg-surface p-4">
              <Text className="text-base font-semibold text-foreground">Investor follow-up ideas</Text>
              <Text className="mt-2 text-sm leading-6 text-muted">
                ...referral incentives should remain simple, and the <Text className="font-semibold text-primary">pricing</Text> language needs to stay transparent...
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
