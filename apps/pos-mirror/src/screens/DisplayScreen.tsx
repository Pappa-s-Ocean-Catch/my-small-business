import { StyleSheet, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const mirror = useMirrorState(settings.registerId);
  const queue = useCustomerQueue(settings.idleMode === 'queue');
  const display = selectDisplayState(mirror.snapshot, settings.idleMode, queue.orders);
  const warning = mirror.warning ?? queue.warning;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar hidden />
      {display.kind === 'cart' && <ActiveCartDisplay snapshot={display.snapshot} />}
      {display.kind === 'queue' && <CustomerQueueDisplay orders={display.orders} />}
      {display.kind === 'image' && <IdleImageDisplay onOpenSettings={onOpenSettings} />}
      {mirror.status === 'loading' && <View style={styles.waiting}><Text style={styles.waitingText}>Waiting for register {settings.registerId}</Text></View>}
      <IconButton icon="cog-outline" size={24} mode="contained" containerColor="rgba(255,255,255,0.92)" iconColor={colors.text} onPress={onOpenSettings} style={styles.settings} accessibilityLabel="Open display settings" />
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
