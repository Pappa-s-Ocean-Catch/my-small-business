import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getOrder, updateOrderStatus } from '../lib/orders';
import type { Order, OrderStatus } from '@my-small-business/types';
import * as Print from 'expo-print';
import { loadAppSettings } from '../lib/settings';
import { epsonPrintKitchenReceipt } from '../lib/epson-epos';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#8b5cf6',
  ready: '#10b981',
  completed: '#6b7280',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isNarrow = width < 420;

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      const result = await getOrder(orderId);
      if (result.error) {
        Alert.alert('Error', result.error);
        router.back();
      } else {
        setOrder(result.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load order');
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;

    setUpdating(true);
    try {
      const result = await updateOrderStatus(order.id, newStatus);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setOrder(result.data);
        Alert.alert('Success', 'Order status updated');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
    }
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
          });
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
    } catch (error) {
      Alert.alert('Error', 'Failed to print order');
      console.error('Print error:', error);
    }
  };

  const generatePrintHTML = (order: Order): string => {
    const itemsHTML = order.items?.map(item => {
      const addonsHTML = item.addons?.map(addon =>
        `<li>+ ${addon.addon_item_name} (${addon.addon_group_name}) - $${addon.addon_item_price.toFixed(2)}</li>`
      ).join('') || '';
      const removedHTML =
        Array.isArray(item.removed_ingredients) && item.removed_ingredients.length > 0
          ? `<p><em>Removed: ${item.removed_ingredients.join(', ')}</em></p>`
          : '';

      return `
        <tr>
          <td>${item.quantity}x ${item.product_name}</td>
          <td>$${item.subtotal.toFixed(2)}</td>
        </tr>
        ${item.comment ? `<tr><td colspan="2"><em>Note: ${item.comment}</em></td></tr>` : ''}
        ${addonsHTML ? `<tr><td colspan="2"><ul style="margin: 0; padding-left: 20px;">${addonsHTML}</ul></td></tr>` : ''}
        ${removedHTML ? `<tr><td colspan="2">${removedHTML}</td></tr>` : ''}
      `;
    }).join('') || '';

    const pickupTimeHTML =
      order.order_type === 'pickup' && order.scheduled_pickup_at
        ? `<p><strong>Pickup time (pre-order):</strong> ${new Date(order.scheduled_pickup_at).toLocaleString()}</p>`
        : '';

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
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Order #${order.order_number}</h1>
          <div class="info">
            <p><strong>Customer:</strong> ${order.customer_name || order.customer_email}</p>
            <p><strong>Phone:</strong> ${order.customer_phone}</p>
            <p><strong>Type:</strong> ${order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</p>
            <p><strong>Status:</strong> ${STATUS_LABELS[order.order_status]}</p>
            <p><strong>Time:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            ${pickupTimeHTML}
            ${order.order_type === 'delivery' && order.delivery_address_line1 ? `
              <p><strong>Delivery Address:</strong><br>
              ${order.delivery_address_line1}<br>
              ${order.delivery_address_line2 ? order.delivery_address_line2 + '<br>' : ''}
              ${order.delivery_city}, ${order.delivery_state} ${order.delivery_postcode}
              </p>
            ` : ''}
            ${order.special_instructions ? `<p><strong>Special Instructions:</strong> ${order.special_instructions}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          <div class="total">
            <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
            ${order.tax > 0 ? `<p>Tax: $${order.tax.toFixed(2)}</p>` : ''}
            ${order.delivery_fee > 0 ? `<p>Delivery Fee: $${order.delivery_fee.toFixed(2)}</p>` : ''}
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
        <View style={[styles.statusBadge, isPortrait && styles.statusBadgePortrait, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type:</Text>
            <Text style={styles.infoValue}>
              {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
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
          {order.special_instructions && (
            <View style={styles.specialInstructions}>
              <Text style={styles.infoLabel}>Special Instructions:</Text>
              <Text style={styles.infoValue}>{order.special_instructions}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Items</Text>
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
              {Array.isArray(item.removed_ingredients) && item.removed_ingredients.length > 0 && (
                <Text style={styles.removedText}>
                  Removed: {item.removed_ingredients.join(', ')}
                </Text>
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
        <Button mode="outlined" onPress={handlePrint} style={styles.paperButton}>
          Print Order
        </Button>

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
  removedText: {
    fontSize: 14,
    color: '#b45309',
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
});
