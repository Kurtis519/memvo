import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
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
  MemvoFolder,
  MemvoNote,
  MemvoPlanCheckResult,
  MemvoSyncQueueItem,
  MemvoUserProfile,
} from '@/lib/memvo-domain';
import {
  MEMVO_PREVIEW_SPEECH_MESSAGE,
  resolveSpeechRecognitionApi,
  type SpeechRecognitionApi,
} from '@/lib/memvo-speech';
import {
  MEMVO_NOTES_STORAGE_KEY,
  MEMVO_QUEUE_STORAGE_KEY,
  buildTemporaryNoteTitle,
} from '@/lib/memvo-recording-utils';
import {
  MEMVO_FOLDERS_STORAGE_KEY,
  MEMVO_MAX_FREE_CUSTOM_FOLDERS,
  MEMVO_RECENT_SEARCHES_STORAGE_KEY,
  buildRecentSearches,
  countCustomFolders,
  createId as createOrganizationId,
  ensureDefaultFolders,
  normalizeStoredFolders,
  removeRecentSearch,
  sanitizeFolderName,
  slugifyFolderName,
} from '@/lib/memvo-organization';
import {
  MEMVO_FREE_LIMIT_MESSAGE,
  MEMVO_MAX_TRANSCRIPTION_RETRIES,
  MEMVO_ON_DEVICE_WAITING_LABEL,
  MEMVO_PREVIEW_DEFERRED_MESSAGE,
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
  resolveTranscriptionMode,
  shouldRetry,
  shouldShowRetryNotification,
} from '@/lib/memvo-transcription';
import { getRevenueCatCustomerInfo, hasRevenueCatProAccess, syncRevenueCatUser } from '@/lib/revenuecat';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type RecordingSaveInput = {
  localUri: string;
  durationSeconds: number;
  fileSizeBytes: number | null;
};

type MemvoContextValue = {
  folders: MemvoFolder[];
  notes: MemvoNote[];
  recentSearches: string[];
  syncQueue: MemvoSyncQueueItem[];
  isHydrated: boolean;
  isOnline: boolean;
  userProfile: MemvoUserProfile | null;
  refreshUserProfile: () => Promise<void>;
  addLocalRecording: (input: RecordingSaveInput) => Promise<MemvoNote>;
  processPendingQueue: () => Promise<void>;
  retryQueueItem: (queueId: string) => Promise<void>;
  getFolderById: (folderId: string | null | undefined) => MemvoFolder | undefined;
  getNoteById: (noteId: string) => MemvoNote | undefined;
  createFolder: (name: string) => Promise<MemvoFolder | null>;
  renameFolder: (folderId: string, name: string) => Promise<MemvoFolder | null>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveNoteToFolder: (noteId: string, folderId: string | null) => Promise<void>;
  removeRecentSearch: (term: string) => void;
  saveRecentSearch: (term: string) => void;
  toggleStar: (noteId: string) => Promise<void>;
  updateNoteTitle: (noteId: string, title: string) => Promise<void>;
  updateNoteTags: (noteId: string, tags: string[]) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
};

type WhisperFunctionResult = {
  transcript: string;
  languageDetected: string | null;
  storagePath: string | null;
};

const MemvoContext = createContext<MemvoContextValue | null>(null);

let cachedSpeechRecognitionApi: SpeechRecognitionApi | null | undefined;
let cachedNotificationsApi:
  | { scheduleNotificationAsync: (request: { content: { title: string; body: string }; trigger: null }) => Promise<string> }
  | null
  | undefined;

function getSpeechRecognitionApi(): SpeechRecognitionApi | null {
  if (cachedSpeechRecognitionApi !== undefined) {
    return cachedSpeechRecognitionApi;
  }

  try {
    cachedSpeechRecognitionApi = resolveSpeechRecognitionApi(
      Platform.OS,
      () => require('expo-speech-recognition') as SpeechRecognitionApi,
    );
  } catch (error) {
    console.warn('Speech recognition module is not available in this runtime.', error);
    cachedSpeechRecognitionApi = null;
  }

  return cachedSpeechRecognitionApi;
}

