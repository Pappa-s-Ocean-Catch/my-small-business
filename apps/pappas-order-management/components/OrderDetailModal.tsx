import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, useWindowDimensions, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button as PaperButton, IconButton, Surface, Card, Divider, Snackbar } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { captureRef } from 'react-native-view-shot';
import { ReceiptTemplate } from './ReceiptTemplate';
import { PrintSimulatorModal } from './PrintSimulatorModal';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_COLORS, STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../utils/constants';
import { paymentSummary, getNextQuickAction, groupAddons, getOrderLineItemCount, getOrderNotes, getOrderOptions } from '../utils/orderUtils';
import type { AppSettings } from '../lib/settings';
import { DEFAULT_APP_SETTINGS } from '../lib/settings';
import { useRouter } from 'expo-router';
import { getOrder } from '../lib/orders';

interface OrderDetailModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onOrderRefresh?: (order: Order) => void;
  onPrint: (order: Order) => Promise<boolean>;
  onPrintImage?: (order: Order, imageUri: string) => Promise<boolean>;
  onCustomerPress: (order: Order) => void;
  onStatusUpdate?: (order: Order, status: OrderStatus) => void;
  onPaymentStatusUpdate?: (id: string, status: PaymentStatus, paymentMethodDetail?: string | null) => void;
  onSmartpayPayment?: (order: Order) => void;
  onQuickAction?: (order: Order, action: string) => void;
  updatingStatus?: string | null;
  smartpayPaired?: boolean;
  smartpayProcessing?: boolean;
  // Simulator props to ensure it can be rendered on top of this modal
  showSimulator?: boolean;
  setShowSimulator?: (visible: boolean) => void;
  simulatorOrder?: Order | null;
  printImageUri?: string | null;
  appSettings?: AppSettings;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  visible,
  order,
  onClose,
  onOrderRefresh,
  onPrint,
  onPrintImage,
  onCustomerPress,
  onStatusUpdate,
  onPaymentStatusUpdate,
  onSmartpayPayment,
  onQuickAction,
  updatingStatus,
  smartpayPaired = false,
  smartpayProcessing = false,
  showSimulator,
  setShowSimulator,
  simulatorOrder,
  printImageUri,
  appSettings = DEFAULT_APP_SETTINGS,
}) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 820;
  const [toastVisible, setToastVisible] = React.useState(false);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [printPreviewOrder, setPrintPreviewOrder] = React.useState<Order | null>(null);
  const receiptRef = React.useRef(null);

  React.useEffect(() => {
    setPrintPreviewOrder(order);
  }, [order]);

  React.useEffect(() => {
    if (!visible || !order) return;

    let mounted = true;
    const refreshOrder = async () => {
      const latestOrderResult = await getOrder(order.id);
      if (!mounted || !latestOrderResult.data) return;
      onOrderRefresh?.(latestOrderResult.data);
    };

    void refreshOrder();
    const intervalId = setInterval(() => {
      void refreshOrder();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [visible, order?.id, onOrderRefresh]);

  if (!order) return null;

  const statusColor = STATUS_COLORS[order.order_status];
  const statusLabel = STATUS_LABELS[order.order_status];
  const paymentColor = PAYMENT_STATUS_COLORS[order.payment_status];
  const paymentLabel = PAYMENT_STATUS_LABELS[order.payment_status];
  const quickAction = getNextQuickAction(order);
  const isUpdating = updatingStatus === order.id;
  const rewardPointsUsed = order.reward_points_used ?? 0;
  const rewardPointsValue = order.reward_points_value ?? 0;
  const lineItemCount = getOrderLineItemCount(order);
  const orderOptions = getOrderOptions(order);
  const orderNotes = getOrderNotes(order);
  const canSmartpay =
    smartpayPaired &&
    !!onSmartpayPayment &&
    order.payment_status !== 'paid' &&
    order.order_status !== 'completed' &&
    order.order_status !== 'cancelled';

  const handleInternalPrint = async () => {
    let success = false;
    let printOrder = order;

    const latestOrderResult = await getOrder(order.id);
    if (latestOrderResult.data) {
      printOrder = latestOrderResult.data;
      setPrintPreviewOrder(latestOrderResult.data);
    } else if (latestOrderResult.error) {
      console.warn('[OrderDetailModal] Failed to refresh order before printing:', latestOrderResult.error);
    }
    
    // If onPrintImage is provided, capture the template first
    if (onPrintImage && receiptRef.current) {
      try {
        setIsCapturing(true);
        // Small delay to ensure the hidden view is rendered
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const targetDots = appSettings.printerPaperWidth === '58mm' ? 384 : 576;
        const scale = appSettings.printerHighQuality ? 2 : 1;
        
        const uri = await captureRef(receiptRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: targetDots * scale,
        });
        
        success = await onPrintImage(printOrder, uri);
      } catch (error) {
        console.error('Failed to capture receipt:', error);
        // Fallback to standard print if capture fails
        success = await onPrint(printOrder);
      } finally {
        setIsCapturing(false);
      }
    } else {
      success = await onPrint(printOrder);
    }

    // Only show "Printing successful" toast if we are NOT in simulator mode
    // (In simulator mode, the modal will show up instead)
    if (success && !showSimulator && setShowSimulator) {
      setToastVisible(true);
    }
  };


  const renderActionButton = () => {
    if (!onQuickAction || !quickAction) return null;
    return (
      <PaperButton
        mode="contained"
        onPress={() => onQuickAction(order, quickAction.action)}
        loading={isUpdating}
        disabled={isUpdating}
        style={[styles.primaryActionButton, !isWide && styles.primaryActionButtonCompact]}
        contentStyle={styles.primaryActionButtonContent}
      >
        {quickAction.label}
      </PaperButton>
    );
  };

  const showPaymentAction = onPaymentStatusUpdate && order.payment_status === 'pending';
  const showCancelAction = onStatusUpdate && order.order_status !== 'completed' && order.order_status !== 'cancelled';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, isWide && styles.containerWide]}>
        <View style={[styles.modalShell, isWide && styles.modalShellWide]}>
        {/* Header */}
        <Surface 
          style={[
            styles.header, 
            { paddingTop: isWide ? 14 : Math.max(insets.top, 8) }
          ]} 
          elevation={1}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle}>Order {getFriendlyOrderNumber(order.order_number)}</Text>
              <Text style={styles.headerMeta}>{paymentSummary(order)}</Text>
            </View>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>
          <View style={styles.headerSub}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: paymentColor, marginLeft: 8 }]}>
              <Text style={styles.statusBadgeText}>{paymentLabel}</Text>
            </View>
            <Text style={styles.timeText}>{new Date(order.created_at).toLocaleString()}</Text>
          </View>
          {order.scheduled_pickup_at && (
            <View style={styles.scheduledInfo}>
              <MaterialCommunityIcons name="calendar-clock" size={16} color="#f97316" />
              <Text style={styles.scheduledText}>
                Scheduled Pickup: {new Date(order.scheduled_pickup_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </View>
          )}
        </Surface>

        <ScrollView style={styles.scrollContent} contentContainerStyle={[styles.scrollContainer, isWide && styles.scrollContainerWide]}>
          <View style={styles.contentStack}>
            <View style={[styles.summaryGrid, isWide && styles.summaryGridWide]}>
              <Card style={[styles.infoCard, isWide && styles.summaryCard]}>
                <Card.Title title="Customer" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="account" />} />
                <Card.Content>
                  <TouchableOpacity
                    onPress={() => onCustomerPress(order)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.customerName}>{order.customer_name || 'N/A'}</Text>
                  </TouchableOpacity>
                  {!!order.customer_email && <Text style={styles.contactText}>{order.customer_email}</Text>}
                  {!!order.customer_phone && <Text style={styles.contactText}>{order.customer_phone}</Text>}
                </Card.Content>
              </Card>

              <Card style={[styles.infoCard, isWide && styles.summaryCard]}>
                <Card.Title title="Totals" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="receipt" />} />
                <Card.Content>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total items</Text>
                    <Text style={styles.totalValue}>{lineItemCount}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>${order.subtotal.toFixed(2)}</Text>
                  </View>
                  {order.tax > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax</Text>
                  <Text style={styles.totalValue}>${order.tax.toFixed(2)}</Text>
                </View>
              )}
              {order.delivery_fee > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Delivery Fee</Text>
                  <Text style={styles.totalValue}>${order.delivery_fee.toFixed(2)}</Text>
                </View>
              )}
              {order.promotion_discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#10b981' }]}>Promotion Discount</Text>
                  <Text style={[styles.totalValue, { color: '#10b981' }]}>-${order.promotion_discount.toFixed(2)}</Text>
                </View>
              )}
              {order.coupon_discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#10b981' }]}>Coupon ({order.coupon_code})</Text>
                  <Text style={[styles.totalValue, { color: '#10b981' }]}>-${order.coupon_discount.toFixed(2)}</Text>
                </View>
              )}
              {rewardPointsUsed > 0 && rewardPointsValue > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#10b981' }]}>
                    Points Applied ({rewardPointsUsed.toLocaleString()} pts)
                  </Text>
                  <Text style={[styles.totalValue, { color: '#10b981' }]}>-${rewardPointsValue.toFixed(2)}</Text>
                </View>
              )}
              {order.service_fee > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Service Fee</Text>
                  <Text style={styles.totalValue}>${order.service_fee.toFixed(2)}</Text>
                </View>
              )}
              <Divider style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.finalTotalLabel}>Grand Total</Text>
                <Text style={styles.finalTotalValue}>${order.total.toFixed(2)}</Text>
              </View>
                </Card.Content>
              </Card>
            </View>

            <Card style={styles.infoCard}>
              <Card.Title
                title={`Items (${lineItemCount})`}
                titleStyle={styles.cardTitle}
                left={(props) => <IconButton {...props} icon="list-box" />}
              />
              <Card.Content>
                {orderOptions.map((option, index) => (
                  <View key={`order-option-${index}`} style={styles.optionRow}>
                    <MaterialCommunityIcons name="asterisk" size={16} color="#2563eb" />
                    <Text style={styles.optionText}>{option}</Text>
                  </View>
                ))}
                {order.items?.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.quantity}x {item.product_name}</Text>
                      <Text style={styles.itemPrice}>${item.subtotal.toFixed(2)}</Text>
                    </View>
                    {item.comment && <Text style={styles.itemComment}>Note: {item.comment}</Text>}
                    {((item.removed_ingredients && item.removed_ingredients.length > 0) || (item.addons && item.addons.length > 0)) && (
                      <View style={styles.addonsList}>
                        {item.removed_ingredients?.map((ing, rIdx) => (
                          <Text key={`rm-${rIdx}`} style={styles.removedText}>
                            No {ing}
                          </Text>
                        ))}
                        {item.addons && item.addons.length > 0 &&
                          groupAddons(item.addons).map((addon, aIdx) => (
                            <Text key={`ad-${aIdx}`} style={styles.addonText}>
                              {addon.quantity > 1 ? `${addon.quantity}x ` : '+ '}{addon.name} {addon.price > 0 ? `($${addon.price.toFixed(2)})` : ''}
                            </Text>
                          ))
                        }
                      </View>
                    )}
                    {index < (order.items?.length || 0) - 1 && <Divider style={styles.divider} />}
                  </View>
                ))}
              </Card.Content>
            </Card>

            {orderNotes && (
              <Card style={[styles.infoCard, styles.instructionsCard]}>
                <Card.Title title="Instructions" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="note-text" />} />
                <Card.Content>
                  <Text style={styles.instructionsText}>{orderNotes}</Text>
                </Card.Content>
              </Card>
            )}
          </View>
        </ScrollView>

        {/* Action Bar */}
        <Surface 
          style={[
            styles.actionBar, 
            { paddingBottom: isWide ? 16 : Math.max(insets.bottom, 16) }
          ]} 
          elevation={4}
        >
          <View style={styles.secondaryActions}>
            <PaperButton
              mode="outlined"
              icon="printer"
              onPress={handleInternalPrint}
              loading={isCapturing}
              disabled={isCapturing}
              style={styles.actionButton}
              compact={!isWide}
            >
              Print
            </PaperButton>
            {showCancelAction && (
              <PaperButton
                mode="outlined" 
                icon="cancel"
                textColor="#ef4444"
                onPress={() => {
                  Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes, Cancel', onPress: () => onStatusUpdate!(order, 'cancelled'), style: 'destructive' }
                  ]);
                }} 
                style={styles.actionButton}
                compact={!isWide}
              >
                Cancel
              </PaperButton>
            )}
            {order.payment_status !== 'paid' && order.order_status !== 'completed' && order.order_status !== 'cancelled' && (
              <PaperButton
                mode="outlined"
                icon="pencil"
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/pos', params: { orderId: order.id } });
                }} 
                style={styles.actionButton}
                compact={!isWide}
              >
                Edit
              </PaperButton>
            )}
            {showPaymentAction && (
              <PaperButton
                mode="outlined"
                icon="cash"
                onPress={() => onPaymentStatusUpdate!(order.id, 'paid', 'Cash')}
                style={styles.actionButton}
                compact={!isWide}
              >
                Cash
              </PaperButton>
            )}
            {showPaymentAction && (
              <PaperButton
                mode="outlined"
                icon="credit-card-outline"
                onPress={() => onPaymentStatusUpdate!(order.id, 'paid', 'Card')}
                style={styles.actionButton}
                compact={!isWide}
              >
                Card
              </PaperButton>
            )}
            {canSmartpay && (
              <PaperButton
                mode="outlined"
                icon="credit-card-wireless-outline"
                onPress={() => onSmartpayPayment(order)}
                loading={smartpayProcessing}
                disabled={smartpayProcessing || isUpdating}
                style={styles.actionButton}
                compact={!isWide}
              >
                SmartPay
              </PaperButton>
            )}
          </View>
          {renderActionButton()}
        </Surface>

        <Snackbar
          visible={toastVisible}
          onDismiss={() => setToastVisible(false)}
          duration={3000}
          action={{
            label: 'OK',
            onPress: () => setToastVisible(false),
          }}
          style={styles.snackbar}
        >
          Printing successful
        </Snackbar>

        {/* Hidden Receipt Template for capture */}
        <View style={styles.hiddenReceiptContainer} pointerEvents="none">
           <View ref={receiptRef} collapsable={false}>
              <ReceiptTemplate 
                order={printPreviewOrder || order} 
                width={appSettings.printerPaperWidth === '58mm' ? 384 : 576} 
                printSource="order-detail-modal:capture"
                showTicketCounter={appSettings.printerSimulator}
              />
           </View>
        </View>

        {/* Simulator Modal - rendered inside to appear on top on iOS */}
        <PrintSimulatorModal
          visible={!!showSimulator}
          order={simulatorOrder || null}
          imageUri={printImageUri || null}
          onClose={() => setShowSimulator?.(false)}
        />
        {smartpayProcessing && (
          <View style={styles.smartpayOverlay} pointerEvents="auto">
            <View style={styles.smartpayPanel}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.smartpayTitle}>SmartPay payment</Text>
              <Text style={styles.smartpayText}>Waiting for terminal transaction to finish.</Text>
              <Text style={styles.smartpayAmount}>${order.total.toFixed(2)}</Text>
            </View>
          </View>
        )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  containerWide: { alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalShell: { flex: 1, backgroundColor: '#f3f4f6' },
  modalShellWide: {
    width: '96%',
    maxWidth: 1180,
    maxHeight: '96%',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  header: { paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 20, paddingRight: 8 },
  headerTitleBlock: { flex: 1, paddingRight: 12 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#111827' },
  headerMeta: { fontSize: 14, color: '#4b5563', fontWeight: '600', marginTop: 2 },
  headerSub: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 20, marginTop: 8, gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  timeText: { fontSize: 12, color: '#6b7280', marginLeft: 'auto', fontWeight: '600' },
  scheduledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 6,
  },
  scheduledText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f97316',
  },
  scrollContent: { flex: 1 },
  scrollContainer: { padding: 14, paddingBottom: 112 },
  scrollContainerWide: { padding: 18, paddingBottom: 96 },
  contentStack: { gap: 14 },
  summaryGrid: { gap: 14 },
  summaryGridWide: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  summaryCard: { flex: 1, alignSelf: 'stretch' },
  infoCard: { backgroundColor: '#fff', borderRadius: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  customerName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  contactText: { fontSize: 14, color: '#4b5563', marginBottom: 2 },
  itemRow: { paddingVertical: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  optionText: { fontSize: 16, fontWeight: '900', color: '#111827' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  itemComment: { fontSize: 14, color: '#d97706', fontStyle: 'italic', marginTop: 4 },
  addonsList: { marginTop: 4, paddingLeft: 12 },
  addonText: { fontSize: 13, color: '#6b7280' },
  removedText: { fontSize: 13, color: '#111827', fontWeight: 'bold' },
  divider: { marginTop: 12 },
  instructionsCard: { borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  instructionsText: { fontSize: 15, color: '#4b5563', lineHeight: 22 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  totalDivider: { marginVertical: 12 },
  finalTotalLabel: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  finalTotalValue: { fontSize: 22, fontWeight: 'bold', color: '#2563eb' },
  actionBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingHorizontal: 18, 
    paddingTop: 14,
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12 
  },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1 },
  actionButton: { borderRadius: 8, borderColor: '#d1d5db' },
  primaryActionButton: { minWidth: 180, borderRadius: 8 },
  primaryActionButtonCompact: { flexGrow: 1 },
  primaryActionButtonContent: { height: 48 },
  snackbar: {
    marginBottom: 80, // Position above the action bar
  },
  hiddenReceiptContainer: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  smartpayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 200,
  },
  smartpayPanel: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  smartpayTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  smartpayText: {
    marginTop: 8,
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  smartpayAmount: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
});
