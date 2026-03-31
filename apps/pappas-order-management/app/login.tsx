import { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Banner, Button, Text, TextInput } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import { isAdminUser } from '@/lib/auth';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const router = useRouter();

  // Check if Supabase is initialized correctly
  useEffect(() => {
    try {
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !key) {
        setInitError(
          'Configuration Error: Missing Supabase environment variables.\n\n' +
          'Please ensure .env file exists with:\n' +
          '- EXPO_PUBLIC_SUPABASE_URL\n' +
          '- EXPO_PUBLIC_SUPABASE_ANON_KEY\n\n' +
          'Current status:\n' +
          `- URL: ${url ? '✓ Set' : '✗ Missing'}\n` +
          `- Key: ${key ? '✓ Set' : '✗ Missing'}\n\n` +
          'Restart the Expo dev server after creating/updating .env file.'
        );
      } else {
        // Test connection
        supabase.auth.getSession().catch((err) => {
          setInitError(
            `Connection Error: Failed to connect to Supabase.\n\n` +
            `Error: ${err instanceof Error ? err.message : 'Unknown error'}\n\n` +
            `Please check:\n` +
            `- Your internet connection\n` +
            `- Supabase URL is correct\n` +
            `- Supabase service is running`
          );
        });
      }
    } catch (err) {
      setInitError(
        `Initialization Error: ${err instanceof Error ? err.message : 'Unknown error'}\n\n` +
        'Please check your configuration and restart the app.'
      );
    }
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError(`Login Failed: ${loginError.message}\n\nPlease check your credentials and try again.`);
      } else if (data.session) {
        const userId = data.session.user?.id;
        if (!userId) {
          await supabase.auth.signOut();
          setError('Login failed: Missing user id. Please try again.');
          return;
        }

        let isAdmin = false;
        try {
          isAdmin = await isAdminUser(userId);
        } catch (roleErr) {
          await supabase.auth.signOut();
          setError(
            `Login Failed: Unable to verify access.\n\n` +
            `${roleErr instanceof Error ? roleErr.message : 'Unknown error'}`
          );
          return;
        }

        if (!isAdmin) {
          await supabase.auth.signOut();
          setError('Not authorized: this app is currently restricted to admin users.');
          return;
        }

        router.replace('/(drawer)/(tabs)/live-orders');
      } else {
        setError('Login failed: No session created. Please try again.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(
        `Unexpected Error: ${errorMessage}\n\n` +
        'Please check your connection and try again.'
      );
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.content}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="App logo"
          />
          <Text style={styles.title}>Pappas Order Management</Text>

          {(initError || error) && (
            <Banner
              visible
              icon={initError ? 'alert-circle' : 'alert'}
              style={styles.banner}
              actions={[]}
            >
              {initError ?? error}
            </Banner>
          )}

          <View style={styles.form}>
            <TextInput
              mode="outlined"
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading && !initError}
              style={styles.paperInput}
            />

            <TextInput
              mode="outlined"
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!loading && !initError}
              style={styles.paperInput}
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              disabled={loading || !!initError}
              loading={loading}
              contentStyle={styles.signInButtonContent}
              style={styles.signInButton}
            >
              Sign In
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    width: 84,
    height: 84,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 420,
    marginBottom: 16,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  paperInput: {
    marginBottom: 12,
  },
  signInButton: {
    marginTop: 4,
  },
  signInButtonContent: {
    paddingVertical: 10,
  },
});
