from pathlib import Path

root = Path('/home/ubuntu/memvo')

files = {
    'lib/theme-provider.tsx': """import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, View, useColorScheme as useSystemColorScheme } from 'react-native';
import { colorScheme as nativewindColorScheme, vars } from 'nativewind';

import { SchemeColors, type ColorScheme } from '@/constants/theme';

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? 'light';
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle('dark', scheme === 'dark');
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  const setColorScheme = useCallback(
    (scheme: ColorScheme) => {
      setColorSchemeState(scheme);
      applyScheme(scheme);
    },
    [applyScheme],
  );

  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        'color-primary': SchemeColors[colorScheme].primary,
        'color-background': SchemeColors[colorScheme].background,
        'color-surface': SchemeColors[colorScheme].surface,
        'color-foreground': SchemeColors[colorScheme].foreground,
        'color-muted': SchemeColors[colorScheme].muted,
        'color-border': SchemeColors[colorScheme].border,
        'color-success': SchemeColors[colorScheme].success,
        'color-warning': SchemeColors[colorScheme].warning,
        'color-error': SchemeColors[colorScheme].error,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
    }),
    [colorScheme, setColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return ctx;
}
""",
    'lib/supabase.ts': """import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
""",
    'lib/memvo-domain.ts': """export type MemvoPlan = 'free' | 'pro' | 'admin';

export type MemvoFolderKind = 'system' | 'custom';
export type MemvoSyncStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'failed';

export type MemvoUserProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  plan: MemvoPlan;
  isAdmin: boolean;
  referralCode: string | null;
  referredByCode: string | null;
  referralBonusMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type MemvoFolder = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  kind: MemvoFolderKind;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type MemvoNote = {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  transcript: string | null;
  summary: string | null;
  actionItems: string[];
  tags: string[];
  audioPath: string | null;
  durationSeconds: number | null;
  languageCode: string | null;
  syncStatus: MemvoSyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type MemvoSyncQueueItem = {
  id: string;
  userId: string;
  noteId: string | null;
  localUri: string;
  status: MemvoSyncStatus;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemvoReferral = {
  id: string;
  referrerUserId: string;
  referredUserId: string | null;
  referralCode: string;
  status: 'pending' | 'qualified' | 'rewarded';
  rewardedMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export const MEMVO_PLAN_FEATURES: Record<MemvoPlan, string[]> = {
  free: ['on-device transcription', 'weekly recording limit', 'basic note management'],
  pro: ['whisper transcription', 'claude summaries', 'unlimited notes', 'multilingual support', 'priority processing'],
  admin: ['manual pro grants', 'referral review', 'operational dashboard'],
};

export function canUseMemvoFeature(plan: MemvoPlan, feature: string) {
  return MEMVO_PLAN_FEATURES[plan].includes(feature) || plan === 'admin';
}
""",
    'server/memvo-admin.ts': """const normalizedAdminEmail = (process.env.MEMVO_ADMIN_EMAIL ?? '').trim().toLowerCase();

export function getMemvoAdminEmail() {
  return normalizedAdminEmail;
}

export function isMemvoAdminEmail(email?: string | null) {
  if (!email || !normalizedAdminEmail) return false;
  return email.trim().toLowerCase() == normalizedAdminEmail;
}

export function getMemvoBootstrapFlags() {
  return {
    isSupabaseConfigured: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    adminEmailConfigured: Boolean(normalizedAdminEmail),
  };
}
""",
    'app/onboarding.tsx': """import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function OnboardingScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
        <View className="gap-6">
          <View className="h-14 w-14 rounded-2xl bg-primary/10" />
          <View className="gap-3">
            <Text className="text-4xl font-bold text-foreground">Memvo</Text>
            <Text className="text-base leading-7 text-muted">
              Private voice notes with transparent pricing, calm design, and AI help only where it adds value.
            </Text>
          </View>

          <View className="gap-3">
            {[
              'Record quickly with one hand.',
              'Read clear transcripts and summaries.',
              'Keep privacy controls visible and understandable.',
            ].map((line) => (
              <View key={line} className="rounded-2xl border border-border bg-surface p-4">
                <Text className="text-sm leading-6 text-foreground">{line}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3 pt-8">
          <View className="rounded-full bg-primary px-5 py-4">
            <Text className="text-center text-sm font-semibold text-white">Continue with Google</Text>
          </View>
          <View className="rounded-full border border-border px-5 py-4">
            <Text className="text-center text-sm font-semibold text-foreground">Continue with email</Text>
          </View>
          <Text className="text-center text-sm text-muted">Referral support and free entry flow will be wired in the next stage.</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
""",
    'app/paywall.tsx': """import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function PaywallScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Upgrade to Pro</Text>
            <Text className="text-base leading-6 text-muted">
              Unlimited notes, faster transcription, multilingual support, and structured AI outputs with no hidden charges.
            </Text>
          </View>

          <View className="rounded-3xl bg-primary p-5">
            <Text className="text-sm font-medium text-white/80">Memvo Pro</Text>
            <Text className="mt-2 text-4xl font-bold text-white">$6.99</Text>
            <Text className="mt-1 text-sm text-white/80">per month after the free trial period</Text>
          </View>

          <View className="gap-3">
            {[
              'Whisper-powered cloud transcription',
              'Claude summaries, action items, and tags',
              'Unlimited recordings and cross-device sync',
            ].map((item) => (
              <View key={item} className="rounded-2xl border border-border bg-surface p-4">
                <Text className="text-sm leading-6 text-foreground">{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
""",
    'app/admin.tsx': """import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function AdminScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Admin panel</Text>
            <Text className="text-base leading-6 text-muted">
              Owner-only controls for referrals, manual Pro access, and operational review will be connected to secure server actions.
            </Text>
          </View>

          <View className="flex-row gap-3">
            {[
              ['Users', '128'],
              ['Pro grants', '6'],
              ['Referrals', '19'],
            ].map(([label, value]) => (
              <View key={label} className="flex-1 rounded-2xl border border-border bg-surface p-4">
                <Text className="text-sm text-muted">{label}</Text>
                <Text className="mt-2 text-2xl font-bold text-foreground">{value}</Text>
              </View>
            ))}
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-base font-semibold text-foreground">Manual Pro grant</Text>
            <Text className="mt-2 text-sm leading-6 text-muted">
              Enter an email, verify the user, and apply or revoke access using service-role protected actions.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
""",
    'app/note/[id].tsx': """import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

export default function NoteDetailScreen() {
  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-sm font-medium text-muted">Today · 11:42 AM</Text>
            <Text className="text-3xl font-bold text-foreground">Investor follow-up ideas</Text>
            <Text className="text-base leading-6 text-muted">
              Editable titles, tags, summary states, and export actions will be connected to data in the next implementation stage.
            </Text>
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-sm font-semibold text-foreground">Summary</Text>
            <Text className="mt-2 text-sm leading-6 text-muted">
              Validate referral incentive language, protect transparent pricing, and prioritize a calm review flow after transcription finishes.
            </Text>
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-sm font-semibold text-foreground">Transcript</Text>
            <Text className="mt-3 text-sm leading-7 text-foreground">
              [00:03] We need the onboarding to explain privacy clearly. [00:18] The pricing should feel honest and easy to understand. [00:31] The note detail screen should stay readable even for long transcripts.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
""",
    'supabase/task1_schema.sql': """-- Memvo Task 1 Supabase schema scaffold
-- Apply in the Supabase SQL editor after confirming project ownership and backup posture.

create extension if not exists pgcrypto;

create type public.memvo_plan as enum ('free', 'pro', 'admin');
create type public.memvo_sync_status as enum ('pending', 'uploading', 'processing', 'complete', 'failed');
create type public.memvo_referral_status as enum ('pending', 'qualified', 'rewarded');

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  plan public.memvo_plan not null default 'free',
  is_admin boolean not null default false,
  referral_code text unique,
  referred_by_code text,
  referral_bonus_minutes integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  kind text not null default 'custom',
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, slug)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null default 'Untitled note',
  transcript text,
  summary text,
  action_items jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  audio_path text,
  duration_seconds integer,
  language_code text,
  sync_status public.memvo_sync_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  local_uri text not null,
  status public.memvo_sync_status not null default 'pending',
  retry_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.user_profiles(id) on delete cascade,
  referred_user_id uuid references public.user_profiles(id) on delete set null,
  referral_code text not null,
  status public.memvo_referral_status not null default 'pending',
  rewarded_minutes integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_admin_email text := lower(coalesce(current_setting('app.settings.memvo_admin_email', true), ''));
begin
  insert into public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    referral_code,
    is_admin,
    plan
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    encode(gen_random_bytes(6), 'hex'),
    case when lower(coalesce(new.email, '')) = configured_admin_email then true else false end,
    case when lower(coalesce(new.email, '')) = configured_admin_email then 'admin'::public.memvo_plan else 'free'::public.memvo_plan end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_memvo on auth.users;
create trigger on_auth_user_created_memvo
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

create or replace function public.seed_default_folders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.folders (user_id, name, slug, kind, position)
  values
    (new.id, 'All Notes', 'all-notes', 'system', 0),
    (new.id, 'Starred', 'starred', 'system', 1),
    (new.id, 'Meetings', 'meetings', 'system', 2),
    (new.id, 'Ideas', 'ideas', 'system', 3),
    (new.id, 'Journal', 'journal', 'system', 4)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_user_profile_created_seed_folders on public.user_profiles;
create trigger on_user_profile_created_seed_folders
  after insert on public.user_profiles
  for each row execute procedure public.seed_default_folders();

create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();
create trigger set_folders_updated_at
  before update on public.folders
  for each row execute procedure public.set_updated_at();
create trigger set_notes_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();
create trigger set_sync_queue_updated_at
  before update on public.sync_queue
  for each row execute procedure public.set_updated_at();
create trigger set_referrals_updated_at
  before update on public.referrals
  for each row execute procedure public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.folders enable row level security;
alter table public.notes enable row level security;
alter table public.sync_queue enable row level security;
alter table public.referrals enable row level security;

create policy "profiles_select_own" on public.user_profiles
for select using (auth.uid() = id or exists (
  select 1 from public.user_profiles admin_profile
  where admin_profile.id = auth.uid() and admin_profile.is_admin = true
));

create policy "profiles_update_own" on public.user_profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "folders_manage_own" on public.folders
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notes_manage_own" on public.notes
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sync_queue_manage_own" on public.sync_queue
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "referrals_select_own_or_admin" on public.referrals
for select using (
  auth.uid() = referrer_user_id
  or exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

create policy "referrals_insert_own" on public.referrals
for insert with check (auth.uid() = referrer_user_id);

create policy "referrals_admin_update" on public.referrals
for update using (
  exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

comment on function public.handle_new_user_profile is 'Reads app.settings.memvo_admin_email to auto-assign the Memvo owner account admin access.';
comment on table public.sync_queue is 'Tracks offline recordings that still need upload, transcription, or retry handling.';
""",
    'tests/memvo.domain.test.ts': """import { describe, expect, it } from 'vitest';

import { MEMVO_PLAN_FEATURES, canUseMemvoFeature } from '@/lib/memvo-domain';

describe('Memvo domain rules', () => {
  it('keeps free and pro plan features distinct', () => {
    expect(MEMVO_PLAN_FEATURES.free).toContain('on-device transcription');
    expect(MEMVO_PLAN_FEATURES.free).not.toContain('claude summaries');
    expect(MEMVO_PLAN_FEATURES.pro).toContain('claude summaries');
  });

  it('allows admin access across all gated features', () => {
    expect(canUseMemvoFeature('admin', 'manual pro grants')).toBe(true);
    expect(canUseMemvoFeature('admin', 'whisper transcription')).toBe(true);
  });
});
""",
}

for relative_path, content in files.items():
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
