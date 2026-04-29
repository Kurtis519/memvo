// Load environment variables with proper priority (system > .env)
import './scripts/load-env.js';
import type { ExpoConfig } from 'expo/config';

const iosBundleId = 'com.memvo.app';
const androidPackage = 'com.memvo.mobile';
const appSchemes = ['memvo', iosBundleId, androidPackage];
const primaryScheme = appSchemes[0];
const googleIosRedirectUri = `${iosBundleId}:/oauthredirect`;
const googleAndroidRedirectUri = `${androidPackage}:/oauthredirect`;

const env = {
  appName: 'Memvo',
  appSlug: 'memvo',
  logoUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310419663028501504/G2BGjWrYYw9fkXxmxXmQtz/memvo-icon-BePisVKkKEWZuKL97pdGhm.png',
  scheme: primaryScheme,
  schemes: appSchemes,
  iosBundleId,
  androidPackage,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  googleIosRedirectUri,
  googleAndroidRedirectUri,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: env.schemes,
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      UIBackgroundModes: ['audio'],
      NSMicrophoneUsageDescription: 'Memvo uses your microphone to capture private voice notes and continue recording while the app is backgrounded.',
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ['POST_NOTIFICATIONS', 'RECORD_AUDIO'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: env.schemes.map((scheme) => ({
          scheme,
          host: '*',
        })),
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-audio',
      {
        microphonePermission: 'Allow $(PRODUCT_NAME) to access your microphone for private voice note capture.',
      },
    ],
    [
      'expo-video',
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
        dark: {
          backgroundColor: '#FFFFFF',
        },
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          buildArchs: ['armeabi-v7a', 'arm64-v8a'],
        },
      },
    ],
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Allow Memvo to use your microphone to transcribe voice notes.',
        speechRecognitionPermission: 'Allow Memvo to transcribe your voice notes.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: '73d0fd48-bc9d-4acc-bebf-88094899664d',
    },
    appName: env.appName,
    logoUrl: env.logoUrl,
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    googleWebClientId: env.googleWebClientId,
    googleIosClientId: env.googleIosClientId,
    googleAndroidClientId: env.googleAndroidClientId,
    googleIosRedirectUri: env.googleIosRedirectUri,
    googleAndroidRedirectUri: env.googleAndroidRedirectUri,
    appSchemes: env.schemes,
    iosBundleId: env.iosBundleId,
    androidPackage: env.androidPackage,
  },
};

export default config;
