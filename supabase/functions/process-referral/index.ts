// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type ReferralRequest = {
  referrer_code?: string;
  new_user_id?: string;
};

function buildResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function normalizeReferralCode(code: string | null | undefined) {
  const normalized = code?.trim().toUpperCase() ?? '';
  return /^MEMVO-[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
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
    const body = (await request.json()) as ReferralRequest;
    const referrerCode = normalizeReferralCode(body.referrer_code);
    const newUserId = typeof body.new_user_id === 'string' ? body.new_user_id : null;

    if (!referrerCode || !newUserId) {
      return buildResponse({ success: false, error: 'referrer_code and new_user_id are required.' }, 400);
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

    if (user.id !== newUserId) {
      return buildResponse({ success: false, error: 'new_user_id must match the authenticated user.' }, 403);
    }

    const { data: existingReferral, error: existingReferralError } = await serviceClient
      .from('referrals')
      .select('id')
      .eq('referred_user_id', newUserId)
      .maybeSingle();

    if (existingReferralError) {
      return buildResponse({ success: false, error: existingReferralError.message }, 500);
    }

    if (existingReferral) {
      return buildResponse({ success: false, error: 'Referral has already been processed for this user.' }, 409);
    }

    const { data, error } = await serviceClient.rpc('award_referral_bonus', {
      input_referrer_code: referrerCode,
      input_new_user_id: newUserId,
    });

    if (error) {
      return buildResponse({ success: false, error: error.message }, 500);
    }

    const success = Boolean(data?.success);
    const message = typeof data?.error === 'string' ? data.error : null;

    if (!success) {
      const status = message === 'Referral has already been processed for this user.' ? 409 : message === 'Self-referral is not allowed.' ? 403 : 400;
      return buildResponse({ success: false, error: message ?? 'Referral could not be processed.' }, status);
    }

    return buildResponse({
      success: true,
      referral_id: data.referral_id ?? null,
      bonus_minutes_awarded: data.bonus_minutes_awarded ?? 30,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown referral processing error.';
    console.error('process-referral failed', error);
    return buildResponse({ success: false, error: message }, 500);
  }
});
