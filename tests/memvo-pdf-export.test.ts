import { describe, expect, it } from 'vitest';

import { buildNoteExportFileStem, buildPdfHtml } from '../lib/memvo-note-detail';

describe('memvo pdf export helpers', () => {
  it('builds the required Memvo PDF filename stem from note title and date', () => {
    expect(
      buildNoteExportFileStem({
        title: 'Client Call: Q2 Plan',
        recordedAt: '2026-04-14T14:30:00.000Z',
      }),
    ).toBe('Memvo-client-call-q2-plan-2026-04-14');
  });

  it('builds PDF HTML with required sections, renamed speakers, tags, and escaped content', () => {
    const html = buildPdfHtml({
      title: 'Roadmap <Review>',
      recordedAt: '2026-04-14T14:30:00.000Z',
      durationSeconds: 125,
      mood: 'focused',
      summary: 'Finalize the <beta> launch plan & confirm support coverage.',
      actionItems: ['Share launch brief', 'Confirm support rotation'],
      tags: ['launch', 'beta'],
      languageDetected: 'en',
      speakers: { 'Speaker 1': 'John' },
      transcript: '[00:00] Speaker 1: We should launch next week.',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('AI Summary');
    expect(html).toContain('Action Items');
    expect(html).toContain('Tags');
    expect(html).toContain('Transcript');
    expect(html).toContain('Language');
    expect(html).toContain('Roadmap &lt;Review&gt;');
    expect(html).toContain('Finalize the &lt;beta&gt; launch plan &amp; confirm support coverage.');
    expect(html).toContain('#launch');
    expect(html).toContain('#beta');
    expect(html).toContain('[00:00] John: We should launch next week.');
    expect(html).toContain('Speaker 1 = John');
  });

  it('falls back cleanly when optional fields are missing', () => {
    const html = buildPdfHtml({
      title: 'Untitled',
      recordedAt: '2026-04-14T14:30:00.000Z',
      durationSeconds: 8,
      mood: null,
      summary: null,
      actionItems: [],
      tags: [],
      transcript: null,
      languageDetected: null,
    });

    expect(html).toContain('No AI summary yet.');
    expect(html).toContain('No action items.');
    expect(html).toContain('No tags added yet.');
    expect(html).toContain('No transcript yet.');
    expect(html).toContain('Unknown');
    expect(html).toContain('Not set');
  });
});
