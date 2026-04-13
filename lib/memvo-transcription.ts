import type {
  MemvoAiProcessingStatus,
  MemvoNote,
  MemvoPlan,
  MemvoPlanCheckResult,
  MemvoSyncQueueItem,
  MemvoSyncStatus,
  MemvoTranscriptionEngine,
} from '@/lib/memvo-domain';

export const MEMVO_FREE_MINUTES_PER_MONTH = 120;
export const MEMVO_RETRY_DELAY_MS = 30_000;
export const MEMVO_MAX_TRANSCRIPTION_RETRIES = 3;
export const MEMVO_WHISPER_WAITING_LABEL = 'Processing with Whisper...';
export const MEMVO_ON_DEVICE_WAITING_LABEL = 'Transcribing on your device...';
export const MEMVO_ANALYSING_LABEL = 'Analysing with Claude…';
export const MEMVO_AI_READY_LABEL = 'AI notes ready';
export const MEMVO_AI_FAILED_LABEL = 'AI analysis failed';
export const MEMVO_FREE_LIMIT_MESSAGE = "You've used all your free minutes this month. Upgrade to Pro for unlimited transcription.";
export const MEMVO_UNSUPPORTED_DEVICE_MESSAGE =
  'Your device does not support on-device transcription. Upgrade to Pro for Whisper-powered transcription in 99+ languages.';
export const MEMVO_RETRY_NOTIFICATION_MESSAGE = 'Transcription failed — tap to retry';

export type MemvoUserAllowance = {
  plan: MemvoPlan;
  isAdmin: boolean;
  manualPro: boolean;
  bonusMinutes: number;
  minutesUsedThisMonth: number;
};

export function createFallbackPlanCheckResult(): MemvoPlanCheckResult {
  return {
    plan: 'free',
    source: 'fallback',
  };
}

export function getAllowedFreeMinutes(allowance: Pick<MemvoUserAllowance, 'bonusMinutes'>) {
  return MEMVO_FREE_MINUTES_PER_MONTH + Math.max(0, allowance.bonusMinutes);
}

export function hasRemainingFreeMinutes(
  allowance: Pick<MemvoUserAllowance, 'bonusMinutes' | 'minutesUsedThisMonth'>,
  durationSeconds: number,
) {
  const usedAfterThisJob = allowance.minutesUsedThisMonth + durationSeconds / 60;
  return usedAfterThisJob <= getAllowedFreeMinutes(allowance);
}

export function getMinutesConsumed(durationSeconds: number) {
  return durationSeconds / 60;
}

export function buildNextRetryAt(retryCount: number, now = new Date()) {
  return new Date(now.getTime() + MEMVO_RETRY_DELAY_MS * Math.max(1, retryCount)).toISOString();
}

export function isRetryReady(item: Pick<MemvoSyncQueueItem, 'nextRetryAt'>, now = new Date()) {
  if (!item.nextRetryAt) {
    return true;
  }

  return Date.parse(item.nextRetryAt) <= now.getTime();
}

export function shouldRetry(item: Pick<MemvoSyncQueueItem, 'status' | 'retryCount' | 'nextRetryAt'>, now = new Date()) {
  if (item.status === 'complete') {
    return false;
  }

  if (item.retryCount >= MEMVO_MAX_TRANSCRIPTION_RETRIES) {
    return false;
  }

  return isRetryReady(item, now);
}

export function shouldShowRetryNotification(item: Pick<MemvoSyncQueueItem, 'status' | 'retryCount' | 'notificationShown'>) {
  return item.status === 'failed' && item.retryCount >= MEMVO_MAX_TRANSCRIPTION_RETRIES && !item.notificationShown;
}

export function getAiProcessingLabel(status: MemvoAiProcessingStatus, aiError?: string | null) {
  if (status === 'failed') {
    return aiError?.trim() || MEMVO_AI_FAILED_LABEL;
  }

  if (status === 'complete') {
    return MEMVO_AI_READY_LABEL;
  }

  if (status === 'processing') {
    return MEMVO_ANALYSING_LABEL;
  }

  if (status === 'skipped') {
    return 'Transcript saved without AI summary';
  }

  return 'Awaiting AI analysis';
}

export function getNoteProcessingLabel(note: Pick<MemvoNote, 'syncStatus' | 'transcriptionEngine' | 'lastError' | 'aiProcessingStatus' | 'aiError'>) {
  if (note.lastError) {
    return note.lastError;
  }

  if (note.syncStatus !== 'complete') {
    if (note.transcriptionEngine === 'whisper') {
      return MEMVO_WHISPER_WAITING_LABEL;
    }

    return MEMVO_ON_DEVICE_WAITING_LABEL;
  }

  if (note.aiProcessingStatus === 'processing' || note.aiProcessingStatus === 'complete' || note.aiProcessingStatus === 'failed' || note.aiProcessingStatus === 'skipped') {
    return getAiProcessingLabel(note.aiProcessingStatus, note.aiError);
  }

  return 'Ready';
}

export function getStatusTone(status: MemvoSyncStatus, aiProcessingStatus: MemvoAiProcessingStatus = 'idle') {
  if (status === 'failed' || aiProcessingStatus === 'failed') {
    return 'error';
  }

  if (status === 'complete' && (aiProcessingStatus === 'complete' || aiProcessingStatus === 'skipped' || aiProcessingStatus === 'idle')) {
    return 'success';
  }

  return 'progress';
}

export function normalizeLanguageBadge(language: string | null | undefined) {
  if (!language) {
    return null;
  }

  return language.trim().slice(0, 2).toUpperCase() || null;
}

export function normalizePlan(rawPlan: string | null | undefined, isAdmin = false): MemvoPlan {
  if (isAdmin || rawPlan === 'admin') {
    return 'admin';
  }

  return rawPlan === 'pro' ? 'pro' : 'free';
}

export function buildTranscriptionFailureMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Transcription failed. Please try again.';
}

export function buildEngineSummary(engine: MemvoTranscriptionEngine | null) {
  if (engine === 'whisper') {
    return 'Whisper transcription complete.';
  }

  if (engine === 'on-device') {
    return 'On-device transcription complete.';
  }

  return 'Awaiting transcription.';
}
