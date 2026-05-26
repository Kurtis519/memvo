import { describe, expect, it } from 'vitest';

describe('Supabase public build environment', () => {
  it('provides working EXPO_PUBLIC Supabase credentials', async () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    expect(url).toBeTruthy();
    expect(anonKey).toBeTruthy();

    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        apikey: anonKey as string,
      },
    });

    expect(response.ok).toBe(true);

    const payload = await response.json();

    expect(payload).toBeTypeOf('object');
  }, 20000);
});
