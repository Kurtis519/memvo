import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { ScreenContainer } from '@/components/screen-container';
import { useGoogleSignIn } from '@/lib/google-auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADING = '#1A1A1A';
const BODY = '#555555';
const CAPTION = '#888888';
const INPUT_BG = '#F5F5F5';
const INPUT_BORDER = '#E0E0E0';
const WHITE = '#FFFFFF';
const TEAL = '#0F6E56';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const { startGoogleSignIn, configStatus, isGoogleReady } = useGoogleSignIn();

  const trimmedEmail = email.trim().toLowerCase();
  const canSubmit = useMemo(
    () => EMAIL_REGEX.test(trimmedEmail) && password.trim().length >= 6,
    [password, trimmedEmail],
  );

  const googleButtonDisabled = isGoogleSubmitting || (Platform.OS !== 'web' && !isGoogleReady);
  const googleUnavailableMessage = useMemo(() => {
    if (Platform.OS === 'web' || configStatus.hasNativeClientIds) {
      return null;
    }
    return `Google Sign-In needs ${configStatus.missingNativeClientIds.join(', ')} in this build.`;
  }, [configStatus.hasNativeClientIds, configStatus.missingNativeClientIds]);

  const handleSignIn = async () => {
    console.log('Memvo login isSupabaseConfigured:', isSupabaseConfigured);

    if (!isSupabaseConfigured) {
      setAuthError(
        'Supabase is not configured correctly in this build. Reload after the public auth settings finish syncing.',
      );
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

      // Explicitly navigate to home feed after successful sign-in
      // The AuthGate will also handle this via auth state change,
      // but we navigate directly here to avoid any timing issues on Android
      router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Sign-in failed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsGoogleSubmitting(true);
    setAuthError(null);
    setResetMessage(null);

    try {
      const result = await startGoogleSignIn();
      if (!result.cancelled && !result.redirected) {
        router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Google Sign-In failed. Please try again.',
      );
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isSupabaseConfigured) {
      setAuthError(
        'Supabase is not configured correctly in this build. Reload after the public auth settings finish syncing.',
      );
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setAuthError(
        'Enter your email address first so Memvo knows where to send the reset link.',
      );
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
      setAuthError(
        error instanceof Error ? error.message : 'Unable to send the reset email right now.',
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <ScreenContainer
      edges={['top', 'bottom', 'left', 'right']}
      containerClassName="bg-white"
      className="bg-white"
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          style={styles.scrollView}
        >
          <View style={styles.topBlock}>
            <View style={styles.heroSection}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>M</Text>
              </View>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heading}>Welcome back</Text>
                <Text style={styles.bodyText}>
                  Pick up where you left off and go straight back to your voice notes.
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.formStack}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholderTextColor={CAPTION}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={styles.passwordShell}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Your password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showPassword}
                      textContentType="password"
                      placeholderTextColor={CAPTION}
                      style={styles.passwordInput}
                    />
                    <Pressable onPress={() => setShowPassword((current) => !current)}>
                      <Text style={styles.inlineActionText}>
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {authError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{authError}</Text>
                  </View>
                ) : null}

                {resetMessage ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>{resetMessage}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => {
                    void handleSignIn();
                  }}
                  disabled={!canSubmit || isSubmitting}
                  style={[
                    styles.primaryButton,
                    (!canSubmit || isSubmitting) && styles.primaryButtonDisabled,
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={WHITE} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sign in</Text>
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
                  <Text style={styles.linkText}>
                    {isResetting ? 'Sending reset email…' : 'Forgot password?'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.captionText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => {
                    void handleGoogleAuth();
                  }}
                  disabled={googleButtonDisabled}
                  style={[styles.googleButton, googleButtonDisabled && styles.googleButtonDisabled]}
                >
                  {isGoogleSubmitting ? (
                    <ActivityIndicator color={HEADING} />
                  ) : (
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  )}
                </TouchableOpacity>

                {googleUnavailableMessage ? (
                  <Text style={styles.helperText}>{googleUnavailableMessage}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.bottomBlock}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() =>
                router.replace('/signup' as Parameters<typeof router.replace>[0])
              }
            >
              <Text style={styles.bottomPrompt}>
                Don&apos;t have an account?{' '}
                <Text style={styles.bottomPromptAccent}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: WHITE,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: WHITE,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: WHITE,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  topBlock: {
    gap: 24,
    backgroundColor: WHITE,
  },
  heroSection: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 16,
    backgroundColor: WHITE,
  },
  logoBox: {
    height: 80,
    width: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TEAL,
  },
  logoText: {
    color: WHITE,
    fontSize: 36,
    fontWeight: '700',
  },
  heroTextBlock: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: WHITE,
  },
  heading: {
    color: HEADING,
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  bodyText: {
    color: BODY,
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'center',
  },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: WHITE,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  formStack: {
    gap: 16,
    backgroundColor: WHITE,
  },
  fieldGroup: {
    gap: 8,
    backgroundColor: WHITE,
  },
  fieldLabel: {
    color: HEADING,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    color: HEADING,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  passwordShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: HEADING,
  },
  inlineActionText: {
    color: TEAL,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3C9C1',
    backgroundColor: '#FFF2EF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    color: '#C2410C',
    fontSize: 14,
    lineHeight: 22,
  },
  successBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B7E4D3',
    backgroundColor: '#ECFDF6',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  successText: {
    color: TEAL,
    fontSize: 14,
    lineHeight: 22,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: TEAL,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkText: {
    color: TEAL,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    backgroundColor: WHITE,
  },
  dividerLine: {
    height: 1,
    flex: 1,
    backgroundColor: INPUT_BORDER,
  },
  captionText: {
    color: CAPTION,
    fontSize: 14,
  },
  googleButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: WHITE,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonText: {
    color: HEADING,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  helperText: {
    color: CAPTION,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  bottomBlock: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 32,
    backgroundColor: WHITE,
  },
  bottomPrompt: {
    color: BODY,
    fontSize: 14,
  },
  bottomPromptAccent: {
    color: TEAL,
    fontWeight: '600',
  },
});
