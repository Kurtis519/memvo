import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { buildExportText, parseTranscriptTimeSeconds } from '@/lib/memvo-note-detail';
import { useMemvo } from '@/lib/memvo-store';
import { buildFeedTimestampLabel, formatDuration } from '@/lib/memvo-recording-utils';

const TEAL = '#0F6E56';

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
    if (!duration) {
      return;
    }

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
    deleteNote,
    getNoteById,
    toggleStar,
    updateNoteTags,
    updateNoteTitle,
    userProfile,
  } = useMemvo();
  const note = getNoteById(id);
  const [draftTitle, setDraftTitle] = useState(note?.title ?? '');
  const [draftTags, setDraftTags] = useState(note?.tags.join(', ') ?? '');
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    setDraftTitle(note?.title ?? '');
    setDraftTags(note?.tags.join(', ') ?? '');
  }, [note?.id, note?.title, note?.tags]);

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

  const saveTitle = () => {
    void updateNoteTitle(note.id, draftTitle);
  };

  const saveTags = () => {
    const tags = draftTags
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean);
    void updateNoteTags(note.id, tags);
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

  const transcriptLines = note.transcript ? note.transcript.split(/\n+/).filter(Boolean) : [];
  const isPro = Boolean(userProfile && (userProfile.plan === 'pro' || userProfile.plan === 'admin' || userProfile.isAdmin));
  const summaryText = note.summary || 'Memvo is still preparing this note summary.';
  const visibleSummary = summaryExpanded ? summaryText : summaryText.slice(0, 220);

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
            <TextInput
              value={draftTags}
              onChangeText={setDraftTags}
              onBlur={saveTags}
              onSubmitEditing={saveTags}
              returnKeyType="done"
              placeholder="Add tags separated by commas"
              className="rounded-2xl bg-background px-4 py-3 text-sm text-foreground"
            />
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
    </ScreenContainer>
  );
}
