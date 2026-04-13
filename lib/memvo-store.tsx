import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import {
  ExpoSpeechRecognitionModule,
  addSpeechRecognitionListener,
  supportsOnDeviceRecognition,
} from '@jamsch/expo-speech-recognition';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type {
  MemvoNote,
  MemvoPlanCheckResult,
  MemvoSyncQueueItem,
  MemvoUserProfile,
} from '@/lib/memvo-domain';
import {
  MEMVO_NOTES_STORAGE_KEY,
  MEMVO_QUEUE_STORAGE_KEY,
  buildTemporaryNoteTitle,
} from '@/lib/memvo-recording-utils';
import {
  MEMVO_FREE_LIMIT_MESSAGE,
  MEMVO_MAX_TRANSCRIPTION_RETRIES,
  MEMVO_ON_DEVICE_WAITING_LABEL,
  MEMVO_RETRY_NOTIFICATION_MESSAGE,
  MEMVO_UNSUPPORTED_DEVICE_MESSAGE,
  MEMVO_WHISPER_WAITING_LABEL,
  buildEngineSummary,
  buildNextRetryAt,
  buildTranscriptionFailureMessage,
  createFallbackPlanCheckResult,
  getMinutesConsumed,
  hasRemainingFreeMinutes,
  normalizePlan,
  shouldRetry,
  shouldShowRetryNotification,
} from '@/lib/memvo-transcription';
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
  userProfile: MemvoUserProfile | null;
  addLocalRecording: (input: RecordingSaveInput) => Promise<MemvoNote>;
  processPendingQueue: () => Promise<void>;
  retryQueueItem: (queueId: string) => Promise<void>;
};

type WhisperFunctionResult = {
  transcript: string;
  languageDetected: string | null;
  storagePath: string | null;
};

const MemvoContext = createContext<MemvoContextValue | null>(null);

function sortNotes(notes: MemvoNote[]) {
  return [...notes].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStoredNotes(raw: unknown): MemvoNote[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((note) => {
    const current = note as Partial<MemvoNote>;
    return {
      id: current.id ?? createId('note'),
      userId: current.userId ?? null,
      folderId: current.folderId ?? null,
      title: current.title ?? 'Voice note',
      createdAt: current.createdAt ?? new Date().toISOString(),
      updatedAt: current.updatedAt ?? new Date().toISOString(),
      recordedAt: current.recordedAt ?? current.createdAt ?? new Date().toISOString(),
      audioPath: current.audioPath ?? '',
      durationSeconds: current.durationSeconds ?? 0,
      syncStatus: current.syncStatus ?? 'pending',
      transcript: current.transcript ?? null,
      summary: current.summary ?? null,
      actionItems: current.actionItems ?? [],
      tags: current.tags ?? [],
      localOnly: current.localOnly ?? true,
      transcriptionEngine: current.transcriptionEngine ?? null,
      languageDetected: current.languageDetected ?? null,
      transcriptionPreview: current.transcriptionPreview ?? null,
      lastError: current.lastError ?? null,
      isTranscribingLive: current.isTranscribingLive ?? false,
      mood: typeof current.mood === 'string' ? current.mood : null,
      aiProcessingStatus:
        current.aiProcessingStatus === 'processing' || current.aiProcessingStatus === 'complete' || current.aiProcessingStatus === 'failed' || current.aiProcessingStatus === 'skipped'
          ? current.aiProcessingStatus
          : 'idle',
      aiProcessedAt: current.aiProcessedAt ?? null,
      aiError: current.aiError ?? null,
    } satisfies MemvoNote;
  });
}

function normalizeStoredQueue(raw: unknown): MemvoSyncQueueItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => {
    const current = item as Partial<MemvoSyncQueueItem>;
    return {
      id: current.id ?? createId('queue'),
      noteId: current.noteId ?? '',
      localUri: current.localUri ?? '',
      status: current.status ?? 'pending',
      retryCount: current.retryCount ?? 0,
      errorMessage: current.errorMessage ?? null,
      remoteQueueId: current.remoteQueueId ?? null,
      fileSizeBytes: current.fileSizeBytes ?? null,
      createdAt: current.createdAt ?? new Date().toISOString(),
      updatedAt: current.updatedAt ?? new Date().toISOString(),
      lastAttemptAt: current.lastAttemptAt ?? null,
      nextRetryAt: current.nextRetryAt ?? null,
      plan: current.plan ?? null,
      notificationShown: current.notificationShown ?? false,
    } satisfies MemvoSyncQueueItem;
  });
}

