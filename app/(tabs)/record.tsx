import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function RecordScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-4 pb-6">
      <View className="flex-1 justify-between">
        <View className="gap-4">
          <View className="rounded-2xl border border-border bg-[#F3FBF7] px-4 py-3">
            <Text className="text-sm font-medium text-primary">Recording offline — will sync and transcribe when connected</Text>
          </View>
          <Text className="text-center text-sm font-medium text-muted">00:12:48</Text>
          <View className="items-center justify-center py-10">
            <View className="h-64 w-64 items-center justify-center rounded-full border border-border bg-surface">
              <View className="h-40 w-40 rounded-full bg-primary/10" />
            </View>
          </View>
        </View>

        <View className="gap-6">
          <View className="max-h-56 rounded-2xl border border-border bg-surface p-4">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-sm leading-7 text-foreground">
                I want the app to feel calm, private, and easy to trust. The summary should be fast, but the wording should stay human and readable.
              </Text>
            </ScrollView>
          </View>

          <View className="flex-row items-center justify-center gap-4">
            <View className="rounded-full border border-border px-6 py-4">
              <Text className="text-sm font-semibold text-foreground">Pause</Text>
            </View>
            <View className="rounded-full bg-primary px-8 py-4">
              <Text className="text-sm font-semibold text-white">Stop</Text>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
