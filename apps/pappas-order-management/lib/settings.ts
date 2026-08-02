import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOUND_OPTIONS, type SoundId } from './sounds';
import {
    createSimulatorSavedPrinter,
    isSimulatorPrinterTarget,
    type SavedPrinter,
} from './escpos-printer';

function isSavedPrinter(value: unknown): value is SavedPrinter {
    const v = value as any;
    return !!v && typeof v === 'object' && typeof v.target === 'string' && typeof v.deviceName === 'string';
}

export type PrinterSectionAssignment = {
    id: string;
    sectionName: string;
    printerTarget: string | null;
    printMode?: 'combine' | 'separate';
    template?: 'kitchen' | 'customer-copy';
    enabledFromTime?: string | null;
    enabledToTime?: string | null;
    isDefault?: boolean;
};

function normalizeTimeWindowValue(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!/^\d{2}:\d{2}$/.test(normalized)) return null;
    const [hoursText, minutesText] = normalized.split(':');
    const hours = Number.parseInt(hoursText, 10);
    const minutes = Number.parseInt(minutesText, 10);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizePrinterSectionAssignment(value: unknown): PrinterSectionAssignment | null {
    const v = value as Partial<PrinterSectionAssignment> | null;
    if (!v || typeof v !== 'object') return null;

    const id = typeof v.id === 'string' && v.id.trim()
        ? v.id.trim()
        : `assignment-${Math.random().toString(36).slice(2, 10)}`;
    const sectionName = typeof v.sectionName === 'string' && v.sectionName.trim()
        ? v.sectionName.trim()
        : 'Default';
    const printerTarget = typeof v.printerTarget === 'string' && v.printerTarget.trim()
        ? v.printerTarget.trim()
        : null;

    return {
        id,
        sectionName,
        printerTarget,
        printMode: v.printMode === 'separate' ? 'separate' : 'combine',
        template: v.template === 'customer-copy' ? 'customer-copy' : 'kitchen',
        enabledFromTime: normalizeTimeWindowValue(v.enabledFromTime),
        enabledToTime: normalizeTimeWindowValue(v.enabledToTime),
        isDefault: !!v.isDefault || sectionName.toLowerCase() === 'default',
    };
}

function normalizePrinterSectionAssignments(
    value: unknown,
    legacySelectedTarget: string | null,
    simulatorTarget: string | null,
    legacySimulatorEnabled: boolean
): PrinterSectionAssignment[] {
    const rawAssignments = Array.isArray(value)
        ? value
            .map((item) => {
                const normalized = normalizePrinterSectionAssignment(item);
                if (!normalized) return null;
                const legacyUseSimulator = !!(item as Partial<{ useSimulator: boolean }> | null)?.useSimulator;
                return legacyUseSimulator && simulatorTarget
                    ? { ...normalized, printerTarget: simulatorTarget }
                    : normalized;
            })
            .filter((item): item is PrinterSectionAssignment => !!item)
        : [];

    const deduped: PrinterSectionAssignment[] = [];
    const seen = new Set<string>();
    let defaultAssigned = false;

    for (const assignment of rawAssignments) {
        const key = assignment.isDefault
            ? '__default__'
            : assignment.sectionName.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const nextAssignment = {
            ...assignment,
            isDefault: assignment.isDefault || assignment.sectionName.trim().toLowerCase() === 'default',
        };
        if (nextAssignment.isDefault) defaultAssigned = true;
        deduped.push(nextAssignment);
    }

    if (!defaultAssigned) {
        deduped.unshift({
            id: 'default-printer',
            sectionName: 'Default',
            printerTarget: legacySimulatorEnabled && simulatorTarget ? simulatorTarget : legacySelectedTarget,
            printMode: 'combine',
            template: 'kitchen',
            enabledFromTime: null,
            enabledToTime: null,
            isDefault: true,
        });
    }

    return deduped;
}

