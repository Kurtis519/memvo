# Google Auth Implementation Notes

## Expo AuthSession

- `expo-auth-session` requires installation alongside `expo-crypto`.
- Expo recommends using stable redirect URIs produced from the app scheme for authorization callbacks.
- Custom deep-link testing is not reliable in Expo Go; a development build is needed for native deep-link OAuth return handling.

## Expo Linking

- `Linking.createURL()` should use a scheme defined in app config.
- Stable auth callback URLs on native require a build or development build instead of Expo Go.

## Expo System UI

- App-wide light-mode locking and root background changes can be configured statically in app config and native builds.
- Runtime root background color can also be set with `expo-system-ui`, but static `userInterfaceStyle` or background config changes require rebuilding the native binary.

## Supabase signInWithIdToken

- `supabase.auth.signInWithIdToken()` supports native sign-in with an OIDC ID token.
- The provider must be enabled and configured in Supabase Auth.
- The JavaScript example uses `provider: 'google'` and `token: 'your-id-token'`.
