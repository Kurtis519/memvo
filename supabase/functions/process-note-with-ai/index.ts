// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NoteRow = {
  id: string;
  title: string | null;
  transcript: string | null;
  summary: string | null;
  action_items: unknown;
  tags: unknown;
  mood: string | null;
  language_detected: string | null;
  language_code: string | null;
  ai_processing_status: string | null;
  sync_status: string | null;
};

type ClaudeNoteResult = {
  title: string;
  summary: string;
  action_items: string[];
  tags: string[];
  mood: string | null;
  language: string | null;
};

const jsonHeaders = { 'Content-Type': 'application/json' };
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FORGE_API_KEY = Deno.env.get('FORGE_API_KEY') ?? Deno.env.get('OPENAI_API_KEY') ?? '';
const FORGE_API_URL = (Deno.env.get('FORGE_API_URL') ?? 'https://forge.manus.im').replace(/\/$/, '');
const CLAUDE_MODEL = Deno.env.get('MEMVO_CLAUDE_MODEL') ?? 'claude-sonnet-4.6';
const MAX_TRANSCRIPT_CHARS = 12_000;
const MIN_TRANSCRIPT_CHARS = 40;
const AI_ANALYSING_LABEL = 'Analysing with Claude…';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function buildErrorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: jsonHeaders,
  });
}

function normalizeStringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function truncateTranscript(transcript: string) {
  const trimmed = transcript.trim();
  if (trimmed.length <= MAX_TRANSCRIPT_CHARS) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_TRANSCRIPT_CHARS)}…`;
}

function buildFallbackTitle(transcript: string) {
  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  const excerpt = cleaned.split(' ').slice(0, 6).join(' ');
  return excerpt ? excerpt.charAt(0).toUpperCase() + excerpt.slice(1) : 'Voice note';
}

function buildShortTranscriptFallback(note: NoteRow): ClaudeNoteResult {
  const transcript = note.transcript?.trim() ?? '';
  return {
    title: buildFallbackTitle(transcript),
    summary: transcript.length > 0 ? transcript.slice(0, 180) : 'Transcript saved without AI summary.',
    action_items: [],
    tags: [],
    mood: null,
    language: note.language_detected ?? note.language_code ?? null,
  };
}

function sanitizeClaudeResult(raw: unknown, note: NoteRow): ClaudeNoteResult {
  const value = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {};
  const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : buildFallbackTitle(note.transcript ?? '');
  const summary = typeof value.summary === 'string' && value.summary.trim() ? value.summary.trim() : (note.transcript?.trim().slice(0, 220) || 'Transcript saved without AI summary.');
  const mood = typeof value.mood === 'string' && value.mood.trim() ? value.mood.trim().toLowerCase() : null;
  const language = typeof value.language === 'string' && value.language.trim() ? value.language.trim().toLowerCase() : null;

  return {
    title,
    summary,
    action_items: normalizeStringList(value.action_items, 6),
    tags: normalizeStringList(value.tags, 6).map((tag) => tag.toLowerCase()),
    mood,
    language,
  };
}

async function fetchNote(noteId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('id,title,transcript,summary,action_items,tags,mood,language_detected,language_code,ai_processing_status,sync_status')
    .eq('id', noteId)
    .single();

  if (error) {
    throw error;
  }

  return data as NoteRow;
}

async function updateNote(noteId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from('notes')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId);

  if (error) {
    throw error;
  }
}

async function invokeClaude(note: NoteRow) {
  if (!FORGE_API_KEY) {
    throw new Error('FORGE_API_KEY is not configured for Claude note analysis.');
  }

  const transcript = truncateTranscript(note.transcript ?? '');
  const systemPrompt = [
    'You are Memvo, an AI note analyst for private voice notes.',
    'Return only strict JSON that matches the requested schema.',
    'Summaries must be concise, factual, and privacy-preserving.',
    'Action items must be explicit next steps only when they truly exist.',
    'Tags must be short lowercase labels.',
    'Mood should be a single lowercase word for personal or reflective notes, otherwise null.',
    'If language is obvious from the transcript, return a lowercase ISO-style language hint such as en, es, or fr; otherwise return null.',
  ].join(' ');

  const userPrompt = [
    'Analyse this transcribed voice note and extract the final note fields.',
    'Prefer a practical title, one-paragraph summary, up to 6 action_items, up to 6 tags, optional mood, and optional language.',
    `Transcript:\n${transcript}`,
  ].join('\n\n');

  const payload = {
    model: CLAUDE_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'memvo_note_analysis',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            action_items: {
              type: 'array',
              items: { type: 'string' },
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
            mood: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            language: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
          required: ['title', 'summary', 'action_items', 'tags', 'mood', 'language'],
        },
      },
    },
    max_tokens: 1200,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FORGE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Claude note analysis failed: ${response.status} ${body}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter((part: unknown) => typeof part === 'object' && part && 'text' in (part as Record<string, unknown>))
            .map((part: Record<string, unknown>) => String(part.text ?? ''))
            .join('')
        : '';

    try {
      return sanitizeClaudeResult(JSON.parse(text), note);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Invalid JSON from Claude note analysis.');
    }
  }

  throw lastError ?? new Error('Invalid JSON from Claude note analysis.');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return buildErrorResponse('Method not allowed', 405);
  }

  try {
    const body = await request.json();
    const noteId = typeof body?.noteId === 'string'
      ? body.noteId
      : typeof body?.record?.id === 'string'
        ? body.record.id
        : typeof body?.new?.id === 'string'
          ? body.new.id
          : null;

    if (!noteId) {
      return buildErrorResponse('Missing noteId');
    }

    const note = await fetchNote(noteId);
    if (!note.transcript?.trim()) {
      return buildErrorResponse('Note transcript is empty', 422);
    }

    await updateNote(noteId, {
      ai_processing_status: 'processing',
      ai_error: null,
      summary: note.summary === AI_ANALYSING_LABEL ? note.summary : AI_ANALYSING_LABEL,
    });

    const transcript = note.transcript.trim();
    const result = transcript.length < MIN_TRANSCRIPT_CHARS ? buildShortTranscriptFallback(note) : await invokeClaude(note);
    const aiStatus = transcript.length < MIN_TRANSCRIPT_CHARS ? 'skipped' : 'complete';

    await updateNote(noteId, {
      title: result.title,
      summary: result.summary,
      action_items: result.action_items,
      tags: result.tags,
      mood: result.mood,
      language_detected: note.language_detected ?? note.language_code ?? result.language,
      ai_processing_status: aiStatus,
      ai_processed_at: new Date().toISOString(),
      ai_error: null,
    });

    return new Response(JSON.stringify({ ok: true, noteId, aiStatus }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Claude note processing error.';
    console.error('process-note-with-ai failed', error);

    try {
      const body = await request.clone().json();
      const noteId = typeof body?.noteId === 'string'
        ? body.noteId
        : typeof body?.record?.id === 'string'
          ? body.record.id
          : typeof body?.new?.id === 'string'
            ? body.new.id
            : null;

      if (noteId) {
        await updateNote(noteId, {
          ai_processing_status: 'failed',
          ai_error: message,
          ai_processed_at: null,
        });
      }
    } catch {
      // Ignore secondary logging failures.
    }

    return buildErrorResponse(message, 500);
  }
});