export type AppSettings = {
    /** Optional label displayed on printed diagnostic information for this device. */
    registerName: string;
    refreshIntervalSec: number;
    soundEnabled: boolean;
    soundId: SoundId;
    soundRepeatCount: number;
    liveOrderCardLayout: 'horizontal' | 'vertical';

    // Kitchen printer (ESC/POS)
    printerEnabled: boolean;
    printerAutoPrint: boolean;

    printerSelectedTarget: string | null;
    printerSaved: SavedPrinter[];
    printerSectionAssignments: PrinterSectionAssignment[];
    /** Seconds to wait before auto-printing a new kitchen ticket. */
    printerDelayPrintSec: number;

    printerPaperWidth: '58mm' | '80mm';
    printerHighQuality: boolean;
    /** Include device-local diagnostic information on kitchen tickets when enabled. */
    printerDebugFooter: boolean;
};

const STORAGE_KEY = 'pappas-order-management.settings.v1';

let cachedSettings: AppSettings | null = null;
const listeners = new Set<(settings: AppSettings) => void>();

function isSoundId(value: unknown): value is SoundId {
    return typeof value === 'string' && SOUND_OPTIONS.some((o) => o.id === value);
}

function notifySettingsChanged(next: AppSettings) {
    cachedSettings = next;
    for (const listener of listeners) {
        try {
            listener(next);
        } catch {
            // ignore listener errors
        }
    }
}

export function subscribeAppSettings(listener: (settings: AppSettings) => void) {
    listeners.add(listener);
    if (cachedSettings) {
        try {
            listener(cachedSettings);
        } catch {
            // ignore
        }
    }
    return () => {
        listeners.delete(listener);
    };
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
    registerName: '',
    refreshIntervalSec: 30,
    soundEnabled: true,
    soundId: 'so-proud-notification',
    soundRepeatCount: 3,
    liveOrderCardLayout: 'vertical',

    printerEnabled: false,
    printerAutoPrint: true,

    printerSelectedTarget: null,
    printerSaved: [],
    printerSectionAssignments: [{
        id: 'default-printer',
        sectionName: 'Default',
        printerTarget: null,
        printMode: 'combine',
        template: 'kitchen',
        enabledFromTime: null,
        enabledToTime: null,
        isDefault: true,
    }],

    printerDelayPrintSec: 3,
    printerPaperWidth: '80mm',
    printerHighQuality: true,
    printerDebugFooter: false,
};

function clampInt(value: number, min: number, max: number) {
    const n = Number.isFinite(value) ? Math.trunc(value) : min;
    return Math.min(max, Math.max(min, n));
}

