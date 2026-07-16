import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Switch, Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { DEFAULT_APP_SETTINGS, type PrinterSectionAssignment } from '@/lib/settings';
import { playNewOrderSound, SOUND_OPTIONS, type SoundId } from '@/lib/sounds';
import { KITCHEN_SECTION_OPTIONS } from '@/utils/orderUtils';
import { usePrintersDiscovery } from 'react-native-esc-pos-printer';
import type { DeviceInfo } from 'react-native-esc-pos-printer';
import {
    DEFAULT_MANUAL_PRINTER_PORT,
    createManualSavedPrinter,
    buildTcpPrinterTarget,
    escposTestPrint,
    isSamePhysicalPrinter,
    isValidIpv4Address,
    isValidPrinterPort,
    mergeSavedPrinter,
    type SavedPrinter,
} from '@/lib/escpos-printer';
import { getDefaultPrinterAssignment, hasAnySimulatorAssignment, isDefaultPrinterAssignment } from '@/lib/printer-routing';
import { SettingsActionTile } from '@/components/settings/SettingsActionTile';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { useAppSettingsStore } from '@/stores/appSettingsStore';

type SettingsDialogKey = 'refresh' | 'sound' | 'printer' | 'liveOrders' | null;

const SETTINGS_MODAL_TITLES: Record<Exclude<SettingsDialogKey, null>, string> = {
    refresh: 'Refresh interval',
    sound: 'Order sound',
    printer: 'Kitchen printer',
    liveOrders: 'Live order cards',
};

