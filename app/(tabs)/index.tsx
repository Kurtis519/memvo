import { ScrollView, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

const notes = [
  {
    id: '1',
    title: 'Investor follow-up ideas',
    date: 'Today · 11:42 AM',
    duration: '08:14',
    summary: 'Discussed launch timing, referral incentives, and what to validate before the beta invite list goes out.',
    tags: ['Product', 'Launch', 'Follow-up'],
  },
  {
    id: '2',
    title: 'Journal reflection',
    date: 'Yesterday · 8:05 PM',
    duration: '05:31',
    summary: 'A quieter personal note focused on energy, priorities, and what to protect during a busy week.',
    tags: ['Journal', 'Personal'],
  },
];

export default function HomeScreen() {
  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">Saturday, April 12</Text>
            <Text className="text-3xl font-bold text-foreground">Good afternoon</Text>
            <Text className="text-base leading-6 text-muted">
              Capture private voice notes, transcribe them clearly, and keep only the text that matters.
            </Text>
          </View>

          <View className="rounded-xl border border-border bg-surface px-4 py-3">
            <TextInput
              editable={false}
              placeholder="Search transcripts"
              placeholderTextColor="#888888"
              className="text-base text-foreground"
            />
          </View>

          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Recent notes</Text>
            {notes.map((note) => (
              <View key={note.id} className="gap-3 rounded-2xl border border-border bg-surface p-4">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1 gap-1">
                    <Text className="text-lg font-semibold text-foreground">{note.title}</Text>
                    <Text className="text-sm text-muted">{note.date}</Text>
                  </View>
                  <View className="rounded-full bg-background px-3 py-1">
                    <Text className="text-xs font-semibold text-primary">{note.duration}</Text>
                  </View>
                </View>
                <Text className="text-sm leading-6 text-muted">{note.summary}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {note.tags.map((tag) => (
                    <View key={tag} className="rounded-full bg-background px-3 py-1.5">
                      <Text className="text-xs font-medium text-primary">{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-8 left-0 right-0 items-center">
        <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-primary shadow-sm">
          <Text className="text-sm font-semibold text-white">Record</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
