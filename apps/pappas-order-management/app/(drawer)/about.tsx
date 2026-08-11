import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Appbar, Button, Card, List, Text } from 'react-native-paper';

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

export default function AboutScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [active, setActive] = useState(false);
  const metadata = getBuildMetadata(process.env, Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'Unknown');
  const updateDetails = getUpdateDetails();

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

  return (
    <>
      <Appbar.Header>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} accessibilityLabel="Open menu" />
        <Appbar.Content title="About" />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
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

        <Button mode="outlined" icon="restart" onPress={confirmRestart} disabled={active} loading={active}>
          Restart app
        </Button>
        <Button mode="contained" icon="download" onPress={() => void handleCheckForUpdate()} disabled={active} loading={active}>
          Check for update
        </Button>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    padding: 16,
  },
});
