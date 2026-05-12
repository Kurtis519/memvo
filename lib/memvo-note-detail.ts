import type { MemvoSpeakerMap } from './memvo-domain';
import { formatDuration } from './memvo-recording-utils';

export type NoteExportShape = {
  title: string;
  recordedAt: string;
  durationSeconds: number;
  mood: string | null;
  summary: string | null;
  actionItems: string[];
  tags: string[];
  transcript: string | null;
  languageDetected?: string | null;
  speakers?: MemvoSpeakerMap | null;
};

const SPEAKER_LABEL_PATTERN = /(^|\s)(Speaker\s+\d+)(?=\s*:)/i;
const SPEAKER_REPLACE_PATTERN = /(^|\s)(Speaker\s+\d+)(?=\s*:)/gi;

function formatRecordedAt(recordedAt: string) {
  return new Date(recordedAt).toLocaleString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function buildNoteExportFileStem(note: Pick<NoteExportShape, 'title' | 'recordedAt'>) {
  const safeTitle = sanitizeFileSegment(note.title) || 'memvo-note';
  const date = new Date(note.recordedAt);
  const safeDate = Number.isNaN(date.getTime()) ? 'export' : date.toISOString().slice(0, 10);
  return `Memvo-${safeTitle}-${safeDate}`;
}

export function parseTranscriptTimeSeconds(line: string) {
  const match = line.match(/^\[(\d{2}):(\d{2})\]/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}

export function getSpeakerLabelFromTranscriptLine(line: string) {
  const match = line.match(SPEAKER_LABEL_PATTERN);
  return match?.[2] ?? null;
}

export function getSpeakerDisplayName(label: string, speakers?: MemvoSpeakerMap | null) {
  const renamed = speakers?.[label]?.trim();
  return renamed ? renamed : label;
}

export function applySpeakerNamesToTranscriptLine(line: string, speakers?: MemvoSpeakerMap | null) {
  if (!speakers || Object.keys(speakers).length === 0) {
    return line;
  }

  return line.replace(SPEAKER_REPLACE_PATTERN, (fullMatch, leadingWhitespace, label) => {
    const displayName = getSpeakerDisplayName(label, speakers);
    return `${leadingWhitespace}${displayName}`;
  });
}

export function listTranscriptSpeakers(transcript: string | null | undefined) {
  if (!transcript) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const line of transcript.split(/\n+/)) {
    const label = getSpeakerLabelFromTranscriptLine(line);
    if (label && !seen.has(label)) {
      seen.add(label);
      ordered.push(label);
    }
  }

  return ordered;
}

export function buildExportText(note: NoteExportShape) {
  const transcript = note.transcript
    ? note.transcript
        .split(/\n+/)
        .map((line) => applySpeakerNamesToTranscriptLine(line, note.speakers))
        .join('\n')
    : null;

  return [
    note.title,
    `Recorded: ${formatRecordedAt(note.recordedAt)}`,
    `Duration: ${formatDuration(note.durationSeconds * 1000)}`,
    note.languageDetected ? `Language: ${note.languageDetected}` : null,
    note.mood ? `Mood: ${note.mood}` : null,
    note.tags.length > 0 ? `Tags: ${note.tags.join(', ')}` : null,
    note.speakers && Object.keys(note.speakers).length > 0
      ? `Speakers: ${Object.entries(note.speakers)
          .map(([label, value]) => `${label} = ${value}`)
          .join(', ')}`
      : null,
    '',
    'Summary',
    note.summary || 'No AI summary yet.',
    '',
    'Action Items',
    note.actionItems.length > 0 ? note.actionItems.map((item, index) => `${index + 1}. ${item}`).join('\n') : 'No action items.',
    '',
    'Transcript',
    transcript || 'No transcript yet.',
  ]
    .filter((value) => value !== null)
    .join('\n');
}

export function buildPdfHtml(note: NoteExportShape) {
  const transcriptLines = note.transcript
    ? note.transcript
        .split(/\n+/)
        .filter(Boolean)
        .map((line) => applySpeakerNamesToTranscriptLine(line, note.speakers))
    : [];

  const actionItemsMarkup = note.actionItems.length > 0
    ? `<ol class="list">${note.actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
    : '<p class="empty">No action items.</p>';

  const tagsMarkup = note.tags.length > 0
    ? `<div class="tag-row">${note.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div>`
    : '<p class="empty">No tags added yet.</p>';

  const transcriptMarkup = transcriptLines.length > 0
    ? transcriptLines.map((line) => `<p class="transcript-line">${escapeHtml(line)}</p>`).join('')
    : '<p class="empty">No transcript yet.</p>';

  const speakerMarkup = note.speakers && Object.keys(note.speakers).length > 0
    ? `<div class="meta-card"><div class="meta-label">Speakers</div><div class="meta-value">${Object.entries(note.speakers)
        .map(([label, value]) => `${escapeHtml(label)} = ${escapeHtml(value)}`)
        .join('<br />')}</div></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @page {
        margin: 24px;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #ffffff;
        color: #11212a;
        line-height: 1.55;
      }

      .page {
        padding: 8px 4px 18px;
      }

      .title {
        margin: 0;
        color: #0f6e56;
        font-size: 28px;
        line-height: 1.2;
      }

      .subtitle {
        margin: 10px 0 0;
        color: #4f5d65;
        font-size: 13px;
      }

      .meta-grid {
        margin-top: 20px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .meta-card,
      .section {
        border: 1px solid #dbe4e8;
        border-radius: 18px;
        background: #f7faf9;
      }

      .meta-card {
        padding: 14px 16px;
      }

      .meta-label {
        color: #5f6d73;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .meta-value {
        margin-top: 7px;
        font-size: 14px;
        color: #11212a;
        word-break: break-word;
      }

      .section {
        margin-top: 18px;
        padding: 18px;
        background: #ffffff;
      }

      .section-title {
        margin: 0 0 12px;
        color: #11212a;
        font-size: 18px;
      }

      .body-text,
      .empty,
      .transcript-line,
      .list {
        margin: 0;
        font-size: 14px;
        color: #24353d;
      }

      .empty {
        color: #6b7880;
      }

      .list {
        padding-left: 20px;
      }

      .list li + li {
        margin-top: 8px;
      }

      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tag {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 999px;
        background: #e1f5ee;
        color: #085041;
        font-size: 12px;
        font-weight: 700;
      }

      .transcript-line + .transcript-line {
        margin-top: 10px;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <h1 class="title">${escapeHtml(note.title || 'Untitled note')}</h1>
      <p class="subtitle">Exported from Memvo</p>

      <section class="meta-grid">
        <div class="meta-card">
          <div class="meta-label">Date</div>
          <div class="meta-value">${escapeHtml(formatRecordedAt(note.recordedAt))}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Duration</div>
          <div class="meta-value">${escapeHtml(formatDuration(note.durationSeconds * 1000))}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Language</div>
          <div class="meta-value">${escapeHtml(note.languageDetected || 'Unknown')}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Mood</div>
          <div class="meta-value">${escapeHtml(note.mood || 'Not set')}</div>
        </div>
        ${speakerMarkup}
      </section>

      <section class="section">
        <h2 class="section-title">AI Summary</h2>
        <p class="body-text">${escapeHtml(note.summary || 'No AI summary yet.')}</p>
      </section>

      <section class="section">
        <h2 class="section-title">Action Items</h2>
        ${actionItemsMarkup}
      </section>

      <section class="section">
        <h2 class="section-title">Tags</h2>
        ${tagsMarkup}
      </section>

      <section class="section">
        <h2 class="section-title">Transcript</h2>
        ${transcriptMarkup}
      </section>
    </main>
  </body>
</html>`;
}
