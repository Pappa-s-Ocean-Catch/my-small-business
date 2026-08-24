import { Pressable, StyleSheet, Text, View } from 'react-native';

import { marketplaceSyncAlertStore, type MarketplaceAlertProvider } from '@/stores/marketplaceSyncAlertStore';

const PROVIDER_LABELS: Record<MarketplaceAlertProvider, string> = {
  uber_eats: 'Uber Eats',
  doordash: 'DoorDash',
};

export function MarketplaceSyncAlertBanner() {
  const alerts = marketplaceSyncAlertStore((state) => state.alerts);
  const dismiss = marketplaceSyncAlertStore((state) => state.dismiss);
  const visibleProviders = (Object.keys(PROVIDER_LABELS) as MarketplaceAlertProvider[])
    .filter((provider) => alerts[provider]?.visible);

  if (visibleProviders.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.container}>
      {visibleProviders.map((provider) => (
        <View key={provider} style={styles.banner} accessibilityRole="alert">
          <View style={styles.copy}>
            <Text style={styles.title}>{PROVIDER_LABELS[provider]} sync issue</Text>
            <Text style={styles.message}>Could not check active orders. Retrying automatically.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${PROVIDER_LABELS[provider]} sync warning`}
            hitSlop={10}
            onPress={() => dismiss(provider)}
            style={styles.dismissButton}
          >
            <Text style={styles.dismissText}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    maxWidth: 340,
    gap: 8,
    zIndex: 1000,
  },
  banner: {
    alignItems: 'center',
    backgroundColor: '#475569',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 300,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    color: '#f8fafc',
    fontSize: 12,
    marginTop: 2,
  },
  dismissButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  dismissText: {
    color: '#f8fafc',
    fontSize: 22,
    lineHeight: 22,
  },
});
