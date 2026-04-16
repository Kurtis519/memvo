export const MEMVO_PREVIEW_SPEECH_MESSAGE =
  'Speech recognition is not available in preview mode. Install the development build to test transcription.';

export type SpeechRecognitionApi = {
  ExpoSpeechRecognitionModule: {
    start: (options: unknown) => void;
  };
  addSpeechRecognitionListener: (eventName: string, listener: (event: unknown) => void) => { remove: () => void };
  supportsOnDeviceRecognition: () => boolean;
};

function isSpeechRecognitionApi(value: unknown): value is SpeechRecognitionApi {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SpeechRecognitionApi>;
  return Boolean(
    candidate.ExpoSpeechRecognitionModule
      && typeof candidate.ExpoSpeechRecognitionModule.start === 'function'
      && typeof candidate.addSpeechRecognitionListener === 'function'
      && typeof candidate.supportsOnDeviceRecognition === 'function',
  );
}

export function resolveSpeechRecognitionApi(
  platformOS: string,
  loader: () => unknown,
  warn: (message: string, error: unknown) => void = console.warn,
): SpeechRecognitionApi | null {
  if (platformOS === 'web') {
    return null;
  }

  try {
    const candidate = loader();

    if (!isSpeechRecognitionApi(candidate)) {
      warn('Speech recognition module is not available in this runtime.', null);
      return null;
    }

    try {
      candidate.supportsOnDeviceRecognition();
    } catch (error) {
      warn('Speech recognition module is not available in this runtime.', error);
      return null;
    }

    return candidate;
  } catch (error) {
    warn('Speech recognition module is not available in this runtime.', error);
    return null;
  }
}
