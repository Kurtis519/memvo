import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function OnboardingScreen() {
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
          <Text className="text-center text-sm text-muted">Referral support and free entry flow will be wired in the next stage.</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
