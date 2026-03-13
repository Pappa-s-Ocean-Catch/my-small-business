import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Button, Text } from 'react-native-paper';

type KitchenAlertOverlayProps = {
  title: string;
  message?: string;
  details?: string;
  primaryActionText?: string;
  onPrimaryAction?: () => void;
};

export function KitchenAlertOverlay({
  title,
  message,
  details,
  primaryActionText,
  onPrimaryAction,
}: KitchenAlertOverlayProps) {
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
        {!!details && <Text style={styles.details}>{details}</Text>}
        {!!primaryActionText && !!onPrimaryAction && (
          <Button mode="contained" onPress={onPrimaryAction} style={styles.button}>
            {primaryActionText}
          </Button>
        )}
      </View>
    </View>
  );
}

export function OfflineAttentionOverlay({ appName }: { appName: string }) {
  const [isOffline, setIsOffline] = useState(false);
  const [netLabel, setNetLabel] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      const type = state.type || 'unknown';
      const connected = state.isConnected === true ? 'connected' : 'disconnected';
      setNetLabel(`${type} • ${connected}`);
    });
    return unsubscribe;
  }, []);

  const details = useMemo(() => {
    const parts = [`App: ${appName}`];
    if (netLabel) parts.push(`Network: ${netLabel}`);
    parts.push(`Time: ${new Date().toLocaleString()}`);
    return parts.join('\n');
  }, [appName, netLabel]);

  if (!isOffline) return null;

  return (
    <KitchenAlertOverlay
      title="OFFLINE"
      message="This device is not connected to the internet. New orders and updates may not appear."
      details={details}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#b91c1c',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 18,
    padding: 18,
  },
  title: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  details: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
  button: {
    marginTop: 16,
    alignSelf: 'center',
  },
});

