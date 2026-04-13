import { describe, expect, it, vi } from 'vitest';

import { buildFeedTimestampLabel, buildTemporaryNoteTitle, formatDuration, getRetryableQueueStatus } from '../lib/memvo-recording-utils';

describe('memvo recording utilities', () => {
  it('formats duration in mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(61_000)).toBe('01:01');
  });

  it('builds a temporary note title with date and time', () => {
    const title = buildTemporaryNoteTitle(new Date('2026-04-08T13:41:00.000Z'));
    expect(title).toContain('Voice note —');
  });

  it('labels a feed timestamp for today and yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T15:00:00.000Z'));
    expect(buildFeedTimestampLabel(new Date('2026-04-12T14:41:00.000Z'))).toContain('Today');
    expect(buildFeedTimestampLabel(new Date('2026-04-11T14:41:00.000Z'))).toContain('Yesterday');
    vi.useRealTimers();
  });

  it('converts failed retryable items back to pending until the retry cap', () => {
    expect(
      getRetryableQueueStatus({
        id: 'queue-1',
        noteId: 'note-1',
        localUri: 'file:///note.m4a',
        status: 'failed',
        retryCount: 2,
        errorMessage: 'offline',
        remoteQueueId: null,
        fileSizeBytes: 1,
        createdAt: '2026-04-12T14:00:00.000Z',
        updatedAt: '2026-04-12T14:00:00.000Z',
        lastAttemptAt: null,
        nextRetryAt: null,
        plan: null,
        notificationShown: false,
      }),
    ).toBe('pending');
  });
});
