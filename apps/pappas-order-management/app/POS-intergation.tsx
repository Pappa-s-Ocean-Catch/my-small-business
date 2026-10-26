import { ActionButton as Button } from '@/components/ui/ActionButton';
import { WorkspaceHeader, Panel } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import { FormField, PageHeader } from '@/components/ui';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Card, Text, TextInput } from 'react-native-paper';
import { BRAND_COLORS } from '@/utils/brand';
import {
  formatSmartpayError,
  loadSmartpayPairingSettings,
  pairSmartpayTerminal,
  saveSmartpayPairingSettings,
  type SmartpayPairingSettings,
} from '@/lib/smartpay';

export default function PosIntegrationScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 750;
  const [settings, setSettings] = useState<SmartpayPairingSettings | null>(null);
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState(false);

  useEffect(() => {
    loadSmartpayPairingSettings()
      .then(setSettings)
      .catch((error) => Alert.alert('Smartpay setup error', error instanceof Error ? error.message : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const updateSettings = (patch: Partial<SmartpayPairingSettings>) => {
    setSettings((current) => current ? { ...current, ...patch } : current);
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      await saveSmartpayPairingSettings(settings);
      Alert.alert('Saved', 'Smartpay POS integration settings updated.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Failed to save Smartpay settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePair = async () => {
    if (!settings) return;
    try {
      setPairing(true);
      const next = await pairSmartpayTerminal({ ...settings, pairingCode });
      setSettings(next);
      setPairingCode('');
      Alert.alert('Pairing complete', 'This POS register is now paired with Smartpay.');
    } catch (error) {
      console.error('Smartpay pairing failed', error);
      Alert.alert('Pairing failed', formatSmartpayError(error));
    } finally {
      setPairing(false);
    }
  };

  if (loading || !settings) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading Smartpay setup...</Text>
      </View>
    );
  }

  const fields: [keyof SmartpayPairingSettings, string, boolean?][] = [
    ['environmentUrl', 'Smartpay base URL', true], ['posRegisterId', 'POS register ID', true],
    ['posBusinessName', 'Business name'], ['posVendorName', 'POS vendor name'],
    ['contactName', 'Contact name'], ['address', 'Address'], ['city', 'City'], ['state', 'State'],
    ['zipCode', 'Postcode'], ['phone', 'Phone'], ['email', 'Email'], ['posRegisterName', 'POS register name'],
  ];
  const fieldStyle = { flexGrow: 1, flexBasis: compact ? '100%' as const : '46%' as const, minWidth: 0 };
  return <View style={styles.screen}>
    <WorkspaceHeader title="Smartpay pairing" />
    <ScrollView contentContainerStyle={{ padding: compact ? 12 : 16, gap: 24 }} keyboardShouldPersistTaps="handled">
      <Panel style={{ maxWidth: 940, padding: 20 }}>
        <View style={{ padding: 16, backgroundColor: settings.pairedAt ? t.color.successTint : t.color.warningTint, borderRadius: 10 }}><Text style={{ color: t.color.text }}>{settings.pairedAt ? `Last paired: ${new Date(settings.pairedAt).toLocaleString()}` : 'Terminal not paired. Enter the code from your payment terminal.'}</Text></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 16 }}>
          <View style={fieldStyle}><FormField label="Smartpay base URL" value={settings.environmentUrl} editable={false} /></View>
          <View style={fieldStyle}><FormField label="Pairing code" value={pairingCode} onChangeText={setPairingCode} autoCapitalize="characters" autoCorrect={false} editable={!pairing && !saving} /></View>
          {fields.slice(1).map(([key, label, readOnly]) => <React.Fragment key={key}><View style={fieldStyle}><FormField label={label} value={settings[key] || ''} editable={!readOnly && !pairing && !saving} onChangeText={(value) => updateSettings({ [key]: value })} keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} autoCapitalize={key === 'email' ? 'none' : 'sentences'} /></View>{key === 'posRegisterId' && !compact && <View style={fieldStyle} />}</React.Fragment>)}
        </View>
        <Button mode="outlined" style={{ alignSelf: 'flex-start' }} onPress={handleSave} loading={saving} disabled={saving || pairing}>Save configuration</Button>
      </Panel>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}><Button mode="outlined" onPress={() => router.back()} disabled={saving || pairing}>Cancel</Button><Button mode="contained" onPress={handlePair} loading={pairing} disabled={pairing || saving}>Pair terminal</Button></View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  header: {
    backgroundColor: BRAND_COLORS.header,
  },
  headerTitle: {
    color: t.color.surface,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.background,
  },
  container: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: t.radius.card,
    backgroundColor: t.color.surface,
    borderWidth: 1, borderColor: t.color.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  helper: {
    fontSize: 14,
    color: t.color.muted,
    marginBottom: 12,
  },
  input: {
    marginTop: 8,
  },
  statusText: {
    marginTop: 12,
    color: t.color.success,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  flexButton: {
    flex: 1,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  columnInput: {
    flex: 1,
    marginTop: 8,
  },
});
