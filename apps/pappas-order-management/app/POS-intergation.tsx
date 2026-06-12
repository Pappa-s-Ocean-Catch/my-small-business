import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Button, Card, Text, TextInput } from 'react-native-paper';
import {
  formatSmartpayError,
  loadSmartpayPairingSettings,
  pairSmartpayTerminal,
  saveSmartpayPairingSettings,
  type SmartpayPairingSettings,
} from '@/lib/smartpay';

export default function PosIntegrationScreen() {
  const router = useRouter();
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

  return (
    <View style={styles.screen}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} iconColor="#fff" />
        <Appbar.Content title="POS Integration" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Smartpay Pairing</Text>
            <Text style={styles.helper}>
              Enter the pairing code shown on the Smartpay terminal. The register ID below is generated once and stored only on this device for future Smartpay requests.
            </Text>

            <TextInput
              mode="outlined"
              label="Smartpay production URL"
              value={settings.environmentUrl}
              editable={false}
              style={styles.input}
            />

            <TextInput
              mode="outlined"
              label="Pairing code"
              value={pairingCode}
              onChangeText={setPairingCode}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />

            <TextInput
              mode="outlined"
              label="POS Register ID"
              value={settings.posRegisterId}
              editable={false}
              style={styles.input}
            />

            <TextInput
              mode="outlined"
              label="POS Register Name"
              value={settings.posRegisterName}
              onChangeText={(posRegisterName) => updateSettings({ posRegisterName })}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Business Name"
              value={settings.posBusinessName}
              onChangeText={(posBusinessName) => updateSettings({ posBusinessName })}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="POS Vendor Name"
              value={settings.posVendorName}
              onChangeText={(posVendorName) => updateSettings({ posVendorName })}
              style={styles.input}
            />

            {settings.pairedAt && (
              <Text style={styles.statusText}>
                Last paired: {new Date(settings.pairedAt).toLocaleString()}
              </Text>
            )}

            <View style={styles.buttonRow}>
              <Button mode="outlined" onPress={handleSave} loading={saving} disabled={saving || pairing} style={styles.flexButton}>
                Save
              </Button>
              <Button mode="contained" onPress={handlePair} loading={pairing} disabled={pairing || saving} style={styles.flexButton}>
                Pair
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Store Contact</Text>
            <Text style={styles.helper}>Optional details sent to Smartpay as store metadata during pairing.</Text>

            <TextInput mode="outlined" label="Contact Name" value={settings.contactName} onChangeText={(contactName) => updateSettings({ contactName })} style={styles.input} />
            <TextInput mode="outlined" label="Address" value={settings.address} onChangeText={(address) => updateSettings({ address })} style={styles.input} />
            <View style={styles.twoColumnRow}>
              <TextInput mode="outlined" label="City" value={settings.city} onChangeText={(city) => updateSettings({ city })} style={styles.columnInput} />
              <TextInput mode="outlined" label="State" value={settings.state} onChangeText={(state) => updateSettings({ state })} style={styles.columnInput} />
            </View>
            <View style={styles.twoColumnRow}>
              <TextInput mode="outlined" label="Postcode" value={settings.zipCode} onChangeText={(zipCode) => updateSettings({ zipCode })} style={styles.columnInput} />
              <TextInput mode="outlined" label="Phone" value={settings.phone} onChangeText={(phone) => updateSettings({ phone })} keyboardType="phone-pad" style={styles.columnInput} />
            </View>
            <TextInput
              mode="outlined"
              label="Email"
              value={settings.email}
              onChangeText={(email) => updateSettings({ email })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1f2937',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  helper: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    marginTop: 8,
  },
  statusText: {
    marginTop: 12,
    color: '#047857',
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
