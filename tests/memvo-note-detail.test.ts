import { describe, expect, it } from 'vitest';

import {
  applySpeakerNamesToTranscriptLine,
  buildExportText,
  getSpeakerLabelFromTranscriptLine,
  listTranscriptSpeakers,
  parseTranscriptTimeSeconds,
} from '../lib/memvo-note-detail';

describe('memvo note detail helpers', () => {
  it('parses transcript timestamps at the start of a line', () => {
    expect(parseTranscriptTimeSeconds('[03:15] Follow up with the landlord')).toBe(195);
    expect(parseTranscriptTimeSeconds('No timestamp here')).toBeNull();
  });

  it('extracts and renames transcript speaker labels', () => {
    expect(getSpeakerLabelFromTranscriptLine('[00:02] Speaker 1: Thanks for joining.')).toBe('Speaker 1');
    expect(getSpeakerLabelFromTranscriptLine('No speaker prefix')).toBeNull();

    expect(
      applySpeakerNamesToTranscriptLine('[00:02] Speaker 1: Thanks for joining.', {
        'Speaker 1': 'John',
      }),
    ).toBe('[00:02] John: Thanks for joining.');
  });

  it('lists transcript speakers once in first-seen order', () => {
    expect(
      listTranscriptSpeakers([
        '[00:01] Speaker 2: Let me start there.',
        '[00:05] Speaker 1: Sounds good.',
        '[00:12] Speaker 2: I will share the deck.',
      ].join('\n')),
    ).toEqual(['Speaker 2', 'Speaker 1']);
  });

  it('builds a readable text export with summary, actions, transcript, and renamed speakers', () => {
    const exported = buildExportText({
      title: 'Client call recap',
      recordedAt: '2026-04-14T14:30:00.000Z',
      durationSeconds: 125,
      mood: 'focused',
      summary: 'Send the proposal and confirm the staging timeline.',
      actionItems: ['Email the proposal', 'Book the follow-up review'],
      tags: ['client', 'staging'],
      languageDetected: 'en',
      speakers: { 'Speaker 1': 'John' },
      transcript: '[00:00] Speaker 1: We should send the proposal by Friday.',
    });

    expect(exported).toContain('Client call recap');
    expect(exported).toContain('Language: en');
    expect(exported).toContain('Mood: focused');
    expect(exported).toContain('Tags: client, staging');
    expect(exported).toContain('Speakers: Speaker 1 = John');
    expect(exported).toContain('1. Email the proposal');
    expect(exported).toContain('[00:00] John: We should send the proposal by Friday.');
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
