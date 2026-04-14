import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ScreenContainer } from '@/components/screen-container';
import { useMemvo } from '@/lib/memvo-store';
import { buildFeedTimestampLabel, formatDuration } from '@/lib/memvo-recording-utils';
import {
  getNoteProcessingLabel,
  getStatusTone,
  normalizeLanguageBadge,
} from '@/lib/memvo-transcription';

const TEAL = '#0F6E56';
const LIGHT_TEAL = '#E1F5EE';
const AMBER = '#A16207';
const AMBER_BG = '#FEF3C7';

type Cluster = {
  id: string;
  label: string;
  count: number;
};

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getDisplayName(email: string | null | undefined) {
  if (!email) {
    return 'there';
  }

  const localPart = email.split('@')[0] ?? '';
  const pieces = localPart
    .split(/[._-]+/)
    .map((piece) => piece.trim())
    .filter(Boolean);

  const firstPiece = pieces[0] ?? localPart;
  return firstPiece ? firstPiece.charAt(0).toUpperCase() + firstPiece.slice(1) : 'there';
}

function getInitials(email: string | null | undefined) {
  const name = getDisplayName(email);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((piece) => piece.charAt(0).toUpperCase())
    .join('');
}

function getStatusClasses(status: ReturnType<typeof getStatusTone>) {
  switch (status) {
    case 'success':
      return {
        badge: 'bg-green-50',
        text: 'text-success',
      };
    case 'error':
      return {
        badge: 'bg-red-50',
        text: 'text-error',
      };
    case 'progress':
    default:
      return {
        badge: 'bg-[#EEF8F4]',
        text: 'text-primary',
      };
  }
}

function buildSummaryPreview(summary: string | null, transcript: string | null, preview: string | null) {
  const source = summary || transcript || preview || 'Queued for transcription...';
  const firstBullet = source
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .find(Boolean);

  return firstBullet || source;
}

