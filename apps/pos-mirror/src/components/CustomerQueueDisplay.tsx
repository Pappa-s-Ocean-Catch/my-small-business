import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import type { CustomerQueueEntry } from '@my-small-business/pos-mirror';

import { colors, radius, spacing } from '../theme';

function getStatusColor(status: CustomerQueueEntry['status']) {
  switch (status) {
    case 'Ready': return colors.ready;
    case 'Preparing': return colors.preparing;
    case 'Pending':
    case 'Confirmed':
      return colors.pending;
    default:
      return colors.text;
  }
}

export function CustomerQueueDisplay({ orders }: { orders: CustomerQueueEntry[] }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 600;

  const readyOrders = orders.filter((o) => o.status === 'Ready');
  const preparingOrders = orders.filter((o) => o.status === 'Preparing' || o.status === 'Confirmed' || o.status === 'Pending');

  return (
    <View style={styles.container}>
      <View style={[styles.grid, { flexDirection: isCompact ? 'column' : 'row' }]}>
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Text variant="headlineSmall" style={styles.columnTitle}>Preparing</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{preparingOrders.length}</Text></View>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {preparingOrders.map((order) => (
              <View key={order.orderNumber} style={styles.card}>
                <Text variant="headlineSmall" style={styles.orderNumber}>{order.orderNumber}</Text>
                <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                  {order.status.toUpperCase()}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Text variant="headlineSmall" style={styles.columnTitle}>Ready</Text>
            <View style={[styles.countBadge, styles.readyBadge]}><Text style={styles.readyCountText}>{readyOrders.length}</Text></View>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {readyOrders.map((order) => (
              <View key={order.orderNumber} style={[styles.card, styles.readyCard]}>
                <Text variant="headlineMedium" style={styles.orderNumber}>{order.orderNumber}</Text>
                <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                  COLLECT NOW
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  grid: { flex: 1, gap: spacing.xl },
  column: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg, paddingBottom: spacing.sm },
  columnTitle: { color: colors.text, fontWeight: '800' },
  countBadge: { backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.round },
  countText: { color: colors.text, fontWeight: '700' },
  readyBadge: { backgroundColor: colors.ready },
  readyCountText: { color: colors.surface, fontWeight: '700' },
  list: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { backgroundColor: colors.background, padding: spacing.lg, borderRadius: radius.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readyCard: { backgroundColor: '#F0FDF4' },
  orderNumber: { color: colors.text, fontWeight: '800' },
  statusText: { fontWeight: '700', letterSpacing: 1 },
});
