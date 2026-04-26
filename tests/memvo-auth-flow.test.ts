import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('memvo auth flow storage helpers', () => {
  it('uses localStorage on web when onboarding has already been seen', async () => {
    const getItem = vi.fn(() => 'true');
    const setItem = vi.fn();
    vi.stubGlobal('window', {
      localStorage: {
        getItem,
        setItem,
      },
    });

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'web',
      },
    }));

    const asyncStorageGetItem = vi.fn();
    const asyncStorageSetItem = vi.fn();
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: asyncStorageGetItem,
        setItem: asyncStorageSetItem,
      },
    }));

    const { readHasSeenOnboarding, writeHasSeenOnboarding, MEMVO_ONBOARDING_SEEN_STORAGE_KEY } = await import('../lib/memvo-auth-flow');

    await expect(readHasSeenOnboarding()).resolves.toBe(true);
    await writeHasSeenOnboarding(false);

    expect(getItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
    expect(setItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY, 'false');
    expect(asyncStorageGetItem).not.toHaveBeenCalled();
    expect(asyncStorageSetItem).not.toHaveBeenCalled();
  });

  it('falls back to AsyncStorage on native platforms', async () => {
    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
      },
    }));

    const asyncStorageGetItem = vi.fn(async () => 'false');
    const asyncStorageSetItem = vi.fn(async () => undefined);
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: asyncStorageGetItem,
        setItem: asyncStorageSetItem,
      },
    }));

    const { readHasSeenOnboarding, writeHasSeenOnboarding, MEMVO_ONBOARDING_SEEN_STORAGE_KEY } = await import('../lib/memvo-auth-flow');

    await expect(readHasSeenOnboarding()).resolves.toBe(false);
    await writeHasSeenOnboarding(true);

    expect(asyncStorageGetItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
    expect(asyncStorageSetItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY, 'true');
  });
});
