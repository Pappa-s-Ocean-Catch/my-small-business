import { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Appbar, Button, Card, List, Text } from 'react-native-paper';
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

export default function AboutScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [active, setActive] = useState(false);
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

  const handleRestart = async () => {
    setActive(true);
    try {
      showResult(await restartApp(updatesClient));
    } finally {
      setActive(false);
    }
  };

  const confirmRestart = () => {
    Alert.alert('Restart app?', 'The app will restart immediately.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: () => void handleRestart() },
    ]);
  };

  const handleCheckForUpdate = async () => {
    setActive(true);
    try {
      showResult(await checkAndApplyUpdate(updatesClient));
    } finally {
      setActive(false);
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

  return (
    <>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} accessibilityLabel="Open menu" iconColor="#fff" />
        <Appbar.Content title="About" titleStyle={styles.appbarTitle} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        <Button mode="outlined" icon="restart" onPress={confirmRestart} disabled={active} loading={active}>
          Restart app
        </Button>
        <Button mode="contained" icon="download" onPress={() => void handleCheckForUpdate()} disabled={active} loading={active}>
          Check for update
        </Button>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">Installed build</Text>
          </Card.Content>
          <List.Item title="Version" description={metadata.appVersion} left={(props) => <List.Icon {...props} icon="tag-outline" />} />
          <List.Item title="Build/update date" description={metadata.buildDate} left={(props) => <List.Icon {...props} icon="calendar-outline" />} />
          <List.Item title="Revision" description={metadata.gitSha} left={(props) => <List.Icon {...props} icon="source-branch" />} />
          {updateDetails.updateId ? <List.Item title="Update ID" description={updateDetails.updateId} left={(props) => <List.Icon {...props} icon="identifier" />} /> : null}
          {updateDetails.channel ? <List.Item title="Update channel" description={updateDetails.channel} left={(props) => <List.Icon {...props} icon="broadcast" />} /> : null}
        </Card>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">Network</Text>
          </Card.Content>
          <List.Item title="Local IP Address" description={ipAddress || 'Unknown / Not connected'} left={(props) => <List.Icon {...props} icon="wifi" />} />
        </Card>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">App memory footprint</Text>
            <Text variant="bodySmall">Device process memory, including JavaScript, images, and native UI.</Text>
            {memorySnapshot?.kind === 'available' ? <MemoryDistributionBar snapshot={memorySnapshot} /> : null}
          </Card.Content>
          <List.Item
            title={memorySnapshot?.kind === 'available' ? 'Total memory' : 'Memory diagnostic'}
            description={memoryDescription}
            left={(props) => <List.Icon {...props} icon="memory" />}
          />
          {memorySnapshot?.kind === 'available' ? <List.Item title="App memory" description={memorySnapshot.formattedAppFootprint} left={(props) => <List.Icon {...props} icon="application-outline" />} /> : null}
          {memorySnapshot?.kind === 'available' ? <List.Item title="Available memory" description={memorySnapshot.formattedAvailable} left={(props) => <List.Icon {...props} icon="memory" />} /> : null}
          <Card.Actions>
            <Button icon="refresh" onPress={() => void refreshMemory()} disabled={memoryLoading} loading={memoryLoading}>
              Refresh
            </Button>
          </Card.Actions>
        </Card>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  appbar: {
    backgroundColor: BRAND_COLORS.header,
  },
  appbarTitle: {
    color: '#fff',
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
    borderRadius: 6,
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
