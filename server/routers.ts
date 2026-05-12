import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  MEMVO_AI_CHAT_SYSTEM_PROMPT,
  MEMVO_AI_CHAT_UPGRADE_MESSAGE,
  MEMVO_FREE_DAILY_AI_CHAT_LIMIT,
  buildAiChatTranscriptContext,
  resolveAiChatUsageState,
} from '../lib/memvo-ai-chat';
import type { MemvoPlan, MemvoPlanCheckResult } from '../lib/memvo-domain';
import { COOKIE_NAME } from '../shared/const.js';
import { getSessionCookieOptions } from './_core/cookies';
import { invokeLLM } from './_core/llm';
import { systemRouter } from './_core/systemRouter';
import { protectedProcedure, publicProcedure, router } from './_core/trpc';
import { transcribeAudio } from './_core/voiceTranscription';
import { isMemvoAdminEmail } from './memvo-admin';

type SupabaseProfileRow = {
  id?: string;
  email?: string | null;
  plan?: 'free' | 'pro' | 'admin' | null;
  is_admin?: boolean | null;
  manual_pro?: boolean | null;
  ai_chat_queries_today?: number | null;
  ai_chat_reset_date?: string | null;
};

type SupabaseNoteRow = {
  id?: string;
  user_id?: string | null;
  title?: string | null;
  summary?: string | null;
  transcript?: string | null;
  action_items?: string[] | null;
  tags?: string[] | null;
};

type SupabaseSessionUser = {
  id: string;
  email?: string | null;
};

function getSupabaseConfig() {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!baseUrl || !anonKey || !serviceRoleKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Supabase server configuration is incomplete.',
    });
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    anonKey,
    serviceRoleKey,
  };
}

async function fetchJson<T>(url: URL | string, init: RequestInit, errorMessage: string): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const details = await response.text();
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `${errorMessage}${details ? ` ${details}` : ''}`,
    });
  }

  return (await response.json()) as T;
}

