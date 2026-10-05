import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace these with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://vygmnpwccbtwrjsrkpih.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z21ucHdjY2J0d3Jqc3JrcGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTAxMzUsImV4cCI6MjEwNDQ2NjEzNX0.8wFM3G5jau-xVc2SAKPWJ0BJxKOhUzD9sdXhWWwKoZM';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});