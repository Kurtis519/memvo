import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';

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
      autoRefreshToken: isWebBrowser || Platform.OS !== 'web',
      persistSession: true,
      detectSessionInUrl: isWebBrowser,
    },
  },
);
