import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { canAccessPosMirror } from '../lib/auth';
import { getLoginLayout } from '../lib/login-layout';
import { supabase } from '../lib/supabase';
import { colors, spacing } from '../theme';

export function LoginScreen() {
  const { width, height } = useWindowDimensions();
  const layout = getLoginLayout({ width, height });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter both your email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data.session?.user.id) {
        setError(signInError?.message ?? 'Could not sign in. Please try again.');
        return;
      }
      if (!await canAccessPosMirror(data.session.user.id)) {
        await supabase.auth.signOut();
        setError('Staff or admin access is required for POS Mirror.');
      }
    } catch {
      setError('Could not verify your access. Check the connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: layout.horizontalGutter,
              paddingVertical: layout.verticalGutter,
              justifyContent: layout.compact ? 'flex-start' : 'center',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={[styles.card, { maxWidth: layout.cardMaxWidth, padding: layout.cardPadding }]}>
            <Text variant={layout.compact ? 'headlineSmall' : 'headlineMedium'} style={styles.title}>POS Mirror</Text>
            <Text variant={layout.compact ? 'bodyLarge' : 'titleMedium'} style={styles.subtitle}>Sign in with your POS staff account to configure this customer display.</Text>
            <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" accessibilityLabel="Email" style={styles.input} />
            <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" accessibilityLabel="Password" style={styles.input} onSubmitEditing={() => void signIn()} />
            <HelperText type="error" visible={Boolean(error)}>{error ?? ''}</HelperText>
            <Button mode="contained" onPress={() => void signIn()} loading={submitting} disabled={submitting} contentStyle={styles.button} accessibilityLabel="Sign in to POS Mirror">Sign in</Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  card: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20 },
  title: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  subtitle: { color: colors.mutedText, lineHeight: 24, marginBottom: spacing.lg },
  input: { marginBottom: spacing.sm, backgroundColor: colors.surface },
  button: { minHeight: 48 },
});
