import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Expo CLI automatically loads .env files with EXPO_PUBLIC_ prefix
// See: https://docs.expo.dev/guides/environment-variables/
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Debug logging to help diagnose issues
if (__DEV__) {
  console.log('Supabase Config:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseAnonKey?.length || 0,
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = 'Missing Supabase environment variables. Please ensure .env file exists with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY';
  console.error(errorMessage);
  console.error('Current env values:', {
    EXPO_PUBLIC_SUPABASE_URL: supabaseUrl || 'MISSING',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'SET (hidden)' : 'MISSING',
  });
  throw new Error(errorMessage);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: AsyncStorage,
    detectSessionInUrl: false,
  },
});
