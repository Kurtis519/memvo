import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from './supabase';

export const MEMVO_PENDING_REFERRAL_CODE_STORAGE_KEY = 'memvo_pending_referral_code';
export const MEMVO_REFERRAL_BANNER_DISMISSED_STORAGE_KEY = 'memvo_referral_banner_dismissed';
export const MEMVO_REFERRAL_LINK_BASE_URL = 'https://memvo.app/join';
export const MEMVO_REFERRAL_CODE_PATTERN = /^MEMVO-[A-Z0-9]{6}$/;

function getWebStorage() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }

  return window.localStorage;
}

async function setStoredValue(key: string, value: string) {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
}

async function getStoredValue(key: string) {
  const webStorage = getWebStorage();
  if (webStorage) {
    return webStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
}

async function removeStoredValue(key: string) {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.removeItem(key);
    return;
  }

  await AsyncStorage.removeItem(key);
}

export function normalizeReferralCode(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  const normalized = code.trim().toUpperCase();
  return MEMVO_REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function getReferralLink(referralCode: string | null | undefined) {
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) {
    return MEMVO_REFERRAL_LINK_BASE_URL;
  }

  const url = new URL(MEMVO_REFERRAL_LINK_BASE_URL);
  url.searchParams.set('ref', normalized);
  return url.toString();
}

export function buildReferralShareMessage(referralCode: string | null | undefined) {
  const link = getReferralLink(referralCode);
  return `I use Memvo to record and transcribe my voice notes privately — no bots, no tracking, just smart AI. Try it free and we both get 30 bonus minutes: ${link}`;
}

export function extractReferralCodeFromUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return normalizeReferralCode(parsed.searchParams.get('ref'));
  } catch {
    const match = url.match(/[?&]ref=([^&]+)/i);
    return normalizeReferralCode(match ? decodeURIComponent(match[1]) : null);
  }
}

export async function storePendingReferralCode(code: string | null | undefined) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    await removeStoredValue(MEMVO_PENDING_REFERRAL_CODE_STORAGE_KEY);
    return null;
  }

  await setStoredValue(MEMVO_PENDING_REFERRAL_CODE_STORAGE_KEY, normalized);
  return normalized;
}

export async function readPendingReferralCode() {
  return normalizeReferralCode(await getStoredValue(MEMVO_PENDING_REFERRAL_CODE_STORAGE_KEY));
}

export async function clearPendingReferralCode() {
  await removeStoredValue(MEMVO_PENDING_REFERRAL_CODE_STORAGE_KEY);
}

export async function dismissReferralBanner() {
  await setStoredValue(MEMVO_REFERRAL_BANNER_DISMISSED_STORAGE_KEY, '1');
}

export async function readReferralBannerDismissed() {
  return (await getStoredValue(MEMVO_REFERRAL_BANNER_DISMISSED_STORAGE_KEY)) === '1';
}

export async function processPendingReferralForCurrentUser() {
  if (!isSupabaseConfigured) {
    return { success: false as const, reason: 'not-configured' as const };
  }

  const referralCode = await readPendingReferralCode();
  if (!referralCode) {
    return { success: false as const, reason: 'no-code' as const };
  }

  const authResult = await supabase.auth.getUser();
  const authUser = authResult.data.user;

  if (!authUser) {
    return { success: false as const, reason: 'no-auth-user' as const };
  }

  const { data, error } = await supabase.functions.invoke('process-referral', {
    body: {
      referrer_code: referralCode,
      new_user_id: authUser.id,
    },
  });

  const errorMessage = error?.message ?? (typeof data?.error === 'string' ? data.error : null);
  const shouldClearPendingCode = Boolean(
    data?.success
      || errorMessage?.includes('already been processed')
      || errorMessage?.includes('Self-referral')
      || errorMessage?.includes('not found'),
  );

  if (shouldClearPendingCode) {
    await clearPendingReferralCode();
  }

  if (error || !data?.success) {
    return {
      success: false as const,
      reason: 'invoke-failed' as const,
      error: errorMessage ?? 'Referral processing failed.',
    };
  }

  return {
    success: true as const,
    bonusMinutesAwarded: Number(data.bonus_minutes_awarded ?? 30),
  };
}
