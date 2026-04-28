import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type GoogleRuntimeExtra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
};

type GooglePublicEnv = {
  webClientId: string;
  iosClientId: string;
  androidClientId: string;
};

export type GoogleAuthConfigStatus = GooglePublicEnv & {
  iosBundleId: string;
  androidPackage: string;
  nativeRedirectUri: string;
  missingNativeClientIds: string[];
  missingPublicClientIds: string[];
  hasNativeClientIds: boolean;
  hasAllClientIds: boolean;
};

export type GoogleSignInResult =
  | { cancelled: true; redirected: false }
  | { cancelled: false; redirected: true }
  | { cancelled: false; redirected: false };

function resolveRuntimeExtra(): GoogleRuntimeExtra {
  const expoConfigExtra = (Constants.expoConfig?.extra ?? {}) as GoogleRuntimeExtra;
  const manifestExtra = ((Constants as typeof Constants & {
    manifest?: { extra?: GoogleRuntimeExtra };
  }).manifest?.extra ?? {}) as GoogleRuntimeExtra;
  const manifest2Extra = ((Constants as typeof Constants & {
    manifest2?: {
      extra?: GoogleRuntimeExtra;
    };
  }).manifest2?.extra ?? {}) as GoogleRuntimeExtra;
  const expoClientExtra = ((Constants as typeof Constants & {
    manifest2?: {
      extra?: {
        expoClient?: {
          extra?: GoogleRuntimeExtra;
        };
      };
    };
  }).manifest2?.extra?.expoClient?.extra ?? {}) as GoogleRuntimeExtra;

  return {
    ...manifestExtra,
    ...manifest2Extra,
    ...expoClientExtra,
    ...expoConfigExtra,
  };
}

function readGoogleEnv(): GooglePublicEnv {
  const extra = resolveRuntimeExtra();

  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? extra.googleWebClientId ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? extra.googleIosClientId ?? '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? extra.googleAndroidClientId ?? '',
  };
}

export function getGoogleAuthConfigStatus(): GoogleAuthConfigStatus {
  const env = readGoogleEnv();
  const iosBundleId = Constants.expoConfig?.ios?.bundleIdentifier ?? '';
  const androidPackage = Constants.expoConfig?.android?.package ?? '';
  const nativeRedirectUri =
    Platform.OS === 'ios'
      ? (iosBundleId ? `${iosBundleId}:/oauthredirect` : '')
      : Platform.OS === 'android'
        ? (androidPackage ? `${androidPackage}:/oauthredirect` : '')
        : '';

  const missingNativeClientIds = [
    !env.iosClientId ? 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID' : null,
    !env.androidClientId ? 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID' : null,
  ].filter((value): value is string => Boolean(value));

  const missingPublicClientIds = [
    !env.webClientId ? 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID' : null,
    ...missingNativeClientIds,
  ].filter((value): value is string => Boolean(value));

  return {
    ...env,
    iosBundleId,
    androidPackage,
    nativeRedirectUri,
    missingNativeClientIds,
    missingPublicClientIds,
    hasNativeClientIds: missingNativeClientIds.length === 0,
    hasAllClientIds: missingPublicClientIds.length === 0,
  };
}

async function startGoogleSignInOnWeb() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured correctly in this build. Reload after the public auth settings finish syncing.');
  }

  if (typeof window === 'undefined') {
    throw new Error('Google sign-in on web requires a browser environment.');
  }

  const redirectTo = `${window.location.origin}/`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('Google sign-in could not start because Supabase did not return a redirect URL.');
  }

  window.location.assign(data.url);
}

async function completeNativeGoogleSignIn(idToken: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error('Google sign-in completed without a session. Please try again.');
  }

  return data;
}

export function useGoogleSignIn() {
  const configStatus = useMemo(() => getGoogleAuthConfigStatus(), []);
  const redirectUriOptions = useMemo(
    () => (configStatus.nativeRedirectUri ? { native: configStatus.nativeRedirectUri } : undefined),
    [configStatus.nativeRedirectUri],
  );

  const [request, _response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      iosClientId: configStatus.iosClientId || undefined,
      androidClientId: configStatus.androidClientId || undefined,
      webClientId: configStatus.webClientId || undefined,
      scopes: ['openid', 'profile', 'email'],
      selectAccount: true,
    },
    redirectUriOptions,
  );

  const startGoogleSignIn = useCallback(async (): Promise<GoogleSignInResult> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured correctly in this build. Reload after the public auth settings finish syncing.');
    }

    if (Platform.OS === 'web') {
      await startGoogleSignInOnWeb();
      return { cancelled: false, redirected: true };
    }

    if (!configStatus.hasNativeClientIds) {
      throw new Error(`Google Sign-In is not configured yet for this build. Add ${configStatus.missingNativeClientIds.join(', ')}.`);
    }

    if (!request) {
      throw new Error('Google Sign-In is still preparing. Please try again in a moment.');
    }

    const result = await promptAsync();

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { cancelled: true, redirected: false };
    }

    if (result.type !== 'success') {
      const providerError =
        ('params' in result && result.params
          ? (result.params.error_description ?? result.params.error)
          : undefined) ?? 'Google Sign-In failed. Please try again.';
      throw new Error(providerError);
    }

    const idToken =
      ('params' in result && result.params ? result.params.id_token : undefined)
      ?? ('authentication' in result && result.authentication ? result.authentication.idToken : undefined);

    if (!idToken) {
      throw new Error('Google did not return an ID token.');
    }

    await completeNativeGoogleSignIn(idToken);

    return { cancelled: false, redirected: false };
  }, [configStatus, promptAsync, request]);

  return {
    request,
    startGoogleSignIn,
    configStatus,
    isGoogleReady: Platform.OS === 'web' || Boolean(request),
  };
}
