import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  Button as PaperButton,
  Card,
  Chip,
  IconButton,
  Surface,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getAllOrders, updateOrderStatus, updatePaymentStatus, getOrder } from '../../lib/orders';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { playNewOrderSound } from '../../lib/sounds';
import { DEFAULT_APP_SETTINGS, loadAppSettings, subscribeAppSettings, type AppSettings } from '../../lib/settings';
import { Audio } from 'expo-av';
import * as Print from 'expo-print';
import { ConfirmationDialog } from '../../lib/ConfirmationDialog';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

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

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: '#f59e0b',
  paid: '#10b981',
  failed: '#ef4444',
  refunded: '#6b7280',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

// Get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function OrdersScreen() {
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isNarrow = width < 420;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState<{ orderId: string; status: OrderStatus } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(0);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const lastOrderIdRef = useRef<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const router = useRouter();

  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  useEffect(() => {
    // Keep settings in sync even while this tab isn't focused (Tabs keep screens mounted).
    const unsubscribe = subscribeAppSettings((s) => {
      setAppSettings(s);
      appSettingsRef.current = s;
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadAppSettings().then((s) => {
        if (cancelled) return;
        setAppSettings(s);
        appSettingsRef.current = s;
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Initialize audio
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const filters: { status?: string; payment_status?: string; date?: string } = {};
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      if (paymentFilter !== 'all') {
        filters.payment_status = paymentFilter;
      }
      if (selectedDate) {
        filters.date = selectedDate;
      }

      const result = await getAllOrders(filters);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        const newOrders = result.data || [];

        // Check for new orders
        if (newOrders.length > 0) {
          const mostRecentOrder = newOrders[0];
          const currentLastOrderId = mostRecentOrder.id;
          const currentLastOrderTime = new Date(mostRecentOrder.created_at).getTime();

          if (lastOrderIdRef.current) {
            if (lastOrderIdRef.current !== currentLastOrderId) {
              const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
              const s = appSettingsRef.current;
              if (currentLastOrderTime > twoMinutesAgo && s.soundEnabled) {
                playNewOrderSound({ soundId: s.soundId, repeatCount: s.soundRepeatCount, delayMs: 2000 });
              }
            }
          }

          lastOrderIdRef.current = currentLastOrderId;
        }

        setOrders(newOrders);
        setLastUpdated(new Date());
        setRefreshCountdown(appSettingsRef.current.refreshIntervalSec);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load orders');
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();

    // Set up realtime subscription
    subscriptionRef.current = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as { id: string; created_at: string };
            const orderDate = new Date(newOrder.created_at).toISOString().split('T')[0];
            const s = appSettingsRef.current;
            if (orderDate === selectedDate && s.soundEnabled && lastOrderIdRef.current !== newOrder.id) {
              playNewOrderSound({ soundId: s.soundId, repeatCount: s.soundRepeatCount, delayMs: 2000 });
              lastOrderIdRef.current = newOrder.id;
            }
          }
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [statusFilter, paymentFilter, selectedDate]);

  // Countdown timer for refresh
  useEffect(() => {
    if (refreshCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            loadOrders();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [refreshCountdown]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleViewOrder = async (orderId: string) => {
    try {
      const result = await getOrder(orderId);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else if (result.data) {
        setSelectedOrder(result.data);
        setShowOrderModal(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load order');
      console.error('Error loading order:', error);
    }
  };

  const handleStatusUpdate = (orderId: string, newStatus: OrderStatus) => {
    setStatusToUpdate({ orderId, status: newStatus });
    setShowStatusDialog(true);
  };

  const confirmStatusUpdate = async () => {
    if (!statusToUpdate) return;

    try {
      setUpdatingStatus(statusToUpdate.orderId);
      const result = await updateOrderStatus(statusToUpdate.orderId, statusToUpdate.status);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        await loadOrders();
        if (selectedOrder && selectedOrder.id === statusToUpdate.orderId) {
          setSelectedOrder(result.data);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(null);
      setShowStatusDialog(false);
      setStatusToUpdate(null);
    }
  };

  const handlePaymentStatusUpdate = async (orderId: string, newStatus: PaymentStatus) => {
    try {
      setUpdatingStatus(orderId);
      const result = await updatePaymentStatus(orderId, newStatus);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        await loadOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(result.data);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update payment status');
      console.error('Error updating payment status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleQuickAction = async (orderId: string, action: 'prepare' | 'ready' | 'completed') => {
    const statusMap: Record<string, OrderStatus> = {
      prepare: 'preparing',
      ready: 'ready',
      completed: 'completed',
    };

    const newStatus = statusMap[action];
    if (!newStatus) return;

    try {
      setUpdatingStatus(orderId);
      const result = await updateOrderStatus(orderId, newStatus);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        await loadOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(result.data);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getNextQuickAction = (currentStatus: OrderStatus): { action: string; label: string } | null => {
    switch (currentStatus) {
      case 'confirmed':
        return { action: 'prepare', label: 'Start Preparing' };
      case 'preparing':
        return { action: 'ready', label: 'Mark Ready' };
      case 'ready':
        return { action: 'completed', label: 'Complete' };
      default:
        return null;
    }
  };

  const handlePrint = async (order: Order) => {
    try {
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

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setSelectedDate(getTodayDateString());
      return;
    }

    const date = new Date(selectedDate);
    if (direction === 'prev') {
      date.setDate(date.getDate() - 1);
    } else {
      date.setDate(date.getDate() + 1);
      const today = new Date();
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 1);
      if (date > maxDate) return;
    }
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const renderOrderItem = ({ item: order }: { item: Order }) => {
    const statusColor = STATUS_COLORS[order.order_status];
    const statusLabel = STATUS_LABELS[order.order_status];
    const paymentColor = PAYMENT_STATUS_COLORS[order.payment_status];
    const paymentLabel = PAYMENT_STATUS_LABELS[order.payment_status];
    const quickAction = getNextQuickAction(order.order_status);

    return (
      <Card style={styles.orderCard} onPress={() => handleOrderPress(order)}>
        <Card.Content>
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderLeft}>
              <Text style={styles.orderNumber}>#{order.order_number}</Text>
              <Text style={styles.customerName}>
                {order.customer_name || order.customer_email}
              </Text>
              <View style={styles.orderMeta}>
                <Text style={styles.orderType}>
                  {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
                </Text>
                <Text style={styles.orderTime}>
                  {new Date(order.created_at).toLocaleTimeString()}
                </Text>
              </View>
            </View>
            <View style={styles.badgesContainer}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{statusLabel}</Text>
              </View>
              <View style={[styles.paymentBadge, { backgroundColor: paymentColor }]}>
                <Text style={styles.paymentText}>{paymentLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.orderInfo}>
            <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
          </View>

          <View style={styles.quickActions}>
            {quickAction && (
              <PaperButton
                mode="contained"
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuickAction(order.id, quickAction.action as 'prepare' | 'ready' | 'completed');
                }}
                disabled={updatingStatus === order.id}
                style={styles.paperInlineButton}
                contentStyle={styles.paperInlineButtonContent}
              >
                {quickAction.label}
              </PaperButton>
            )}
            <PaperButton
              mode="outlined"
              onPress={(e) => {
                e.stopPropagation();
                handleViewOrder(order.id);
              }}
              style={styles.paperInlineButton}
              contentStyle={styles.paperInlineButtonContent}
            >
              View
            </PaperButton>
            <PaperButton
              mode="outlined"
              onPress={(e) => {
                e.stopPropagation();
                handlePrint(order);
              }}
              style={styles.paperInlineButton}
              contentStyle={styles.paperInlineButtonContent}
            >
              Print
            </PaperButton>
          </View>

          <View style={styles.statusControls}>
            <View style={styles.statusControl}>
              <Text style={styles.statusControlLabel}>Status:</Text>
              <View style={styles.statusSelectContainer}>
                <TouchableOpacity
                  style={[styles.statusSelect, { backgroundColor: statusColor }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    // Show status picker
                    Alert.alert(
                      'Update Status',
                      'Select new status',
                      [
                        ...Object.entries(STATUS_LABELS).map(([status, label]) => ({
                          text: label,
                          onPress: () => handleStatusUpdate(order.id, status as OrderStatus),
                        })),
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }}
                  disabled={updatingStatus === order.id}
                >
                  <Text style={styles.statusSelectText}>{statusLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.statusControl}>
              <Text style={styles.statusControlLabel}>Payment:</Text>
              <View style={styles.statusSelectContainer}>
                <TouchableOpacity
                  style={[styles.statusSelect, { backgroundColor: paymentColor }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    Alert.alert(
                      'Update Payment Status',
                      'Select new payment status',
                      [
                        ...Object.entries(PAYMENT_STATUS_LABELS).map(([status, label]) => ({
                          text: label,
                          onPress: () => handlePaymentStatusUpdate(order.id, status as PaymentStatus),
                        })),
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }}
                  disabled={updatingStatus === order.id}
                >
                  <Text style={styles.statusSelectText}>{paymentLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Date Navigation */}
      <Surface style={[styles.header, isNarrow && styles.headerNarrow]} elevation={1}>
        <View style={[styles.headerTop, isPortrait && styles.headerTopPortrait]}>
          <View>
            <Text style={[styles.headerTitle, isNarrow && styles.headerTitleNarrow]}>Order Management</Text>
            <Text style={styles.headerSubtitle}>
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={[styles.headerActions, isPortrait && styles.headerActionsPortrait]}>
            <PaperButton
              mode="contained"
              onPress={loadOrders}
              disabled={loading}
              loading={loading}
              contentStyle={styles.refreshButtonContent}
            >
              {refreshCountdown > 0 ? `Refresh (${refreshCountdown}s)` : 'Refresh'}
            </PaperButton>
          </View>
        </View>

        {/* Date Navigation */}
        <View style={[styles.dateNavigation, isPortrait && styles.dateNavigationPortrait]}>
          <IconButton icon="chevron-left" onPress={() => navigateDate('prev')} />
          <View style={styles.dateInputContainer}>
            <PaperButton
              mode="outlined"
              onPress={() => {
                // For React Native, we'll use a simple date picker approach
                // In production, you might want to use a proper date picker library
                Alert.alert(
                  'Select Date',
                  'Date picker would open here',
                  [
                    { text: 'Today', onPress: () => setSelectedDate(getTodayDateString()) },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              {selectedDate}
            </PaperButton>
          </View>
          <IconButton
            icon="chevron-right"
            onPress={() => navigateDate('next')}
            disabled={new Date(selectedDate) >= new Date(getTodayDateString())}
          />
          <PaperButton mode="text" onPress={() => navigateDate('today')}>Today</PaperButton>
        </View>
      </Surface>

      {/* Filters */}
      <View style={styles.filters}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Status:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <Chip selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} style={styles.chip}>
              All
            </Chip>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <Chip
                key={status}
                selected={statusFilter === status}
                onPress={() => setStatusFilter(status)}
                style={styles.chip}
              >
                {label}
              </Chip>
            ))}
          </ScrollView>
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Payment:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <Chip selected={paymentFilter === 'all'} onPress={() => setPaymentFilter('all')} style={styles.chip}>
              All
            </Chip>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([status, label]) => (
              <Chip
                key={status}
                selected={paymentFilter === status}
                onPress={() => setPaymentFilter(status)}
                style={styles.chip}
              >
                {label}
              </Chip>
            ))}
          </ScrollView>
        </View>
        {lastUpdated && (
          <Text style={styles.lastUpdated}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No orders found</Text>
            <Text style={styles.emptySubtext}>
              {selectedDate === getTodayDateString()
                ? 'No orders for today yet.'
                : `No orders found for ${new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}.`}
            </Text>
          </View>
        }
      />

      {/* Order Detail Modal */}
      <Modal
        visible={showOrderModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Order {selectedOrder?.order_number}
            </Text>
            <View style={styles.modalHeaderActions}>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => selectedOrder && handlePrint(selectedOrder)}
              >
                <Text style={styles.modalActionButtonText}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowOrderModal(false)}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.modalContent}>
            {selectedOrder && (
              <>
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Customer Information</Text>
                  <Text style={styles.modalText}>{selectedOrder.customer_name || 'N/A'}</Text>
                  <Text style={styles.modalTextSecondary}>{selectedOrder.customer_email}</Text>
                  <Text style={styles.modalTextSecondary}>{selectedOrder.customer_phone}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Order Details</Text>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Payment:</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedOrder.payment_method} - {PAYMENT_STATUS_LABELS[selectedOrder.payment_status]}
                    </Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Status:</Text>
                    <View style={[styles.modalStatusBadge, { backgroundColor: STATUS_COLORS[selectedOrder.order_status] }]}>
                      <Text style={styles.modalStatusText}>
                        {STATUS_LABELS[selectedOrder.order_status]}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.modalTextSecondary}>
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </Text>
                </View>

                {selectedOrder.special_instructions && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Special Instructions</Text>
                    <Text style={styles.modalText}>{selectedOrder.special_instructions}</Text>
                  </View>
                )}

                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Order Items</Text>
                    {selectedOrder.items.map((item, index) => (
                      <View key={index} style={styles.modalItemCard}>
                        <Text style={styles.modalItemName}>
                          {item.quantity}x {item.product_name}
                        </Text>
                        <Text style={styles.modalItemPrice}>${item.subtotal.toFixed(2)}</Text>
                        {item.comment && (
                          <Text style={styles.modalItemComment}>Note: {item.comment}</Text>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <View style={styles.modalAddonsContainer}>
                            {item.addons.map((addon) => (
                              <Text key={addon.id} style={styles.modalAddonText}>
                                + {addon.addon_item_name} ({addon.addon_group_name}) - ${addon.addon_item_price.toFixed(2)}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Total</Text>
                  <View style={styles.modalTotalRow}>
                    <Text style={styles.modalTotalLabel}>Subtotal:</Text>
                    <Text style={styles.modalTotalValue}>${selectedOrder.subtotal.toFixed(2)}</Text>
                  </View>
                  {selectedOrder.tax > 0 && (
                    <View style={styles.modalTotalRow}>
                      <Text style={styles.modalTotalLabel}>Tax:</Text>
                      <Text style={styles.modalTotalValue}>${selectedOrder.tax.toFixed(2)}</Text>
                    </View>
                  )}
                  {selectedOrder.delivery_fee > 0 && (
                    <View style={styles.modalTotalRow}>
                      <Text style={styles.modalTotalLabel}>Delivery Fee:</Text>
                      <Text style={styles.modalTotalValue}>${selectedOrder.delivery_fee.toFixed(2)}</Text>
                    </View>
                  )}
                  {selectedOrder.service_fee > 0 && (
                    <View style={styles.modalTotalRow}>
                      <Text style={styles.modalTotalLabel}>Service Fee:</Text>
                      <Text style={styles.modalTotalValue}>${selectedOrder.service_fee.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.modalTotalRow, styles.modalFinalTotal]}>
                    <Text style={styles.modalFinalTotalLabel}>Total:</Text>
                    <Text style={styles.modalFinalTotalValue}>${selectedOrder.total.toFixed(2)}</Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Status Update Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showStatusDialog}
        onClose={() => {
          setShowStatusDialog(false);
          setStatusToUpdate(null);
        }}
        onConfirm={confirmStatusUpdate}
        title="Update Order Status"
        message={`Are you sure you want to update this order status to "${statusToUpdate?.status}"?`}
        confirmText="Update"
        cancelText="Cancel"
        variant="warning"
        isLoading={updatingStatus === statusToUpdate?.orderId}
      />
    </View>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerNarrow: {
    padding: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleNarrow: {
    fontSize: 18,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
    flexWrap: 'wrap',
  },
  headerTopPortrait: {
    flexDirection: 'column',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionsPortrait: {
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    gap: 10,
  },
  refreshButtonContent: {
    paddingVertical: 6,
  },
  refreshButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    minWidth: 100,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateNavigationPortrait: {
    flexWrap: 'wrap',
    rowGap: 8,
  },
  dateNavButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    minWidth: 44,
    alignItems: 'center',
  },
  dateNavButtonDisabled: {
    opacity: 0.5,
  },
  dateNavButtonText: {
    fontSize: 18,
    color: '#374151',
  },
  dateInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  todayLabel: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  todayButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  todayButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filters: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterScroll: {
    flexGrow: 0,
  },
  chip: {
    marginRight: 8,
    marginBottom: 6,
  },
  paperInlineButton: {
    borderRadius: 10,
  },
  paperInlineButtonContent: {
    paddingVertical: 4,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  customerName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 6,
  },
  orderMeta: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  orderType: {
    fontSize: 14,
    color: '#666',
  },
  orderTime: {
    fontSize: 14,
    color: '#666',
  },
  badgesContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  paymentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderInfo: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#3b82f6',
  },
  printButton: {
    backgroundColor: '#6b7280',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusControls: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  statusControl: {
    flex: 1,
  },
  statusControlLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  statusSelectContainer: {
    flexDirection: 'row',
  },
  statusSelect: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusSelectText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  modalActionButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalTextSecondary: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  modalInfoValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalItemCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 12,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  modalItemComment: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalAddonsContainer: {
    marginTop: 8,
    paddingLeft: 16,
  },
  modalAddonText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTotalLabel: {
    fontSize: 16,
    color: '#666',
  },
  modalTotalValue: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  modalFinalTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e5e5e5',
  },
  modalFinalTotalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalFinalTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
});
