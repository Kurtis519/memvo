import { describe, expect, it } from 'vitest';

import {
  MEMVO_FREE_DAILY_AI_CHAT_LIMIT,
  buildAiChatTranscriptContext,
  buildAiChatUsageLabel,
  resolveAiChatUsageState,
} from '../lib/memvo-ai-chat';

describe('resolveAiChatUsageState', () => {
  it('resets free usage when the stored reset date is from a previous day', () => {
    const usage = resolveAiChatUsageState({
      plan: 'free',
      aiChatQueriesToday: 3,
      aiChatResetDate: '2026-05-11',
      now: new Date('2026-05-12T15:30:00.000Z'),
    });

    expect(usage.usedToday).toBe(0);
    expect(usage.dailyLimit).toBe(MEMVO_FREE_DAILY_AI_CHAT_LIMIT);
    expect(usage.remainingToday).toBe(MEMVO_FREE_DAILY_AI_CHAT_LIMIT);
    expect(usage.atLimit).toBe(false);
  });

  it('marks free users at the daily limit once they reach three chats today', () => {
    const usage = resolveAiChatUsageState({
      plan: 'free',
      aiChatQueriesToday: 3,
      aiChatResetDate: '2026-05-12',
      now: new Date('2026-05-12T15:30:00.000Z'),
    });

    expect(usage.usedToday).toBe(3);
    expect(usage.atLimit).toBe(true);
    expect(usage.remainingToday).toBe(0);
    expect(buildAiChatUsageLabel(usage)).toBe('3 of 3 daily queries used');
  });

  it('treats pro and admin access as unlimited chat', () => {
    const proUsage = resolveAiChatUsageState({
      plan: 'pro',
      aiChatQueriesToday: 10,
      aiChatResetDate: '2026-05-12',
      now: new Date('2026-05-12T15:30:00.000Z'),
    });
    const adminUsage = resolveAiChatUsageState({
      plan: 'free',
      isAdmin: true,
      aiChatQueriesToday: 10,
      aiChatResetDate: '2026-05-12',
      now: new Date('2026-05-12T15:30:00.000Z'),
    });

    expect(proUsage.isUnlimited).toBe(true);
    expect(proUsage.dailyLimit).toBeNull();
    expect(proUsage.atLimit).toBe(false);
    expect(buildAiChatUsageLabel(proUsage)).toBe('Unlimited AI chat available');

    expect(adminUsage.isUnlimited).toBe(true);
    expect(adminUsage.dailyLimit).toBeNull();
    expect(adminUsage.atLimit).toBe(false);
  });
});

describe('buildAiChatTranscriptContext', () => {
  it('includes title, summary, action items, tags, and transcript context for Claude note chat', () => {
    const prompt = buildAiChatTranscriptContext({
      title: 'Weekly sync',
      summary: 'Discussed launch timing and owners.',
      actionItems: ['Finalize the QA checklist', 'Share the beta invite list'],
      tags: ['launch', 'team'],
      transcript: 'Speaker 1: We should launch next Tuesday.',
    });

    expect(prompt).toContain('Note title: Weekly sync');
    expect(prompt).toContain('Summary: Discussed launch timing and owners.');
    expect(prompt).toContain('1. Finalize the QA checklist');
    expect(prompt).toContain('Tags: launch, team');
    expect(prompt).toContain('Transcript:\nSpeaker 1: We should launch next Tuesday.');
  });
});
