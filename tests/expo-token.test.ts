import { describe, expect, it } from 'vitest';

const EXPO_ME_ENDPOINT = 'https://api.expo.dev/v2/me';

describe('Expo access token', () => {
  it(
    'authenticates successfully with Expo',
    async () => {
      const token = process.env.EXPO_TOKEN ?? '';

      expect(token).toBeTruthy();

      const response = await fetch(EXPO_ME_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Memvo EAS token validation test',
        },
      });

      expect(response.ok).toBe(true);

      const payload = (await response.json()) as {
        data?: {
          id?: string;
          username?: string;
        };
        errors?: Array<{ message?: string }>;
      };

      expect(payload.errors ?? []).toHaveLength(0);
      expect(payload.data?.id).toBeTruthy();
      expect(payload.data?.username).toBeTruthy();
    },
    20000,
  );
});
