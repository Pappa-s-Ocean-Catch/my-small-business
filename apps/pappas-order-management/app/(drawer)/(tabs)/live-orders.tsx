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
import { claimOrderForAutoPrint, getAllOrders, updateOrderStatus, getOrder } from '@/lib/orders';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { playNewOrderSound } from '@/lib/sounds';
import { DEFAULT_APP_SETTINGS, loadAppSettings, subscribeAppSettings, type AppSettings } from '@/lib/settings';
import { KitchenAlertOverlay } from '@/lib/KitchenAlertOverlay';
import { CustomerModal } from '@/components/CustomerModal';
import { LiveOrderListItem } from '@/components/LiveOrderListItem';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { CashTenderModal } from '@/components/CashTenderModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { escposPrintOrderImage } from '@/lib/escpos-printer';
import { captureRef } from 'react-native-view-shot';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { shouldPlayOrderSound } from '@/utils/orderUtils';

type TimeoutHandle = ReturnType<typeof setTimeout>;

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
  const [tempPrintingOrder, setTempPrintingOrder] = useState<Order | null>(null);
  const [tempPrintSource, setTempPrintSource] = useState<string | null>(null);
  const [cashTenderOrder, setCashTenderOrder] = useState<Order | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const globalReceiptRef = useRef(null);

  const lastOrderIdRef = useRef<string | null>(null);
  const soundedOrderIdsRef = useRef<Set<string>>(new Set());
  const processedOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingAnnouncementTimersRef = useRef<Map<string, TimeoutHandle>>(new Map());
  const announcingOrderIdsRef = useRef<Set<string>>(new Set());
  const autoPrintingOrderIdsRef = useRef<Set<string>>(new Set());
  const autoPrintedOrderIdsRef = useRef<Set<string>>(new Set());
  const lastPrinterAlertAtRef = useRef<number>(0);
  const lastAutoStatusAlertAtRef = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);
  const countdownIntervalRef = useRef<TimeoutHandle | null>(null);
  const preOrderNoticeTimeoutRef = useRef<TimeoutHandle | null>(null);
  const appSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const printQueueRef = useRef<Promise<void>>(Promise.resolve());

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

        // 3. Process automatic actions for any order entering live range.
        // Sound is gated later by order channel; print/status automation still applies.
        for (const order of newOrders) {
          const isPendingOrConfirmed =
            order.order_status === 'pending' || order.order_status === 'confirmed';

          if (isPendingOrConfirmed && !processedOrderIdsRef.current.has(order.id)) {
            playAttentionSoundForOrder(order);
            scheduleOrderAnnouncement(order);
          }
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
    setSimulatorOrder,
    showSimulator,
    setShowSimulator,
    printImageUri,
    setPrintImageUri,
    smartpayPaired,
    smartpayProcessingOrderId,
    handleStatusUpdate,
    handlePaymentStatusUpdate,
    handleSmartpayPayment,
    handleQuickAction,
    handlePrint,
    handlePrintImage,
  } = useOrderActions(appSettings, loadOrders, (updated) => {
    if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
  });

  const playAttentionSoundForOrder = (order: Pick<Order, 'id' | 'order_channel' | 'payment_method' | 'customer_name' | 'scheduled_pickup_at'>) => {
    const s = appSettingsRef.current;
    if (!s.soundEnabled) return;
    if (soundedOrderIdsRef.current.has(order.id)) return;
    if (!shouldPlayOrderSound(order)) return;

    soundedOrderIdsRef.current.add(order.id);
    playNewOrderSound({
      soundId: s.soundId,
      repeatCount: s.soundRepeatCount,
      delayMs: 1000,
    });
  };

  const getPrintDelayMs = () => Math.max(2000, (appSettingsRef.current.printerDelayPrintSec || 3) * 1000);

  const scheduleOrderAnnouncement = (order: Pick<Order, 'id' | 'created_at'>) => {
    if (processedOrderIdsRef.current.has(order.id)) return;
    if (pendingAnnouncementTimersRef.current.has(order.id)) return;
    if (announcingOrderIdsRef.current.has(order.id)) return;

    const delayMs = getPrintDelayMs();
    const createdAtMs = new Date(order.created_at).getTime();
    const dueInMs = Number.isFinite(createdAtMs)
      ? Math.max(0, createdAtMs + delayMs - Date.now())
      : delayMs;

    const timer = setTimeout(() => {
      pendingAnnouncementTimersRef.current.delete(order.id);
      fetchAndAnnounceOrder(order.id);
    }, dueInMs);
    pendingAnnouncementTimersRef.current.set(order.id, timer);
  };

  const fetchAndAnnounceOrder = async (orderId: string, attempt = 0) => {
    if (processedOrderIdsRef.current.has(orderId)) return;
    if (announcingOrderIdsRef.current.has(orderId)) return;

    announcingOrderIdsRef.current.add(orderId);
    try {
      const result = await getOrder(orderId);
      const order = result.data;
      const isPrintableStatus =
        order?.order_status === 'pending' || order?.order_status === 'confirmed';

      if (!order || !isPrintableStatus || order.payment_status === 'refunded') {
        processedOrderIdsRef.current.add(orderId);
        return;
      }

      // POS creates the parent order first, then inserts items/add-ons. Fetch after the
      // print delay and retry briefly so the receipt image is based on the complete order.
      if (!order.items || order.items.length === 0) {
        if (attempt < 3) {
          const retryTimer = setTimeout(() => {
            pendingAnnouncementTimersRef.current.delete(orderId);
            fetchAndAnnounceOrder(orderId, attempt + 1);
          }, 1000);
          pendingAnnouncementTimersRef.current.set(orderId, retryTimer);
        }
        return;
      }

      await announceAndPrintOrder(order);
    } finally {
      announcingOrderIdsRef.current.delete(orderId);
    }
  };

  const announceAndPrintOrder = async (order: Order) => {
    if (processedOrderIdsRef.current.has(order.id)) return;
    processedOrderIdsRef.current.add(order.id);

    const latestSettings = await loadAppSettings();
    setAppSettings(latestSettings);
    appSettingsRef.current = latestSettings;

    // 1. Auto-print if enabled
    if ((latestSettings.printerEnabled || latestSettings.printerSimulator) && latestSettings.printerAutoPrint) {
       try {
         // quickPrintOrder handles both simulator and real printing with image capture
         await quickPrintOrder(order, { auto: true });
       } catch (err) {
         console.error('Auto print error:', err);
         processedOrderIdsRef.current.delete(order.id);
       }
       return;
    }

    // 2. Update status to 'preparing' automatically when auto-print is disabled
    if (order.order_status === 'pending' || order.order_status === 'confirmed') {
      try {
        await updateOrderStatus(order.id, 'preparing');
      } catch (err) {
        console.error('Failed to update status to preparing:', err);
      }
    }
  };

  const quickPrintOrder = async (order: Order, options: { auto?: boolean } = {}) => {
    let releasePrintQueue = () => {};

    try {
      const isAutoPrint = Boolean(options.auto);
      let freshOrder = order;

      if (isAutoPrint) {
        if (autoPrintedOrderIdsRef.current.has(order.id) || autoPrintingOrderIdsRef.current.has(order.id)) {
          return;
        }
        autoPrintingOrderIdsRef.current.add(order.id);

        // Re-read settings at print time so a delayed auto-print respects changes
        // made after the timer was scheduled.
        const latestSettings = await loadAppSettings();
        setAppSettings(latestSettings);
        appSettingsRef.current = latestSettings;

        if (!latestSettings.printerAutoPrint || (!latestSettings.printerEnabled && !latestSettings.printerSimulator)) {
          return;
        }

        if (!latestSettings.printerSimulator) {
          const claim = await claimOrderForAutoPrint(order.id);
          if (!claim.claimed) {
            if (claim.error) {
              // Keep auto-print working even if the server-side claim is blocked by
              // permissions or a transient Supabase error. The local in-flight sets
              // still prevent duplicate prints from this mounted screen.
              console.error('Auto print claim failed; printing with local guard only:', claim.error);
            } else {
              return;
            }
          }
        }
      }

      const latestOrderResult = await getOrder(order.id);
      if (latestOrderResult.data) {
        freshOrder = latestOrderResult.data;
        setOrders((prev) => prev.map((item) => (item.id === freshOrder.id ? freshOrder : item)));
        if (selectedOrder?.id === freshOrder.id) {
          setSelectedOrder(freshOrder);
        }
      } else if (latestOrderResult.error) {
        console.warn('[LiveOrders] Failed to refresh order before printing:', latestOrderResult.error);
      }

      const s = appSettingsRef.current;
      setIsCapturing(true);
      setPrintingOrderId(order.id);

      const previousPrint = printQueueRef.current;
      printQueueRef.current = new Promise<void>((resolve) => {
        releasePrintQueue = resolve;
      });
      await previousPrint.catch(() => undefined);
      
      // Update the hidden template with this order
      const printSource = isAutoPrint ? 'live-orders:auto-print' : 'live-orders:manual-list-print';
      setTempPrintingOrder(freshOrder);
      setTempPrintSource(printSource);
      
      // Wait for re-render
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!globalReceiptRef.current) {
        throw new Error('Receipt template ref not found');
      }

      const targetDots = s.printerPaperWidth === '58mm' ? 384 : 576;
      const scale = s.printerHighQuality ? 2 : 1;

      const uri = await captureRef(globalReceiptRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: targetDots * scale,
      });

      if (s.printerSimulator) {
        setSimulatorOrder(freshOrder);
        setPrintImageUri(uri);
        setShowSimulator(true);
        if (isAutoPrint) {
          autoPrintedOrderIdsRef.current.add(order.id);
        }
        return;
      }

      const selected = s.printerSaved.find((p) => p.target === s.printerSelectedTarget) || null;
      if (!s.printerEnabled || !selected) {
        Alert.alert('Printer error', 'Auto-print is enabled, but no printer is selected.');
        return;
      }

      await escposPrintOrderImage(uri, selected, s.printerCopies);
      if (isAutoPrint) {
        autoPrintedOrderIdsRef.current.add(order.id);
      }
    } catch (error) {
      console.error('Quick print failed:', error);
      Alert.alert('Print error', 'Failed to capture receipt template image for printing.');
    } finally {
      releasePrintQueue();
      autoPrintingOrderIdsRef.current.delete(order.id);
      setIsCapturing(false);
      setPrintingOrderId(null);
      // We don't clear tempPrintingOrder immediately to avoid flicker if nested
    }
  };

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
      void loadOrders();
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
          let orderId = (payload.new as any).id;
          const scheduledPickupAt = (payload.new as any)?.scheduled_pickup_at as string | null | undefined;
          const scheduledPickupAtMs = scheduledPickupAt ? new Date(scheduledPickupAt).getTime() : NaN;
          const isPreOrderFarAway = Number.isFinite(scheduledPickupAtMs) && (scheduledPickupAtMs - Date.now()) > (30 * 60 * 1000);

          let isSignificantInsert =
            payload.eventType === 'INSERT' &&
            (payload.new.order_status === 'pending' || payload.new.order_status === 'confirmed');
          let isSignificantUpdate =
            payload.eventType === 'UPDATE' &&
            (
              (
                payload.old.order_status === 'pending_online_payment' &&
                (payload.new.order_status === 'confirmed' || payload.new.order_status === 'accepted')
              ) ||
              (
                payload.old.order_status !== payload.new.order_status &&
                payload.new.order_status === 'confirmed'
              )
            );

          if (isSignificantInsert || isSignificantUpdate) {
            playAttentionSoundForOrder({
              id: orderId,
              order_channel: (payload.new as any)?.order_channel,
              payment_method: (payload.new as any)?.payment_method,
              customer_name: (payload.new as any)?.customer_name,
              scheduled_pickup_at: scheduledPickupAt ?? null,
            });

            if (isPreOrderFarAway) {
              // PRE-ORDER: Set to confirmed and skip printing for now
              const orderNumber = (payload.new as any)?.order_number || orderId;
              setPreOrderSkipNotice(`Pre-order ${orderNumber} received - print skipped`);
              if (preOrderNoticeTimeoutRef.current) clearTimeout(preOrderNoticeTimeoutRef.current);
              preOrderNoticeTimeoutRef.current = setTimeout(() => {
                setPreOrderSkipNotice(null);
              }, 4500);

              if ((payload.new as { order_status?: string })?.order_status === 'pending') {
                await updateOrderStatus(orderId, 'confirmed');
              }
            } else {
              // ASAP or NEARBY pre-order: loadOrders() loop will pick it up and announceAndPrint
              // but we call loadOrders() immediately for responsiveness
            }
          }
          loadOrders();
          fetchPreOrderCount();

          // If it's a new order that needs printing/announcing, schedule the actual
          // print from a fresh order fetch after the configured delay.
          if ((isSignificantInsert || isSignificantUpdate) && !isPreOrderFarAway) {
            scheduleOrderAnnouncement({
              id: orderId,
              created_at: (payload.new as any)?.created_at || new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current);
      pendingAnnouncementTimersRef.current.forEach((timer) => clearTimeout(timer));
      pendingAnnouncementTimersRef.current.clear();
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
  const smartpayProcessingOrder = smartpayProcessingOrderId
    ? orders.find((order) => order.id === smartpayProcessingOrderId) || selectedOrder
    : null;

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

  const handlePaymentStatusUpdateWithTender = (
    orderId: string,
    status: PaymentStatus,
    paymentMethodDetail?: string | null
  ) => {
    if (status === 'paid' && paymentMethodDetail?.toLowerCase() === 'cash') {
      const order = orders.find((item) => item.id === orderId)
        || (selectedOrder?.id === orderId ? selectedOrder : null);
      if (order) {
        setCashTenderOrder(order);
        return;
      }
    }

    void handlePaymentStatusUpdate(orderId, status, paymentMethodDetail);
  };

  const handleOpenOrderFromCustomerModal = async (orderId: string) => {
    setShowCustomerModal(false);
    const result = await getOrder(orderId);
    if (result.error) {
      Alert.alert('Error', result.error);
      return;
    }
    if (result.data) {
      setSelectedOrder(result.data);
      setShowOrderModal(true);
    }
  };

  return (
    <View style={styles.container}>

      {printingOrderId && (
        <View style={styles.printingOverlay} pointerEvents="none">
          <View style={styles.printingChip}>
            <Text style={styles.printingText}>Printing...</Text>
          </View>
        </View>
      )}

      {smartpayProcessingOrder && (
        <View style={styles.smartpayOverlay} pointerEvents="auto">
          <View style={styles.smartpayPanel}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.smartpayTitle}>SmartPay payment</Text>
            <Text style={styles.smartpayText}>Waiting for terminal transaction to finish.</Text>
            <Text style={styles.smartpayAmount}>${smartpayProcessingOrder.total.toFixed(2)}</Text>
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
            onPrintPress={quickPrintOrder}
            onQuickAction={handleQuickAction}
            onSmartpayPayment={handleSmartpayPayment}
            smartpayPaired={smartpayPaired}
            smartpayProcessing={smartpayProcessingOrderId === item.id}
            onStatusUpdate={(order, status) => {
              Alert.alert('Update Status', 'Select new status', [
                { text: 'Confirmed', onPress: () => handleStatusUpdate(order, 'confirmed') },
                { text: 'Preparing', onPress: () => handleStatusUpdate(order, 'preparing') },
                { text: 'Ready', onPress: () => handleStatusUpdate(order, 'ready') },
                { text: 'Completed', onPress: () => handleStatusUpdate(order, 'completed') },
                { text: 'Cancelled', onPress: () => handleStatusUpdate(order, 'cancelled') },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            onPaymentStatusUpdate={(id) => {
              const paymentOptions: Parameters<typeof Alert.alert>[2] = [
                { text: 'Card', onPress: () => handlePaymentStatusUpdate(id, 'paid', 'Card') },
                { text: 'Cash', onPress: () => setCashTenderOrder(item) },
                ...(smartpayPaired ? [{ text: 'SmartPay', onPress: () => handleSmartpayPayment(item) }] : []),
                { text: 'Cancel', style: 'cancel' as const },
              ];
              Alert.alert('Mark as paid', 'Select payment method', paymentOptions);
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
        onPrintImage={handlePrintImage}
        onCustomerPress={handleCustomerPress}
        onStatusUpdate={handleStatusUpdate}
        onPaymentStatusUpdate={handlePaymentStatusUpdateWithTender}
        onSmartpayPayment={handleSmartpayPayment}
        onQuickAction={handleQuickAction}
        updatingStatus={updatingStatus}
        smartpayPaired={smartpayPaired}
        smartpayProcessing={!!selectedOrder && smartpayProcessingOrderId === selectedOrder.id}
        showSimulator={showSimulator}
        setShowSimulator={setShowSimulator}
        simulatorOrder={simulatorOrder}
        printImageUri={printImageUri}
        appSettings={appSettings}
      />

      {/* Global Hidden Receipt Template for auto/quick capture */}
      <View style={styles.hiddenReceiptContainer} pointerEvents="none">
         {tempPrintingOrder && (
           <View ref={globalReceiptRef} collapsable={false}>
              <ReceiptTemplate 
                order={tempPrintingOrder} 
                width={appSettings.printerPaperWidth === '58mm' ? 384 : 576}
                printSource={tempPrintSource || undefined}
                showTicketCounter={appSettings.printerSimulator}
              />
           </View>
         )}
      </View>

      <PrintSimulatorModal
        visible={showSimulator}
        order={simulatorOrder}
        imageUri={printImageUri}
        onClose={() => setShowSimulator(false)}
      />

      <CashTenderModal
        visible={cashTenderOrder !== null}
        total={cashTenderOrder?.total || 0}
        onCancel={() => setCashTenderOrder(null)}
        onConfirm={() => {
          if (!cashTenderOrder) return;
          const orderId = cashTenderOrder.id;
          setCashTenderOrder(null);
          void handlePaymentStatusUpdate(orderId, 'paid', 'Cash');
        }}
      />
      
      <CustomerModal
        visible={showCustomerModal}
        email={customerInfo.email}
        phone={customerInfo.phone}
        onClose={() => setShowCustomerModal(false)}
        onOrderPress={handleOpenOrderFromCustomerModal}
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
    zIndex: 250,
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
  smartpayTitle: { marginTop: 16, fontSize: 18, fontWeight: '800', color: '#111827' },
  smartpayText: { marginTop: 8, fontSize: 14, color: '#4b5563', textAlign: 'center' },
  smartpayAmount: { marginTop: 12, fontSize: 28, fontWeight: '900', color: '#111827' },
});
