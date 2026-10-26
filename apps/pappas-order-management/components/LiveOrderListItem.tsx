import { ActionButton as Button } from '@/components/ui/ActionButton';
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import type { SavedPrinter } from '@/lib/escpos-printer';
import type { OrderPrintState } from '@/stores/printerAutomationStore';
import { ManualPrintButton } from '@/components/printer/ManualPrintButton';
import { StatusBadge } from '@/components/ui';
import { fulfilmentTone, paymentTone, orderPaymentLabel } from '@/components/orders/presentation';
import { designTokens as t } from '@/lib/redesign';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_LABELS, getDeliveryStatusLabel } from '../utils/constants';
import { paymentSummary, getNextQuickAction, formatElapsed } from '../utils/orderUtils';
import { getOrderActionFeedback } from '../lib/order-status-feedback';

type LiveOrderCardLayout = 'horizontal' | 'vertical';

interface LiveOrderListItemProps {
  order: Order;
  successfulOrderCount?: number;
  nowMs: number;
  updatingStatus: string | null;
  onOrderPress: (order: Order) => void;
  onCustomerPress: (order: Order) => void;
  onPrintPress: (order: Order, printer: SavedPrinter | null) => void | boolean | Promise<void | boolean>;
  availablePrinters: SavedPrinter[];
  onQuickAction: (order: Order, action: string) => void;
  onSmartpayPayment?: (order: Order) => void;
  smartpayPaired?: boolean;
  smartpayProcessing?: boolean;
  onStatusUpdate: (order: Order, status: OrderStatus) => void;
  onPaymentStatusUpdate: (orderId: string, status: PaymentStatus, paymentMethodDetail?: string | null) => void;
  layout?: LiveOrderCardLayout;
  compact?: boolean;
  cardWidth?: number;
  printState?: OrderPrintState | null;
  previewItemsLimit?: number;
}

