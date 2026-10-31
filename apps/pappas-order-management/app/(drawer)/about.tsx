import { appDialog as Alert } from '@/lib/app-dialog';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { WorkspaceHeader } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import { Panel, SectionHeader, DetailRow } from '@/components/ui';
import { useState, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Text } from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import { getNativeAppMemory } from '@my-small-business/app-memory';
import { BRAND_COLORS } from '@/utils/brand';

import { getAppMemorySnapshot, type AppMemorySnapshot } from '@/lib/app-memory';
import {
  checkAndApplyUpdate,
  getBuildMetadata,
  restartApp,
  type UpdateResult,
  type UpdatesClient,
} from '@/lib/about-updates';

const updatesClient: UpdatesClient = {
  get isEnabled() {
    try {
      return Updates.isEnabled;
    } catch {
      return false;
    }
  },
  checkForUpdateAsync() {
    return Updates.checkForUpdateAsync();
  },
  fetchUpdateAsync() {
    return Updates.fetchUpdateAsync();
  },
  reloadAsync() {
    return Updates.reloadAsync();
  },
};

function getUpdateDetails(): { updateId?: string; channel?: string } {
  try {
    return {
      updateId: Updates.updateId || undefined,
      channel: Updates.channel || undefined,
    };
  } catch {
    return {};
  }
}

function resultMessage(result: UpdateResult): { title: string; message: string } {
  switch (result.kind) {
    case 'unavailable':
      return { title: 'Updates unavailable', message: 'Updates are not enabled in this build.' };
    case 'up-to-date':
      return { title: 'Up to date', message: 'No update is currently available.' };
    case 'applied':
      return { title: 'Update applied', message: 'The update was downloaded and the app is restarting.' };
    case 'restarted':
      return { title: 'Restarting app', message: 'The app is restarting.' };
    case 'failed':
      return { title: 'Update failed', message: result.message };
  }
}

function MemoryDistributionBar({ snapshot }: { snapshot: Extract<AppMemorySnapshot, { kind: 'available' }> }) {
  const appRatio = Math.min(snapshot.appFootprintBytes / snapshot.totalBytes, 1);
  const availableRatio = snapshot.availableBytes === null
    ? 0
    : Math.min(snapshot.availableBytes / snapshot.totalBytes, Math.max(0, 1 - appRatio));
  const otherRatio = Math.max(0, 1 - appRatio - availableRatio);

  return (
    <>
      <View accessibilityLabel="Memory distribution" style={styles.memoryBar}>
        <View style={[styles.memorySegment, styles.appMemorySegment, { flex: appRatio || 0.001 }]} />
        {otherRatio > 0 ? <View style={[styles.memorySegment, styles.otherMemorySegment, { flex: otherRatio }]} /> : null}
        {availableRatio > 0 ? <View style={[styles.memorySegment, styles.availableMemorySegment, { flex: availableRatio }]} /> : null}
      </View>
      <View style={styles.memoryLegend}>
        <Text variant="bodySmall" style={styles.appMemoryText}>App</Text>
        <Text variant="bodySmall" style={styles.otherMemoryText}>Other in use</Text>
        {snapshot.availableBytes !== null ? <Text variant="bodySmall" style={styles.availableMemoryText}>Available</Text> : null}
      </View>
    </>
  );
}

