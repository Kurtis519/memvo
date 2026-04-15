import { describe, expect, it } from 'vitest';

import {
  buildReferralShareMessage,
  extractReferralCodeFromUrl,
  getReferralLink,
  normalizeReferralCode,
} from '../lib/memvo-referral-utils';

describe('memvo referral helpers', () => {
  it('normalizes valid referral codes and rejects malformed values', () => {
    expect(normalizeReferralCode('memvo-ab12cd')).toBe('MEMVO-AB12CD');
    expect(normalizeReferralCode(' MEMVO-Z9X8Y7 ')).toBe('MEMVO-Z9X8Y7');
    expect(normalizeReferralCode('invalid')).toBeNull();
    expect(normalizeReferralCode('MEMVO-TOO-LONG')).toBeNull();
  });

  it('builds the placeholder referral link with the invite code', () => {
    expect(getReferralLink('memvo-ab12cd')).toBe('https://memvo.app/join?ref=MEMVO-AB12CD');
    expect(getReferralLink(null)).toBe('https://memvo.app/join');
  });

  it('extracts referral codes from both full URLs and fallback query strings', () => {
    expect(extractReferralCodeFromUrl('https://memvo.app/join?ref=memvo-ab12cd')).toBe('MEMVO-AB12CD');
    expect(extractReferralCodeFromUrl('memvo://join?ref=memvo-z9x8y7')).toBe('MEMVO-Z9X8Y7');
    expect(extractReferralCodeFromUrl('?ref=memvo-q1w2e3')).toBe('MEMVO-Q1W2E3');
    expect(extractReferralCodeFromUrl('https://memvo.app/join')).toBeNull();
  });

  it('includes the invite link in the share message', () => {
    const message = buildReferralShareMessage('memvo-ab12cd');
    expect(message).toContain('I use Memvo to record and transcribe my voice notes privately');
    expect(message).toContain('https://memvo.app/join?ref=MEMVO-AB12CD');
  });
});