async function validateSupabaseAccessToken(accessToken: string): Promise<SupabaseSessionUser> {
  const { baseUrl, anonKey } = getSupabaseConfig();

  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Your session expired. Please sign in again.',
    });
  }

  if (!response.ok) {
    const details = await response.text();
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Unable to validate the current session.${details ? ` ${details}` : ''}`,
    });
  }

  const payload = (await response.json()) as SupabaseSessionUser;
  if (!payload?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Your session expired. Please sign in again.',
    });
  }

  return payload;
}

async function readSupabaseProfilePlan(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  const { baseUrl, serviceRoleKey } = getSupabaseConfig();

  if (!normalizedEmail) {
    return null;
  }

  const url = new URL(`${baseUrl}/rest/v1/user_profiles`);
  url.searchParams.set('select', 'plan,is_admin,manual_pro,email');
  url.searchParams.set('email', `eq.${normalizedEmail}`);
  url.searchParams.set('limit', '1');

  const payload = await fetchJson<Array<SupabaseProfileRow>>(
    url,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    },
    'Unable to read the Memvo plan state.',
  );

  return payload[0] ?? null;
}

async function readSupabaseProfileById(userId: string) {
  const { baseUrl, serviceRoleKey } = getSupabaseConfig();
  const url = new URL(`${baseUrl}/rest/v1/user_profiles`);
  url.searchParams.set('select', 'id,email,plan,is_admin,manual_pro,ai_chat_queries_today,ai_chat_reset_date');
  url.searchParams.set('id', `eq.${userId}`);
  url.searchParams.set('limit', '1');

  const payload = await fetchJson<Array<SupabaseProfileRow>>(
    url,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    },
    'Unable to read the Memvo profile.',
  );

  return payload[0] ?? null;
}

async function updateSupabaseProfileUsage(userId: string, payload: { ai_chat_queries_today: number; ai_chat_reset_date: string }) {
  const { baseUrl, serviceRoleKey } = getSupabaseConfig();
  const url = new URL(`${baseUrl}/rest/v1/user_profiles`);
  url.searchParams.set('id', `eq.${userId}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Unable to update the AI chat usage counter.${details ? ` ${details}` : ''}`,
    });
  }
}

async function readNoteForAiChat(noteId: string, userId: string) {
  const { baseUrl, serviceRoleKey } = getSupabaseConfig();
  const url = new URL(`${baseUrl}/rest/v1/notes`);
  url.searchParams.set('select', 'id,user_id,title,summary,transcript,action_items,tags');
  url.searchParams.set('id', `eq.${noteId}`);
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('limit', '1');

  const payload = await fetchJson<Array<SupabaseNoteRow>>(
    url,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    },
    'Unable to load that note for AI chat.',
  );

  return payload[0] ?? null;
}

function resolvePlanFromProfile(profile: SupabaseProfileRow | null, email?: string | null): MemvoPlan {
  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  if (profile?.is_admin || isMemvoAdminEmail(normalizedEmail)) {
    return 'admin';
  }

  if (profile?.manual_pro || profile?.plan === 'pro' || profile?.plan === 'admin') {
    return 'pro';
  }

  return 'free';
}

function readLlmText(result: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = result.choices[0]?.message.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }

  return '';
}

async function resolveVerifiedPlan(params: { role?: string | null; email?: string | null }): Promise<MemvoPlanCheckResult> {
  const normalizedEmail = params.email?.trim().toLowerCase() ?? null;
  const isAdmin = params.role === 'admin' || isMemvoAdminEmail(normalizedEmail);

  if (isAdmin) {
    return {
      plan: 'pro',
      source: 'admin-override',
    };
  }

  const profile = await readSupabaseProfilePlan(normalizedEmail);
  if (profile?.is_admin) {
    return {
      plan: 'pro',
      source: 'admin-override',
    };
  }

  if (profile?.manual_pro || profile?.plan === 'pro' || profile?.plan === 'admin') {
    return {
      plan: 'pro',
      source: profile?.manual_pro ? 'manual-pro' : 'edge-function',
    };
  }

  return {
    plan: 'free',
    source: profile ? 'edge-function' : 'fallback',
  };
}

const memvoRouter = router({
  planCheck: protectedProcedure.query(async ({ ctx }) => {
    return resolveVerifiedPlan({
      role: ctx.user.role,
      email: ctx.user.email ?? null,
    });
  }),

  transcribePro: protectedProcedure
    .input(
      z.object({
        audioUrl: z.string().url('audioUrl must be a valid URL'),
        language: z.string().min(2).max(12).optional(),
        prompt: z.string().min(1).max(400).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const planResult = await resolveVerifiedPlan({
        role: ctx.user.role,
        email: ctx.user.email ?? null,
      });

      if (planResult.plan === 'free') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Pro transcription requires a verified Pro or admin plan.',
        });
      }

      const result = await transcribeAudio({
        audioUrl: input.audioUrl,
        language: input.language,
        prompt: input.prompt,
      });

      if ('error' in result) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error,
          cause: result,
        });
      }

      return {
        transcript: result.text,
        languageDetected: result.language ?? null,
        durationSeconds: result.duration,
        plan: planResult.plan,
        source: planResult.source,
      } as const;
    }),

  askAiAboutNote: publicProcedure
    .input(
      z.object({
        accessToken: z.string().min(20),
        noteId: z.string().min(1),
        question: z.string().trim().min(1).max(1000),
        history: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string().trim().min(1).max(4000),
            }),
          )
          .max(12)
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const sessionUser = await validateSupabaseAccessToken(input.accessToken);
      const profile = await readSupabaseProfileById(sessionUser.id);
      const plan = resolvePlanFromProfile(profile, sessionUser.email ?? profile?.email ?? null);
      const usage = resolveAiChatUsageState({
        plan,
        isAdmin: Boolean(profile?.is_admin),
        aiChatQueriesToday: profile?.ai_chat_queries_today ?? 0,
        aiChatResetDate: profile?.ai_chat_reset_date ?? null,
      });

      if (!usage.isUnlimited && usage.atLimit) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: MEMVO_AI_CHAT_UPGRADE_MESSAGE,
          cause: {
            usedToday: usage.usedToday,
            dailyLimit: MEMVO_FREE_DAILY_AI_CHAT_LIMIT,
          },
        });
      }

      const note = await readNoteForAiChat(input.noteId, sessionUser.id);
      if (!note?.id || !note.transcript?.trim()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This note needs a completed transcript before Ask AI can answer questions about it.',
        });
      }

      const llmResult = await invokeLLM({
        model: 'claude-sonnet-4-6',
        messages: [
          {
            role: 'system',
            content: MEMVO_AI_CHAT_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildAiChatTranscriptContext({
              title: note.title?.trim() || 'Untitled note',
              summary: note.summary ?? null,
              transcript: note.transcript,
              actionItems: Array.isArray(note.action_items) ? note.action_items.filter((item): item is string => typeof item === 'string') : [],
              tags: Array.isArray(note.tags) ? note.tags.filter((tag): tag is string => typeof tag === 'string') : [],
            }),
          },
          ...((input.history ?? []).map((message) => ({
            role: message.role,
            content: message.content,
          })) as Array<{ role: 'user' | 'assistant'; content: string }>),
          {
            role: 'user',
            content: input.question,
          },
        ],
      });

      const answer = readLlmText(llmResult);
      if (!answer) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ask AI returned an empty response. Please try again.',
        });
      }

      const nextUsedToday = usage.isUnlimited ? usage.usedToday : usage.usedToday + 1;
      await updateSupabaseProfileUsage(sessionUser.id, {
        ai_chat_queries_today: nextUsedToday,
        ai_chat_reset_date: usage.resetDate,
      });

      return {
        answer,
        usage: {
          usedToday: nextUsedToday,
          dailyLimit: usage.dailyLimit,
          remainingToday: usage.isUnlimited ? null : Math.max(0, MEMVO_FREE_DAILY_AI_CHAT_LIMIT - nextUsedToday),
          atLimit: usage.isUnlimited ? false : nextUsedToday >= MEMVO_FREE_DAILY_AI_CHAT_LIMIT,
          isUnlimited: usage.isUnlimited,
          resetDate: usage.resetDate,
        },
        plan,
      } as const;
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  memvo: memvoRouter,
});

export type AppRouter = typeof appRouter;
