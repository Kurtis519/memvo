import { describe, expect, it } from 'vitest';

describe('memvo admin email secret wiring', () => {
  it('exposes the configured admin email secrets for server-side admin checks', async () => {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const compatibilityAdminEmail = process.env.MEMVO_ADMIN_EMAIL?.trim().toLowerCase();

    expect(adminEmail).toBeTruthy();
    expect(compatibilityAdminEmail).toBeTruthy();
    expect(adminEmail).toBe(compatibilityAdminEmail);
    expect(adminEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

    const adminModule = await import('../server/memvo-admin');

    expect(adminModule.getMemvoAdminEmail()).toBe(adminEmail);
    expect(adminModule.isMemvoAdminEmail(adminEmail)).toBe(true);
    expect(adminModule.getMemvoBootstrapFlags().adminEmailConfigured).toBe(true);
  });
});
