# Requested Memvo File Contents

The project uses Expo Router, so the closest equivalents to the requested paths are included below.

| Requested file | Included file |
| --- | --- |
| `App.tsx` or `app/index.tsx` | `app/index.tsx` |
| `src/screens/OnboardingScreen.tsx` | `app/onboarding.tsx` |
| `src/screens/SignupScreen.tsx` | `app/signup.tsx` |
| `src/navigation/index.tsx` or `AppNavigator.tsx` | `app/_layout.tsx` |
| `app.config.ts` | `app.config.ts` |
| `src/lib/supabase.ts` | `lib/supabase.ts` |

## `app/index.tsx`

```tsx
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { readHasSeenOnboarding, recoverPendingSignupTransition } from '@/lib/memvo-auth-flow';
import { getEntryTarget } from '@/lib/memvo-auth-routing';

export default function IndexRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [shouldResumeSignup, setShouldResumeSignup] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([readHasSeenOnboarding(), recoverPendingSignupTransition()])
      .then(([value, recovery]) => {
        if (isMounted) {
          setHasSeenOnboarding(value);
          setShouldResumeSignup(recovery.shouldResumeSignup);

          if (recovery.clearedCorruptedState) {
            console.warn('Memvo cleared an interrupted onboarding transition before startup routing.');
          }
        }
      })
      .catch((error) => {
        console.error('Memvo startup state recovery failed:', error);
        if (isMounted) {
          setHasSeenOnboarding(false);
          setShouldResumeSignup(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const target = shouldResumeSignup && !isAuthenticated
      ? '/signup'
      : getEntryTarget({
          isAuthenticated,
          hasSeenOnboarding,
        });

    if (!target) {
      return;
    }

    console.log('Memvo startup navigation target', {
      isAuthenticated,
      hasSeenOnboarding,
      shouldResumeSignup,
      target,
    });

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.replace(target);
        return;
      }

      router.replace(target as Parameters<typeof router.replace>[0]);
    } catch (error) {
      console.error('Memvo startup navigation error:', error);
    }
  }, [hasSeenOnboarding, isAuthenticated, router, shouldResumeSignup]);

  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <Text style={styles.loadingEyebrow}>Memvo</Text>
        <Text style={styles.loadingTitle}>Preparing your space</Text>
        <Text style={styles.loadingBody}>
          We are checking whether to continue onboarding, return you to sign in, or open your library.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 384,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  loadingEyebrow: {
    color: '#0F6E56',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3.3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  loadingTitle: {
    marginTop: 16,
    color: '#1A1A1A',
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingBody: {
    marginTop: 12,
    color: '#555555',
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
  },
});

```

## `app/onboarding.tsx`

