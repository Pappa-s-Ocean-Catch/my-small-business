import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { ActivityIndicator, Button, Card, Dialog, Portal, Text, Snackbar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getOrder, updateOrderStatus, updatePaymentStatus } from '../lib/orders';
import type { Order, OrderStatus } from '@my-small-business/types';
import * as Print from 'expo-print';
import { loadAppSettings } from '../lib/settings';
import { epsonPrintKitchenReceipt } from '../lib/epson-epos';
import { getOrderChannelLabel, getOrderLineItemCount, getOrderNotes, getOrderOptions } from '../utils/orderUtils';
import { formatSmartpayError, isSmartpayPaired, processSmartpayCardPayment } from '../lib/smartpay';

const CLOSED_ORDER_STATUSES: OrderStatus[] = ['completed', 'cancelled'];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#8b5cf6',
  ready: '#10b981',
  completed: '#6b7280',
  cancelled: '#ef4444',
  pending_online_payment: '#333333'
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending_online_payment: 'NA'
};

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [smartpayProcessing, setSmartpayProcessing] = useState(false);
  const [smartpayPaired, setSmartpayPaired] = useState(false);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isNarrow = width < 420;
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    loadOrder();
    isSmartpayPaired().then(setSmartpayPaired).catch(() => setSmartpayPaired(false));
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    const intervalId = setInterval(() => {
      void loadOrder({ silent: true });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [orderId]);

  const loadOrder = async (options?: { silent?: boolean }) => {
    if (!orderId) return;

    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const result = await getOrder(orderId);
      if (result.error) {
        if (!options?.silent) {
          Alert.alert('Error', result.error);
          router.back();
        } else {
          console.warn('Silent order refresh failed:', result.error);
        }
      } else {
        setOrder(result.data);
      }
    } catch (error) {
      if (!options?.silent) {
        Alert.alert('Error', 'Failed to load order');
      }
      console.error('Error loading order:', error);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;

    setUpdating(true);
    try {
      if (newStatus === 'completed' && order.payment_status === 'pending') {
        Alert.alert('Complete Order', 'Select payment method', [
          {
            text: 'Card',
            onPress: async () => {
              const result = await updateOrderStatus(order.id, 'completed', 'paid', 'Card');
              handleStatusResult(result);
            },
          },
          {
            text: 'Cash',
            onPress: async () => {
              const result = await updateOrderStatus(order.id, 'completed', 'paid', 'Cash');
              handleStatusResult(result);
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => setUpdating(false) },
        ]);
        return;
      }

      const result = await updateOrderStatus(order.id, newStatus);
      handleStatusResult(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
      console.error('Error updating status:', error);
      setUpdating(false);
    }
  };

  const handleStatusResult = (result: { data: Order | null; error: string | null }) => {
    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      setOrder(result.data);
      Alert.alert('Success', 'Order status updated');
    }
    setUpdating(false);
  };

  const handleSmartpayPayment = async () => {
    if (!order || order.payment_status === 'paid' || CLOSED_ORDER_STATUSES.includes(order.order_status)) return;
    if (!smartpayPaired) {
      Alert.alert('SmartPay not paired', 'Pair this POS register with Smartpay before taking SmartPay payments.');
      return;
    }

    try {
      const latestResult = await getOrder(order.id);
      if (latestResult.error) {
        Alert.alert('Order refresh failed', latestResult.error);
        return;
      }

      const latestOrder = latestResult.data;
      if (!latestOrder) {
        Alert.alert('Order refresh failed', 'Order not found.');
        return;
      }

      setOrder(latestOrder);

      if (latestOrder.payment_status === 'paid') {
        Alert.alert('Already paid', 'This order was already paid on another POS.');
        return;
      }

      if (CLOSED_ORDER_STATUSES.includes(latestOrder.order_status)) {
        Alert.alert('Order already closed', `This order is already ${latestOrder.order_status}.`);
        return;
      }

      setSmartpayProcessing(true);
      await processSmartpayCardPayment(latestOrder.total);
      const result = await updatePaymentStatus(latestOrder.id, 'paid', 'SmartPay');
      if (result.error) {
        Alert.alert('Payment update failed', result.error);
        return;
      }
      setOrder(result.data);
      Alert.alert('Payment complete', 'SmartPay payment accepted.');
    } catch (error) {
      console.error('SmartPay order detail payment failed', error);
      Alert.alert('SmartPay payment failed', formatSmartpayError(error));
    } finally {
      setSmartpayProcessing(false);
    }
  };

  const confirmDismissSmartpayLock = () => {
    if (!smartpayProcessing) return;

    Alert.alert(
      'Hide SmartPay screen?',
      'The payment may still be running on the terminal. Hide this screen only if you need to return to the order.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Hide', style: 'destructive', onPress: () => setSmartpayProcessing(false) },
      ]
    );
  };

  const handlePrint = async () => {
    if (!order) return;

    try {
      const s = await loadAppSettings();
      if (s.printerEnabled && s.printerUrl.trim()) {
        try {
          await epsonPrintKitchenReceipt(order, {
            printerUrl: s.printerUrl,
            printerCopies: s.printerCopies,
            printerDeviceId: s.printerDeviceId,
            printerTimeoutMs: s.printerTimeoutMs,
          }, 'order-detail-screen:manual-epson-print');
          setToastVisible(true);
          return;
        } catch (epsonError) {
          Alert.alert(
            'Printer error',
            epsonError instanceof Error ? epsonError.message : 'Failed to print to Epson printer',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'System Print',
                onPress: async () => {
                  const html = generatePrintHTML(order);
                  await Print.printAsync({ html });
                },
              },
            ]
          );
          return;
        }
      }

      const html = generatePrintHTML(order);
      await Print.printAsync({ html });
      setToastVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to print order');
      console.error('Print error:', error);
    }
  };

  const generatePrintHTML = (order: Order): string => {
    const rewardPointsUsed = order.reward_points_used ?? 0;
    const rewardPointsValue = order.reward_points_value ?? 0;
    const lineItemCount = getOrderLineItemCount(order);
    const orderNotes = getOrderNotes(order);
    const orderOptionsHTML = getOrderOptions(order)
      .map((option) => `<tr class="order-option-row"><td colspan="2"><strong>ORDER OPTION:</strong> ${option}</td></tr>`)
      .join('');
    const itemsHTML = order.items?.map(item => {
      const addonsHTML = item.addons?.map(addon =>
        `<li>+ ${addon.addon_item_name} (${addon.addon_group_name}) - $${addon.addon_item_price.toFixed(2)}</li>`
      ).join('') || '';

      return `
        <tr>
          <td>${item.quantity}x ${item.product_name}</td>
          <td>$${item.subtotal.toFixed(2)}</td>
        </tr>
        ${item.comment ? `<tr><td colspan="2"><em>Note: ${item.comment}</em></td></tr>` : ''}
        ${addonsHTML ? `<tr><td colspan="2"><ul style="margin: 0; padding-left: 20px;">${addonsHTML}</ul></td></tr>` : ''}
      `;
    }).join('') || '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order #${order.order_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { margin: 0 0 10px 0; }
            .info { margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .order-option-row td { font-size: 20px; font-weight: 900; }
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Order #${order.order_number}</h1>
          <div class="info">
            <p><strong>Customer:</strong> ${order.customer_name || order.customer_email}</p>
            <p><strong>Phone:</strong> ${order.customer_phone}</p>
            <p><strong>Type:</strong> ${getOrderChannelLabel(order)}</p>
            <p><strong>Status:</strong> ${STATUS_LABELS[order.order_status]}</p>
            <p><strong>Time:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            ${order.order_type === 'delivery' && order.delivery_address_line1 ? `
              <p><strong>Delivery Address:</strong><br>
              ${order.delivery_address_line1}<br>
              ${order.delivery_address_line2 ? order.delivery_address_line2 + '<br>' : ''}
              ${order.delivery_city}, ${order.delivery_state} ${order.delivery_postcode}
              </p>
            ` : ''}
            ${orderNotes ? `<p><strong>Special Instructions:</strong> ${orderNotes}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              ${orderOptionsHTML}
              ${itemsHTML}
            </tbody>
          </table>
          <div class="total">
            <p>Total items: ${lineItemCount}</p>
            <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
            ${order.tax > 0 ? `<p>Tax: $${order.tax.toFixed(2)}</p>` : ''}
            ${order.delivery_fee > 0 ? `<p>Delivery Fee: $${order.delivery_fee.toFixed(2)}</p>` : ''}
            ${order.promotion_discount > 0 ? `<p style="color: #16a34a;">Promotion Discount: -$${order.promotion_discount.toFixed(2)}</p>` : ''}
            ${order.coupon_discount > 0 ? `<p style="color: #16a34a;">Coupon (${order.coupon_code}): -$${order.coupon_discount.toFixed(2)}</p>` : ''}
            ${rewardPointsUsed > 0 && rewardPointsValue > 0 ? `<p style="color: #16a34a;">Points Applied (${rewardPointsUsed.toLocaleString()} pts): -$${rewardPointsValue.toFixed(2)}</p>` : ''}
            ${order.service_fee > 0 ? `<p>Service Fee: $${order.service_fee.toFixed(2)}</p>` : ''}
            <p>Total: $${order.total.toFixed(2)}</p>
          </div>
        </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Order not found</Text>
        <Button mode="contained" onPress={() => router.back()} style={styles.paperButton}>
          Go Back
        </Button>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[order.order_status];
  const statusLabel = STATUS_LABELS[order.order_status];
  const rewardPointsUsed = order.reward_points_used ?? 0;
  const rewardPointsValue = order.reward_points_value ?? 0;
  const lineItemCount = getOrderLineItemCount(order);

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, isPortrait && styles.headerPortrait, isNarrow && styles.headerNarrow]}>
        <View style={styles.headerMain}>
          <Text style={styles.orderNumber}>Order #{order.order_number}</Text>
          <Text style={styles.customerName}>
            {order.customer_name || order.customer_email}
          </Text>
          <Text style={styles.customerPhone} numberOfLines={2}>
            {order.customer_phone}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, isPortrait && styles.statusBadgePortrait, { backgroundColor: statusColor, marginBottom: 8 }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {order.payment_status !== 'paid' && order.order_status !== 'completed' && order.order_status !== 'cancelled' && (
              <Button 
                mode="contained" 
                icon="pencil" 
                onPress={() => router.push({ pathname: '/pos', params: { orderId: order.id } })}
                style={styles.headerEditButton}
                buttonColor="#2563eb"
              >
                Edit
              </Button>
            )}
            <Button 
              mode="contained" 
              icon="printer" 
              onPress={handlePrint}
              style={styles.headerPrintButton}
            >
              Print
            </Button>
          </View>
        </View>
      </View>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type:</Text>
            <Text style={styles.infoValue}>
              {order.order_type === 'delivery' ? '🚚' : '🏪'} {getOrderChannelLabel(order)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment:</Text>
            <Text style={styles.infoValue}>
              {order.payment_method === 'online' ? 'Online' : 'Store'} - {order.payment_status}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time:</Text>
            <Text style={styles.infoValue}>
              {new Date(order.created_at).toLocaleString()}
            </Text>
          </View>
          {order.order_type === 'delivery' && order.delivery_address_line1 && (
            <View style={styles.deliveryAddress}>
              <Text style={styles.infoLabel}>Delivery Address:</Text>
              <Text style={styles.infoValue}>
                {order.delivery_address_line1}
                {order.delivery_address_line2 && `\n${order.delivery_address_line2}`}
                {`\n${order.delivery_city}, ${order.delivery_state} ${order.delivery_postcode}`}
              </Text>
            </View>
          )}
          {getOrderNotes(order) && (
            <View style={styles.specialInstructions}>
              <Text style={styles.infoLabel}>Special Instructions:</Text>
              <Text style={styles.infoValue}>{getOrderNotes(order)}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Items</Text>
          {getOrderOptions(order).map((option, index) => (
            <View key={`option-${index}`} style={styles.orderOptionRow}>
              <Text style={styles.orderOptionText}>* {option}</Text>
            </View>
          ))}
          {order.items?.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>
                  {item.quantity}x {item.product_name}
                </Text>
                <Text style={styles.itemPrice}>${item.subtotal.toFixed(2)}</Text>
              </View>
              {item.comment && (
                <Text style={styles.itemComment}>Note: {item.comment}</Text>
              )}
              {item.addons && item.addons.length > 0 && (
                <View style={styles.addonsContainer}>
                  {item.addons.map((addon) => (
                    <Text key={addon.id} style={styles.addonText}>
                      + {addon.addon_item_name} ({addon.addon_group_name}) - ${addon.addon_item_price.toFixed(2)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Total</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total items:</Text>
            <Text style={styles.totalValue}>{lineItemCount}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>${order.subtotal.toFixed(2)}</Text>
          </View>
          {order.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalValue}>${order.tax.toFixed(2)}</Text>
            </View>
          )}
          {order.delivery_fee > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery Fee:</Text>
              <Text style={styles.totalValue}>${order.delivery_fee.toFixed(2)}</Text>
            </View>
          )}
          {order.promotion_discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.discountLabel]}>Promotion Discount:</Text>
              <Text style={[styles.totalValue, styles.discountValue]}>-${order.promotion_discount.toFixed(2)}</Text>
            </View>
          )}
          {order.coupon_discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.discountLabel]}>Coupon ({order.coupon_code}):</Text>
              <Text style={[styles.totalValue, styles.discountValue]}>-${order.coupon_discount.toFixed(2)}</Text>
            </View>
          )}
          {rewardPointsUsed > 0 && rewardPointsValue > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.discountLabel]}>
                Points Applied ({rewardPointsUsed.toLocaleString()} pts):
              </Text>
              <Text style={[styles.totalValue, styles.discountValue]}>-${rewardPointsValue.toFixed(2)}</Text>
            </View>
          )}
          {order.service_fee > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Service Fee:</Text>
              <Text style={styles.totalValue}>${order.service_fee.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.finalTotal]}>
            <Text style={styles.finalTotalLabel}>Total:</Text>
            <Text style={styles.finalTotalValue}>${order.total.toFixed(2)}</Text>
          </View>

        </Card.Content>
      </Card>

      <View style={styles.actions}>

        {order.order_status === 'pending' && (
          <Button
            mode="contained"
            onPress={() => handleStatusChange('confirmed')}
            disabled={updating}
            loading={updating}
            style={styles.paperButton}
          >
            Confirm Order
          </Button>
        )}
        {order.order_status === 'confirmed' && (
          <Button
            mode="contained"
            onPress={() => handleStatusChange('preparing')}
            disabled={updating}
            loading={updating}
            style={styles.paperButton}
          >
            Start Preparing
          </Button>
        )}
        {order.order_status === 'preparing' && (
          <Button
            mode="contained"
            onPress={() => handleStatusChange('ready')}
            disabled={updating}
            loading={updating}
            style={styles.paperButton}
          >
            Mark Ready
          </Button>
        )}
        {order.order_status === 'ready' && (
          <Button
            mode="contained"
            onPress={() => handleStatusChange('completed')}
            disabled={updating}
            loading={updating}
            style={styles.paperButton}
          >
            Complete Order
          </Button>
        )}
        {order.payment_status !== 'paid' && order.order_status !== 'cancelled' && (
          <Button
            mode="contained"
            icon="credit-card-wireless-outline"
            buttonColor="#2563eb"
            onPress={() => void handleSmartpayPayment()}
            disabled={!smartpayPaired || updating || smartpayProcessing}
            loading={smartpayProcessing}
            style={styles.paperButton}
          >
            SmartPay
          </Button>
        )}
        {order.order_status !== 'cancelled' && order.order_status !== 'completed' && (
          <Button
            mode="contained"
            buttonColor="#ef4444"
            onPress={() => {
              Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', style: 'destructive', onPress: () => handleStatusChange('cancelled') },
              ]);
            }}
            disabled={updating}
            loading={updating}
            style={styles.paperButton}
          >
            Cancel Order
          </Button>
        )}
      </View>

      <Portal>
        <Dialog
          visible={smartpayProcessing}
          dismissable
          onDismiss={confirmDismissSmartpayLock}
          style={styles.smartpayDialog}
        >
          <Dialog.Title>SmartPay payment</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.smartpayDialogText}>
              Follow the prompts on the terminal. This order will be marked paid after Smartpay accepts the payment.
            </Text>
            <Text style={styles.smartpayAmount}>${order.total.toFixed(2)}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={confirmDismissSmartpayLock}>Hide</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 20,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerMain: {
    flex: 1,
    paddingRight: 12,
  },
  headerPortrait: {
    flexDirection: 'column',
    gap: 12,
  },
  headerNarrow: {
    padding: 14,
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    color: '#333',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  customerPhone: {
    fontSize: 16,
    color: '#666',
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgePortrait: {
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionCard: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
    flexWrap: 'wrap',
    textAlign: 'right',
  },
  deliveryAddress: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  specialInstructions: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  itemCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 12,
  },
  orderOptionRow: {
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 12,
  },
  orderOptionText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  itemComment: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  addonsContainer: {
    marginTop: 8,
    paddingLeft: 16,
  },
  addonText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  discountLabel: {
    color: '#10b981',
  },
  discountValue: {
    color: '#10b981',
  },
  finalTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e5e5e5',
  },
  finalTotalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  finalTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  paperButton: {
    alignSelf: 'stretch',
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerPrintButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  headerEditButton: {
    borderRadius: 8,
  },
  smartpayDialog: {
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  smartpayDialogText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  smartpayAmount: {
    marginTop: 12,
    color: '#111827',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  snackbar: {
    marginBottom: 20,
  },
});