function EmptyState() {
  return (
    <View className="mt-12 items-center rounded-[32px] border border-dashed border-border bg-surface px-6 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#EEF8F4]">
        <Text className="text-lg font-semibold text-primary">Mic</Text>
      </View>
      <Text className="mt-5 text-center text-xl font-semibold text-foreground">Your first memory starts here</Text>
      <Text className="mt-2 text-center text-sm leading-6 text-muted">
        Tap the button below to record your first note and Memvo will organise it for you as soon as it is ready.
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const {
    deleteNote,
    isHydrated,
    notes,
    processPendingQueue,
    retryQueueItem,
    syncQueue,
    toggleStar,
    userProfile,
  } = useMemvo();
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  const displayName = useMemo(() => getDisplayName(userProfile?.email), [userProfile?.email]);
  const initials = useMemo(() => getInitials(userProfile?.email), [userProfile?.email]);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date()),
    [],
  );

  const clusters = useMemo<Cluster[]>(() => {
    const counts = new Map<string, number>();

    for (const note of notes) {
      for (const tag of note.tags) {
        const key = tag.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ id: label, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [notes]);

  const canShowClusters = Boolean(userProfile && (userProfile.plan === 'pro' || userProfile.plan === 'admin' || userProfile.isAdmin));

  const filteredNotes = useMemo(() => {
    if (!selectedCluster) {
      return notes;
    }

    return notes.filter((note) => note.tags.includes(selectedCluster));
  }, [notes, selectedCluster]);

  const confirmDelete = (noteId: string) => {
    Alert.alert('Delete note?', 'This removes the note from Memvo and deletes any saved local audio for it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteNote(noteId);
        },
      },
    ]);
  };

  const openContextMenu = (noteId: string, isStarred: boolean) => {
    Alert.alert('Note actions', 'Choose what you want to do with this note.', [
      {
        text: isStarred ? 'Unstar' : 'Star',
        onPress: () => {
          void toggleStar(noteId);
        },
      },
      {
        text: 'Move to folder',
        onPress: () => {
          Alert.alert('Folders coming soon', 'Folder management will be connected in a follow-up task.');
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDelete(noteId),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScreenContainer className="bg-background px-5 pt-4">
      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 180 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void processPendingQueue()} tintColor={TEAL} />}
        ListHeaderComponent={
          <View className="mb-6 gap-5">
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1 gap-2">
                <Text className="text-3xl font-bold text-foreground">{getGreeting()}, {displayName}</Text>
                <Text className="text-sm text-muted">{todayLabel}</Text>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#EEF8F4]">
                <Text className="text-sm font-semibold text-primary">{initials || 'M'}</Text>
              </View>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={() => router.push('/search')}
              className="rounded-2xl border border-border bg-surface px-4 py-4"
            >
              <Text className="text-sm text-muted">Search notes...</Text>
            </TouchableOpacity>

            {canShowClusters && clusters.length > 0 ? (
              <FlatList
                data={clusters}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => {
                  const active = selectedCluster === item.id;
                  return (
                    <TouchableOpacity
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      onPress={() => setSelectedCluster((current) => (current === item.id ? null : item.id))}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderRadius: 20,
                        backgroundColor: active ? TEAL : LIGHT_TEAL,
                      }}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : TEAL, fontWeight: '700' }}>{item.label}</Text>
                      <Text style={{ color: active ? '#DFF7EF' : TEAL, marginTop: 4, fontSize: 12 }}>
                        {item.count} {item.count === 1 ? 'note' : 'notes'}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={isHydrated ? <EmptyState /> : null}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => {
          const recordedAt = new Date(item.recordedAt);
          const durationLabel = formatDuration(item.durationSeconds * 1000);
          const statusLabel = getNoteProcessingLabel(item);
          const statusTone = getStatusTone(item.syncStatus, item.aiProcessingStatus);
          const statusClasses = getStatusClasses(statusTone);
          const queueItem = syncQueue.find((entry) => entry.noteId === item.id);
          const languageBadge = normalizeLanguageBadge(item.languageDetected);
          const summaryPreview = buildSummaryPreview(item.summary, item.transcript, item.transcriptionPreview);
          const visibleTags = item.tags.slice(0, 3);
          const hiddenTagCount = Math.max(0, item.tags.length - visibleTags.length);
          const showRetry = item.syncStatus === 'failed' && queueItem;

          return (
            <Swipeable
              overshootRight={false}
              renderRightActions={() => (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => confirmDelete(item.id)}
                  style={{
                    width: 92,
                    borderRadius: 28,
                    backgroundColor: '#DC2626',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 12,
                  }}
                >
                  <Text className="text-sm font-semibold text-white">Delete</Text>
                </TouchableOpacity>
              )}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/note/${item.id}`)}
                onLongPress={() => openContextMenu(item.id, item.isStarred)}
                style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                className="rounded-[28px] border border-border bg-surface p-4"
              >
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1 gap-1">
                    <Text numberOfLines={1} className="text-lg font-semibold text-foreground">{item.title}</Text>
                    <Text className="text-sm text-muted">
                      {buildFeedTimestampLabel(recordedAt)} · {durationLabel}
                    </Text>
                  </View>
                  {item.isStarred ? (
                    <View className="rounded-full bg-[#EEF8F4] px-2.5 py-1">
                      <Text className="text-xs font-semibold text-primary">★</Text>
                    </View>
                  ) : null}
                </View>

                <Text numberOfLines={2} className="mt-3 text-sm leading-6 text-muted">
                  {summaryPreview}
                </Text>

                <View className="mt-3 flex-row flex-wrap items-center gap-2">
                  {visibleTags.map((tag) => (
                    <View key={`${item.id}-${tag}`} className="rounded-full bg-[#EEF8F4] px-3 py-1.5">
                      <Text className="text-xs font-medium text-primary">#{tag}</Text>
                    </View>
                  ))}
                  {hiddenTagCount > 0 ? (
                    <View className="rounded-full bg-background px-3 py-1.5">
                      <Text className="text-xs font-medium text-muted">+{hiddenTagCount} more</Text>
                    </View>
                  ) : null}
                  {item.actionItems.length > 0 ? (
                    <View style={{ backgroundColor: AMBER_BG, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: AMBER, fontSize: 12, fontWeight: '600' }}>
                        {item.actionItems.length} {item.actionItems.length === 1 ? 'task' : 'tasks'}
                      </Text>
                    </View>
                  ) : null}
                  {languageBadge ? (
                    <View className="rounded-full bg-background px-3 py-1.5">
                      <Text className="text-xs font-medium text-muted">{languageBadge}</Text>
                    </View>
                  ) : null}
                </View>

                <View className="mt-3 flex-row flex-wrap items-center gap-2">
                  <View className={`rounded-full px-3 py-1.5 ${statusClasses.badge}`}>
                    <Text className={`text-xs font-medium ${statusClasses.text}`}>{statusLabel}</Text>
                  </View>
                  {item.aiProcessingStatus === 'processing' ? (
                    <View className="rounded-full bg-[#EEF8F4] px-3 py-1.5">
                      <Text className="text-xs font-medium text-primary">Analysing...</Text>
                    </View>
                  ) : null}
                  {item.syncStatus === 'transcribing' ? (
                    <View className="rounded-full bg-[#EEF8F4] px-3 py-1.5">
                      <Text className="text-xs font-medium text-primary">Transcribing...</Text>
                    </View>
                  ) : null}
                </View>

                {showRetry ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    onPress={() => void retryQueueItem(queueItem.id)}
                    className="mt-3 self-start rounded-full bg-background px-3 py-2"
                  >
                    <Text className="text-xs font-semibold text-primary">Retry transcription</Text>
                  </TouchableOpacity>
                ) : null}
              </Pressable>
            </Swipeable>
          );
        }}
      />

      <View className="absolute bottom-8 left-0 right-0 items-center">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/record')}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
        >
          <View
            style={{
              height: 72,
              width: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: TEAL,
              shadowColor: TEAL,
              shadowOpacity: 0.18,
              shadowOffset: { width: 0, height: 10 },
              shadowRadius: 22,
              elevation: 8,
            }}
          >
            <Text className="text-sm font-semibold text-white">Record</Text>
          </View>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
