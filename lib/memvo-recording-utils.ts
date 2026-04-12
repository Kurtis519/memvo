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
