import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Card, Button as PaperButton } from 'react-native-paper';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import type { SavedPrinter } from '@/lib/escpos-printer';
import { ManualPrintButton } from '@/components/printer/ManualPrintButton';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  getDeliveryStatusColor,
  getDeliveryStatusLabel,
} from '../utils/constants';
import { paymentSummary, getNextQuickAction, formatElapsed } from '../utils/orderUtils';
import { getOrderActionFeedback } from '../lib/order-status-feedback';
import type { OrderPrintState } from '@/stores/printerAutomationStore';
import { isCompactPhoneWidth } from '@/lib/responsive';

type LiveOrderCardLayout = 'horizontal' | 'vertical';

interface LiveOrderListItemProps {
  order: Order;
  nowMs: number;
  updatingStatus: string | null;
  onOrderPress: (order: Order) => void;
  onCustomerPress: (order: Order) => void;
  onPrintPress: (order: Order, printer: SavedPrinter | null) => void;
  availablePrinters: SavedPrinter[];
  onQuickAction: (order: Order, action: string) => void;
  onSmartpayPayment?: (order: Order) => void;
  smartpayPaired?: boolean;
  smartpayProcessing?: boolean;
  onStatusUpdate: (order: Order, status: OrderStatus) => void;
  onPaymentStatusUpdate: (orderId: string, status: PaymentStatus, paymentMethodDetail?: string | null) => void;
  layout?: LiveOrderCardLayout;
  printState?: OrderPrintState | null;
}

