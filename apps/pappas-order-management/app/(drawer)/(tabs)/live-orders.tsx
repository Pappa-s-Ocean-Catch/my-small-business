import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Button as PaperButton,
  Surface,
  Badge,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getAllOrders, updateOrderStatus, getOrder } from '@/lib/orders';
import type { Order, OrderStatus } from '@my-small-business/types';
import { playNewOrderSound } from '@/lib/sounds';
import { DEFAULT_APP_SETTINGS, loadAppSettings, subscribeAppSettings, type AppSettings } from '@/lib/settings';
import { KitchenAlertOverlay } from '@/lib/KitchenAlertOverlay';
import { CustomerModal } from '@/components/CustomerModal';
import { LiveOrderListItem } from '@/components/LiveOrderListItem';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { escposPrintKitchenReceipt } from '@/lib/escpos-printer';

export default function LiveOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(0);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ email?: string; phone?: string }>({});
  const [preOrderSkipNotice, setPreOrderSkipNotice] = useState<string | null>(null);
  const [preOrderCount, setPreOrderCount] = useState<number>(0);

  const lastOrderIdRef = useRef<string | null>(null);
  const autoPrintedOrderIdsRef = useRef<Set<string>>(new Set());
  const lastPrinterAlertAtRef = useRef<number>(0);
  const lastAutoStatusAlertAtRef = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const preOrderNoticeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);

  const fetchPreOrderCount = async () => {
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .not('scheduled_pickup_at', 'is', null)
        .in('order_status', ['pending', 'confirmed', 'preparing', 'ready'])
        .neq('payment_status', 'refunded');

      if (error) throw error;
      setPreOrderCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch pre-order count:', err);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const since = new Date();
      since.setHours(since.getHours() - 24);

      const filters: { since: string } = {
        since: since.toISOString()
      };

      const result = await getAllOrders(filters);
      if (result.error) {
        setLoadError(result.error);
        Alert.alert('Error', result.error);
      } else {
        let newOrders = result.data || [];
        // Live Order Filter Logic:
        // 1. Exclude completed/cancelled/refunded.
        // 2. Either scheduled_pickup_at is null (ASAP)
        // 3. Or scheduled_pickup_at is within the next 30 minutes (or was in the past).
        newOrders = newOrders.filter((order) => {
          const isNotFinished =
            order.order_status !== 'completed' &&
            order.order_status !== 'cancelled' &&
            order.payment_status !== 'refunded';

          if (!isNotFinished) return false;

          if (!order.scheduled_pickup_at) return true; // ASAP

          const pickupDate = new Date(order.scheduled_pickup_at);
          const now = new Date();
          const diffMinutes = (pickupDate.getTime() - now.getTime()) / (1000 * 60);

          // Show if pickup is within 30 minutes (even if it was in the past, e.g. late pickup)
          return diffMinutes <= 30;
        });

        // Sort by pickup date/time (or created_at for ASAP)
        newOrders.sort((a, b) => {
          const timeA = new Date(a.scheduled_pickup_at || a.created_at).getTime();
          const timeB = new Date(b.scheduled_pickup_at || b.created_at).getTime();
          return timeA - timeB;
        });

        if (newOrders.length > 0) {
          const mostRecentOrder = newOrders[0];
          if (lastOrderIdRef.current && lastOrderIdRef.current !== mostRecentOrder.id) {
            const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
            const createdTime = new Date(mostRecentOrder.created_at).getTime();
            if (createdTime > twoMinutesAgo && appSettingsRef.current.soundEnabled) {
              playNewOrderSound({
                soundId: appSettingsRef.current.soundId,
                repeatCount: appSettingsRef.current.soundRepeatCount,
                delayMs: 2000
              });
            }
          }
          lastOrderIdRef.current = mostRecentOrder.id;
        }

        setOrders(newOrders);
        setLastUpdated(new Date());
        setRefreshCountdown(appSettingsRef.current.refreshIntervalSec);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load orders');
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchPreOrderCount();
    }
  };

  const {
    updatingStatus,
    printingOrderId,
    setPrintingOrderId,
    simulatorOrder,
    showSimulator,
    setShowSimulator,
    handleStatusUpdate,
    handlePaymentStatusUpdate,
    handleQuickAction,
    handlePrint,
  } = useOrderActions(appSettings, loadOrders, (updated) => {
    if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
  });

  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  useEffect(() => {
    const unsubscribe = subscribeAppSettings((s) => {
      setAppSettings(s);
      appSettingsRef.current = s;
    });
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAppSettings().then((s) => {
        setAppSettings(s);
        appSettingsRef.current = s;
      });
    }, [])
  );

  useEffect(() => {
    loadOrders();
    subscriptionRef.current = supabase
      .channel('live-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async (payload) => {
          const s = appSettingsRef.current;
          let shouldPrint = false;
          let orderId = (payload.new as any).id;
          const scheduledPickupAt = (payload.new as any)?.scheduled_pickup_at as string | null | undefined;
          const scheduledPickupAtMs = scheduledPickupAt ? new Date(scheduledPickupAt).getTime() : NaN;
          const isPreOrder = Number.isFinite(scheduledPickupAtMs) && scheduledPickupAtMs > Date.now();

          if (payload.eventType === 'INSERT' && payload.new.order_status === 'pending') {
            shouldPrint = true;
          } else if (
            payload.eventType === 'UPDATE' &&
            payload.old.order_status === 'pending_online_payment' &&
            (payload.new.order_status === 'confirmed' || payload.new.order_status === 'accepted')
          ) {
            shouldPrint = true;
          }

          if (shouldPrint) {
            // 1. Play sound for any new relevant order
            if (s.soundEnabled && lastOrderIdRef.current !== orderId) {
              playNewOrderSound({ soundId: s.soundId, repeatCount: s.soundRepeatCount, delayMs: 2000 });
              lastOrderIdRef.current = orderId;
            }

            // 2. Handle Auto-Actions
            if (isPreOrder) {
              // PRE-ORDER: Set to confirmed and skip printing
              const orderNumber = (payload.new as any)?.order_number || orderId;
              setPreOrderSkipNotice(`Pre-order ${orderNumber} received - print skipped`);
              if (preOrderNoticeTimeoutRef.current) clearTimeout(preOrderNoticeTimeoutRef.current);
              preOrderNoticeTimeoutRef.current = setTimeout(() => {
                setPreOrderSkipNotice(null);
              }, 4500);

              if ((payload.new as any).order_status === 'pending') {
                await updateOrderStatus(orderId, 'confirmed');
              }
            } else if (
              (s.printerEnabled || s.printerSimulator) &&
              s.printerAutoPrint &&
              !autoPrintedOrderIdsRef.current.has(orderId)
            ) {
              // ASAP ORDER: Auto-print and set to preparing
              autoPrintedOrderIdsRef.current.add(orderId);
              setPrintingOrderId(orderId);

              try {
                const result = await getOrder(orderId);
                if (result.error || !result.data) throw new Error(result.error || 'Failed to load order');

                if (s.printerSimulator) {
                  setShowSimulator(true);
                } else {
                  const selected = s.printerSaved.find((p) => p.target === s.printerSelectedTarget);
                  if (selected) await escposPrintKitchenReceipt(result.data, selected, s.printerCopies);
                }

                // Update status to preparing after successful print trigger
                if (result.data.order_status === 'pending' || result.data.order_status === 'confirmed') {
                  await updateOrderStatus(result.data.id, 'preparing');
                }
              } catch (err) {
                autoPrintedOrderIdsRef.current.delete(orderId);
                console.error('Auto print error:', err);
              } finally {
                setPrintingOrderId(null);
              }
            }
          }
          loadOrders();
          fetchPreOrderCount();
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preOrderNoticeTimeoutRef.current) clearTimeout(preOrderNoticeTimeoutRef.current);
    };
  }, []);

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
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [refreshCountdown]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const staleThresholdSec = Math.max(60, Math.round((appSettings.refreshIntervalSec || 30) * 2.5));
  const isStale = !!lastUpdated && (Date.now() - lastUpdated.getTime()) / 1000 > staleThresholdSec;

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleCustomerPress = (order: Order) => {
    setCustomerInfo({ email: order.customer_email, phone: order.customer_phone });
    setShowCustomerModal(true);
  };

  return (
    <View style={styles.container}>
      <CustomerModal
        visible={showCustomerModal}
        email={customerInfo.email}
        phone={customerInfo.phone}
        onClose={() => setShowCustomerModal(false)}
      />

      {printingOrderId && (
        <View style={styles.printingOverlay} pointerEvents="none">
          <View style={styles.printingChip}>
            <Text style={styles.printingText}>Printing...</Text>
          </View>
        </View>
      )}

      {!!preOrderSkipNotice && (
        <View style={styles.preOrderNoticeOverlay} pointerEvents="none">
          <View style={styles.preOrderNoticeChip}>
            <Text style={styles.preOrderNoticeText}>{preOrderSkipNotice}</Text>
          </View>
        </View>
      )}

      {(isStale || !!loadError) && (
        <KitchenAlertOverlay
          title={loadError ? 'ERROR' : 'CONNECTION ISSUE'}
          message={loadError ? 'Failed to refresh.' : 'Not synced recently.'}
          details={`Last sync: ${lastUpdated?.toLocaleString() || 'unknown'}`}
          primaryActionText="Retry"
          onPrimaryAction={loadOrders}
        />
      )}

      <Surface style={styles.header} elevation={1}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Orders</Text>
          <View style={styles.headerActions}>
            <View style={styles.preOrderBadgeContainer}>
              <PaperButton
                mode="outlined"
                onPress={() => router.push('/pre-orders')}
                style={styles.preOrderButton}
                icon="calendar-clock"
              >
                Pre-orders
              </PaperButton>
              {preOrderCount > 0 && (
                <Badge style={styles.preOrderBadge} size={20}>
                  {preOrderCount}
                </Badge>
              )}
            </View>
            <PaperButton
              mode="contained"
              onPress={loadOrders}
              loading={loading}
              style={styles.refreshButton}
            >
              {refreshCountdown > 0 ? `(${refreshCountdown}s)` : 'Refresh'}
            </PaperButton>
          </View>
        </View>
      </Surface>

      <FlatList
        data={orders}
        renderItem={({ item }) => (
          <LiveOrderListItem
            order={item}
            nowMs={nowMs}
            updatingStatus={updatingStatus}
            onOrderPress={handleOrderPress}
            onCustomerPress={handleCustomerPress}
            onPrintPress={handlePrint}
            onQuickAction={handleQuickAction}
            onStatusUpdate={(id, status) => {
              Alert.alert('Update Status', 'Select new status', [
                { text: 'Confirmed', onPress: () => handleStatusUpdate(id, 'confirmed') },
                { text: 'Preparing', onPress: () => handleStatusUpdate(id, 'preparing') },
                { text: 'Ready', onPress: () => handleStatusUpdate(id, 'ready') },
                { text: 'Completed', onPress: () => handleStatusUpdate(id, 'completed') },
                { text: 'Cancelled', onPress: () => handleStatusUpdate(id, 'cancelled') },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            onPaymentStatusUpdate={(id) => {
              Alert.alert('Mark as paid', 'Select payment method', [
                { text: 'Card', onPress: () => handlePaymentStatusUpdate(id, 'paid') },
                { text: 'Cash', onPress: () => handlePaymentStatusUpdate(id, 'paid') },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          />
        )}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No live orders</Text>
          </View>
        }
      />

      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onPrint={handlePrint}
        onCustomerPress={handleCustomerPress}
        onStatusUpdate={handleStatusUpdate}
        onPaymentStatusUpdate={handlePaymentStatusUpdate}
        onQuickAction={handleQuickAction}
        updatingStatus={updatingStatus}
      />

      <PrintSimulatorModal
        visible={showSimulator}
        order={simulatorOrder}
        onClose={() => setShowSimulator(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', flexShrink: 1 },
  headerActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  filterButton: { borderRadius: 8 },
  preOrderBadgeContainer: { position: 'relative' },
  preOrderButton: { borderRadius: 8, borderColor: '#2563eb' },
  preOrderBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    fontWeight: 'bold',
  },
  refreshButton: { borderRadius: 8, minWidth: 100 },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#6b7280' },
  printingOverlay: { position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  printingChip: { backgroundColor: '#2563eb', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  printingText: { color: '#fff', fontWeight: 'bold' },
  preOrderNoticeOverlay: { position: 'absolute', top: 66, left: 0, right: 0, alignItems: 'center', zIndex: 99 },
  preOrderNoticeChip: {
    backgroundColor: '#f59e0b',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxWidth: '92%',
  },
  preOrderNoticeText: { color: '#111827', fontWeight: '700' },
});
