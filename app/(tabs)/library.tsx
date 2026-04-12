import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

const folders = [
  ['All Notes', '42 notes'],
  ['Starred', '9 notes'],
  ['Journals', '7 notes'],
  ['Meetings', '13 notes'],
  ['Ideas', '13 notes'],
];

export default function LibraryScreen() {
  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Library</Text>
            <Text className="text-base leading-6 text-muted">
              Keep voice notes organized by folder, recent activity, and starred moments.
            </Text>
          </View>

          <View className="gap-3">
            {folders.map(([name, count]) => (
              <View key={name} className="flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4">
                <View>
                  <Text className="text-base font-semibold text-foreground">{name}</Text>
                  <Text className="mt-1 text-sm text-muted">{count}</Text>
                </View>
                <Text className="text-lg text-muted">›</Text>
              </View>
            ))}
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-base font-semibold text-foreground">Recent activity</Text>
            <Text className="mt-2 text-sm leading-6 text-muted">
              You recorded 3 notes today and 8 notes this week. Folder management and editable note placement will be connected in the next build stage.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
