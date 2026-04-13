import { describe, expect, it, vi } from 'vitest';

import {
  RecordingInputDeviceError,
  RecordingPermissionError,
  buildRecordingErrorMessage,
  normalizeRecordingError,
  startRecordingSession,
  stopRecordingSession,
  toggleRecordingPause,
  type RecordingLike,
} from '../lib/recording-controller';

function createRecordingMock(overrides: Partial<RecordingLike> = {}): RecordingLike {
  return {
    prepareToRecordAsync: vi.fn().mockResolvedValue(undefined),
    setOnRecordingStatusUpdate: vi.fn(),
    startAsync: vi.fn().mockResolvedValue(undefined),
    pauseAsync: vi.fn().mockResolvedValue(undefined),
    stopAndUnloadAsync: vi.fn().mockResolvedValue(undefined),
    getURI: vi.fn().mockReturnValue('file:///tmp/mock-recording.m4a'),
    ...overrides,
  };
}

describe('recording-controller', () => {
  it('starts a recording session after permission is granted', async () => {
    const recording = createRecordingMock();
    const requestPermission = vi.fn().mockResolvedValue(true);
    const setAudioMode = vi.fn().mockResolvedValue(undefined);
    const onStatusUpdate = vi.fn();

    const result = await startRecordingSession({
      requestPermission,
      setAudioMode,
      createRecording: () => recording,
      recordingOptions: { preset: 'memvo' },
      onStatusUpdate,
    });

    expect(result).toBe(recording);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(setAudioMode).toHaveBeenCalledWith({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });
    expect(recording.prepareToRecordAsync).toHaveBeenCalledWith({ preset: 'memvo' });
    expect(recording.setOnRecordingStatusUpdate).toHaveBeenCalledWith(onStatusUpdate);
    expect(recording.startAsync).toHaveBeenCalledTimes(1);
  });

  it('fails fast when permission is denied', async () => {
    await expect(
      startRecordingSession({
        requestPermission: vi.fn().mockResolvedValue(false),
        setAudioMode: vi.fn().mockResolvedValue(undefined),
        createRecording: () => createRecordingMock(),
        recordingOptions: undefined,
        onStatusUpdate: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(RecordingPermissionError);
  });

  it('normalizes missing microphone errors during start', async () => {
    await expect(
      startRecordingSession({
        requestPermission: vi.fn().mockResolvedValue(true),
        setAudioMode: vi.fn().mockResolvedValue(undefined),
        createRecording: () =>
          createRecordingMock({
            prepareToRecordAsync: vi.fn().mockRejectedValue(new Error('Requested device not found')),
          }),
        recordingOptions: undefined,
        onStatusUpdate: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(RecordingInputDeviceError);
  });

  it('toggles from recording to paused and back to recording', async () => {
    const recording = createRecordingMock();

    const pausedState = await toggleRecordingPause(recording, false);
    expect(pausedState).toBe(true);
    expect(recording.pauseAsync).toHaveBeenCalledTimes(1);

    const resumedState = await toggleRecordingPause(recording, true);
    expect(resumedState).toBe(false);
    expect(recording.startAsync).toHaveBeenCalledTimes(1);
  });

  it('stops, persists, and calculates duration in seconds', async () => {
    const recording = createRecordingMock();
    const persistRecordingLocally = vi.fn().mockResolvedValue({
      localUri: 'file:///memvo/recordings/recording-123.m4a',
      fileSizeBytes: 2048,
    });

    const result = await stopRecordingSession({
      recording,
      durationMillis: 4200,
      persistRecordingLocally,
    });

    expect(recording.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
    expect(persistRecordingLocally).toHaveBeenCalledWith('file:///tmp/mock-recording.m4a');
    expect(result).toEqual({
      localUri: 'file:///memvo/recordings/recording-123.m4a',
      fileSizeBytes: 2048,
      durationSeconds: 4,
    });
  });

  it('builds user-facing fallback messages for normalized errors', () => {
    expect(buildRecordingErrorMessage(new RecordingPermissionError())).toContain('Microphone permission');
    expect(buildRecordingErrorMessage(new RecordingInputDeviceError())).toContain('No microphone was detected');
    expect(buildRecordingErrorMessage(new Error('something else'))).toContain('could not start or control');
    expect(normalizeRecordingError(new Error('Requested device not found'))).toBeInstanceOf(RecordingInputDeviceError);
  });
});
