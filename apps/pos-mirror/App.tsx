import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { MD3LightTheme as DefaultTheme, PaperProvider, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';

import { canAccessPosMirror } from './src/lib/auth';
import { DEFAULT_MIRROR_SETTINGS, type MirrorSettings } from './src/lib/mirror-settings';
import { loadMirrorSettings, saveMirrorSettings } from './src/lib/settings';
import { supabase } from './src/lib/supabase';
import { DisplayScreen } from './src/screens/DisplayScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { colors } from './src/theme';

type AppState = 'loading' | 'login' | 'settings' | 'display';

export default function App() {
  const [state, setState] = useState<AppState>('loading');
  const [settings, setSettings] = useState<MirrorSettings>(DEFAULT_MIRROR_SETTINGS);

  useEffect(() => {
    let active = true;
    const restoreSession = async (session: Session | null) => {
      if (!session?.user.id) {
        if (active) setState('login');
        return;
      }
      try {
        if (!await canAccessPosMirror(session.user.id)) {
          await supabase.auth.signOut();
          if (active) setState('login');
          return;
        }
        const savedSettings = await loadMirrorSettings();
        if (!active) return;
        setSettings(savedSettings);
        setState(savedSettings.registerId ? 'display' : 'settings');
      } catch {
        if (active) setState('login');
      }
    };

    void supabase.auth.getSession().then(({ data }) => restoreSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void restoreSession(session), 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSaveSettings = async (nextSettings: MirrorSettings) => {
    const savedSettings = await saveMirrorSettings(nextSettings);
    setSettings(savedSettings);
    setState('display');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSettings(DEFAULT_MIRROR_SETTINGS);
    setState('login');
  };

  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      onPrimary: colors.primaryOn,
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.surfaceMuted,
      onSurface: colors.text,
      onSurfaceVariant: colors.mutedText,
      error: colors.warning,
      outline: colors.border,
    },
  };

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        {state === 'loading' && <LoadingScreen />}
        {state === 'login' && <LoginScreen />}
        {state === 'settings' && <SettingsScreen initialSettings={settings} onSave={handleSaveSettings} onSignOut={signOut} onCancel={settings.registerId ? () => setState('display') : undefined} />}
        {state === 'display' && <DisplayScreen settings={settings} onOpenSettings={() => setState('settings')} />}
      </PaperProvider>
    </SafeAreaProvider>
  );
}

function LoadingScreen() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Starting POS Mirror</Text></View>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: { color: colors.mutedText },
});
