import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [checkEmailAddress, setCheckEmailAddress] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    readPendingReferralCode()
      .then((code) => {
        if (isMounted) {
          setPendingReferralCode(code);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPendingReferralCode(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const canSubmit = useMemo(() => {
    return trimmedName.length > 0 && EMAIL_REGEX.test(trimmedEmail) && password.trim().length >= 6;
  }, [password, trimmedEmail, trimmedName]);

  const finishSignedInFlow = async () => {
    const referralResult = await processPendingReferralForCurrentUser();
    if (!referralResult.success && referralResult.reason === 'invoke-failed' && referralResult.error) {
      console.warn('Pending referral could not be applied after signup', referralResult.error);
    }

    router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
  };

  const handleSignup = async () => {
    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured correctly in this build. Reload after the public auth settings finish syncing.');
      return;
    }

    if (!canSubmit) {
      setAuthError('Enter your full name, a valid email address, and a password with at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);
    setCheckEmailAddress(null);

    try {
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

      setCheckEmailAddress(trimmedEmail);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-up failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!checkEmailAddress) {
      return;
    }

    setIsResending(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: checkEmailAddress,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to resend the confirmation email right now.');
    } finally {
      setIsResending(false);
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
            <View className="items-center gap-4 pt-4">
              <View className="h-20 w-20 items-center justify-center rounded-[26px] bg-primary">
                <Text className="text-4xl font-bold text-white">M</Text>
              </View>
              <View className="items-center gap-2">
                <Text className="text-3xl font-bold text-foreground">Create your account</Text>
                <Text className="text-center text-base leading-7 text-muted">
                  Start with private voice notes, calm organisation, and pricing that stays honest.
                </Text>
              </View>
            </View>

            {pendingReferralCode ? (
              <View className="rounded-[28px] border border-primary/15 bg-primary/5 px-5 py-5">
                <Text className="text-sm font-semibold uppercase tracking-[1.1px] text-primary">Referral saved</Text>
                <Text className="mt-3 text-2xl font-bold text-foreground">{pendingReferralCode}</Text>
                <Text className="mt-3 text-sm leading-6 text-muted">
                  Finish creating your account and Memvo will apply this referral automatically after signup.
                </Text>
              </View>
            ) : null}

            <View className="rounded-[30px] border border-border bg-surface px-5 py-5">
              {checkEmailAddress ? (
                <View className="gap-5">
                  <View className="gap-2">
                    <Text className="text-2xl font-bold text-foreground">Check your email</Text>
                    <Text className="text-sm leading-6 text-muted">
                      We created your account for {checkEmailAddress}. Confirm your email to finish signing in if verification is enabled.
                    </Text>
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
                      void handleResend();
                    }}
                    disabled={isResending}
                    className={`rounded-full px-5 py-4 ${isResending ? 'bg-primary/40' : 'bg-primary'}`}
                  >
                    {isResending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-center text-sm font-semibold text-white">Resend email</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={() => router.replace('/login' as Parameters<typeof router.replace>[0])}
                    className="rounded-full border border-border px-5 py-4"
                  >
                    <Text className="text-center text-sm font-semibold text-foreground">Go to sign in</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="gap-4">
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
                      className="rounded-2xl border border-border bg-background px-4 py-4 text-base text-foreground"
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Password</Text>
                    <View className="flex-row items-center rounded-2xl border border-border bg-background px-4">
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="At least 6 characters"
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!showPassword}
                        textContentType="newPassword"
                        placeholderTextColor="#94A3B8"
                        className="flex-1 py-4 text-base text-foreground"
                      />
                      <Pressable onPress={() => setShowPassword((current) => !current)}>
                        <Text className="text-sm font-semibold text-primary">{showPassword ? 'Hide' : 'Show'}</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">Full name</Text>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Your name"
                      autoCapitalize="words"
                      placeholderTextColor="#94A3B8"
                      className="rounded-2xl border border-border bg-background px-4 py-4 text-base text-foreground"
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
                      void handleSignup();
                    }}
                    disabled={!canSubmit || isSubmitting}
                    className={`rounded-full px-5 py-4 ${!canSubmit || isSubmitting ? 'bg-primary/40' : 'bg-primary'}`}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-center text-sm font-semibold text-white">Sign up</Text>
                    )}
                  </TouchableOpacity>

                  <View className="flex-row items-center gap-3 py-1">
                    <View className="h-px flex-1 bg-border" />
                    <Text className="text-sm text-muted">or</Text>
                    <View className="h-px flex-1 bg-border" />
                  </View>

                  <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} className="rounded-full border border-border px-5 py-4">
                    <Text className="text-center text-sm font-semibold text-foreground">Continue with Google</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View className="items-center gap-3 pt-8">
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => router.replace('/login' as Parameters<typeof router.replace>[0])}
            >
              <Text className="text-sm text-muted">
                Already have an account? <Text className="font-semibold text-primary">Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
