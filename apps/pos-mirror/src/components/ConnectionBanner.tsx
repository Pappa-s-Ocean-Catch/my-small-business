import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { colors, spacing } from '../theme';

export function ConnectionBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <View style={styles.banner} accessibilityLiveRegion="polite"><Text style={styles.text}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, backgroundColor: '#FFF0DD', borderColor: '#D67A1A', borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  text: { color: colors.warning, textAlign: 'center', fontWeight: '600' },
});
