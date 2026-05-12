import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const settingsSource = readFileSync(path.resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf-8');

describe('Settings onboarding reset wiring', () => {
  it('shows a Reset onboarding row in App preferences', () => {
    expect(settingsSource).toContain('label="Reset onboarding"');
    expect(settingsSource).toContain('Clear the first-run flag and reopen the onboarding slides for testing');
  });

  it('clears the onboarding flag and routes back to onboarding', () => {
    expect(settingsSource).toContain('await resetHasSeenOnboarding();');
    expect(settingsSource).toContain("router.replace('/onboarding');");
  });
});
