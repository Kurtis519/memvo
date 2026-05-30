import { describe, expect, it } from 'vitest';

import { resolveMemvoUserProfile, type MemvoSupabaseProfileRow } from '../lib/memvo-profile-resolution';

const authUser = {
  id: 'user-123',
  email: 'admin@memvo.app',
  user_metadata: {
    full_name: 'Admin User',
    avatar_url: 'https://example.com/avatar.png',
  },
};

function buildRow(overrides: Partial<MemvoSupabaseProfileRow>): MemvoSupabaseProfileRow {
  return {
    id: 'user-123',
    email: 'admin@memvo.app',
    full_name: 'Stored User',
    avatar_url: 'https://example.com/stored.png',
    plan: 'free',
    is_admin: false,
    manual_pro: false,
    referral_code: 'MEMVO-123456',
    referred_by_code: null,
    bonus_minutes: 0,
    minutes_used_this_month: 12,
    ai_chat_queries_today: 3,
    ai_chat_reset_date: '2026-05-30',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveMemvoUserProfile', () => {
  it('marks the user as admin when `user_profiles.is_admin` is true', () => {
    const profile = resolveMemvoUserProfile({
      authUser,
      hasRevenueCatPro: false,
      userProfileRow: buildRow({ is_admin: true }),
      usersRow: buildRow({ is_admin: false }),
      nowIso: '2026-05-30T12:00:00.000Z',
    });

    expect(profile.isAdmin).toBe(true);
    expect(profile.plan).toBe('admin');
  });

  it('marks the user as admin when only `users.is_admin` is true', () => {
    const profile = resolveMemvoUserProfile({
      authUser,
      hasRevenueCatPro: false,
      userProfileRow: buildRow({ is_admin: false }),
      usersRow: buildRow({ is_admin: true, plan: 'free' }),
      nowIso: '2026-05-30T12:00:00.000Z',
    });

    expect(profile.isAdmin).toBe(true);
    expect(profile.plan).toBe('admin');
  });

  it('falls back to the `users` row when the canonical `user_profiles` row is missing', () => {
    const profile = resolveMemvoUserProfile({
      authUser,
      hasRevenueCatPro: false,
      userProfileRow: null,
      usersRow: buildRow({ is_admin: true, manual_pro: true, full_name: 'Users Table Name' }),
      nowIso: '2026-05-30T12:00:00.000Z',
    });

    expect(profile.id).toBe('user-123');
    expect(profile.fullName).toBe('Users Table Name');
    expect(profile.isAdmin).toBe(true);
    expect(profile.manualPro).toBe(true);
  });
});
