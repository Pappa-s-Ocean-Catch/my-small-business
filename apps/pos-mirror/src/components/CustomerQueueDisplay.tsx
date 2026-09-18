import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, Pressable } from 'react-native';
import { Text, Portal, Modal, Button, Divider } from 'react-native-paper';
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

  const [selectedOrder, setSelectedOrder] = useState<CustomerQueueEntry | null>(null);

  // If the selected order is removed from the queue or its data changes, update it.
  // Actually, we can just find it from the updated orders list so it reflects the latest status/items, or close it if it's gone.
  const activeSelectedOrder = selectedOrder ? orders.find((o) => o.id === selectedOrder.id) : null;

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
              <Pressable key={order.orderNumber} style={styles.card} onPress={() => setSelectedOrder(order)}>
                <Text variant="headlineSmall" style={styles.orderNumber}>
                  {order.orderNumber}{order.customerName ? ` - ${order.customerName}` : ''}
                </Text>
              </Pressable>
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
              <Pressable key={order.orderNumber} style={[styles.card, styles.readyCard]} onPress={() => setSelectedOrder(order)}>
                <Text variant="headlineMedium" style={styles.orderNumber}>
                  {order.orderNumber}{order.customerName ? ` - ${order.customerName}` : ''}
                </Text>
                <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                  COLLECT NOW
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      <Portal>
        <Modal visible={!!activeSelectedOrder} onDismiss={() => setSelectedOrder(null)} contentContainerStyle={styles.modalContainer}>
          {activeSelectedOrder && (
            <>
              <View style={styles.modalHeader}>
                <Text variant="headlineMedium" style={styles.modalTitle}>
                  {activeSelectedOrder.orderNumber}{activeSelectedOrder.customerName ? ` - ${activeSelectedOrder.customerName}` : ''}
                </Text>
                <Text style={[styles.statusText, { color: getStatusColor(activeSelectedOrder.status) }]}>
                  {activeSelectedOrder.status === 'Ready' ? 'COLLECT NOW' : activeSelectedOrder.status.toUpperCase()}
                </Text>
              </View>
              
              <Divider style={styles.modalDivider} />
              
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                {activeSelectedOrder.items && activeSelectedOrder.items.length > 0 ? (
                  activeSelectedOrder.items.map((item) => (
                    <View key={item.id} style={styles.modalItem}>
                      <View style={styles.modalItemRow}>
                        <Text variant="titleMedium" style={styles.modalItemQty}>{item.quantity}x</Text>
                        <Text variant="titleMedium" style={styles.modalItemName}>{item.product_name}</Text>
                        <Text variant="titleMedium" style={styles.modalItemPrice}>${item.subtotal.toFixed(2)}</Text>
                      </View>
                      {item.order_item_addons && item.order_item_addons.length > 0 && (
                        <View style={styles.modalItemAddons}>
                          {item.order_item_addons.map((addon) => (
                            <Text key={addon.id} variant="bodyMedium" style={styles.modalAddonText}>
                              + {addon.addon_item_name}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyItemsText}>No items found.</Text>
                )}
              </ScrollView>

              <Divider style={styles.modalDivider} />

              <View style={styles.modalFooter}>
                <Text variant="headlineSmall" style={styles.modalTotalLabel}>Total</Text>
                <Text variant="headlineSmall" style={styles.modalTotalPrice}>${activeSelectedOrder.total.toFixed(2)}</Text>
              </View>
              
              <Button mode="contained" onPress={() => setSelectedOrder(null)} style={styles.modalCloseBtn} labelStyle={styles.modalCloseBtnLabel}>
                Close
              </Button>
            </>
          )}
        </Modal>
      </Portal>
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
  modalContainer: { backgroundColor: colors.surface, margin: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, maxHeight: '90%', alignSelf: 'center', width: '100%', maxWidth: 720 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: colors.text, fontWeight: '800' },
  modalDivider: { marginVertical: spacing.lg, backgroundColor: colors.border },
  modalScroll: { flexShrink: 1 },
  modalScrollContent: { gap: spacing.md },
  modalItem: { gap: spacing.xs },
  modalItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  modalItemQty: { color: colors.text, fontWeight: '700', width: 32 },
  modalItemName: { color: colors.text, flex: 1, fontWeight: '600' },
  modalItemPrice: { color: colors.text, fontWeight: '700' },
  modalItemAddons: { paddingLeft: 40 },
  modalAddonText: { color: colors.mutedText },
  emptyItemsText: { color: colors.mutedText, textAlign: 'center', marginVertical: spacing.xl },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTotalLabel: { color: colors.text, fontWeight: '700' },
  modalTotalPrice: { color: colors.text, fontWeight: '800' },
  modalCloseBtn: { borderRadius: radius.md },
  modalCloseBtnLabel: { fontSize: 18, paddingVertical: 4 },
});
