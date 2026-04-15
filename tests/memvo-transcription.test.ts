import { describe, expect, it } from 'vitest';

import {
  MEMVO_AI_READY_LABEL,
  MEMVO_ANALYSING_LABEL,
  MEMVO_FREE_LIMIT_MESSAGE,
  MEMVO_MAX_TRANSCRIPTION_RETRIES,
  buildEngineSummary,
  buildNextRetryAt,
  buildTranscriptionFailureMessage,
  createFallbackPlanCheckResult,
  getAllowedFreeMinutes,
  getNoteProcessingLabel,
  getStatusTone,
  hasRemainingFreeMinutes,
  normalizeLanguageBadge,
  normalizePlan,
  shouldRetry,
  shouldShowRetryNotification,
} from '../lib/memvo-transcription';

describe('memvo transcription helpers', () => {
  it('falls back to the free plan when no verified plan is available', () => {
    expect(createFallbackPlanCheckResult()).toEqual({
      plan: 'free',
      source: 'fallback',
    });
  });

  it('adds bonus minutes to the free allowance and enforces the cap', () => {
    expect(getAllowedFreeMinutes({ bonusMinutes: 30 })).toBe(150);
    expect(getAllowedFreeMinutes({ bonusMinutes: 120 })).toBe(240);
    expect(
      hasRemainingFreeMinutes(
        {
          bonusMinutes: 30,
          minutesUsedThisMonth: 149,
        },
        30,
      ),
    ).toBe(true);
    expect(
      hasRemainingFreeMinutes(
        {
          bonusMinutes: 0,
          minutesUsedThisMonth: 120,
        },
        1,
      ),
    ).toBe(false);
  });

  it('normalizes plan and language display values for UI use', () => {
    expect(normalizePlan('pro')).toBe('pro');
    expect(normalizePlan('admin')).toBe('admin');
    expect(normalizePlan('free', true)).toBe('admin');
    expect(normalizeLanguageBadge('english')).toBe('EN');
    expect(normalizeLanguageBadge(null)).toBeNull();
  });

  it('computes retry timing and retry eligibility correctly', () => {
    const now = new Date('2026-04-13T12:00:00.000Z');
    expect(buildNextRetryAt(2, now)).toBe('2026-04-13T12:01:00.000Z');
    expect(
      shouldRetry(
        {
          status: 'pending',
          retryCount: 0,
          nextRetryAt: null,
        },
        now,
      ),
    ).toBe(true);
    expect(
      shouldRetry(
        {
          status: 'failed',
          retryCount: MEMVO_MAX_TRANSCRIPTION_RETRIES,
          nextRetryAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      shouldRetry(
        {
          status: 'pending',
          retryCount: 1,
          nextRetryAt: '2026-04-13T12:01:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('shows retry notifications only after the final failed attempt', () => {
    expect(
      shouldShowRetryNotification({
        status: 'failed',
        retryCount: MEMVO_MAX_TRANSCRIPTION_RETRIES,
        notificationShown: false,
      }),
    ).toBe(true);
    expect(
      shouldShowRetryNotification({
        status: 'failed',
        retryCount: 1,
        notificationShown: false,
      }),
    ).toBe(false);
    expect(
      shouldShowRetryNotification({
        status: 'failed',
        retryCount: MEMVO_MAX_TRANSCRIPTION_RETRIES,
        notificationShown: true,
      }),
    ).toBe(false);
  });

  it('builds user-facing status and failure labels for transcription progress', () => {
    expect(
      getNoteProcessingLabel({
        syncStatus: 'complete',
        transcriptionEngine: 'whisper',
        lastError: null,
        aiProcessingStatus: 'complete',
        aiError: null,
      }),
    ).toBe(MEMVO_AI_READY_LABEL);
    expect(
      getNoteProcessingLabel({
        syncStatus: 'transcribing',
        transcriptionEngine: 'on-device',
        lastError: null,
        aiProcessingStatus: 'idle',
        aiError: null,
      }),
    ).toContain('device');
    expect(
      getNoteProcessingLabel({
        syncStatus: 'complete',
        transcriptionEngine: 'whisper',
        lastError: null,
        aiProcessingStatus: 'processing',
        aiError: null,
      }),
    ).toBe(MEMVO_ANALYSING_LABEL);
    expect(buildTranscriptionFailureMessage(new Error(MEMVO_FREE_LIMIT_MESSAGE))).toBe(MEMVO_FREE_LIMIT_MESSAGE);
    expect(buildTranscriptionFailureMessage('custom failure')).toBe('custom failure');
    expect(buildEngineSummary('whisper')).toContain('Whisper');
    expect(getStatusTone('failed')).toBe('error');
    expect(getStatusTone('complete', 'processing')).toBe('progress');
    expect(getStatusTone('complete', 'complete')).toBe('success');
  });
});
