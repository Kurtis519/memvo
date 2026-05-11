import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const onboardingSource = readFileSync(path.resolve(process.cwd(), 'app/onboarding.tsx'), 'utf-8');

describe('Onboarding screen rewrite', () => {
  it('contains the required visible copy for all three slides', () => {
    expect(onboardingSource).toContain('Your voice. Your memory. Your privacy.');
    expect(onboardingSource).toContain("Record, transcribe and organise your thoughts — privately.");
    expect(onboardingSource).toContain("Everything you need. Nothing you don't.");
    expect(onboardingSource).toContain('Bot-free recording');
    expect(onboardingSource).toContain('100+ languages (Pro)');
    expect(onboardingSource).toContain('Audio deleted instantly');
    expect(onboardingSource).toContain('Simple, honest pricing.');
    expect(onboardingSource).toContain('No hidden fees. No surprise charges. Cancel anytime.');
  });

  it('uses explicit hardcoded white and text colors instead of theme tokens', () => {
    expect(onboardingSource).toContain("backgroundColor: '#FFFFFF'");
    expect(onboardingSource).toContain("color: '#1A1A1A'");
    expect(onboardingSource).toContain("color: '#555555'");
    expect(onboardingSource).not.toContain('styles.');
    expect(onboardingSource).not.toContain('theme');
    expect(onboardingSource).not.toContain('useColors');
  });

  it('writes onboarding completion and routes Get started to signup', () => {
    expect(onboardingSource).toContain('await writeHasSeenOnboarding(true);');
    expect(onboardingSource).toContain("router.replace('/signup'");
    expect(onboardingSource).toContain("{currentSlide === 2 ? 'Get started' : 'Next'}");
  });
});