export function MemvoProvider({ children }: PropsWithChildren) {
  const [notes, setNotes] = useState<MemvoNote[]>([]);
  const [syncQueue, setSyncQueue] = useState<MemvoSyncQueueItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [userProfile, setUserProfile] = useState<MemvoUserProfile | null>(null);
  const processingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateNote = useCallback((noteId: string, updater: (note: MemvoNote) => MemvoNote) => {
    setNotes((current) => sortNotes(current.map((note) => (note.id === noteId ? updater(note) : note))));
  }, []);

  const updateQueueItem = useCallback((queueId: string, updater: (item: MemvoSyncQueueItem) => MemvoSyncQueueItem) => {
    setSyncQueue((current) => current.map((item) => (item.id === queueId ? updater(item) : item)));
  }, []);

  const removeQueueItem = useCallback((queueId: string) => {
    setSyncQueue((current) => current.filter((item) => item.id !== queueId));
  }, []);

  const syncNoteToSupabase = useCallback(async (note: MemvoNote) => {
    if (!isSupabaseConfigured || !isOnline) {
      return;
    }

    await supabase.from('notes').upsert({
      id: note.id,
      user_id: note.userId,
      folder_id: note.folderId,
      title: note.title,
      audio_path: note.audioPath,
      duration_seconds: note.durationSeconds,
      transcript: note.transcript,
      summary: note.summary,
      action_items: note.actionItems,
      tags: note.tags,
      mood: note.mood,
      sync_status: note.syncStatus,
      transcription_engine: note.transcriptionEngine,
      language_detected: note.languageDetected,
      ai_processing_status: note.aiProcessingStatus,
      ai_processed_at: note.aiProcessedAt,
      ai_error: note.aiError,
      recorded_at: note.recordedAt,
      updated_at: note.updatedAt,
    });
  }, [isOnline]);

  const syncQueueToSupabase = useCallback(async (item: MemvoSyncQueueItem) => {
    if (!isSupabaseConfigured || !isOnline) {
      return;
    }

    await supabase.from('sync_queue').upsert({
      id: item.remoteQueueId ?? item.id,
      note_id: item.noteId,
      local_uri: item.localUri,
      status: item.status,
      retry_count: item.retryCount,
      error_message: item.errorMessage,
      transcription_plan: item.plan,
      updated_at: item.updatedAt,
      last_attempt_at: item.lastAttemptAt,
      next_retry_at: item.nextRetryAt,
    });
  }, [isOnline]);

  const refreshUserProfile = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setUserProfile((current) => current ?? {
        id: 'local-user',
        email: null,
        plan: 'free',
        isAdmin: false,
        manualPro: false,
        bonusMinutes: 0,
        minutesUsedThisMonth: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const authResult = await supabase.auth.getUser();
    const authUser = authResult.data.user;
    if (!authUser) {
      setUserProfile(null);
      return;
    }

    const { data } = await supabase
      .from('users')
      .select('id,email,plan,is_admin,manual_pro,bonus_minutes,minutes_used_this_month,created_at,updated_at')
      .eq('id', authUser.id)
      .single();

    if (!data) {
      setUserProfile({
        id: authUser.id,
        email: authUser.email ?? null,
        plan: 'free',
        isAdmin: false,
        manualPro: false,
        bonusMinutes: 0,
        minutesUsedThisMonth: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setUserProfile({
      id: data.id,
      email: data.email ?? authUser.email ?? null,
      plan: normalizePlan(data.plan, Boolean(data.is_admin)),
      isAdmin: Boolean(data.is_admin),
      manualPro: Boolean(data.manual_pro),
      bonusMinutes: Number(data.bonus_minutes ?? 0),
      minutesUsedThisMonth: Number(data.minutes_used_this_month ?? 0),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const [storedNotes, storedQueue, networkState] = await Promise.all([
          AsyncStorage.getItem(MEMVO_NOTES_STORAGE_KEY),
          AsyncStorage.getItem(MEMVO_QUEUE_STORAGE_KEY),
          Network.getNetworkStateAsync(),
          refreshUserProfile(),
        ]);

        if (!isMounted) return;

        setNotes(storedNotes ? sortNotes(normalizeStoredNotes(JSON.parse(storedNotes))) : []);
        setSyncQueue(storedQueue ? normalizeStoredQueue(JSON.parse(storedQueue)) : []);
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
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [refreshUserProfile]);

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

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const channel = supabase
      .channel('memvo-notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (!row?.id) {
          return;
        }

        updateNote(String(row.id), (note) => ({
          ...note,
          title: typeof row.title === 'string' && row.title.trim() ? row.title : note.title,
          transcript: typeof row.transcript === 'string' ? row.transcript : note.transcript,
          summary: typeof row.summary === 'string' ? row.summary : note.summary,
          actionItems: Array.isArray(row.action_items) ? row.action_items.filter((value): value is string => typeof value === 'string') : note.actionItems,
          tags: Array.isArray(row.tags) ? row.tags.filter((value): value is string => typeof value === 'string') : note.tags,
          mood: typeof row.mood === 'string' ? row.mood : note.mood,
          syncStatus:
            row.sync_status === 'pending' || row.sync_status === 'uploading' || row.sync_status === 'transcribing' || row.sync_status === 'complete' || row.sync_status === 'failed'
              ? row.sync_status
              : note.syncStatus,
          transcriptionEngine:
            row.transcription_engine === 'on-device' || row.transcription_engine === 'whisper'
              ? row.transcription_engine
              : note.transcriptionEngine,
          languageDetected:
            typeof row.language_detected === 'string'
              ? row.language_detected
              : typeof row.language_code === 'string'
                ? row.language_code
                : note.languageDetected,
          aiProcessingStatus:
            row.ai_processing_status === 'processing' || row.ai_processing_status === 'complete' || row.ai_processing_status === 'failed' || row.ai_processing_status === 'skipped'
              ? row.ai_processing_status
              : note.aiProcessingStatus,
          aiProcessedAt: typeof row.ai_processed_at === 'string' ? row.ai_processed_at : note.aiProcessedAt,
          aiError: typeof row.ai_error === 'string' ? row.ai_error : note.aiError,
          updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
          lastError: typeof row.ai_error === 'string' && row.ai_error.trim() ? row.ai_error : note.lastError,
          isTranscribingLive: false,
          transcriptionPreview: note.transcriptionPreview,
        }));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [updateNote]);

  const resolvePlanCheck = useCallback(async (): Promise<MemvoPlanCheckResult> => {
    try {
      if (!isSupabaseConfigured) {
        return createFallbackPlanCheckResult();
      }

      const { data, error } = await supabase.functions.invoke('check-user-plan');
      if (error) {
        throw error;
      }

      const plan = data?.plan === 'pro' ? 'pro' : 'free';
      return {
        plan,
        source: 'edge-function',
      };
    } catch (error) {
      console.warn('Falling back to free plan check', error);
      return createFallbackPlanCheckResult();
    }
  }, []);

  const incrementFreeMinutes = useCallback(async (note: MemvoNote) => {
    if (!userProfile || userProfile.plan !== 'free' || userProfile.isAdmin || userProfile.manualPro) {
      return;
    }

    const minutesToAdd = getMinutesConsumed(note.durationSeconds);
    const nextValue = userProfile.minutesUsedThisMonth + minutesToAdd;

    setUserProfile((current) =>
      current
        ? {
            ...current,
            minutesUsedThisMonth: nextValue,
            updatedAt: new Date().toISOString(),
          }
        : current,
    );

    if (isSupabaseConfigured && userProfile.id) {
      await supabase
        .from('users')
        .update({ minutes_used_this_month: nextValue, updated_at: new Date().toISOString() })
        .eq('id', userProfile.id);
    }
  }, [userProfile]);

  const uploadAudioToStorage = useCallback(async (queueItem: MemvoSyncQueueItem) => {
    if (!isSupabaseConfigured) {
      throw new Error('Cloud transcription requires Supabase configuration.');
    }

    const response = await fetch(queueItem.localUri);
    const blob = await response.blob();
    const extension = queueItem.localUri.split('.').pop() || 'm4a';
    const storagePath = `memvo-audio/${queueItem.noteId}.${extension}`;

    const { error } = await supabase.storage.from('memvo-audio').upload(storagePath, blob, {
      contentType: blob.type || 'audio/m4a',
      upsert: true,
    });

    if (error) {
      throw error;
    }

    return storagePath;
  }, []);

  const deleteAudioFromStorage = useCallback(async (storagePath: string | null) => {
    if (!isSupabaseConfigured || !storagePath) {
      return;
    }

    await supabase.storage.from('memvo-audio').remove([storagePath]);
  }, []);

  const transcribeOnDevice = useCallback(async (note: MemvoNote) => {
    if (!supportsOnDeviceRecognition()) {
      throw new Error(MEMVO_UNSUPPORTED_DEVICE_MESSAGE);
    }

    return await new Promise<{ transcript: string; languageDetected: string | null }>((resolve, reject) => {
      let transcript = '';
      let settled = false;
      const subscriptions = [
        addSpeechRecognitionListener('result', (event: any) => {
          const nextText = Array.isArray(event.results)
            ? event.results
                .flatMap((result: any) => (Array.isArray(result?.transcript) ? result.transcript : [result?.transcript]))
                .filter(Boolean)
                .join(' ')
            : typeof event.result === 'string'
              ? event.result
              : '';

          if (nextText) {
            transcript = nextText.trim();
            updateNote(note.id, (current) => ({
              ...current,
              transcriptionPreview: transcript,
              summary: MEMVO_ON_DEVICE_WAITING_LABEL,
              updatedAt: new Date().toISOString(),
              isTranscribingLive: true,
            }));
          }
        }),
        addSpeechRecognitionListener('error', (event: any) => {
          if (settled) {
            return;
          }
          settled = true;
          subscriptions.forEach((subscription) => subscription.remove());
          reject(new Error(event?.message || MEMVO_UNSUPPORTED_DEVICE_MESSAGE));
        }),
        addSpeechRecognitionListener('end', () => {
          if (settled) {
            return;
          }
          settled = true;
          subscriptions.forEach((subscription) => subscription.remove());
          resolve({ transcript: transcript.trim(), languageDetected: null });
        }),
      ];

      try {
        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
          continuous: false,
          requiresOnDeviceRecognition: true,
          audioSource: {
            uri: note.audioPath,
          },
        } as any);
      } catch (error) {
        if (settled) {
          return;
        }
        settled = true;
        subscriptions.forEach((subscription) => subscription.remove());
        reject(error instanceof Error ? error : new Error(MEMVO_UNSUPPORTED_DEVICE_MESSAGE));
      }
    });
  }, [updateNote]);

  const transcribeWithWhisper = useCallback(async (note: MemvoNote, queueItem: MemvoSyncQueueItem) => {
    const storagePath = await uploadAudioToStorage(queueItem);
    const { data, error } = await supabase.functions.invoke('process-whisper-transcription', {
      body: {
        noteId: note.id,
        storagePath,
      },
    });

    if (error) {
      throw error;
    }

    return {
      transcript: String(data?.transcript ?? ''),
      languageDetected: typeof data?.languageDetected === 'string' ? data.languageDetected : null,
      storagePath,
    } satisfies WhisperFunctionResult;
  }, [uploadAudioToStorage]);

  const markQueueFailure = useCallback(async (note: MemvoNote, item: MemvoSyncQueueItem, error: unknown) => {
    const message = buildTranscriptionFailureMessage(error);
    const nextRetryCount = item.retryCount + 1;
    const finalFailure = nextRetryCount >= MEMVO_MAX_TRANSCRIPTION_RETRIES;
    const nextRetryAt = finalFailure ? null : buildNextRetryAt(nextRetryCount);
    const nextStatus = finalFailure ? 'failed' : 'pending';
    const nowIso = new Date().toISOString();

    updateNote(note.id, (current) => ({
      ...current,
      syncStatus: 'failed',
      summary: message,
      lastError: message,
      isTranscribingLive: false,
      updatedAt: nowIso,
    }));

    updateQueueItem(item.id, (current) => ({
      ...current,
      status: nextStatus,
      retryCount: nextRetryCount,
      errorMessage: message,
      nextRetryAt,
      lastAttemptAt: nowIso,
      updatedAt: nowIso,
    }));

    await syncNoteToSupabase({ ...note, syncStatus: 'failed', lastError: message, summary: message, updatedAt: nowIso });
    await syncQueueToSupabase({
      ...item,
      status: nextStatus,
      retryCount: nextRetryCount,
      errorMessage: message,
      nextRetryAt,
      lastAttemptAt: nowIso,
      updatedAt: nowIso,
      notificationShown: false,
    });

    if (finalFailure && shouldShowRetryNotification({ status: 'failed', retryCount: nextRetryCount, notificationShown: false })) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Memvo',
          body: MEMVO_RETRY_NOTIFICATION_MESSAGE,
        },
        trigger: null,
      });
      updateQueueItem(item.id, (current) => ({
        ...current,
        notificationShown: true,
      }));
    }
  }, [syncNoteToSupabase, syncQueueToSupabase, updateNote, updateQueueItem]);

  const completeQueueItem = useCallback(async (
    note: MemvoNote,
    item: MemvoSyncQueueItem,
    result: { transcript: string; languageDetected: string | null },
  ) => {
    const nowIso = new Date().toISOString();
    const nextNote: MemvoNote = {
      ...note,
      transcript: result.transcript,
      summary: isSupabaseConfigured ? 'Analysing with Claude…' : buildEngineSummary(note.transcriptionEngine),
      transcriptionPreview: result.transcript,
      languageDetected: result.languageDetected,
      syncStatus: 'complete',
      lastError: null,
      isTranscribingLive: false,
      updatedAt: nowIso,
      localOnly: false,
      aiProcessingStatus: isSupabaseConfigured ? 'processing' : 'idle',
      aiProcessedAt: null,
      aiError: null,
    };

    const nextQueueItem: MemvoSyncQueueItem = {
      ...item,
      status: 'complete',
      errorMessage: null,
      updatedAt: nowIso,
      lastAttemptAt: nowIso,
      nextRetryAt: null,
      notificationShown: false,
    };

    updateNote(note.id, () => nextNote);
    updateQueueItem(item.id, () => nextQueueItem);
    await syncNoteToSupabase(nextNote);
    await syncQueueToSupabase(nextQueueItem);

    if (nextNote.transcriptionEngine === 'on-device') {
      await incrementFreeMinutes(nextNote);
    }
  }, [incrementFreeMinutes, syncNoteToSupabase, syncQueueToSupabase, updateNote, updateQueueItem]);

  const processQueueItem = useCallback(async (item: MemvoSyncQueueItem) => {
    const note = notes.find((candidate) => candidate.id === item.noteId);
    if (!note) {
      removeQueueItem(item.id);
      return;
    }

    const planResult = await resolvePlanCheck();
    const effectivePlan = item.plan ?? planResult.plan;
    const nowIso = new Date().toISOString();

    updateQueueItem(item.id, (current) => ({
      ...current,
      plan: effectivePlan,
      status: effectivePlan === 'pro' ? 'uploading' : 'transcribing',
      lastAttemptAt: nowIso,
      updatedAt: nowIso,
      errorMessage: null,
    }));

    updateNote(note.id, (current) => ({
      ...current,
      syncStatus: effectivePlan === 'pro' ? 'uploading' : 'transcribing',
      transcriptionEngine: effectivePlan === 'pro' ? 'whisper' : 'on-device',
      summary: effectivePlan === 'pro' ? MEMVO_WHISPER_WAITING_LABEL : MEMVO_ON_DEVICE_WAITING_LABEL,
      lastError: null,
      isTranscribingLive: effectivePlan !== 'pro',
      updatedAt: nowIso,
    }));

    try {
      if (effectivePlan === 'free' && userProfile && !hasRemainingFreeMinutes(userProfile, note.durationSeconds)) {
        throw new Error(MEMVO_FREE_LIMIT_MESSAGE);
      }

      if (effectivePlan === 'pro') {
        const whisperResult = await transcribeWithWhisper(
          { ...note, transcriptionEngine: 'whisper', syncStatus: 'transcribing', updatedAt: nowIso },
          { ...item, status: 'uploading', plan: 'pro', updatedAt: nowIso },
        );

        await completeQueueItem(
          { ...note, transcriptionEngine: 'whisper', syncStatus: 'transcribing', updatedAt: nowIso },
          { ...item, status: 'transcribing', plan: 'pro', updatedAt: nowIso },
          {
            transcript: whisperResult.transcript,
            languageDetected: whisperResult.languageDetected,
          },
        );

        await deleteAudioFromStorage(whisperResult.storagePath);
        return;
      }

      const onDeviceResult = await transcribeOnDevice({
        ...note,
        transcriptionEngine: 'on-device',
        syncStatus: 'transcribing',
        updatedAt: nowIso,
      });

      await completeQueueItem(
        { ...note, transcriptionEngine: 'on-device', syncStatus: 'transcribing', updatedAt: nowIso },
        { ...item, status: 'transcribing', plan: 'free', updatedAt: nowIso },
        onDeviceResult,
      );
    } catch (error) {
      await markQueueFailure(note, item, error);
    }
  }, [
    completeQueueItem,
    deleteAudioFromStorage,
    markQueueFailure,
    notes,
    removeQueueItem,
    resolvePlanCheck,
    transcribeOnDevice,
    transcribeWithWhisper,
    updateNote,
    updateQueueItem,
    userProfile,
  ]);

  const addLocalRecording = useCallback(async ({ localUri, durationSeconds, fileSizeBytes }: RecordingSaveInput) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const note: MemvoNote = {
      id: createId('note'),
      userId: userProfile?.id ?? null,
      folderId: null,
      title: buildTemporaryNoteTitle(now),
      createdAt: nowIso,
      updatedAt: nowIso,
      recordedAt: nowIso,
      audioPath: localUri,
      durationSeconds,
      syncStatus: 'pending',
      transcript: null,
      summary: 'Queued for transcription...',
      actionItems: [],
      tags: [],
      localOnly: true,
      transcriptionEngine: null,
      languageDetected: null,
      transcriptionPreview: null,
      lastError: null,
      isTranscribingLive: false,
      mood: null,
      aiProcessingStatus: 'idle',
      aiProcessedAt: null,
      aiError: null,
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
      nextRetryAt: null,
      plan: null,
      notificationShown: false,
    };

    setNotes((current) => sortNotes([note, ...current]));
    setSyncQueue((current) => [queueItem, ...current]);
    await syncNoteToSupabase(note);
    await syncQueueToSupabase(queueItem);
    return note;
  }, [syncNoteToSupabase, syncQueueToSupabase, userProfile?.id]);

  const processPendingQueue = useCallback(async () => {
    if (processingRef.current || !isHydrated || !isOnline) {
      return;
    }

    processingRef.current = true;

    try {
      for (const item of syncQueue) {
        if (!shouldRetry(item)) {
          continue;
        }

        await processQueueItem(item);
      }
    } finally {
      processingRef.current = false;
    }
  }, [isHydrated, isOnline, processQueueItem, syncQueue]);

  const retryQueueItem = useCallback(async (queueId: string) => {
    updateQueueItem(queueId, (current) => ({
      ...current,
      status: 'pending',
      retryCount: 0,
      errorMessage: null,
      nextRetryAt: null,
      notificationShown: false,
      updatedAt: new Date().toISOString(),
    }));
    await processPendingQueue();
  }, [processPendingQueue, updateQueueItem]);

  useEffect(() => {
    if (!isHydrated || !isOnline) {
      return;
    }

    void processPendingQueue();
  }, [isHydrated, isOnline, processPendingQueue]);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (!isOnline) {
      return;
    }

    const pendingRetry = syncQueue
      .filter((item) => item.nextRetryAt && item.retryCount < MEMVO_MAX_TRANSCRIPTION_RETRIES)
      .sort((a, b) => Date.parse(a.nextRetryAt ?? '') - Date.parse(b.nextRetryAt ?? ''))[0];

    if (!pendingRetry?.nextRetryAt) {
      return;
    }

    const delay = Math.max(0, Date.parse(pendingRetry.nextRetryAt) - Date.now());
    retryTimerRef.current = setTimeout(() => {
      void processPendingQueue();
    }, delay);
  }, [isOnline, processPendingQueue, syncQueue]);

  const value = useMemo(
    () => ({
      notes,
      syncQueue,
      isHydrated,
      isOnline,
      userProfile,
      addLocalRecording,
      processPendingQueue,
      retryQueueItem,
    }),
    [addLocalRecording, isHydrated, isOnline, notes, processPendingQueue, retryQueueItem, syncQueue, userProfile],
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
