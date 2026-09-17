import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, RadioButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MirrorSettings } from '../lib/mirror-settings';
import { colors, spacing } from '../theme';

type Props = {
  initialSettings: MirrorSettings;
  onSave: (settings: MirrorSettings) => Promise<void>;
  onSignOut: () => Promise<void>;
  onCancel?: () => void;
};

export function SettingsScreen({ initialSettings, onSave, onSignOut, onCancel }: Props) {
  const { width } = useWindowDimensions();
  const [registerId, setRegisterId] = useState(initialSettings.registerId);
  const [idleMode, setIdleMode] = useState(initialSettings.idleMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const normalizedRegisterId = registerId.trim();
    if (!normalizedRegisterId) {
      setError('Register ID is required. Use the POS Register ID from the mother POS Smartpay settings.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ registerId: normalizedRegisterId, idleMode });
    } catch {
      setError('Could not save this display configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => Alert.alert('Sign out of POS Mirror?', 'This display will need a staff or admin sign-in before it can be used again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => void onSignOut() },
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { maxWidth: Math.min(680, width - spacing.xl * 2) }]}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}><Text variant="headlineMedium" style={styles.title}>Display settings</Text><Text variant="bodyLarge" style={styles.subtitle}>Connect this screen to one mother-POS register.</Text></View>
            {onCancel && <Button mode="text" onPress={onCancel}>Back to display</Button>}
          </View>
          <TextInput label="POS Register ID" value={registerId} onChangeText={setRegisterId} autoCapitalize="none" autoCorrect={false} accessibilityLabel="POS Register ID" style={styles.input} />
          <Text variant="bodyMedium" style={styles.helper}>This is the Register ID configured in the mother POS Smartpay settings.</Text>
          <Text variant="titleMedium" style={styles.sectionTitle}>When this register is idle</Text>
          <RadioButton.Group value={idleMode} onValueChange={(value) => setIdleMode(value === 'queue' ? 'queue' : 'image')}>
            <View style={styles.choice}><RadioButton value="image" /><View style={styles.choiceText}><Text variant="titleMedium">Welcome image</Text><Text variant="bodyMedium">Show the branded idle display. Final artwork can be added later.</Text></View></View>
            <View style={styles.choice}><RadioButton value="queue" /><View style={styles.choiceText}><Text variant="titleMedium">Current queue</Text><Text variant="bodyMedium">Show all current order numbers and customer-readable statuses.</Text></View></View>
          </RadioButton.Group>
          {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <View style={styles.actions}><Button mode="contained" onPress={() => void save()} loading={saving} disabled={saving} contentStyle={styles.primaryButton}>Save and start display</Button><Button mode="text" textColor={colors.primary} onPress={signOut} disabled={saving} contentStyle={styles.secondaryButton}>Sign out</Button></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.xl },
  titleRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontWeight: '800' },
  subtitle: { color: colors.mutedText, marginTop: spacing.xs },
  input: { backgroundColor: colors.surface },
  helper: { color: colors.mutedText, marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm },
  choice: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  choiceText: { flex: 1, gap: spacing.xs },
  error: { color: colors.primary, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  primaryButton: { minHeight: 48 },
  secondaryButton: { minHeight: 48 },
});
