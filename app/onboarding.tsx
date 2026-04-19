import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { ScreenContainer } from '@/components/screen-container';
import { processPendingReferralForCurrentUser, readPendingReferralCode } from '@/lib/memvo-referrals';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OnboardingScreen() {
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(null);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadReferralCode = async () => {
      const storedCode = await readPendingReferralCode();
      if (isMounted) {
        setPendingReferralCode(storedCode);
      }
    };

    void loadReferralCode();

    return () => {
      isMounted = false;
    };
  }, []);

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = fullName.trim();
  const canSubmit = useMemo(() => {
    if (!EMAIL_REGEX.test(trimmedEmail) || password.trim().length < 6) {
      return false;
    }

    if (mode === 'signup' && trimmedName.length === 0) {
      return false;
    }

    return true;
  }, [mode, password, trimmedEmail, trimmedName]);

  const finishSignedInFlow = async () => {
    const referralResult = await processPendingReferralForCurrentUser();
    if (!referralResult.success && referralResult.reason === 'invoke-failed' && referralResult.error) {
      console.warn('Pending referral could not be applied after auth', referralResult.error);
    }

    router.replace('/(tabs)');
  };

  const handleAuth = async () => {
    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured correctly in this build. Please reload after the configuration fix is applied.');
      return;
    }

    if (!canSubmit) {
      setAuthError(
        mode === 'signup'
          ? 'Enter your name, a valid email address, and a password with at least 6 characters.'
          : 'Enter a valid email address and your password.',
      );
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
              name: trimmedName,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          await finishSignedInFlow();
          return;
        }

        setAuthError('Email confirmation is still enabled for this Supabase project, so signup created the account but did not open a session. Turn off “Confirm email” in Supabase Auth to enter the app immediately after signup.');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error('Sign-in completed without a session. Please try again.');
      }

      await finishSignedInFlow();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed. Please try again.';
      setAuthError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-6 pb-8">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }} keyboardShouldPersistTaps="handled">
          <View className="gap-6">
            <View className="h-14 w-14 rounded-2xl bg-primary/10" />
            <View className="gap-3">
              <Text className="text-4xl font-bold text-foreground">Memvo</Text>
              <Text className="text-base leading-7 text-muted">
                Private voice notes with transparent pricing, calm design, and AI help only where it adds value.
              </Text>
            </View>

            {pendingReferralCode ? (
              <View className="rounded-[28px] border border-border bg-surface p-5">
                <Text className="text-sm font-semibold uppercase tracking-[1px] text-muted">Referral saved</Text>
                <Text className="mt-3 text-2xl font-bold text-foreground">{pendingReferralCode}</Text>
                <Text className="mt-3 text-sm leading-6 text-muted">
                  Finish signing up with this invite and both of you will receive 30 bonus minutes after your account is created.
                </Text>
              </View>
            ) : null}

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

            <View className="rounded-[28px] border border-border bg-surface p-5">
              <View className="flex-row rounded-full bg-background p-1">
                <Pressable
                  onPress={() => {
                    setMode('signup');
                    setAuthError(null);
                  }}
                  className={`flex-1 rounded-full px-4 py-3 ${mode === 'signup' ? 'bg-primary' : 'bg-background'}`}
                >
                  <Text className={`text-center text-sm font-semibold ${mode === 'signup' ? 'text-white' : 'text-foreground'}`}>
                    Create account
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setMode('signin');
                    setAuthError(null);
                  }}
                  className={`flex-1 rounded-full px-4 py-3 ${mode === 'signin' ? 'bg-primary' : 'bg-background'}`}
                >
                  <Text className={`text-center text-sm font-semibold ${mode === 'signin' ? 'text-white' : 'text-foreground'}`}>
                    Sign in
                  </Text>
                </Pressable>
              </View>

              <View className="mt-5 gap-3">
                {mode === 'signup' ? (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Full name</Text>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Your name"
                      autoCapitalize="words"
                      placeholderTextColor="#94A3B8"
                      className="rounded-2xl border border-border px-4 py-4 text-base text-foreground"
                    />
                  </View>
                ) : null}

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholderTextColor="#94A3B8"
                    className="rounded-2xl border border-border px-4 py-4 text-base text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Password</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 6 characters"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                    placeholderTextColor="#94A3B8"
                    className="rounded-2xl border border-border px-4 py-4 text-base text-foreground"
                  />
                </View>

                {authError ? (
                  <View className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3">
                    <Text className="text-sm leading-6 text-error">{authError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => {
                    void handleAuth();
                  }}
                  disabled={!canSubmit || isSubmitting}
                  className={`rounded-full px-5 py-4 ${!canSubmit || isSubmitting ? 'bg-primary/40' : 'bg-primary'}`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-center text-sm font-semibold text-white">
                      {mode === 'signup' ? 'Create account' : 'Sign in'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View className="gap-3 pt-8">
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => {
                Alert.alert('Google sign-in coming next', 'Use email and password for now while the dedicated Google flow is being reconnected.');
              }}
              className="rounded-full border border-border px-5 py-4"
            >
              <Text className="text-center text-sm font-semibold text-foreground">Continue with Google</Text>
            </TouchableOpacity>
            <Text className="text-center text-sm text-muted">
              {pendingReferralCode
                ? 'Your invite code will be applied automatically after signup finishes.'
                : 'Sign in to start recording and unlock bonus minutes when friends join through your invite link.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
