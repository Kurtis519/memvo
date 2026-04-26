import { describe, expect, it } from 'vitest';

const CASES = [
  {
    platform: 'ios',
    key: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  },
  {
    platform: 'android',
    key: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  },
].filter((entry): entry is { platform: string; key: string } => typeof entry.key === 'string' && entry.key.length > 0);

describe('RevenueCat public SDK keys', () => {
  it(
    'respond to an offerings request without invalid-key authorization errors',
    async () => {
      expect(CASES.length).toBeGreaterThan(0);

      for (const entry of CASES) {
        const response = await fetch('https://api.revenuecat.com/v1/subscribers/$RCAnonymousID:memvo-task10/offerings', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${entry.key}`,
            'Content-Type': 'application/json',
            'X-Platform': entry.platform,
          },
        });

        expect([401, 403]).not.toContain(response.status);
      }
    },
    30000,
  );
});
