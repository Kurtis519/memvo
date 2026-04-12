from pathlib import Path

root = Path('/home/ubuntu/memvo')

files = {
    'theme.config.js': """/** @type {const} */
const themeColors = {
  primary: { light: '#0F6E56', dark: '#0F6E56' },
  background: { light: '#FFFFFF', dark: '#081A15' },
  surface: { light: '#F6FAF8', dark: '#102621' },
  foreground: { light: '#1A1A1A', dark: '#F5F7F6' },
  muted: { light: '#888888', dark: '#A8B4AF' },
  border: { light: '#DCE7E2', dark: '#1F3A33' },
  success: { light: '#1F9D72', dark: '#4DD4A7' },
  warning: { light: '#D97706', dark: '#FBBF24' },
  error: { light: '#C2410C', dark: '#FB923C' },
};

module.exports = { themeColors };
""",
    'app.config.ts': """// Load environment variables with proper priority (system > .env)
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
""",
    'components/ui/icon-symbol.tsx': """// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  'house.fill': 'home',
  'magnifyingglass': 'search',
  'mic.circle.fill': 'mic',
  'books.vertical.fill': 'folder-copy',
  'gearshape.fill': 'settings',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
""",
    'app/(tabs)/_layout.tsx': """import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 10);
  const tabBarHeight = 62 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="mic.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="books.vertical.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
""",
    'app/(tabs)/index.tsx': """import { ScrollView, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

const notes = [
  {
    id: '1',
    title: 'Investor follow-up ideas',
    date: 'Today · 11:42 AM',
    duration: '08:14',
    summary: 'Discussed launch timing, referral incentives, and what to validate before the beta invite list goes out.',
    tags: ['Product', 'Launch', 'Follow-up'],
  },
  {
    id: '2',
    title: 'Journal reflection',
    date: 'Yesterday · 8:05 PM',
    duration: '05:31',
    summary: 'A quieter personal note focused on energy, priorities, and what to protect during a busy week.',
    tags: ['Journal', 'Personal'],
  },
];

export default function HomeScreen() {
  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">Saturday, April 12</Text>
            <Text className="text-3xl font-bold text-foreground">Good afternoon</Text>
            <Text className="text-base leading-6 text-muted">
              Capture private voice notes, transcribe them clearly, and keep only the text that matters.
            </Text>
          </View>

          <View className="rounded-xl border border-border bg-surface px-4 py-3">
            <TextInput
              editable={false}
              placeholder="Search transcripts"
              placeholderTextColor="#888888"
              className="text-base text-foreground"
            />
          </View>

          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Recent notes</Text>
            {notes.map((note) => (
              <View key={note.id} className="gap-3 rounded-2xl border border-border bg-surface p-4">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1 gap-1">
                    <Text className="text-lg font-semibold text-foreground">{note.title}</Text>
                    <Text className="text-sm text-muted">{note.date}</Text>
                  </View>
                  <View className="rounded-full bg-background px-3 py-1">
                    <Text className="text-xs font-semibold text-primary">{note.duration}</Text>
                  </View>
                </View>
                <Text className="text-sm leading-6 text-muted">{note.summary}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {note.tags.map((tag) => (
                    <View key={tag} className="rounded-full bg-background px-3 py-1.5">
                      <Text className="text-xs font-medium text-primary">{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-8 left-0 right-0 items-center">
        <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-primary shadow-sm">
          <Text className="text-sm font-semibold text-white">Record</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
""",
    'app/(tabs)/search.tsx': """import { ScrollView, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function SearchScreen() {
  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Search</Text>
            <Text className="text-base leading-6 text-muted">
              Find moments, themes, and exact phrases across your transcripts.
            </Text>
          </View>

          <View className="rounded-xl border border-border bg-surface px-4 py-3">
            <TextInput autoFocus editable={false} placeholder="Search notes" placeholderTextColor="#888888" className="text-base text-foreground" />
          </View>

          <View className="flex-row flex-wrap gap-2">
            {['All tags', 'This week', 'Meetings', 'Ideas'].map((filter) => (
              <View key={filter} className="rounded-full border border-border px-3 py-2">
                <Text className="text-xs font-medium text-foreground">{filter}</Text>
              </View>
            ))}
          </View>

          <View className="gap-3">
            <View className="rounded-2xl border border-border bg-surface p-4">
              <Text className="text-base font-semibold text-foreground">Investor follow-up ideas</Text>
              <Text className="mt-2 text-sm leading-6 text-muted">
                ...referral incentives should remain simple, and the <Text className="font-semibold text-primary">pricing</Text> language needs to stay transparent...
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
""",
    'app/(tabs)/record.tsx': """import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function RecordScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-4 pb-6">
      <View className="flex-1 justify-between">
        <View className="gap-4">
          <View className="rounded-2xl border border-border bg-[#F3FBF7] px-4 py-3">
            <Text className="text-sm font-medium text-primary">Recording offline — will sync and transcribe when connected</Text>
          </View>
          <Text className="text-center text-sm font-medium text-muted">00:12:48</Text>
          <View className="items-center justify-center py-10">
            <View className="h-64 w-64 items-center justify-center rounded-full border border-border bg-surface">
              <View className="h-40 w-40 rounded-full bg-primary/10" />
            </View>
          </View>
        </View>

        <View className="gap-6">
          <View className="max-h-56 rounded-2xl border border-border bg-surface p-4">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-sm leading-7 text-foreground">
                I want the app to feel calm, private, and easy to trust. The summary should be fast, but the wording should stay human and readable.
              </Text>
            </ScrollView>
          </View>

          <View className="flex-row items-center justify-center gap-4">
            <View className="rounded-full border border-border px-6 py-4">
              <Text className="text-sm font-semibold text-foreground">Pause</Text>
            </View>
            <View className="rounded-full bg-primary px-8 py-4">
              <Text className="text-sm font-semibold text-white">Stop</Text>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
""",
    'app/(tabs)/library.tsx': """import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

const folders = [
  ['All Notes', '42 notes'],
  ['Starred', '9 notes'],
  ['Journals', '7 notes'],
  ['Meetings', '13 notes'],
  ['Ideas', '13 notes'],
];

export default function LibraryScreen() {
  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Library</Text>
            <Text className="text-base leading-6 text-muted">
              Keep voice notes organized by folder, recent activity, and starred moments.
            </Text>
          </View>

          <View className="gap-3">
            {folders.map(([name, count]) => (
              <View key={name} className="flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4">
                <View>
                  <Text className="text-base font-semibold text-foreground">{name}</Text>
                  <Text className="mt-1 text-sm text-muted">{count}</Text>
                </View>
                <Text className="text-lg text-muted">›</Text>
              </View>
            ))}
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-base font-semibold text-foreground">Recent activity</Text>
            <Text className="mt-2 text-sm leading-6 text-muted">
              You recorded 3 notes today and 8 notes this week. Folder management and editable note placement will be connected in the next build stage.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
""",
    'app/(tabs)/settings.tsx': """import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

const sections = [
  {
    title: 'Account',
    rows: ['Name and email', 'Subscription status', 'Billing history'],
  },
  {
    title: 'Invite friends & earn minutes',
    rows: ['Referral code', 'Share message', 'Bonus minutes earned'],
  },
  {
    title: 'Privacy',
    rows: ['Audio deletion policy', 'Data export', 'Delete account'],
  },
  {
    title: 'App',
    rows: ['Notifications', 'Offline sync status', 'Support and FAQ'],
  },
];

export default function SettingsScreen() {
  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Settings</Text>
            <Text className="text-base leading-6 text-muted">
              Manage your plan, referrals, privacy controls, and future admin tools in one place.
            </Text>
          </View>

          {sections.map((section) => (
            <View key={section.title} className="rounded-2xl border border-border bg-surface p-4">
              <Text className="text-base font-semibold text-foreground">{section.title}</Text>
              <View className="mt-3 gap-3">
                {section.rows.map((row) => (
                  <View key={row} className="flex-row items-center justify-between">
                    <Text className="text-sm text-foreground">{row}</Text>
                    <Text className="text-base text-muted">›</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
""",
}

for relative_path, content in files.items():
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
