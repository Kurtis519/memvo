export type MemvoPlan = 'free' | 'pro' | 'admin';
export type MemvoFolderKind = 'system' | 'custom';
export type MemvoSyncStatus = 'pending' | 'uploading' | 'transcribing' | 'complete' | 'failed';
export type MemvoTranscriptionEngine = 'on-device' | 'whisper';
export type MemvoAiProcessingStatus = 'idle' | 'processing' | 'complete' | 'failed' | 'skipped';
export type MemvoMood = string | null;
export type MemvoFeature =
  | 'record'
  | 'offlinePlayback'
  | 'serverTranscription'
  | 'claudeSummary'
  | 'priorityProcessing'
  | 'manualProGrant'
  | 'adminPanel'
  | 'on-device transcription'
  | 'claude summaries'
  | 'manual pro grants'
  | 'whisper transcription';

export interface MemvoUserProfile {
  id: string;
  email: string | null;
  plan: MemvoPlan;
  isAdmin: boolean;
  manualPro: boolean;
  bonusMinutes: number;
  minutesUsedThisMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemvoPlanCheckResult {
  plan: 'free' | 'pro';
  source: 'edge-function' | 'admin-override' | 'manual-pro' | 'revenuecat-placeholder' | 'fallback';
}

export interface MemvoFolder {
  id: string;
  userId: string;
  name: string;
  slug: string;
  kind: MemvoFolderKind;
  position: number;
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
  isStarred: boolean;
  transcriptionEngine: MemvoTranscriptionEngine | null;
  languageDetected: string | null;
  transcriptionPreview: string | null;
  lastError: string | null;
  isTranscribingLive: boolean;
  mood: MemvoMood;
  aiProcessingStatus: MemvoAiProcessingStatus;
  aiProcessedAt: string | null;
  aiError: string | null;
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
  nextRetryAt: string | null;
  plan: 'free' | 'pro' | null;
  notificationShown: boolean;
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
  free: ['record', 'offlinePlayback', 'on-device transcription'],
  pro: [
    'record',
    'offlinePlayback',
    'serverTranscription',
    'claudeSummary',
    'priorityProcessing',
    'on-device transcription',
    'claude summaries',
    'whisper transcription',
  ],
  admin: [
    'record',
    'offlinePlayback',
    'serverTranscription',
    'claudeSummary',
    'priorityProcessing',
    'manualProGrant',
    'adminPanel',
    'on-device transcription',
    'claude summaries',
    'manual pro grants',
    'whisper transcription',
  ],
};

export function canUseMemvoFeature(
  planOrProfile: MemvoPlan | Pick<MemvoUserProfile, 'plan' | 'isAdmin'>,
  feature: MemvoFeature,
) {
  const plan = typeof planOrProfile === 'string' ? planOrProfile : planOrProfile.plan;
  const isAdmin = typeof planOrProfile === 'string' ? false : Boolean(planOrProfile.isAdmin);

  if (isAdmin || plan === 'admin') {
    return true;
  }

  return MEMVO_PLAN_FEATURES[plan].includes(feature);
}
