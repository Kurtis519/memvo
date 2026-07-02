import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getEntryTarget, resolveAuthGateTarget } from '../lib/memvo-auth-routing';

const useAuthSource = readFileSync(path.resolve(process.cwd(), 'hooks/use-auth.ts'), 'utf-8');

/**
 * End-to-end smoke test for the full sign-in journey: a brand new user
 * landing on the app, moving through onboarding, signing in, and arriving
 * on the home feed — without ever bouncing back to onboarding or login.
 *
 * This walks the same routing decisions the app makes at each screen,
 * using the real getEntryTarget / resolveAuthGateTarget functions so the
 * test fails if the routing logic regresses to the redirect loop bug.
 */
describe('Auth smoke test: onboarding -> login -> home feed', () => {
  it('routes a brand new device to onboarding on first launch', () => {
    expect(
      getEntryTarget({ isAuthenticated: false, hasSeenOnboarding: false }),
    ).toBe('/onboarding');
  });

  it('keeps an unauthenticated first-time visitor on the onboarding screen', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/onboarding',
        isAuthenticated: false,
        loading: false,
        hasSeenOnboarding: false,
      }),
    ).toEqual({ ready: true, target: null });
  });

  it('sends the user to login once onboarding has been completed', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/onboarding',
        isAuthenticated: false,
        loading: false,
        hasSeenOnboarding: true,
      }),
    ).toEqual({ ready: true, target: '/login' });
  });

  it('keeps the user on login while auth state is still loading', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/login',
        isAuthenticated: false,
        loading: true,
        hasSeenOnboarding: true,
      }),
    ).toEqual({ ready: false, target: null });
  });

  it('routes a freshly authenticated user from login straight to the home feed', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/login',
        isAuthenticated: true,
        loading: false,
        hasSeenOnboarding: true,
      }),
    ).toEqual({ ready: true, target: '/(tabs)' });
  });

  it('never sends an authenticated user back to onboarding, even from the root route', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/',
        isAuthenticated: true,
        loading: false,
        hasSeenOnboarding: true,
      }),
    ).toEqual({ ready: true, target: '/(tabs)' });
  });

  it('leaves an authenticated user on the home feed without redirect once arrived', () => {
    expect(
      resolveAuthGateTarget({
        pathname: '/(tabs)',
        isAuthenticated: true,
        loading: false,
        hasSeenOnboarding: true,
      }),
    ).toEqual({ ready: true, target: null });
  });

  it('confirms the root entry route sends a fully authenticated returning user to home, not onboarding', () => {
    expect(
      getEntryTarget({ isAuthenticated: true, hasSeenOnboarding: true }),
    ).toBe('/(tabs)');
  });
});

/**
 * Regression guard for the Android sign-in redirect-loop bug: an
 * already-authenticated user was bounced back to onboarding because
 * hooks/use-auth.ts re-ran its Supabase session bootstrap on every newly
 * mounted screen and let a racing AsyncStorage read clobber the signed-in
 * user back to null. These assertions fail if that pattern reappears.
 */
describe('use-auth.ts: Android session-race regression guard', () => {
  it('bootstraps the Supabase session exactly once per app lifetime, not per mounted screen', () => {
    expect(useAuthSource).toMatch(/let authBootstrapStarted = false;/);
    expect(useAuthSource).toMatch(/if \(authBootstrapStarted\)\s*{\s*return;\s*}/);
    expect(useAuthSource).not.toMatch(/authBootstrapPromise/);
  });

  it('attaches the onAuthStateChange listener before the initial getSession() read', () => {
    const listenerIndex = useAuthSource.indexOf('ensureAuthListener();');
    const getSessionIndex = useAuthSource.indexOf('supabase.auth\n    .getSession()');

    expect(listenerIndex).toBeGreaterThan(-1);
    expect(getSessionIndex).toBeGreaterThan(-1);
    expect(listenerIndex).toBeLessThan(getSessionIndex);
  });

  it('never downgrades an already-authenticated user to null on a racy session read', () => {
    expect(useAuthSource).toMatch(/user:\s*mapped\s*\?\?\s*authSnapshot\.user/);
  });
});
