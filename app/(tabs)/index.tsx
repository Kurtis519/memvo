import { router } from 'expo-router';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { useMemvo } from '@/lib/memvo-store';
import { buildFeedTimestampLabel, formatDuration } from '@/lib/memvo-recording-utils';

function EmptyState() {
  return (
    <View className="mt-10 rounded-3xl border border-dashed border-border bg-surface px-5 py-8">
      <Text className="text-center text-lg font-semibold text-foreground">No recordings yet</Text>
      <Text className="mt-2 text-center text-sm leading-6 text-muted">
        Tap the Record tab to capture a private voice note. New notes appear here immediately, even before transcription finishes.
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { isHydrated, notes, processPendingQueue } = useMemvo();

  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 156, gap: 14 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void processPendingQueue()} tintColor="#0F6E56" />}
        ListHeaderComponent={
          <View className="mb-6 gap-5">
            <View className="gap-2">
              <Text className="text-sm font-medium text-muted">Memvo</Text>
              <Text className="text-3xl font-bold text-foreground">Your voice notes</Text>
              <Text className="text-base leading-6 text-muted">
                Record first, keep the audio local, and let transcription catch up afterward.
              </Text>
            </View>
            {!isHydrated ? (
              <View className="rounded-2xl border border-border bg-surface px-4 py-3">
                <Text className="text-sm text-muted">Loading your local recordings…</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={isHydrated ? <EmptyState /> : null}
        renderItem={({ item }) => {
          const recordedAt = new Date(item.recordedAt);
          const durationLabel = formatDuration(item.durationSeconds * 1000);
          const statusLabel = item.syncStatus === 'complete' ? 'Ready' : 'Transcribing...';

          return (
            <View className="gap-3 rounded-3xl border border-border bg-surface p-4">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-semibold text-foreground">{item.title}</Text>
                  <Text className="text-sm text-muted">{buildFeedTimestampLabel(recordedAt)}</Text>
                </View>
                <View className="rounded-full bg-background px-3 py-1">
                  <Text className="text-xs font-semibold text-[#0F6E56]">{durationLabel}</Text>
                </View>
              </View>
              <Text className="text-sm leading-6 text-muted">{item.summary ?? 'Transcribing...'}</Text>
              <View className="flex-row items-center justify-between">
                <View className="rounded-full bg-background px-3 py-1.5">
                  <Text className="text-xs font-medium text-[#0F6E56]">{statusLabel}</Text>
                </View>
                <Text className="text-xs text-muted">Saved locally</Text>
              </View>
            </View>
          );
        }}
      />

      <View className="absolute bottom-8 left-0 right-0 items-center">
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push('/record')}
          style={{
            height: 72,
            width: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0F6E56',
            shadowColor: '#0F6E56',
            shadowOpacity: 0.16,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 20,
            elevation: 8,
          }}
        >
          <Text className="text-sm font-semibold text-white">Record</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
