import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Switch, Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { DEFAULT_APP_SETTINGS, type PrinterSectionAssignment } from '@/lib/settings';
import { playNewOrderSound, SOUND_OPTIONS, type SoundId } from '@/lib/sounds';
import { PRINT_SECTION_OPTIONS } from '@/utils/orderUtils';
import { usePrintersDiscovery } from 'react-native-esc-pos-printer';
import type { DeviceInfo } from 'react-native-esc-pos-printer';
import {
    DEFAULT_SIMULATOR_PRINTER_NAME,
    DEFAULT_MANUAL_PRINTER_PORT,
    createSimulatorSavedPrinter,
    createManualSavedPrinter,
    buildTcpPrinterTarget,
    getPrinterDriver,
    isSimulatorPrinter,
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
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
import { posCatalogCacheStore } from '@/stores/posCatalogCacheStore';
import { JOURNAL_LOGS_ENABLED } from '@/lib/journal-config';
import { DEFAULT_STORE_INFO, fetchStoreInfo, saveStoreInfo, type StoreInfo } from '@/lib/store-info';
import { invalidateLocalMarketplaceSession } from '@/lib/marketplace-local-session';

type SettingsDialogKey = 'refresh' | 'sound' | 'printer' | 'liveOrders' | 'marketplace' | 'printDiagnostics' | 'journal' | 'storeInfo' | null;

const SETTINGS_MODAL_TITLES: Record<Exclude<SettingsDialogKey, null>, string> = {
    refresh: 'Refresh interval',
    sound: 'Order sound',
    printer: 'Kitchen printer',
    liveOrders: 'Live order cards',
    marketplace: 'Marketplace',
    printDiagnostics: 'Print diagnostics',
    journal: 'Journal',
    storeInfo: 'Store information',
};

export default function SettingsScreen() {
    const router = useRouter();
    const { data: currentSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
    const saveSettings = useAppSettingsStore((state) => state.saveSettings);
    const journalEntries = usePrinterAutomationStore((state) => state.journalEntries);
    const clearJournal = usePrinterAutomationStore((state) => state.clearJournal);
    const [activeDialog, setActiveDialog] = useState<SettingsDialogKey>(null);
    const [refreshIntervalSecText, setRefreshIntervalSecText] = useState(String(DEFAULT_APP_SETTINGS.refreshIntervalSec));
    const [soundEnabled, setSoundEnabled] = useState<boolean>(DEFAULT_APP_SETTINGS.soundEnabled);
    const [soundId, setSoundId] = useState<SoundId>(DEFAULT_APP_SETTINGS.soundId);
    const [repeatCountText, setRepeatCountText] = useState(String(DEFAULT_APP_SETTINGS.soundRepeatCount));
    const [liveOrderCardLayout, setLiveOrderCardLayout] = useState<'horizontal' | 'vertical'>(DEFAULT_APP_SETTINGS.liveOrderCardLayout);
    const [marketplaceAutoSyncEnabled, setMarketplaceAutoSyncEnabled] = useState(DEFAULT_APP_SETTINGS.marketplaceAutoSyncEnabled);
    const [marketplaceSyncIntervalSecText, setMarketplaceSyncIntervalSecText] = useState(String(DEFAULT_APP_SETTINGS.marketplaceSyncIntervalSec));
    const [marketplaceFetchMode, setMarketplaceFetchMode] = useState<'api' | 'local'>(DEFAULT_APP_SETTINGS.marketplaceFetchMode);
    const [registerName, setRegisterName] = useState(DEFAULT_APP_SETTINGS.registerName);
    const [printerDebugFooter, setPrinterDebugFooter] = useState(DEFAULT_APP_SETTINGS.printerDebugFooter);

    const [printerEnabled, setPrinterEnabled] = useState<boolean>(DEFAULT_APP_SETTINGS.printerEnabled);
    const [printerAutoPrint, setPrinterAutoPrint] = useState<boolean>(DEFAULT_APP_SETTINGS.printerAutoPrint);
    const [instoreCustomerReceiptAutoPrintEnabled, setInstoreCustomerReceiptAutoPrintEnabled] = useState(DEFAULT_APP_SETTINGS.instoreCustomerReceiptAutoPrintEnabled);
    const [instoreCustomerReceiptPrinterTarget, setInstoreCustomerReceiptPrinterTarget] = useState<string | null>(DEFAULT_APP_SETTINGS.instoreCustomerReceiptPrinterTarget);
    const [instoreCustomerReceiptEnabledFromTime, setInstoreCustomerReceiptEnabledFromTime] = useState(DEFAULT_APP_SETTINGS.instoreCustomerReceiptEnabledFromTime || '');
    const [instoreCustomerReceiptEnabledToTime, setInstoreCustomerReceiptEnabledToTime] = useState(DEFAULT_APP_SETTINGS.instoreCustomerReceiptEnabledToTime || '');
    const [instoreInstantTicketEnabled, setInstoreInstantTicketEnabled] = useState(DEFAULT_APP_SETTINGS.instoreInstantTicketEnabled);
    const [instoreInstantTicketPrinterTarget, setInstoreInstantTicketPrinterTarget] = useState<string | null>(DEFAULT_APP_SETTINGS.instoreInstantTicketPrinterTarget);
    const [printerSaved, setPrinterSaved] = useState<SavedPrinter[]>(DEFAULT_APP_SETTINGS.printerSaved);
    const [printerSelectedTarget, setPrinterSelectedTarget] = useState<string | null>(DEFAULT_APP_SETTINGS.printerSelectedTarget);
    const [printerSectionAssignments, setPrinterSectionAssignments] = useState<PrinterSectionAssignment[]>(
        DEFAULT_APP_SETTINGS.printerSectionAssignments
    );
    const [printerDelayPrintSecText, setPrinterDelayPrintSecText] = useState(
        String(DEFAULT_APP_SETTINGS.printerDelayPrintSec)
    );
    const [printerPaperWidth, setPrinterPaperWidth] = useState<'58mm' | '80mm'>(DEFAULT_APP_SETTINGS.printerPaperWidth);
    const [printerReceiptMode, setPrinterReceiptMode] = useState(DEFAULT_APP_SETTINGS.printerReceiptMode);
    const [printerHighQuality, setPrinterHighQuality] = useState<boolean>(DEFAULT_APP_SETTINGS.printerHighQuality);
    const [manualPrinterIp, setManualPrinterIp] = useState('');
    const [manualPrinterPortText, setManualPrinterPortText] = useState(String(DEFAULT_MANUAL_PRINTER_PORT));
    const [manualPrinterName, setManualPrinterName] = useState('');
    const [manualPrinterDriver, setManualPrinterDriver] = useState<'rawTcp' | 'simulator'>('rawTcp');
    const [editingManualPrinterTarget, setEditingManualPrinterTarget] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);
    const [storeInfo, setStoreInfo] = useState<StoreInfo>(DEFAULT_STORE_INFO);

    const { printers, isDiscovering, printerError, start, stop, pairBluetoothDevice } = usePrintersDiscovery();

    useEffect(() => {
        void fetchStoreInfo().then(setStoreInfo).catch(() => undefined);
        setRefreshIntervalSecText(String(currentSettings.refreshIntervalSec));
        setSoundEnabled(currentSettings.soundEnabled);
        setSoundId(currentSettings.soundId);
        setRepeatCountText(String(currentSettings.soundRepeatCount));
        setLiveOrderCardLayout(currentSettings.liveOrderCardLayout);
        setMarketplaceAutoSyncEnabled(currentSettings.marketplaceAutoSyncEnabled);
        setMarketplaceSyncIntervalSecText(String(currentSettings.marketplaceSyncIntervalSec));
        setMarketplaceFetchMode(currentSettings.marketplaceFetchMode);
        setRegisterName(currentSettings.registerName);
        setPrinterDebugFooter(currentSettings.printerDebugFooter);

        setPrinterEnabled(currentSettings.printerEnabled);
        setPrinterAutoPrint(currentSettings.printerAutoPrint);
        setInstoreCustomerReceiptAutoPrintEnabled(currentSettings.instoreCustomerReceiptAutoPrintEnabled);
        setInstoreCustomerReceiptPrinterTarget(currentSettings.instoreCustomerReceiptPrinterTarget);
        setInstoreCustomerReceiptEnabledFromTime(currentSettings.instoreCustomerReceiptEnabledFromTime || '');
        setInstoreCustomerReceiptEnabledToTime(currentSettings.instoreCustomerReceiptEnabledToTime || '');
        setInstoreInstantTicketEnabled(currentSettings.instoreInstantTicketEnabled);
        setInstoreInstantTicketPrinterTarget(currentSettings.instoreInstantTicketPrinterTarget);
        setPrinterSaved(currentSettings.printerSaved);
        setPrinterSelectedTarget(currentSettings.printerSelectedTarget);
        setPrinterSectionAssignments(currentSettings.printerSectionAssignments);
        setPrinterDelayPrintSecText(String(currentSettings.printerDelayPrintSec));
        setPrinterPaperWidth(currentSettings.printerPaperWidth);
        setPrinterReceiptMode(currentSettings.printerReceiptMode);
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
        ? printerSectionAssignments.some((assignment) => {
            const printer = printerSaved.find((item) => item.target === assignment.printerTarget) || null;
            return isSimulatorPrinter(printer);
        })
            ? 'Simulator'
            : 'Disabled'
        : `${selectedPrinter?.deviceName ?? 'No default printer selected'} • ${Math.max(printerSectionAssignments.length - 1, 0)} section rule${printerSectionAssignments.length === 2 ? '' : 's'}`;
    const hasSimulatorRouting = hasAnySimulatorAssignment({ printerSectionAssignments });
    const hasPrinterCapability = printerEnabled || hasSimulatorRouting;
    const savedPhysicalPrinters = useMemo(
        () => printerSaved.filter((printer) => !isSimulatorPrinter(printer)),
        [printerSaved]
    );
    const hasInstantTicketPrinterCapability = printerEnabled && savedPhysicalPrinters.length > 0;
    const recentJournalLabel = journalEntries.length === 0
        ? 'No logs yet'
        : `${journalEntries.length} recent entr${journalEntries.length === 1 ? 'y' : 'ies'}`;
    const logLevelBadgeStyles = {
        info: styles.logLevelBadgeinfo,
        decision: styles.logLevelBadgedecision,
        success: styles.logLevelBadgesuccess,
        error: styles.logLevelBadgeerror,
    };

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

    const handlePreview = async () => {
        const repeatCount = parseIntOr(repeatCountText, DEFAULT_APP_SETTINGS.soundRepeatCount);
        await playNewOrderSound({ soundId, repeatCount, delayMs: 2000 });
    };

    const handleClearJournal = () => {
        Alert.alert(
            'Clear journal?',
            'This removes all saved journal entries on this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear journal',
                    style: 'destructive',
                    onPress: () => clearJournal(),
                },
            ]
        );
    };

    const handleClearPosCache = () => {
        Alert.alert(
            'Clear POS cache?',
            'This removes cached categories, products, and customizations. They will refresh the next time you use POS. This keeps you signed in and does not change your settings.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear POS cache',
                    style: 'destructive',
                    onPress: () => {
                        posCatalogCacheStore.getState().clear();
                        Alert.alert('POS cache cleared', 'Product data will refresh when you next open POS.');
                    },
                },
            ]
        );
    };

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
        setInstoreInstantTicketPrinterTarget((current) => (current === target ? null : current));
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
            setManualPrinterDriver('rawTcp');
        }
    };

    const resetManualPrinterForm = () => {
        setEditingManualPrinterTarget(null);
        setManualPrinterIp('');
        setManualPrinterPortText(String(DEFAULT_MANUAL_PRINTER_PORT));
        setManualPrinterName('');
        setManualPrinterDriver('rawTcp');
    };

    const startEditingManualPrinter = (printer: SavedPrinter) => {
        setEditingManualPrinterTarget(printer.target);
        setManualPrinterDriver(getPrinterDriver(printer) === 'simulator' ? 'simulator' : 'rawTcp');
        setManualPrinterIp(printer.ipAddress?.trim() || '');
        setManualPrinterPortText(String(printer.port ?? DEFAULT_MANUAL_PRINTER_PORT));
        setManualPrinterName(printer.deviceName || '');
    };

    const handleManualPrinterAdd = () => {
        const deviceName = manualPrinterName.trim();
        if (manualPrinterDriver === 'simulator') {
            const simulatorPrinter = createSimulatorSavedPrinter(deviceName || DEFAULT_SIMULATOR_PRINTER_NAME);
            const existing = printerSaved.find((printer) => printer.target === simulatorPrinter.target) || null;

            if (existing) {
                Alert.alert('Printer already exists', `${simulatorPrinter.deviceName} is already saved.`);
                return;
            }

            setPrinterSaved((prev) => [simulatorPrinter, ...prev]);
            setPrinterSelectedTarget(simulatorPrinter.target);
            updatePrinterAssignmentTarget(defaultPrinterAssignmentId, simulatorPrinter.target);
            setPrinterEnabled(true);
            resetManualPrinterForm();
            Alert.alert('Printer added', `${simulatorPrinter.deviceName} was added as the default virtual printer.`);
            return;
        }

        const ipAddress = manualPrinterIp.trim();
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
            setInstoreInstantTicketPrinterTarget((current) => (
                current === existing.target ? updatedPrinter.target : current
            ));
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

    const updatePrinterAssignmentTemplate = (assignmentId: string, template: 'kitchen' | 'customer-copy') => {
        setPrinterSectionAssignments((prev) => prev.map((assignment) => (
            assignment.id === assignmentId ? { ...assignment, template } : assignment
        )));
    };

    const updatePrinterAssignmentTimeWindow = (
        assignmentId: string,
        field: 'enabledFromTime' | 'enabledToTime',
        value: string
    ) => {
        setPrinterSectionAssignments((prev) => prev.map((assignment) => (
            assignment.id === assignmentId
                ? { ...assignment, [field]: value }
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
        const marketplaceSyncIntervalSec = parseIntOr(
            marketplaceSyncIntervalSecText,
            DEFAULT_APP_SETTINGS.marketplaceSyncIntervalSec
        );
        const soundRepeatCount = parseIntOr(repeatCountText, DEFAULT_APP_SETTINGS.soundRepeatCount);
        const printerDelayPrintSec = parseIntOr(printerDelayPrintSecText, DEFAULT_APP_SETTINGS.printerDelayPrintSec);

        if (refreshIntervalSec < 5 || refreshIntervalSec > 600) {
            Alert.alert('Invalid refresh interval', 'Please enter a value between 5 and 600 seconds.');
            return;
        }
        if (marketplaceSyncIntervalSec < 15 || marketplaceSyncIntervalSec > 600) {
            Alert.alert('Invalid marketplace polling interval', 'Please enter a value between 15 and 600 seconds.');
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

        const normalizeTimeInput = (value?: string | null) => {
            const normalized = value?.trim() || '';
            if (!normalized) return null;
            return normalized;
        };

        const normalizedAssignments = printerSectionAssignments.map((assignment) => ({
            ...assignment,
            sectionName: assignment.isDefault ? 'Default' : assignment.sectionName.trim(),
            template: assignment.template === 'customer-copy' ? 'customer-copy' : 'kitchen',
            enabledFromTime: normalizeTimeInput(assignment.enabledFromTime),
            enabledToTime: normalizeTimeInput(assignment.enabledToTime),
        }));
        const receiptFromTime = normalizeTimeInput(instoreCustomerReceiptEnabledFromTime);
        const receiptToTime = normalizeTimeInput(instoreCustomerReceiptEnabledToTime);
        if ((!!receiptFromTime && !receiptToTime) || (!receiptFromTime && !!receiptToTime) || [receiptFromTime, receiptToTime].some((value) => !!value && !/^\d{2}:\d{2}$/.test(value))) {
            Alert.alert('Invalid customer receipt time window', 'Set both From and To times in HH:MM format, or leave both blank to always print.');
            return;
        }
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

        const invalidTimeWindow = normalizedAssignments.find((assignment) => {
            const values = [assignment.enabledFromTime, assignment.enabledToTime].filter(Boolean);
            return values.some((value) => !/^\d{2}:\d{2}$/.test(value!));
        });
        if (invalidTimeWindow) {
            Alert.alert('Invalid time window', 'Use 24-hour time in HH:MM format, for example 17:00 or 20:00.');
            return;
        }

        const halfFilledTimeWindow = normalizedAssignments.find((assignment) => (
            (!!assignment.enabledFromTime && !assignment.enabledToTime)
            || (!assignment.enabledFromTime && !!assignment.enabledToTime)
        ));
        if (halfFilledTimeWindow) {
            Alert.alert('Incomplete time window', 'Set both From and To times, or leave both blank to always print.');
            return;
        }

        try {
            setSaving(true);
            await saveSettings({
                refreshIntervalSec,
                registerName,
                soundEnabled,
                soundId,
                soundRepeatCount,
                liveOrderCardLayout,
                marketplaceAutoSyncEnabled,
                marketplaceSyncIntervalSec,
                marketplaceFetchMode,
                printerEnabled,
                printerAutoPrint,
                instoreCustomerReceiptAutoPrintEnabled,
                instoreCustomerReceiptPrinterTarget,
                instoreCustomerReceiptEnabledFromTime: receiptFromTime,
                instoreCustomerReceiptEnabledToTime: receiptToTime,
                instoreInstantTicketEnabled,
                instoreInstantTicketPrinterTarget,
                printerSelectedTarget,
                printerSaved,
                printerSectionAssignments: normalizedAssignments,
                printerDelayPrintSec,
                printerPaperWidth,
                printerReceiptMode,
                printerHighQuality,
                printerDebugFooter,
            });
            if (marketplaceFetchMode !== currentSettings.marketplaceFetchMode) {
                invalidateLocalMarketplaceSession();
            }
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
                <SettingsActionTile title="Store information" description={storeInfo.shopName} icon="storefront-outline" onPress={() => setActiveDialog('storeInfo')} />
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
                    title="Marketplace auto-sync"
                    description={marketplaceAutoSyncEnabled ? 'Enabled on this tablet' : 'Disabled on this tablet'}
                    icon="sync"
                    onPress={() => setActiveDialog('marketplace')}
                />
                <SettingsActionTile
                    title="Kitchen printer"
                    description={printerSummary}
                    icon="printer"
                    onPress={() => setActiveDialog('printer')}
                />
                <SettingsActionTile
                    title="Print diagnostics"
                    description={printerDebugFooter ? 'Diagnostic footer enabled' : 'Diagnostic footer disabled'}
                    icon="text-box-search-outline"
                    onPress={() => setActiveDialog('printDiagnostics')}
                />
            </SettingsSectionCard>

            <SettingsSectionCard
                title="Storage"
                description="Remove transient POS product data without changing this device's settings."
            >
                <SettingsActionTile
                    title="Clear POS cache"
                    description="Remove cached categories, products, and customizations"
                    icon="database-remove-outline"
                    onPress={handleClearPosCache}
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

                        {activeDialog === 'marketplace' && (
                            <>
                                <View style={styles.switchRow}>
                                    <Text style={styles.label}>Marketplace auto-sync</Text>
                                    <Switch value={marketplaceAutoSyncEnabled} onValueChange={setMarketplaceAutoSyncEnabled} />
                                </View>
                                <Text style={styles.helper}>
                                    Automatically checks Uber Eats and DoorDash on this tablet. Manual marketplace refresh and status updates remain available.
                                </Text>
                                <TextInput
                                    mode="outlined"
                                    label="Marketplace polling interval (seconds)"
                                    value={marketplaceSyncIntervalSecText}
                                    onChangeText={setMarketplaceSyncIntervalSecText}
                                    keyboardType="number-pad"
                                    style={styles.input}
                                />
                                <Text style={styles.helper}>
                                    Checks in the background every 15 to 600 seconds. The default is 30 seconds and applies immediately after saving.
                                </Text>
                                <Text style={styles.label}>Marketplace request mode</Text>
                                <View style={styles.segmentedButtons}>
                                    <Button
                                        mode={marketplaceFetchMode === 'api' ? 'contained' : 'outlined'}
                                        onPress={() => setMarketplaceFetchMode('api')}
                                        style={styles.segmentedButton}
                                    >
                                        API (recommended)
                                    </Button>
                                    <Button
                                        mode={marketplaceFetchMode === 'local' ? 'contained' : 'outlined'}
                                        onPress={() => setMarketplaceFetchMode('local')}
                                        style={styles.segmentedButton}
                                    >
                                        Local tablet
                                    </Button>
                                </View>
                                <Text style={styles.helper}>
                                    API sends provider requests through the web API. Local tablet sends provider requests directly from this tablet after fetching a session held in memory for up to one hour.
                                </Text>
                            </>
                        )}

                        {activeDialog === 'printDiagnostics' && (
                            <>
                                <TextInput
                                    mode="outlined"
                                    label="Register name"
                                    value={registerName}
                                    onChangeText={setRegisterName}
                                    autoCapitalize="words"
                                    style={styles.input}
                                />
                                <Text style={styles.helper}>Optional name used to identify this POS register in diagnostic output.</Text>

                                <View style={[styles.switchRow, { marginTop: 16 }]}>
                                    <Text style={styles.label}>Print diagnostic footer</Text>
                                    <Switch value={printerDebugFooter} onValueChange={setPrinterDebugFooter} />
                                </View>
                                <Text style={styles.helper}>Adds diagnostic details to kitchen tickets. Leave off during normal service.</Text>
                            </>
                        )}

                        {activeDialog === 'storeInfo' && (
                            <>
                                {([['shopName', 'Shop name'], ['legalName', 'Legal company name'], ['abn', 'ABN'], ['addressLine1', 'Address line 1'], ['addressLine2', 'Address line 2'], ['phone', 'Phone'], ['website', 'Website'], ['logoUrl', 'Logo URL'], ['openingHours', 'Opening hours']] as Array<[keyof StoreInfo, string]>).map(([key, label]) => (
                                    <TextInput key={key} mode="outlined" label={label} value={storeInfo[key]} onChangeText={(value) => setStoreInfo((current) => ({ ...current, [key]: value }))} style={styles.input} />
                                ))}
                                <Text style={styles.helper}>This shared information syncs to all online POS registers. Opening hours are stored for future use and are not printed on receipts.</Text>
                                <Button mode="contained" loading={saving} disabled={saving || !storeInfo.shopName.trim()} onPress={async () => { try { setSaving(true); setStoreInfo(await saveStoreInfo({ ...storeInfo, shopName: storeInfo.shopName.trim() })); Alert.alert('Saved', 'Store information updated for all registers.'); } catch (error) { Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to update store information.'); } finally { setSaving(false); } }} style={styles.previewButton}>Save store information</Button>
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

                            <View style={styles.panelCard}>
                                <View style={styles.panelHeader}>
                                    <Text style={styles.panelTitle}>Add printer manually</Text>
                                    <Text style={styles.panelDescription}>Create a network or simulator printer entry without discovery.</Text>
                                </View>
                                <View style={styles.buttonGroup}>
                                    <Button
                                        mode={manualPrinterDriver === 'rawTcp' ? 'contained' : 'outlined'}
                                        onPress={() => setManualPrinterDriver('rawTcp')}
                                        style={styles.flexButton}
                                    >
                                        TCP Raw
                                    </Button>
                                    <Button
                                        mode={manualPrinterDriver === 'simulator' ? 'contained' : 'outlined'}
                                        onPress={() => setManualPrinterDriver('simulator')}
                                        style={styles.flexButton}
                                    >
                                        Simulator
                                    </Button>
                                </View>
                                {manualPrinterDriver === 'rawTcp' ? (
                                    <>
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
                                    </>
                                ) : (
                                    <>
                                <TextInput
                                    mode="outlined"
                                    label="Simulator name"
                                    value={manualPrinterName}
                                    onChangeText={setManualPrinterName}
                                    autoCapitalize="words"
                                    placeholder={DEFAULT_SIMULATOR_PRINTER_NAME}
                                    style={styles.input}
                                />
                                <Text style={styles.helper}>Virtual printers open the receipt in the in-app simulator instead of sending it to physical hardware.</Text>
                                    </>
                                )}
                                <View style={styles.buttonGroup}>
                                    <Button mode="contained-tonal" onPress={handleManualPrinterAdd} style={styles.flexButton}>
                                        {editingManualPrinterTarget ? 'Update printer' : 'Add printer'}
                                    </Button>
                                    {editingManualPrinterTarget ? (
                                        <Button mode="text" onPress={resetManualPrinterForm} style={styles.flexButton}>
                                            Cancel edit
                                        </Button>
                                    ) : null}
                                </View>
                            </View>

                            {printers.length > 0 && (
                                <View style={styles.panelCard}>
                                    <View style={styles.panelHeader}>
                                        <Text style={styles.panelTitle}>Discovered printers</Text>
                                        <Text style={styles.panelDescription}>Printers found on the network that can be added or used to update saved devices.</Text>
                                    </View>
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

                            <View style={styles.panelCard}>
                                <View style={styles.panelHeader}>
                                    <Text style={styles.panelTitle}>Saved printers</Text>
                                    <Text style={styles.panelDescription}>Choose the default printer for routed image print jobs.</Text>
                                </View>
                                {printerSaved.length === 0 ? (
                                    <Text style={styles.helper}>No printers saved yet. Use discovery or add one manually above.</Text>
                                ) : (
                                    printerSaved.map((p) => {
                                        const isSelected = p.target === printerSelectedTarget;
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
                                                        {isSimulatorPrinter(p)
                                                            ? 'Virtual simulator printer'
                                                            : p.ipAddress
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
                                                    >
                                                        {isSelected ? 'Default' : 'Set default'}
                                                    </Button>
                                                    {p.driver === 'rawTcp' || p.driver === 'simulator' ? (
                                                        <Button
                                                            mode="text"
                                                            onPress={() => startEditingManualPrinter(p)}
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

                            <View style={styles.panelCard}>
                                <View style={styles.panelHeader}>
                                    <Text style={styles.panelTitle}>Section printers</Text>
                                    <Text style={styles.panelDescription}>Each rule is separated below. Default is the fallback. `Customer Copy` can be routed as its own receipt job.</Text>
                                </View>
                                {printerSectionAssignments.map((assignment, index) => {
                                    const assignmentPrinter = printerSaved.find((printer) => printer.target === assignment.printerTarget) || null;
                                    return (
                                        <View key={assignment.id}>
                                            <View style={styles.assignmentCard}>
                                                <View style={styles.assignmentHeader}>
                                                    <Text style={styles.assignmentTitle}>
                                                        {assignment.isDefault ? 'Default route' : assignment.sectionName || `Section rule ${index + 1}`}
                                                    </Text>
                                                    <Text style={styles.assignmentSummary}>
                                                        {assignmentPrinter?.deviceName || 'No printer selected'}
                                                    </Text>
                                                </View>
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
                                                                ...PRINT_SECTION_OPTIONS.map((section) => ({
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
                                                <View style={styles.assignmentDivider} />
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
                                                <Text style={[styles.label, styles.assignmentSubLabel]}>Template</Text>
                                                <View style={styles.buttonGroup}>
                                                    <Button
                                                        mode={(assignment.template || 'kitchen') === 'kitchen' ? 'contained' : 'outlined'}
                                                        onPress={() => updatePrinterAssignmentTemplate(assignment.id, 'kitchen')}
                                                        style={styles.flexButton}
                                                    >
                                                        Kitchen
                                                    </Button>
                                                    <Button
                                                        mode={assignment.template === 'customer-copy' ? 'contained' : 'outlined'}
                                                        onPress={() => updatePrinterAssignmentTemplate(assignment.id, 'customer-copy')}
                                                        style={styles.flexButton}
                                                    >
                                                        Customer Copy
                                                    </Button>
                                                </View>
                                                <Text style={[styles.label, styles.assignmentSubLabel]}>Enabled time window</Text>
                                                <View style={styles.buttonGroup}>
                                                    <TextInput
                                                        mode="outlined"
                                                        label="From"
                                                        value={assignment.enabledFromTime || ''}
                                                        onChangeText={(value) => updatePrinterAssignmentTimeWindow(assignment.id, 'enabledFromTime', value)}
                                                        placeholder="17:00"
                                                        style={[styles.input, styles.flexButton]}
                                                    />
                                                    <TextInput
                                                        mode="outlined"
                                                        label="To"
                                                        value={assignment.enabledToTime || ''}
                                                        onChangeText={(value) => updatePrinterAssignmentTimeWindow(assignment.id, 'enabledToTime', value)}
                                                        placeholder="20:00"
                                                        style={[styles.input, styles.flexButton]}
                                                    />
                                                </View>
                                                <Text style={styles.helper}>Leave both blank to always print. Use 24-hour time like 17:00 to 20:00.</Text>
                                                {!assignment.isDefault && (
                                                    <Button mode="text" onPress={() => removePrinterSectionAssignment(assignment.id)}>
                                                        Remove section rule
                                                    </Button>
                                                )}
                                            </View>
                                            {index < printerSectionAssignments.length - 1 ? <View style={styles.ruleDivider} /> : null}
                                        </View>
                                    );
                                })}
                                <Button mode="contained-tonal" onPress={addPrinterSectionAssignment} style={styles.previewButton}>
                                    Add section printer
                                </Button>
                            </View>

                            <View style={styles.panelCard}>
                                <View style={styles.panelHeader}>
                                    <Text style={styles.panelTitle}>Print behavior</Text>
                                    <Text style={styles.panelDescription}>Control auto print timing, paper width, image quality, and test output.</Text>
                                </View>
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
                                <Text style={styles.label}>In-store customer receipt</Text>
                                <Text style={styles.helper}>Print one combined customer receipt first for new paid in-store Cash, Card, or SmartPay orders only.</Text>
                                <View style={styles.switchRow}>
                                    <Text style={styles.label}>Enable automatic receipt</Text>
                                    <Switch value={instoreCustomerReceiptAutoPrintEnabled} onValueChange={setInstoreCustomerReceiptAutoPrintEnabled} disabled={!hasPrinterCapability} />
                                </View>
                                <Text style={[styles.label, styles.assignmentSubLabel]}>Receipt printer</Text>
                                <View style={styles.buttonGroup}>
                                    {printerSaved.map((printer) => (
                                        <Button key={printer.target} mode={instoreCustomerReceiptPrinterTarget === printer.target ? 'contained' : 'outlined'} onPress={() => setInstoreCustomerReceiptPrinterTarget(printer.target)} style={styles.flexButton} disabled={!hasPrinterCapability}>
                                            {printer.deviceName}
                                        </Button>
                                    ))}
                                </View>
                                {printerSaved.length === 0 ? <Text style={styles.helper}>Add a saved printer before enabling automatic customer receipts.</Text> : null}
                                <View style={styles.buttonGroup}>
                                    <TextInput mode="outlined" label="From" value={instoreCustomerReceiptEnabledFromTime} onChangeText={setInstoreCustomerReceiptEnabledFromTime} placeholder="17:00" style={[styles.input, styles.flexButton]} disabled={!instoreCustomerReceiptAutoPrintEnabled} />
                                    <TextInput mode="outlined" label="To" value={instoreCustomerReceiptEnabledToTime} onChangeText={setInstoreCustomerReceiptEnabledToTime} placeholder="20:00" style={[styles.input, styles.flexButton]} disabled={!instoreCustomerReceiptAutoPrintEnabled} />
                                </View>
                                <Text style={styles.helper}>Leave both blank to always print. Uses 24-hour time and supports overnight windows.</Text>

                                <View style={styles.separator} />

                                <Text style={styles.label}>In-store instant ticket</Text>
                                <Text style={styles.helper}>Print a compact, text-only ticket for eligible paid in-store orders. A physical printer is required.</Text>
                                <View style={styles.switchRow}>
                                    <Text style={styles.label}>Enable instant ticket</Text>
                                    <Switch value={instoreInstantTicketEnabled} onValueChange={setInstoreInstantTicketEnabled} disabled={!hasInstantTicketPrinterCapability} />
                                </View>
                                <Text style={[styles.label, styles.assignmentSubLabel]}>Ticket printer</Text>
                                <View style={styles.buttonGroup}>
                                    {savedPhysicalPrinters.map((printer) => (
                                        <Button key={printer.target} mode={instoreInstantTicketPrinterTarget === printer.target ? 'contained' : 'outlined'} onPress={() => setInstoreInstantTicketPrinterTarget(printer.target)} style={styles.flexButton} disabled={!hasInstantTicketPrinterCapability}>
                                            {printer.deviceName}
                                        </Button>
                                    ))}
                                </View>
                                {savedPhysicalPrinters.length === 0 ? <Text style={styles.helper}>Add and enable a physical saved printer before enabling instant tickets.</Text> : null}

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

                                <Text style={[styles.label, { marginTop: 12 }]}>Kitchen receipt mode</Text>
                                <View style={styles.buttonGroup}>
                                    <Button mode={printerReceiptMode === 'text' ? 'contained' : 'outlined'} onPress={() => setPrinterReceiptMode('text')} style={styles.flexButton}>Text</Button>
                                    <Button mode={printerReceiptMode === 'image' ? 'contained' : 'outlined'} onPress={() => setPrinterReceiptMode('image')} style={styles.flexButton}>Image</Button>
                                </View>
                                <Text style={styles.helper}>Text printing is faster; Image preserves the current captured receipt layout.</Text>

                                <View style={[styles.switchRow, { marginTop: 12 }]}>
                                    <Text style={styles.label}>High quality capture (2x DPI)</Text>
                                    <Switch value={printerHighQuality} onValueChange={setPrinterHighQuality} />
                                </View>
                                <Text style={styles.helper}>
                                    Improves sharpness on higher-end thermal printers by capturing at 2x resolution.
                                </Text>

                                {JOURNAL_LOGS_ENABLED ? (
                                    <>
                                    <Button
                                        mode="outlined"
                                        icon="text-box-search-outline"
                                        onPress={() => setActiveDialog('journal')}
                                        style={styles.previewButton}
                                    >
                                        View journal
                                    </Button>
                                    <Text style={styles.helper}>{recentJournalLabel}</Text>
                                    </>
                                ) : null}
                            </View>
                            </>
                        )}

                        {activeDialog === 'journal' && JOURNAL_LOGS_ENABLED && (
                            <>
                            <View style={styles.logsHeaderRow}>
                                <Text style={styles.helper}>
                                    Review recent journal events for this device. Newest entries appear first.
                                </Text>
                                <Button
                                    mode="text"
                                    icon="delete-outline"
                                    onPress={handleClearJournal}
                                    disabled={journalEntries.length === 0}
                                >
                                    Clear journal
                                </Button>
                            </View>

                            {journalEntries.length === 0 ? (
                                <View style={styles.logsEmptyState}>
                                    <Text style={styles.label}>No journal entries yet.</Text>
                                    <Text style={styles.helper}>Run a test print or wait for the next kitchen workflow event to populate this list.</Text>
                                </View>
                            ) : (
                                journalEntries.map((entry) => (
                                    <View key={entry.id} style={styles.logCard}>
                                        <View style={styles.logCardHeader}>
                                            <View style={[styles.logLevelBadge, logLevelBadgeStyles[entry.level]]}>
                                                <Text style={styles.logLevelBadgeText}>{entry.level.toUpperCase()}</Text>
                                            </View>
                                            <Text style={styles.logTimestamp}>{new Date(entry.timestamp).toLocaleString()}</Text>
                                        </View>
                                        <Text style={styles.logScope}>{entry.scope}</Text>
                                        <Text style={styles.logMessage}>{entry.message}</Text>
                                        {entry.orderNumber || entry.orderId ? (
                                            <Text style={styles.logMeta}>
                                                Order: {entry.orderNumber || entry.orderId}
                                            </Text>
                                        ) : null}
                                        {entry.details ? (
                                            <Text style={styles.logDetails}>{entry.details}</Text>
                                        ) : null}
                                    </View>
                                ))
                            )}
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
    panelCard: {
        marginTop: 14,
        padding: 14,
        borderRadius: 16,
        backgroundColor: '#fcfdff',
        borderWidth: 1,
        borderColor: '#dbe4f0',
    },
    panelHeader: {
        marginBottom: 10,
        gap: 4,
    },
    panelTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    panelDescription: {
        fontSize: 12,
        color: '#526175',
        lineHeight: 18,
    },
    assignmentCard: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    assignmentHeader: {
        gap: 2,
        marginBottom: 8,
    },
    assignmentTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    assignmentSummary: {
        fontSize: 12,
        color: '#64748b',
    },
    assignmentDivider: {
        height: 1,
        backgroundColor: '#e8edf3',
        marginTop: 12,
        marginBottom: 2,
    },
    ruleDivider: {
        height: 1,
        backgroundColor: '#cfd8e3',
        marginVertical: 12,
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
        backgroundColor: '#dbe4f0',
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
    logsHeaderRow: {
        gap: 8,
        marginBottom: 12,
    },
    logsEmptyState: {
        marginTop: 8,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ececec',
    },
    logCard: {
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ececec',
        gap: 6,
    },
    logCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    logLevelBadge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    logLevelBadgeinfo: {
        backgroundColor: '#dbeafe',
    },
    logLevelBadgedecision: {
        backgroundColor: '#ede9fe',
    },
    logLevelBadgesuccess: {
        backgroundColor: '#dcfce7',
    },
    logLevelBadgeerror: {
        backgroundColor: '#fee2e2',
    },
    logLevelBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
    },
    logTimestamp: {
        flex: 1,
        textAlign: 'right',
        fontSize: 11,
        color: '#64748b',
    },
    logScope: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
    },
    logMessage: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    logMeta: {
        fontSize: 12,
        color: '#475569',
    },
    logDetails: {
        fontSize: 12,
        color: '#334155',
    },
    segmentedButtons: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    segmentedButton: {
        flex: 1,
    },
});
