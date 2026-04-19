// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AUDIO_BUCKET = 'memvo-audio';

function buildJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeStoragePath(rawPath: string | null | undefined) {
  if (!rawPath) {
    return null;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    try {
      const url = new URL(rawPath);
      const marker = `/object/public/${AUDIO_BUCKET}/`;
      const storageIndex = url.pathname.indexOf(marker);
      if (storageIndex >= 0) {
        return decodeURIComponent(url.pathname.slice(storageIndex + marker.length));
      }
    } catch (_error) {
      return null;
    }
  }

  return rawPath.replace(new RegExp(`^${AUDIO_BUCKET}/`), '');
}

async function hashUserId(userId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
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

    const { data: userNotes, error: notesError } = await serviceClient
      .from('notes')
      .select('audio_path')
      .eq('user_id', user.id);

    if (notesError) {
      return buildJsonResponse({ success: false, error: notesError.message }, 500);
    }

    const storagePaths = Array.from(
      new Set(
        (userNotes ?? [])
          .map((note) => normalizeStoragePath(note.audio_path))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (storagePaths.length > 0) {
      const { error: storageError } = await serviceClient.storage.from(AUDIO_BUCKET).remove(storagePaths);
      if (storageError) {
        console.error('delete-user-account storage cleanup failed', storageError);
      }
    }

    const { error: syncQueueError } = await serviceClient.from('sync_queue').delete().eq('user_id', user.id);
    if (syncQueueError) {
      return buildJsonResponse({ success: false, error: syncQueueError.message }, 500);
    }

    const { error: referralsError } = await serviceClient
      .from('referrals')
      .delete()
      .or(`referrer_user_id.eq.${user.id},referred_user_id.eq.${user.id}`);
    if (referralsError) {
      return buildJsonResponse({ success: false, error: referralsError.message }, 500);
    }

    const { error: notesDeleteError } = await serviceClient.from('notes').delete().eq('user_id', user.id);
    if (notesDeleteError) {
      return buildJsonResponse({ success: false, error: notesDeleteError.message }, 500);
    }

    const { error: foldersError } = await serviceClient.from('folders').delete().eq('user_id', user.id);
    if (foldersError) {
      return buildJsonResponse({ success: false, error: foldersError.message }, 500);
    }

    const hashedUserId = await hashUserId(user.id);
    const { error: deletionLogError } = await serviceClient.from('deletions_log').insert({
      user_id_hash: hashedUserId,
    });
    if (deletionLogError) {
      return buildJsonResponse({ success: false, error: deletionLogError.message }, 500);
    }

    const { error: profileDeleteError } = await serviceClient.from('user_profiles').delete().eq('id', user.id);
    if (profileDeleteError) {
      return buildJsonResponse({ success: false, error: profileDeleteError.message }, 500);
    }

    const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      return buildJsonResponse({ success: false, error: authDeleteError.message }, 500);
    }

    return buildJsonResponse({ success: true });
  } catch (error) {
    console.error('delete-user-account failed', error);
    const message = error instanceof Error ? error.message : 'Unknown account deletion error.';
    return buildJsonResponse({ success: false, error: message }, 500);
  }
});
