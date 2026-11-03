// src/lib/supabase.ts  (inside your mobile-app project)
// Exactly ONE `export const supabase` in this file.
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Read from mobile-app/.env (restart with `npx expo start -c` after changes):
//   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
//   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('[supabase] URL or key is empty. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env');
}

// Expo renders the web build on a Node server where `window` doesn't exist,
// so session storage is only used on a real client.
const isServer = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});