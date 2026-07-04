import { useEffect, type PropsWithChildren } from 'react';
import { subscribeAppSettings } from '@/lib/settings';
import { useAppSettingsStore } from '@/stores/appSettingsStore';

export function AppSettingsProvider({ children }: PropsWithChildren) {
  const hydrate = useAppSettingsStore((state) => state.hydrate);
  const setSettings = useAppSettingsStore((state) => state.setSettings);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const unsubscribe = subscribeAppSettings((settings) => {
      setSettings(settings);
    });
    return unsubscribe;
  }, [setSettings]);

  return children;
}
