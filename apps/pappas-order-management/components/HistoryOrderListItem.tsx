import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, type GestureResponderEvent } from 'react-native';
import { Card } from 'react-native-paper';
import type { Order } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_LABELS } from '../utils/constants';
import { paymentSummary } from '../utils/orderUtils';
import { StatusBadge } from '@/components/ui';
import { fulfilmentTone, paymentTone, orderPaymentLabel } from '@/components/orders/presentation';
import { designTokens as t } from '@/lib/redesign';
interface HistoryOrderListItemProps {
  order: Order;
  successfulOrderCount?: number;
  compact?: boolean;
  onOrderPress: (order: Order) => void;
  onCustomerPress: (order: Order) => void;
}
export const HistoryOrderListItem: React.FC<HistoryOrderListItemProps> = ({ order, successfulOrderCount, onOrderPress, onCustomerPress, compact = false }) => {
  const customerName = order.customer_name || order.customer_email || 'Walk-in';
  const openCustomer = (event?: GestureResponderEvent) => { event?.stopPropagation(); onCustomerPress(order); };
  const openOrder = (event?: GestureResponderEvent) => { event?.stopPropagation(); onOrderPress(order); };
  return compact ? (
    <Pressable accessible={false} onPress={() => onOrderPress(order)} style={s.historyRow}>
      <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open order ${getFriendlyOrderNumber(order.order_number)}`} onPress={openOrder} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.rowTitle}>#{getFriendlyOrderNumber(order.order_number)}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open customer ${customerName}`} onPress={openCustomer} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[s.rowTitle, { color: t.color.primary }]}>{customerName}</Text></TouchableOpacity>
        </View>
        <Text style={s.rowMeta}>{new Date(order.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {paymentSummary(order)} · {order.items?.length || 0} items</Text>
      </View>
      <View style={s.rowActions}><StatusBadge label={STATUS_LABELS[order.order_status]} tone={order.order_status === 'completed' ? 'neutral' : fulfilmentTone(order.order_status)} /><StatusBadge label={orderPaymentLabel(order.payment_status, order.order_status)} tone={paymentTone(order.payment_status)} /><Text style={s.rowTitle}>${order.total.toFixed(2)}</Text></View>
    </Pressable>
  ) : (
    <Card accessible={false} style={s.card} mode="outlined" onPress={() => onOrderPress(order)}>
      <Card.Content style={s.content}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open order ${getFriendlyOrderNumber(order.order_number)}`} onPress={openOrder} style={[s.row, { minHeight: 44 }]}><Text style={s.reference}>#{getFriendlyOrderNumber(order.order_number)}</Text><Text style={s.total}>${order.total.toFixed(2)}</Text></TouchableOpacity>
        {order.scheduled_pickup_at && <View style={s.scheduled}><Text style={s.scheduledText}>Collection · {new Date(order.scheduled_pickup_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text></View>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open customer ${customerName}`} style={s.customerTarget} onPress={openCustomer}>
          <Text style={s.customer}>{customerName}</Text>
          {successfulOrderCount != null && <Text style={s.meta}>{successfulOrderCount} successful orders</Text>}
        </TouchableOpacity>
        <Text style={s.meta}>{paymentSummary(order)} · {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        {order.order_channel === 'third_party' && <Text style={s.meta}>{order.delivery_partner_name?.trim() || 'Marketplace'}{order.external_order_number ? ` · ID ${order.external_order_number}` : ''}</Text>}
        <View style={s.badges}><StatusBadge label={STATUS_LABELS[order.order_status]} tone={fulfilmentTone(order.order_status)} /><StatusBadge label={orderPaymentLabel(order.payment_status, order.order_status)} tone={paymentTone(order.payment_status)} /></View>
      </Card.Content>
    </Card>
  );
};
const s = StyleSheet.create({
  historyRow: { backgroundColor: t.color.surface, minHeight: 78, borderBottomWidth: 1, borderColor: t.color.border, paddingVertical: 17, paddingHorizontal: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: t.color.text },
  rowMeta: { fontSize: 13, color: t.color.muted },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  card: { backgroundColor: t.color.surface, borderColor: t.color.border, borderRadius: t.radius.card, marginBottom: 12 },
  content: { gap: 10, paddingVertical: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reference: { fontSize: 23, fontWeight: '700', color: t.color.text }, total: { fontSize: 23, color: t.color.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  customerTarget: { minHeight: 48, justifyContent: 'center', gap: 4 }, customer: { fontSize: 18, fontWeight: '600', color: t.color.primary },
  meta: { fontSize: 14, lineHeight: 21, color: t.color.muted }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, scheduled: { padding: 12, borderRadius: 10, backgroundColor: t.color.primaryTint }, scheduledText: { fontSize: 16, fontWeight: '600', color: t.color.primary },
});
