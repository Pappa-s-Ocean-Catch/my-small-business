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
  ScrollView,
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
import {
  claimOrderForAutoPrint,
  completeKitchenPrintClaim,
  getAllOrders,
  releaseKitchenPrintClaim,
  updateOrderStatus,
  getOrder,
} from '@/lib/orders';
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
import { buildKitchenReceiptCopies, shouldPlayOrderSound } from '@/utils/orderUtils';
import { getPrintDeviceId } from '@/lib/print-device';

type TimeoutHandle = ReturnType<typeof setTimeout>;
const SECTION_PRINT_DELAY_MS = 1500;
const PRINT_CLAIM_STALE_AFTER_SECONDS = 15;

type FilterKey = 'all' | 'needs-action' | 'unpaid' | 'ready' | 'scheduled';
type GroupKey = 'overdue' | 'due-soon' | 'ready' | 'attention' | 'other';
type ListRow =
  | { type: 'section'; key: string; title: string; count: number }
  | { type: 'order'; key: string; order: Order };

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
  const [tempPrintTicketIndex, setTempPrintTicketIndex] = useState(0);
  const [cashTenderOrder, setCashTenderOrder] = useState<Order | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [headerExpanded, setHeaderExpanded] = useState(false);
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
  const printDeviceIdRef = useRef<string | null>(null);

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
    printImageUris,
    setPrintImageUris,
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

    const latestSettings = await loadAppSettings();
    setAppSettings(latestSettings);
    appSettingsRef.current = latestSettings;

    // 1. Auto-print if enabled
    if ((latestSettings.printerEnabled || latestSettings.printerSimulator) && latestSettings.printerAutoPrint) {
       processedOrderIdsRef.current.add(order.id);
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
      processedOrderIdsRef.current.add(order.id);
      try {
        await updateOrderStatus(order.id, 'preparing');
      } catch (err) {
        console.error('Failed to update status to preparing:', err);
        processedOrderIdsRef.current.delete(order.id);
      }
    }
  };

  const quickPrintOrder = async (order: Order, options: { auto?: boolean } = {}) => {
    let releasePrintQueue = () => {};
    let claimedDeviceId: string | null = null;
    let shouldReleaseClaim = false;

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
          processedOrderIdsRef.current.delete(order.id);
          return;
        }

        if (!printDeviceIdRef.current) {
          printDeviceIdRef.current = await getPrintDeviceId();
        }
        claimedDeviceId = printDeviceIdRef.current;

        const claim = await claimOrderForAutoPrint(order.id, claimedDeviceId, PRINT_CLAIM_STALE_AFTER_SECONDS);
        if (!claim.claimed) {
          if (claim.error) {
            console.error('Auto print claim failed:', claim.error);
            processedOrderIdsRef.current.delete(order.id);
          } else {
            const retryTimer = setTimeout(() => {
              pendingAnnouncementTimersRef.current.delete(order.id);
              processedOrderIdsRef.current.delete(order.id);
              fetchAndAnnounceOrder(order.id);
            }, (PRINT_CLAIM_STALE_AFTER_SECONDS + 5) * 1000);
            pendingAnnouncementTimersRef.current.set(order.id, retryTimer);
          }
          return;
        }
        shouldReleaseClaim = true;
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
      const targetDots = s.printerPaperWidth === '58mm' ? 384 : 576;
      const scale = s.printerHighQuality ? 2 : 1;
      const ticketCopies = isAutoPrint
        ? buildKitchenReceiptCopies(freshOrder.items || [])
        : [{ key: 'combined' }];
      const imageUris: string[] = [];

      for (let ticketIndex = 0; ticketIndex < ticketCopies.length; ticketIndex++) {
        setTempPrintTicketIndex(ticketIndex);
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!globalReceiptRef.current) {
          throw new Error('Receipt template ref not found');
        }

        const uri = await captureRef(globalReceiptRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: targetDots * scale,
        });
        imageUris.push(uri);
      }

      if (s.printerSimulator) {
        setSimulatorOrder(freshOrder);
        setPrintImageUri(imageUris[0] || null);
        setPrintImageUris(imageUris);
        setShowSimulator(true);
        if (isAutoPrint) {
          if (claimedDeviceId) {
            const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
            if (!completion.completed) {
              throw new Error(completion.error || 'Failed to complete kitchen print claim');
            }
            shouldReleaseClaim = false;
          }
          autoPrintedOrderIdsRef.current.add(order.id);
        }
        return;
      }

      const selected = s.printerSaved.find((p) => p.target === s.printerSelectedTarget) || null;
      if (!s.printerEnabled || !selected) {
        if (isAutoPrint) {
          processedOrderIdsRef.current.delete(order.id);
        }
        Alert.alert('Printer error', 'Auto-print is enabled, but no printer is selected.');
        return;
      }

      for (let index = 0; index < imageUris.length; index++) {
        await escposPrintOrderImage(
          imageUris[index],
          selected,
          isAutoPrint ? 1 : s.printerCopies,
          targetDots
        );
        if (index < imageUris.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, SECTION_PRINT_DELAY_MS));
        }
      }
      if (isAutoPrint) {
        if (claimedDeviceId) {
          const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
          if (!completion.completed) {
            throw new Error(completion.error || 'Failed to complete kitchen print claim');
          }
          shouldReleaseClaim = false;
        }
        if (freshOrder.order_status === 'pending' || freshOrder.order_status === 'confirmed') {
          const statusResult = await updateOrderStatus(order.id, 'preparing');
          if (statusResult.error) {
            console.warn('[LiveOrders] Failed to move order to preparing after print:', statusResult.error);
          }
        }
        autoPrintedOrderIdsRef.current.add(order.id);
      }
    } catch (error) {
      console.error('Quick print failed:', error);
      processedOrderIdsRef.current.delete(order.id);
      Alert.alert('Print error', 'Failed to capture receipt template image for printing.');
    } finally {
      if (claimedDeviceId && shouldReleaseClaim) {
        const released = await releaseKitchenPrintClaim(order.id, claimedDeviceId);
        if (released.error) {
          console.error('Failed to release kitchen print claim:', released.error);
        }
      }
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
  const summaryCounts = useMemo(() => {
    let needsAction = 0;
    let unpaid = 0;
    let ready = 0;
    let scheduled = 0;

    for (const order of orders) {
      if (order.payment_status !== 'paid') unpaid += 1;
      if (order.order_status === 'ready') ready += 1;
      if (order.scheduled_pickup_at) scheduled += 1;
      if (
        order.order_status === 'pending'
        || order.order_status === 'confirmed'
        || order.order_status === 'ready'
        || order.payment_status !== 'paid'
      ) {
        needsAction += 1;
      }
    }

    return {
      all: orders.length,
      'needs-action': needsAction,
      unpaid,
      ready,
      scheduled,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    switch (activeFilter) {
      case 'needs-action':
        return orders.filter((order) => (
          order.order_status === 'pending'
          || order.order_status === 'confirmed'
          || order.order_status === 'ready'
          || order.payment_status !== 'paid'
        ));
      case 'unpaid':
        return orders.filter((order) => order.payment_status !== 'paid');
      case 'ready':
        return orders.filter((order) => order.order_status === 'ready');
      case 'scheduled':
        return orders.filter((order) => Boolean(order.scheduled_pickup_at));
      default:
        return orders;
    }
  }, [activeFilter, orders]);

  const groupedRows = useMemo<ListRow[]>(() => {
    const groups: Record<GroupKey, Order[]> = {
      overdue: [],
      'due-soon': [],
      ready: [],
      attention: [],
      other: [],
    };

    for (const order of filteredOrders) {
      const targetTimeMs = new Date(order.scheduled_pickup_at || order.created_at).getTime();
      const diffMinutes = (targetTimeMs - nowMs) / (1000 * 60);

      if (order.order_status === 'ready') {
        groups.ready.push(order);
      } else if (Number.isFinite(diffMinutes) && diffMinutes < 0) {
        groups.overdue.push(order);
      } else if (Number.isFinite(diffMinutes) && diffMinutes <= 10) {
        groups['due-soon'].push(order);
      } else if (
        order.order_status === 'pending'
        || order.order_status === 'confirmed'
        || order.payment_status !== 'paid'
      ) {
        groups.attention.push(order);
      } else {
        groups.other.push(order);
      }
    }

    const defs: Array<{ key: GroupKey; title: string }> = [
      { key: 'overdue', title: 'Overdue' },
      { key: 'due-soon', title: 'Due Soon' },
      { key: 'ready', title: 'Ready' },
      { key: 'attention', title: 'Needs Action' },
      { key: 'other', title: 'Other Live Orders' },
    ];

    const rows: ListRow[] = [];
    for (const def of defs) {
      const items = groups[def.key];
      if (items.length === 0) continue;
      rows.push({ type: 'section', key: `section-${def.key}`, title: def.title, count: items.length });
      items.forEach((order) => {
        rows.push({ type: 'order', key: order.id, order });
      });
    }
    return rows;
  }, [filteredOrders, nowMs]);

  const filterOptions: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all', label: 'All', count: summaryCounts.all },
    { key: 'needs-action', label: 'Needs Action', count: summaryCounts['needs-action'] },
    { key: 'unpaid', label: 'Unpaid', count: summaryCounts.unpaid },
    { key: 'ready', label: 'Ready', count: summaryCounts.ready },
    { key: 'scheduled', label: 'Scheduled', count: summaryCounts.scheduled },
  ];
  const activeFilterOption = filterOptions.find((filter) => filter.key === activeFilter) ?? filterOptions[0];

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
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Live Orders</Text>
            <Text style={styles.headerSubtitle}>
              {summaryCounts.all} active • {isStale ? 'Sync delayed' : refreshCountdown > 0 ? `Refresh in ${refreshCountdown}s` : 'Up to date'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.preOrderBadgeContainer}>
              <PaperButton
                mode="outlined"
                onPress={() => router.push('/pre-orders')}
                style={styles.preOrderButton}
                compact
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
              compact
            >
              Refresh
            </PaperButton>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.headerSummaryBar, headerExpanded ? styles.headerSummaryBarExpanded : null]}
          onPress={() => setHeaderExpanded((current) => !current)}
          activeOpacity={0.8}
        >
          <View style={styles.headerSummaryLeft}>
            <View style={styles.headerSummaryPrimary}>
              <Text style={styles.headerSummaryLabel}>Filter</Text>
              <View style={styles.headerSummaryFilterPill}>
                <Text style={styles.headerSummaryFilterText}>{activeFilterOption.label}</Text>
                <Text style={styles.headerSummaryFilterCount}>{activeFilterOption.count}</Text>
              </View>
            </View>
            <View style={styles.headerSummaryMetrics}>
              <Text style={styles.headerSummaryMetric}>Action {summaryCounts['needs-action']}</Text>
              <Text style={styles.headerSummaryMetric}>Unpaid {summaryCounts.unpaid}</Text>
              <Text style={styles.headerSummaryMetric}>Ready {summaryCounts.ready}</Text>
            </View>
          </View>
          <Text style={styles.headerSummaryToggle}>{headerExpanded ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>

        {headerExpanded && (
          <>
            <View style={styles.headerStatsRow}>
              <View style={styles.headerStatCard}>
                <Text style={styles.headerStatValue}>{summaryCounts['needs-action']}</Text>
                <Text style={styles.headerStatLabel}>Needs action</Text>
              </View>
              <View style={styles.headerStatCard}>
                <Text style={styles.headerStatValue}>{summaryCounts.unpaid}</Text>
                <Text style={styles.headerStatLabel}>Unpaid</Text>
              </View>
              <View style={styles.headerStatCard}>
                <Text style={styles.headerStatValue}>{summaryCounts.ready}</Text>
                <Text style={styles.headerStatLabel}>Ready</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {filterOptions.map((filter) => {
                const selected = filter.key === activeFilter;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    style={[styles.filterChip, selected ? styles.filterChipSelected : null]}
                    onPress={() => setActiveFilter(filter.key)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>
                      {filter.label}
                    </Text>
                    <View style={[styles.filterCount, selected ? styles.filterCountSelected : null]}>
                      <Text style={[styles.filterCountText, selected ? styles.filterCountTextSelected : null]}>
                        {filter.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </Surface>

      <FlatList
        data={groupedRows}
        renderItem={({ item }) => {
          if (item.type === 'section') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>{item.title}</Text>
                <Text style={styles.sectionHeaderCount}>{item.count}</Text>
              </View>
            );
          }

          const order = item.order;
          return (
            <LiveOrderListItem
              order={order}
              nowMs={nowMs}
              updatingStatus={updatingStatus}
              onOrderPress={handleOrderPress}
              onCustomerPress={handleCustomerPress}
              onPrintPress={quickPrintOrder}
              onQuickAction={handleQuickAction}
              onSmartpayPayment={handleSmartpayPayment}
              smartpayPaired={smartpayPaired}
              smartpayProcessing={smartpayProcessingOrderId === order.id}
              onStatusUpdate={(selectedOrder, status) => {
                Alert.alert('Update Status', 'Select new status', [
                  { text: 'Confirmed', onPress: () => handleStatusUpdate(selectedOrder, 'confirmed') },
                  { text: 'Preparing', onPress: () => handleStatusUpdate(selectedOrder, 'preparing') },
                  { text: 'Ready', onPress: () => handleStatusUpdate(selectedOrder, 'ready') },
                  { text: 'Completed', onPress: () => handleStatusUpdate(selectedOrder, 'completed') },
                  { text: 'Cancelled', onPress: () => handleStatusUpdate(selectedOrder, 'cancelled') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
              onPaymentStatusUpdate={(id) => {
                const paymentOptions: Parameters<typeof Alert.alert>[2] = [
                  { text: 'Card', onPress: () => handlePaymentStatusUpdate(id, 'paid', 'Card') },
                  { text: 'Cash', onPress: () => setCashTenderOrder(order) },
                  ...(smartpayPaired ? [{ text: 'SmartPay', onPress: () => handleSmartpayPayment(order) }] : []),
                  { text: 'Cancel', style: 'cancel' as const },
                ];
                Alert.alert('Mark as paid', 'Select payment method', paymentOptions);
              }}
            />
          );
        }}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeFilter === 'all' ? 'No live orders' : 'No orders match this filter'}
            </Text>
          </View>
        }
      />

      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onOrderRefresh={(updatedOrder) => {
          setSelectedOrder(updatedOrder);
          setOrders((prev) => prev.map((item) => (item.id === updatedOrder.id ? updatedOrder : item)));
        }}
        onPrint={handlePrint}
        onPrintImage={handlePrintImage}
        onPrintCustomerCopyImage={handlePrintImage}
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
                onlyTicketIndex={tempPrintTicketIndex}
                duplicateBySections={tempPrintSource === 'live-orders:auto-print'}
              />
           </View>
         )}
      </View>

      <PrintSimulatorModal
        visible={showSimulator && !showOrderModal}
        order={simulatorOrder}
        imageUri={printImageUri}
        imageUris={printImageUris}
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
  header: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5', gap: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  headerTitleWrap: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', flexShrink: 1 },
  headerSubtitle: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  preOrderBadgeContainer: { position: 'relative' },
  preOrderButton: { borderRadius: 8, borderColor: '#2563eb' },
  preOrderBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    fontWeight: 'bold',
  },
  refreshButton: { borderRadius: 8, minWidth: 88 },
  headerSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerSummaryBarExpanded: {
    backgroundColor: '#f3f4f6',
  },
  headerSummaryLeft: {
    flex: 1,
    gap: 6,
  },
  headerSummaryPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerSummaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#6b7280',
  },
  headerSummaryFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  headerSummaryFilterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  headerSummaryFilterCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  headerSummaryMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerSummaryMetric: {
    color: '#4b5563',
    fontSize: 11,
    fontWeight: '700',
  },
  headerSummaryToggle: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  headerStatsRow: { flexDirection: 'row', gap: 8 },
  headerStatCard: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerStatValue: { color: '#111827', fontSize: 16, fontWeight: '900' },
  headerStatLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', marginTop: 2 },
  filterRow: { gap: 8, paddingRight: 12 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
  },
  filterChipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: { color: '#111827', fontSize: 12, fontWeight: '800' },
  filterChipTextSelected: { color: '#fff' },
  filterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountSelected: { backgroundColor: 'rgba(255,255,255,0.18)' },
  filterCountText: { color: '#374151', fontSize: 11, fontWeight: '900' },
  filterCountTextSelected: { color: '#fff' },
  listContent: { padding: 12, paddingBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 6,
  },
  sectionHeaderTitle: { color: '#111827', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  sectionHeaderCount: { color: '#6b7280', fontSize: 12, fontWeight: '800' },
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
