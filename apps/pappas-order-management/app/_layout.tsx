import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { supabase } from '../lib/supabase';
import { isAdminUser } from '../lib/auth';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let cancelled = false;

    const routeForSession = async (session: any | null) => {
      const currentSegment = segments[0];

      if (!session) {
        if (currentSegment !== 'login') {
          router.replace('/login');
        }
        return;
      }

      const userId = session.user?.id;
      if (!userId) {
        await supabase.auth.signOut();
        if (currentSegment !== 'login') {
          router.replace('/login');
        }
        return;
      }

      try {
        const isAdmin = await isAdminUser(userId);
        if (cancelled) return;

        if (!isAdmin) {
          await supabase.auth.signOut();
          if (currentSegment !== 'login') {
            router.replace('/login');
          }
          return;
        }
      } catch {
        await supabase.auth.signOut();
        if (currentSegment !== 'login') {
          router.replace('/login');
        }
        return;
      }

      if (currentSegment === 'login' || !currentSegment) {
        router.replace('/(tabs)/orders');
      }
    };

    // Listen for auth changes - redirect to orders if logged in, login if not
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void routeForSession(session);
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      void routeForSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, segments]);

  return (
    <PaperProvider theme={MD3LightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="order-detail" />
      </Stack>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
