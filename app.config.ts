// Load environment variables with proper priority (system > .env)
import './scripts/load-env.js';
import type { ExpoConfig } from 'expo/config';

const bundleId = '{{bundle_id}}';
const timestamp = bundleId.split('.').pop()?.replace(/^t/, '') ?? '';
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: 'Memvo',
  appSlug: '{{project_name}}',
  logoUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310419663028501504/G2BGjWrYYw9fkXxmxXmQtz/memvo-icon-BePisVKkKEWZuKL97pdGhm.png',
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: env.scheme,
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
        data: [
          {
            scheme: env.scheme,
            host: '*',
          },
        ],
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
          backgroundColor: '#081A15',
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
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appName: env.appName,
    logoUrl: env.logoUrl,
  },
};

export default config;
