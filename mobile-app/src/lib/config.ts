// src/lib/config.ts  (inside your mobile-app project)
//
// One place for the backend address. Set it in mobile-app/.env:
//   EXPO_PUBLIC_API_URL=http://192.168.1.75:3000
// Then restart with:  npx expo start -c
//
// Use your PC's current IPv4 address (run `ipconfig`) and the port your
// backend listens on (3000). Do NOT use "localhost" - on a phone that means
// the phone itself.
const FALLBACK_URL = 'http://192.168.1.75:3000';

// Strip stray spaces/quotes. An empty value counts as "not set" (the old `??`
// treated an empty string as a real URL, which made fetch() use a relative
// path and hit the Metro dev server on port 8081).
const fromEnv = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/^["']|["']$/g, '');

export const API_BASE_URL = (fromEnv || FALLBACK_URL).replace(/\/+$/, '');

if (!/^https?:\/\//.test(API_BASE_URL)) {
  console.warn(`[config] API_BASE_URL looks wrong: "${API_BASE_URL}". It must start with http:// or https://`);
}
if (__DEV__) {
  console.log('[config] API_BASE_URL =', API_BASE_URL);
}