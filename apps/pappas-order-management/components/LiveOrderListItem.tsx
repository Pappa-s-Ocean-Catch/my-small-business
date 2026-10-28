import { ActionButton as Button } from '@/components/ui/ActionButton';
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, type GestureResponderEvent } from 'react-native';

import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import type { SavedPrinter } from '@/lib/escpos-printer';
import type { OrderPrintState } from '@/stores/printerAutomationStore';
import { ManualPrintButton } from '@/components/printer/ManualPrintButton';
import { StatusBadge } from '@/components/ui';
import { fulfilmentTone, paymentTone, orderPaymentLabel } from '@/components/orders/presentation';
import { designTokens as t } from '@/lib/redesign';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_LABELS, getDeliveryStatusLabel } from '../utils/constants';
import { getOrderChannel, paymentSummary, getNextQuickAction, formatElapsed } from '../utils/orderUtils';
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
  const marketplace = getOrderChannel(order) === 'third_party';
  const externalId = order.external_order_number?.trim();
  const summary = marketplace
    ? [order.delivery_partner_name?.trim() || '3rd Party', externalId ? `ID ${externalId}` : null].filter(Boolean).join(' • ')
    : paymentSummary(order);
  const controlHeight = compact ? 40 : 48;
  const headerHeight = compact ? 96 : 144;
  const itemsHeight = compact ? 72 : 116;
  const footerGap = compact ? 6 : 10;
  const footerPadding = compact ? 12 : 16;
  const bodyHeight = 10 + 48 + itemsHeight + 44;
  const footerHeight = 48 + controlHeight * 2 + 32 + footerGap * 3 + footerPadding + 1;
  const cardHeight = headerHeight + bodyHeight + footerHeight + 5;
  const controlContent = { minHeight: controlHeight, height: controlHeight };
  const secondaryStyle = [s.secondary, controlContent];
  const busy = updatingStatus === order.id;
  const active = order.order_status !== 'completed' && order.order_status !== 'cancelled';
  const paymentOpen = order.payment_status !== 'paid' && active;
  const canUpdatePayment = paymentOpen && !busy && !smartpayProcessing;
  const canSmartpay = !!onSmartpayPayment && paymentOpen;
  const separateAction = (action: () => void) => (event?: GestureResponderEvent) => {
    event?.stopPropagation();
    action();
  };
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
  return <Pressable accessible={false} onPress={() => onOrderPress(order)} style={[s.card, { height: cardHeight, borderTopColor: tone === 'success' ? t.color.success : tone === 'danger' ? t.color.danger : t.color.warning }, layout === 'horizontal' && s.wide, cardWidth != null && { width: cardWidth }, compact && { marginBottom: 8 }]}>
    <ScrollView style={[s.identity, { height: headerHeight }]} contentContainerStyle={s.identityContent} nestedScrollEnabled>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open order ${getFriendlyOrderNumber(order.order_number)}`} onPress={separateAction(() => onOrderPress(order))} style={s.row}><Text style={s.number}>#{getFriendlyOrderNumber(order.order_number)}</Text><StatusBadge label={elapsed.text} tone={elapsedTone} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Customer ${order.customer_name || order.customer_email || 'Walk-in'}`} onPress={separateAction(() => onCustomerPress(order))} hitSlop={{ top: 10, bottom: 10 }} style={s.customer}>
        <Text style={s.name}>{order.customer_name || order.customer_email || 'Walk-in'}</Text>
        {successfulOrderCount != null && successfulOrderCount > 0 && <Text style={s.small}>{successfulOrderCount} successful orders</Text>}
      </Pressable>
      <Text style={s.small}>{summary}</Text>
      {!marketplace && order.delivery_partner_name && <Text style={s.small}>{order.delivery_partner_name}</Text>}
      {!marketplace && order.external_order_number && <Text style={s.small}>External ID {order.external_order_number}</Text>}
      {order.order_type === 'delivery' && <Text style={s.small}>{getDeliveryStatusLabel(order.delivery_status)}{delivery ? ` · ${delivery}` : ''}</Text>}
    </ScrollView>
    <View style={[s.body, { height: bodyHeight }]}>
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Payment: ${orderPaymentLabel(order.payment_status, order.order_status)}`} accessibilityHint="Change payment method" accessibilityState={{ disabled: !canUpdatePayment }} disabled={!canUpdatePayment} onPress={separateAction(() => onPaymentStatusUpdate(order.id, order.payment_status))} style={s.badgeTouch}>
          <StatusBadge label={orderPaymentLabel(order.payment_status, order.order_status)} tone={paymentTone(order.payment_status)} />
        </Pressable>
        <Text style={s.total}>${order.total.toFixed(2)}</Text>
      </View>
      <ScrollView testID="live-order-item-preview" style={[s.items, { height: itemsHeight }]} contentContainerStyle={s.itemsContent} nestedScrollEnabled>
        {items.map((item) => <Text key={item.id} style={s.item}>{item.quantity} × {item.product_name}</Text>)}
      </ScrollView>
      <View style={s.moreSlot}>
        {remaining > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`View ${remaining} more items`} onPress={separateAction(() => onOrderPress(order))} style={s.moreAction}><Text style={s.moreText}>View more · {remaining} more {remaining === 1 ? 'item' : 'items'} ›</Text></Pressable>}
      </View>
    </View>
    <View style={[s.footer, { height: footerHeight, gap: footerGap, paddingBottom: footerPadding }]}>
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Status: ${STATUS_LABELS[order.order_status]}`} accessibilityHint="Change order status" disabled={busy} onPress={separateAction(() => onStatusUpdate(order, order.order_status))} style={s.badgeTouch}><StatusBadge label={STATUS_LABELS[order.order_status]} tone={tone} /></Pressable>
        <Text numberOfLines={2} style={[s.small, s.pickup]}>{pickup}</Text>
      </View>
      <View style={{ height: controlHeight }}>
      {quickAction && <Button mode="contained" onPress={separateAction(() => onQuickAction(order, quickAction.action))} loading={feedback?.isUpdating} disabled={feedback?.isUpdating || smartpayProcessing} contentStyle={controlContent}>{feedback?.label ?? quickAction.label}</Button>}
      </View>
      <View style={[s.actions, { height: controlHeight }]}>
        <ManualPrintButton printers={availablePrinters} mode="button" label="Print" style={secondaryStyle} renderTrigger={({ onPress, disabled, loading }) => <Button mode="outlined" icon="printer" style={secondaryStyle} contentStyle={controlContent} disabled={disabled} loading={loading} onPress={separateAction(onPress)}>Print</Button>} onSelectPrinter={(printer) => onPrintPress(order, printer)} />
      {canSmartpay && <Button mode="outlined" icon="credit-card-wireless-outline" accessibilityHint={!smartpayPaired ? 'Pair a SmartPay terminal in Settings to take payment' : 'Start payment on the paired terminal'} onPress={separateAction(() => onSmartpayPayment?.(order))} loading={smartpayProcessing} disabled={!smartpayPaired || smartpayProcessing || busy} style={secondaryStyle} contentStyle={controlContent}>SmartPay</Button>}
      </View>
      <View style={s.printSlot}>{printLabel && <StatusBadge label={printLabel} tone={printState?.status === 'failed' ? 'danger' : printState?.status === 'success' ? 'success' : 'neutral'} />}</View>
    </View>
  </Pressable>;
};
const s = StyleSheet.create({
  card: { alignSelf: 'flex-start', width: '100%', backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border, borderTopWidth: 4, borderRadius: t.radius.card, overflow: 'visible', marginBottom: 16, shadowColor: t.color.navy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 },
  wide: { width: '100%' },
  identity: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderColor: t.color.border },
  identityContent: { padding: 16, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { fontSize: 24, fontWeight: '700', color: t.color.text, flexShrink: 1 },
  customer: { minHeight: 24, justifyContent: 'center', position: 'relative' },
  name: { fontSize: 16, fontWeight: '700', color: t.color.text },
  small: { fontSize: 14, color: t.color.muted, lineHeight: 21 },
  body: { flexShrink: 0, paddingHorizontal: 20, paddingTop: 10 },
  total: { fontSize: 17, fontWeight: '700', color: t.color.text },
  badgeTouch: { minHeight: 48, justifyContent: 'center' },
  items: { flexGrow: 0, flexShrink: 0 },
  itemsContent: { paddingVertical: 12, gap: 5 },
  moreSlot: { height: 44, justifyContent: 'center' },
  moreAction: { minHeight: 44, justifyContent: 'center' },
  moreText: { color: t.color.primary, fontSize: 13, fontWeight: '700' },
  printSlot: { height: 32, justifyContent: 'center' },
  item: { fontSize: 16, color: t.color.text, lineHeight: 21 },
  footer: { borderBottomLeftRadius: t.radius.card - 1, borderBottomRightRadius: t.radius.card - 1, flexShrink: 0, paddingHorizontal: 20, paddingBottom: 16, gap: 10, borderTopWidth: 1, borderColor: t.color.border, backgroundColor: '#FAFCFB' },
  pickup: { flexShrink: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, minHeight: 48, justifyContent: 'center' },
});
