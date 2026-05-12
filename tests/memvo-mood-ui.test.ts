import { describe, expect, it } from 'vitest';

import type { MemvoNote } from '../lib/memvo-domain';
import { buildWeeklyMoodInsights, getMoodAppearance, isJournalStyleNote } from '../lib/memvo-organization';

function makeNote(overrides: Partial<MemvoNote>): MemvoNote {
  return {
    id: overrides.id ?? 'note-1',
    userId: overrides.userId ?? 'user-1',
    title: overrides.title ?? 'Journal entry',
    transcript: overrides.transcript ?? 'Today felt productive.',
    transcriptionPreview: overrides.transcriptionPreview ?? null,
    summary: overrides.summary ?? 'A short reflection.',
    actionItems: overrides.actionItems ?? [],
    tags: overrides.tags ?? ['journal'],
    folderId: overrides.folderId ?? null,
    recordedAt: overrides.recordedAt ?? '2026-05-12T09:00:00.000Z',
    durationSeconds: overrides.durationSeconds ?? 120,
    audioPath: overrides.audioPath ?? '/tmp/audio.m4a',
    localOnly: overrides.localOnly ?? false,
    aiProcessedAt: overrides.aiProcessedAt ?? null,
    aiError: overrides.aiError ?? null,
    createdAt: overrides.createdAt ?? '2026-05-12T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-12T09:00:00.000Z',
    syncStatus: overrides.syncStatus ?? 'complete',
    aiProcessingStatus: overrides.aiProcessingStatus ?? 'complete',
    isStarred: overrides.isStarred ?? false,
    transcriptionEngine: overrides.transcriptionEngine ?? 'whisper',
    languageDetected: overrides.languageDetected ?? 'en',
    lastError: overrides.lastError ?? null,
    isTranscribingLive: overrides.isTranscribingLive ?? false,
    mood: overrides.mood ?? 'focused',
    speakers: overrides.speakers ?? null,
  };
}

describe('getMoodAppearance', () => {
  it('returns the requested Part 3 colors and hides neutral moods', () => {
    expect(getMoodAppearance('focused')).toEqual({
      tone: 'focused',
      label: 'Focused',
      backgroundColor: '#E6F1FB',
      textColor: '#0C447C',
    });

    expect(getMoodAppearance('neutral')).toBeNull();
    expect(getMoodAppearance(null)).toBeNull();
  });
});

describe('isJournalStyleNote', () => {
  it('detects journal-tagged notes only', () => {
    expect(isJournalStyleNote(makeNote({ tags: ['journal', 'focus'] }))).toBe(true);
    expect(isJournalStyleNote(makeNote({ tags: ['meeting', 'team'] }))).toBe(false);
  });
});

describe('buildWeeklyMoodInsights', () => {
  it('builds the requested weekly summary from the last 7 days only', () => {
    const notes = [
      makeNote({ id: '1', mood: 'focused', recordedAt: '2026-05-12T09:00:00.000Z' }),
      makeNote({ id: '2', mood: 'focused', recordedAt: '2026-05-11T09:00:00.000Z' }),
      makeNote({ id: '3', mood: 'reflective', recordedAt: '2026-05-10T09:00:00.000Z' }),
      makeNote({ id: '4', mood: 'grateful', recordedAt: '2026-05-09T09:00:00.000Z' }),
      makeNote({ id: '5', mood: 'neutral', recordedAt: '2026-05-08T09:00:00.000Z' }),
      makeNote({ id: '6', mood: 'focused', recordedAt: '2026-05-01T09:00:00.000Z' }),
    ];

    const insights = buildWeeklyMoodInsights(notes, new Date('2026-05-12T18:00:00.000Z'));

    expect(insights.dominant?.label).toBe('Focused');
    expect(insights.items.map((item) => `${item.label}:${item.count}`)).toEqual([
      'Focused:2',
      'Grateful:1',
      'Reflective:1',
    ]);
    expect(insights.summary).toBe('This week: mostly Focused (2 notes) · 1 Grateful · 1 Reflective');
  });
});
