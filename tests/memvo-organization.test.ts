import { describe, expect, it } from 'vitest';

import type { MemvoNote } from '../lib/memvo-domain';
import {
  buildDefaultFolders,
  buildRecentSearches,
  buildTimelineSections,
  ensureDefaultFolders,
  filterNotesByFilters,
  searchNotes,
} from '../lib/memvo-organization';

const folders = buildDefaultFolders('user-1', '2026-04-14T12:00:00.000Z');
const meetingsFolder = folders.find((folder) => folder.slug === 'meetings');

const notes: MemvoNote[] = [
  {
    id: 'note-1',
    userId: 'user-1',
    folderId: meetingsFolder?.id ?? null,
    title: 'Investor follow-up ideas',
    createdAt: '2026-04-14T12:00:00.000Z',
    updatedAt: '2026-04-14T12:00:00.000Z',
    recordedAt: '2026-04-14T12:00:00.000Z',
    audioPath: '',
    localOnly: false,
    durationSeconds: 600,
    syncStatus: 'complete',
    transcript: 'We should simplify pricing and send a follow-up email tomorrow.',
    summary: 'Pricing language should be simplified before the next investor call.',
    actionItems: ['Draft investor recap'],
    tags: ['pricing', 'investor'],
    mood: null,
    isStarred: true,
    transcriptionEngine: 'whisper',
    languageDetected: 'en',
    aiProcessingStatus: 'complete',
    aiProcessedAt: '2026-04-14T12:05:00.000Z',
    aiError: null,
    lastError: null,
    isTranscribingLive: false,
    transcriptionPreview: null,
  },
  {
    id: 'note-2',
    userId: 'user-1',
    folderId: null,
    title: 'Morning reflection',
    createdAt: '2026-04-10T08:00:00.000Z',
    updatedAt: '2026-04-10T08:00:00.000Z',
    recordedAt: '2026-04-10T08:00:00.000Z',
    audioPath: '',
    localOnly: false,
    durationSeconds: 240,
    syncStatus: 'complete',
    transcript: 'I want to protect focus time and avoid context switching next week.',
    summary: 'A short journal entry about protecting focus time.',
    actionItems: [],
    tags: ['journal', 'focus'],
    mood: 'calm',
    isStarred: false,
    transcriptionEngine: 'whisper',
    languageDetected: 'en',
    aiProcessingStatus: 'complete',
    aiProcessedAt: '2026-04-10T08:03:00.000Z',
    aiError: null,
    lastError: null,
    isTranscribingLive: false,
    transcriptionPreview: null,
  },
];

describe('memvo organization helpers', () => {
  it('preserves the required default folders and keeps custom folders after merging', () => {
    const merged = ensureDefaultFolders(
      [
        ...folders,
        {
          id: 'custom-1',
          userId: 'user-1',
          name: 'Clients',
          slug: 'clients',
          kind: 'custom',
          position: 5,
          createdAt: '2026-04-12T09:00:00.000Z',
          updatedAt: '2026-04-12T09:00:00.000Z',
        },
      ],
      'user-1',
    );

    expect(merged.map((folder) => folder.slug)).toEqual([
      'all-notes',
      'starred',
      'journals',
      'meetings',
      'ideas',
      'clients',
    ]);
  });

  it('keeps recent searches unique and limited to five entries', () => {
    const recent = ['pricing', 'focus', 'weekly review', 'meeting notes', 'roadmap'];
    expect(buildRecentSearches(recent, 'pricing')).toEqual(recent);
    expect(buildRecentSearches(recent, 'investor')).toEqual([
      'investor',
      'pricing',
      'focus',
      'weekly review',
      'meeting notes',
    ]);
  });

  it('filters notes by folder and tag together', () => {
    const filtered = filterNotesByFilters(
      notes,
      {
        tag: 'pricing',
        folderId: meetingsFolder?.id ?? null,
        dateRange: 'all',
        customStart: null,
        customEnd: null,
      },
      folders,
      new Date('2026-04-14T12:00:00.000Z'),
    );

    expect(filtered.map((note) => note.id)).toEqual(['note-1']);
  });

  it('returns ranked search results with transcript snippets', () => {
    const results = searchNotes(
      notes,
      'pricing',
      {
        tag: null,
        folderId: null,
        dateRange: 'all',
        customStart: null,
        customEnd: null,
      },
      folders,
      new Date('2026-04-14T12:00:00.000Z'),
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.note.id).toBe('note-1');
    expect(results[0]?.snippet.toLowerCase()).toContain('pricing');
  });

  it('builds timeline sections grouped by date recency', () => {
    const sections = buildTimelineSections(notes, new Date('2026-04-14T12:00:00.000Z'));
    expect(sections[0]?.title).toBe('Today');
    expect(sections[0]?.data[0]?.id).toBe('note-1');
  });
});
