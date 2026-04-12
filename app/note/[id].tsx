import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function NoteDetailScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">Today · 11:42 AM</Text>
            <Text className="text-3xl font-bold text-foreground">Investor follow-up ideas</Text>
            <Text className="text-base leading-6 text-muted">
              Editable titles, tags, summary states, and export actions will be connected to data in the next implementation stage.
            </Text>
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-sm font-semibold text-foreground">Summary</Text>
            <Text className="mt-2 text-sm leading-6 text-muted">
              Validate referral incentive language, protect transparent pricing, and prioritize a calm review flow after transcription finishes.
            </Text>
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-sm font-semibold text-foreground">Transcript</Text>
            <Text className="mt-3 text-sm leading-7 text-foreground">
              [00:03] We need the onboarding to explain privacy clearly. [00:18] The pricing should feel honest and easy to understand. [00:31] The note detail screen should stay readable even for long transcripts.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
