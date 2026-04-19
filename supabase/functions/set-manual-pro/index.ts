// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type SetManualProRequest = {
  target_email?: string;
  manual_pro_value?: boolean;
};

function buildResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function normalizeEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? '';
  return normalized.length > 3 ? normalized : null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
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
    const body = (await request.json()) as SetManualProRequest;
    const targetEmail = normalizeEmail(body.target_email);
    const manualProValue = typeof body.manual_pro_value === 'boolean' ? body.manual_pro_value : null;

    if (!targetEmail || manualProValue === null) {
      return buildResponse({ success: false, error: 'target_email and manual_pro_value are required.' }, 400);
    }

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

    const { data: adminProfile, error: adminProfileError } = await serviceClient
      .from('user_profiles')
      .select('id,is_admin,email')
      .eq('id', user.id)
      .maybeSingle();

    if (adminProfileError) {
      return buildResponse({ success: false, error: adminProfileError.message }, 500);
    }

    if (!adminProfile?.is_admin) {
      return buildResponse({ success: false, error: 'Admin access is required.' }, 403);
    }

    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from('user_profiles')
      .select('id,email,plan,is_admin,manual_pro')
      .eq('email', targetEmail)
      .maybeSingle();

    if (targetProfileError) {
      return buildResponse({ success: false, error: targetProfileError.message }, 500);
    }

    if (!targetProfile) {
      return buildResponse({ success: false, error: 'Target user not found.' }, 404);
    }

    if (targetProfile.is_admin) {
      return buildResponse({ success: false, error: 'Admin access cannot be modified from this screen.' }, 409);
    }

    if (targetProfile.plan === 'pro' && !targetProfile.manual_pro) {
      return buildResponse({ success: false, error: 'Paying subscriber — manage via RevenueCat.' }, 409);
    }

    const { error: updateError } = await serviceClient
      .from('user_profiles')
      .update({
        manual_pro: manualProValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetProfile.id);

    if (updateError) {
      return buildResponse({ success: false, error: updateError.message }, 500);
    }

    const { error: actionError } = await serviceClient.from('admin_actions').insert({
      admin_user_id: adminProfile.id,
      action_type: manualProValue ? 'grant_pro' : 'revoke_pro',
      target_user_id: targetProfile.id,
    });

    if (actionError) {
      return buildResponse({ success: false, error: actionError.message }, 500);
    }

    return buildResponse({
      success: true,
      user_email: targetProfile.email ?? targetEmail,
      manual_pro: manualProValue,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown manual Pro update error.';
    console.error('set-manual-pro failed', error);
    return buildResponse({ success: false, error: message }, 500);
  }
});
