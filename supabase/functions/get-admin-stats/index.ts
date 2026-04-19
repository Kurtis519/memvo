// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPayload: { expiresAt: number; data: Record<string, unknown> } | null = null;

function buildResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function buildTopReferrers(rows: Array<{ referral_code?: string | null; bonus_minutes_awarded?: number | null }>) {
  const aggregate = new Map<string, { referral_code: string; total_referrals: number; total_bonus_minutes_awarded: number }>();

  for (const row of rows) {
    const referralCode = typeof row.referral_code === 'string' ? row.referral_code : null;
    if (!referralCode) {
      continue;
    }

    const current = aggregate.get(referralCode) ?? {
      referral_code: referralCode,
      total_referrals: 0,
      total_bonus_minutes_awarded: 0,
    };

    current.total_referrals += 1;
    current.total_bonus_minutes_awarded += Number(row.bonus_minutes_awarded ?? 0);
    aggregate.set(referralCode, current);
  }

  return [...aggregate.values()]
    .sort((left, right) => {
      if (right.total_referrals !== left.total_referrals) {
        return right.total_referrals - left.total_referrals;
      }
      return right.total_bonus_minutes_awarded - left.total_bonus_minutes_awarded;
    })
    .slice(0, 5);
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

    const { data: adminProfile, error: adminProfileError } = await serviceClient
      .from('user_profiles')
      .select('id,is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (adminProfileError) {
      return buildResponse({ success: false, error: adminProfileError.message }, 500);
    }

    if (!adminProfile?.is_admin) {
      return buildResponse({ success: false, error: 'Admin access is required.' }, 403);
    }

    if (cachedPayload && cachedPayload.expiresAt > Date.now()) {
      return buildResponse({ success: true, cached: true, ...cachedPayload.data });
    }

    const [
      totalUsersResult,
      totalNotesResult,
      noteMetricsResult,
      referralAggregateResult,
      recentReferralsResult,
      recentSignupsResult,
    ] = await Promise.all([
      serviceClient.from('user_profiles').select('id', { count: 'exact', head: true }),
      serviceClient.from('notes').select('id', { count: 'exact', head: true }),
      serviceClient.from('notes').select('duration_seconds,transcription_engine'),
      serviceClient.from('referrals').select('referral_code,bonus_minutes_awarded,created_at'),
      serviceClient.from('referrals').select('referral_code,bonus_minutes_awarded,created_at').order('created_at', { ascending: false }).limit(10),
      serviceClient.from('user_profiles').select('email,created_at,referral_code,is_admin,manual_pro,plan').order('created_at', { ascending: false }).limit(20),
    ]);

    const firstError = [
      totalUsersResult.error,
      totalNotesResult.error,
      noteMetricsResult.error,
      referralAggregateResult.error,
      recentReferralsResult.error,
      recentSignupsResult.error,
    ].find(Boolean);

    if (firstError) {
      return buildResponse({ success: false, error: firstError.message }, 500);
    }

    const noteMetrics = Array.isArray(noteMetricsResult.data) ? noteMetricsResult.data : [];
    const referralAggregateRows = Array.isArray(referralAggregateResult.data) ? referralAggregateResult.data : [];
    const recentReferrals = Array.isArray(recentReferralsResult.data) ? recentReferralsResult.data : [];
    const recentSignups = Array.isArray(recentSignupsResult.data) ? recentSignupsResult.data : [];

    const totalMinutes = noteMetrics.reduce((sum, row) => sum + Math.max(0, Number(row.duration_seconds ?? 0)) / 60, 0);
    const whisperNotes = noteMetrics.filter((row) => row.transcription_engine === 'whisper').length;
    const onDeviceNotes = noteMetrics.filter((row) => row.transcription_engine === 'on-device').length;
    const totalReferrals = referralAggregateRows.length;
    const totalBonusMinutesAwarded = referralAggregateRows.reduce((sum, row) => sum + Number(row.bonus_minutes_awarded ?? 0), 0);

    const payload = {
      total_users: totalUsersResult.count ?? 0,
      total_notes: totalNotesResult.count ?? 0,
      total_minutes: Number(totalMinutes.toFixed(2)),
      whisper_notes: whisperNotes,
      on_device_notes: onDeviceNotes,
      total_referrals: totalReferrals,
      total_bonus_minutes_awarded: totalBonusMinutesAwarded,
      top_referrers: buildTopReferrers(referralAggregateRows),
      recent_referrals: recentReferrals.map((row) => ({
        referral_code: row.referral_code ?? null,
        bonus_minutes_awarded: Number(row.bonus_minutes_awarded ?? 0),
        created_at: row.created_at ?? null,
      })),
      recent_signups: recentSignups.map((row) => ({
        email: row.email ?? null,
        signup_date: row.created_at ?? null,
        referral_code: row.referral_code ?? null,
        is_admin: Boolean(row.is_admin),
        manual_pro: Boolean(row.manual_pro),
        plan: row.plan ?? 'free',
      })),
    };

    cachedPayload = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: payload,
    };

    return buildResponse({ success: true, cached: false, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown admin stats error.';
    console.error('get-admin-stats failed', error);
    return buildResponse({ success: false, error: message }, 500);
  }
});
