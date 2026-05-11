import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootLayoutSource = readFileSync(path.resolve(process.cwd(), 'app/_layout.tsx'), 'utf-8');

describe('Auth stack registration', () => {
  it('registers the signup route in the root stack', () => {
    expect(rootLayoutSource).toContain('<Stack.Screen name="signup" />');
  });

  it('registers the login route in the root stack', () => {
    expect(rootLayoutSource).toContain('<Stack.Screen name="login" />');
  });
});
