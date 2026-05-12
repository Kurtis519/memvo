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
    const removeItem = vi.fn();
    vi.stubGlobal('window', {
      localStorage: {
        getItem,
        setItem,
        removeItem,
      },
    });

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'web',
      },
    }));

    const asyncStorageGetItem = vi.fn();
    const asyncStorageSetItem = vi.fn();
    const asyncStorageRemoveItem = vi.fn();
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: asyncStorageGetItem,
        setItem: asyncStorageSetItem,
        removeItem: asyncStorageRemoveItem,
      },
    }));

    const { readHasSeenOnboarding, writeHasSeenOnboarding, resetHasSeenOnboarding, MEMVO_ONBOARDING_SEEN_STORAGE_KEY } = await import('../lib/memvo-auth-flow');

    await expect(readHasSeenOnboarding()).resolves.toBe(true);
    await writeHasSeenOnboarding(false);
    await resetHasSeenOnboarding();

    expect(getItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
    expect(setItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY, 'false');
    expect(removeItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
    expect(asyncStorageGetItem).not.toHaveBeenCalled();
    expect(asyncStorageSetItem).not.toHaveBeenCalled();
    expect(asyncStorageRemoveItem).not.toHaveBeenCalled();
  });

  it('falls back to AsyncStorage on native platforms', async () => {
    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
      },
    }));

    const asyncStorageGetItem = vi.fn(async () => 'false');
    const asyncStorageSetItem = vi.fn(async () => undefined);
    const asyncStorageRemoveItem = vi.fn(async () => undefined);
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: asyncStorageGetItem,
        setItem: asyncStorageSetItem,
        removeItem: asyncStorageRemoveItem,
      },
    }));

    const { readHasSeenOnboarding, writeHasSeenOnboarding, resetHasSeenOnboarding, MEMVO_ONBOARDING_SEEN_STORAGE_KEY } = await import('../lib/memvo-auth-flow');

    await expect(readHasSeenOnboarding()).resolves.toBe(false);
    await writeHasSeenOnboarding(true);
    await resetHasSeenOnboarding();

    expect(asyncStorageGetItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
    expect(asyncStorageSetItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY, 'true');
    expect(asyncStorageRemoveItem).toHaveBeenCalledWith(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
  });
});
