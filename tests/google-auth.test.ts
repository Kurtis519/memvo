import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
  vi.unmock('expo-constants');
  vi.unmock('react-native');
  vi.unmock('expo-web-browser');
  vi.unmock('expo-auth-session');
  vi.unmock('expo-auth-session/providers/google');
  vi.unmock('@/lib/supabase');
});

describe('google auth helper config', () => {
  it('uses the hardcoded Android client ID fallback and still reports a missing iOS native client ID when env values are absent', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

    vi.doMock('expo-constants', () => ({
      default: {
        expoConfig: {
          ios: { bundleIdentifier: 'com.memvo.app' },
          android: { package: 'com.memvo.mobile' },
          extra: {},
        },
      },
    }));

    vi.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));

    vi.doMock('expo-web-browser', () => ({
      maybeCompleteAuthSession: vi.fn(),
    }));

    vi.doMock('expo-auth-session', () => ({}));
    vi.doMock('expo-auth-session/providers/google', () => ({
      useIdTokenAuthRequest: vi.fn(() => [null, null, vi.fn()]),
    }));
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        auth: {},
      },
    }));

    const { getGoogleAuthConfigStatus } = await import('../lib/google-auth');
    const status = getGoogleAuthConfigStatus();

    expect(status.nativeRedirectUri).toBe('com.memvo.mobile:/oauthredirect');
    expect(status.androidClientId).toBe('283329134832-fa10lpd3hdsk10svodpteovheu4tlhu2.apps.googleusercontent.com');
    expect(status.missingNativeClientIds).toEqual([
      'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    ]);
    expect(status.hasNativeClientIds).toBe(false);
    expect(status.missingPublicClientIds).toContain('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  });

  it('uses configured public Google client IDs and derives the iOS redirect URI when values are present', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = 'android-client-id';

    vi.doMock('expo-constants', () => ({
      default: {
        expoConfig: {
          ios: { bundleIdentifier: 'com.memvo.app' },
          android: { package: 'com.memvo.mobile' },
          extra: {},
        },
      },
    }));

    vi.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));

    vi.doMock('expo-web-browser', () => ({
      maybeCompleteAuthSession: vi.fn(),
    }));

    vi.doMock('expo-auth-session', () => ({}));
    vi.doMock('expo-auth-session/providers/google', () => ({
      useIdTokenAuthRequest: vi.fn(() => [null, null, vi.fn()]),
    }));
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        auth: {},
      },
    }));

    const { getGoogleAuthConfigStatus } = await import('../lib/google-auth');
    const status = getGoogleAuthConfigStatus();

    expect(status.nativeRedirectUri).toBe('com.memvo.app:/oauthredirect');
    expect(status.webClientId).toBe('web-client-id');
    expect(status.iosClientId).toBe('ios-client-id');
    expect(status.androidClientId).toBe('android-client-id');
    expect(status.missingNativeClientIds).toEqual([]);
    expect(status.hasAllClientIds).toBe(true);
  });
});
