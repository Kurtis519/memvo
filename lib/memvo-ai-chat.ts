import type { MemvoPlan } from '@/lib/memvo-domain';

export const MEMVO_FREE_DAILY_AI_CHAT_LIMIT = 3;
export const MEMVO_AI_CHAT_UPGRADE_MESSAGE = 'Upgrade to Pro for unlimited AI chat';
export const MEMVO_AI_CHAT_SYSTEM_PROMPT =
  'You are a helpful assistant answering questions about a voice note transcript. Answer concisely and helpfully based only on the transcript provided. If the answer is not in the transcript say so clearly.';

export type MemvoAiChatRole = 'user' | 'assistant';

export interface MemvoAiChatMessage {
  role: MemvoAiChatRole;
  content: string;
}

export interface MemvoAiChatUsageState {
  usedToday: number;
  dailyLimit: number | null;
  remainingToday: number | null;
  atLimit: boolean;
  isUnlimited: boolean;
  resetDate: string;
}

export function getAiChatResetDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function resolveAiChatUsageState(params: {
  plan: MemvoPlan;
  isAdmin?: boolean | null;
  aiChatQueriesToday?: number | null;
  aiChatResetDate?: string | null;
  now?: Date;
}): MemvoAiChatUsageState {
  const today = getAiChatResetDate(params.now);
  const isUnlimited = Boolean(params.isAdmin) || params.plan === 'pro' || params.plan === 'admin';
  const usedToday = params.aiChatResetDate === today ? Math.max(0, Number(params.aiChatQueriesToday ?? 0)) : 0;
  const dailyLimit = isUnlimited ? null : MEMVO_FREE_DAILY_AI_CHAT_LIMIT;
  const remainingToday = dailyLimit === null ? null : Math.max(0, dailyLimit - usedToday);

  return {
    usedToday,
    dailyLimit,
    remainingToday,
    atLimit: dailyLimit !== null && usedToday >= dailyLimit,
    isUnlimited,
    resetDate: today,
  };
}

export function buildAiChatUsageLabel(usage: Pick<MemvoAiChatUsageState, 'usedToday' | 'dailyLimit' | 'isUnlimited'>) {
  if (usage.isUnlimited || usage.dailyLimit === null) {
    return 'Unlimited AI chat available';
  }

  return `${usage.usedToday} of ${usage.dailyLimit} daily queries used`;
}

export function buildAiChatTranscriptContext(params: {
  title: string;
  summary?: string | null;
  transcript: string;
  actionItems?: string[];
  tags?: string[];
}) {
  const sections = [
    `Note title: ${params.title}`,
    params.summary ? `Summary: ${params.summary}` : null,
    params.actionItems && params.actionItems.length > 0 ? `Action items:\n${params.actionItems.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : null,
    params.tags && params.tags.length > 0 ? `Tags: ${params.tags.join(', ')}` : null,
    `Transcript:\n${params.transcript}`,
  ].filter(Boolean);

  return sections.join('\n\n');
}
