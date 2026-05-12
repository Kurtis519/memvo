import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import {
  applySpeakerNamesToTranscriptLine,
  buildExportText,
  buildNoteExportFileStem,
  buildPdfHtml,
  getSpeakerDisplayName,
  getSpeakerLabelFromTranscriptLine,
  listTranscriptSpeakers,
  parseTranscriptTimeSeconds,
} from '@/lib/memvo-note-detail';
import {
  buildAiChatUsageLabel,
  resolveAiChatUsageState,
  type MemvoAiChatMessage,
  type MemvoAiChatUsageState,
} from '@/lib/memvo-ai-chat';
import { getMoodAppearance, getSuggestedTags, isJournalStyleNote } from '@/lib/memvo-organization';
import { useMemvo } from '@/lib/memvo-store';
import { buildFeedTimestampLabel, formatDuration } from '@/lib/memvo-recording-utils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';

const TEAL = '#0F6E56';
const TEAL_TINT = '#E1F5EE';

type NoteAiChatMessage = MemvoAiChatMessage & {
  id: string;
};

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
    updateNoteSpeakers,
    userProfile,
    refreshUserProfile,
  } = useMemvo();
  const note = getNoteById(id);
  const [draftTitle, setDraftTitle] = useState(note?.title ?? '');
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState(note?.tags.join(', ') ?? '');
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [speakerEditorOpen, setSpeakerEditorOpen] = useState(false);
  const [activeSpeakerLabel, setActiveSpeakerLabel] = useState<string | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState('');
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiMessages, setAiMessages] = useState<NoteAiChatMessage[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<MemvoAiChatUsageState>(() =>
    resolveAiChatUsageState({
      plan: userProfile?.plan ?? 'free',
      isAdmin: userProfile?.isAdmin,
      aiChatQueriesToday: userProfile?.aiChatQueriesToday ?? 0,
      aiChatResetDate: userProfile?.aiChatResetDate ?? null,
    }),
  );
  const askAiMutation = trpc.memvo.askAiAboutNote.useMutation();

  useEffect(() => {
    setDraftTitle(note?.title ?? '');
    setTagDraft(note?.tags.join(', ') ?? '');
  }, [note?.id, note?.tags, note?.title]);

  useEffect(() => {
    setAiUsage(
      resolveAiChatUsageState({
        plan: userProfile?.plan ?? 'free',
        isAdmin: userProfile?.isAdmin,
        aiChatQueriesToday: userProfile?.aiChatQueriesToday ?? 0,
        aiChatResetDate: userProfile?.aiChatResetDate ?? null,
      }),
    );
  }, [userProfile?.aiChatQueriesToday, userProfile?.aiChatResetDate, userProfile?.isAdmin, userProfile?.plan]);

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
  const transcriptSpeakerLabels = listTranscriptSpeakers(note.transcript);
  const isPro = Boolean(userProfile && (userProfile.plan === 'pro' || userProfile.plan === 'admin' || userProfile.isAdmin));
  const summaryText = note.summary || 'Memvo is still preparing this note summary.';
  const visibleSummary = summaryExpanded ? summaryText : summaryText.slice(0, 220);
  const aiUsageLabel = buildAiChatUsageLabel(aiUsage);
  const moodAppearance = isJournalStyleNote(note) ? getMoodAppearance(note.mood) : null;

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

  const openSpeakerEditor = (speakerLabel: string) => {
    setActiveSpeakerLabel(speakerLabel);
    setSpeakerDraft(note.speakers?.[speakerLabel] ?? '');
    setSpeakerEditorOpen(true);
  };

  const saveSpeakerName = async () => {
    if (!activeSpeakerLabel) {
      setSpeakerEditorOpen(false);
      return;
    }

    const trimmedName = speakerDraft.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Enter a name for this speaker before saving.');
      return;
    }

    await updateNoteSpeakers(note.id, {
      ...(note.speakers ?? {}),
      [activeSpeakerLabel]: trimmedName,
    });
    setSpeakerEditorOpen(false);
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

    const fileStem = buildNoteExportFileStem(note);
    const fileUri = `${directory}${fileStem}.txt`;
    await FileSystem.writeAsStringAsync(fileUri, buildExportText(note));

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Share Memvo note' });
      return;
    }

    Alert.alert('Export saved', `Saved a text export to ${fileUri}`);
  };

  const exportAsPdf = async () => {
    if (!isPro) {
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert('PDF export unavailable', 'PDF export is available in the native iOS and Android app.');
      return;
    }

    const directory = FileSystem.documentDirectory;
    if (!directory) {
      Alert.alert('Export unavailable', 'This device does not expose a writable documents directory right now.');
      return;
    }

    try {
      const fileStem = buildNoteExportFileStem(note);
      const targetUri = `${directory}${fileStem}.pdf`;
      const html = buildPdfHtml(note);
      const { uri } = await Print.printToFileAsync({ html });
      const existingFile = await FileSystem.getInfoAsync(targetUri);
      if (existingFile.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
      await FileSystem.moveAsync({ from: uri, to: targetUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Share Memvo note',
        });
        return;
      }

      Alert.alert('Export saved', `Saved a PDF export to ${targetUri}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Memvo could not generate this PDF right now.';
      Alert.alert('PDF export failed', message);
    }
  };

  const openAiChat = () => {
    if (!note.transcript?.trim()) {
      Alert.alert('Transcript required', 'Ask AI becomes available after this note finishes transcribing.');
      return;
    }

    setAiError(null);
    setAiChatOpen(true);
  };

  const sendAiQuestion = async () => {
    const trimmedQuestion = aiQuestion.trim();
    if (!trimmedQuestion) {
      return;
    }

    if (!note.transcript?.trim()) {
      Alert.alert('Transcript required', 'Ask AI becomes available after this note finishes transcribing.');
      return;
    }

    if (!isSupabaseConfigured) {
      Alert.alert('Ask AI unavailable', 'Ask AI requires the signed-in cloud experience.');
      return;
    }

    if (!aiUsage.isUnlimited && aiUsage.atLimit) {
      setAiError('Upgrade to Pro for unlimited AI chat');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      router.push('/login');
      return;
    }

    setAiError(null);

    try {
      const result = await askAiMutation.mutateAsync({
        accessToken,
        noteId: note.id,
        question: trimmedQuestion,
        history: aiMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      setAiMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: trimmedQuestion,
        },
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.answer,
        },
      ]);
      setAiQuestion('');
      setAiUsage(result.usage);
      await refreshUserProfile().catch(() => null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ask AI could not answer right now.';
      setAiError(message);
    }
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
            {moodAppearance ? (
              <View
                className="self-start rounded-full px-3 py-1.5"
                style={{ backgroundColor: moodAppearance.backgroundColor }}
              >
                <Text style={{ color: moodAppearance.textColor, fontSize: 12, fontWeight: '700' }}>
                  Mood · {moodAppearance.label}
                </Text>
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
            <View className="mt-4 rounded-2xl bg-background px-4 py-4">
              <View className="flex-row items-center justify-between gap-4">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Ask AI</Text>
                  <Text className="mt-1 text-xs text-muted">Ask questions about this one note and get answers grounded in its transcript.</Text>
                  <Text className="mt-2 text-xs font-semibold text-primary">{aiUsageLabel}</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.82}
                  onPress={openAiChat}
                  disabled={!note.transcript?.trim()}
                  style={{ backgroundColor: note.transcript?.trim() ? TEAL : '#B9C2C8', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 }}
                >
                  <Text className="text-sm font-semibold text-white">Ask AI</Text>
                </TouchableOpacity>
              </View>
              {!aiUsage.isUnlimited ? (
                <Text className="mt-3 text-xs leading-5 text-muted">Free includes 3 AI questions per day. Pro unlocks unlimited chat.</Text>
              ) : null}
            </View>
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
                {transcriptSpeakerLabels.length > 0 ? (
                  <View className="mb-1 flex-row flex-wrap gap-2">
                    {transcriptSpeakerLabels.map((speakerLabel) => (
                      <TouchableOpacity
                        key={`${note.id}-${speakerLabel}`}
                        accessibilityRole="button"
                        activeOpacity={0.82}
                        onPress={() => openSpeakerEditor(speakerLabel)}
                        style={{ backgroundColor: '#EEF8F4', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                      >
                        <Text style={{ color: TEAL, fontSize: 12, fontWeight: '700' }}>
                          {getSpeakerDisplayName(speakerLabel, note.speakers)}
                        </Text>
                        <Text style={{ color: '#4B7C6E', fontSize: 11, marginTop: 2 }}>{speakerLabel}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {transcriptLines.map((line, index) => {
                  const seekSeconds = parseTranscriptTimeSeconds(line);
                  const speakerLabel = getSpeakerLabelFromTranscriptLine(line);
                  const visibleLine = applySpeakerNamesToTranscriptLine(line, note.speakers);
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
                      {speakerLabel ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          activeOpacity={0.82}
                          onPress={() => openSpeakerEditor(speakerLabel)}
                          style={{ alignSelf: 'flex-start', backgroundColor: TEAL_TINT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 }}
                        >
                          <Text style={{ color: TEAL, fontSize: 12, fontWeight: '700' }}>
                            {getSpeakerDisplayName(speakerLabel, note.speakers)}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <Text className="text-sm leading-7 text-foreground">{visibleLine}</Text>
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
              {isPro ? (
                <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => void exportAsPdf()} className="rounded-2xl bg-background px-4 py-3">
                  <Text className="text-sm font-semibold text-foreground">Export as PDF</Text>
                </TouchableOpacity>
              ) : (
                <View className="rounded-2xl bg-background px-4 py-3 opacity-60">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-sm font-semibold text-foreground">Export as PDF</Text>
                    <View style={{ backgroundColor: '#EEF2F4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: '#5F6D73', fontSize: 11, fontWeight: '700' }}>Pro only</Text>
                    </View>
                  </View>
                </View>
              )}
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

      <Modal visible={speakerEditorOpen} animationType="slide" transparent onRequestClose={() => setSpeakerEditorOpen(false)}>
        <View className="flex-1 justify-end bg-black/20">
          <View className="rounded-t-[32px] bg-background px-5 pb-8 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Rename speaker</Text>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => setSpeakerEditorOpen(false)}>
                <Text className="text-sm font-semibold text-primary">Close</Text>
              </TouchableOpacity>
            </View>
            <Text className="mt-3 text-sm leading-6 text-muted">
              {activeSpeakerLabel ? `Update ${activeSpeakerLabel} everywhere in this transcript.` : 'Choose a name for this speaker.'}
            </Text>
            <TextInput
              value={speakerDraft}
              onChangeText={setSpeakerDraft}
              placeholder="Enter speaker name"
              placeholderTextColor="#8A9198"
              className="mt-4 rounded-2xl bg-surface px-4 py-4 text-base text-foreground"
              returnKeyType="done"
              onSubmitEditing={() => void saveSpeakerName()}
            />
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.82} onPress={() => void saveSpeakerName()} className="mt-5 rounded-2xl bg-primary px-4 py-4">
              <Text className="text-center text-sm font-semibold text-white">Save speaker</Text>
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

      <Modal visible={aiChatOpen} animationType="slide" transparent onRequestClose={() => setAiChatOpen(false)}>
        <View className="flex-1 justify-end bg-black/20">
          <View className="max-h-[88%] rounded-t-[32px] bg-background px-5 pb-8 pt-5">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground">Ask AI about this note</Text>
                <Text className="mt-1 text-sm text-muted">{aiUsageLabel}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => setAiChatOpen(false)}>
                <Text className="text-sm font-semibold text-primary">Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-4 max-h-[48%]" contentContainerStyle={{ gap: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {aiMessages.length > 0 ? (
                aiMessages.map((message) => (
                  <View
                    key={message.id}
                    style={{
                      alignSelf: message.role === 'user' ? 'flex-end' : 'stretch',
                      backgroundColor: message.role === 'user' ? TEAL : '#F3F5F6',
                      borderRadius: 22,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      maxWidth: '92%',
                    }}
                  >
                    <Text style={{ color: message.role === 'user' ? '#FFFFFF' : '#11212A', fontSize: 14, lineHeight: 22 }}>
                      {message.content}
                    </Text>
                  </View>
                ))
              ) : (
                <View className="rounded-2xl bg-surface px-4 py-4">
                  <Text className="text-sm leading-6 text-muted">Ask follow-up questions about the transcript, summary, action items, or what happened in this note.</Text>
                </View>
              )}
            </ScrollView>

            {aiError ? (
              <View className="mt-4 rounded-2xl bg-[#FEF2F2] px-4 py-3">
                <Text className="text-sm leading-6 text-error">{aiError}</Text>
              </View>
            ) : null}

            <TextInput
              value={aiQuestion}
              onChangeText={setAiQuestion}
              placeholder="Ask a question about this note"
              placeholderTextColor="#8A9198"
              multiline
              textAlignVertical="top"
              className="mt-4 min-h-[110px] rounded-2xl bg-surface px-4 py-4 text-base text-foreground"
            />

            {!aiUsage.isUnlimited && aiUsage.atLimit ? (
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.82} onPress={() => router.push('/paywall')} className="mt-4 rounded-2xl border border-border px-4 py-4">
                <Text className="text-center text-sm font-semibold text-foreground">Go Pro for unlimited AI chat</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.82}
              onPress={() => void sendAiQuestion()}
              disabled={askAiMutation.isPending || !aiQuestion.trim()}
              style={{
                marginTop: 16,
                backgroundColor: askAiMutation.isPending || !aiQuestion.trim() ? '#B9C2C8' : TEAL,
                borderRadius: 18,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              <Text className="text-center text-sm font-semibold text-white">{askAiMutation.isPending ? 'Asking AI…' : 'Send question'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
