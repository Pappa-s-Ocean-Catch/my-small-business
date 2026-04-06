import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, useWindowDimensions, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button as PaperButton, IconButton, Surface, Card, Divider, Snackbar } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { captureRef } from 'react-native-view-shot';
import { ReceiptTemplate } from './ReceiptTemplate';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_COLORS, STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../utils/constants';
import { paymentSummary, getNextQuickAction } from '../utils/orderUtils';

interface OrderDetailModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onPrint: (order: Order) => Promise<boolean>;
  onPrintImage?: (order: Order, imageUri: string) => Promise<boolean>;
  onCustomerPress: (order: Order) => void;
  onStatusUpdate?: (order: Order, status: OrderStatus) => void;
  onPaymentStatusUpdate?: (id: string, status: PaymentStatus) => void;
  onQuickAction?: (order: Order, action: string) => void;
  updatingStatus?: string | null;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  visible,
  order,
  onClose,
  onPrint,
  onPrintImage,
  onCustomerPress,
  onStatusUpdate,
  onPaymentStatusUpdate,
  onQuickAction,
  updatingStatus,
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [toastVisible, setToastVisible] = React.useState(false);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const receiptRef = React.useRef(null);

  if (!order) return null;

  const statusColor = STATUS_COLORS[order.order_status];
  const statusLabel = STATUS_LABELS[order.order_status];
  const paymentColor = PAYMENT_STATUS_COLORS[order.payment_status];
  const paymentLabel = PAYMENT_STATUS_LABELS[order.payment_status];
  const quickAction = getNextQuickAction(order.order_status);
  const isUpdating = updatingStatus === order.id;

  const handleInternalPrint = async () => {
    let success = false;
    
    // If onPrintImage is provided, capture the template first
    if (onPrintImage && receiptRef.current) {
      try {
        setIsCapturing(true);
        // Small delay to ensure the hidden view is rendered
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const uri = await captureRef(receiptRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: 576,
        });
        
        success = await onPrintImage(order, uri);
      } catch (error) {
        console.error('Failed to capture receipt:', error);
        // Fallback to standard print if capture fails
        success = await onPrint(order);
      } finally {
        setIsCapturing(false);
      }
    } else {
      success = await onPrint(order);
    }

    if (success) {
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
        style={styles.primaryActionButton}
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
      <View style={styles.container}>
        {/* Header */}
        <Surface 
          style={[
            styles.header, 
            { paddingTop: Math.max(insets.top, 8) }
          ]} 
          elevation={1}
        >
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Order {getFriendlyOrderNumber(order.order_number)}</Text>
            </View>
            <PaperButton 
              mode="contained" 
              icon="printer" 
              onPress={handleInternalPrint}
              loading={isCapturing}
              disabled={isCapturing}
              style={styles.headerPrintButton}
              labelStyle={styles.headerPrintButtonLabel}
            >
              Print
            </PaperButton>
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

        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
          {/* Customer Info Card */}
          <Card style={styles.infoCard}>
            <Card.Title title="Customer" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="account" />} />
            <Card.Content>
              <TouchableOpacity 
                onPress={() => onCustomerPress(order)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.customerName}>{order.customer_name || 'N/A'}</Text>
              </TouchableOpacity>
              <Text style={styles.contactText}>{order.customer_email}</Text>
              <Text style={styles.contactText}>{order.customer_phone}</Text>
              <Text style={styles.paymentSummary}>{paymentSummary(order)}</Text>
            </Card.Content>
          </Card>

          {/* Items Card */}
          <Card style={styles.infoCard}>
            <Card.Title title="Items" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="list-box" />} />
            <Card.Content>
              {order.items?.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.quantity}x {item.product_name}</Text>
                    <Text style={styles.itemPrice}>${item.subtotal.toFixed(2)}</Text>
                  </View>
                  {item.comment && <Text style={styles.itemComment}>Note: {item.comment}</Text>}
                  {item.addons && item.addons.length > 0 && (
                    <View style={styles.addonsList}>
                      {item.addons.map((addon, aIdx) => (
                        <Text key={aIdx} style={styles.addonText}>+ {addon.addon_item_name} {addon.addon_item_price > 0 ? `($${addon.addon_item_price.toFixed(2)})` : ''}</Text>
                      ))}
                    </View>
                  )}
                  {index < (order.items?.length || 0) - 1 && <Divider style={styles.divider} />}
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Special Instructions */}
          {order.special_instructions && (
            <Card style={[styles.infoCard, styles.instructionsCard]}>
              <Card.Title title="Instructions" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="note-text" />} />
              <Card.Content>
                <Text style={styles.instructionsText}>{order.special_instructions}</Text>
              </Card.Content>
            </Card>
          )}

          {/* Totals Card */}
          <Card style={styles.infoCard}>
            <Card.Content>
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
        </ScrollView>

        {/* Action Bar */}
        <Surface 
          style={[
            styles.actionBar, 
            { paddingBottom: Math.max(insets.bottom, 16) }
          ]} 
          elevation={4}
        >
          <View style={styles.secondaryActions}>
            {showCancelAction && (
              <IconButton 
                icon="cancel" 
                mode="outlined" 
                iconColor="#ef4444" 
                onPress={() => {
                  Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes, Cancel', onPress: () => onStatusUpdate!(order, 'cancelled'), style: 'destructive' }
                  ]);
                }} 
                style={styles.secondaryButton} 
              />
            )}
            {showPaymentAction && (
              <PaperButton 
                mode="outlined" 
                onPress={() => {
                  Alert.alert('Mark as Paid', 'Confirm payment received?', [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes, Paid', onPress: () => onPaymentStatusUpdate!(order.id, 'paid') }
                  ]);
                }}
                style={styles.paymentButton}
              >
                Paid
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
              <ReceiptTemplate order={order} />
           </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  headerSub: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: -4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  timeText: { fontSize: 12, color: '#6b7280', marginLeft: 'auto' },
  scheduledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 6,
  },
  scheduledText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f97316',
  },
  scrollContent: { flex: 1 },
  scrollContainer: { padding: 16, paddingBottom: 120 },
  infoCard: { marginBottom: 16, backgroundColor: '#fff', borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  customerName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  contactText: { fontSize: 14, color: '#4b5563', marginBottom: 2 },
  paymentSummary: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 8 },
  itemRow: { marginVertical: 8 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  itemComment: { fontSize: 14, color: '#d97706', fontStyle: 'italic', marginTop: 4 },
  addonsList: { marginTop: 4, paddingLeft: 12 },
  addonText: { fontSize: 13, color: '#6b7280' },
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
    paddingHorizontal: 16, 
    paddingTop: 16,
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secondaryButton: { margin: 0, borderWidth: 1, borderColor: '#e5e7eb' },
  paymentButton: { borderRadius: 8, height: 40 },
  primaryActionButton: { flex: 1, borderRadius: 8 },
  primaryActionButtonContent: { height: 48 },
  headerPrintButton: {
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  headerPrintButtonLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  snackbar: {
    marginBottom: 80, // Position above the action bar
  },
  hiddenReceiptContainer: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
});
