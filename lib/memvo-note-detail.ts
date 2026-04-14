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
};

export function parseTranscriptTimeSeconds(line: string) {
  const match = line.match(/^\[(\d{2}):(\d{2})\]/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}

export function buildExportText(note: NoteExportShape) {
  return [
    note.title,
    `Recorded: ${new Date(note.recordedAt).toLocaleString()}`,
    `Duration: ${formatDuration(note.durationSeconds * 1000)}`,
    note.mood ? `Mood: ${note.mood}` : null,
    note.tags.length > 0 ? `Tags: ${note.tags.join(', ')}` : null,
    '',
    'Summary',
    note.summary || 'No AI summary yet.',
    '',
    'Action Items',
    note.actionItems.length > 0 ? note.actionItems.map((item, index) => `${index + 1}. ${item}`).join('\n') : 'No action items.',
    '',
    'Transcript',
    note.transcript || 'No transcript yet.',
  ]
    .filter((value) => value !== null)
    .join('\n');
}
