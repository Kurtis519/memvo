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
