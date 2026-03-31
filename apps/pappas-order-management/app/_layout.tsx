import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import { canAccessOrderManagement } from '@/lib/auth';
import { OfflineAttentionOverlay } from '@/lib/KitchenAlertOverlay';
import { useKeepAwake } from 'expo-keep-awake';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  useKeepAwake();

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
        const canAccess = await canAccessOrderManagement(userId);
        if (cancelled) return;

        if (!canAccess) {
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
        router.replace('/(drawer)/(tabs)/live-orders');
      }
    };

    // Listen for auth changes - redirect to orders if logged in, login if not
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async() => {
        void routeForSession(session);
      }, 0);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={MD3LightTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(drawer)" />
          <Stack.Screen name="order-detail" />
        </Stack>
        <OfflineAttentionOverlay appName="Pappas Order" />
      </PaperProvider>
    </GestureHandlerRootView>
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