export default function SettingsScreen() {
    const router = useRouter();
    const { data: currentSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
    const saveSettings = useAppSettingsStore((state) => state.saveSettings);
    const [activeDialog, setActiveDialog] = useState<SettingsDialogKey>(null);
    const [refreshIntervalSecText, setRefreshIntervalSecText] = useState(String(DEFAULT_APP_SETTINGS.refreshIntervalSec));
    const [soundEnabled, setSoundEnabled] = useState<boolean>(DEFAULT_APP_SETTINGS.soundEnabled);
    const [soundId, setSoundId] = useState<SoundId>(DEFAULT_APP_SETTINGS.soundId);
    const [repeatCountText, setRepeatCountText] = useState(String(DEFAULT_APP_SETTINGS.soundRepeatCount));
    const [liveOrderCardLayout, setLiveOrderCardLayout] = useState<'horizontal' | 'vertical'>(DEFAULT_APP_SETTINGS.liveOrderCardLayout);

    const [printerEnabled, setPrinterEnabled] = useState<boolean>(DEFAULT_APP_SETTINGS.printerEnabled);
    const [printerAutoPrint, setPrinterAutoPrint] = useState<boolean>(DEFAULT_APP_SETTINGS.printerAutoPrint);
    const [printerSaved, setPrinterSaved] = useState<SavedPrinter[]>(DEFAULT_APP_SETTINGS.printerSaved);
    const [printerSelectedTarget, setPrinterSelectedTarget] = useState<string | null>(DEFAULT_APP_SETTINGS.printerSelectedTarget);
    const [printerSectionAssignments, setPrinterSectionAssignments] = useState<PrinterSectionAssignment[]>(
        DEFAULT_APP_SETTINGS.printerSectionAssignments
    );
    const [printerSimulator, setPrinterSimulator] = useState<boolean>(DEFAULT_APP_SETTINGS.printerSimulator);
    const [printerDelayPrintSecText, setPrinterDelayPrintSecText] = useState(
        String(DEFAULT_APP_SETTINGS.printerDelayPrintSec)
    );
    const [printerPaperWidth, setPrinterPaperWidth] = useState<'58mm' | '80mm'>(DEFAULT_APP_SETTINGS.printerPaperWidth);
    const [printerHighQuality, setPrinterHighQuality] = useState<boolean>(DEFAULT_APP_SETTINGS.printerHighQuality);
    const [manualPrinterIp, setManualPrinterIp] = useState('');
    const [manualPrinterPortText, setManualPrinterPortText] = useState(String(DEFAULT_MANUAL_PRINTER_PORT));
    const [manualPrinterName, setManualPrinterName] = useState('');
    const [editingManualPrinterTarget, setEditingManualPrinterTarget] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);
    const [testingPrinter, setTestingPrinter] = useState(false);
    const [testingPrinterTarget, setTestingPrinterTarget] = useState<string | null>(null);
    const printerTestRunIdRef = useRef(0);
    const printerTestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { printers, isDiscovering, printerError, start, stop, pairBluetoothDevice } = usePrintersDiscovery();

    useEffect(() => {
        setRefreshIntervalSecText(String(currentSettings.refreshIntervalSec));
        setSoundEnabled(currentSettings.soundEnabled);
        setSoundId(currentSettings.soundId);
        setRepeatCountText(String(currentSettings.soundRepeatCount));
        setLiveOrderCardLayout(currentSettings.liveOrderCardLayout);

        setPrinterEnabled(currentSettings.printerEnabled);
        setPrinterAutoPrint(currentSettings.printerAutoPrint);
        setPrinterSaved(currentSettings.printerSaved);
        setPrinterSelectedTarget(currentSettings.printerSelectedTarget);
        setPrinterSectionAssignments(currentSettings.printerSectionAssignments);
        setPrinterSimulator(currentSettings.printerSimulator);
        setPrinterDelayPrintSecText(String(currentSettings.printerDelayPrintSec));
        setPrinterPaperWidth(currentSettings.printerPaperWidth);
        setPrinterHighQuality(currentSettings.printerHighQuality);
    }, [currentSettings]);

    const selectedSoundLabel = useMemo(
        () => SOUND_OPTIONS.find((o) => o.id === soundId)?.label ?? soundId,
        [soundId]
    );

    const defaultPrinterAssignment = useMemo(
        () => getDefaultPrinterAssignment({ printerSectionAssignments, printerSelectedTarget }),
        [printerSectionAssignments, printerSelectedTarget]
    );
    const defaultPrinterAssignmentId = defaultPrinterAssignment?.id || 'default-printer';

    const selectedPrinter = useMemo(
        () => printerSaved.find((printer) => printer.target === (defaultPrinterAssignment?.printerTarget || printerSelectedTarget)) || null,
        [defaultPrinterAssignment?.printerTarget, printerSaved, printerSelectedTarget]
    );

    const discoveredPrinterMatches = useMemo(
        () =>
            printers.map((printer) => {
                const exactSaved = printerSaved.find((saved) => saved.target === printer.target) || null;
                const matchedSaved =
                    exactSaved || printerSaved.find((saved) => isSamePhysicalPrinter(saved, printer)) || null;
                return {
                    printer,
                    exactSaved,
                    matchedSaved,
                    isSelected: printer.target === printerSelectedTarget || matchedSaved?.target === printerSelectedTarget,
                    needsReplacement: !!matchedSaved && matchedSaved.target !== printer.target,
                };
            }),
        [printerSaved, printerSelectedTarget, printers]
    );

    const refreshSummary = `Every ${refreshIntervalSecText} seconds`;
    const soundSummary = soundEnabled ? `${selectedSoundLabel} • ${repeatCountText} plays` : 'Disabled';
    const liveOrdersSummary = liveOrderCardLayout === 'vertical'
        ? 'Vertical cards with horizontal scrolling'
        : 'Full-width horizontal rows';
    const printerSummary = !printerEnabled
        ? printerSimulator || printerSectionAssignments.some((assignment) => assignment.useSimulator)
            ? 'Simulator'
            : 'Disabled'
        : `${selectedPrinter?.deviceName ?? (printerSimulator ? 'Simulator' : 'No default printer selected')} • ${Math.max(printerSectionAssignments.length - 1, 0)} section rule${printerSectionAssignments.length === 2 ? '' : 's'}`;
    const hasSimulatorRouting = hasAnySimulatorAssignment({ printerSectionAssignments, printerSimulator });
    const hasPrinterCapability = printerEnabled || hasSimulatorRouting;

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

    const clearPrinterTestingState = () => {
        if (printerTestTimeoutRef.current) {
            clearTimeout(printerTestTimeoutRef.current);
            printerTestTimeoutRef.current = null;
        }
        setTestingPrinter(false);
        setTestingPrinterTarget(null);
    };

    const handleStartDiscovery = async () => {
        try {
            if (isDiscovering) {
                stop();
                await new Promise((resolve) => setTimeout(resolve, 300));
            } else {
                try {
                    stop();
                } catch {
                    // Some native implementations throw when stop is called while idle.
                }
                await new Promise((resolve) => setTimeout(resolve, 300));
            }
            await start({ timeout: 8000, autoStop: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes('try to start search when search had been done')) {
                return;
            }
            Alert.alert('Printer discovery error', message || 'Failed to start printer discovery.');
        }
    };

    const beginPrinterTest = (target: string) => {
        const runId = printerTestRunIdRef.current + 1;
        printerTestRunIdRef.current = runId;
        if (printerTestTimeoutRef.current) {
            clearTimeout(printerTestTimeoutRef.current);
        }
        setTestingPrinter(true);
        setTestingPrinterTarget(target);
        printerTestTimeoutRef.current = setTimeout(() => {
            if (printerTestRunIdRef.current !== runId) return;
            clearPrinterTestingState();
            Alert.alert('Printer test timeout', 'The test print took too long to finish. The printer may still have received the job.');
        }, 15000);
        return runId;
    };

    const finishPrinterTest = (runId: number) => {
        if (printerTestRunIdRef.current !== runId) return;
        clearPrinterTestingState();
    };

    const handlePreview = async () => {
        const repeatCount = parseIntOr(repeatCountText, DEFAULT_APP_SETTINGS.soundRepeatCount);
        await playNewOrderSound({ soundId, repeatCount, delayMs: 2000 });
    };

    const handleTestPrint = async () => {
        const defaultTarget = defaultPrinterAssignment?.printerTarget || printerSelectedTarget;
        const selected = printerSaved.find((p) => p.target === defaultTarget) || null;
        if (!selected) {
            Alert.alert('Printer not selected', 'Please choose a default printer first.');
            return;
        }

        const runId = beginPrinterTest(selected.target);
        try {
            await escposTestPrint(selected, 1);
            Alert.alert('Success', 'Test print sent.');
        } catch (e) {
            Alert.alert('Printer error', e instanceof Error ? e.message : 'Failed to test print');
        } finally {
            finishPrinterTest(runId);
        }
    };

    const handleTestSpecificPrinter = async (printer: SavedPrinter) => {
        const runId = beginPrinterTest(printer.target);
        try {
            await escposTestPrint(printer, 1);
            Alert.alert('Success', `Test print sent to ${printer.deviceName}.`);
        } catch (e) {
            Alert.alert('Printer error', e instanceof Error ? e.message : 'Failed to test print');
        } finally {
            finishPrinterTest(runId);
        }
    };

    useEffect(() => () => {
        if (printerTestTimeoutRef.current) {
            clearTimeout(printerTestTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (printerError && (printerError as any)?.message) {
            const message = String((printerError as any).message);
            if (message.toLowerCase().includes('try to start search when search had been done')) {
                return;
            }
            Alert.alert('Printer discovery error', message);
        }
    }, [printerError]);

    const toSavedPrinter = (p: DeviceInfo): SavedPrinter => ({
        target: p.target,
        deviceName: p.deviceName,
        driver: 'epsonSdk',
        ipAddress: p.ipAddress,
        macAddress: p.macAddress,
        bdAddress: p.bdAddress,
        deviceType: p.deviceType,
    });

    const addDiscoveredPrinter = async (p: DeviceInfo, options?: { replaceExisting?: boolean }) => {
        const hasBluetoothIdentity = !!p.bdAddress;
        if (hasBluetoothIdentity && p.macAddress) {
            try {
                await pairBluetoothDevice(p.macAddress);
            } catch {
                // Pairing may be unsupported or already completed.
            }
        }

        const saved = toSavedPrinter(p);

        setPrinterSaved((prev) => {
            const exactIndex = prev.findIndex((existing) => existing.target === saved.target);
            if (exactIndex >= 0) {
                const next = [...prev];
                next[exactIndex] = mergeSavedPrinter(next[exactIndex], saved);
                return next;
            }

            const matchedIndex = prev.findIndex((existing) => isSamePhysicalPrinter(existing, saved));
            if (matchedIndex >= 0 && options?.replaceExisting === true) {
                const next = [...prev];
                next[matchedIndex] = mergeSavedPrinter(prev[matchedIndex], saved);
                return next;
            }

            return [saved, ...prev];
        });

        setPrinterSelectedTarget(saved.target);
        setPrinterSectionAssignments((prev) => {
            const hasDefault = prev.some((assignment) => isDefaultPrinterAssignment(assignment));
            if (!hasDefault) {
                return [{
                    id: 'default-printer',
                    sectionName: 'Default',
                    printerTarget: saved.target,
                    isDefault: true,
                }, ...prev];
            }

            return prev.map((assignment) => (
                isDefaultPrinterAssignment(assignment)
                    ? { ...assignment, printerTarget: saved.target, isDefault: true, sectionName: 'Default' }
                    : assignment
            ));
        });
        setPrinterEnabled(true);
        Alert.alert('Printer added', `${saved.deviceName} was added to saved printers.`);
    };

    const removeSavedPrinter = (target: string) => {
        setPrinterSaved((prev) => prev.filter((printer) => printer.target !== target));
        setPrinterSelectedTarget((current) => (current === target ? null : current));
        setPrinterSectionAssignments((prev) => prev.map((assignment) => (
            assignment.printerTarget === target
                ? { ...assignment, printerTarget: null }
                : assignment
        )));
        if (editingManualPrinterTarget === target) {
            setEditingManualPrinterTarget(null);
            setManualPrinterIp('');
            setManualPrinterPortText(String(DEFAULT_MANUAL_PRINTER_PORT));
            setManualPrinterName('');
        }
    };

    const resetManualPrinterForm = () => {
        setEditingManualPrinterTarget(null);
        setManualPrinterIp('');
        setManualPrinterPortText(String(DEFAULT_MANUAL_PRINTER_PORT));
        setManualPrinterName('');
    };

    const startEditingManualPrinter = (printer: SavedPrinter) => {
        setEditingManualPrinterTarget(printer.target);
        setManualPrinterIp(printer.ipAddress?.trim() || '');
        setManualPrinterPortText(String(printer.port ?? DEFAULT_MANUAL_PRINTER_PORT));
        setManualPrinterName(printer.deviceName || '');
    };

    const handleManualPrinterAdd = () => {
        const ipAddress = manualPrinterIp.trim();
        const deviceName = manualPrinterName.trim();
        const port = parseIntOr(manualPrinterPortText, DEFAULT_MANUAL_PRINTER_PORT);

        if (!isValidIpv4Address(ipAddress)) {
            Alert.alert('Invalid IP address', 'Enter a valid IPv4 address like 192.168.1.50.');
            return;
        }
        if (!isValidPrinterPort(port)) {
            Alert.alert('Invalid port', 'Enter a printer port between 1 and 65535. Port 9100 is the usual default.');
            return;
        }

        const target = buildTcpPrinterTarget(ipAddress, port);
        const editingPrinter = editingManualPrinterTarget
            ? printerSaved.find((printer) => printer.target === editingManualPrinterTarget) || null
            : null;
        const existingByTarget = printerSaved.find((printer) => printer.target === target) || null;
        const existingByIp = printerSaved.find((printer) => (
            printer.ipAddress?.trim() === ipAddress && (printer.port ?? DEFAULT_MANUAL_PRINTER_PORT) === port
        )) || null;
        const existing = editingPrinter || existingByTarget || existingByIp;

        if (existing) {
            const updatedPrinter: SavedPrinter = {
                ...existing,
                ...createManualSavedPrinter(ipAddress, deviceName || existing.deviceName, port),
                deviceName: deviceName || existing.deviceName,
            };
            setPrinterSaved((prev) => prev.map((printer) => (
                printer.target === existing.target ? updatedPrinter : printer
            )));
            setPrinterSelectedTarget(updatedPrinter.target);
            setPrinterSectionAssignments((prev) => prev.map((assignment) => (
                assignment.printerTarget === existing.target
                    ? { ...assignment, printerTarget: updatedPrinter.target }
                    : assignment
            )));
            setPrinterEnabled(true);
            resetManualPrinterForm();
            Alert.alert('Printer updated', `${updatedPrinter.deviceName} is ready to use.`);
            return;
        }

        const manualPrinter = createManualSavedPrinter(ipAddress, deviceName, port);
        setPrinterSaved((prev) => [manualPrinter, ...prev]);
        setPrinterSelectedTarget(manualPrinter.target);
        updatePrinterAssignmentTarget(defaultPrinterAssignmentId, manualPrinter.target);
        setPrinterEnabled(true);
        resetManualPrinterForm();
        Alert.alert('Printer added', `${manualPrinter.deviceName} was added as the default printer.`);
    };

    useEffect(() => {
        if (printers.length === 0) return;

        setPrinterSaved((prev) => {
            let changed = false;
            const next = [...prev];

            for (const discovered of printers) {
                const savedPrinter = toSavedPrinter(discovered);
                const matchedIndex = next.findIndex((existing) => isSamePhysicalPrinter(existing, savedPrinter));
                if (matchedIndex >= 0 && next[matchedIndex].target !== savedPrinter.target) {
                    next[matchedIndex] = mergeSavedPrinter(next[matchedIndex], savedPrinter);
                    changed = true;
                }
            }

            return changed ? next : prev;
        });

        setPrinterSectionAssignments((prev) => {
            let changed = false;
            const next = prev.map((assignment) => {
                if (!assignment.printerTarget) return assignment;
                const currentSaved = printerSaved.find((printer) => printer.target === assignment.printerTarget) || null;
                if (!currentSaved) return assignment;
                const matched = printers.find((printer) => isSamePhysicalPrinter(currentSaved, printer));
                if (!matched || matched.target === assignment.printerTarget) return assignment;
                changed = true;
                return { ...assignment, printerTarget: matched.target };
            });
            return changed ? next : prev;
        });

        setPrinterSelectedTarget((current) => {
            if (!current) return current;
            const currentSaved = printerSaved.find((printer) => printer.target === current) || null;
            if (!currentSaved) return current;

            const matched = printers.find((printer) => isSamePhysicalPrinter(currentSaved, printer));
            if (!matched || matched.target === current) return current;
            return matched.target;
        });
    }, [printerSaved, printers]);

    const updatePrinterAssignmentTarget = (assignmentId: string, target: string | null) => {
        setPrinterSectionAssignments((prev) => prev.map((assignment) => (
            assignment.id === assignmentId ? { ...assignment, printerTarget: target } : assignment
        )));
    };

    const updatePrinterAssignmentSimulator = (assignmentId: string, useSimulator: boolean) => {
        setPrinterSectionAssignments((prev) => prev.map((assignment) => (
            assignment.id === assignmentId ? { ...assignment, useSimulator } : assignment
        )));
    };

    const updatePrinterAssignmentPrintMode = (assignmentId: string, printMode: 'combine' | 'separate') => {
        setPrinterSectionAssignments((prev) => prev.map((assignment) => (
            assignment.id === assignmentId ? { ...assignment, printMode } : assignment
        )));
    };

    const updatePrinterAssignmentSection = (assignmentId: string, sectionName: string) => {
        setPrinterSectionAssignments((prev) => prev.map((assignment) => (
            assignment.id === assignmentId
                ? {
                    ...assignment,
                    sectionName: assignment.isDefault ? 'Default' : sectionName,
                }
                : assignment
        )));
    };

    const addPrinterSectionAssignment = () => {
        setPrinterSectionAssignments((prev) => [
            ...prev,
            {
                id: `assignment-${Date.now()}`,
                sectionName: '',
                printerTarget: null,
                isDefault: false,
            },
        ]);
    };

    const removePrinterSectionAssignment = (assignmentId: string) => {
        setPrinterSectionAssignments((prev) => prev.filter((assignment) => assignment.id !== assignmentId));
    };

    const handleSave = async () => {
        const refreshIntervalSec = parseIntOr(refreshIntervalSecText, DEFAULT_APP_SETTINGS.refreshIntervalSec);
        const soundRepeatCount = parseIntOr(repeatCountText, DEFAULT_APP_SETTINGS.soundRepeatCount);
        const printerDelayPrintSec = parseIntOr(printerDelayPrintSecText, DEFAULT_APP_SETTINGS.printerDelayPrintSec);

        if (refreshIntervalSec < 5 || refreshIntervalSec > 600) {
            Alert.alert('Invalid refresh interval', 'Please enter a value between 5 and 600 seconds.');
            return;
        }
        if (soundRepeatCount < 1 || soundRepeatCount > 10) {
            Alert.alert('Invalid play count', 'Please enter a value between 1 and 10.');
            return;
        }
        if (printerDelayPrintSec < 0 || printerDelayPrintSec > 120) {
            Alert.alert('Invalid print delay', 'Please enter a value between 0 and 120 seconds.');
            return;
        }

        const normalizedAssignments = printerSectionAssignments.map((assignment) => ({
            ...assignment,
            sectionName: assignment.isDefault ? 'Default' : assignment.sectionName.trim(),
        }));
        const nonDefaultAssignments = normalizedAssignments.filter((assignment) => !assignment.isDefault);
        const missingSectionName = nonDefaultAssignments.find((assignment) => !assignment.sectionName);
        if (missingSectionName) {
            Alert.alert('Missing section name', 'Each section printer rule needs a section name.');
            return;
        }

        const duplicateSection = nonDefaultAssignments.find((assignment, index) => (
            nonDefaultAssignments.findIndex((candidate) => candidate.sectionName.trim().toLowerCase() === assignment.sectionName.trim().toLowerCase()) !== index
        ));
        if (duplicateSection) {
            Alert.alert('Duplicate section', `Section "${duplicateSection.sectionName}" is listed more than once.`);
            return;
        }

        try {
            setSaving(true);
            await saveSettings({
                refreshIntervalSec,
                soundEnabled,
                soundId,
                soundRepeatCount,
                liveOrderCardLayout,
                printerEnabled,
                printerAutoPrint,
                printerSelectedTarget,
                printerSaved,
                printerSectionAssignments: normalizedAssignments,
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
                    title="Live order cards"
                    description={liveOrdersSummary}
                    icon="view-carousel-outline"
                    onPress={() => setActiveDialog('liveOrders')}
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

            <Modal
                visible={activeDialog !== null}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setActiveDialog(null)}
            >
                <View style={styles.modalScreen}>
                    <Appbar.Header style={styles.modalHeader}>
                        <Appbar.BackAction onPress={() => setActiveDialog(null)} iconColor="#fff" />
                        <Appbar.Content
                            title={activeDialog ? SETTINGS_MODAL_TITLES[activeDialog] : 'Settings'}
                            titleStyle={styles.modalHeaderTitle}
                        />
                    </Appbar.Header>
                    <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                        {activeDialog === 'refresh' && (
                            <>
                        <TextInput
                            mode="outlined"
                            label="Refresh interval (seconds)"
                            value={refreshIntervalSecText}
                            onChangeText={setRefreshIntervalSecText}
                            keyboardType="number-pad"
                            style={styles.input}
                        />
                        <Text style={styles.helper}>Min 5, max 600.</Text>
                            </>
                        )}

                        {activeDialog === 'sound' && (
                            <>
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
                            </>
                        )}

                        {activeDialog === 'liveOrders' && (
                            <>
                        <Text style={styles.label}>Display mode</Text>
                        <View style={styles.buttonGroup}>
                            <Button
                                mode={liveOrderCardLayout === 'vertical' ? 'contained' : 'outlined'}
                                onPress={() => setLiveOrderCardLayout('vertical')}
                                style={styles.flexButton}
                            >
                                Vertical
                            </Button>
                            <Button
                                mode={liveOrderCardLayout === 'horizontal' ? 'contained' : 'outlined'}
                                onPress={() => setLiveOrderCardLayout('horizontal')}
                                style={styles.flexButton}
                            >
                                Horizontal
                            </Button>
                        </View>
                        <Text style={styles.helper}>Vertical uses compact queue cards with horizontal scrolling. Horizontal keeps the full-width row list.</Text>
                            </>
                        )}

                        {activeDialog === 'printer' && (
                            <>
                            <View style={styles.switchRow}>
                                <Text style={styles.label}>Enable Epson printer</Text>
                                <Switch value={printerEnabled} onValueChange={setPrinterEnabled} />
                            </View>

                            <Button
                                mode="outlined"
                                onPress={() => void handleStartDiscovery()}
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

                            <View style={styles.group}>
                                <Text style={styles.label}>Add printer manually</Text>
                                <TextInput
                                    mode="outlined"
                                    label="Printer IP address"
                                    value={manualPrinterIp}
                                    onChangeText={setManualPrinterIp}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="decimal-pad"
                                    placeholder="192.168.1.50"
                                    style={styles.input}
                                />
                                <TextInput
                                    mode="outlined"
                                    label="Printer port"
                                    value={manualPrinterPortText}
                                    onChangeText={setManualPrinterPortText}
                                    keyboardType="number-pad"
                                    placeholder={String(DEFAULT_MANUAL_PRINTER_PORT)}
                                    style={styles.input}
                                />
                                <TextInput
                                    mode="outlined"
                                    label="Printer name (optional)"
                                    value={manualPrinterName}
                                    onChangeText={setManualPrinterName}
                                    autoCapitalize="words"
                                    style={styles.input}
                                />
                                <Text style={styles.helper}>Use this when discovery misses a network printer. Port defaults to 9100, which is the usual raw TCP printer port.</Text>
                                <View style={styles.buttonGroup}>
                                    <Button mode="contained-tonal" onPress={handleManualPrinterAdd} style={styles.flexButton}>
                                        {editingManualPrinterTarget ? 'Update manual printer' : 'Add manual printer'}
                                    </Button>
                                    {editingManualPrinterTarget ? (
                                        <Button mode="text" onPress={resetManualPrinterForm} style={styles.flexButton}>
                                            Cancel edit
                                        </Button>
                                    ) : null}
                                </View>
                            </View>

                            {printers.length > 0 && (
                                <View style={styles.group}>
                                    <Text style={styles.label}>Discovered printers</Text>
                                    {discoveredPrinterMatches.map(({ printer: p, matchedSaved, isSelected, needsReplacement }) => (
                                        <View key={p.target} style={styles.printerCard}>
                                            <View style={styles.printerDetails}>
                                                <Text style={styles.printerName}>{p.deviceName}</Text>
                                                <Text style={styles.printerMeta}>
                                                    {p.ipAddress || p.macAddress || p.bdAddress || p.target}
                                                </Text>
                                                {matchedSaved ? (
                                                    <Text style={styles.helper}>
                                                        {needsReplacement
                                                            ? `Matches saved printer. Old address: ${matchedSaved.ipAddress || matchedSaved.target}`
                                                            : 'Already saved'}
                                                    </Text>
                                                ) : (
                                                    <Text style={styles.helper}>New printer</Text>
                                                )}
                                            </View>
                                            <View style={styles.printerActions}>
                                                <Button
                                                    mode={matchedSaved ? (isSelected ? 'contained' : 'outlined') : 'contained-tonal'}
                                                    onPress={() => void addDiscoveredPrinter(p, { replaceExisting: needsReplacement })}
                                                >
                                                    {needsReplacement ? 'Replace saved' : matchedSaved ? (isSelected ? 'Saved' : 'Update saved') : 'Add'}
                                                </Button>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={styles.group}>
                                <Text style={styles.label}>Saved printers</Text>
                                <Text style={styles.helper}>Each printer can be tested on its own. Set the default printer for fallback routing.</Text>
                                {printerSaved.length === 0 ? (
                                    <Text style={styles.helper}>No printers saved yet. Use discovery or add one manually above.</Text>
                                ) : (
                                    printerSaved.map((p) => {
                                        const isSelected = p.target === printerSelectedTarget;
                                        const isTestingThisPrinter = testingPrinter && testingPrinterTarget === p.target;
                                        return (
                                            <View key={p.target} style={[styles.printerCard, styles.savedPrinterCard, isSelected ? styles.selectedPrinterCard : null]}>
                                                <View style={styles.printerDetails}>
                                                    <View style={styles.printerHeaderRow}>
                                                        <Text style={styles.printerName}>{p.deviceName}</Text>
                                                        <View style={[styles.printerBadge, isSelected ? styles.printerBadgeDefault : styles.printerBadgeSaved]}>
                                                            <Text style={styles.printerBadgeText}>{isSelected ? 'Default' : 'Saved'}</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.printerMeta}>
                                                        {p.ipAddress ? `${p.ipAddress}:${p.port ?? DEFAULT_MANUAL_PRINTER_PORT}` : (p.macAddress || p.bdAddress || p.target)}
                                                    </Text>
                                                    <Text style={styles.helper}>
                                                        {p.ipAddress
                                                            ? `Network printer${(p.port ?? DEFAULT_MANUAL_PRINTER_PORT) === DEFAULT_MANUAL_PRINTER_PORT ? ' • port 9100' : ` • port ${p.port}`}`
                                                            : 'Discovered printer'}
                                                    </Text>
                                                </View>
                                                <View style={[styles.printerActions, styles.savedPrinterActions]}>
                                                    <Button
                                                        mode={isSelected ? 'contained' : 'outlined'}
                                                        onPress={() => {
                                                            setPrinterSelectedTarget(p.target);
                                                            updatePrinterAssignmentTarget(defaultPrinterAssignmentId, p.target);
                                                        }}
                                                        disabled={testingPrinter}
                                                    >
                                                        {isSelected ? 'Default' : 'Set default'}
                                                    </Button>
                                                    <Button
                                                        mode="outlined"
                                                        icon="printer-check"
                                                        loading={isTestingThisPrinter}
                                                        disabled={testingPrinter}
                                                        onPress={() => void handleTestSpecificPrinter(p)}
                                                    >
                                                        Test
                                                    </Button>
                                                    {p.driver === 'rawTcp' ? (
                                                        <Button
                                                            mode="text"
                                                            onPress={() => startEditingManualPrinter(p)}
                                                            disabled={testingPrinter}
                                                        >
                                                            Edit
                                                        </Button>
                                                    ) : null}
                                                    <Button mode="text" onPress={() => removeSavedPrinter(p.target)}>
                                                        Remove
                                                    </Button>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>

                            <View style={styles.separator} />

                            <Text style={styles.label}>Section printers</Text>
                            <Text style={styles.helper}>Default printer is the fallback. `Combine` prints the full ticket. `Separate` prints only that section. If a section rule has no printer and simulator is off, that section will be skipped.</Text>
                            {printerSectionAssignments.map((assignment) => {
                                const assignmentPrinter = printerSaved.find((printer) => printer.target === assignment.printerTarget) || null;
                                return (
                                    <View key={assignment.id} style={styles.assignmentCard}>
                                        {assignment.isDefault ? (
                                            <TextInput
                                                mode="outlined"
                                                label="Default section"
                                                value="Default"
                                                disabled
                                                style={styles.input}
                                            />
                                        ) : (
                                            <Button
                                                mode="outlined"
                                                style={styles.selectButton}
                                                onPress={() => Alert.alert(
                                                    'Select section',
                                                    undefined,
                                                    [
                                                        ...KITCHEN_SECTION_OPTIONS.map((section) => ({
                                                            text: section,
                                                            onPress: () => updatePrinterAssignmentSection(assignment.id, section),
                                                        })),
                                                        { text: 'Cancel', style: 'cancel' as const },
                                                    ]
                                                )}
                                            >
                                                {assignment.sectionName || 'Select section'}
                                            </Button>
                                        )}
                                        <Button
                                            mode="outlined"
                                            style={styles.selectButton}
                                            onPress={() => Alert.alert(
                                                assignment.isDefault ? 'Choose default printer' : `Choose printer for ${assignment.sectionName || 'this section'}`,
                                                undefined,
                                                [
                                                    ...printerSaved.map((printer) => ({
                                                        text: printer.deviceName,
                                                        onPress: () => updatePrinterAssignmentTarget(assignment.id, printer.target),
                                                    })),
                                                    { text: 'Clear', onPress: () => updatePrinterAssignmentTarget(assignment.id, null) },
                                                    { text: 'Cancel', style: 'cancel' as const },
                                                ]
                                            )}
                                        >
                                            {assignmentPrinter?.deviceName || (assignment.isDefault ? 'Select default printer' : 'No printer (skip)')}
                                        </Button>
                                        <View style={[styles.switchRow, styles.assignmentSwitchRow]}>
                                            <Text style={styles.label}>Use simulator for this section</Text>
                                            <Switch
                                                value={!!assignment.useSimulator}
                                                onValueChange={(value) => updatePrinterAssignmentSimulator(assignment.id, value)}
                                            />
                                        </View>
                                        <Text style={[styles.label, styles.assignmentSubLabel]}>Print mode</Text>
                                        <View style={styles.buttonGroup}>
                                            <Button
                                                mode={(assignment.printMode || 'combine') === 'combine' ? 'contained' : 'outlined'}
                                                onPress={() => updatePrinterAssignmentPrintMode(assignment.id, 'combine')}
                                                style={styles.flexButton}
                                            >
                                                Combine
                                            </Button>
                                            <Button
                                                mode={assignment.printMode === 'separate' ? 'contained' : 'outlined'}
                                                onPress={() => updatePrinterAssignmentPrintMode(assignment.id, 'separate')}
                                                style={styles.flexButton}
                                            >
                                                Separate
                                            </Button>
                                        </View>
                                        {!assignment.isDefault && (
                                            <Button mode="text" onPress={() => removePrinterSectionAssignment(assignment.id)}>
                                                Remove section rule
                                            </Button>
                                        )}
                                    </View>
                                );
                            })}
                            <Button mode="contained-tonal" onPress={addPrinterSectionAssignment} style={styles.previewButton}>
                                Add section printer
                            </Button>

                            <View style={styles.switchRow}>
                                <Text style={styles.label}>Legacy simulator fallback</Text>
                                <Switch value={printerSimulator} onValueChange={setPrinterSimulator} />
                            </View>
                            <Text style={styles.helper}>Keeps the old all-sections simulator behavior. Section simulator rules above are more flexible.</Text>

                            <View style={styles.switchRow}>
                                <Text style={styles.label}>Auto print new orders</Text>
                                <Switch value={printerAutoPrint} onValueChange={setPrinterAutoPrint} disabled={!hasPrinterCapability} />
                            </View>

                            <TextInput
                                mode="outlined"
                                label="Auto-print delay (seconds)"
                                value={printerDelayPrintSecText}
                                onChangeText={setPrinterDelayPrintSecText}
                                keyboardType="number-pad"
                                style={styles.input}
                                disabled={!hasPrinterCapability || !printerAutoPrint}
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
                                loading={testingPrinter && testingPrinterTarget === (defaultPrinterAssignment?.printerTarget || printerSelectedTarget)}
                                disabled={testingPrinter}
                                onPress={handleTestPrint}
                                style={styles.previewButton}
                            >
                                Test default printer
                            </Button>
                            </>
                        )}
                    </ScrollView>
                    <View style={styles.modalFooter}>
                        <Button mode="text" onPress={() => setActiveDialog(null)}>
                            Done
                        </Button>
                    </View>
                </View>
            </Modal>
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
    modalScreen: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    modalHeader: {
        backgroundColor: '#10243f',
    },
    modalHeaderTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    modalContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 120,
    },
    modalFooter: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#d7dee7',
        backgroundColor: '#fbfdff',
        alignItems: 'flex-end',
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
    printerCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ececec',
        marginTop: 8,
    },
    printerDetails: {
        flex: 1,
    },
    printerActions: {
        alignItems: 'flex-end',
        gap: 6,
    },
    savedPrinterCard: {
        alignItems: 'stretch',
        paddingVertical: 14,
    },
    selectedPrinterCard: {
        borderColor: '#93c5fd',
        backgroundColor: '#f8fbff',
    },
    savedPrinterActions: {
        minWidth: 120,
    },
    printerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 4,
    },
    printerBadge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    printerBadgeDefault: {
        backgroundColor: '#dbeafe',
    },
    printerBadgeSaved: {
        backgroundColor: '#e5e7eb',
    },
    printerBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
    },
    assignmentCard: {
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ececec',
    },
    assignmentSwitchRow: {
        marginTop: 12,
        marginBottom: 0,
    },
    assignmentSubLabel: {
        marginTop: 12,
        marginBottom: 8,
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
});
