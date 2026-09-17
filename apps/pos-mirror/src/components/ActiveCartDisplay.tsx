import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { MirrorOrderSnapshotV1 } from '@my-small-business/pos-mirror';

import { colors, spacing } from '../theme';

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function ActiveCartDisplay({ snapshot }: { snapshot: MirrorOrderSnapshotV1 }) {
  return (
    <View style={styles.container} accessibilityLabel={`Current order with ${snapshot.itemCount} items`}>
      <View style={styles.itemsPanel}>
        <View style={styles.headingRow}>
          <View>
            <Text variant="headlineMedium" style={styles.title}>Your order</Text>
            <Text variant="titleMedium" style={styles.itemCount}>{snapshot.itemCount} item{snapshot.itemCount === 1 ? '' : 's'}</Text>
          </View>
          <Text variant="titleMedium" style={styles.live}>LIVE</Text>
        </View>
        <ScrollView contentContainerStyle={styles.items} showsVerticalScrollIndicator={false}>
          {snapshot.items.map((item) => (
            <View key={item.id} style={styles.line}>
              <Text variant="headlineSmall" style={styles.quantity}>{item.quantity}×</Text>
              <View style={styles.nameBlock}>
                <Text variant="titleLarge" style={styles.name}>{item.name}</Text>
                <Text variant="bodyLarge" style={styles.unitPrice}>{money(item.unitPrice)} each</Text>
              </View>
              <Text variant="titleLarge" style={styles.lineTotal}>{money(item.lineTotal)}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.totalPanel}>
        <Text variant="titleLarge" style={styles.totalLabel}>Order total</Text>
        <View style={styles.summaryRow}><Text variant="bodyLarge">Subtotal</Text><Text variant="bodyLarge">{money(snapshot.subtotal)}</Text></View>
        {snapshot.discount > 0 && <View style={styles.summaryRow}><Text variant="bodyLarge">Discount</Text><Text variant="bodyLarge">−{money(snapshot.discount)}</Text></View>}
        <View style={styles.divider} />
        <Text variant="displaySmall" style={styles.total}>{money(snapshot.total)}</Text>
        <Text variant="bodyLarge" style={styles.taxHint}>Please check your order before payment.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  itemsPanel: { flex: 1.55, padding: spacing.xl },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  title: { color: colors.text, fontWeight: '700' },
  itemCount: { color: colors.mutedText, marginTop: spacing.xs },
  live: { color: colors.primary, fontWeight: '800', letterSpacing: 1.4 },
  items: { gap: spacing.md, paddingBottom: spacing.md },
  line: { minHeight: 84, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quantity: { minWidth: 52, color: colors.primary, fontWeight: '800' },
  nameBlock: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  unitPrice: { color: colors.mutedText, marginTop: spacing.xs },
  lineTotal: { color: colors.text, fontWeight: '700' },
  totalPanel: { flex: 0.85, backgroundColor: colors.text, padding: spacing.xl, justifyContent: 'center' },
  totalLabel: { color: '#F9E9DE', marginBottom: spacing.xl },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.sm },
  divider: { height: 1, backgroundColor: '#745D52', marginVertical: spacing.md },
  total: { color: colors.primaryOn, fontWeight: '800', marginBottom: spacing.lg },
  taxHint: { color: '#E1CCC0', lineHeight: 22 },
});
