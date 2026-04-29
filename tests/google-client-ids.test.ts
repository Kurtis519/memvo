import { describe, expect, it } from 'vitest';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

async function fetchAuthResponse(clientId: string) {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', 'http://localhost');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'consent');

  return fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'user-agent': 'Memvo Google OAuth validation test',
    },
  });
}

async function expectGoogleClientIdToBeRecognized(clientId: string) {
  expect(clientId).toMatch(/^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/);

  const response = await fetchAuthResponse(clientId);
  const body = (await response.text()).toLowerCase();

  expect(body).not.toContain('invalid_client');
  expect(body).not.toContain('deleted_client');
  expect(body).not.toContain('could not determine client id');
}

describe('google public OAuth client IDs', () => {
  it('recognizes the configured web client ID', async () => {
    await expectGoogleClientIdToBeRecognized(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '');
  }, 20000);

  it('recognizes the configured iOS client ID', async () => {
    await expectGoogleClientIdToBeRecognized(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '');
  }, 20000);

  it('recognizes the configured Android client ID', async () => {
    await expectGoogleClientIdToBeRecognized(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '');
  }, 20000);
});