export async function loadAppSettings(): Promise<AppSettings> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
            cachedSettings = DEFAULT_APP_SETTINGS;
            return DEFAULT_APP_SETTINGS;
        }
        const parsed = JSON.parse(raw) as Partial<AppSettings> | null;

        const registerName = typeof parsed?.registerName === 'string'
            ? parsed.registerName.trim()
            : DEFAULT_APP_SETTINGS.registerName;

        const refreshIntervalSec = clampInt(
            typeof parsed?.refreshIntervalSec === 'number' ? parsed.refreshIntervalSec : DEFAULT_APP_SETTINGS.refreshIntervalSec,
            5,
            600
        );

        const soundRepeatCount = clampInt(
            typeof parsed?.soundRepeatCount === 'number' ? parsed.soundRepeatCount : DEFAULT_APP_SETTINGS.soundRepeatCount,
            1,
            10
        );

        const soundId: SoundId = isSoundId(parsed?.soundId) ? parsed!.soundId : DEFAULT_APP_SETTINGS.soundId;

        const soundEnabled = typeof (parsed as any)?.soundEnabled === 'boolean'
            ? (parsed as any).soundEnabled
            : DEFAULT_APP_SETTINGS.soundEnabled;
        const liveOrderCardLayout = (parsed as any)?.liveOrderCardLayout === 'horizontal'
            ? 'horizontal'
            : 'vertical';

        const printerEnabled = typeof (parsed as any)?.printerEnabled === 'boolean'
            ? (parsed as any).printerEnabled
            : DEFAULT_APP_SETTINGS.printerEnabled;

        const printerAutoPrint = typeof (parsed as any)?.printerAutoPrint === 'boolean'
            ? (parsed as any).printerAutoPrint
            : DEFAULT_APP_SETTINGS.printerAutoPrint;

        const printerSelectedTarget = typeof (parsed as any)?.printerSelectedTarget === 'string'
            ? (parsed as any).printerSelectedTarget
            : DEFAULT_APP_SETTINGS.printerSelectedTarget;

        const legacySimulatorEnabled = typeof (parsed as any)?.printerSimulator === 'boolean'
            ? (parsed as any).printerSimulator
            : false;
        const legacyHasSimulatorAssignment = Array.isArray((parsed as any)?.printerSectionAssignments)
            && (parsed as any).printerSectionAssignments.some((assignment: any) => !!assignment?.useSimulator);
        const shouldEnsureSimulatorPrinter = legacySimulatorEnabled || legacyHasSimulatorAssignment;
        let printerSaved: SavedPrinter[] = Array.isArray((parsed as any)?.printerSaved)
            ? ((parsed as any).printerSaved as unknown[]).filter(isSavedPrinter)
            : DEFAULT_APP_SETTINGS.printerSaved;
        let simulatorTarget: string | null = null;
        const existingSimulator = printerSaved.find((printer) => isSimulatorPrinterTarget(printer.target)) || null;
        if (existingSimulator) {
            simulatorTarget = existingSimulator.target;
        } else if (shouldEnsureSimulatorPrinter) {
            const simulatorPrinter = createSimulatorSavedPrinter();
            printerSaved = [simulatorPrinter, ...printerSaved];
            simulatorTarget = simulatorPrinter.target;
        }
        const printerSectionAssignments = normalizePrinterSectionAssignments(
            (parsed as any)?.printerSectionAssignments,
            printerSelectedTarget,
            simulatorTarget,
            legacySimulatorEnabled
        );

        const printerDelayPrintSec = clampInt(
            typeof parsed?.printerDelayPrintSec === 'number'
                ? parsed.printerDelayPrintSec
                : DEFAULT_APP_SETTINGS.printerDelayPrintSec,
            0,
            120
        );

        const result: AppSettings = {
            registerName,
            refreshIntervalSec,
            soundEnabled,
            soundId,
            soundRepeatCount,
            liveOrderCardLayout,

            printerEnabled,
            printerAutoPrint,

            printerSelectedTarget,
            printerSaved,
            printerSectionAssignments,

            printerDelayPrintSec,
            printerPaperWidth: parsed?.printerPaperWidth === '58mm' ? '58mm' : '80mm',
            printerHighQuality: typeof (parsed as any)?.printerHighQuality === 'boolean'
                ? (parsed as any).printerHighQuality
                : DEFAULT_APP_SETTINGS.printerHighQuality,
            printerDebugFooter: typeof (parsed as any)?.printerDebugFooter === 'boolean'
                ? (parsed as any).printerDebugFooter
                : DEFAULT_APP_SETTINGS.printerDebugFooter,
        };
        cachedSettings = result;
        return result;
    } catch {
        cachedSettings = DEFAULT_APP_SETTINGS;
        return DEFAULT_APP_SETTINGS;
    }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
    const normalized: AppSettings = {
        registerName: typeof settings.registerName === 'string' ? settings.registerName.trim() : '',
        refreshIntervalSec: clampInt(settings.refreshIntervalSec, 5, 600),
        soundEnabled: !!settings.soundEnabled,
        soundId: settings.soundId,
        soundRepeatCount: clampInt(settings.soundRepeatCount, 1, 10),
        liveOrderCardLayout: settings.liveOrderCardLayout === 'horizontal' ? 'horizontal' : 'vertical',

        printerEnabled: !!settings.printerEnabled,
        printerAutoPrint: !!settings.printerAutoPrint,

        printerSelectedTarget: settings.printerSelectedTarget ? String(settings.printerSelectedTarget) : null,
        printerSaved: Array.isArray(settings.printerSaved) ? settings.printerSaved.filter(isSavedPrinter) : [],
        printerSectionAssignments: normalizePrinterSectionAssignments(
            settings.printerSectionAssignments,
            settings.printerSelectedTarget ? String(settings.printerSelectedTarget) : null,
            null,
            false
        ),

        printerDelayPrintSec: clampInt(settings.printerDelayPrintSec, 0, 120),
        printerPaperWidth: settings.printerPaperWidth === '58mm' ? '58mm' : '80mm',
        printerHighQuality: !!settings.printerHighQuality,
        printerDebugFooter: !!settings.printerDebugFooter,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

    // Notify in-app listeners so other screens (e.g. Orders) immediately react.
    notifySettingsChanged(normalized);
}