function BuildDetail({ label, value, hint, border = true }: { label: string; value: string; hint?: string; border?: boolean }) {
  return <View style={{ minHeight: 78, paddingVertical: 17, paddingHorizontal: 18, borderBottomWidth: border ? 1 : 0, borderColor: t.color.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}><View style={{ flexShrink: 1, gap: 6 }}><Text style={{ fontSize: 16, fontWeight: '700', color: t.color.text }}>{label}</Text>{hint && <Text style={{ fontSize: 13, color: t.color.muted }}>{hint}</Text>}</View><Text style={{ fontSize: 16, color: t.color.text, flexShrink: 1 }}>{value}</Text></View>;
}

export default function AboutScreen() {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(false);
  const restartRequested = useRef(false);
  const [memorySnapshot, setMemorySnapshot] = useState<AppMemorySnapshot | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const metadata = getBuildMetadata({
    EXPO_PUBLIC_BUILD_DATE: process.env.EXPO_PUBLIC_BUILD_DATE,
    EXPO_PUBLIC_GIT_SHA: process.env.EXPO_PUBLIC_GIT_SHA,
  }, Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'Unknown');
  const updateDetails = getUpdateDetails();
  const [ipAddress, setIpAddress] = useState<string | null>(null);

  useEffect(() => {
    NetInfo.fetch().then(state => {
      // @ts-ignore - details shape depends on type, but ipAddress is commonly available on wifi/ethernet
      const ip = state.details?.ipAddress;
      if (ip) {
        setIpAddress(ip);
      }
    });
  }, []);

  const showResult = (result: UpdateResult) => {
    const { title, message } = resultMessage(result);
    Alert.alert(title, message);
  };

  const handleRestart = () => {
    if (restartRequested.current) return;

    restartRequested.current = true;
    const result = restartApp(updatesClient, {
      onFailure: (failure) => {
        restartRequested.current = false;
        showResult(failure);
      },
    });

    if (result.kind !== 'restarted') {
      restartRequested.current = false;
      showResult(result);
    }
  };

  const confirmRestart = () => {
    Alert.alert('Restart app?', 'The app will restart immediately.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: handleRestart },
    ]);
  };

  const handleCheckForUpdate = async () => {
    setActive(true);
    const result = await checkAndApplyUpdate(updatesClient, {
      onStarted: () => setActive(false),
      onFailure: (failure) => {
        setActive(false);
        showResult(failure);
      },
    });

    if (result.kind !== 'applied') {
      setActive(false);
      showResult(result);
    }
  };

  const refreshMemory = async () => {
    setMemoryLoading(true);
    try {
      setMemorySnapshot(await getAppMemorySnapshot(getNativeAppMemory()));
    } finally {
      setMemoryLoading(false);
    }
  };

  const memoryDescription =
    memorySnapshot?.kind === 'available'
      ? `${memorySnapshot.formattedTotal} • measured just now`
      : memorySnapshot?.kind === 'unavailable'
        ? 'Available after installing a native app build.'
        : memorySnapshot?.kind === 'failed'
          ? `Unavailable: ${memorySnapshot.message}`
          : 'Tap Refresh to measure this device.';

  return <View style={{ flex: 1, backgroundColor: t.color.background }}>
    <WorkspaceHeader title="About this register" />
    <ScrollView contentContainerStyle={{ padding: width >= 1100 ? 16 : 12 }}>
      <View style={{ flexDirection: width >= 1000 ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <Panel style={{ flex: 1, width: '100%', padding: width < 600 ? 18 : 20, gap: 0 }}><SectionHeader title="Installed build" />
          <BuildDetail label="Version" hint="Read from app build metadata" value={metadata.appVersion} /><BuildDetail label="Build date" value={metadata.buildDate} /><BuildDetail label="Revision" value={metadata.gitSha} />
          {updateDetails.updateId && <DetailRow label="Update ID" value={updateDetails.updateId} />}{updateDetails.channel && <DetailRow label="Update channel" value={updateDetails.channel} />}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 20 }}><Button mode="contained" contentStyle={{ minHeight: 48 }} onPress={() => void handleCheckForUpdate()} disabled={active} loading={active}>Check for update</Button><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={confirmRestart} disabled={active}>Restart app</Button></View>
        </Panel>
        <View style={{ flex: 1, width: '100%', gap: 16 }}>
          <Panel style={{ padding: width < 600 ? 18 : 20, minHeight: 174 }}><SectionHeader title="Network" /><BuildDetail label="Local IP address" value={ipAddress || 'Unknown / Not connected'} border={false} /></Panel>
          <Panel style={{ padding: width < 600 ? 18 : 20, minHeight: 180 }}><SectionHeader title="Memory diagnostics" /><Text style={{ color: t.color.muted, lineHeight: 22 }}>Device memory, native heap and JavaScript memory appear here when available.</Text>
            {memorySnapshot?.kind === 'available' ? <><MemoryDistributionBar snapshot={memorySnapshot} /><DetailRow label="Total memory" value={memorySnapshot.formattedTotal} /><DetailRow label="App memory" value={memorySnapshot.formattedAppFootprint} /><DetailRow label="Available memory" value={memorySnapshot.formattedAvailable} /></> : memorySnapshot ? <Text style={{ color: t.color.muted }}>{memoryDescription}</Text> : null}
            <Button mode="outlined" contentStyle={{ minHeight: 48 }} style={{ alignSelf: 'flex-start', marginTop: 16 }} onPress={() => void refreshMemory()} disabled={memoryLoading} loading={memoryLoading}>Refresh diagnostics</Button>
          </Panel>
        </View>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  appbar: {
    backgroundColor: BRAND_COLORS.header,
  },
  appbarTitle: {
    color: t.color.surface,
  },
  content: {
    gap: 16,
    padding: 16,
  },
  memoryBar: {
    flexDirection: 'row',
    height: 12,
    marginTop: 16,
    overflow: 'hidden',
    borderRadius: t.radius.card,
  },
  memorySegment: {
    minWidth: 1,
  },
  appMemorySegment: {
    backgroundColor: '#1976D2',
  },
  otherMemorySegment: {
    backgroundColor: '#90A4AE',
  },
  availableMemorySegment: {
    backgroundColor: '#43A047',
  },
  memoryLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  appMemoryText: {
    color: '#1976D2',
  },
  otherMemoryText: {
    color: '#607D8B',
  },
  availableMemoryText: {
    color: '#2E7D32',
  },
});
