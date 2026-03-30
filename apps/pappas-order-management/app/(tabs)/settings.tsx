import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Switch, Text, TextInput } from 'react-native-paper';
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings } from '../../lib/settings';
import { playNewOrderSound, SOUND_OPTIONS, type SoundId } from '../../lib/sounds';
import { usePrintersDiscovery } from 'react-native-esc-pos-printer';
import type { DeviceInfo } from 'react-native-esc-pos-printer';
import { escposTestPrint, type SavedPrinter } from '../../lib/escpos-printer';

export default function SettingsScreen() {
    const [refreshIntervalSecText, setRefreshIntervalSecText] = useState(String(DEFAULT_APP_SETTINGS.refreshIntervalSec));
    const [soundEnabled, setSoundEnabled] = useState<boolean>(DEFAULT_APP_SETTINGS.soundEnabled);
    const [soundId, setSoundId] = useState<SoundId>(DEFAULT_APP_SETTINGS.soundId);
    const [repeatCountText, setRepeatCountText] = useState(String(DEFAULT_APP_SETTINGS.soundRepeatCount));

    const [printerEnabled, setPrinterEnabled] = useState<boolean>(DEFAULT_APP_SETTINGS.printerEnabled);
    const [printerAutoPrint, setPrinterAutoPrint] = useState<boolean>(DEFAULT_APP_SETTINGS.printerAutoPrint);
    const [printerCopiesText, setPrinterCopiesText] = useState<string>(String(DEFAULT_APP_SETTINGS.printerCopies));
    const [printerSaved, setPrinterSaved] = useState<SavedPrinter[]>(DEFAULT_APP_SETTINGS.printerSaved);
    const [printerSelectedTarget, setPrinterSelectedTarget] = useState<string | null>(DEFAULT_APP_SETTINGS.printerSelectedTarget);
    const [printerSimulator, setPrinterSimulator] = useState<boolean>(DEFAULT_APP_SETTINGS.printerSimulator);

    const [saving, setSaving] = useState(false);
    const [testingPrinter, setTestingPrinter] = useState(false);

    const { printers, isDiscovering, printerError, start, stop, pairBluetoothDevice } = usePrintersDiscovery();

    useEffect(() => {
        loadAppSettings().then((s) => {
            setRefreshIntervalSecText(String(s.refreshIntervalSec));
            setSoundEnabled(s.soundEnabled);
            setSoundId(s.soundId);
            setRepeatCountText(String(s.soundRepeatCount));

            setPrinterEnabled(s.printerEnabled);
            setPrinterAutoPrint(s.printerAutoPrint);
            setPrinterCopiesText(String(s.printerCopies));
            setPrinterSaved(s.printerSaved);
            setPrinterSelectedTarget(s.printerSelectedTarget);
            setPrinterSimulator(s.printerSimulator);
        });
    }, []);

    const selectedSoundLabel = useMemo(
        () => SOUND_OPTIONS.find((o) => o.id === soundId)?.label ?? soundId,
        [soundId]
    );

    const openSoundPicker = () => {
        // if (SOUND_OPTIONS.length === 0) {
        //   Alert.alert('No sounds found', 'No .mp3 files are available in the sounds folder.');
        //   return;
        // }

        Alert.alert(
            'Select notification sound',
            undefined,
            [
                ...SOUND_OPTIONS.map((opt) => ({
                    text: opt.label,
                    onPress: () => setSoundId(opt.id),
                })),
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const parseIntOr = (value: string, fallback: number) => {
        const n = Number.parseInt(value, 10);
        return Number.isFinite(n) ? n : fallback;
    };

    const handlePreview = async () => {
        const repeatCount = parseIntOr(repeatCountText, DEFAULT_APP_SETTINGS.soundRepeatCount);
        await playNewOrderSound({ soundId, repeatCount, delayMs: 2000 });
    };

    const handleTestPrint = async () => {
        const printerCopies = parseIntOr(printerCopiesText, DEFAULT_APP_SETTINGS.printerCopies);
        const selected = printerSaved.find((p) => p.target === printerSelectedTarget) || null;
        if (!selected) {
            Alert.alert('Printer not selected', 'Please select a printer from the saved list first.');
            return;
        }
        if (printerCopies < 1 || printerCopies > 10) {
            Alert.alert('Invalid copies', 'Please enter a value between 1 and 10.');
            return;
        }

        try {
            setTestingPrinter(true);
            await escposTestPrint(selected, printerCopies);
            Alert.alert('Success', 'Test print sent.');
        } catch (e) {
            Alert.alert('Printer error', e instanceof Error ? e.message : 'Failed to test print');
        } finally {
            setTestingPrinter(false);
        }
    };

    useEffect(() => {
        if (printerError && (printerError as any)?.message) {
            Alert.alert('Printer discovery error', (printerError as any).message);
        }
    }, [printerError]);

    const addOrSelectPrinter = async (p: DeviceInfo) => {
        // Some Bluetooth devices require pairing on Android.
        if (p.macAddress) {
            try {
                await pairBluetoothDevice(p.macAddress);
            } catch {
                // pairing might be unsupported / already paired; continue
            }
        }

        const saved: SavedPrinter = {
            target: p.target,
            deviceName: p.deviceName,
            ipAddress: p.ipAddress,
            macAddress: p.macAddress,
            bdAddress: p.bdAddress,
            deviceType: p.deviceType,
        };

        setPrinterSaved((prev) => {
            const exists = prev.some((x) => x.target === saved.target);
            return exists ? prev : [saved, ...prev];
        });

        setPrinterSelectedTarget(saved.target);
        setPrinterEnabled(true);
    };

    const handleSave = async () => {
        const refreshIntervalSec = parseIntOr(refreshIntervalSecText, DEFAULT_APP_SETTINGS.refreshIntervalSec);
        const soundRepeatCount = parseIntOr(repeatCountText, DEFAULT_APP_SETTINGS.soundRepeatCount);
        const printerCopies = parseIntOr(printerCopiesText, DEFAULT_APP_SETTINGS.printerCopies);

        if (refreshIntervalSec < 5 || refreshIntervalSec > 600) {
            Alert.alert('Invalid refresh interval', 'Please enter a value between 5 and 600 seconds.');
            return;
        }
        if (soundRepeatCount < 1 || soundRepeatCount > 10) {
            Alert.alert('Invalid play count', 'Please enter a value between 1 and 10.');
            return;
        }

        if (printerCopies < 1 || printerCopies > 10) {
            Alert.alert('Invalid copies', 'Please enter a value between 1 and 10.');
            return;
        }

        try {
            setSaving(true);
            await saveAppSettings({
                refreshIntervalSec,
                soundEnabled,
                soundId,
                soundRepeatCount,

                printerEnabled,
                printerAutoPrint,
                printerCopies,

                printerSelectedTarget,
                printerSaved,
                printerSimulator,
            });
            Alert.alert('Saved', 'Settings updated.');
        } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Settings</Text>

            <Card style={styles.card}>
                <Card.Content>
                    <Text style={styles.sectionTitle}>Refresh</Text>

                    <TextInput
                        mode="outlined"
                        label="Refresh interval (seconds)"
                        value={refreshIntervalSecText}
                        onChangeText={setRefreshIntervalSecText}
                        keyboardType="number-pad"
                        style={styles.input}
                    />
                    <Text style={styles.helper}>Min 5, max 600.</Text>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Text style={styles.sectionTitle}>Sound</Text>

                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Sound notifications</Text>
                        <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
                    </View>

                    <Button mode="outlined" onPress={openSoundPicker} style={styles.selectButton}>
                        {selectedSoundLabel}
                    </Button>
                    <Text style={styles.helper}>Tap to change.</Text>

                    <TextInput
                        mode="outlined"
                        label="Play times"
                        value={repeatCountText}
                        onChangeText={setRepeatCountText}
                        keyboardType="number-pad"
                        style={styles.input}
                    />
                    <Text style={styles.helper}>1 to 10 (2s delay between plays).</Text>

                    <Button mode="contained" onPress={handlePreview} style={styles.previewButton}>
                        Preview sound
                    </Button>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Text style={styles.sectionTitle}>Printer</Text>

                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Enable Epson printer</Text>
                        <Switch value={printerEnabled} onValueChange={setPrinterEnabled} />
                    </View>

                    <Button
                        mode="outlined"
                        onPress={() => start({ timeout: 8000, autoStop: true })}
                        disabled={isDiscovering}
                        style={styles.selectButton}
                    >
                        {isDiscovering ? 'Discovering…' : 'Discover printers'}
                    </Button>

                    {isDiscovering && (
                        <Button mode="text" onPress={stop} style={styles.selectButton}>
                            Stop discovery
                        </Button>
                    )}

                    {printers.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                            <Text style={styles.label}>Discovered printers</Text>
                            {printers.map((p) => (
                                <View key={p.target} style={styles.printerRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.printerName}>{p.deviceName}</Text>
                                        <Text style={styles.printerMeta}>
                                            {p.ipAddress || p.macAddress || p.bdAddress || p.target}
                                        </Text>
                                    </View>
                                    <Button mode="contained" onPress={() => addOrSelectPrinter(p)}>
                                        Enable
                                    </Button>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={{ marginTop: 12 }}>
                        <Text style={styles.label}>Saved printers</Text>
                        {printerSaved.length === 0 ? (
                            <Text style={styles.helper}>No printers saved yet. Use discovery above.</Text>
                        ) : (
                            printerSaved.map((p) => {
                                const isSelected = p.target === printerSelectedTarget;
                                return (
                                    <View key={p.target} style={styles.printerRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.printerName}>{p.deviceName}</Text>
                                            <Text style={styles.printerMeta}>
                                                {p.ipAddress || p.macAddress || p.bdAddress || p.target}
                                            </Text>
                                        </View>
                                        <Button
                                            mode={isSelected ? 'contained' : 'outlined'}
                                            onPress={() => setPrinterSelectedTarget(p.target)}
                                        >
                                            {isSelected ? 'Selected' : 'Select'}
                                        </Button>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    <TextInput
                        mode="outlined"
                        label="Copies"
                        value={printerCopiesText}
                        onChangeText={setPrinterCopiesText}
                        keyboardType="number-pad"
                        style={styles.input}
                    />
                    <Text style={styles.helper}>1 to 10 copies per print.</Text>

                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Print Simulator</Text>
                        <Switch value={printerSimulator} onValueChange={setPrinterSimulator} />
                    </View>
                    <Text style={styles.helper}>Simulate printing with a modal. Good for development.</Text>

                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Auto print new orders</Text>
                        <Switch value={printerAutoPrint} onValueChange={setPrinterAutoPrint} disabled={!printerEnabled} />
                    </View>

                    <Button
                        mode="outlined"
                        loading={testingPrinter}
                        disabled={testingPrinter}
                        onPress={handleTestPrint}
                        style={styles.previewButton}
                    >
                        Test print
                    </Button>
                </Card.Content>
            </Card>

            <Button
                mode="contained"
                loading={saving}
                disabled={saving}
                onPress={handleSave}
                style={styles.saveButton}
                contentStyle={styles.saveButtonContent}
            >
                Save
            </Button>

            <Text style={styles.footer}>More settings coming later.</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#f5f5f5',
        flexGrow: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 16,
    },
    card: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
    helper: {
        marginTop: 6,
        fontSize: 12,
        color: '#666',
    },
    input: {
        marginTop: 4,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    printerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
    },
    printerName: {
        fontSize: 14,
        fontWeight: '700',
    },
    printerMeta: {
        fontSize: 12,
        color: '#666',
    },
    selectButton: {
        marginTop: 4,
    },
    previewButton: {
        marginTop: 12,
    },
    saveButton: {
        marginTop: 8,
    },
    saveButtonContent: {
        paddingVertical: 10,
    },
    footer: {
        marginTop: 12,
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
});
