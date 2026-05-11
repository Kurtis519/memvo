import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const signupSource = readFileSync(path.resolve(process.cwd(), 'app/signup.tsx'), 'utf-8');
const settingsSource = readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');

describe('Auth screen flow source wiring', () => {
  it('routes a successful signup session to the home tabs', () => {
    expect(signupSource).toContain("router.replace('/(tabs)'");
  });

  it('routes standard sign-out to the login screen', () => {
    expect(settingsSource).toContain("router.replace('/login');");
  });

  it('only routes account deletion back to onboarding', () => {
    expect(settingsSource).toContain("router.replace('/onboarding');");
  });
});
