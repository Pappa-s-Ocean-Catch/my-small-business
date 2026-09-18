import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View, useWindowDimensions, Image } from 'react-native';
import { Button, RadioButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { documentDirectory, copyAsync } from 'expo-file-system/legacy';

import type { MirrorSettings } from '../lib/mirror-settings';
import { listMirrorRegisterIds } from '../lib/mirror-registers';
import { colors, radius, spacing } from '../theme';

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
  const [idleImageUri, setIdleImageUri] = useState(initialSettings.idleImageUri);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerIds, setRegisterIds] = useState<{ id: string; name: string }[]>([]);
  const [registersLoading, setRegistersLoading] = useState(true);
  const [registersError, setRegistersError] = useState<string | null>(null);
  const selectedRegisterIsAvailable = registerIds.some(r => r.id === registerId.trim());

  const loadRegisters = useCallback(async () => {
    setRegistersLoading(true);
    setRegistersError(null);
    try {
      setRegisterIds(await listMirrorRegisterIds());
    } catch {
      setRegistersError('Could not load mother POS registers. Check the connection and refresh.');
    } finally {
      setRegistersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegisters();
  }, [loadRegisters]);

  const save = async () => {
    const normalizedRegisterId = registerId.trim();
    if (!registerIds.some(r => r.id === normalizedRegisterId)) {
      setError('Choose a mother POS register from the available list.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ registerId: normalizedRegisterId, idleMode, idleImageUri });
    } catch {
      setError('Could not save this display configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const sourceUri = result.assets[0].uri;
        const filename = sourceUri.split('/').pop() || 'idle-artwork.jpg';
        const destUri = (documentDirectory || '') + filename;
        await copyAsync({ from: sourceUri, to: destUri });
        setIdleImageUri(destUri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not select the image. Please try again.');
    }
  };

  const signOut = () => Alert.alert('Sign out of POS Mirror?', 'This display will need a staff or admin sign-in before it can be used again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => void onSignOut() },
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}><Text variant="headlineMedium" style={styles.title}>Display settings</Text><Text variant="bodyLarge" style={styles.subtitle}>Connect this screen to one mother-POS register.</Text></View>
            {onCancel && <Button mode="text" onPress={onCancel}>Back to display</Button>}
          </View>
          <View style={styles.registerHeading}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Mother POS register</Text>
            <Button mode="text" compact onPress={() => void loadRegisters()} loading={registersLoading} disabled={registersLoading}>Refresh</Button>
          </View>
          <Text variant="bodyMedium" style={styles.helper}>Choose a register that has published mirror data from the mother POS.</Text>
          {registersLoading && <View style={styles.loadingRegisters} accessibilityState={{ busy: true }}><ActivityIndicator color={colors.primary} /><Text variant="bodyMedium">Loading available registers…</Text></View>}
          {!registersLoading && registersError && <Text accessibilityLiveRegion="polite" style={styles.error}>{registersError}</Text>}
          {!registersLoading && !registersError && registerIds.length === 0 && <Text style={styles.emptyState}>No mother POS registers yet. Start a cart on a mother POS, then refresh this list.</Text>}
          {!registersLoading && registerIds.length > 0 && <RadioButton.Group value={registerId} onValueChange={setRegisterId}>
            {registerIds.map(({ id, name }) => <RadioButton.Item key={id} label={`${name} (${id})`} value={id} position="leading" style={styles.registerChoice} accessibilityLabel={`Use mother POS register ${name}`} />)}
          </RadioButton.Group>}
          {!registersLoading && registerId && !registerIds.some(r => r.id === registerId) && <Text style={styles.error}>The saved register is no longer available. Choose one from the list.</Text>}
          <Text variant="titleMedium" style={styles.sectionTitle}>When this register is idle</Text>
          <RadioButton.Group value={idleMode} onValueChange={(value) => setIdleMode(value === 'queue' ? 'queue' : 'image')}>
            <View style={styles.choice}>
              <RadioButton value="image" />
              <View style={styles.choiceText}>
                <Text variant="titleMedium">Welcome image</Text>
                <Text variant="bodyMedium">Show the branded idle display.</Text>
                {idleMode === 'image' && (
                  <View style={styles.imagePickerContainer}>
                    {idleImageUri ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: idleImageUri }} style={styles.imagePreview} />
                        <View style={styles.imagePickerActions}>
                          <Button mode="outlined" compact onPress={pickImage}>Change Photo</Button>
                          <Button mode="text" compact textColor={colors.warning} onPress={() => setIdleImageUri(undefined)}>Reset to Default</Button>
                        </View>
                      </View>
                    ) : (
                      <Button mode="outlined" icon="image-plus" compact onPress={pickImage} style={styles.pickImageButton}>
                        Upload Custom Artwork
                      </Button>
                    )}
                  </View>
                )}
              </View>
            </View>
            <View style={styles.choice}><RadioButton value="queue" /><View style={styles.choiceText}><Text variant="titleMedium">Current queue</Text><Text variant="bodyMedium">Show all current order numbers and customer-readable statuses.</Text></View></View>
          </RadioButton.Group>
          {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <View style={styles.actions}><Button mode="contained" onPress={() => void save()} loading={saving} disabled={saving || registersLoading || !selectedRegisterIsAvailable} contentStyle={styles.primaryButton}>Save and start display</Button><Button mode="text" textColor={colors.primary} onPress={signOut} disabled={saving} contentStyle={styles.secondaryButton}>Sign out</Button></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1 },
  card: { flex: 1, width: '100%', backgroundColor: colors.surface, padding: spacing.xl },
  titleRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontWeight: '800' },
  subtitle: { color: colors.mutedText, marginTop: spacing.xs },
  helper: { color: colors.mutedText, marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.xs },
  registerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  loadingRegisters: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  registerChoice: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.sm },
  emptyState: { color: colors.mutedText, marginTop: spacing.md, lineHeight: 21 },
  choice: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  choiceText: { flex: 1, gap: spacing.xs },
  error: { color: colors.primary, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  primaryButton: { minHeight: 48, borderRadius: radius.md },
  secondaryButton: { minHeight: 48, borderRadius: radius.md },
  imagePickerContainer: { marginTop: spacing.sm },
  pickImageButton: { alignSelf: 'flex-start' },
  imagePreviewContainer: { gap: spacing.sm, marginTop: spacing.xs },
  imagePreview: { width: 160, height: 90, borderRadius: radius.md, backgroundColor: colors.border },
  imagePickerActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
