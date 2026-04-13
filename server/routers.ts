import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import type { MemvoPlanCheckResult } from "../lib/memvo-domain";
import { getSessionCookieOptions } from "./_core/cookies";
import { isMemvoAdminEmail } from "./memvo-admin";
import { systemRouter } from "./_core/systemRouter";
import { transcribeAudio } from "./_core/voiceTranscription";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

async function readSupabaseProfilePlan(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!normalizedEmail || !baseUrl || !serviceRoleKey) {
    return null;
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/rest/v1/user_profiles`);
  url.searchParams.set("select", "plan,is_admin,email");
  url.searchParams.set("email", `eq.${normalizedEmail}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Array<{
    plan?: "free" | "pro" | "admin" | null;
    is_admin?: boolean | null;
    email?: string | null;
  }>;

  return payload[0] ?? null;
}

async function resolveVerifiedPlan(params: { role?: string | null; email?: string | null }): Promise<MemvoPlanCheckResult> {
  const normalizedEmail = params.email?.trim().toLowerCase() ?? null;
  const isAdmin = params.role === "admin" || isMemvoAdminEmail(normalizedEmail);

  if (isAdmin) {
    return {
      plan: "pro",
      source: "admin-override",
    };
  }

  const profile = await readSupabaseProfilePlan(normalizedEmail);
  if (profile?.is_admin) {
    return {
      plan: "pro",
      source: "admin-override",
    };
  }

  if (profile?.plan === "pro" || profile?.plan === "admin") {
    return {
      plan: "pro",
      source: "manual-pro",
    };
  }

  return {
    plan: "free",
    source: profile ? "edge-function" : "fallback",
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
        audioUrl: z.string().url("audioUrl must be a valid URL"),
        language: z.string().min(2).max(12).optional(),
        prompt: z.string().min(1).max(400).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const planResult = await resolveVerifiedPlan({
        role: ctx.user.role,
        email: ctx.user.email ?? null,
      });

      if (planResult.plan === "free") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Pro transcription requires a verified Pro or admin plan.",
        });
      }

      const result = await transcribeAudio({
        audioUrl: input.audioUrl,
        language: input.language,
        prompt: input.prompt,
      });

      if ("error" in result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
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