export const LiveOrderListItem: React.FC<LiveOrderListItemProps> = ({
  order, successfulOrderCount, nowMs, updatingStatus, onOrderPress, onCustomerPress,
  onPrintPress, availablePrinters, onQuickAction, onSmartpayPayment,
  smartpayPaired = false, smartpayProcessing = false, onStatusUpdate,
  onPaymentStatusUpdate, layout = 'horizontal', compact = false, cardWidth,
  printState = null, previewItemsLimit = 3,
}) => {
  const busy = updatingStatus === order.id;
  const active = order.order_status !== 'completed' && order.order_status !== 'cancelled';
  const canUpdatePayment = order.payment_status !== 'paid' && active && !busy;
  const canSmartpay = smartpayPaired && !!onSmartpayPayment && order.payment_status !== 'paid' && active;
  const quickAction = getNextQuickAction(order);
  const feedback = quickAction ? getOrderActionFeedback(order.id, updatingStatus, quickAction.label) : null;
  const elapsed = formatElapsed(order.created_at, nowMs, order.scheduled_pickup_at);
  const elapsedTone = elapsed.overdue || (!elapsed.isCountdown && elapsed.minutes >= 20) ? 'danger' : 'warning';
  const tone = fulfilmentTone(order.order_status);
  const items = (order.items || []).slice(0, previewItemsLimit);
  const remaining = Math.max(0, (order.items?.length || 0) - items.length);
  const pickup = order.scheduled_pickup_at ? `Pickup ${new Date(order.scheduled_pickup_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'ASAP';
  const delivery = [order.delivery_driver_name ? `Driver ${order.delivery_driver_name}` : null, order.delivery_driver_pin ? `PIN ${order.delivery_driver_pin}` : null].filter(Boolean).join(' · ');
  const printLabel = printState ? ({ failed: 'Print failed', printing: 'Printing…', queued: 'Print queued', success: 'Printed' } as Record<string, string>)[printState.status] : null;
  return <View style={[s.card, { borderTopColor: tone === 'success' ? t.color.success : tone === 'danger' ? t.color.danger : t.color.warning }, layout === 'horizontal' && s.wide, cardWidth != null && { width: cardWidth }, compact && { marginBottom: 8 }]}>
    <View style={s.identity}>
      <View style={s.row}><Text style={s.number}>#{getFriendlyOrderNumber(order.order_number)}</Text><StatusBadge label={elapsed.text} tone={elapsedTone} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Customer ${order.customer_name || order.customer_email || 'Walk-in'}`} onPress={() => onCustomerPress(order)} hitSlop={{ top: 10, bottom: 10 }} style={s.customer}>
        <Text style={s.name}>{order.customer_name || order.customer_email || 'Walk-in'}</Text>
        {successfulOrderCount != null && successfulOrderCount > 0 && <Text style={s.small}>{successfulOrderCount} successful orders</Text>}
      </Pressable>
      <Text style={s.small}>{paymentSummary(order)}</Text>
      {order.delivery_partner_name && <Text style={s.small}>{order.delivery_partner_name}</Text>}
      {order.external_order_number && <Text style={s.small}>External ID {order.external_order_number}</Text>}
      {order.order_type === 'delivery' && <Text style={s.small}>{getDeliveryStatusLabel(order.delivery_status)}{delivery ? ` · ${delivery}` : ''}</Text>}
    </View>
    <View style={s.body}>
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Payment: ${orderPaymentLabel(order.payment_status, order.order_status)}`} accessibilityState={{ disabled: !canUpdatePayment }} disabled={!canUpdatePayment} onPress={() => onPaymentStatusUpdate(order.id, order.payment_status)} style={s.badgeTouch}>
          <StatusBadge label={orderPaymentLabel(order.payment_status, order.order_status)} tone={paymentTone(order.payment_status)} />
        </Pressable>
        <Text style={s.total}>${order.total.toFixed(2)}</Text>
      </View>
      <View style={s.items}>{items.map((item) => <Text key={item.id} style={s.item}>{item.quantity} × {item.product_name}</Text>)}{remaining > 0 && <Text style={s.small}>+{remaining} more items</Text>}</View>
    </View>
    <View style={s.footer}>
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Status: ${STATUS_LABELS[order.order_status]}`} disabled={busy} onPress={() => onStatusUpdate(order, order.order_status)} style={s.badgeTouch}><StatusBadge label={STATUS_LABELS[order.order_status]} tone={tone} /></Pressable>
        <Text style={[s.small, s.pickup]}>{pickup}</Text>
      </View>
      {quickAction && <Button mode="contained" onPress={() => onQuickAction(order, quickAction.action)} loading={feedback?.isUpdating} disabled={feedback?.isUpdating || smartpayProcessing} contentStyle={s.primary}>{feedback?.label ?? quickAction.label}</Button>}
      <View style={s.actions}><Button mode="outlined" style={s.secondary} contentStyle={s.secondaryContent} onPress={() => onOrderPress(order)}>View order</Button><ManualPrintButton printers={availablePrinters} mode="button" label="Print" style={s.secondary} onSelectPrinter={(printer) => onPrintPress(order, printer)} /></View>
      {canSmartpay && <Button mode="outlined" icon="credit-card-wireless-outline" onPress={() => onSmartpayPayment?.(order)} loading={smartpayProcessing} disabled={smartpayProcessing || busy} contentStyle={s.secondaryContent}>SmartPay</Button>}
      {printLabel && <StatusBadge label={printLabel} tone={printState?.status === 'failed' ? 'danger' : printState?.status === 'success' ? 'success' : 'neutral'} />}
    </View>
  </View>;
};
const s = StyleSheet.create({
  card: { alignSelf: 'flex-start', width: '100%', backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border, borderTopWidth: 4, borderRadius: t.radius.card, overflow: 'hidden', marginBottom: 16 },
  wide: { width: '100%' },
  identity: { padding: 20, gap: 2, borderBottomWidth: 1, borderColor: t.color.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { fontSize: 24, fontWeight: '700', color: t.color.text, flexShrink: 1 },
  customer: { minHeight: 24, justifyContent: 'center', position: 'relative' },
  name: { fontSize: 16, fontWeight: '700', color: t.color.text },
  small: { fontSize: 14, color: t.color.muted, lineHeight: 21 },
  body: { paddingHorizontal: 20, paddingTop: 10 },
  total: { fontSize: 17, fontWeight: '700', color: t.color.text },
  badgeTouch: { minHeight: 48, justifyContent: 'center' },
  items: { minHeight: 116, paddingTop: 12, paddingBottom: 20, gap: 5 },
  item: { fontSize: 16, color: t.color.text, lineHeight: 21 },
  footer: { paddingHorizontal: 20, paddingBottom: 16, gap: 10, borderTopWidth: 1, borderColor: t.color.border, backgroundColor: '#FAFCFB' },
  pickup: { flexShrink: 1, textAlign: 'right' },
  primary: { minHeight: 48 },
  actions: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, minHeight: 48, justifyContent: 'center' },
  secondaryContent: { minHeight: 48 },
});
