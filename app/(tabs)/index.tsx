import { router } from 'expo-router';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { useMemvo } from '@/lib/memvo-store';
import { buildFeedTimestampLabel, formatDuration } from '@/lib/memvo-recording-utils';
import { getNoteProcessingLabel, getStatusTone, normalizeLanguageBadge } from '@/lib/memvo-transcription';

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

function getStatusClasses(status: ReturnType<typeof getStatusTone>) {
  switch (status) {
    case 'success':
      return {
        badge: 'bg-green-50 dark:bg-green-950/40',
        text: 'text-success',
      };
    case 'error':
      return {
        badge: 'bg-red-50 dark:bg-red-950/40',
        text: 'text-error',
      };
    case 'progress':
    default:
      return {
        badge: 'bg-background',
        text: 'text-primary',
      };
  }
}

export default function HomeScreen() {
  const { isHydrated, notes, processPendingQueue, retryQueueItem, syncQueue, userProfile } = useMemvo();

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
            {userProfile ? (
              <View className="rounded-2xl border border-border bg-surface px-4 py-3">
                <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Transcription plan</Text>
                <Text className="mt-1 text-base font-semibold text-foreground">
                  {userProfile.plan === 'pro' || userProfile.plan === 'admin' ? 'Pro · Whisper cloud transcription' : 'Free · On-device transcription'}
                </Text>
                <Text className="mt-1 text-sm leading-6 text-muted">
                  {userProfile.plan === 'pro' || userProfile.plan === 'admin'
                    ? 'Your recordings can upload for Whisper transcription and remove cloud audio after processing.'
                    : `${Math.max(0, Math.round(120 - userProfile.minutesUsedThisMonth))} free minutes remain this month before upgrade is required.`}
                </Text>
              </View>
            ) : null}
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
          const statusLabel = getNoteProcessingLabel(item);
          const statusTone = getStatusTone(item.syncStatus);
          const statusClasses = getStatusClasses(statusTone);
          const queueItem = syncQueue.find((entry) => entry.noteId === item.id);
          const languageBadge = normalizeLanguageBadge(item.languageDetected);
          const engineBadge = item.transcriptionEngine === 'whisper' ? 'Whisper' : item.transcriptionEngine === 'on-device' ? 'On-device' : 'Queued';
          const storageLabel = item.localOnly ? 'Saved locally' : 'Synced';
          const showRetry = item.syncStatus === 'failed' && queueItem;

          return (
            <View className="gap-3 rounded-3xl border border-border bg-surface p-4">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-semibold text-foreground">{item.title}</Text>
                  <Text className="text-sm text-muted">{buildFeedTimestampLabel(recordedAt)}</Text>
                </View>
                <View className="rounded-full bg-background px-3 py-1">
                  <Text className="text-xs font-semibold text-primary">{durationLabel}</Text>
                </View>
              </View>

              <Text className="text-sm leading-6 text-muted">{item.transcript || item.transcriptionPreview || item.summary || 'Queued for transcription...'}</Text>

              <View className="flex-row flex-wrap items-center gap-2">
                <View className={`rounded-full px-3 py-1.5 ${statusClasses.badge}`}>
                  <Text className={`text-xs font-medium ${statusClasses.text}`}>{statusLabel}</Text>
                </View>
                <View className="rounded-full bg-background px-3 py-1.5">
                  <Text className="text-xs font-medium text-foreground">{engineBadge}</Text>
                </View>
                {languageBadge ? (
                  <View className="rounded-full bg-background px-3 py-1.5">
                    <Text className="text-xs font-medium text-foreground">{languageBadge}</Text>
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-xs text-muted">{storageLabel}</Text>
                {showRetry ? (
                  <TouchableOpacity accessibilityRole="button" onPress={() => void retryQueueItem(queueItem.id)} activeOpacity={0.7}>
                    <Text className="text-xs font-semibold text-primary">Retry transcription</Text>
                  </TouchableOpacity>
                ) : null}
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
