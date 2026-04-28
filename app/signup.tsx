import { useEffect, useMemo, useState } from 'react';
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
import { processPendingReferralForCurrentUser, readPendingReferralCode } from '@/lib/memvo-referrals';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADING = '#1A1A1A';
const BODY = '#555555';
const CAPTION = '#888888';
const INPUT_BG = '#F5F5F5';
const INPUT_BORDER = '#E0E0E0';
const WHITE = '#FFFFFF';
const TEAL = '#0F6E56';

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
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const { startGoogleSignIn, configStatus, isGoogleReady } = useGoogleSignIn();

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

  const googleButtonDisabled = isGoogleSubmitting || (Platform.OS !== 'web' && !isGoogleReady);
  const googleUnavailableMessage = useMemo(() => {
    if (Platform.OS === 'web' || configStatus.hasNativeClientIds) {
      return null;
    }

    return `Google Sign-In needs ${configStatus.missingNativeClientIds.join(', ')} in this build.`;
  }, [configStatus.hasNativeClientIds, configStatus.missingNativeClientIds]);

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

  const handleGoogleAuth = async () => {
    setIsGoogleSubmitting(true);
    setAuthError(null);
    setCheckEmailAddress(null);

    try {
      const result = await startGoogleSignIn();
      if (!result.cancelled && !result.redirected) {
        await finishSignedInFlow();
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google Sign-In failed. Please try again.');
    } finally {
      setIsGoogleSubmitting(false);
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
                <Text style={styles.heading}>Create your account</Text>
                <Text style={styles.bodyText}>Start with private voice notes, calm organisation, and pricing that stays honest.</Text>
              </View>
            </View>

            {pendingReferralCode ? (
              <View style={styles.referralCard}>
                <Text style={styles.referralLabel}>Referral saved</Text>
                <Text style={styles.referralCode}>{pendingReferralCode}</Text>
                <Text style={styles.referralBody}>
                  Finish creating your account and Memvo will apply this referral automatically after signup.
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              {checkEmailAddress ? (
                <View style={styles.formStack}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.emailHeading}>Check your email</Text>
                    <Text style={styles.bodyTextLeft}>
                      We created your account for {checkEmailAddress}. Confirm your email to finish signing in if verification is enabled.
                    </Text>
                  </View>

                  {authError ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{authError}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={() => {
                      void handleResend();
                    }}
                    disabled={isResending}
                    style={[styles.primaryButton, isResending && styles.primaryButtonDisabled]}
                  >
                    {isResending ? <ActivityIndicator color={WHITE} /> : <Text style={styles.primaryButtonText}>Resend email</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={() => router.replace('/login' as Parameters<typeof router.replace>[0])}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Go to sign in</Text>
                  </TouchableOpacity>
                </View>
              ) : (
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
                        placeholder="At least 6 characters"
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!showPassword}
                        textContentType="newPassword"
                        placeholderTextColor={CAPTION}
                        style={styles.passwordInput}
                      />
                      <Pressable onPress={() => setShowPassword((current) => !current)}>
                        <Text style={styles.inlineActionText}>{showPassword ? 'Hide' : 'Show'}</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Full name</Text>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Your name"
                      autoCapitalize="words"
                      placeholderTextColor={CAPTION}
                      style={styles.input}
                    />
                  </View>

                  {authError ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{authError}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    onPress={() => {
                      void handleSignup();
                    }}
                    disabled={!canSubmit || isSubmitting}
                    style={[styles.primaryButton, (!canSubmit || isSubmitting) && styles.primaryButtonDisabled]}
                  >
                    {isSubmitting ? <ActivityIndicator color={WHITE} /> : <Text style={styles.primaryButtonText}>Sign up</Text>}
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

                  {googleUnavailableMessage ? <Text style={styles.helperText}>{googleUnavailableMessage}</Text> : null}
                </View>
              )}
            </View>
          </View>

          <View style={styles.bottomBlock}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => router.replace('/login' as Parameters<typeof router.replace>[0])}
            >
              <Text style={styles.bottomPrompt}>
                Already have an account? <Text style={styles.bottomPromptAccent}>Sign in</Text>
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
  referralCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#CFE7DE',
    backgroundColor: '#F5FBF8',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  referralLabel: {
    color: TEAL,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  referralCode: {
    color: HEADING,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 12,
  },
  referralBody: {
    color: BODY,
    fontSize: 14,
    lineHeight: 24,
    marginTop: 12,
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
  emailHeading: {
    color: HEADING,
    fontSize: 28,
    fontWeight: '700',
  },
  bodyTextLeft: {
    color: BODY,
    fontSize: 14,
    lineHeight: 24,
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
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: WHITE,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: HEADING,
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
