import { describe, expect, it } from 'vitest';

import type { MemvoNote } from '../lib/memvo-domain';
import { buildTopicClusters } from '../lib/memvo-organization';

function createNote(id: string, tags: string[]): MemvoNote {
  return {
    id,
    userId: 'user-1',
    title: `Note ${id}`,
    transcript: 'Transcript',
    transcriptionPreview: null,
    summary: 'Summary',
    actionItems: [],
    tags,
    folderId: null,
    recordedAt: '2026-05-12T09:00:00.000Z',
    durationSeconds: 120,
    audioPath: '/tmp/audio.m4a',
    localOnly: false,
    aiProcessedAt: null,
    aiError: null,
    createdAt: '2026-05-12T09:00:00.000Z',
    updatedAt: '2026-05-12T09:00:00.000Z',
    syncStatus: 'complete',
    aiProcessingStatus: 'complete',
    isStarred: false,
    transcriptionEngine: 'whisper',
    languageDetected: 'en',
    lastError: null,
    isTranscribingLive: false,
    mood: 'focused',
    speakers: null,
  };
}

describe('buildTopicClusters', () => {
  it('hides clusters when the user has fewer than five total notes', () => {
    const notes = [
      createNote('1', ['Work']),
      createNote('2', ['Work', 'Ideas']),
      createNote('3', ['Personal']),
      createNote('4', ['Ideas']),
    ];

    expect(buildTopicClusters(notes, { minTotalNotes: 5 })).toEqual([]);
  });

  it('sorts clusters by note count descending and limits output to eight cards', () => {
    const notes = [
      createNote('1', ['Work', 'Ideas']),
      createNote('2', ['Work', 'Ideas']),
      createNote('3', ['Work', 'Clients']),
      createNote('4', ['Ideas', 'Clients']),
      createNote('5', ['Work', 'Health']),
      createNote('6', ['Family', 'Health']),
      createNote('7', ['Travel']),
      createNote('8', ['Reading']),
      createNote('9', ['Finance']),
      createNote('10', ['Fitness']),
    ];

    const clusters = buildTopicClusters(notes, { minTotalNotes: 5, max: 8 });

    expect(clusters).toHaveLength(8);
    expect(clusters[0]).toMatchObject({ id: 'Work', count: 4 });
    expect(clusters[1]).toMatchObject({ id: 'Ideas', count: 3 });
    expect(clusters[2]).toMatchObject({ id: 'Clients', count: 2 });
    expect(clusters.map((cluster) => cluster.id)).toEqual([
      'Work',
      'Ideas',
      'Clients',
      'Health',
      'Family',
      'Finance',
      'Fitness',
      'Reading',
    ]);
  });

  it('normalizes hash-prefixed tags into clean topic names', () => {
    const notes = [
      createNote('1', ['#Work']),
      createNote('2', ['Work']),
      createNote('3', ['#Work', '#Ideas']),
      createNote('4', ['Ideas']),
      createNote('5', ['#Ideas']),
    ];

    expect(buildTopicClusters(notes, { minTotalNotes: 5 })).toEqual([
      { id: 'Ideas', label: 'Ideas', count: 3 },
      { id: 'Work', label: 'Work', count: 3 },
    ]);
  });
});
