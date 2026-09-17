import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { CustomerQueueEntry } from '@my-small-business/pos-mirror';

import { colors, spacing } from '../theme';

const statusColor = { Pending: colors.pending, Confirmed: colors.pending, Preparing: colors.preparing, Ready: colors.ready } as const;

export function CustomerQueueDisplay({ orders }: { orders: CustomerQueueEntry[] }) {
  return (
    <View style={styles.container} accessibilityLabel="Current order queue">
      <View style={styles.heading}>
        <Text variant="headlineLarge" style={styles.title}>Current orders</Text>
        <Text variant="titleMedium" style={styles.subtitle}>We are preparing these orders now</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {orders.map((order) => (
          <View key={`${order.orderNumber}-${order.sortAt}`} style={styles.row}>
            <Text variant="displaySmall" style={styles.orderNumber}>#{order.orderNumber}</Text>
            <View style={[styles.status, { backgroundColor: statusColor[order.status] }]}>
              <Text variant="titleLarge" style={styles.statusText}>{order.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl },
  heading: { marginBottom: spacing.lg },
  title: { color: colors.text, fontWeight: '800' },
  subtitle: { color: colors.mutedText, marginTop: spacing.sm },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  row: { minHeight: 84, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { color: colors.text, fontWeight: '800' },
  status: { minWidth: 150, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' },
  statusText: { color: colors.primaryOn, fontWeight: '700' },
});
