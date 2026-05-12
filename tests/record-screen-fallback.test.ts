import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const recordScreenSource = readFileSync(path.resolve(process.cwd(), 'app/(tabs)/record.tsx'), 'utf-8');
const speechSource = readFileSync(path.resolve(process.cwd(), 'lib/memvo-speech.ts'), 'utf-8');

describe('Record screen Expo Go fallback', () => {
  it('wraps speech-recognition resolution in a try/catch', () => {
    expect(recordScreenSource).toContain('try {');
    expect(recordScreenSource).toContain("return !resolveSpeechRecognitionApi(Platform.OS, () => require('expo-speech-recognition'));");
    expect(recordScreenSource).toContain("console.warn('Speech recognition module is not available in this runtime.', error);");
    expect(recordScreenSource).toContain('return true;');
  });

  it('uses the shared development-build fallback message', () => {
    expect(recordScreenSource).toContain('MEMVO_PREVIEW_SPEECH_MESSAGE');
    expect(speechSource).toContain('Speech recognition requires the full app build. A development build is being prepared.');
  });
});
