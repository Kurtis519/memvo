import config from '../app.config';
import { getEntryTarget, resolveAuthGateTarget } from '../lib/memvo-auth-routing';
import { describe, expect, it } from 'vitest';

describe('Memvo OAuth app configuration', () => {
  it('keeps the intended platform identifiers and Google redirect URIs aligned', () => {
    expect(config.ios?.bundleIdentifier).toBe('com.memvo.app');
    expect(config.android?.package).toBe('com.memvo.mobile');
    expect(config.scheme).toEqual(['memvo', 'com.memvo.app', 'com.memvo.mobile']);

    const extra = config.extra as {
      googleWebClientId?: string;
      googleIosClientId?: string;
      googleAndroidClientId?: string;
      googleIosRedirectUri?: string;
      googleAndroidRedirectUri?: string;
      iosBundleId?: string;
      androidPackage?: string;
    };

    expect(extra.iosBundleId).toBe('com.memvo.app');
    expect(extra.androidPackage).toBe('com.memvo.mobile');
    expect(extra.googleIosRedirectUri).toBe('com.memvo.app:/oauthredirect');
    expect(extra.googleAndroidRedirectUri).toBe('com.memvo.mobile:/oauthredirect');
    expect(extra.googleWebClientId).toBe(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
    expect(extra.googleIosClientId).toBe(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
    expect(extra.googleAndroidClientId).toBe(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
  });
});

describe('Memvo auth entry routing', () => {
  it('sends a first-time signed-out user to onboarding from the root entry route', () => {
    expect(getEntryTarget({ isAuthenticated: false, hasSeenOnboarding: false })).toBe('/onboarding');
  });

  it('sends a returning signed-out user to login from the root entry route', () => {
    expect(getEntryTarget({ isAuthenticated: false, hasSeenOnboarding: true })).toBe('/login');
  });

  it('sends a signed-in user directly to the home tabs from the root entry route', () => {
    expect(getEntryTarget({ isAuthenticated: true, hasSeenOnboarding: true })).toBe('/(tabs)');
  });

  it('keeps the onboarding route for a first-time signed-out user inside the auth gate', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/library',
        isAuthenticated: false,
        loading: false,
        hasSeenOnboarding: false,
      }),
    ).toEqual({ ready: true, target: '/onboarding' });
  });

  it('keeps the login route for a returning signed-out user inside the auth gate', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/library',
        isAuthenticated: false,
        loading: false,
        hasSeenOnboarding: true,
      }),
    ).toEqual({ ready: true, target: '/login' });
  });

  it('sends an authenticated user away from signed-out routes and toward home', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/login',
        isAuthenticated: true,
        loading: false,
        hasSeenOnboarding: true,
      }),
    ).toEqual({ ready: true, target: '/' });
  });
});
