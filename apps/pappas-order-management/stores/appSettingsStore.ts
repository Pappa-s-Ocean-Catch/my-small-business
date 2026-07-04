import { create } from 'zustand';
import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from '@/lib/settings';

type AppSettingsState = {
  settings: AppSettings;
  hydrated: boolean;
  hydrating: boolean;
  hydrate: () => Promise<void>;
  setSettings: (settings: AppSettings) => void;
  saveSettings: (settings: AppSettings) => Promise<void>;
};

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  hydrated: false,
  hydrating: false,
  hydrate: async () => {
    if (get().hydrating) return;

    set({ hydrating: true });
    try {
      const settings = await loadAppSettings();
      set({
        settings,
        hydrated: true,
        hydrating: false,
      });
    } catch {
      set({
        settings: DEFAULT_APP_SETTINGS,
        hydrated: true,
        hydrating: false,
      });
    }
  },
  setSettings: (settings) => set({
    settings,
    hydrated: true,
    hydrating: false,
  }),
  saveSettings: async (settings) => {
    await saveAppSettings(settings);
    set({
      settings,
      hydrated: true,
      hydrating: false,
    });
  },
}));
