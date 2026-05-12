import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const MEMVO_ONBOARDING_SEEN_STORAGE_KEY = 'memvo_onboarding_seen_v1';

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

export async function readHasSeenOnboarding() {
  const webStorage = getWebStorage();
  if (webStorage) {
    return webStorage.getItem(MEMVO_ONBOARDING_SEEN_STORAGE_KEY) === 'true';
  }

  const value = await AsyncStorage.getItem(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
  return value === 'true';
}

export async function writeHasSeenOnboarding(value: boolean) {
  const serialized = value ? 'true' : 'false';
  const webStorage = getWebStorage();

  if (webStorage) {
    webStorage.setItem(MEMVO_ONBOARDING_SEEN_STORAGE_KEY, serialized);
    return;
  }

  await AsyncStorage.setItem(MEMVO_ONBOARDING_SEEN_STORAGE_KEY, serialized);
}

export async function resetHasSeenOnboarding() {
  const webStorage = getWebStorage();

  if (webStorage) {
    webStorage.removeItem(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
    return;
  }

  await AsyncStorage.removeItem(MEMVO_ONBOARDING_SEEN_STORAGE_KEY);
}
