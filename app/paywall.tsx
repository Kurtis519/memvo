import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function PaywallScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Upgrade to Pro</Text>
            <Text className="text-base leading-6 text-muted">
              Unlimited notes, faster transcription, multilingual support, and structured AI outputs with no hidden charges.
            </Text>
          </View>

          <View className="rounded-3xl bg-primary p-5">
            <Text className="text-sm font-medium text-white/80">Memvo Pro</Text>
            <Text className="mt-2 text-4xl font-bold text-white">$6.99</Text>
            <Text className="mt-1 text-sm text-white/80">per month after the free trial period</Text>
          </View>

          <View className="gap-3">
            {[
              'Whisper-powered cloud transcription',
              'Claude summaries, action items, and tags',
              'Unlimited recordings and cross-device sync',
            ].map((item) => (
              <View key={item} className="rounded-2xl border border-border bg-surface p-4">
                <Text className="text-sm leading-6 text-foreground">{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
