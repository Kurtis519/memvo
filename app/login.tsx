import { useMemo, useState } from 'react';
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
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const trimmedEmail = email.trim().toLowerCase();
  const canSubmit = useMemo(() => EMAIL_REGEX.test(trimmedEmail) && password.trim().length >= 6, [password, trimmedEmail]);

  const handleSignIn = async () => {
    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured correctly in this build. Reload after the public auth settings finish syncing.');
      return;
    }

    if (!canSubmit) {
      setAuthError('Enter a valid email address and your password.');
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);
    setResetMessage(null);

    try {
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

      router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured correctly in this build. Reload after the public auth settings finish syncing.');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setAuthError('Enter your email address first so Memvo knows where to send the reset link.');
      return;
    }

    setIsResetting(true);
    setAuthError(null);
    setResetMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) {
        throw error;
      }

      setResetMessage(`Password reset email sent to ${trimmedEmail}.`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to send the reset email right now.');
    } finally {
      setIsResetting(false);
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
                <Text className="text-3xl font-bold text-foreground">Welcome back</Text>
                <Text className="text-center text-base leading-7 text-muted">
                  Pick up where you left off and go straight back to your voice notes.
                </Text>
              </View>
            </View>

            <View className="rounded-[30px] border border-border bg-surface px-5 py-5">
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
                      placeholder="Your password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showPassword}
                      textContentType="password"
                      placeholderTextColor="#94A3B8"
                      className="flex-1 py-4 text-base text-foreground"
                    />
                    <Pressable onPress={() => setShowPassword((current) => !current)}>
                      <Text className="text-sm font-semibold text-primary">{showPassword ? 'Hide' : 'Show'}</Text>
                    </Pressable>
                  </View>
                </View>

                {authError ? (
                  <View className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3">
                    <Text className="text-sm leading-6 text-error">{authError}</Text>
                  </View>
                ) : null}

                {resetMessage ? (
                  <View className="rounded-2xl border border-success/20 bg-success/10 px-4 py-3">
                    <Text className="text-sm leading-6 text-success">{resetMessage}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => {
                    void handleSignIn();
                  }}
                  disabled={!canSubmit || isSubmitting}
                  className={`rounded-full px-5 py-4 ${!canSubmit || isSubmitting ? 'bg-primary/40' : 'bg-primary'}`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-center text-sm font-semibold text-white">Sign in</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => {
                    void handleForgotPassword();
                  }}
                  disabled={isResetting}
                >
                  <Text className="text-center text-sm font-semibold text-primary">
                    {isResetting ? 'Sending reset email…' : 'Forgot password?'}
                  </Text>
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
            </View>
          </View>

          <View className="items-center gap-3 pt-8">
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => router.replace('/signup' as Parameters<typeof router.replace>[0])}
            >
              <Text className="text-sm text-muted">
                Don&apos;t have an account? <Text className="font-semibold text-primary">Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
