import type { MemvoUserProfile } from './memvo-domain';
import { normalizePlan } from './memvo-transcription';

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type MemvoSupabaseProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  plan?: string | null;
  is_admin?: boolean | null;
  manual_pro?: boolean | null;
  referral_code?: string | null;
  referred_by_code?: string | null;
  bonus_minutes?: number | null;
  minutes_used_this_month?: number | null;
  ai_chat_queries_today?: number | null;
  ai_chat_reset_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function coalesceProfileValue<T>(primary: T | null | undefined, secondary: T | null | undefined, fallback: T): T {
  return primary ?? secondary ?? fallback;
}

export function resolveMemvoUserProfile(params: {
  authUser: AuthUserLike;
  hasRevenueCatPro: boolean;
  userProfileRow: MemvoSupabaseProfileRow | null;
  usersRow: MemvoSupabaseProfileRow | null;
  nowIso?: string;
}): MemvoUserProfile {
  const { authUser, hasRevenueCatPro, userProfileRow, usersRow } = params;
  const nowIso = params.nowIso ?? new Date().toISOString();
  const authMetadata = authUser.user_metadata ?? null;
  const fullNameFromAuth = (authMetadata?.full_name as string | undefined) ?? (authMetadata?.name as string | undefined) ?? null;
  const avatarUrlFromAuth = (authMetadata?.avatar_url as string | undefined) ?? null;
  const isAdmin = Boolean(userProfileRow?.is_admin) || Boolean(usersRow?.is_admin);
  const manualPro = Boolean(userProfileRow?.manual_pro) || Boolean(usersRow?.manual_pro);
  const rawPlan = hasRevenueCatPro ? 'pro' : userProfileRow?.plan ?? usersRow?.plan ?? 'free';

  return {
    id: userProfileRow?.id ?? usersRow?.id ?? authUser.id,
    email: coalesceProfileValue(userProfileRow?.email, usersRow?.email, authUser.email ?? null),
    fullName: coalesceProfileValue(userProfileRow?.full_name, usersRow?.full_name, fullNameFromAuth),
    avatarUrl: coalesceProfileValue(userProfileRow?.avatar_url, usersRow?.avatar_url, avatarUrlFromAuth),
    plan: normalizePlan(rawPlan, isAdmin),
    isAdmin,
    manualPro,
    referralCode: coalesceProfileValue(userProfileRow?.referral_code, usersRow?.referral_code, null),
    referredByCode: coalesceProfileValue(userProfileRow?.referred_by_code, usersRow?.referred_by_code, null),
    bonusMinutes: Number(coalesceProfileValue(userProfileRow?.bonus_minutes, usersRow?.bonus_minutes, 0)),
    minutesUsedThisMonth: Number(coalesceProfileValue(userProfileRow?.minutes_used_this_month, usersRow?.minutes_used_this_month, 0)),
    aiChatQueriesToday: Number(userProfileRow?.ai_chat_queries_today ?? 0),
    aiChatResetDate: typeof userProfileRow?.ai_chat_reset_date === 'string' ? userProfileRow.ai_chat_reset_date : null,
    createdAt: coalesceProfileValue(userProfileRow?.created_at, usersRow?.created_at, nowIso),
    updatedAt: coalesceProfileValue(userProfileRow?.updated_at, usersRow?.updated_at, nowIso),
  };
}
