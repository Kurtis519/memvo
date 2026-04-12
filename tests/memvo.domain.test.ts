import { describe, expect, it } from 'vitest';

import { MEMVO_PLAN_FEATURES, canUseMemvoFeature } from '../lib/memvo-domain';

describe('Memvo domain rules', () => {
  it('keeps free and pro plan features distinct', () => {
    expect(MEMVO_PLAN_FEATURES.free).toContain('on-device transcription');
    expect(MEMVO_PLAN_FEATURES.free).not.toContain('claude summaries');
    expect(MEMVO_PLAN_FEATURES.pro).toContain('claude summaries');
  });

  it('allows admin access across all gated features', () => {
    expect(canUseMemvoFeature('admin', 'manual pro grants')).toBe(true);
    expect(canUseMemvoFeature('admin', 'whisper transcription')).toBe(true);
  });
});