export const LiveOrderListItem: React.FC<LiveOrderListItemProps> = ({
  order,
  nowMs,
  updatingStatus,
  onOrderPress,
  onCustomerPress,
  onPrintPress,
  availablePrinters,
  onQuickAction,
  onSmartpayPayment,
  smartpayPaired = false,
  smartpayProcessing = false,
  onStatusUpdate,
  onPaymentStatusUpdate,
  layout = 'horizontal',
  printState = null,
}) => {
  const { width } = useWindowDimensions();
  const isPhoneLayout = isCompactPhoneWidth(width);
  const isDeliveryOrder = order.order_type === 'delivery';
  const isThirdPartyOrder = order.order_channel === 'third_party';
  const statusColor = STATUS_COLORS[order.order_status];
  const statusLabel = STATUS_LABELS[order.order_status];
  const paymentColor = PAYMENT_STATUS_COLORS[order.payment_status];
  const paymentLabel = PAYMENT_STATUS_LABELS[order.payment_status];
  const deliveryStatusColor = getDeliveryStatusColor(order.delivery_status);
  const deliveryStatusLabel = getDeliveryStatusLabel(order.delivery_status);
  const quickAction = getNextQuickAction(order);
  const quickActionFeedback = quickAction
    ? getOrderActionFeedback(order.id, updatingStatus, quickAction.label)
    : null;
  const elapsed = formatElapsed(order.created_at, nowMs, order.scheduled_pickup_at);
  const elapsedColor = elapsed.isCountdown
    ? !elapsed.overdue && elapsed.minutes > 15
      ? '#16a34a'
      : !elapsed.overdue
        ? '#ca8a04'
        : '#dc2626'
    : elapsed.minutes < 10
      ? '#16a34a'
      : elapsed.minutes < 20
        ? '#ca8a04'
        : '#dc2626';
  const isPaid = order.payment_status === 'paid';
  const canSmartpay =
    smartpayPaired &&
    !!onSmartpayPayment &&
    order.payment_status !== 'paid' &&
    order.order_status !== 'completed' &&
    order.order_status !== 'cancelled';
  const canUpdatePayment =
    updatingStatus !== order.id &&
    order.payment_status !== 'paid' &&
    order.order_status !== 'completed' &&
    order.order_status !== 'cancelled';

  const previewItems = (order.items || []).slice(0, 3);
  const extraItemCount = Math.max(0, (order.items?.length || 0) - previewItems.length);
  const pickupLabel = order.scheduled_pickup_at
    ? `PICKUP ${new Date(order.scheduled_pickup_at).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'ASAP';
  const deliveryMeta = [
    order.delivery_driver_name ? `Driver ${order.delivery_driver_name}` : null,
    order.delivery_driver_pin ? `PIN ${order.delivery_driver_pin}` : null,
  ].filter(Boolean).join(' • ');
  const deliveryPartnerLabel = order.delivery_partner_name?.trim() || (isThirdPartyOrder ? '3rd Party' : 'Delivery');
  const externalOrderLabel = order.external_order_number?.trim() ? `External ID ${order.external_order_number.trim()}` : null;
  const deliveryPartnerTone = /door\s*dash/i.test(deliveryPartnerLabel)
    ? { backgroundColor: '#fff1f2', borderColor: '#fb7185', textColor: '#be123c' }
    : /uber/i.test(deliveryPartnerLabel)
      ? { backgroundColor: '#ecfdf5', borderColor: '#34d399', textColor: '#047857' }
      : { backgroundColor: '#eff6ff', borderColor: '#60a5fa', textColor: '#1d4ed8' };
  const printStateTone = printState?.status === 'failed'
    ? { backgroundColor: '#fee2e2', textColor: '#b91c1c', borderColor: '#fca5a5', label: 'Print failed' }
    : printState?.status === 'printing'
      ? { backgroundColor: '#dbeafe', textColor: '#1d4ed8', borderColor: '#93c5fd', label: 'Printing...' }
      : printState?.status === 'queued'
        ? { backgroundColor: '#fef3c7', textColor: '#b45309', borderColor: '#fcd34d', label: 'Queued' }
        : printState?.status === 'success'
          ? { backgroundColor: '#dcfce7', textColor: '#15803d', borderColor: '#86efac', label: 'Printed' }
          : null;

  const statusControls = (
    <View style={layout === 'vertical' ? styles.verticalStatusControls : styles.statusControls}>
      <View style={styles.statusControl}>
        <Text style={styles.statusControlLabel}>Status</Text>
        <View style={styles.statusSelectContainer}>
          <TouchableOpacity
            style={[styles.statusSelect, { backgroundColor: statusColor }]}
            onPress={() => onStatusUpdate(order, order.order_status)}
            disabled={updatingStatus === order.id}
          >
            <Text style={styles.statusSelectText}>{statusLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.statusControl}>
        <Text style={styles.statusControlLabel}>Payment</Text>
        <View style={styles.statusSelectContainer}>
          <TouchableOpacity
            style={[styles.statusSelect, { backgroundColor: paymentColor }]}
            onPress={() => onPaymentStatusUpdate(order.id, order.payment_status)}
            disabled={!canUpdatePayment}
          >
            <Text style={styles.statusSelectText}>{paymentLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const actionButtons = (
    <View style={layout === 'vertical' ? styles.verticalActionsCluster : styles.actionsCluster}>
      <ManualPrintButton
        printers={availablePrinters}
        mode="icon"
        label="Print order"
        onSelectPrinter={(printer) => onPrintPress(order, printer)}
      />
      {canSmartpay && (
        <PaperButton
          mode="outlined"
          icon="credit-card-wireless-outline"
          onPress={() => onSmartpayPayment(order)}
          loading={smartpayProcessing}
          disabled={smartpayProcessing || updatingStatus === order.id}
          style={styles.bodySmartpayButton}
          contentStyle={styles.bodySmartpayButtonContent}
          labelStyle={styles.secondaryActionLabel}
          compact
        >
          SmartPay
        </PaperButton>
      )}
      {quickAction && (
        <PaperButton
          mode="contained"
          onPress={() => onQuickAction(order, quickAction.action)}
          loading={quickActionFeedback?.isUpdating}
          disabled={quickActionFeedback?.isUpdating || smartpayProcessing}
          style={styles.bodyQuickButton}
          contentStyle={styles.bodyQuickButtonContent}
          labelStyle={styles.primaryActionLabel}
          compact
        >
          {quickActionFeedback?.label ?? quickAction.label}
        </PaperButton>
      )}
    </View>
  );

  if (layout === 'vertical') {
    return (
      <Card
        style={[
          styles.verticalOrderCard,
          isPhoneLayout ? styles.verticalOrderCardPhone : null,
          isDeliveryOrder ? styles.deliveryOrderCard : null,
        ]}
        onPress={() => onOrderPress(order)}
      >
        <Card.Content style={styles.verticalCardContent}>
          <View style={styles.verticalHeader}>
            <View style={styles.verticalIdentity}>
              <View style={styles.orderTitleRow}>
                <Text style={styles.orderNumber}>{getFriendlyOrderNumber(order.order_number)}</Text>
                {printStateTone ? (
                  <View style={[styles.printStateBadge, { backgroundColor: printStateTone.backgroundColor, borderColor: printStateTone.borderColor }]}>
                    <Text style={[styles.printStateBadgeText, { color: printStateTone.textColor }]}>
                      {printStateTone.label}
                    </Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => onCustomerPress(order)}>
                <Text style={styles.verticalCustomerName} numberOfLines={1}>
                  {order.customer_name || order.customer_email}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.elapsedPill, styles.verticalElapsedPill, { backgroundColor: elapsedColor }]}>
              <Text style={styles.elapsedText}>{elapsed.text}</Text>
            </View>
          </View>

          <View style={styles.verticalChipRow}>
            {isDeliveryOrder || isThirdPartyOrder ? (
              <View
                style={[
                  styles.partnerBadge,
                  {
                    backgroundColor: deliveryPartnerTone.backgroundColor,
                    borderColor: deliveryPartnerTone.borderColor,
                  },
                ]}
              >
                <Text style={[styles.partnerBadgeText, { color: deliveryPartnerTone.textColor }]}>
                  {deliveryPartnerLabel}
                </Text>
              </View>
            ) : null}
            <View style={[styles.pickupBadge, order.scheduled_pickup_at ? styles.pickupScheduled : styles.pickupAsap]}>
              <Text style={styles.pickupText} numberOfLines={1}>{pickupLabel}</Text>
            </View>
            <View style={[styles.compactChip, { backgroundColor: statusColor }]}>
              <Text style={styles.compactChipText}>{statusLabel}</Text>
            </View>
            {order.order_type === 'delivery' ? (
              <View style={[styles.compactChip, { backgroundColor: deliveryStatusColor }]}>
                <Text style={styles.compactChipText}>{deliveryStatusLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.verticalMetaGrid}>
            <View>
              <Text style={styles.verticalMetaLabel}>Summary</Text>
              <Text style={styles.verticalMetaValue} numberOfLines={2}>{paymentSummary(order)}</Text>
              {externalOrderLabel ? (
                <Text style={styles.deliveryMetaValue} numberOfLines={1}>{externalOrderLabel}</Text>
              ) : null}
              {order.order_type === 'delivery' ? (
                <Text style={styles.deliveryMetaValue} numberOfLines={2}>
                  {deliveryMeta || 'Awaiting driver assignment'}
                </Text>
              ) : null}
            </View>
            <View style={styles.verticalMetaRight}>
              <Text style={[styles.paymentAttention, isPaid ? styles.paymentAttentionPaid : styles.paymentAttentionUnpaid]}>
                {isPaid ? 'PAID' : 'UNPAID'}
              </Text>
              <Text style={styles.verticalTotal}>${order.total.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.itemsPreviewBlock}>
            <Text style={styles.verticalMetaLabel}>Items</Text>
            {previewItems.map((item) => (
              <Text key={item.id} style={styles.itemPreviewText} numberOfLines={1}>
                {item.quantity}x {item.product_name}
              </Text>
            ))}
            {extraItemCount > 0 ? (
              <Text style={styles.itemPreviewMore}>+{extraItemCount} more</Text>
            ) : null}
          </View>

          <View style={styles.verticalFooter}>
            {statusControls}
            {actionButtons}
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card
      style={[
        styles.orderCard,
        isDeliveryOrder ? styles.deliveryOrderCard : null,
      ]}
      onPress={() => onOrderPress(order)}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={styles.identityBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.orderNumber}>{getFriendlyOrderNumber(order.order_number)}</Text>
              {printStateTone ? (
                <View style={[styles.printStateBadge, { backgroundColor: printStateTone.backgroundColor, borderColor: printStateTone.borderColor }]}>
                  <Text style={[styles.printStateBadgeText, { color: printStateTone.textColor }]}>
                    {printStateTone.label}
                  </Text>
                </View>
              ) : null}
              {isDeliveryOrder || isThirdPartyOrder ? (
                <View
                  style={[
                    styles.partnerBadge,
                    {
                      backgroundColor: deliveryPartnerTone.backgroundColor,
                      borderColor: deliveryPartnerTone.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.partnerBadgeText, { color: deliveryPartnerTone.textColor }]}>
                    {deliveryPartnerLabel}
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.pickupBadge,
                  order.scheduled_pickup_at ? styles.pickupScheduled : styles.pickupAsap,
                ]}
              >
                <Text style={styles.pickupText}>
                  {pickupLabel}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <TouchableOpacity onPress={() => onCustomerPress(order)}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {order.customer_name || order.customer_email}
                </Text>
              </TouchableOpacity>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.orderType} numberOfLines={1}>
                {paymentSummary(order)}
              </Text>
            </View>
            {externalOrderLabel ? (
              <Text style={styles.deliverySummaryText} numberOfLines={1}>
                {externalOrderLabel}
              </Text>
            ) : null}
            {order.order_type === 'delivery' ? (
              <View style={styles.deliveryStatusRow}>
                <View style={[styles.deliveryStatusBadge, { backgroundColor: deliveryStatusColor }]}>
                  <Text style={styles.deliveryStatusText}>{deliveryStatusLabel}</Text>
                </View>
                <Text style={styles.deliverySummaryText} numberOfLines={1}>
                  {deliveryMeta || 'Awaiting driver assignment'}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.urgencyBlock}>
            <View style={[styles.elapsedPill, { backgroundColor: elapsedColor }]}>
              <Text style={styles.elapsedText}>{elapsed.text}</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.moneyBlock}>
            <Text
              style={[
                styles.paymentAttention,
                isPaid ? styles.paymentAttentionPaid : styles.paymentAttentionUnpaid,
              ]}
            >
              {isPaid ? 'PAID' : 'UNPAID'}
            </Text>
            <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
          </View>

          <View style={styles.controlsRow}>
            {statusControls}
            {actionButtons}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  orderCard: {
    marginBottom: 8,
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  verticalOrderCard: {
    width: 336,
    marginRight: 16,
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe5f0',
  },
  verticalOrderCardPhone: {
    width: '100%',
    marginRight: 0,
  },
  deliveryOrderCard: {
    borderColor: '#14b8a6',
    borderWidth: 2,
  },
  cardContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  verticalCardContent: {
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  verticalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  identityBlock: {
    flex: 1,
  },
  verticalIdentity: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  printStateBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  printStateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metaRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  deliveryStatusRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  verticalCustomerName: {
    fontSize: 17,
    color: '#0f766e',
    fontWeight: '700',
  },
  metaDot: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
  },
  orderType: {
    fontSize: 13,
    color: '#6b7280',
  },
  deliveryStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deliveryStatusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  deliverySummaryText: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  pickupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pickupScheduled: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  pickupAsap: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  pickupText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  verticalChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  compactChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  compactChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  partnerBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  partnerBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  urgencyBlock: {
    alignItems: 'flex-end',
  },
  elapsedPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalElapsedPill: {
    minWidth: 106,
  },
  elapsedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  verticalMetaGrid: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  verticalMetaLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  verticalMetaValue: {
    marginTop: 6,
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  deliveryMetaValue: {
    marginTop: 6,
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  verticalMetaRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  verticalTotal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  itemsPreviewBlock: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#eef2f7',
    gap: 6,
  },
  itemPreviewText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  itemPreviewMore: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
    gap: 10,
  },
  verticalFooter: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#eef2f7',
    gap: 12,
  },
  moneyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  paymentAttention: {
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  paymentAttentionPaid: {
    backgroundColor: '#ecfdf5',
    color: '#10b981',
  },
  paymentAttentionUnpaid: {
    backgroundColor: '#fef2f2',
    color: '#ef4444',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  controlsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusControls: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  verticalStatusControls: {
    flexDirection: 'row',
    gap: 10,
  },
  statusControl: {
    minWidth: 96,
    flex: 1,
  },
  statusControlLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusSelectContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusSelect: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSelectText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  actionsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
  },
  verticalActionsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  printButton: {
    margin: 0,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  bodySmartpayButton: {
    borderRadius: 8,
    borderColor: '#2563eb',
    minHeight: 40,
  },
  bodySmartpayButtonContent: {
    height: 40,
    paddingHorizontal: 10,
  },
  bodyQuickButton: {
    borderRadius: 8,
    backgroundColor: '#1d4ed8',
    minHeight: 42,
  },
  bodyQuickButtonContent: {
    height: 42,
    paddingHorizontal: 12,
  },
  secondaryActionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  primaryActionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
});
