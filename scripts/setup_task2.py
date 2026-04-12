from pathlib import Path
from textwrap import dedent

ROOT = Path('/home/ubuntu/memvo')

files = {
    ROOT / 'lib' / 'memvo-domain.ts': dedent('''
        export type MemvoPlan = 'free' | 'pro';
        export type MemvoFolderKind = 'system' | 'custom';
        export type MemvoSyncStatus = 'pending' | 'uploading' | 'transcribing' | 'complete' | 'failed';
        export type MemvoFeature =
          | 'record'
          | 'offlinePlayback'
          | 'serverTranscription'
          | 'claudeSummary'
          | 'priorityProcessing'
          | 'manualProGrant'
          | 'adminPanel';

        export interface MemvoUserProfile {
          id: string;
          email: string | null;
          plan: MemvoPlan;
          isAdmin: boolean;
          createdAt: string;
          updatedAt: string;
        }

        export interface MemvoFolder {
          id: string;
          userId: string;
          name: string;
          kind: MemvoFolderKind;
          createdAt: string;
          updatedAt: string;
        }

        export interface MemvoNote {
          id: string;
          userId: string | null;
          folderId: string | null;
          title: string;
          createdAt: string;
          updatedAt: string;
          recordedAt: string;
          audioPath: string;
          durationSeconds: number;
          syncStatus: MemvoSyncStatus;
          transcript: string | null;
          summary: string | null;
          actionItems: string[];
          tags: string[];
          localOnly: boolean;
        }

        export interface MemvoSyncQueueItem {
          id: string;
          noteId: string;
          localUri: string;
          status: MemvoSyncStatus;
          retryCount: number;
          errorMessage: string | null;
          remoteQueueId: string | null;
          fileSizeBytes: number | null;
          createdAt: string;
          updatedAt: string;
          lastAttemptAt: string | null;
        }

        export interface MemvoReferral {
          id: string;
          referrerUserId: string;
          referredEmail: string;
          status: 'pending' | 'accepted' | 'rewarded';
          createdAt: string;
          updatedAt: string;
        }

        export const MEMVO_PLAN_FEATURES: Record<MemvoPlan, MemvoFeature[]> = {
          free: ['record', 'offlinePlayback'],
          pro: ['record', 'offlinePlayback', 'serverTranscription', 'claudeSummary', 'priorityProcessing'],
        };

        export function canUseMemvoFeature(
          planOrProfile: MemvoPlan | Pick<MemvoUserProfile, 'plan' | 'isAdmin'>,
          feature: MemvoFeature,
        ) {
          const plan = typeof planOrProfile === 'string' ? planOrProfile : planOrProfile.plan;
          const isAdmin = typeof planOrProfile === 'string' ? false : Boolean(planOrProfile.isAdmin);

          if (isAdmin && (feature === 'manualProGrant' || feature === 'adminPanel')) {
            return true;
          }

          return MEMVO_PLAN_FEATURES[plan].includes(feature);
        }
    ''').strip() + '\n',
    ROOT / 'lib' / 'memvo-recording-utils.ts': dedent('''
        import type { MemvoSyncQueueItem, MemvoSyncStatus } from '@/lib/memvo-domain';

        export const MEMVO_AUDIO_DIRECTORY = 'memvo/recordings';
        export const MEMVO_NOTES_STORAGE_KEY = '@memvo/notes/v2';
        export const MEMVO_QUEUE_STORAGE_KEY = '@memvo/sync-queue/v2';
        export const MEMVO_PERMISSION_PROMPT_KEY = '@memvo/permission/microphone-explained';

        export function formatDuration(durationMillis: number) {
          const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
          const minutes = Math.floor(totalSeconds / 60)
            .toString()
            .padStart(2, '0');
          const seconds = (totalSeconds % 60).toString().padStart(2, '0');
          return `${minutes}:${seconds}`;
        }

        export function buildTemporaryNoteTitle(date: Date) {
          const dateLabel = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
          }).format(date);
          const timeLabel = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }).format(date);
          return `Voice note — ${dateLabel}, ${timeLabel}`;
        }

        export function buildFeedTimestampLabel(date: Date) {
          const now = new Date();
          const isSameDay = now.toDateString() === date.toDateString();
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const timeLabel = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }).format(date);

          if (isSameDay) {
            return `Today · ${timeLabel}`;
          }

          if (yesterday.toDateString() === date.toDateString()) {
            return `Yesterday · ${timeLabel}`;
          }

          const dateLabel = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
          }).format(date);
          return `${dateLabel} · ${timeLabel}`;
        }

        export function normalizeMeteringToBarHeight(metering: number | undefined, index: number) {
          if (typeof metering !== 'number' || Number.isNaN(metering)) {
            return 18 + ((index % 4) * 6);
          }

          const normalized = Math.min(1, Math.max(0, (metering + 60) / 60));
          return 16 + normalized * 72;
        }

        export function getRetryableQueueStatus(item: MemvoSyncQueueItem): MemvoSyncStatus {
          if (item.retryCount >= 3) {
            return 'failed';
          }
          return item.status === 'failed' ? 'pending' : item.status;
        }
    ''').strip() + '\n',
    ROOT / 'lib' / 'memvo-store.tsx': dedent('''
        import AsyncStorage from '@react-native-async-storage/async-storage';
        import * as Network from 'expo-network';
        import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

        import type { MemvoNote, MemvoSyncQueueItem } from '@/lib/memvo-domain';
        import {
          MEMVO_NOTES_STORAGE_KEY,
          MEMVO_QUEUE_STORAGE_KEY,
          buildTemporaryNoteTitle,
          getRetryableQueueStatus,
        } from '@/lib/memvo-recording-utils';
        import { isSupabaseConfigured, supabase } from '@/lib/supabase';

        type RecordingSaveInput = {
          localUri: string;
          durationSeconds: number;
          fileSizeBytes: number | null;
        };

        type MemvoContextValue = {
          notes: MemvoNote[];
          syncQueue: MemvoSyncQueueItem[];
          isHydrated: boolean;
          isOnline: boolean;
          addLocalRecording: (input: RecordingSaveInput) => Promise<MemvoNote>;
          processPendingQueue: () => Promise<void>;
        };

        const MemvoContext = createContext<MemvoContextValue | null>(null);

        function sortNotes(notes: MemvoNote[]) {
          return [...notes].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
        }

        function createId(prefix: string) {
          return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        }

        export function MemvoProvider({ children }: PropsWithChildren) {
          const [notes, setNotes] = useState<MemvoNote[]>([]);
          const [syncQueue, setSyncQueue] = useState<MemvoSyncQueueItem[]>([]);
          const [isHydrated, setIsHydrated] = useState(false);
          const [isOnline, setIsOnline] = useState(true);
          const processingRef = useRef(false);

          useEffect(() => {
            let isMounted = true;

            const hydrate = async () => {
              try {
                const [storedNotes, storedQueue, networkState] = await Promise.all([
                  AsyncStorage.getItem(MEMVO_NOTES_STORAGE_KEY),
                  AsyncStorage.getItem(MEMVO_QUEUE_STORAGE_KEY),
                  Network.getNetworkStateAsync(),
                ]);

                if (!isMounted) return;

                setNotes(storedNotes ? sortNotes(JSON.parse(storedNotes) as MemvoNote[]) : []);
                setSyncQueue(storedQueue ? (JSON.parse(storedQueue) as MemvoSyncQueueItem[]) : []);
                setIsOnline(Boolean(networkState.isInternetReachable ?? networkState.isConnected ?? false));
              } catch (error) {
                console.error('Failed to hydrate Memvo store', error);
              } finally {
                if (isMounted) {
                  setIsHydrated(true);
                }
              }
            };

            hydrate();

            const subscription = Network.addNetworkStateListener((state) => {
              setIsOnline(Boolean(state.isInternetReachable ?? state.isConnected ?? false));
            });

            return () => {
              isMounted = false;
              subscription.remove();
            };
          }, []);

          useEffect(() => {
            if (!isHydrated) return;
            AsyncStorage.setItem(MEMVO_NOTES_STORAGE_KEY, JSON.stringify(notes)).catch((error) => {
              console.error('Failed to persist Memvo notes', error);
            });
          }, [isHydrated, notes]);

          useEffect(() => {
            if (!isHydrated) return;
            AsyncStorage.setItem(MEMVO_QUEUE_STORAGE_KEY, JSON.stringify(syncQueue)).catch((error) => {
              console.error('Failed to persist Memvo queue', error);
            });
          }, [isHydrated, syncQueue]);

          const updateQueueItem = useCallback((queueId: string, updater: (item: MemvoSyncQueueItem) => MemvoSyncQueueItem) => {
            setSyncQueue((current) => current.map((item) => (item.id === queueId ? updater(item) : item)));
          }, []);

          const pushPendingQueueRow = useCallback(async (note: MemvoNote, queueItem: MemvoSyncQueueItem) => {
            if (!isSupabaseConfigured || !isOnline) {
              return;
            }

            const payload = {
              id: queueItem.id,
              note_id: note.id,
              local_uri: queueItem.localUri,
              status: 'pending',
              retry_count: queueItem.retryCount,
              error_message: null,
            };

            const { data, error } = await supabase.from('sync_queue').insert(payload).select('id').single();

            if (error) {
              throw error;
            }

            updateQueueItem(queueItem.id, (current) => ({
              ...current,
              remoteQueueId: data?.id ?? current.remoteQueueId,
              updatedAt: new Date().toISOString(),
              errorMessage: null,
            }));
          }, [isOnline, updateQueueItem]);

          const addLocalRecording = useCallback(async ({ localUri, durationSeconds, fileSizeBytes }: RecordingSaveInput) => {
            const now = new Date();
            const nowIso = now.toISOString();
            const note: MemvoNote = {
              id: createId('note'),
              userId: null,
              folderId: null,
              title: buildTemporaryNoteTitle(now),
              createdAt: nowIso,
              updatedAt: nowIso,
              recordedAt: nowIso,
              audioPath: localUri,
              durationSeconds,
              syncStatus: 'pending',
              transcript: null,
              summary: 'Transcribing...',
              actionItems: [],
              tags: [],
              localOnly: true,
            };

            const queueItem: MemvoSyncQueueItem = {
              id: createId('queue'),
              noteId: note.id,
              localUri,
              status: 'pending',
              retryCount: 0,
              errorMessage: null,
              remoteQueueId: null,
              fileSizeBytes,
              createdAt: nowIso,
              updatedAt: nowIso,
              lastAttemptAt: null,
            };

            setNotes((current) => sortNotes([note, ...current]));
            setSyncQueue((current) => [queueItem, ...current]);

            try {
              await pushPendingQueueRow(note, queueItem);
            } catch (error) {
              console.error('Unable to create remote sync_queue row yet', error);
            }

            return note;
          }, [pushPendingQueueRow]);

          const processPendingQueue = useCallback(async () => {
            if (processingRef.current || !isOnline || !isSupabaseConfigured) {
              return;
            }

            processingRef.current = true;

            try {
              for (const item of syncQueue) {
                if (item.remoteQueueId || item.retryCount >= 3) {
                  continue;
                }

                const note = notes.find((candidate) => candidate.id == item.noteId);
                if (!note) {
                  continue;
                }

                const nextStatus = getRetryableQueueStatus(item);
                updateQueueItem(item.id, (current) => ({
                  ...current,
                  status: nextStatus,
                  lastAttemptAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }));

                try {
                  await pushPendingQueueRow(note, { ...item, status: nextStatus });
                } catch (error) {
                  updateQueueItem(item.id, (current) => ({
                    ...current,
                    status: 'failed',
                    retryCount: current.retryCount + 1,
                    errorMessage: error instanceof Error ? error.message : 'Unknown sync error',
                    lastAttemptAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }));
                }
              }
            } finally {
              processingRef.current = false;
            }
          }, [isOnline, notes, pushPendingQueueRow, syncQueue, updateQueueItem]);

          useEffect(() => {
            if (!isHydrated || !isOnline) {
              return;
            }
            processPendingQueue().catch((error) => {
              console.error('Failed to process pending queue', error);
            });
          }, [isHydrated, isOnline, processPendingQueue]);

          const value = useMemo(
            () => ({
              notes,
              syncQueue,
              isHydrated,
              isOnline,
              addLocalRecording,
              processPendingQueue,
            }),
            [addLocalRecording, isHydrated, isOnline, notes, processPendingQueue, syncQueue],
          );

          return <MemvoContext.Provider value={value}>{children}</MemvoContext.Provider>;
        }

        export function useMemvo() {
          const context = useContext(MemvoContext);
          if (!context) {
            throw new Error('useMemvo must be used inside MemvoProvider');
          }
          return context;
        }
    ''').strip() + '\n',
    ROOT / 'app' / '_layout.tsx': dedent('''
        import '@/global.css';
        import '@/lib/_core/nativewind-pressable';
        import { initManusRuntime, subscribeSafeAreaInsets } from '@/lib/_core/manus-runtime';
        import { MemvoProvider } from '@/lib/memvo-store';
        import { ThemeProvider } from '@/lib/theme-provider';
        import { trpc, createTRPCClient } from '@/lib/trpc';
        import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
        import { Stack } from 'expo-router';
        import { StatusBar } from 'expo-status-bar';
        import { useCallback, useEffect, useMemo, useState } from 'react';
        import { Platform } from 'react-native';
        import { GestureHandlerRootView } from 'react-native-gesture-handler';
        import 'react-native-reanimated';
        import {
          SafeAreaFrameContext,
          SafeAreaInsetsContext,
          SafeAreaProvider,
          initialWindowMetrics,
          type EdgeInsets,
          type Metrics,
          type Rect,
        } from 'react-native-safe-area-context';

        const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
        const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

        export const unstable_settings = {
          anchor: '(tabs)',
        };

        export default function RootLayout() {
          const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
          const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
          const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
          const [frame, setFrame] = useState<Rect>(initialFrame);

          useEffect(() => {
            initManusRuntime();
          }, []);

          const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
            setInsets(metrics.insets);
            setFrame(metrics.frame);
          }, []);

          useEffect(() => {
            if (Platform.OS !== 'web') return;
            const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
            return () => unsubscribe();
          }, [handleSafeAreaUpdate]);

          const [queryClient] = useState(
            () =>
              new QueryClient({
                defaultOptions: {
                  queries: {
                    refetchOnWindowFocus: false,
                    retry: 1,
                  },
                },
              }),
          );
          const [trpcClient] = useState(() => createTRPCClient());

          const providerInitialMetrics = useMemo(() => {
            const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
            return {
              ...metrics,
              insets: {
                ...metrics.insets,
                top: Math.max(metrics.insets.top, 16),
                bottom: Math.max(metrics.insets.bottom, 12),
              },
            };
          }, [initialInsets, initialFrame]);

          const content = (
            <GestureHandlerRootView style={{ flex: 1 }}>
              <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                  <MemvoProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="oauth/callback" />
                    </Stack>
                    <StatusBar style="auto" />
                  </MemvoProvider>
                </QueryClientProvider>
              </trpc.Provider>
            </GestureHandlerRootView>
          );

          if (Platform.OS === 'web') {
            return (
              <ThemeProvider>
                <SafeAreaProvider initialMetrics={providerInitialMetrics}>
                  <SafeAreaFrameContext.Provider value={frame}>
                    <SafeAreaInsetsContext.Provider value={insets}>{content}</SafeAreaInsetsContext.Provider>
                  </SafeAreaFrameContext.Provider>
                </SafeAreaProvider>
              </ThemeProvider>
            );
          }

          return (
            <ThemeProvider>
              <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
            </ThemeProvider>
          );
        }
    ''').strip() + '\n',
    ROOT / 'app' / '(tabs)' / 'index.tsx': dedent('''
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
    ''').strip() + '\n',
    ROOT / 'app' / '(tabs)' / 'record.tsx': dedent('''
        import AsyncStorage from '@react-native-async-storage/async-storage';
        import { router } from 'expo-router';
        import * as FileSystem from 'expo-file-system/legacy';
        import { Audio, type RecordingStatus } from 'expo-av';
        import { useKeepAwake } from 'expo-keep-awake';
        import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
        import { Alert, Text, TouchableOpacity, View } from 'react-native';

        import { ScreenContainer } from '@/components/screen-container';
        import { useMemvo } from '@/lib/memvo-store';
        import {
          MEMVO_AUDIO_DIRECTORY,
          MEMVO_PERMISSION_PROMPT_KEY,
          formatDuration,
          normalizeMeteringToBarHeight,
        } from '@/lib/memvo-recording-utils';

        const TEAL = '#0F6E56';
        const BAR_COUNT = 28;

        const RECORDING_OPTIONS: Audio.RecordingOptions = {
          isMeteringEnabled: true,
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.MEDIUM,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 64000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/mp4',
            bitsPerSecond: 64000,
          },
        };

        async function ensureMicrophonePermission() {
          const promptShown = await AsyncStorage.getItem(MEMVO_PERMISSION_PROMPT_KEY);
          if (!promptShown) {
            Alert.alert(
              'Allow microphone access',
              'Memvo records private voice notes locally on your device first, then syncs them when you are connected.',
            );
            await AsyncStorage.setItem(MEMVO_PERMISSION_PROMPT_KEY, 'true');
          }

          const permission = await Audio.requestPermissionsAsync();
          return permission.granted;
        }

        async function persistRecordingLocally(sourceUri: string) {
          const directoryUri = `${FileSystem.documentDirectory}${MEMVO_AUDIO_DIRECTORY}`;
          const directoryInfo = await FileSystem.getInfoAsync(directoryUri);
          if (!directoryInfo.exists) {
            await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
          }

          const filename = `recording-${Date.now()}.m4a`;
          const destinationUri = `${directoryUri}/${filename}`;
          await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
          const fileInfo = await FileSystem.getInfoAsync(destinationUri, { size: true });

          return {
            localUri: destinationUri,
            fileSizeBytes: fileInfo.exists ? fileInfo.size ?? null : null,
          };
        }

        function Waveform({ samples }: { samples: number[] }) {
          return (
            <View className="mt-10 flex-row items-end justify-center gap-1 px-2">
              {samples.map((sample, index) => (
                <View
                  key={`${index}-${sample}`}
                  style={{
                    width: 8,
                    height: sample,
                    borderRadius: 999,
                    backgroundColor: index % 3 === 0 ? TEAL : '#9FD7C8',
                    opacity: 0.95,
                  }}
                />
              ))}
            </View>
          );
        }

        export default function RecordScreen() {
          useKeepAwake();
          const { addLocalRecording, isOnline } = useMemvo();
          const recordingRef = useRef<Audio.Recording | null>(null);
          const [hasPermission, setHasPermission] = useState<boolean | null>(null);
          const [isRecording, setIsRecording] = useState(false);
          const [isPaused, setIsPaused] = useState(false);
          const [durationMillis, setDurationMillis] = useState(0);
          const [waveform, setWaveform] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, (_, index) => 18 + ((index % 4) * 6)));
          const [isSaving, setIsSaving] = useState(false);

          const resetUI = useCallback(() => {
            setIsRecording(false);
            setIsPaused(false);
            setDurationMillis(0);
            setWaveform(Array.from({ length: BAR_COUNT }, (_, index) => 18 + ((index % 4) * 6)));
            recordingRef.current = null;
          }, []);

          const handleStatusUpdate = useCallback((status: RecordingStatus) => {
            if (!status.isLoaded) {
              return;
            }

            setDurationMillis(status.durationMillis ?? 0);

            if (typeof status.metering === 'number' && !isPaused) {
              setWaveform((current) => {
                const next = current.slice(1);
                next.push(normalizeMeteringToBarHeight(status.metering, current.length));
                return next;
              });
            }
          }, [isPaused]);

          useEffect(() => {
            return () => {
              const activeRecording = recordingRef.current;
              if (activeRecording) {
                activeRecording.stopAndUnloadAsync().catch(() => undefined);
              }
            };
          }, []);

          const timerLabel = useMemo(() => formatDuration(durationMillis), [durationMillis]);

          const startRecording = useCallback(async () => {
            if (isSaving) {
              return;
            }

            const granted = await ensureMicrophonePermission();
            setHasPermission(granted);
            if (!granted) {
              Alert.alert('Microphone access needed', 'Please enable microphone access in system settings to record a voice note.');
              return;
            }

            try {
              await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: false,
              });

              const recording = new Audio.Recording();
              await recording.prepareToRecordAsync(RECORDING_OPTIONS);
              recording.setOnRecordingStatusUpdate(handleStatusUpdate);
              await recording.startAsync();
              recordingRef.current = recording;
              setIsRecording(true);
              setIsPaused(false);
            } catch (error) {
              console.error('Unable to start recording', error);
              Alert.alert('Recording unavailable', 'Memvo could not start the microphone recording session on this device.');
            }
          }, [handleStatusUpdate, isSaving]);

          const pauseOrResumeRecording = useCallback(async () => {
            const activeRecording = recordingRef.current;
            if (!activeRecording) {
              return;
            }

            try {
              if (isPaused) {
                await activeRecording.startAsync();
                setIsPaused(false);
              } else {
                await activeRecording.pauseAsync();
                setIsPaused(true);
              }
            } catch (error) {
              console.error('Unable to toggle recording pause state', error);
              Alert.alert('Recording control unavailable', 'Memvo could not pause or resume the recording right now.');
            }
          }, [isPaused]);

          const stopRecording = useCallback(async () => {
            const activeRecording = recordingRef.current;
            if (!activeRecording) {
              return;
            }

            setIsSaving(true);
            try {
              await activeRecording.stopAndUnloadAsync();
              const uri = activeRecording.getURI();
              if (!uri) {
                throw new Error('Recording finished without a file URI');
              }

              const persisted = await persistRecordingLocally(uri);
              await addLocalRecording({
                localUri: persisted.localUri,
                durationSeconds: Math.max(1, Math.round(durationMillis / 1000)),
                fileSizeBytes: persisted.fileSizeBytes,
              });

              resetUI();
              Alert.alert('Saved locally', 'Your voice note was stored on this device and queued for transcription.');
              router.replace('/');
            } catch (error) {
              console.error('Unable to stop recording', error);
              Alert.alert('Save failed', 'Memvo could not finish saving the voice note. Please try again.');
            } finally {
              setIsSaving(false);
            }
          }, [addLocalRecording, durationMillis, resetUI]);

          return (
            <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-3 pb-6">
              <View className="flex-1 justify-between">
                <View className="gap-5">
                  {!isOnline ? (
                    <View className="rounded-2xl border border-[#D8EEE6] bg-[#EEF8F4] px-4 py-3">
                      <Text className="text-sm font-medium text-[#0F6E56]">
                        Recording offline — will sync and transcribe when connected
                      </Text>
                    </View>
                  ) : null}

                  <View className="items-center gap-3 pt-2">
                    <Text className="text-sm font-medium uppercase tracking-[2px] text-muted">Recording</Text>
                    <Text className="text-5xl font-bold text-foreground">{timerLabel}</Text>
                    <Text className="text-sm text-muted">
                      {isRecording ? (isPaused ? 'Paused' : 'Capturing audio locally') : 'Ready when you are'}
                    </Text>
                    {hasPermission === false ? (
                      <Text className="text-center text-sm text-error">
                        Microphone permission is required to start recording.
                      </Text>
                    ) : null}
                  </View>

                  <View className="rounded-[32px] border border-border bg-surface px-4 py-8">
                    <Waveform samples={waveform} />
                    <View className="mt-8 items-center">
                      <View className="h-36 w-36 items-center justify-center rounded-full bg-[#0F6E56]">
                        <View className="h-24 w-24 rounded-full bg-[#3C977A]" />
                      </View>
                    </View>
                  </View>
                </View>

                <View className="gap-4 pb-4">
                  {!isRecording ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => void startRecording()}
                      style={{
                        minHeight: 58,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 999,
                        backgroundColor: TEAL,
                      }}
                    >
                      <Text className="text-base font-semibold text-white">Start recording</Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="flex-row items-center justify-center gap-4">
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => void pauseOrResumeRecording()}
                        style={{
                          flex: 1,
                          minHeight: 56,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: '#D5D9DD',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <Text className="text-base font-semibold text-foreground">{isPaused ? 'Resume' : 'Pause'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => void stopRecording()}
                        style={{
                          flex: 1,
                          minHeight: 56,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 999,
                          backgroundColor: TEAL,
                          opacity: isSaving ? 0.7 : 1,
                        }}
                        disabled={isSaving}
                      >
                        <Text className="text-base font-semibold text-white">{isSaving ? 'Saving…' : 'Stop'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </ScreenContainer>
          );
        }
    ''').strip() + '\n',
    ROOT / 'tests' / 'memvo-recording-utils.test.ts': dedent('''
        import { describe, expect, it, vi } from 'vitest';

        import { buildFeedTimestampLabel, buildTemporaryNoteTitle, formatDuration, getRetryableQueueStatus } from '@/lib/memvo-recording-utils';

        describe('memvo recording utilities', () => {
          it('formats duration in mm:ss', () => {
            expect(formatDuration(0)).toBe('00:00');
            expect(formatDuration(61_000)).toBe('01:01');
          });

          it('builds a temporary note title with date and time', () => {
            const title = buildTemporaryNoteTitle(new Date('2026-04-08T13:41:00.000Z'));
            expect(title).toContain('Voice note —');
          });

          it('labels a feed timestamp for today and yesterday', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-04-12T15:00:00.000Z'));
            expect(buildFeedTimestampLabel(new Date('2026-04-12T14:41:00.000Z'))).toContain('Today');
            expect(buildFeedTimestampLabel(new Date('2026-04-11T14:41:00.000Z'))).toContain('Yesterday');
            vi.useRealTimers();
          });

          it('converts failed retryable items back to pending until the retry cap', () => {
            expect(
              getRetryableQueueStatus({
                id: 'queue-1',
                noteId: 'note-1',
                localUri: 'file:///note.m4a',
                status: 'failed',
                retryCount: 2,
                errorMessage: 'offline',
                remoteQueueId: null,
                fileSizeBytes: 1,
                createdAt: '2026-04-12T14:00:00.000Z',
                updatedAt: '2026-04-12T14:00:00.000Z',
                lastAttemptAt: null,
              }),
            ).toBe('pending');
          });
        });
    ''').strip() + '\n',
}

for path, content in files.items():
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
