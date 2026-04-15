export const MEMVO_REFERRAL_LINK_BASE_URL = 'https://memvo.app/join';
export const MEMVO_REFERRAL_CODE_PATTERN = /^MEMVO-[A-Z0-9]{6}$/;

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