```tsx
import { router, useRootNavigationState } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from 'react-native';

import { clearPendingSignupTransition, writeHasSeenOnboarding, writePendingSignupTransition } from '@/lib/memvo-auth-flow';

type SlideIndex = 0 | 1 | 2;

function FeatureRow({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#E1F5EE',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 16,
        }}
      >
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 }}>{title}</Text>
        <Text style={{ fontSize: 14, color: '#555555', lineHeight: 20 }}>{description}</Text>
      </View>
    </View>
  );
}

function PricingCard({
  title,
  body,
  backgroundColor,
  titleColor,
  bodyColor,
}: {
  title: string;
  body: string;
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 18,
        minHeight: 172,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: titleColor, marginBottom: 10 }}>{title}</Text>
      <Text style={{ fontSize: 14, color: bodyColor, lineHeight: 21 }}>{body}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const rootNavigationState = useRootNavigationState();
  const [currentSlide, setCurrentSlide] = useState<SlideIndex>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const slideContent = useMemo(() => {
    if (currentSlide === 0) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            backgroundColor: '#FFFFFF',
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#0F6E56',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' }}>M</Text>
          </View>
          <Text
            style={{
              fontSize: 26,
              fontWeight: 'bold',
              color: '#1A1A1A',
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            Your voice. Your memory. Your privacy.
          </Text>
          <Text style={{ fontSize: 16, color: '#555555', textAlign: 'center', lineHeight: 24 }}>
            Record, transcribe and organise your thoughts — privately.
          </Text>
        </View>
      );
    }

    if (currentSlide === 1) {
      return (
        <View style={{ flex: 1, padding: 32, backgroundColor: '#FFFFFF', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 28 }}>
            Everything you need. Nothing you don't.
          </Text>
          <FeatureRow
            emoji="🎙"
            title="Bot-free recording"
            description="No bots join your calls. Your mic only."
          />
          <FeatureRow
            emoji="🌍"
            title="100+ languages (Pro)"
            description="Whisper-powered transcription in any language."
          />
          <FeatureRow
            emoji="🔒"
            title="Audio deleted instantly"
            description="We transcribe it then delete it. Always."
          />
        </View>
      );
    }

    return (
      <View style={{ flex: 1, padding: 32, backgroundColor: '#FFFFFF', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 24 }}>
          Simple, honest pricing.
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <PricingCard
            title="Free"
            body="120 min/month, On-device transcription, AI summaries"
            backgroundColor="#F5F5F5"
            titleColor="#1A1A1A"
            bodyColor="#555555"
          />
          <PricingCard
            title="Pro"
            body="$8.99/month, Unlimited, 99+ languages, All AI features"
            backgroundColor="#E1F5EE"
            titleColor="#0F6E56"
            bodyColor="#085041"
          />
        </View>
        <Text style={{ fontSize: 13, color: '#888888', textAlign: 'center', marginTop: 20, lineHeight: 19 }}>
          No hidden fees. No surprise charges. Cancel anytime.
        </Text>
      </View>
    );
  }, [currentSlide]);

  const handleBack = () => {
    if (currentSlide === 0) {
      return;
    }

    setCurrentSlide((previous) => (previous === 2 ? 1 : 0));
  };

  const availableRoutes = useMemo(
    () => [
      ...new Set([
        ...(rootNavigationState?.routeNames ?? []),
        ...(rootNavigationState?.routes?.map((route) => route.name) ?? []),
      ]),
    ],
    [rootNavigationState],
  );

  const handleNext = async () => {
    if (currentSlide < 2) {
      setCurrentSlide((previous) => (previous === 0 ? 1 : 2));
      return;
    }

    const navigationSnapshot = {
      key: rootNavigationState?.key ?? null,
      index: rootNavigationState?.index ?? null,
      routeNames: availableRoutes,
      currentRoutes: rootNavigationState?.routes?.map((route) => route.name) ?? [],
      target: '/signup',
    };

    console.log('Memvo onboarding navigation state', navigationSnapshot);
    setNavigationError(null);
    setIsSubmitting(true);

    try {
      await writePendingSignupTransition();
      await writeHasSeenOnboarding(true);
      console.log('Memvo onboarding routes available for Get started', availableRoutes);
      router.replace('/signup' as Parameters<typeof router.replace>[0]);
    } catch (error) {
      console.error('Navigation error:', error);
      console.error('Memvo onboarding route snapshot:', navigationSnapshot);
      await clearPendingSignupTransition().catch((clearError) => {
        console.error('Memvo could not clear the pending signup transition after a navigation failure:', clearError);
      });
      setNavigationError('We could not open the sign up screen just yet. Please tap Get started again.');
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
        <Text
          style={{
            color: '#0F6E56',
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: 1.8,
            marginBottom: 16,
          }}
        >
          FIRST-TIME SETUP
        </Text>

        <View
          style={{
            flex: 1,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: '#E6E6E6',
            backgroundColor: '#FFFFFF',
            overflow: 'hidden',
          }}
        >
          {slideContent}
        </View>

        <View style={{ marginTop: 20, backgroundColor: '#FFFFFF' }}>
          {navigationError ? (
            <View
              style={{
                marginBottom: 16,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#F3CFCF',
                backgroundColor: '#FFF7F7',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Text style={{ color: '#8A1F1F', fontSize: 13, fontWeight: '600', lineHeight: 20 }}>{navigationError}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  style={{
                    width: currentSlide === index ? 24 : 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: currentSlide === index ? '#0F6E56' : '#D9D9D9',
                    marginRight: index === 2 ? 0 : 8,
                  }}
                />
              ))}
            </View>
            <Text style={{ fontSize: 14, color: '#888888' }}>{currentSlide + 1} / 3</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              accessibilityRole="button"
              onPress={handleBack}
              style={{
                backgroundColor: '#F0F0F0',
                borderRadius: 999,
                paddingHorizontal: 20,
                paddingVertical: 16,
                opacity: currentSlide === 0 ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#333333', fontSize: 14, fontWeight: '600' }}>Back</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void handleNext();
              }}
              style={{
                backgroundColor: '#0F6E56',
                borderRadius: 999,
                paddingHorizontal: currentSlide === 2 ? 22 : 28,
                paddingVertical: 16,
                minWidth: currentSlide === 2 ? 132 : 108,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isSubmitting ? 0.78 : 1,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
                  {currentSlide === 2 ? 'Get started' : 'Next'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

```

## `app/signup.tsx`

