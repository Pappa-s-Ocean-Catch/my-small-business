import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      setInitialized(true);
      if (!session) {
        router.replace('/login');
      } else {
        router.replace('/(tabs)/orders');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login');
      } else {
        const currentSegment = segments[0];
        if (currentSegment === 'login' || !currentSegment) {
          router.replace('/(tabs)/orders');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, segments]);

  if (!initialized) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="order-detail" />
    </Stack>
  );
}
