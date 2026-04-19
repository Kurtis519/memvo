import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

type SupabaseRuntimeExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function resolveRuntimeExtra(): SupabaseRuntimeExtra {
  const expoConfigExtra = (Constants.expoConfig?.extra ?? {}) as SupabaseRuntimeExtra;
  const manifestExtra = ((Constants as typeof Constants & {
    manifest?: { extra?: SupabaseRuntimeExtra };
  }).manifest?.extra ?? {}) as SupabaseRuntimeExtra;
  const manifest2Extra = ((Constants as typeof Constants & {
    manifest2?: {
      extra?: SupabaseRuntimeExtra;
    };
  }).manifest2?.extra ?? {}) as SupabaseRuntimeExtra;
  const expoClientExtra = ((Constants as typeof Constants & {
    manifest2?: {
      extra?: {
        expoClient?: {
          extra?: SupabaseRuntimeExtra;
        };
      };
    };
  }).manifest2?.extra?.expoClient?.extra ?? {}) as SupabaseRuntimeExtra;

  return {
    ...manifestExtra,
    ...manifest2Extra,
    ...expoClientExtra,
    ...expoConfigExtra,
  };
}

const extra = resolveRuntimeExtra();

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? extra.supabaseUrl
  ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ?? process.env.SUPABASE_ANON_KEY
  ?? extra.supabaseAnonKey
  ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const isWebBrowser = Platform.OS === 'web' && typeof window !== 'undefined';

const webStorage = {
  getItem: async (key: string) => {
    if (!isWebBrowser) {
      return null;
    }

    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (!isWebBrowser) {
      return;
    }

    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (!isWebBrowser) {
      return;
    }

    window.localStorage.removeItem(key);
  },
};

const authStorage = Platform.OS === 'web' ? webStorage : AsyncStorage;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWebBrowser,
    },
  },
);
