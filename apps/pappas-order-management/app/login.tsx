import { ActionButton as Button } from '@/components/ui/ActionButton';
import { designTokens as t } from '@/lib/redesign';
import { FormField } from '@/components/ui';
import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import { canAccessOrderManagement } from '@/lib/auth';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();
  const compact = width < 600;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
    setSubmitted(true);
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
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

        let canAccess = false;
        try {
          canAccess = await canAccessOrderManagement(userId);
        } catch (roleErr) {
          await supabase.auth.signOut();
          setError(
            `Login Failed: Unable to verify access.\n\n` +
            `${roleErr instanceof Error ? roleErr.message : 'Unknown error'}`
          );
          return;
        }

        if (!canAccess) {
          await supabase.auth.signOut();
          setError('Not authorized: staff or admin access is required.');
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

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={{ flex: 1, minHeight: height, flexDirection: compact ? 'column' : 'row' }}>
        <View style={[styles.brandPane, compact && styles.brandCompact]}>
          <Text style={[styles.brandName, compact && { fontSize: 30 }]}>Pappa’s Ocean Catch</Text>
          <View style={compact ? { marginTop: 0 } : styles.brandStory}><Text style={styles.brandEyebrow}>YOUR COUNTER, CONNECTED</Text><Text style={[styles.brandHeadline, compact && { fontSize: 32, lineHeight: 32, marginTop: 18 }]}>A good service{`\n`}starts here.</Text>{!compact && <Text style={styles.brandDescription}>Orders, customers and your kitchen.{`\n`}Together in one calm workspace.</Text>}</View>
          {!compact && <Text style={styles.brandFooter}>Pappa’s · Fish, Chips & Burgers</Text>}
        </View>
        <View style={[styles.formPane, compact && { width: '100%', flex: 1, padding: 24, justifyContent: 'flex-start' }]}>
          <View style={styles.form}>
            <Text style={styles.eyebrow}>PAPPAS ORDER MANAGEMENT</Text>
            <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your store workspace.</Text>
            {(initError || error) && <View accessibilityRole="alert" style={styles.banner}><Text style={{ color: t.color.text, lineHeight: 22 }}>{initError ?? error}</Text></View>}
            <FormField label="Email" placeholder="Email" error={submitted && !email.trim()} textContentType="username" value={email} onChangeText={(text) => { setEmail(text); setError(null); }} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!loading && !initError} />
            {submitted && !email.trim() && <HelperText type="error" style={styles.validation}>Enter your email address.</HelperText>}
            <FormField label="Password" placeholder="Password" error={submitted && !password} textContentType="password" value={password} onChangeText={(text) => { setPassword(text); setError(null); }} secureTextEntry={!showPassword} right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((value) => !value)} />} autoCapitalize="none" autoComplete="password" editable={!loading && !initError} style={{ marginTop: 20 }} />
            {submitted && !password && <HelperText type="error" style={styles.validation}>Enter your password.</HelperText>}
            <Button mode="contained" onPress={handleLogin} disabled={loading || !!initError} loading={loading} contentStyle={{ minHeight: 48 }} style={{ marginTop: 22 }}>Sign in</Button>
            <Text style={styles.footer}>Store access · Authorised team members</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.surface },
  brandPane: { width: '50%', backgroundColor: t.color.navy, padding: 60, justifyContent: 'space-between' },
  brandCompact: { width: '100%', minHeight: 180, padding: 24, justifyContent: 'flex-start' },
  brandName: { fontFamily: 'Georgia', fontSize: 40, color: t.color.surface },
  brandStory: { marginVertical: 48 },
  brandEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#BDD3DB' },
  brandHeadline: { fontFamily: 'Georgia', fontSize: 56, lineHeight: 60, color: t.color.surface, marginTop: 22 },
  brandDescription: { fontSize: 18, lineHeight: 28, color: '#BDD3DB', marginTop: 22 },
  brandFooter: { fontSize: 14, color: '#BDD3DB' },
  formPane: { width: '50%', padding: 40, alignItems: 'center', justifyContent: 'center' },
  form: { width: '100%', maxWidth: 370 },
  eyebrow: { fontSize: 11, fontWeight: '700', color: t.color.muted, letterSpacing: 1.4 },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '700', color: t.color.text, marginTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 22, color: t.color.muted, marginTop: 12, marginBottom: 32 },
  banner: { padding: 16, borderWidth: 1, borderColor: '#E6D9AE', backgroundColor: '#FFF8E7', borderRadius: 12, marginBottom: 20 },
  validation: { paddingHorizontal: 0, fontSize: 14 },
  footer: { textAlign: 'center', fontSize: 12, lineHeight: 20, color: t.color.muted, marginTop: 36, marginBottom: 16 },
});
