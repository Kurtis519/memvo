export type SpeechRecognitionApi = {
  ExpoSpeechRecognitionModule: {
    start: (options: unknown) => void;
  };
  addSpeechRecognitionListener: (eventName: string, listener: (event: unknown) => void) => { remove: () => void };
  supportsOnDeviceRecognition: () => boolean;
};

export function resolveSpeechRecognitionApi(
  platformOS: string,
  loader: () => SpeechRecognitionApi,
  warn: (message: string, error: unknown) => void = console.warn,
): SpeechRecognitionApi | null {
  if (platformOS === 'web') {
    return null;
  }

  try {
    return loader();
  } catch (error) {
    warn('Speech recognition module unavailable in this runtime.', error);
    return null;
  }
}
