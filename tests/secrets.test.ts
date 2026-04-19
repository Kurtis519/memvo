import { describe, expect, it } from 'vitest';

describe('configured secrets', () => {
  it('validates required Memvo environment values against lightweight provider endpoints', async () => {
    const openAiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminEmail = process.env.MEMVO_ADMIN_EMAIL;
    const adminEmailPrimary = process.env.ADMIN_EMAIL;

    expect(openAiKey).toBeTruthy();
    expect(anthropicKey).toBeTruthy();
    expect(supabaseUrl).toBeTruthy();
    expect(supabaseAnonKey).toBeTruthy();
    expect(supabaseServiceRoleKey).toBeTruthy();
    expect(adminEmail).toBeTruthy();
    expect(adminEmailPrimary).toBeTruthy();
    expect(adminEmail?.trim().toLowerCase()).toBe(adminEmailPrimary?.trim().toLowerCase());

    const openAiResponse = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
    });
    expect(openAiResponse.ok).toBe(true);

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': anthropicKey as string,
        'anthropic-version': '2023-06-01',
      },
    });
    expect(anthropicResponse.ok).toBe(true);

    const supabaseSettingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabaseAnonKey as string,
      },
    });
    expect(supabaseSettingsResponse.ok).toBe(true);

    const supabaseAdminProbe = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: {
        apikey: supabaseServiceRoleKey as string,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
      },
    });
    expect(supabaseAdminProbe.ok).toBe(true);
  }, 30000);
});
