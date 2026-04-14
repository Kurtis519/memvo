import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { buildExportText, parseTranscriptTimeSeconds } from '@/lib/memvo-note-detail';
import { getSuggestedTags } from '@/lib/memvo-organization';
import { useMemvo } from '@/lib/memvo-store';
import { buildFeedTimestampLabel, formatDuration } from '@/lib/memvo-recording-utils';

const TEAL = '#0F6E56';
const TEAL_TINT = '#E1F5EE';

function AudioPlayerBar({ uri }: { uri: string }) {
  const player = useMemo(() => createAudioPlayer({ uri }), [uri]);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
    return () => {
      player.remove();
    };
  }, [player]);

  const duration = Math.max(0, status.duration || 0);
  const current = Math.min(status.currentTime || 0, duration || 0);
  const progress = duration > 0 ? current / duration : 0;

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
      return;
    }

    if (duration > 0 && current >= duration) {
      player.seekTo(0);
    }

    player.play();
  };

  const seekToRatio = (ratio: number) => {
    if (!duration) return;
    player.seekTo(duration * ratio);
  };

  return (
    <View className="rounded-[28px] border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between gap-4">
        <View>
          <Text className="text-sm font-semibold text-foreground">Playback</Text>
          <Text className="mt-1 text-xs text-muted">
            {formatDuration(current * 1000)} / {formatDuration(duration * 1000)}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.8}
          onPress={togglePlayback}
          style={{ backgroundColor: TEAL, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}
        >
          <Text className="text-sm font-semibold text-white">{status.playing ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-4 gap-3">
        <Pressable accessibilityRole="adjustable" onPress={() => seekToRatio(Math.min(progress + 0.1, 1))}>
          <View className="h-2 overflow-hidden rounded-full bg-background">
            <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: TEAL }} />
          </View>
        </Pressable>
        <View className="flex-row justify-between">
          <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => seekToRatio(Math.max(progress - 0.1, 0))}>
            <Text className="text-xs font-medium text-primary">Back 10%</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => seekToRatio(Math.min(progress + 0.1, 1))}>
            <Text className="text-xs font-medium text-primary">Forward 10%</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    deleteFolder,
    deleteNote,
    folders,
    getFolderById,
    getNoteById,
    moveNoteToFolder,
    notes,
    toggleStar,
    updateNoteTags,
    updateNoteTitle,
    userProfile,
  } = useMemvo();
  const note = getNoteById(id);
  const [draftTitle, setDraftTitle] = useState(note?.title ?? '');
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState(note?.tags.join(', ') ?? '');
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    setDraftTitle(note?.title ?? '');
    setTagDraft(note?.tags.join(', ') ?? '');
  }, [note?.id, note?.tags, note?.title]);

  if (!note) {
    return (
      <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-lg font-semibold text-foreground">Note not found</Text>
          <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => router.back()}>
            <Text className="text-sm font-semibold text-primary">Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const currentFolder = getFolderById(note.folderId);
  const suggestedTags = getSuggestedTags(notes, note.tags);
  const transcriptLines = note.transcript ? note.transcript.split(/\n+/).filter(Boolean) : [];
  const isPro = Boolean(userProfile && (userProfile.plan === 'pro' || userProfile.plan === 'admin' || userProfile.isAdmin));
  const summaryText = note.summary || 'Memvo is still preparing this note summary.';
  const visibleSummary = summaryExpanded ? summaryText : summaryText.slice(0, 220);

  const saveTitle = () => {
    void updateNoteTitle(note.id, draftTitle);
  };

  const saveTags = async () => {
    const tags = [...new Set(tagDraft.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean))];
    await updateNoteTags(note.id, tags);
    setTagDraft(tags.join(', '));
    setTagEditorOpen(false);
  };

  const addSuggestedTag = (tag: string) => {
    const currentTags = tagDraft.split(',').map((value) => value.trim().replace(/^#/, '')).filter(Boolean);
    if (currentTags.includes(tag)) {
      return;
    }
    setTagDraft([...currentTags, tag].join(', '));
  };

  const copyTranscript = async () => {
    if (!note.transcript) {
      Alert.alert('Transcript unavailable', 'This note does not have a transcript yet.');
      return;
    }

    await Clipboard.setStringAsync(note.transcript);
    Alert.alert('Copied', 'The transcript has been copied to your clipboard.');
  };

  const copySummary = async () => {
    const summary = note.summary || note.transcript;
    if (!summary) {
      Alert.alert('Summary unavailable', 'This note does not have a summary yet.');
      return;
    }

    await Clipboard.setStringAsync(summary);
    Alert.alert('Copied', 'The note summary has been copied to your clipboard.');
  };

  const exportAsText = async () => {
    const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!directory) {
      Alert.alert('Export unavailable', 'This device does not expose a writable directory right now.');
      return;
    }

    const filename = `${note.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'memvo-note'}.txt`;
    const fileUri = `${directory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, buildExportText(note));

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Share Memvo note' });
      return;
    }

    Alert.alert('Export saved', `Saved a text export to ${fileUri}`);
  };

  const handleDelete = () => {
    Alert.alert('Delete note?', 'This action removes the note and its local audio from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteNote(note.id).then(() => router.replace('/'));
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-4 pb-8">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="gap-5">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => router.back()}>
              <Text className="text-sm font-semibold text-primary">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => void toggleStar(note.id)}>
              <Text className="text-sm font-semibold text-primary">{note.isStarred ? 'Unstar' : 'Star'}</Text>
            </TouchableOpacity>
          </View>

          <View className="gap-3 rounded-[28px] border border-border bg-surface p-4">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {buildFeedTimestampLabel(new Date(note.recordedAt))} · {formatDuration(note.durationSeconds * 1000)}
            </Text>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              onBlur={saveTitle}
              onSubmitEditing={saveTitle}
              returnKeyType="done"
              placeholder="Untitled note"
              className="text-3xl font-bold text-foreground"
            />
            {note.mood ? (
              <View className="self-start rounded-full bg-[#EEF8F4] px-3 py-1.5">
                <Text className="text-xs font-semibold capitalize text-primary">Mood · {note.mood}</Text>
              </View>
            ) : null}
            <View className="gap-3 rounded-2xl bg-background px-4 py-4">
              <View className="flex-row items-center justify-between gap-4">
                <Text className="text-sm font-semibold text-foreground">Tags</Text>
                <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => setTagEditorOpen(true)}>
                  <Text className="text-xs font-semibold text-primary">Edit</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {note.tags.length > 0 ? (
                  note.tags.map((tag) => (
                    <TouchableOpacity
                      key={`${note.id}-${tag}`}
                      accessibilityRole="button"
                      activeOpacity={0.82}
                      onPress={() => setTagEditorOpen(true)}
                      style={{ backgroundColor: TEAL_TINT, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                    >
                      <Text style={{ color: TEAL, fontSize: 12, fontWeight: '700' }}>#{tag}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text className="text-sm text-muted">Add tags to make this note easier to find.</Text>
                )}
              </View>
              {suggestedTags.length > 0 ? (
                <View className="gap-2">
                  <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Suggested tags</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {suggestedTags.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        accessibilityRole="button"
                        activeOpacity={0.82}
                        onPress={() => {
                          addSuggestedTag(tag);
                          setTagEditorOpen(true);
                        }}
                        className="rounded-full border border-border px-3 py-2"
                      >
                        <Text className="text-xs font-semibold text-foreground">+ {tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {note.audioPath ? <AudioPlayerBar uri={note.audioPath} /> : null}

          <View className="rounded-[28px] border border-border bg-surface p-4">
            <View className="flex-row items-center justify-between gap-4">
              <Text className="text-base font-semibold text-foreground">Summary</Text>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => setSummaryExpanded((value) => !value)}>
                <Text className="text-xs font-semibold text-primary">{summaryExpanded ? 'Collapse' : 'Expand'}</Text>
              </TouchableOpacity>
            </View>
            <Text className="mt-3 text-sm leading-7 text-muted">
              {visibleSummary}
              {!summaryExpanded && summaryText.length > 220 ? '…' : ''}
            </Text>
          </View>

          <View className="rounded-[28px] border border-border bg-surface p-4">
            <Text className="text-base font-semibold text-foreground">Action items</Text>
            {note.actionItems.length > 0 ? (
              <View className="mt-3 gap-3">
                {note.actionItems.map((item, index) => (
                  <View key={`${note.id}-action-${index}`} className="flex-row gap-3">
                    <Text className="text-sm font-semibold text-primary">{index + 1}.</Text>
                    <Text className="flex-1 text-sm leading-6 text-muted">{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="mt-3 text-sm leading-6 text-muted">No action items have been extracted for this note yet.</Text>
            )}
          </View>

          <View className="rounded-[28px] border border-border bg-surface p-4">
            <View className="flex-row items-center justify-between gap-4">
              <Text className="text-base font-semibold text-foreground">Transcript</Text>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => void copyTranscript()}>
                <Text className="text-xs font-semibold text-primary">Copy</Text>
              </TouchableOpacity>
            </View>
            {transcriptLines.length > 0 ? (
              <View className="mt-3 gap-3">
                {transcriptLines.map((line, index) => {
                  const seekSeconds = parseTranscriptTimeSeconds(line);
                  return (
                    <TouchableOpacity
                      key={`${note.id}-line-${index}`}
                      accessibilityRole="button"
                      activeOpacity={seekSeconds !== null ? 0.7 : 1}
                      onPress={() => {
                        if (seekSeconds === null) {
                          return;
                        }
                        Alert.alert('Playback shortcut', `Jump playback from the player controls to ${formatDuration(seekSeconds * 1000)}.`);
                      }}
                    >
                      <Text className="text-sm leading-7 text-foreground">{line}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text className="mt-3 text-sm leading-6 text-muted">A transcript will appear here after processing finishes.</Text>
            )}
          </View>

          <View className="rounded-[28px] border border-border bg-surface p-4">
            <Text className="text-base font-semibold text-foreground">Actions</Text>
            <View className="mt-4 gap-3">
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => setFolderPickerOpen(true)} className="rounded-2xl bg-background px-4 py-3">
                <Text className="text-sm font-semibold text-foreground">
                  {currentFolder ? `Move from ${currentFolder.name}` : 'Move to folder'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => void toggleStar(note.id)} className="rounded-2xl bg-background px-4 py-3">
                <Text className="text-sm font-semibold text-foreground">{note.isStarred ? 'Remove star' : 'Star this note'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => void copySummary()} className="rounded-2xl bg-background px-4 py-3">
                <Text className="text-sm font-semibold text-foreground">Copy summary</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => void exportAsText()} className="rounded-2xl bg-background px-4 py-3">
                <Text className="text-sm font-semibold text-foreground">Export as .txt</Text>
              </TouchableOpacity>
              <View className="rounded-2xl bg-background px-4 py-3 opacity-60">
                <Text className="text-sm font-semibold text-foreground">Export as PDF {isPro ? '(coming soon)' : '(Pro only)'}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={handleDelete} className="rounded-2xl bg-[#FEF2F2] px-4 py-3">
                <Text className="text-sm font-semibold text-error">Delete note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={tagEditorOpen} animationType="slide" transparent onRequestClose={() => setTagEditorOpen(false)}>
        <View className="flex-1 justify-end bg-black/20">
          <View className="rounded-t-[32px] bg-background px-5 pb-8 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Edit tags</Text>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => setTagEditorOpen(false)}>
                <Text className="text-sm font-semibold text-primary">Close</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={tagDraft}
              onChangeText={setTagDraft}
              placeholder="work, strategy, follow-up"
              placeholderTextColor="#8A9198"
              className="mt-4 rounded-2xl bg-surface px-4 py-4 text-base text-foreground"
              returnKeyType="done"
              onSubmitEditing={() => void saveTags()}
            />
            {suggestedTags.length > 0 ? (
              <View className="mt-4 gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Suggestions</Text>
                <View className="flex-row flex-wrap gap-2">
                  {suggestedTags.map((tag) => (
                    <TouchableOpacity
                      key={`suggestion-${tag}`}
                      accessibilityRole="button"
                      activeOpacity={0.82}
                      onPress={() => addSuggestedTag(tag)}
                      className="rounded-full border border-border px-3 py-2"
                    >
                      <Text className="text-xs font-semibold text-foreground">+ {tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.82} onPress={() => void saveTags()} className="mt-5 rounded-2xl bg-primary px-4 py-4">
              <Text className="text-center text-sm font-semibold text-white">Save tags</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={folderPickerOpen} animationType="slide" transparent onRequestClose={() => setFolderPickerOpen(false)}>
        <View className="flex-1 justify-end bg-black/20">
          <View className="rounded-t-[32px] bg-background px-5 pb-8 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Move to folder</Text>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => setFolderPickerOpen(false)}>
                <Text className="text-sm font-semibold text-primary">Close</Text>
              </TouchableOpacity>
            </View>
            <View className="mt-4 gap-3">
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.82}
                onPress={() => {
                  void moveNoteToFolder(note.id, null);
                  setFolderPickerOpen(false);
                }}
                className="rounded-2xl bg-surface px-4 py-4"
              >
                <Text className="text-sm font-semibold text-foreground">Remove from folder</Text>
              </TouchableOpacity>
              {folders.filter((folder) => folder.slug !== 'all-notes' && folder.slug !== 'starred').map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  accessibilityRole="button"
                  activeOpacity={0.82}
                  onPress={() => {
                    void moveNoteToFolder(note.id, folder.id);
                    setFolderPickerOpen(false);
                  }}
                  className="rounded-2xl bg-surface px-4 py-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-foreground">{folder.name}</Text>
                    {note.folderId === folder.id ? <Text className="text-xs font-semibold text-primary">Current</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
