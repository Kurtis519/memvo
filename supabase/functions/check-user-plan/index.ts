// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function buildResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return buildResponse({ success: false, error: 'Method not allowed.' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return buildResponse({ success: false, error: 'Supabase environment variables are not configured.' }, 500);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return buildResponse({ success: false, error: 'Missing Authorization header.' }, 401);
  }

  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return buildResponse({ success: false, error: 'Authenticated user could not be verified.' }, 401);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('user_profiles')
      .select('plan,is_admin,manual_pro')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return buildResponse({ success: false, error: profileError.message }, 500);
    }

    const isPro = Boolean(profile?.is_admin || profile?.manual_pro || profile?.plan === 'pro' || profile?.plan === 'admin');

    return buildResponse({
      success: true,
      plan: isPro ? 'pro' : 'free',
      source: profile?.is_admin ? 'admin-override' : profile?.manual_pro ? 'manual-pro' : profile ? 'edge-function' : 'fallback',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown plan check error.';
    console.error('check-user-plan failed', error);
    return buildResponse({ success: false, error: message }, 500);
  }
});
