export type RecordingStatusUpdate = (status: any) => void;

export type RecordingLike = {
  prepareToRecordAsync: (options?: any) => Promise<any>;
  setOnRecordingStatusUpdate: (callback: RecordingStatusUpdate | null) => void;
  startAsync: () => Promise<any>;
  pauseAsync: () => Promise<any>;
  stopAndUnloadAsync: () => Promise<any>;
  getURI: () => string | null;
};

export type RecordingAudioModeSetter = (mode: {
  allowsRecordingIOS?: boolean;
  playsInSilentModeIOS?: boolean;
  staysActiveInBackground?: boolean;
  shouldDuckAndroid?: boolean;
}) => Promise<void>;

export type StartRecordingDependencies<TRecording extends RecordingLike> = {
  requestPermission: () => Promise<boolean>;
  setAudioMode: RecordingAudioModeSetter;
  createRecording: () => TRecording;
  recordingOptions: unknown;
  onStatusUpdate: RecordingStatusUpdate;
};

export type StopRecordingDependencies<TRecording extends RecordingLike> = {
  recording: TRecording;
  durationMillis: number;
  persistRecordingLocally: (sourceUri: string) => Promise<{ localUri: string; fileSizeBytes: number | null }>;
};

export class RecordingPermissionError extends Error {
  constructor() {
    super('Microphone permission is required to start recording.');
    this.name = 'RecordingPermissionError';
  }
}

export class RecordingInputDeviceError extends Error {
  constructor() {
    super('No microphone was detected in this environment.');
    this.name = 'RecordingInputDeviceError';
  }
}

export async function startRecordingSession<TRecording extends RecordingLike>({
  requestPermission,
  setAudioMode,
  createRecording,
  recordingOptions,
  onStatusUpdate,
}: StartRecordingDependencies<TRecording>): Promise<TRecording> {
  const granted = await requestPermission();
  if (!granted) {
    throw new RecordingPermissionError();
  }

  await setAudioMode({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
  });

  const recording = createRecording();

  try {
    await recording.prepareToRecordAsync(recordingOptions);
    recording.setOnRecordingStatusUpdate(onStatusUpdate);
    await recording.startAsync();
    return recording;
  } catch (error) {
    const normalizedError = normalizeRecordingError(error);
    recording.setOnRecordingStatusUpdate(null);
    throw normalizedError;
  }
}

export async function toggleRecordingPause<TRecording extends Pick<RecordingLike, 'pauseAsync' | 'startAsync'>>(
  recording: TRecording,
  isPaused: boolean,
): Promise<boolean> {
  if (isPaused) {
    await recording.startAsync();
    return false;
  }

  await recording.pauseAsync();
  return true;
}

export async function stopRecordingSession<TRecording extends RecordingLike>({
  recording,
  durationMillis,
  persistRecordingLocally,
}: StopRecordingDependencies<TRecording>) {
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  if (!uri) {
    throw new Error('Recording finished without a file URI');
  }

  const persisted = await persistRecordingLocally(uri);

  return {
    ...persisted,
    durationSeconds: Math.max(1, Math.round(durationMillis / 1000)),
  };
}

export function buildRecordingErrorMessage(error: unknown) {
  if (error instanceof RecordingPermissionError) {
    return error.message;
  }

  if (error instanceof RecordingInputDeviceError) {
    return 'No microphone was detected in this environment. Please test Memvo on a physical device or a browser with an available microphone.';
  }

  const rawMessage = error instanceof Error ? error.message : '';
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.includes('requested device not found') || normalizedMessage.includes('no microphone')) {
    return 'No microphone was detected in this environment. Please test Memvo on a physical device or a browser with an available microphone.';
  }

  if (normalizedMessage.includes('permission') || normalizedMessage.includes('notallowederror')) {
    return 'Microphone permission is required to start recording.';
  }

  return 'Memvo could not start or control the microphone recording session on this device.';
}

export function normalizeRecordingError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const name = error instanceof Error ? error.name.toLowerCase() : '';

  if (name.includes('notfound') || message.includes('requested device not found') || message.includes('no microphone')) {
    return new RecordingInputDeviceError();
  }

  if (name.includes('notallowed') || message.includes('permission')) {
    return new RecordingPermissionError();
  }

  return error instanceof Error ? error : new Error('Unknown recording error');
}
