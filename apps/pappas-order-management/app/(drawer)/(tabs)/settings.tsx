import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings } from '@/lib/settings';
import { playNewOrderSound, SOUND_OPTIONS, type SoundId } from '@/lib/sounds';
import { usePrintersDiscovery } from 'react-native-esc-pos-printer';
import type { DeviceInfo } from 'react-native-esc-pos-printer';
import { escposTestPrint, type SavedPrinter } from '@/lib/escpos-printer';
import { SettingsActionTile } from '@/components/settings/SettingsActionTile';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';

type SettingsDialogKey = 'refresh' | 'sound' | 'printer' | null;

export default function SettingsScreen() {
    const router = useRouter();
    const [activeDialog, setActiveDialog] = useState<SettingsDialogKey>(null);
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
    const [printerDelayPrintSecText, setPrinterDelayPrintSecText] = useState(
        String(DEFAULT_APP_SETTINGS.printerDelayPrintSec)
    );
    const [printerPaperWidth, setPrinterPaperWidth] = useState<'58mm' | '80mm'>(DEFAULT_APP_SETTINGS.printerPaperWidth);
    const [printerHighQuality, setPrinterHighQuality] = useState<boolean>(DEFAULT_APP_SETTINGS.printerHighQuality);

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
            setPrinterDelayPrintSecText(String(s.printerDelayPrintSec));
            setPrinterPaperWidth(s.printerPaperWidth);
            setPrinterHighQuality(s.printerHighQuality);
        });
    }, []);

    const selectedSoundLabel = useMemo(
        () => SOUND_OPTIONS.find((o) => o.id === soundId)?.label ?? soundId,
        [soundId]
    );

    const selectedPrinter = useMemo(
        () => printerSaved.find((printer) => printer.target === printerSelectedTarget) || null,
        [printerSaved, printerSelectedTarget]
    );

    const refreshSummary = `Every ${refreshIntervalSecText} seconds`;
    const soundSummary = soundEnabled ? `${selectedSoundLabel} • ${repeatCountText} plays` : 'Disabled';
    const printerSummary = !printerEnabled
        ? 'Disabled'
        : `${selectedPrinter?.deviceName ?? 'No printer selected'} • ${printerCopiesText} cop${printerCopiesText === '1' ? 'y' : 'ies'}`;

    const openSoundPicker = () => {
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
        if (p.macAddress) {
            try {
                await pairBluetoothDevice(p.macAddress);
            } catch {
                // Pairing may be unsupported or already completed.
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
        const printerDelayPrintSec = parseIntOr(printerDelayPrintSecText, DEFAULT_APP_SETTINGS.printerDelayPrintSec);

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
        if (printerDelayPrintSec < 0 || printerDelayPrintSec > 120) {
            Alert.alert('Invalid print delay', 'Please enter a value between 0 and 120 seconds.');
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
                printerDelayPrintSec,
                printerPaperWidth,
                printerHighQuality,
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
            <Button
                mode="text"
                icon="arrow-left"
                onPress={() => router.push('/live-orders')}
                style={styles.backButton}
                contentStyle={styles.backButtonContent}
            >
                Back to Home
            </Button>

            <SettingsSectionCard
                title="Catalog"
                description="Manage categories, products, layouts, and add-ons in smaller focused tools."
            >
                <SettingsActionTile
                    title="Menu management"
                    description="Products, categories, and pricing"
                    icon="silverware-fork-knife"
                    onPress={() => router.push('/menu-management')}
                />
                <SettingsActionTile
                    title="Add-ons management"
                    description="Modifier groups and add-on items"
                    icon="shape-outline"
                    onPress={() => router.push('/addons-management')}
                />
                <SettingsActionTile
                    title="POS layout"
                    description="Category groups, colors, and button order"
                    icon="view-dashboard-outline"
                    onPress={() => router.push('/pos-layout-settings')}
                />
            </SettingsSectionCard>

            <SettingsSectionCard
                title="Register"
                description="Core behavior for refresh, order sounds, and kitchen printer automation."
            >
                <SettingsActionTile
                    title="Refresh interval"
                    description={refreshSummary}
                    icon="refresh"
                    onPress={() => setActiveDialog('refresh')}
                />
                <SettingsActionTile
                    title="Order sound"
                    description={soundSummary}
                    icon="volume-high"
                    onPress={() => setActiveDialog('sound')}
                />
                <SettingsActionTile
                    title="Kitchen printer"
                    description={printerSummary}
                    icon="printer"
                    onPress={() => setActiveDialog('printer')}
                />
            </SettingsSectionCard>

            <SettingsSectionCard
                title="Integrations"
                description="Connect this POS register to payment terminals and external services."
            >
                <SettingsActionTile
                    title="Smartpay POS pairing"
                    description="Manage payment terminal connection"
                    icon="credit-card-outline"
                    onPress={() => router.push('/POS-intergation')}
                />
            </SettingsSectionCard>

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

            <Portal>
                <Dialog visible={activeDialog === 'refresh'} onDismiss={() => setActiveDialog(null)} style={styles.dialog}>
                    <Dialog.Title>Refresh interval</Dialog.Title>
                    <Dialog.Content style={styles.dialogContent}>
                        <TextInput
                            mode="outlined"
                            label="Refresh interval (seconds)"
                            value={refreshIntervalSecText}
                            onChangeText={setRefreshIntervalSecText}
                            keyboardType="number-pad"
                            style={styles.input}
                        />
                        <Text style={styles.helper}>Min 5, max 600.</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setActiveDialog(null)}>Done</Button>
                    </Dialog.Actions>
                </Dialog>

                <Dialog visible={activeDialog === 'sound'} onDismiss={() => setActiveDialog(null)} style={styles.dialog}>
                    <Dialog.Title>Order sound</Dialog.Title>
                    <Dialog.Content style={styles.dialogContent}>
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
                        <Text style={styles.helper}>1 to 10 with a 2 second gap between plays.</Text>

                        <Button mode="contained-tonal" onPress={handlePreview} style={styles.previewButton}>
                            Preview sound
                        </Button>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setActiveDialog(null)}>Done</Button>
                    </Dialog.Actions>
                </Dialog>

                <Dialog visible={activeDialog === 'printer'} onDismiss={() => setActiveDialog(null)} style={styles.dialog}>
                    <Dialog.Title>Kitchen printer</Dialog.Title>
                    <Dialog.ScrollArea style={styles.dialogScrollArea}>
                        <ScrollView contentContainerStyle={styles.dialogContent}>
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
                                <View style={styles.group}>
                                    <Text style={styles.label}>Discovered printers</Text>
                                    {printers.map((p) => (
                                        <View key={p.target} style={styles.printerRow}>
                                            <View style={styles.printerDetails}>
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

                            <View style={styles.group}>
                                <Text style={styles.label}>Saved printers</Text>
                                {printerSaved.length === 0 ? (
                                    <Text style={styles.helper}>No printers saved yet. Use discovery above.</Text>
                                ) : (
                                    printerSaved.map((p) => {
                                        const isSelected = p.target === printerSelectedTarget;
                                        return (
                                            <View key={p.target} style={styles.printerRow}>
                                                <View style={styles.printerDetails}>
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
                                <Text style={styles.label}>Print simulator</Text>
                                <Switch value={printerSimulator} onValueChange={setPrinterSimulator} />
                            </View>
                            <Text style={styles.helper}>Simulate printing with a modal. Good for development.</Text>

                            <View style={styles.switchRow}>
                                <Text style={styles.label}>Auto print new orders</Text>
                                <Switch value={printerAutoPrint} onValueChange={setPrinterAutoPrint} disabled={!printerEnabled} />
                            </View>

                            <TextInput
                                mode="outlined"
                                label="Auto-print delay (seconds)"
                                value={printerDelayPrintSecText}
                                onChangeText={setPrinterDelayPrintSecText}
                                keyboardType="number-pad"
                                style={styles.input}
                                disabled={!printerEnabled || !printerAutoPrint}
                            />
                            <Text style={styles.helper}>Wait before printing a new order (0 to 120).</Text>

                            <View style={styles.separator} />

                            <Text style={styles.label}>Paper & quality</Text>
                            <View style={styles.buttonGroup}>
                                <Button
                                    mode={printerPaperWidth === '80mm' ? 'contained' : 'outlined'}
                                    onPress={() => setPrinterPaperWidth('80mm')}
                                    style={styles.flexButton}
                                >
                                    80mm
                                </Button>
                                <Button
                                    mode={printerPaperWidth === '58mm' ? 'contained' : 'outlined'}
                                    onPress={() => setPrinterPaperWidth('58mm')}
                                    style={styles.flexButton}
                                >
                                    58mm
                                </Button>
                            </View>
                            <Text style={styles.helper}>Choose your paper width. 80mm is standard.</Text>

                            <View style={[styles.switchRow, { marginTop: 12 }]}>
                                <Text style={styles.label}>High quality capture (2x DPI)</Text>
                                <Switch value={printerHighQuality} onValueChange={setPrinterHighQuality} />
                            </View>
                            <Text style={styles.helper}>
                                Improves sharpness on higher-end thermal printers by capturing at 2x resolution.
                            </Text>

                            <Button
                                mode="outlined"
                                loading={testingPrinter}
                                disabled={testingPrinter}
                                onPress={handleTestPrint}
                                style={styles.previewButton}
                            >
                                Test print
                            </Button>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setActiveDialog(null)}>Done</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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
        marginBottom: 8,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 12,
        marginLeft: -8,
    },
    backButtonContent: {
        paddingHorizontal: 0,
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
    printerDetails: {
        flex: 1,
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
    separator: {
        height: 1,
        backgroundColor: '#e5e5e5',
        marginVertical: 16,
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    flexButton: {
        flex: 1,
    },
    group: {
        marginTop: 12,
    },
    dialog: {
        maxHeight: '88%',
    },
    dialogScrollArea: {
        paddingHorizontal: 0,
        maxHeight: 480,
    },
    dialogContent: {
        paddingHorizontal: 24,
        paddingBottom: 8,
    },
});
