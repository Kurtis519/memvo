import { ScrollView, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';

const faqs = [
  {
    question: 'How does offline sync work?',
    answer:
      'Memvo keeps new recordings on your device first. When you reconnect, queued notes retry upload and processing automatically.',
  },
  {
    question: 'Why can I still record when preview mode transcription is unavailable?',
    answer:
      'Expo Go can store the recording safely even when native speech recognition is unavailable. Memvo marks those notes for deferred processing instead of crashing.',
  },
  {
    question: 'How do bonus referral minutes work?',
    answer:
      'Each successful referral adds 30 bonus minutes for you and 30 for your friend. Bonus minutes are added on top of the normal free monthly allowance.',
  },
  {
    question: 'What does Manual Pro mean?',
    answer:
      'Manual Pro is granted by the Memvo owner through the protected admin panel. It unlocks Pro features without a live store subscription.',
  },
  {
    question: 'Can I delete original audio automatically?',
    answer:
      'Yes. Memvo keeps audio deletion locked on so original voice files are not retained longer than necessary after processing completes.',
  },
  {
    question: 'What is included in Export my data?',
    answer:
      'The export contains one text file per note plus JSON metadata and referral history, bundled into a ZIP archive for download or sharing.',
  },
  {
    question: 'What happens when I delete my account?',
    answer:
      'Memvo removes your profile, folders, notes, referrals, queued recordings, and stored audio, then signs you out and returns you to onboarding.',
  },
  {
    question: 'Why do some billing controls say they are unavailable?',
    answer:
      'This build already understands free, Pro, admin, and Manual Pro states, but live store billing management only appears after the production billing connection is enabled.',
  },
] as const;

export default function FaqScreen() {
  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">FAQ</Text>
            <Text className="text-base leading-6 text-muted">
              Quick answers about privacy, sync, subscriptions, referrals, and account controls.
            </Text>
          </View>

          {faqs.map((faq) => (
            <View key={faq.question} className="rounded-[24px] border border-border bg-surface p-5">
              <Text className="text-base font-semibold text-foreground">{faq.question}</Text>
              <Text className="mt-3 text-sm leading-6 text-muted">{faq.answer}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
