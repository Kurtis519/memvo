import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { useMemvo } from '@/lib/memvo-store';
import {
  MEMVO_AUDIO_DIRECTORY,
  MEMVO_PERMISSION_PROMPT_KEY,
  formatDuration,
  normalizeMeteringToBarHeight,
} from '@/lib/memvo-recording-utils';

const TEAL = '#0F6E56';
const BAR_COUNT = 28;

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/mp4',
    bitsPerSecond: 64000,
  },
};

async function ensureMicrophonePermission() {
  const promptShown = await AsyncStorage.getItem(MEMVO_PERMISSION_PROMPT_KEY);
  if (!promptShown) {
    Alert.alert(
      'Allow microphone access',
      'Memvo records private voice notes locally on your device first, then syncs them when you are connected.',
    );
    await AsyncStorage.setItem(MEMVO_PERMISSION_PROMPT_KEY, 'true');
  }

  const permission = await Audio.requestPermissionsAsync();
  return permission.granted;
}

async function persistRecordingLocally(sourceUri: string) {
  const directoryUri = `${FileSystem.documentDirectory}${MEMVO_AUDIO_DIRECTORY}`;
  const directoryInfo = await FileSystem.getInfoAsync(directoryUri);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  }

  const filename = `recording-${Date.now()}.m4a`;
  const destinationUri = `${directoryUri}/${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  const fileInfo = await FileSystem.getInfoAsync(destinationUri);

  return {
    localUri: destinationUri,
    fileSizeBytes: fileInfo.exists ? fileInfo.size ?? null : null,
  };
}

function Waveform({ samples }: { samples: number[] }) {
  return (
    <View className="mt-10 flex-row items-end justify-center gap-1 px-2">
      {samples.map((sample, index) => (
        <View
          key={`${index}-${sample}`}
          style={{
            width: 8,
            height: sample,
            borderRadius: 999,
            backgroundColor: index % 3 === 0 ? TEAL : '#9FD7C8',
            opacity: 0.95,
          }}
        />
      ))}
    </View>
  );
}

export default function RecordScreen() {
  useKeepAwake();
  const { addLocalRecording, isOnline } = useMemvo();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, (_, index) => 18 + ((index % 4) * 6)));
  const [isSaving, setIsSaving] = useState(false);

  const resetUI = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    setDurationMillis(0);
    setWaveform(Array.from({ length: BAR_COUNT }, (_, index) => 18 + ((index % 4) * 6)));
    recordingRef.current = null;
  }, []);

  const handleStatusUpdate = useCallback((status: Audio.RecordingStatus) => {
    setDurationMillis(status.durationMillis ?? 0);

    if (typeof status.metering === 'number' && !isPaused) {
      setWaveform((current) => {
        const next = current.slice(1);
        next.push(normalizeMeteringToBarHeight(status.metering, current.length));
        return next;
      });
    }
  }, [isPaused]);

  useEffect(() => {
    return () => {
      const activeRecording = recordingRef.current;
      if (activeRecording) {
        activeRecording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, []);

  const timerLabel = useMemo(() => formatDuration(durationMillis), [durationMillis]);

  const startRecording = useCallback(async () => {
    if (isSaving) {
      return;
    }

    const granted = await ensureMicrophonePermission();
    setHasPermission(granted);
    if (!granted) {
      Alert.alert('Microphone access needed', 'Please enable microphone access in system settings to record a voice note.');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      recording.setOnRecordingStatusUpdate(handleStatusUpdate);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
    } catch (error) {
      console.error('Unable to start recording', error);
      Alert.alert('Recording unavailable', 'Memvo could not start the microphone recording session on this device.');
    }
  }, [handleStatusUpdate, isSaving]);

  const pauseOrResumeRecording = useCallback(async () => {
    const activeRecording = recordingRef.current;
    if (!activeRecording) {
      return;
    }

    try {
      if (isPaused) {
        await activeRecording.startAsync();
        setIsPaused(false);
      } else {
        await activeRecording.pauseAsync();
        setIsPaused(true);
      }
    } catch (error) {
      console.error('Unable to toggle recording pause state', error);
      Alert.alert('Recording control unavailable', 'Memvo could not pause or resume the recording right now.');
    }
  }, [isPaused]);

  const stopRecording = useCallback(async () => {
    const activeRecording = recordingRef.current;
    if (!activeRecording) {
      return;
    }

    setIsSaving(true);
    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      if (!uri) {
        throw new Error('Recording finished without a file URI');
      }

      const persisted = await persistRecordingLocally(uri);
      await addLocalRecording({
        localUri: persisted.localUri,
        durationSeconds: Math.max(1, Math.round(durationMillis / 1000)),
        fileSizeBytes: persisted.fileSizeBytes,
      });

      resetUI();
      Alert.alert('Saved locally', 'Your voice note was stored on this device and queued for transcription.');
      router.replace('/');
    } catch (error) {
      console.error('Unable to stop recording', error);
      Alert.alert('Save failed', 'Memvo could not finish saving the voice note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [addLocalRecording, durationMillis, resetUI]);

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="bg-background px-5 pt-3 pb-6">
      <View className="flex-1 justify-between">
        <View className="gap-5">
          {!isOnline ? (
            <View className="rounded-2xl border border-[#D8EEE6] bg-[#EEF8F4] px-4 py-3">
              <Text className="text-sm font-medium text-[#0F6E56]">
                Recording offline — will sync and transcribe when connected
              </Text>
            </View>
          ) : null}

          <View className="items-center gap-3 pt-2">
            <Text className="text-sm font-medium uppercase tracking-[2px] text-muted">Recording</Text>
            <Text className="text-5xl font-bold text-foreground">{timerLabel}</Text>
            <Text className="text-sm text-muted">
              {isRecording ? (isPaused ? 'Paused' : 'Capturing audio locally') : 'Ready when you are'}
            </Text>
            {hasPermission === false ? (
              <Text className="text-center text-sm text-error">
                Microphone permission is required to start recording.
              </Text>
            ) : null}
          </View>

          <View className="rounded-[32px] border border-border bg-surface px-4 py-8">
            <Waveform samples={waveform} />
            <View className="mt-8 items-center">
              <View className="h-36 w-36 items-center justify-center rounded-full bg-[#0F6E56]">
                <View className="h-24 w-24 rounded-full bg-[#3C977A]" />
              </View>
            </View>
          </View>
        </View>

        <View className="gap-4 pb-4">
          {!isRecording ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void startRecording()}
              style={{
                minHeight: 58,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                backgroundColor: TEAL,
              }}
            >
              <Text className="text-base font-semibold text-white">Start recording</Text>
            </TouchableOpacity>
          ) : (
            <View className="flex-row items-center justify-center gap-4">
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => void pauseOrResumeRecording()}
                style={{
                  flex: 1,
                  minHeight: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#D5D9DD',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Text className="text-base font-semibold text-foreground">{isPaused ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => void stopRecording()}
                style={{
                  flex: 1,
                  minHeight: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  backgroundColor: TEAL,
                  opacity: isSaving ? 0.7 : 1,
                }}
                disabled={isSaving}
              >
                <Text className="text-base font-semibold text-white">{isSaving ? 'Saving…' : 'Stop'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
