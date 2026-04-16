import { describe, expect, it, vi } from 'vitest';

import { MEMVO_PREVIEW_SPEECH_MESSAGE, resolveSpeechRecognitionApi } from '../lib/memvo-speech';

describe('resolveSpeechRecognitionApi', () => {
  it('returns null on web without calling the native loader', () => {
    const loader = vi.fn(() => {
      throw new Error('loader should not run on web');
    });

    const result = resolveSpeechRecognitionApi('web', loader as never);

    expect(result).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it('returns null and warns when the native module is unavailable', () => {
    const warn = vi.fn();
    const loader = vi.fn(() => {
      throw new Error('Cannot find native module');
    });

    const result = resolveSpeechRecognitionApi('ios', loader as never, warn);

    expect(result).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns null when the runtime returns an incomplete module shape', () => {
    const warn = vi.fn();

    const result = resolveSpeechRecognitionApi(
      'ios',
      () =>
        ({
          ExpoSpeechRecognitionModule: {},
        }) as never,
      warn,
    );

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns null when the native availability check itself throws in preview mode', () => {
    const warn = vi.fn();

    const result = resolveSpeechRecognitionApi(
      'ios',
      () =>
        ({
          ExpoSpeechRecognitionModule: {
            start: vi.fn(),
          },
          addSpeechRecognitionListener: vi.fn(() => ({ remove: vi.fn() })),
          supportsOnDeviceRecognition: vi.fn(() => {
            throw new Error(MEMVO_PREVIEW_SPEECH_MESSAGE);
          }),
        }) as never,
      warn,
    );

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns the speech API when the runtime provides it', () => {
    const api = {
      ExpoSpeechRecognitionModule: {
        start: vi.fn(),
      },
      addSpeechRecognitionListener: vi.fn(() => ({ remove: vi.fn() })),
      supportsOnDeviceRecognition: vi.fn(() => true),
    };

    const result = resolveSpeechRecognitionApi('ios', () => api as never);

    expect(result).toBe(api);
  });
});
