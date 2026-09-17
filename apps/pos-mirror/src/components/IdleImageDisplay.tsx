import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { colors, spacing } from '../theme';

export function IdleImageDisplay({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <Pressable
      style={styles.container}
      onLongPress={onOpenSettings}
      delayLongPress={800}
      accessibilityRole="button"
      accessibilityLabel="Welcome display. Long press to open settings."
    >
      <View style={styles.content}>
        <Text variant="displaySmall" style={styles.brand}>Pappas</Text>
        <Text variant="headlineMedium" style={styles.welcome}>Thanks for visiting</Text>
        <Text variant="titleLarge" style={styles.detail}>Your order will appear here</Text>
      </View>
      <Text variant="bodyMedium" style={styles.replaceHint}>Idle artwork can be replaced from the app assets when supplied.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.accent, padding: spacing.lg },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  brand: { color: colors.surfaceMuted, fontWeight: '800', letterSpacing: 3, marginBottom: spacing.lg },
  welcome: { color: colors.primaryOn, fontWeight: '800', textAlign: 'center' },
  detail: { color: colors.surfaceMuted, textAlign: 'center', marginTop: spacing.md },
  replaceHint: { color: colors.surface, opacity: 0.8, textAlign: 'center' },
});
