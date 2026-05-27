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
