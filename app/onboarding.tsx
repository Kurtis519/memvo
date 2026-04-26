import { useMemo, useRef, useState } from 'react';
import type { FlatList as FlatListType, ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlatList, Pressable, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';

import { ScreenContainer } from '@/components/screen-container';
import { writeHasSeenOnboarding } from '@/lib/memvo-auth-flow';

type OnboardingSlide = {
  id: string;
  headline: string;
  subtext?: string;
  tagline?: string;
  features?: Array<{
    emoji: string;
    title: string;
    description: string;
  }>;
  pricing?: Array<{
    name: string;
    detail: string;
    helper: string;
  }>;
};

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    headline: 'Memvo',
    tagline: 'Your voice. Your memory. Your privacy.',
    subtext: 'Record, transcribe and organise your thoughts — privately.',
  },
  {
    id: 'features',
    headline: "Everything you need. Nothing you don't.",
    features: [
      {
        emoji: '🎙',
        title: 'Bot-free recording',
        description: 'No bots join your calls. Your mic only.',
      },
      {
        emoji: '🌍',
        title: '100+ languages (Pro)',
        description: 'Whisper-powered transcription in any language.',
      },
      {
        emoji: '🔒',
        title: 'Audio deleted instantly',
        description: 'We transcribe it then delete it. Always.',
      },
    ],
  },
  {
    id: 'pricing',
    headline: 'Simple, honest pricing.',
    pricing: [
      {
        name: 'Free',
        detail: '120 min/month',
        helper: 'On-device transcription · AI summaries',
      },
      {
        name: 'Pro',
        detail: '$8.99/month',
        helper: 'Unlimited · Whisper 99+ languages · All AI features',
      },
    ],
    subtext: 'No hidden fees. No surprise charges. Cancel anytime.',
  },
];

function ProgressDots({ currentIndex }: { currentIndex: number }) {
  return (
    <View className="flex-row items-center gap-2">
      {SLIDES.map((slide, index) => (
        <View
          key={slide.id}
          className={`h-2.5 rounded-full ${index === currentIndex ? 'w-6 bg-primary' : 'w-2.5 bg-border'}`}
        />
      ))}
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

  const renderSlide = ({ item }: ListRenderItemInfo<OnboardingSlide>) => (
    <View style={{ width: slideWidth }} className="flex-1 pr-4">
      <View className="flex-1 rounded-[32px] border border-[#E6E6E6] bg-[#FFFFFF] px-6 py-7">
        {item.id === 'welcome' ? (
          <View className="flex-1 justify-between">
            <View className="items-center pt-4">
              <View className="h-24 w-24 items-center justify-center rounded-[28px] bg-primary">
                <Text className="text-5xl font-bold text-white">M</Text>
              </View>
              <Text className="mt-8 text-4xl font-bold text-[#1A1A1A]">{item.headline}</Text>
              <Text className="mt-5 text-center text-2xl font-semibold leading-9 text-[#1A1A1A]">{item.tagline}</Text>
              <Text className="mt-4 text-center text-base leading-7 text-[#555555]">{item.subtext}</Text>
            </View>

            <View className="rounded-[28px] border border-[#D9D9D9] bg-[#FFFFFF] px-5 py-5">
              <Text className="text-sm font-semibold uppercase tracking-[1.2px] text-[#888888]">Built for calm capture</Text>
              <Text className="mt-3 text-base leading-7 text-[#555555]">
                Keep thoughts moving with one-handed recording, fast summaries, and privacy settings that stay visible.
              </Text>
            </View>
          </View>
        ) : null}

        {item.id === 'features' ? (
          <View className="flex-1 justify-between">
            <View>
              <Text className="text-3xl font-bold leading-10 text-[#1A1A1A]">{item.headline}</Text>
              <Text className="mt-3 text-base leading-7 text-[#555555]">
                Memvo focuses on the essentials so every recording feels private, clear, and easy to revisit later.
              </Text>
            </View>

            <View className="mt-8 gap-4">
              {item.features?.map((feature) => (
                <View key={feature.title} className="rounded-[24px] border border-[#E6E6E6] bg-[#FFFFFF] px-5 py-5">
                  <View className="flex-row items-start gap-4">
                    <Text className="text-2xl">{feature.emoji}</Text>
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-semibold text-[#1A1A1A]">{feature.title}</Text>
                      <Text className="text-sm leading-6 text-[#555555]">{feature.description}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {item.id === 'pricing' ? (
          <View className="flex-1 justify-between">
            <View>
              <Text className="text-3xl font-bold leading-10 text-[#1A1A1A]">{item.headline}</Text>
              <Text className="mt-3 text-base leading-7 text-[#555555]">{item.subtext}</Text>
            </View>

            <View className="mt-8 flex-row gap-4">
              {item.pricing?.map((plan) => (
                <View key={plan.name} className={`flex-1 rounded-[28px] border px-4 py-5 ${plan.name === 'Pro' ? 'border-[#0F6E56] bg-[#FFFFFF]' : 'border-[#E6E6E6] bg-[#FFFFFF]'}`}>
                  <Text className={`text-sm font-semibold uppercase tracking-[1.1px] ${plan.name === 'Pro' ? 'text-[#0F6E56]' : 'text-[#888888]'}`}>
                    {plan.name}
                  </Text>
                  <Text className={`mt-4 text-2xl font-bold leading-8 ${plan.name === 'Pro' ? 'text-[#1A1A1A]' : 'text-[#1A1A1A]'}`}>
                    {plan.detail}
                  </Text>
                  <Text className={`mt-3 text-sm leading-6 ${plan.name === 'Pro' ? 'text-[#555555]' : 'text-[#555555]'}`}>
                    {plan.helper}
                  </Text>
                </View>
              ))}
            </View>

            <View className="rounded-[28px] border border-[#E6E6E6] bg-[#FFFFFF] px-5 py-5">
              <Text className="text-sm leading-6 text-[#888888]">
                No ads — ever. Your plan changes stay visible inside Settings, and you can upgrade only when Memvo is actually helping.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-[#FFFFFF] px-5 pt-4 pb-6">
      <View className="flex-1 justify-between">
        <View className="gap-5">
          <Text className="text-sm font-semibold uppercase tracking-[1.6px] text-[#0F6E56]">First-time setup</Text>
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

        <View className="gap-4 pt-5">
          <View className="flex-row items-center justify-between">
            <ProgressDots currentIndex={currentIndex} />
            <Text className="text-sm font-medium text-[#888888]">{currentIndex + 1} / {SLIDES.length}</Text>
          </View>

          <View className="flex-row items-center justify-between gap-3">
            <Pressable
              accessibilityRole="button"
              disabled={currentIndex === 0}
              onPress={() => goToIndex(currentIndex - 1)}
              className={`rounded-full px-5 py-4 ${currentIndex === 0 ? 'bg-[#F0F0F0]' : 'bg-[#F0F0F0] border border-[#D9D9D9]'}`}
            >
              <Text className={`text-sm font-semibold ${currentIndex === 0 ? 'text-[#888888]' : 'text-[#333333]'}`}>Back</Text>
            </Pressable>

            {currentIndex === lastIndex ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => {
                  void handleGetStarted();
                }}
                className="rounded-full bg-[#0F6E56] px-6 py-4"
              >
                <Text className="text-sm font-semibold text-white">Get started</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => goToIndex(currentIndex + 1)}
                className="rounded-full bg-[#0F6E56] px-6 py-4"
              >
                <Text className="text-sm font-semibold text-white">Next</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
