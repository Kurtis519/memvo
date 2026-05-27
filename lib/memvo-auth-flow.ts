import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const MEMVO_ONBOARDING_SEEN_STORAGE_KEY = 'memvo_onboarding_seen_v1';
export const MEMVO_PENDING_SIGNUP_STORAGE_KEY = 'memvo_pending_signup_transition_v1';

function getWebStorage() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

async function readStorageValue(key: string) {
  const webStorage = getWebStorage();
  if (webStorage) {
    return webStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
}

async function writeStorageValue(key: string, value: string) {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
}

async function removeStorageValue(key: string) {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.removeItem(key);
    return;
  }

  await AsyncStorage.removeItem(key);
}

export async function readHasSeenOnboarding() {
  return (await readStorageValue(MEMVO_ONBOARDING_SEEN_STORAGE_KEY)) === 'true';
}

export async function writeHasSeenOnboarding(value: boolean) {
  await writeStorageValue(MEMVO_ONBOARDING_SEEN_STORAGE_KEY, value ? 'true' : 'false');
}

export async function resetHasSeenOnboarding() {
  await removeStorageValue(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
}

export async function readPendingSignupTransition() {
  return (await readStorageValue(MEMVO_PENDING_SIGNUP_STORAGE_KEY)) === 'true';
}

export async function writePendingSignupTransition() {
  await writeStorageValue(MEMVO_PENDING_SIGNUP_STORAGE_KEY, 'true');
}

export async function clearPendingSignupTransition() {
  await removeStorageValue(MEMVO_PENDING_SIGNUP_STORAGE_KEY);
}

export async function recoverPendingSignupTransition() {
  const [hasSeenOnboarding, hasPendingSignupTransition] = await Promise.all([
    readHasSeenOnboarding(),
    readPendingSignupTransition(),
  ]);

  if (!hasPendingSignupTransition) {
    return {
      shouldResumeSignup: false,
      clearedCorruptedState: false,
    };
  }

  if (hasSeenOnboarding) {
    return {
      shouldResumeSignup: true,
      clearedCorruptedState: false,
    };
  }

  await clearPendingSignupTransition();

  return {
    shouldResumeSignup: false,
    clearedCorruptedState: true,
  };
}
