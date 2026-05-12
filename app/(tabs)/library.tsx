import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, SectionList, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import {
  MEMVO_MAX_FREE_CUSTOM_FOLDERS,
  buildRecentActivity,
  buildWeeklyMoodInsights,
  buildTimelineSections,
  countCustomFolders,
  filterNotesByFilters,
  getFolderNoteCount,
} from '@/lib/memvo-organization';
import { useMemvo } from '@/lib/memvo-store';
import { buildFeedTimestampLabel, formatDuration } from '@/lib/memvo-recording-utils';

const TEAL = '#0F6E56';
const TEAL_TINT = '#E1F5EE';

function ViewToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.82}
      onPress={onPress}
      style={{
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: active ? TEAL : '#FFFFFF',
        borderWidth: active ? 0 : 1,
        borderColor: '#D6E4DE',
      }}
    >
      <Text style={{ color: active ? '#FFFFFF' : TEAL, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function LibraryScreen() {
  const {
    createFolder,
    deleteFolder,
    folders,
    notes,
    renameFolder,
    userProfile,
  } = useMemvo();
  const [draftFolderName, setDraftFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const canCreateUnlimitedFolders = Boolean(userProfile && (userProfile.plan === 'pro' || userProfile.plan === 'admin' || userProfile.isAdmin || userProfile.manualPro));
  const customFolderCount = countCustomFolders(folders);
  const folderLimitReached = !canCreateUnlimitedFolders && customFolderCount >= MEMVO_MAX_FREE_CUSTOM_FOLDERS;
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;

  const visibleNotes = useMemo(
    () =>
      selectedFolder
        ? filterNotesByFilters(
            notes,
            {
              tag: null,
              folderId: selectedFolder.id,
              dateRange: 'all',
              customStart: null,
              customEnd: null,
            },
            folders,
          )
        : notes,
    [folders, notes, selectedFolder],
  );

  const timelineSections = useMemo(() => buildTimelineSections(visibleNotes), [visibleNotes]);
  const activity = useMemo(() => buildRecentActivity(notes), [notes]);
  const moodInsights = useMemo(() => buildWeeklyMoodInsights(notes), [notes]);

  const handleSubmitFolder = async () => {
    const trimmed = draftFolderName.trim();
    if (!trimmed) {
      return;
    }

    if (!canCreateUnlimitedFolders && folderLimitReached && !editingFolderId) {
      Alert.alert('Folder limit reached', 'Free plans can keep up to three custom folders. Upgrade to Pro to add more folders.', [
        {
          text: 'Maybe later',
          style: 'cancel',
        },
        {
          text: 'Upgrade to Pro',
          onPress: () => {
            router.push('/paywall?trigger=folders');
          },
        },
      ]);
      return;
    }

    if (editingFolderId) {
      await renameFolder(editingFolderId, trimmed);
      setEditingFolderId(null);
    } else {
      const created = await createFolder(trimmed);
      if (!created) {
        Alert.alert('Unable to create folder', 'Choose a different folder name or free up a custom folder slot.');
        return;
      }
    }

    setDraftFolderName('');
  };

  const handleFolderLongPress = (folderId: string) => {
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder || folder.kind !== 'custom') {
      return;
    }

    Alert.alert(folder.name, 'Choose an action for this folder.', [
      {
        text: 'Rename',
        onPress: () => {
          setEditingFolderId(folder.id);
          setDraftFolderName(folder.name);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteFolder(folder.id);
          if (selectedFolderId === folder.id) {
            setSelectedFolderId(null);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <View className="flex-1 gap-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-2">
            <Text className="text-3xl font-bold text-foreground">Library</Text>
            <Text className="text-base leading-6 text-muted">
              Organize notes into folders, keep starred moments close, and review your timeline by date.
            </Text>
          </View>
          <View className="items-end gap-2">
            <View className="flex-row gap-2">
              <ViewToggle label="List" active={viewMode === 'list'} onPress={() => setViewMode('list')} />
              <ViewToggle label="Timeline" active={viewMode === 'timeline'} onPress={() => setViewMode('timeline')} />
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.82}
              onPress={() => {
                if (folderLimitReached && !editingFolderId) {
                  Alert.alert('Folder limit reached', 'Free plans can keep up to three custom folders. Upgrade to Pro to add more folders.', [
                    {
                      text: 'Maybe later',
                      style: 'cancel',
                    },
                    {
                      text: 'Upgrade to Pro',
                      onPress: () => {
                        router.push('/paywall?trigger=folders');
                      },
                    },
                  ]);
                  return;
                }
                setEditingFolderId(null);
                setDraftFolderName((current) => (current ? '' : current));
              }}
              className="rounded-full bg-[#EEF8F4] px-4 py-2"
            >
              <Text className="text-xs font-semibold text-primary">+ New folder</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="rounded-[24px] border border-border bg-surface p-4">
          <Text className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            {editingFolderId ? 'Rename folder' : 'Create folder'}
          </Text>
          <View className="mt-3 flex-row items-center gap-3">
            <View className="flex-1 rounded-2xl bg-background px-4 py-1">
              <TextInput
                value={draftFolderName}
                onChangeText={setDraftFolderName}
                placeholder="Enter a folder name"
                placeholderTextColor="#8A9198"
                className="py-3 text-base text-foreground"
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmitFolder()}
              />
            </View>
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.82} onPress={() => void handleSubmitFolder()} className="rounded-2xl bg-primary px-4 py-3">
              <Text className="text-sm font-semibold text-white">Save</Text>
            </TouchableOpacity>
          </View>
          <Text className="mt-3 text-xs leading-5 text-muted">
            {canCreateUnlimitedFolders
              ? 'Your plan can create as many custom folders as needed.'
              : `Free plan: ${customFolderCount}/${MEMVO_MAX_FREE_CUSTOM_FOLDERS} custom folders used.`}
          </Text>
        </View>

        {selectedFolder ? (
          <View className="flex-row items-center justify-between rounded-2xl bg-[#EEF8F4] px-4 py-3">
            <View>
              <Text className="text-sm font-semibold text-primary">Showing {selectedFolder.name}</Text>
              <Text className="text-xs text-primary/80">{visibleNotes.length} {visibleNotes.length === 1 ? 'note' : 'notes'}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.82} onPress={() => setSelectedFolderId(null)}>
              <Text className="text-xs font-semibold text-primary">Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {canCreateUnlimitedFolders && moodInsights.summary ? (
          <View className="rounded-[24px] border border-border bg-surface p-4">
            <Text className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Mood insights</Text>
            <Text className="mt-3 text-sm leading-6 text-foreground">{moodInsights.summary}</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {moodInsights.items.map((item) => (
                <View
                  key={item.tone}
                  style={{
                    backgroundColor: item.backgroundColor,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: item.textColor, fontSize: 12, fontWeight: '700' }}>
                    {item.label} · {item.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {viewMode === 'list' ? (
          selectedFolder ? (
            <FlatList
              data={visibleNotes}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 48, gap: 14 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => router.push(`/note/${item.id}`)}
                  className="rounded-[28px] border border-border bg-surface p-4"
                >
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-1 gap-1">
                      <Text numberOfLines={1} className="text-base font-semibold text-foreground">{item.title}</Text>
                      <Text className="text-sm text-muted">{buildFeedTimestampLabel(new Date(item.recordedAt))}</Text>
                    </View>
                    {item.isStarred ? (
                      <View className="rounded-full bg-[#EEF8F4] px-3 py-1.5">
                        <Text className="text-xs font-semibold text-primary">★</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={2} className="mt-3 text-sm leading-6 text-muted">
                    {item.summary || item.transcript || 'No transcript available yet.'}
                  </Text>
                  <Text className="mt-3 text-xs text-muted">{formatDuration(item.durationSeconds * 1000)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="rounded-[28px] border border-dashed border-border bg-surface px-5 py-10">
                  <Text className="text-center text-base font-semibold text-foreground">No notes in this folder</Text>
                  <Text className="mt-2 text-center text-sm leading-6 text-muted">
                    Move notes here from note detail to start organizing this folder.
                  </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={folders}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 48, gap: 14 }}
              ListHeaderComponent={
                <View className="mb-4 rounded-[28px] border border-border bg-surface p-5">
                  <Text className="text-base font-semibold text-foreground">Recent activity</Text>
                  <View className="mt-4 flex-row gap-3">
                    <View className="flex-1 rounded-2xl bg-background px-4 py-4">
                      <Text className="text-sm font-semibold text-foreground">Today</Text>
                      <Text className="mt-1 text-2xl font-bold text-primary">{activity.today.count}</Text>
                      <Text className="mt-1 text-xs text-muted">{activity.today.totalMinutes} min recorded</Text>
                    </View>
                    <View className="flex-1 rounded-2xl bg-background px-4 py-4">
                      <Text className="text-sm font-semibold text-foreground">This week</Text>
                      <Text className="mt-1 text-2xl font-bold text-primary">{activity.week.count}</Text>
                      <Text className="mt-1 text-xs text-muted">{activity.week.totalMinutes} min recorded</Text>
                    </View>
                  </View>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => setSelectedFolderId(item.id)}
                  onLongPress={() => handleFolderLongPress(item.id)}
                  className="rounded-[28px] border border-border bg-surface px-4 py-4"
                >
                  <View className="flex-row items-center justify-between gap-4">
                    <View>
                      <Text className="text-base font-semibold text-foreground">{item.name}</Text>
                      <Text className="mt-1 text-sm text-muted">{getFolderNoteCount(item, notes)} notes</Text>
                    </View>
                    <View className="items-end gap-1">
                      {item.kind === 'custom' ? <Text className="text-xs font-semibold text-primary">Hold to edit</Text> : null}
                      <Text className="text-lg text-muted">›</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )
        ) : (
          <SectionList
            sections={timelineSections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 48 }}
            renderSectionHeader={({ section }) => (
              <View className="bg-background py-3">
                <Text className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => router.push(`/note/${item.id}`)}
                className="mb-3 rounded-[24px] border border-border bg-surface px-4 py-3"
              >
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text numberOfLines={1} className="text-sm font-semibold text-foreground">{item.title}</Text>
                    <Text className="mt-1 text-xs text-muted">{buildFeedTimestampLabel(new Date(item.recordedAt))}</Text>
                  </View>
                  <Text className="text-xs text-muted">{formatDuration(item.durationSeconds * 1000)}</Text>
                </View>
                <Text numberOfLines={2} className="mt-2 text-sm leading-6 text-muted">
                  {item.summary || item.transcript || 'No transcript available yet.'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="rounded-[28px] border border-dashed border-border bg-surface px-5 py-10">
                <Text className="text-center text-base font-semibold text-foreground">No notes yet</Text>
                <Text className="mt-2 text-center text-sm leading-6 text-muted">
                  Record a note to start building your library timeline.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}
