import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOUND_OPTIONS, type SoundId } from './sounds';

export type AppSettings = {
    refreshIntervalSec: number;
    soundEnabled: boolean;
    soundId: SoundId;
    soundRepeatCount: number;
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
    refreshIntervalSec: 30,
    soundEnabled: true,
    soundId: 'so-proud-notification',
    soundRepeatCount: 3,
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

        const result: AppSettings = {
            refreshIntervalSec,
            soundEnabled,
            soundId,
            soundRepeatCount,
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
        refreshIntervalSec: clampInt(settings.refreshIntervalSec, 5, 600),
        soundEnabled: !!settings.soundEnabled,
        soundId: settings.soundId,
        soundRepeatCount: clampInt(settings.soundRepeatCount, 1, 10),
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

    // Notify in-app listeners so other screens (e.g. Orders) immediately react.
    notifySettingsChanged(normalized);
}
