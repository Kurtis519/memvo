import { describe, expect, it } from 'vitest';

import { buildExportText, parseTranscriptTimeSeconds } from '../lib/memvo-note-detail';

describe('memvo note detail helpers', () => {
  it('parses transcript timestamps at the start of a line', () => {
    expect(parseTranscriptTimeSeconds('[03:15] Follow up with the landlord')).toBe(195);
    expect(parseTranscriptTimeSeconds('No timestamp here')).toBeNull();
  });

  it('builds a readable text export with summary, actions, and transcript', () => {
    const exported = buildExportText({
      title: 'Client call recap',
      recordedAt: '2026-04-14T14:30:00.000Z',
      durationSeconds: 125,
      mood: 'focused',
      summary: 'Send the proposal and confirm the staging timeline.',
      actionItems: ['Email the proposal', 'Book the follow-up review'],
      tags: ['client', 'staging'],
      transcript: 'We should send the proposal by Friday.',
    });

    expect(exported).toContain('Client call recap');
    expect(exported).toContain('Mood: focused');
    expect(exported).toContain('Tags: client, staging');
    expect(exported).toContain('1. Email the proposal');
    expect(exported).toContain('Transcript');
  });

  it('falls back cleanly when summary, actions, or transcript are unavailable', () => {
    const exported = buildExportText({
      title: 'Untitled',
      recordedAt: '2026-04-14T14:30:00.000Z',
      durationSeconds: 8,
      mood: null,
      summary: null,
      actionItems: [],
      tags: [],
      transcript: null,
    });

    expect(exported).toContain('No AI summary yet.');
    expect(exported).toContain('No action items.');
    expect(exported).toContain('No transcript yet.');
  });
});