```tsx
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

import { MemvoErrorBoundary } from '@/components/error-boundary';
import { ScreenContainer } from '@/components/screen-container';
import { useGoogleSignIn } from '@/lib/google-auth';
import { clearPendingSignupTransition } from '@/lib/memvo-auth-flow';
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

function GoogleSignupButton({
  onSignedIn,
  onError,
}: {
  onSignedIn: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const { startGoogleSignIn, configStatus, isGoogleReady } = useGoogleSignIn();

  const googleButtonDisabled = isGoogleSubmitting || (Platform.OS !== 'web' && !isGoogleReady);
  const googleUnavailableMessage = useMemo(() => {
    if (Platform.OS === 'web' || configStatus.hasNativeClientIds) {
      return null;
    }

    return `Google Sign-In needs ${configStatus.missingNativeClientIds.join(', ')} in this build.`;
  }, [configStatus.hasNativeClientIds, configStatus.missingNativeClientIds]);

  const handleGoogleAuth = async () => {
    console.log('Memvo signup Google auth status', {
      platform: Platform.OS,
      hasNativeClientIds: configStatus.hasNativeClientIds,
      missingNativeClientIds: configStatus.missingNativeClientIds,
      isGoogleReady,
    });

    setIsGoogleSubmitting(true);
    onError(null);

    try {
      const result = await startGoogleSignIn();
      if (!result.cancelled && !result.redirected) {
        await onSignedIn();
      }
    } catch (error) {
      console.error('Memvo signup Google auth error:', error);
      onError(error instanceof Error ? error.message : 'Google Sign-In failed. Please try again.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <>
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
    </>
  );
}

function SignupScreenContent() {
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
    void clearPendingSignupTransition().catch((error) => {
      console.error('Memvo could not clear the pending signup transition on signup mount:', error);
    });
  }, []);

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

                  <MemvoErrorBoundary
                    scope="Signup Google section"
                    variant="inline"
                    title="Google Sign-In is temporarily unavailable"
                    body="Email sign up still works in this build while we log the native Google auth error."
                  >
                    <GoogleSignupButton
                      onSignedIn={finishSignedInFlow}
                      onError={(message) => {
                        setAuthError(message);
                        setCheckEmailAddress(null);
                      }}
                    />
                  </MemvoErrorBoundary>
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

export default function SignupScreen() {
  return (
    <MemvoErrorBoundary
      scope="Signup screen"
      title="Memvo could not open sign up"
      body="We caught a screen error instead of letting the app crash. Please reopen the app and try again."
    >
      <SignupScreenContent />
    </MemvoErrorBoundary>
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

```

## `app/_layout.tsx`

```tsx
import '@/global.css';
import '@/lib/_core/nativewind-pressable';
import { AuthGate } from '@/components/auth-gate';
import { initManusRuntime, subscribeSafeAreaInsets } from '@/lib/_core/manus-runtime';
import { MemvoProvider } from '@/lib/memvo-store';
import { ThemeProvider } from '@/lib/theme-provider';
import { trpc, createTRPCClient } from '@/lib/trpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
  type EdgeInsets,
  type Metrics,
  type Rect,
} from 'react-native-safe-area-context';

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore repeated splash prevention in development.
});

SplashScreen.setOptions({
  fade: true,
  duration: 180,
});

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <MemvoProvider>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="admin" />
                <Stack.Screen name="faq" />
                <Stack.Screen name="invite" />
                <Stack.Screen name="join" />
                <Stack.Screen name="login" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="paywall" />
                <Stack.Screen name="signup" />
                <Stack.Screen name="oauth/callback" />
              </Stack>
              <StatusBar style="auto" />
            </AuthGate>
          </MemvoProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  if (Platform.OS === 'web') {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>{content}</SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}

```

## `app.config.ts`

```ts
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

```

## `lib/supabase.ts`

```ts
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

type SupabaseRuntimeExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function resolveRuntimeExtra(): SupabaseRuntimeExtra {
  const expoConfigExtra = (Constants.expoConfig?.extra ?? {}) as SupabaseRuntimeExtra;
  const manifestExtra = ((Constants as typeof Constants & {
    manifest?: { extra?: SupabaseRuntimeExtra };
  }).manifest?.extra ?? {}) as SupabaseRuntimeExtra;
  const manifest2Extra = ((Constants as typeof Constants & {
    manifest2?: {
      extra?: SupabaseRuntimeExtra;
    };
  }).manifest2?.extra ?? {}) as SupabaseRuntimeExtra;
  const expoClientExtra = ((Constants as typeof Constants & {
    manifest2?: {
      extra?: {
        expoClient?: {
          extra?: SupabaseRuntimeExtra;
        };
      };
    };
  }).manifest2?.extra?.expoClient?.extra ?? {}) as SupabaseRuntimeExtra;

  return {
    ...manifestExtra,
    ...manifest2Extra,
    ...expoClientExtra,
    ...expoConfigExtra,
  };
}

const extra = resolveRuntimeExtra();

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL
  ?? process.env.SUPABASE_URL
  ?? extra.supabaseUrl
  ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ?? process.env.SUPABASE_ANON_KEY
  ?? extra.supabaseAnonKey
  ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const isWebBrowser = Platform.OS === 'web' && typeof window !== 'undefined';

const webStorage = {
  getItem: async (key: string) => {
    if (!isWebBrowser) {
      return null;
    }

    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (!isWebBrowser) {
      return;
    }

    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (!isWebBrowser) {
      return;
    }

    window.localStorage.removeItem(key);
  },
};

const authStorage = Platform.OS === 'web' ? webStorage : AsyncStorage;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWebBrowser,
    },
  },
);

```