function getNotificationsApi():
  | { scheduleNotificationAsync: (request: { content: { title: string; body: string }; trigger: null }) => Promise<string> }
  | null {
  if (cachedNotificationsApi !== undefined) {
    return cachedNotificationsApi;
  }

  if (Platform.OS === 'web') {
    cachedNotificationsApi = null;
    return cachedNotificationsApi;
  }

  try {
    const candidate = require('expo-notifications') as {
      scheduleNotificationAsync?: (request: { content: { title: string; body: string }; trigger: null }) => Promise<string>;
    };

    cachedNotificationsApi = typeof candidate.scheduleNotificationAsync === 'function'
      ? { scheduleNotificationAsync: candidate.scheduleNotificationAsync.bind(candidate) }
      : null;
  } catch (error) {
    console.warn('Notifications module is not available in this runtime.', error);
    cachedNotificationsApi = null;
  }

  return cachedNotificationsApi;
}

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
      isStarred: current.isStarred ?? false,
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
  const [folders, setFolders] = useState<MemvoFolder[]>([]);
  const [notes, setNotes] = useState<MemvoNote[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [syncQueue, setSyncQueue] = useState<MemvoSyncQueueItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [userProfile, setUserProfile] = useState<MemvoUserProfile | null>(null);
  const processingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeUserId = userProfile?.id ?? 'local-user';

  const updateNote = useCallback((noteId: string, updater: (note: MemvoNote) => MemvoNote) => {
    setNotes((current) => sortNotes(current.map((note) => (note.id === noteId ? updater(note) : note))));
  }, []);

  const updateQueueItem = useCallback((queueId: string, updater: (item: MemvoSyncQueueItem) => MemvoSyncQueueItem) => {
    setSyncQueue((current) => current.map((item) => (item.id === queueId ? updater(item) : item)));
  }, []);

  const removeQueueItem = useCallback((queueId: string) => {
    setSyncQueue((current) => current.filter((item) => item.id !== queueId));
  }, []);

  const removeNote = useCallback((noteId: string) => {
    setNotes((current) => current.filter((note) => note.id !== noteId));
  }, []);

  const syncFolderToSupabase = useCallback(async (folder: MemvoFolder) => {
    if (!isSupabaseConfigured || !isOnline) {
      return;
    }

    await supabase.from('folders').upsert({
      id: folder.id,
      user_id: folder.userId,
      name: folder.name,
      slug: folder.slug,
      kind: folder.kind,
      position: folder.position,
      updated_at: folder.updatedAt,
    });
  }, [isOnline]);

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
      is_starred: note.isStarred,
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
        fullName: null,
        avatarUrl: null,
        plan: 'free',
        isAdmin: false,
        manualPro: false,
        referralCode: null,
        referredByCode: null,
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
      await syncRevenueCatUser(null).catch(() => {
        // Ignore RevenueCat logout issues during auth refresh.
      });
      setUserProfile(null);
      return;
    }

    const revenueCatCustomerInfo = await getRevenueCatCustomerInfo(authUser.id).catch(() => null);
    const hasRevenueCatPro = hasRevenueCatProAccess(revenueCatCustomerInfo);

    const { data } = await supabase
      .from('user_profiles')
      .select('id,email,full_name,avatar_url,plan,is_admin,manual_pro,referral_code,referred_by_code,bonus_minutes,minutes_used_this_month,created_at,updated_at')
      .eq('id', authUser.id)
      .single();

    if (!data) {
      setUserProfile({
        id: authUser.id,
        email: authUser.email ?? null,
        fullName: (authUser.user_metadata?.full_name as string | undefined) ?? (authUser.user_metadata?.name as string | undefined) ?? null,
        avatarUrl: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
        plan: hasRevenueCatPro ? 'pro' : 'free',
        isAdmin: false,
        manualPro: false,
        referralCode: null,
        referredByCode: null,
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
      fullName: data.full_name ?? authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
      avatarUrl: data.avatar_url ?? authUser.user_metadata?.avatar_url ?? null,
      plan: normalizePlan(hasRevenueCatPro ? 'pro' : data.plan, Boolean(data.is_admin)),
      isAdmin: Boolean(data.is_admin),
      manualPro: Boolean(data.manual_pro),
      referralCode: data.referral_code ?? null,
      referredByCode: data.referred_by_code ?? null,
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
        const [storedFolders, storedNotes, storedQueue, storedRecentSearches, networkState] = await Promise.all([
          AsyncStorage.getItem(MEMVO_FOLDERS_STORAGE_KEY),
          AsyncStorage.getItem(MEMVO_NOTES_STORAGE_KEY),
          AsyncStorage.getItem(MEMVO_QUEUE_STORAGE_KEY),
          AsyncStorage.getItem(MEMVO_RECENT_SEARCHES_STORAGE_KEY),
          Network.getNetworkStateAsync(),
          refreshUserProfile(),
        ]);

        if (!isMounted) return;

        setFolders(storedFolders ? normalizeStoredFolders(JSON.parse(storedFolders), activeUserId) : ensureDefaultFolders([], activeUserId));
        setNotes(storedNotes ? sortNotes(normalizeStoredNotes(JSON.parse(storedNotes))) : []);
        setSyncQueue(storedQueue ? normalizeStoredQueue(JSON.parse(storedQueue)) : []);
        setRecentSearches(
          storedRecentSearches
            ? (JSON.parse(storedRecentSearches) as string[]).filter((entry): entry is string => typeof entry === 'string').slice(0, 5)
            : [],
        );
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
  }, [activeUserId, refreshUserProfile]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void refreshUserProfile();
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [isHydrated, refreshUserProfile]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    setFolders((current) => ensureDefaultFolders(current, activeUserId));
  }, [activeUserId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(MEMVO_FOLDERS_STORAGE_KEY, JSON.stringify(folders)).catch((error) => {
      console.error('Failed to persist Memvo folders', error);
    });
  }, [folders, isHydrated]);

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
    if (!isHydrated) return;
    AsyncStorage.setItem(MEMVO_RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(recentSearches)).catch((error) => {
      console.error('Failed to persist Memvo recent searches', error);
    });
  }, [isHydrated, recentSearches]);

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
          folderId: typeof row.folder_id === 'string' ? row.folder_id : note.folderId,
          actionItems: Array.isArray(row.action_items) ? row.action_items.filter((value): value is string => typeof value === 'string') : note.actionItems,
          tags: Array.isArray(row.tags) ? row.tags.filter((value): value is string => typeof value === 'string') : note.tags,
          mood: typeof row.mood === 'string' ? row.mood : note.mood,
          isStarred: typeof row.is_starred === 'boolean' ? row.is_starred : note.isStarred,
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
        .from('user_profiles')
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
    const speechRecognitionApi = getSpeechRecognitionApi();

    if (!speechRecognitionApi) {
      throw new Error(MEMVO_PREVIEW_SPEECH_MESSAGE);
    }

    if (!speechRecognitionApi.supportsOnDeviceRecognition()) {
      throw new Error(MEMVO_UNSUPPORTED_DEVICE_MESSAGE);
    }

    return await new Promise<{ transcript: string; languageDetected: string | null }>((resolve, reject) => {
      let transcript = '';
      let settled = false;
      const subscriptions = [
        speechRecognitionApi.addSpeechRecognitionListener('result', (event: any) => {
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
        speechRecognitionApi.addSpeechRecognitionListener('error', (event: any) => {
          if (settled) {
            return;
          }
          settled = true;
          subscriptions.forEach((subscription) => subscription.remove());
          reject(new Error(event?.message || MEMVO_UNSUPPORTED_DEVICE_MESSAGE));
        }),
        speechRecognitionApi.addSpeechRecognitionListener('end', () => {
          if (settled) {
            return;
          }
          settled = true;
          subscriptions.forEach((subscription) => subscription.remove());
          resolve({ transcript: transcript.trim(), languageDetected: null });
        }),
      ];

      try {
        speechRecognitionApi.ExpoSpeechRecognitionModule.start({
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
      const notificationsApi = getNotificationsApi();
      if (notificationsApi) {
        await notificationsApi.scheduleNotificationAsync({
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
    const transcriptionMode = resolveTranscriptionMode(effectivePlan, Boolean(getSpeechRecognitionApi()));

    if (transcriptionMode === 'deferred') {
      updateQueueItem(item.id, (current) => ({
        ...current,
        plan: effectivePlan,
        status: 'pending',
        lastAttemptAt: nowIso,
        updatedAt: nowIso,
        errorMessage: null,
      }));

      const deferredNote = {
        ...note,
        syncStatus: 'pending' as const,
        transcriptionEngine: null,
        summary: MEMVO_PREVIEW_DEFERRED_MESSAGE,
        lastError: null,
        isTranscribingLive: false,
        updatedAt: nowIso,
      };

      updateNote(note.id, () => deferredNote);
      await syncNoteToSupabase(deferredNote);
      await syncQueueToSupabase({
        ...item,
        plan: effectivePlan,
        status: 'pending',
        lastAttemptAt: nowIso,
        updatedAt: nowIso,
        errorMessage: null,
      });
      return;
    }

    updateQueueItem(item.id, (current) => ({
      ...current,
      plan: effectivePlan,
      status: transcriptionMode === 'whisper' ? 'uploading' : 'transcribing',
      lastAttemptAt: nowIso,
      updatedAt: nowIso,
      errorMessage: null,
    }));

    updateNote(note.id, (current) => ({
      ...current,
      syncStatus: transcriptionMode === 'whisper' ? 'uploading' : 'transcribing',
      transcriptionEngine: transcriptionMode === 'whisper' ? 'whisper' : 'on-device',
      summary: transcriptionMode === 'whisper' ? MEMVO_WHISPER_WAITING_LABEL : MEMVO_ON_DEVICE_WAITING_LABEL,
      lastError: null,
      isTranscribingLive: transcriptionMode === 'on-device',
      updatedAt: nowIso,
    }));

    try {
      if (effectivePlan === 'free' && userProfile && !hasRemainingFreeMinutes(userProfile, note.durationSeconds)) {
        throw new Error(MEMVO_FREE_LIMIT_MESSAGE);
      }

      if (transcriptionMode === 'whisper') {
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
      isStarred: false,
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

  const getFolderById = useCallback((folderId: string | null | undefined) => {
    if (!folderId) {
      return undefined;
    }

    return folders.find((folder) => folder.id === folderId);
  }, [folders]);

  const getNoteById = useCallback((noteId: string) => notes.find((note) => note.id === noteId), [notes]);

  const saveRecentSearchTerm = useCallback((term: string) => {
    setRecentSearches((current) => buildRecentSearches(current, term));
  }, []);

  const removeRecentSearchTerm = useCallback((term: string) => {
    setRecentSearches((current) => removeRecentSearch(current, term));
  }, []);

  const createFolder = useCallback(async (name: string) => {
    const sanitized = sanitizeFolderName(name);
    if (!sanitized) {
      return null;
    }

    const isPro = Boolean(userProfile && (userProfile.plan === 'pro' || userProfile.plan === 'admin' || userProfile.isAdmin));
    if (!isPro && countCustomFolders(folders) >= MEMVO_MAX_FREE_CUSTOM_FOLDERS) {
      return null;
    }

    const existingSlugs = new Set(folders.map((folder) => folder.slug));
    let slug = slugifyFolderName(sanitized);
    let counter = 2;
    while (existingSlugs.has(slug)) {
      slug = `${slugifyFolderName(sanitized)}-${counter}`;
      counter += 1;
    }

    const now = new Date().toISOString();
    const folder: MemvoFolder = {
      id: createOrganizationId('folder'),
      userId: activeUserId,
      name: sanitized,
      slug,
      kind: 'custom',
      position: folders.length,
      createdAt: now,
      updatedAt: now,
    };

    setFolders((current) => ensureDefaultFolders([...current, folder], activeUserId));
    await syncFolderToSupabase(folder);
    return folder;
  }, [activeUserId, folders, syncFolderToSupabase, userProfile]);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    const sanitized = sanitizeFolderName(name);
    const target = folders.find((folder) => folder.id === folderId);
    if (!target || target.kind !== 'custom' || !sanitized) {
      return null;
    }

    let slug = slugifyFolderName(sanitized);
    const existingSlugs = new Set(folders.filter((folder) => folder.id !== folderId).map((folder) => folder.slug));
    let counter = 2;
    while (existingSlugs.has(slug)) {
      slug = `${slugifyFolderName(sanitized)}-${counter}`;
      counter += 1;
    }

    const nextFolder: MemvoFolder = {
      ...target,
      name: sanitized,
      slug,
      updatedAt: new Date().toISOString(),
    };

    setFolders((current) => current.map((folder) => (folder.id === folderId ? nextFolder : folder)));
    await syncFolderToSupabase(nextFolder);
    return nextFolder;
  }, [folders, syncFolderToSupabase]);

  const moveNoteToFolder = useCallback(async (noteId: string, folderId: string | null) => {
    const target = notes.find((note) => note.id === noteId);
    if (!target) {
      return;
    }

    const nextNote = {
      ...target,
      folderId,
      updatedAt: new Date().toISOString(),
    };

    updateNote(noteId, () => nextNote);
    await syncNoteToSupabase(nextNote);
  }, [notes, syncNoteToSupabase, updateNote]);

  const deleteFolder = useCallback(async (folderId: string) => {
    const target = folders.find((folder) => folder.id === folderId);
    if (!target || target.kind !== 'custom') {
      return;
    }

    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    const timestamp = new Date().toISOString();
    const reassignedNotes = notes
      .filter((note) => note.folderId === folderId)
      .map((note) => ({
        ...note,
        folderId: null,
        updatedAt: timestamp,
      }));

    if (reassignedNotes.length > 0) {
      setNotes((current) => sortNotes(current.map((note) => reassignedNotes.find((entry) => entry.id === note.id) ?? note)));
      await Promise.all(reassignedNotes.map((note) => syncNoteToSupabase(note)));
    }

    if (isSupabaseConfigured && isOnline) {
      await supabase.from('notes').update({ folder_id: null }).eq('folder_id', folderId);
      await supabase.from('folders').delete().eq('id', folderId);
    }
  }, [folders, isOnline, notes, syncNoteToSupabase]);

  const toggleStar = useCallback(async (noteId: string) => {
    const target = notes.find((note) => note.id === noteId);
    if (!target) {
      return;
    }

    const nextNote = {
      ...target,
      isStarred: !target.isStarred,
      updatedAt: new Date().toISOString(),
    };

    updateNote(noteId, () => nextNote);
    await syncNoteToSupabase(nextNote);
  }, [notes, syncNoteToSupabase, updateNote]);

  const updateNoteTitle = useCallback(async (noteId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    const target = notes.find((note) => note.id === noteId);
    if (!target || target.title === trimmed) {
      return;
    }

    const nextNote = {
      ...target,
      title: trimmed,
      updatedAt: new Date().toISOString(),
    };

    updateNote(noteId, () => nextNote);
    await syncNoteToSupabase(nextNote);
  }, [notes, syncNoteToSupabase, updateNote]);

  const updateNoteTags = useCallback(async (noteId: string, tags: string[]) => {
    const target = notes.find((note) => note.id === noteId);
    if (!target) {
      return;
    }

    const nextNote = {
      ...target,
      tags: tags.map((tag) => tag.trim()).filter(Boolean),
      updatedAt: new Date().toISOString(),
    };

    updateNote(noteId, () => nextNote);
    await syncNoteToSupabase(nextNote);
  }, [notes, syncNoteToSupabase, updateNote]);

  const deleteNote = useCallback(async (noteId: string) => {
    const target = notes.find((note) => note.id === noteId);
    if (!target) {
      return;
    }

    removeNote(noteId);
    setSyncQueue((current) => current.filter((item) => item.noteId !== noteId));

    if (target.audioPath) {
      const info = await FileSystem.getInfoAsync(target.audioPath).catch(() => null);
      if (info?.exists) {
        await FileSystem.deleteAsync(target.audioPath, { idempotent: true }).catch(() => undefined);
      }
    }

    if (isSupabaseConfigured && isOnline) {
      await supabase.from('sync_queue').delete().eq('note_id', noteId);
      await supabase.from('notes').delete().eq('id', noteId);
    }
  }, [isOnline, notes, removeNote]);

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
      folders,
      notes,
      recentSearches,
      syncQueue,
      isHydrated,
      isOnline,
      userProfile,
      refreshUserProfile,
      addLocalRecording,
      processPendingQueue,
      retryQueueItem,
      getFolderById,
      getNoteById,
      createFolder,
      renameFolder,
      deleteFolder,
      moveNoteToFolder,
      removeRecentSearch: removeRecentSearchTerm,
      saveRecentSearch: saveRecentSearchTerm,
      toggleStar,
      updateNoteTitle,
      updateNoteTags,
      deleteNote,
    }),
    [
      addLocalRecording,
      createFolder,
      deleteFolder,
      deleteNote,
      folders,
      getFolderById,
      getNoteById,
      isHydrated,
      isOnline,
      moveNoteToFolder,
      notes,
      processPendingQueue,
      recentSearches,
      refreshUserProfile,
      removeRecentSearchTerm,
      renameFolder,
      retryQueueItem,
      saveRecentSearchTerm,
      syncQueue,
      toggleStar,
      updateNoteTags,
      updateNoteTitle,
      userProfile,
    ],
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
