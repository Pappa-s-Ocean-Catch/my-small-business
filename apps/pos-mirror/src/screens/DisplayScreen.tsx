import { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { IconButton, Text } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveCartDisplay } from '../components/ActiveCartDisplay';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { CustomerQueueDisplay } from '../components/CustomerQueueDisplay';
import { IdleImageDisplay } from '../components/IdleImageDisplay';
import { useCustomerQueue } from '../hooks/useCustomerQueue';
import { useMirrorState } from '../hooks/useMirrorState';
import { selectDisplayState } from '../lib/display-state';
import type { MirrorSettings } from '../lib/mirror-settings';
import { colors, spacing } from '../theme';

export function DisplayScreen({ settings, onOpenSettings }: { settings: MirrorSettings; onOpenSettings: () => void }) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const mirror = useMirrorState(settings.registerId);
  const queue = useCustomerQueue(settings.idleMode === 'queue');
  const display = selectDisplayState(mirror.snapshot, settings.idleMode, queue.orders);
  const warning = mirror.warning ?? queue.warning;

  const [showSettings, setShowSettings] = useState(true);
  useEffect(() => {
    if (showSettings) {
      const timer = setTimeout(() => setShowSettings(false), 30000);
      return () => clearTimeout(timer);
    }
  }, [showSettings]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar hidden />
      {display.kind === 'cart' && <ActiveCartDisplay snapshot={display.snapshot} onRevealSettings={() => setShowSettings(true)} />}
      {display.kind === 'queue' && <CustomerQueueDisplay orders={display.orders} />}
      {display.kind === 'image' && <IdleImageDisplay onOpenSettings={onOpenSettings} />}
      {mirror.status === 'loading' && <View style={[styles.waiting, { top: insets.top + spacing.md, right: insets.right + 72 }]}><Text style={styles.waitingText}>Waiting for register {settings.registerId}</Text></View>}
      {showSettings && <IconButton icon="cog-outline" size={24} mode="contained" containerColor="rgba(255,255,255,0.92)" iconColor={colors.accent} onPress={onOpenSettings} style={[styles.settings, { top: insets.top + spacing.sm, right: insets.right + spacing.sm }]} accessibilityLabel="Open display settings" />}
      <ConnectionBanner message={warning} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  settings: { position: 'absolute', top: spacing.sm, right: spacing.sm, minWidth: 48, minHeight: 48 },
  waiting: { position: 'absolute', top: spacing.md, left: spacing.lg, right: 72, alignItems: 'center' },
  waitingText: { color: colors.mutedText, backgroundColor: 'rgba(255,255,255,0.88)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8 },
});
