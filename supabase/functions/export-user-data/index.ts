// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function buildJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function sanitizeFilenamePart(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  return normalized.length > 0 ? normalized : fallback;
}

function buildNoteText(note: Record<string, unknown>) {
  const actionItems = Array.isArray(note.action_items) ? note.action_items : [];
  const tags = Array.isArray(note.tags) ? note.tags : [];

  return [
    `Title: ${note.title ?? 'Untitled note'}`,
    `Date: ${note.recorded_at ?? note.created_at ?? ''}`,
    `Duration (seconds): ${note.duration_seconds ?? 0}`,
    `Summary: ${note.summary ?? ''}`,
    `Action items: ${actionItems.length > 0 ? actionItems.join('; ') : ''}`,
    `Tags: ${tags.length > 0 ? tags.join(', ') : ''}`,
    '',
    'Transcript:',
    `${note.transcript ?? ''}`,
  ].join('\n');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return buildJsonResponse({ success: false, error: 'Method not allowed.' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return buildJsonResponse({ success: false, error: 'Supabase environment variables are not configured.' }, 500);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return buildJsonResponse({ success: false, error: 'Missing Authorization header.' }, 401);
  }

  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return buildJsonResponse({ success: false, error: 'Authenticated user could not be verified.' }, 401);
    }

    const [{ data: profile, error: profileError }, { data: notes, error: notesError }, { data: referrals, error: referralsError }] = await Promise.all([
      serviceClient
        .from('user_profiles')
        .select('id, email, full_name, avatar_url, plan, is_admin, manual_pro, referral_code, referred_by_code, bonus_minutes, minutes_used_this_month, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle(),
      serviceClient
        .from('notes')
        .select('id, folder_id, title, transcript, summary, action_items, tags, audio_path, duration_seconds, language_detected, mood, sync_status, transcription_engine, recorded_at, created_at, updated_at, is_starred, ai_processing_status, ai_processed_at, ai_error')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false }),
      serviceClient
        .from('referrals')
        .select('id, referrer_user_id, referred_user_id, referral_code, status, rewarded_minutes, bonus_minutes_awarded, created_at, updated_at')
        .or(`referrer_user_id.eq.${user.id},referred_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
    ]);

    if (profileError || notesError || referralsError) {
      return buildJsonResponse({
        success: false,
        error: profileError?.message ?? notesError?.message ?? referralsError?.message ?? 'Export failed.',
      }, 500);
    }

    const zip = new JSZip();
    const safeNotes = Array.isArray(notes) ? notes : [];
    const safeReferrals = Array.isArray(referrals) ? referrals : [];

    for (const note of safeNotes) {
      const datePart = sanitizeFilenamePart(String(note.recorded_at ?? note.created_at ?? '').slice(0, 10), 'undated');
      const titlePart = sanitizeFilenamePart(typeof note.title === 'string' ? note.title : '', 'untitled-note');
      zip.file(`${datePart}-${titlePart}.txt`, buildNoteText(note));
    }

    zip.file(
      'metadata.json',
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          user_profile: profile ?? null,
          notes: safeNotes,
        },
        null,
        2,
      ),
    );

    zip.file(
      'referrals.json',
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          bonus_minutes: Number(profile?.bonus_minutes ?? 0),
          referral_history: safeReferrals,
        },
        null,
        2,
      ),
    );

    const archive = await zip.generateAsync({ type: 'uint8array' });
    const filename = `memvo-export-${new Date().toISOString().slice(0, 10)}.zip`;

    return new Response(archive, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('export-user-data failed', error);
    const message = error instanceof Error ? error.message : 'Unknown export error.';
    return buildJsonResponse({ success: false, error: message }, 500);
  }
});
