import { useState, useEffect, useMemo, useRef } from 'react';
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
import { escposPrintKitchenReceipt, formatPrinterError } from '../../lib/escpos-printer';
import { KitchenAlertOverlay } from '../../lib/KitchenAlertOverlay';

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

const webBaseUrl = process.env.EXPO_PUBLIC_SITE_URL;

export function OrdersScreenBase({ mode, enableStatusUpdates }: { mode: 'live' | 'all'; enableStatusUpdates: boolean }) {
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isNarrow = width < 420;
  const isTablet = width >= 600;

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(0);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isFiltersModalVisible, setIsFiltersModalVisible] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  // Ensure Live Orders always starts unfiltered so pending orders are visible.
  useEffect(() => {
    if (mode !== 'live') return;
    setStatusFilter('all');
    setPaymentFilter('all');
  }, [mode]);

  const lastOrderIdRef = useRef<string | null>(null);
  const autoPrintedOrderIdsRef = useRef<Set<string>>(new Set());
  const lastPrinterAlertAtRef = useRef<number>(0);
  const lastAutoStatusAlertAtRef = useRef<number>(0);
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
      setLoadError(null);
      const filters: { status?: string; payment_status?: string; date?: string; since?: string } = {};
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      if (paymentFilter !== 'all') {
        filters.payment_status = paymentFilter;
      }
      if (mode === 'live') {
        const since = new Date();
        since.setHours(since.getHours() - 24);
        filters.since = since.toISOString();
      } else if (selectedDate) {
        filters.date = selectedDate;
      }

      const result = await getAllOrders(filters);
      if (result.error) {
        setLoadError(result.error);
        Alert.alert('Error', result.error);
      } else {
        let newOrders = result.data || [];

        // In "Live" mode, only show active orders (exclude completed/cancelled/refunded).
        if (mode === 'live') {
          newOrders = newOrders.filter(
            (order) =>
              order.order_status !== 'completed' &&
              order.order_status !== 'cancelled' &&
              order.payment_status !== 'refunded'
          );
        }

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
      setLoadError(error instanceof Error ? error.message : 'Failed to load orders');
      Alert.alert('Error', 'Failed to load orders');
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();

    // Realtime subscription and auto-print are only needed in "live" mode.
    if (mode !== 'live') {
      return;
    }

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
            const s = appSettingsRef.current;
            if (s.soundEnabled && lastOrderIdRef.current !== newOrder.id) {
              playNewOrderSound({ soundId: s.soundId, repeatCount: s.soundRepeatCount, delayMs: 2000 });
              lastOrderIdRef.current = newOrder.id;
            }

            if (
              s.printerEnabled &&
              s.printerAutoPrint &&
              !!s.printerSelectedTarget &&
              !autoPrintedOrderIdsRef.current.has(newOrder.id)
            ) {
              autoPrintedOrderIdsRef.current.add(newOrder.id);
              setPrintingOrderId(newOrder.id);
              const delaySec = typeof s.printerDelayPrintSec === 'number' ? s.printerDelayPrintSec : 3;
              setTimeout(() => {
                getOrder(newOrder.id)
                  .then(async (result) => {
                    if (result.error || !result.data) {
                      throw new Error(result.error || 'Failed to load order for printing');
                    }

                    const selected = s.printerSaved.find((p) => p.target === s.printerSelectedTarget) || null;
                    if (!selected) {
                      throw new Error('Printer not selected');
                    }

                    await escposPrintKitchenReceipt(result.data, selected, s.printerCopies);

                    // After a successful print, auto-transition the order to "preparing"
                    // (kitchen has received the ticket). This should not require any user action.
                    if (result.data.order_status === 'pending' || result.data.order_status === 'confirmed') {
                      const statusResult = await updateOrderStatus(result.data.id, 'preparing');
                      if (statusResult.error) {
                        console.error('[LiveOrders] Auto status update error:', statusResult.error);
                        const now = Date.now();
                        if (now - lastAutoStatusAlertAtRef.current > 30000) {
                          lastAutoStatusAlertAtRef.current = now;
                          Alert.alert('Status update error', statusResult.error);
                        }
                      }
                    }
                  })
                  .catch((err) => {
                    autoPrintedOrderIdsRef.current.delete(newOrder.id);
                    console.error('Auto print error:', err);
                    if (err && typeof (err as Error).stack === 'string') {
                      console.error('Auto print stack:', (err as Error).stack);
                    }

                    const now = Date.now();
                    if (now - lastPrinterAlertAtRef.current > 30000) {
                      lastPrinterAlertAtRef.current = now;

                      const errorMessage = err instanceof Error ? err.message : String(err);
                      const errorStack = err instanceof Error ? err.stack : undefined;
                      const details =
                        errorStack && errorStack.length > 0 ? `${errorMessage}\n\n${errorStack}` : errorMessage;

                      // Play a distinct warning sound so staff notice immediately.
                      if (s.soundEnabled) {
                        const warningRepeatCount = Math.min(5, Math.max(1, Math.trunc(s.soundRepeatCount)));
                        void playNewOrderSound({ soundId: 'vopvoopvooop', repeatCount: warningRepeatCount, delayMs: 0 });
                      }

                      Alert.alert('EPOS Print Failed', details);
                    }
                  })
                  .finally(() => {
                    setPrintingOrderId((oid) => (oid === newOrder.id ? null : oid));
                  });
              }, delaySec * 1000);
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
  }, [statusFilter, paymentFilter, selectedDate, mode]);

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

  // Live timer for elapsed order age (live mode only).
  useEffect(() => {
    if (mode !== 'live') return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const formatElapsed = useMemo(() => {
    return (createdAtIso: string): { text: string; minutes: number } => {
      const createdMs = new Date(createdAtIso).getTime();
      const diffSec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
      const minutes = Math.floor(diffSec / 60);
      const seconds = diffSec % 60;
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');
      return { text: `${mm}:${ss}`, minutes };
    };
  }, [nowMs]);

  const paymentSummary = useMemo(() => {
    return (order: Order): string => {
      const type = order.order_type === 'delivery' ? 'Delivery' : 'Pickup';
      const payment =
        order.payment_method === 'store'
          ? 'Pay at Counter'
          : order.payment_status === 'paid'
            ? 'Paid Online'
            : 'Online Payment';
      return `${type} • ${payment}`;
    };
  }, []);

  const staleThresholdSec = Math.max(60, Math.round((appSettings.refreshIntervalSec || 30) * 2.5));
  const isStale =
    mode === 'live' && !!lastUpdated && (Date.now() - lastUpdated.getTime()) / 1000 > staleThresholdSec;

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

  const handleQuickAction = async (orderId: string, action: 'accept' | 'prepare' | 'ready' | 'completed') => {
    const statusMap: Record<string, OrderStatus> = {
      accept: 'confirmed',
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
        if (newStatus === 'ready' || newStatus === 'completed') {
          void triggerOrderStatusEmail(orderId, newStatus);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const triggerOrderStatusEmail = async (orderId: string, status: string) => {
    if (!webBaseUrl) {
      console.warn('[LiveOrders] EXPO_PUBLIC_SITE_URL is not configured; skipping status email.');
      return;
    }
    try {
      const response = await fetch(`${webBaseUrl}/api/orders/status-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('[LiveOrders] Failed to send status email:', response.status, text);
      }
    } catch (error) {
      console.error('[LiveOrders] Error sending status email:', error);
    }
  };

  const getNextQuickAction = (currentStatus: OrderStatus): { action: string; label: string } | null => {
    switch (currentStatus) {
      case 'pending':
        return { action: 'accept', label: 'Accept' };
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
      const s = appSettingsRef.current;
      const selected = s.printerSaved.find((p) => p.target === s.printerSelectedTarget) || null;
      if (s.printerEnabled && selected) {
        try {
          await escposPrintKitchenReceipt(order, selected, s.printerCopies);
          return;
        } catch (printerError) {
          console.error('Print error:', printerError);
          if (printerError && typeof (printerError as Error).stack === 'string') {
            console.error('Print stack:', (printerError as Error).stack);
          }
          Alert.alert(
            'Printer error',
            formatPrinterError(printerError),
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'System Print',
                onPress: async () => {
                  try {
                    const html = generatePrintHTML(order);
                    await Print.printAsync({ html });
                  } catch (e) {
                    console.error('System print error:', e);
                    Alert.alert('Error', e instanceof Error ? e.message : 'System print failed');
                  }
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
      const detail = error instanceof Error ? error.message : 'Failed to print order';
      console.error('Print error:', error);
      Alert.alert('Error', detail);
    }
  };

  const generatePrintHTML = (order: Order): string => {
    const ticketOrderNumber = (() => {
      const match = order.order_number.match(/(\d{3,})$/);
      if (!match) return order.order_number;
      const lastSegment = match[1];
      return `1${lastSegment}`;
    })();
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

    const scheduledPickupAt = order.scheduled_pickup_at ? new Date(order.scheduled_pickup_at) : null;
    const isPreOrder =
      order.order_type === 'pickup' &&
      !!scheduledPickupAt &&
      Number.isFinite(scheduledPickupAt.getTime()) &&
      scheduledPickupAt.getTime() > Date.now();

    const preOrderBannerHTML = isPreOrder
      ? `<div class="preorder-banner">PRE-ORDER</div>
         <div class="pickup-time-hero"><strong>PICKUP TIME:</strong> ${scheduledPickupAt!.toLocaleString()}</div>`
      : '';

    const pickupTimeHTML =
      order.order_type === 'pickup' && order.scheduled_pickup_at
        ? `<p><strong>Pickup time:</strong> ${new Date(order.scheduled_pickup_at).toLocaleString()}</p>`
        : '';

    const paymentStatusText = PAYMENT_STATUS_LABELS[order.payment_status];

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order #${ticketOrderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 18px; }
            h1 { margin: 0 0 10px 0; font-size: 30px; }
            .payment-status { font-size: 26px; font-weight: bold; margin: 6px 0 4px 0; }
            .preorder-banner { font-size: 34px; font-weight: 900; text-align: center; margin: 10px 0 8px 0; letter-spacing: 1px; }
            .pickup-time-hero { font-size: 22px; font-weight: 700; text-align: center; margin: 0 0 10px 0; }
            .info { margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .total { font-size: 24px; font-weight: bold; margin-top: 20px; }
            .order-number-bottom { margin-top: 24px; font-size: 32px; font-weight: bold; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Order #${ticketOrderNumber}</h1>
          <div class="payment-status">${paymentStatusText}</div>
          ${preOrderBannerHTML}
          <div class="info">
            <p><strong>Customer:</strong> ${order.customer_name || order.customer_email}</p>
            <p><strong>Phone:</strong> ${order.customer_phone}</p>
            <p><strong>Type:</strong> ${order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</p>
            <p><strong>Order status:</strong> ${STATUS_LABELS[order.order_status]}</p>
            <p><strong>Payment status:</strong> ${paymentStatusText}</p>
            <p><strong>Time placed:</strong> ${new Date(order.created_at).toLocaleString()}</p>
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
          <p class="order-number-bottom">ORDER #${ticketOrderNumber}</p>
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
    const elapsed = mode === 'live' ? formatElapsed(order.created_at) : null;
    const elapsedColor =
      elapsed && elapsed.minutes < 10 ? '#16a34a' : elapsed && elapsed.minutes < 20 ? '#ca8a04' : '#dc2626';
    const isPaid = order.payment_status === 'paid';

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
                <Text style={styles.orderType}>{paymentSummary(order)}</Text>
              </View>
            </View>
            <View style={styles.badgesContainer}>
              {mode === 'live' && elapsed ? (
                <View style={[styles.elapsedPill, { backgroundColor: elapsedColor }]}>
                  <Text style={styles.elapsedText}>{elapsed.text}</Text>
                </View>
              ) : (
                <Text style={styles.orderTime}>{new Date(order.created_at).toLocaleTimeString()}</Text>
              )}
              <IconButton
                icon="printer"
                size={20}
                onPress={(e) => {
                  e.stopPropagation();
                  handlePrint(order);
                }}
                accessibilityLabel="Print order"
              />
            </View>
          </View>

          <View style={styles.orderInfoRow}>
            <View style={styles.orderInfoLeft}>
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
            {enableStatusUpdates && quickAction && (
              <PaperButton
                mode="contained"
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuickAction(order.id, quickAction.action as 'accept' | 'prepare' | 'ready' | 'completed');
                }}
                disabled={updatingStatus === order.id}
                style={styles.bodyQuickButton}
                contentStyle={styles.bodyQuickButtonContent}
              >
                {quickAction.label}
              </PaperButton>
            )}
          </View>

          <View style={styles.statusControls}>
            <View style={styles.statusControl}>
              <Text style={styles.statusControlLabel}>Status:</Text>
              <View style={styles.statusSelectContainer}>
                <TouchableOpacity
                  style={[styles.statusSelect, { backgroundColor: statusColor }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (!enableStatusUpdates) return;
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
                  disabled={updatingStatus === order.id || !enableStatusUpdates}
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
                    if (!enableStatusUpdates) return;
                    Alert.alert(
                      'Mark payment as paid',
                      'Select payment method',
                      [
                        {
                          text: 'Card',
                          onPress: () => handlePaymentStatusUpdate(order.id, 'paid'),
                        },
                        {
                          text: 'Cash',
                          onPress: () => handlePaymentStatusUpdate(order.id, 'paid'),
                        },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }}
                  disabled={updatingStatus === order.id || !enableStatusUpdates || order.payment_status === 'paid'}
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
      {/* Printing overlay chip */}
      {printingOrderId && (
        <View style={{ position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center', zIndex: 100 }} pointerEvents="none">
          <View style={{ backgroundColor: '#2563eb', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Printing...</Text>
          </View>
        </View>
      )}
      {mode === 'live' && (isStale || !!loadError) && (
        <KitchenAlertOverlay
          title={loadError ? 'ERROR' : 'CONNECTION ISSUE'}
          message={
            loadError
              ? 'Live Orders failed to refresh. Please check Wi‑Fi and try again.'
              : 'Live Orders has not synced recently. Please check Wi‑Fi and try refreshing.'
          }
          details={`Last sync: ${lastUpdated ? lastUpdated.toLocaleString() : 'unknown'}\nThreshold: ${staleThresholdSec}s`}
          primaryActionText="Retry refresh"
          onPrimaryAction={() => loadOrders()}
        />
      )}
      {/* Header with Date Navigation (no inner title to save vertical space; tab bar already shows screen name) */}
      <Surface style={[styles.header, isNarrow && styles.headerNarrow]} elevation={1}>
        {isTablet ? (
          <View style={styles.tabletHeaderRow}>

            {mode === 'all' ? (
              <View style={styles.tabletDateRow}>
                <IconButton icon="chevron-left" onPress={() => navigateDate('prev')} />
                <PaperButton
                  mode="outlined"
                  onPress={() => {
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
                <IconButton
                  icon="chevron-right"
                  onPress={() => navigateDate('next')}
                  disabled={new Date(selectedDate) >= new Date(getTodayDateString())}
                />
                <PaperButton mode="text" onPress={() => navigateDate('today')}>
                  Today
                </PaperButton>
              </View>
            ) : (
              <View style={styles.tabletDateRow} />
            )}

            <View style={styles.headerCenter} />

            <View style={styles.headerActions}>
              <IconButton
                icon="filter-variant"
                onPress={() => setIsFiltersModalVisible(true)}
                accessibilityLabel="Filters"
              />
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
        ) : (
          <>
            <View style={[styles.headerTop, isPortrait && styles.headerTopPortrait]}>
              <View style={styles.headerTitleContainer} />

              <View style={[styles.headerActions, isPortrait && styles.headerActionsPortrait]}>
                <IconButton
                  icon="filter-variant"
                  onPress={() => setIsFiltersModalVisible(true)}
                  accessibilityLabel="Filters"
                />
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

            {/* Date Navigation (history only) */}
            {mode === 'all' && (
              <View style={[styles.dateNavigation, isPortrait && styles.dateNavigationPortrait]}>
                <IconButton icon="chevron-left" onPress={() => navigateDate('prev')} />
                <PaperButton
                  mode="outlined"
                  onPress={() => {
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
                <IconButton
                  icon="chevron-right"
                  onPress={() => navigateDate('next')}
                  disabled={new Date(selectedDate) >= new Date(getTodayDateString())}
                />
                <PaperButton mode="text" onPress={() => navigateDate('today')}>
                  Today
                </PaperButton>
              </View>
            )}
          </>
        )}

        {lastUpdated && (
          <Text style={styles.lastUpdated}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Text>
        )}
      </Surface>

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

      {/* Filters Modal */}
      <Modal
        visible={isFiltersModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsFiltersModalVisible(false)}
      >
        <View style={styles.filtersModalBackdrop}>
          <View style={styles.filtersModalContent}>
            <Text style={styles.filtersModalTitle}>Filters</Text>
            <ScrollView style={styles.filtersModalScroll} contentContainerStyle={styles.filtersModalScrollContent}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Status</Text>
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
                <Text style={styles.filterLabel}>Payment</Text>
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
            </ScrollView>
            <View style={styles.filtersModalActions}>
              <PaperButton
                mode="outlined"
                onPress={() => {
                  setStatusFilter('all');
                  setPaymentFilter('all');
                }}
              >
                Reset
              </PaperButton>
              <PaperButton
                mode="contained"
                onPress={() => {
                  setIsFiltersModalVisible(false);
                  loadOrders();
                }}
              >
                Apply
              </PaperButton>
            </View>
          </View>
        </View>
      </Modal>

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
                        {Array.isArray(item.removed_ingredients) && item.removed_ingredients.length > 0 && (
                          <Text style={styles.modalRemovedText}>
                            Removed: {item.removed_ingredients.join(', ')}
                          </Text>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <View style={styles.modalAddonsContainer}>
                            {Object.values(
                              item.addons.reduce((acc, addon) => {
                                const key = `${addon.addon_item_name}__${addon.addon_item_price}`;
                                if (!acc[key]) acc[key] = { ...addon, qty: 0 };
                                acc[key].qty += 1;
                                return acc;
                              }, {} as Record<string, any>)
                            ).map((groupedAddon: any) => {
                              const qty = groupedAddon.qty;
                              const name = groupedAddon.addon_item_name;
                              const price = groupedAddon.addon_item_price;
                              let label = qty > 1 ? `${qty}x ${name}` : name;
                              const isPaid = price > 0;
                              if (isPaid) label += ` - $${price.toFixed(2)}`;
                              return (
                                <Text
                                  key={groupedAddon.addon_item_id + '_' + price}
                                  style={[styles.modalAddonText, isPaid && { fontWeight: 'bold' }]}
                                >
                                  + {label}
                                </Text>
                              );
                            })}
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

      {/* Status Update Confirmation Dialog (only used when status updates are enabled) */}
      {enableStatusUpdates && (
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
      )}
    </View>
  );
}

// Default "Orders" tab shows all orders as read-only history.
export default function OrdersScreen() {
  return <OrdersScreenBase mode="all" enableStatusUpdates={false} />;
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
  headerTitleContainer: {
    flexShrink: 1,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewModeButton: {
    borderRadius: 999,
  },
  tabletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  tabletDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
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
  filtersModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  filtersModalContent: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    marginBottom: 72,
  },
  filtersModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  filtersModalScroll: {
    flexGrow: 0,
  },
  filtersModalScrollContent: {
    paddingBottom: 8,
  },
  filtersModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
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
  elapsedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    minWidth: 72,
    alignItems: 'center',
  },
  elapsedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  badgesContainer: {
    alignItems: 'flex-end',
    gap: 6,
    flexDirection: 'row',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
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
  orderInfoRow: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderInfoLeft: {
    flexShrink: 1,
  },
  paymentAttention: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  paymentAttentionPaid: {
    color: '#16a34a',
  },
  paymentAttentionUnpaid: {
    color: '#dc2626',
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
  bodyQuickButton: {
    borderRadius: 999,
    marginRight: 0,
  },
  bodyQuickButtonContent: {
    paddingHorizontal: 12,
    paddingVertical: 2,
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
  modalRemovedText: {
    fontSize: 14,
    color: '#b45309',
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
