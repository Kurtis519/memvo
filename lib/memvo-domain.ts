export type MemvoPlan = 'free' | 'pro' | 'admin';

export type MemvoFolderKind = 'system' | 'custom';
export type MemvoSyncStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'failed';

export type MemvoUserProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  plan: MemvoPlan;
  isAdmin: boolean;
  referralCode: string | null;
  referredByCode: string | null;
  referralBonusMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type MemvoFolder = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  kind: MemvoFolderKind;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type MemvoNote = {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  transcript: string | null;
  summary: string | null;
  actionItems: string[];
  tags: string[];
  audioPath: string | null;
  durationSeconds: number | null;
  languageCode: string | null;
  syncStatus: MemvoSyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type MemvoSyncQueueItem = {
  id: string;
  userId: string;
  noteId: string | null;
  localUri: string;
  status: MemvoSyncStatus;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemvoReferral = {
  id: string;
  referrerUserId: string;
  referredUserId: string | null;
  referralCode: string;
  status: 'pending' | 'qualified' | 'rewarded';
  rewardedMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export const MEMVO_PLAN_FEATURES: Record<MemvoPlan, string[]> = {
  free: ['on-device transcription', 'weekly recording limit', 'basic note management'],
  pro: ['whisper transcription', 'claude summaries', 'unlimited notes', 'multilingual support', 'priority processing'],
  admin: ['manual pro grants', 'referral review', 'operational dashboard'],
};

export function canUseMemvoFeature(plan: MemvoPlan, feature: string) {
  return MEMVO_PLAN_FEATURES[plan].includes(feature) || plan === 'admin';
}
