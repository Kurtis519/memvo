import { useMemo, useRef, useState } from 'react';
import type { FlatList as FlatListType, ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { writeHasSeenOnboarding } from '@/lib/memvo-auth-flow';

type OnboardingSlide = {
  id: string;
};

const SLIDES: OnboardingSlide[] = [{ id: 'welcome' }, { id: 'features' }, { id: 'pricing' }];

function ProgressDots({ currentIndex }: { currentIndex: number }) {
  return (
    <View style={styles.progressDotsRow}>
      {SLIDES.map((slide, index) => (
        <View
          key={slide.id}
          style={index === currentIndex ? styles.progressDotActive : styles.progressDotInactive}
        />
      ))}
    </View>
  );
}

function WelcomeSlide() {
  return (
    <View style={styles.slideContentCentered}>
      <View style={styles.heroCircle}>
        <Text style={styles.heroCircleText}>M</Text>
      </View>
      <Text style={styles.welcomeHeading}>Your voice. Your memory. Your privacy.</Text>
      <Text style={styles.welcomeBody}>Record, transcribe and organise your thoughts — privately.</Text>
    </View>
  );
}

function FeatureRow({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIconCircle}>
        <Text style={styles.featureEmoji}>{emoji}</Text>
      </View>
      <View style={styles.featureTextBlock}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

function FeaturesSlide() {
  return (
    <View style={styles.slideContentTopAligned}>
      <Text style={styles.sectionHeading}>Everything you need. Nothing you don't.</Text>
      <FeatureRow emoji="🎙" title="Bot-free recording" description="No bots join your calls. Your mic only." />
      <FeatureRow emoji="🌍" title="100+ languages (Pro)" description="Whisper-powered transcription in any language." />
      <FeatureRow emoji="🔒" title="Audio deleted instantly" description="We transcribe it then delete it. Always." />
    </View>
  );
}

function PricingCard({
  name,
  details,
  highlighted,
}: {
  name: string;
  details: string;
  highlighted?: boolean;
}) {
  return (
    <View style={highlighted ? styles.pricingCardPro : styles.pricingCardFree}>
      <Text style={highlighted ? styles.pricingCardProTitle : styles.pricingCardFreeTitle}>{name}</Text>
      <Text style={highlighted ? styles.pricingCardProBody : styles.pricingCardFreeBody}>{details}</Text>
    </View>
  );
}

function PricingSlide() {
  return (
    <View style={styles.slideContentTopAligned}>
      <Text style={styles.sectionHeading}>Simple, honest pricing.</Text>
      <View style={styles.pricingRow}>
        <PricingCard
          name="Free"
          details="120 min/month, On-device transcription, AI summaries"
        />
        <PricingCard
          name="Pro"
          details="$8.99/month, Unlimited, 99+ languages, All AI features"
          highlighted
        />
      </View>
      <Text style={styles.pricingCaption}>No hidden fees. No surprise charges. Cancel anytime.</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatListType<OnboardingSlide> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const lastIndex = SLIDES.length - 1;

  const slideWidth = useMemo(() => Math.max(width - 40, 280), [width]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setCurrentIndex(Math.min(lastIndex, Math.max(0, nextIndex)));
  };

  const goToIndex = (nextIndex: number) => {
    const safeIndex = Math.min(lastIndex, Math.max(0, nextIndex));
    setCurrentIndex(safeIndex);
    listRef.current?.scrollToIndex({
      index: safeIndex,
      animated: true,
    });
  };

  const handleGetStarted = async () => {
    await writeHasSeenOnboarding(true);
    router.replace('/signup' as Parameters<typeof router.replace>[0]);
  };

  const renderSlide = ({ item }: ListRenderItemInfo<OnboardingSlide>) => {
    let content: React.ReactElement | null = null;

    if (item.id === 'welcome') {
      content = <WelcomeSlide />;
    }

    if (item.id === 'features') {
      content = <FeaturesSlide />;
    }

    if (item.id === 'pricing') {
      content = <PricingSlide />;
    }

    return (
      <View style={[styles.slideOuter, { width: slideWidth }]}>
        <View style={styles.slideCard}>{content}</View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.topSection}>
          <Text style={styles.setupLabel}>FIRST-TIME SETUP</Text>
          <FlatList
            ref={listRef}
            data={SLIDES}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={renderSlide}
            onMomentumScrollEnd={handleScrollEnd}
            getItemLayout={(_data, index) => ({
              length: slideWidth,
              offset: slideWidth * index,
              index,
            })}
          />
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.progressRow}>
            <ProgressDots currentIndex={currentIndex} />
            <Text style={styles.progressText}>
              {currentIndex + 1} / {SLIDES.length}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              disabled={currentIndex === 0}
              onPress={() => goToIndex(currentIndex - 1)}
              style={currentIndex === 0 ? styles.backButtonDisabled : styles.backButton}
            >
              <Text style={currentIndex === 0 ? styles.backButtonTextDisabled : styles.backButtonText}>Back</Text>
            </Pressable>

            {currentIndex === lastIndex ? (
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={() => void handleGetStarted()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Get started</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={() => goToIndex(currentIndex + 1)} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Next</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  topSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  setupLabel: {
    color: '#0F6E56',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 20,
  },
  slideOuter: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingRight: 16,
  },
  slideCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  slideContentCentered: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  slideContentTopAligned: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 32,
    justifyContent: 'center',
  },
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0F6E56',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  heroCircleText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  welcomeHeading: {
    color: '#1A1A1A',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeBody: {
    color: '#555555',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  sectionHeading: {
    color: '#1A1A1A',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  featureIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureEmoji: {
    color: '#1A1A1A',
    fontSize: 18,
  },
  featureTextBlock: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  featureTitle: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDescription: {
    color: '#555555',
    fontSize: 14,
    lineHeight: 20,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  pricingCardFree: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
  },
  pricingCardPro: {
    flex: 1,
    backgroundColor: '#E1F5EE',
    borderRadius: 12,
    padding: 16,
  },
  pricingCardFreeTitle: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  pricingCardProTitle: {
    color: '#0F6E56',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  pricingCardFreeBody: {
    color: '#555555',
    fontSize: 13,
    lineHeight: 20,
  },
  pricingCardProBody: {
    color: '#085041',
    fontSize: 13,
    lineHeight: 20,
  },
  pricingCaption: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
  },
  bottomSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  progressDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  progressDotActive: {
    width: 24,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0F6E56',
  },
  progressDotInactive: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#D9D9D9',
  },
  progressText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButtonDisabled: {
    backgroundColor: '#F0F0F0',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButtonText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
  },
  backButtonTextDisabled: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#0F6E56',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
