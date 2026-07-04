import { useAppSettingsStore } from '@/stores/appSettingsStore';

export function useAppSettingsQuery() {
  const settings = useAppSettingsStore((state) => state.settings);
  const hydrated = useAppSettingsStore((state) => state.hydrated);

  return {
    data: settings,
    isLoading: !hydrated,
    error: null,
  };
}

export function useAppSettingsSubscription() {
  return;
}
