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
  Modal,
} from 'react-native';
import {
  Button as PaperButton,
  Surface,
  Badge,
  Snackbar,
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
import { escposPrintOrderImage, formatPrinterError } from '@/lib/escpos-printer';
import { captureRef } from 'react-native-view-shot';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { buildKitchenReceiptCopies, shouldPlayOrderSound } from '@/utils/orderUtils';
import { getPrintDeviceId } from '@/lib/print-device';
import { getFriendlyOrderNumber } from '@/utils/orderNumber';

type TimeoutHandle = ReturnType<typeof setTimeout>;
const SECTION_PRINT_DELAY_MS = 1500;
const PRINT_CLAIM_STALE_AFTER_SECONDS = 15;

type FilterKey = 'all' | 'needs-action' | 'unpaid' | 'ready' | 'scheduled';
type GroupKey = 'overdue' | 'due-soon' | 'ready' | 'attention' | 'other';
type ListRow =
  | { type: 'section'; key: string; title: string; count: number }
  | { type: 'order'; key: string; order: Order };

type JournalLevel = 'info' | 'decision' | 'success' | 'error';
type JournalEntry = {
  id: string;
  timestamp: number;
  level: JournalLevel;
  scope: string;
  message: string;
  orderId?: string | null;
  orderNumber?: string | null;
  details?: string | null;
};

const JOURNAL_LIMIT = 300;
const RECEIPT_REF_WAIT_MS = 120;
const RECEIPT_REF_MAX_ATTEMPTS = 8;

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
  const [autoPrintToast, setAutoPrintToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalOrderFilter, setJournalOrderFilter] = useState<string>('');
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

  const showAutoPrintToast = useCallback((message: string) => {
    setAutoPrintToast({ visible: true, message });
  }, []);

  const appendJournal = useCallback((entry: Omit<JournalEntry, 'id' | 'timestamp'>) => {
    const nextEntry: JournalEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...entry,
    };
    setJournalEntries((current) => [nextEntry, ...current].slice(0, JOURNAL_LIMIT));
  }, []);

  const logOrderEvent = useCallback((
    level: JournalLevel,
    scope: string,
    message: string,
    options?: { order?: Pick<Order, 'id' | 'order_number'> | null; details?: string | null }
  ) => {
    appendJournal({
      level,
      scope,
      message,
      orderId: options?.order?.id ?? null,
      orderNumber: options?.order?.order_number ?? null,
      details: options?.details ?? null,
    });
  }, [appendJournal]);

  const notifyAutoPrintError = useCallback((order: Pick<Order, 'id' | 'order_number'>, reason: string) => {
    const orderLabel = getFriendlyOrderNumber(order.order_number, order.id);
    showAutoPrintToast(`Auto print failed for ${orderLabel}: ${reason}`);
    logOrderEvent('error', 'auto-print', 'Auto print failed', {
      order,
      details: reason,
    });
  }, [logOrderEvent, showAutoPrintToast]);

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

  const waitForReceiptTemplateRef = useCallback(async () => {
    for (let attempt = 0; attempt < RECEIPT_REF_MAX_ATTEMPTS; attempt++) {
      if (globalReceiptRef.current) {
        return globalReceiptRef.current;
      }
      await new Promise((resolve) => setTimeout(resolve, RECEIPT_REF_WAIT_MS));
    }
    return null;
  }, []);

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
    logOrderEvent('decision', 'scheduler', 'Scheduled order announcement', {
      order,
      details: `Due in ${dueInMs}ms`,
    });
  };

  const fetchAndAnnounceOrder = async (orderId: string, attempt = 0) => {
    if (processedOrderIdsRef.current.has(orderId)) return;
    if (announcingOrderIdsRef.current.has(orderId)) return;

    announcingOrderIdsRef.current.add(orderId);
    logOrderEvent('info', 'scheduler', 'Fetching order for auto workflow', {
      order: { id: orderId, order_number: null },
      details: `Attempt ${attempt + 1}`,
    });
    try {
      const result = await getOrder(orderId);
      const order = result.data;
      const isPrintableStatus =
        order?.order_status === 'pending' || order?.order_status === 'confirmed';

      if (!order || !isPrintableStatus || order.payment_status === 'refunded') {
        processedOrderIdsRef.current.add(orderId);
        logOrderEvent('decision', 'scheduler', 'Skipped auto workflow', {
          order: order ? { id: order.id, order_number: order.order_number } : { id: orderId, order_number: null },
          details: !order
            ? result.error || 'Order not found'
            : `Status=${order.order_status}, payment=${order.payment_status}`,
        });
        return;
      }

      // POS creates the parent order first, then inserts items/add-ons. Fetch after the
      // print delay and retry briefly so the receipt image is based on the complete order.
      if (!order.items || order.items.length === 0) {
        if (attempt < 3) {
          logOrderEvent('decision', 'scheduler', 'Retrying because order items are not ready yet', {
            order,
            details: `Retry ${attempt + 2} scheduled in 1000ms`,
          });
          const retryTimer = setTimeout(() => {
            pendingAnnouncementTimersRef.current.delete(orderId);
            fetchAndAnnounceOrder(orderId, attempt + 1);
          }, 1000);
          pendingAnnouncementTimersRef.current.set(orderId, retryTimer);
        } else {
          logOrderEvent('error', 'scheduler', 'Order items still missing after retries', {
            order,
            details: 'Auto workflow stopped before printing',
          });
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
       logOrderEvent('decision', 'auto-print', 'Starting auto-print workflow', {
         order,
         details: latestSettings.printerSimulator ? 'Simulator mode enabled' : 'Printer mode enabled',
       });
       try {
         // quickPrintOrder handles both simulator and real printing with image capture
         await quickPrintOrder(order, { auto: true });
       } catch (err) {
         console.error('Auto print error:', err);
         processedOrderIdsRef.current.delete(order.id);
         notifyAutoPrintError(order, formatPrinterError(err));
       }
       return;
    }
    logOrderEvent('decision', 'auto-print', 'Skipped auto-print workflow on this POS', {
      order,
      details: 'Auto-print is disabled or no printer capability is enabled on this device',
    });
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
          logOrderEvent('decision', 'auto-print', 'Skipped because this POS already handled the order', {
            order,
          });
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
          logOrderEvent('decision', 'auto-print', 'Cancelled auto-print because settings changed', {
            order,
          });
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
            notifyAutoPrintError(order, claim.error);
          } else {
            logOrderEvent('decision', 'claim', 'Another POS currently owns the print claim', {
              order,
              details: `Retrying in ${(PRINT_CLAIM_STALE_AFTER_SECONDS + 5) * 1000}ms`,
            });
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
        logOrderEvent('success', 'claim', 'Claimed order for auto-print', {
          order,
          details: `Device ${claimedDeviceId}`,
        });
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
        logOrderEvent('error', 'auto-print', 'Failed to refresh latest order before printing', {
          order,
          details: latestOrderResult.error,
        });
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

        const receiptRef = await waitForReceiptTemplateRef();
        if (!receiptRef) {
          logOrderEvent('error', 'print', 'Receipt template ref was not ready for capture', {
            order: freshOrder,
            details: `Waited ${RECEIPT_REF_WAIT_MS * RECEIPT_REF_MAX_ATTEMPTS}ms before capture`,
          });
          throw new Error('Receipt template is still loading. Please try again.');
        }

        const uri = await captureRef(receiptRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: targetDots * scale,
        });
        imageUris.push(uri);
      }

      if (s.printerSimulator) {
        logOrderEvent('decision', 'print', 'Using print simulator', {
          order: freshOrder,
          details: `${imageUris.length} receipt image(s) prepared`,
        });
        setSimulatorOrder(freshOrder);
        setPrintImageUri(imageUris[0] || null);
        setPrintImageUris(imageUris);
        setShowSimulator(true);
      } else {
        const selected = s.printerSaved.find((p) => p.target === s.printerSelectedTarget) || null;
        if (!s.printerEnabled || !selected) {
          if (isAutoPrint) {
            processedOrderIdsRef.current.delete(order.id);
          }
          const message = 'Auto-print is enabled, but no printer is selected.';
          if (isAutoPrint) {
            notifyAutoPrintError(order, message);
          } else {
            Alert.alert('Printer error', message);
          }
          return;
        }

        logOrderEvent('info', 'print', 'Sending receipt image(s) to printer', {
          order: freshOrder,
          details: `${imageUris.length} image(s) to ${selected.deviceName} (${selected.ipAddress || selected.target})`,
        });

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
      }

      if (isAutoPrint) {
        if (freshOrder.order_status === 'pending' || freshOrder.order_status === 'confirmed') {
          const statusResult = await updateOrderStatus(order.id, 'preparing');
          if (statusResult.error) {
            console.warn('[LiveOrders] Failed to move order to preparing after print:', statusResult.error);
            const now = Date.now();
            if (now - lastAutoStatusAlertAtRef.current > 4000) {
              lastAutoStatusAlertAtRef.current = now;
              showAutoPrintToast(`Printed order, but auto status update failed: ${statusResult.error}`);
            }
          } else {
            logOrderEvent('success', 'status', 'Moved order to preparing after auto-print', {
              order: freshOrder,
            });
          }
        }
        if (claimedDeviceId) {
          const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
          if (!completion.completed) {
            throw new Error(completion.error || 'Failed to complete kitchen print claim');
          }
          shouldReleaseClaim = false;
          logOrderEvent('success', 'claim', 'Completed print claim', {
            order: freshOrder,
            details: `Device ${claimedDeviceId}`,
          });
        }
        autoPrintedOrderIdsRef.current.add(order.id);
        logOrderEvent('success', 'print', 'Auto-print workflow completed', {
          order: freshOrder,
          details: `${imageUris.length} receipt image(s) processed`,
        });
      }
    } catch (error) {
      console.error('Quick print failed:', error);
      processedOrderIdsRef.current.delete(order.id);
      const message = formatPrinterError(error) || 'Failed to print order.';
      if (options.auto) {
        notifyAutoPrintError(order, message);
      } else {
        Alert.alert('Print error', message);
      }
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

          logOrderEvent('info', 'realtime', `Received ${payload.eventType.toLowerCase()} event`, {
            order: { id: orderId, order_number: (payload.new as any)?.order_number ?? null },
            details: `status ${(payload.old as any)?.order_status ?? '-'} -> ${(payload.new as any)?.order_status ?? '-'}, payment ${(payload.new as any)?.payment_status ?? '-'}`,
          });

          if (isSignificantInsert || isSignificantUpdate) {
            playAttentionSoundForOrder({
              id: orderId,
              order_channel: (payload.new as any)?.order_channel,
              payment_method: (payload.new as any)?.payment_method,
              customer_name: (payload.new as any)?.customer_name,
              scheduled_pickup_at: scheduledPickupAt ?? null,
            });

            if (isPreOrderFarAway) {
              logOrderEvent('decision', 'realtime', 'Pre-order outside live window, skipping print for now', {
                order: { id: orderId, order_number: (payload.new as any)?.order_number ?? null },
                details: scheduledPickupAt ?? 'No scheduled pickup time',
              });
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

  const groupedSections = useMemo(() => {
    const sections: Array<{ key: string; title: string; count: number; orders: Order[] }> = [];
    let currentSection: { key: string; title: string; count: number; orders: Order[] } | null = null;

    for (const row of groupedRows) {
      if (row.type === 'section') {
        currentSection = { key: row.key, title: row.title, count: row.count, orders: [] };
        sections.push(currentSection);
      } else if (currentSection) {
        currentSection.orders.push(row.order);
      }
    }

    return sections;
  }, [groupedRows]);

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
    setJournalOrderFilter(order.id);
    logOrderEvent('info', 'ui', 'Opened order detail from live list', {
      order,
    });
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

  const selectedJournalOrderId = selectedOrder?.id ?? '';
  const effectiveJournalFilter = journalOrderFilter.trim() || selectedJournalOrderId;
  const isVerticalCardLayout = appSettings.liveOrderCardLayout === 'vertical';
  const filteredJournalEntries = useMemo(() => {
    if (!effectiveJournalFilter) return journalEntries;
    return journalEntries.filter((entry) => (
      entry.orderId?.toLowerCase().includes(effectiveJournalFilter.toLowerCase())
      || getFriendlyOrderNumber(entry.orderNumber, entry.orderId || '').toLowerCase().includes(effectiveJournalFilter.toLowerCase())
    ));
  }, [effectiveJournalFilter, journalEntries]);

  const formatJournalTime = (timestamp: number) => (
    new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );

  const getJournalLevelStyle = (level: JournalLevel) => {
    switch (level) {
      case 'success':
        return styles.journalLevel_success;
      case 'error':
        return styles.journalLevel_error;
      case 'decision':
        return styles.journalLevel_decision;
      default:
        return styles.journalLevel_info;
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
              mode={headerExpanded ? 'contained-tonal' : 'outlined'}
              onPress={() => setHeaderExpanded((current) => !current)}
              style={styles.filterToggleButton}
              compact
              icon="filter-variant"
            >
              {activeFilterOption.label}
            </PaperButton>
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

        {headerExpanded && (
          <>
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

      {isVerticalCardLayout ? (
        <ScrollView
          contentContainerStyle={styles.verticalListContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {groupedSections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeFilter === 'all' ? 'No live orders' : 'No orders match this filter'}
              </Text>
            </View>
          ) : (
            groupedSections.map((section) => (
              <View key={section.key} style={styles.verticalSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                  <Text style={styles.sectionHeaderCount}>{section.count}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.verticalSectionRail}
                >
                  {section.orders.map((order) => (
                    <LiveOrderListItem
                      key={order.id}
                      order={order}
                      nowMs={nowMs}
                      updatingStatus={updatingStatus}
                      layout="vertical"
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
                  ))}
                </ScrollView>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
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
                layout="horizontal"
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
      )}

      <TouchableOpacity
        style={styles.debugFab}
        onPress={() => {
          if (selectedOrder?.id) {
            setJournalOrderFilter(selectedOrder.id);
          }
          setShowJournalModal(true);
        }}
      >
        <Text style={styles.debugFabLabel}>Debug</Text>
        <Text style={styles.debugFabCount}>{journalEntries.length}</Text>
      </TouchableOpacity>

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

      <Modal
        visible={showJournalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJournalModal(false)}
      >
        <View style={styles.journalBackdrop}>
          <View style={styles.journalModal}>
            <View style={styles.journalHeader}>
              <View style={styles.journalHeaderText}>
                <Text style={styles.journalTitle}>Live Screen Debug Journal</Text>
                <Text style={styles.journalSubtitle}>
                  {filteredJournalEntries.length} entries
                  {effectiveJournalFilter ? ` for ${effectiveJournalFilter}` : ' across all orders'}
                </Text>
              </View>
              <PaperButton mode="text" onPress={() => setShowJournalModal(false)}>
                Close
              </PaperButton>
            </View>

            <View style={styles.journalActions}>
              <TouchableOpacity
                style={[styles.journalChip, !journalOrderFilter && !selectedJournalOrderId ? styles.journalChipActive : null]}
                onPress={() => setJournalOrderFilter('')}
              >
                <Text style={[styles.journalChipText, !journalOrderFilter && !selectedJournalOrderId ? styles.journalChipTextActive : null]}>
                  All orders
                </Text>
              </TouchableOpacity>
              {selectedJournalOrderId ? (
                <TouchableOpacity
                  style={[styles.journalChip, effectiveJournalFilter === selectedJournalOrderId ? styles.journalChipActive : null]}
                  onPress={() => setJournalOrderFilter(selectedJournalOrderId)}
                >
                  <Text style={[styles.journalChipText, effectiveJournalFilter === selectedJournalOrderId ? styles.journalChipTextActive : null]}>
                    Selected order
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.journalChip}
                onPress={() => setJournalEntries([])}
              >
                <Text style={styles.journalChipText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.journalFilterRow}>
              <TouchableOpacity
                style={styles.journalFilterPill}
                onPress={() => setJournalOrderFilter(selectedJournalOrderId || '')}
              >
                <Text style={styles.journalFilterPillText}>
                  Filter: {effectiveJournalFilter || 'All'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <ScrollView style={styles.journalScroll} contentContainerStyle={styles.journalScrollContent}>
              {filteredJournalEntries.length === 0 ? (
                <Text style={styles.journalEmpty}>No journal entries yet for this filter.</Text>
              ) : (
                filteredJournalEntries.map((entry) => {
                  const orderLabel = entry.orderId
                    ? getFriendlyOrderNumber(entry.orderNumber, entry.orderId)
                    : null;
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.journalEntry}
                      onPress={() => {
                        if (entry.orderId) setJournalOrderFilter(entry.orderId);
                      }}
                    >
                      <View style={styles.journalEntryTop}>
                        <Text style={[styles.journalLevel, getJournalLevelStyle(entry.level)]}>
                          {entry.level.toUpperCase()}
                        </Text>
                        <Text style={styles.journalTime}>{formatJournalTime(entry.timestamp)}</Text>
                      </View>
                      <Text style={styles.journalScope}>{entry.scope}</Text>
                      <Text style={styles.journalMessage}>{entry.message}</Text>
                      {orderLabel ? (
                        <Text style={styles.journalOrder}>Order: {orderLabel}</Text>
                      ) : null}
                      {entry.details ? (
                        <Text style={styles.journalDetails}>{entry.details}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Snackbar
        visible={autoPrintToast.visible}
        onDismiss={() => setAutoPrintToast((current) => ({ ...current, visible: false }))}
        duration={5000}
        action={{
          label: 'Dismiss',
          onPress: () => setAutoPrintToast((current) => ({ ...current, visible: false })),
        }}
        style={styles.snackbar}
      >
        {autoPrintToast.message}
      </Snackbar>
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
  headerActions: { flexDirection: 'row', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  preOrderBadgeContainer: { position: 'relative' },
  preOrderButton: { borderRadius: 8, borderColor: '#2563eb' },
  filterToggleButton: { borderRadius: 8 },
  preOrderBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    fontWeight: 'bold',
  },
  refreshButton: { borderRadius: 8, minWidth: 88 },
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
  verticalListContent: { padding: 12, paddingBottom: 20, gap: 12 },
  verticalSection: { gap: 8 },
  verticalSectionRail: { paddingRight: 12 },
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
  debugFab: {
    position: 'absolute',
    right: 16,
    bottom: 88,
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 180,
    shadowColor: '#111827',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  debugFabLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  debugFabCount: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  journalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  journalModal: {
    maxHeight: '85%',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  journalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  journalHeaderText: {
    flex: 1,
  },
  journalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  journalSubtitle: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  journalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  journalChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  journalChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  journalChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
  },
  journalChipTextActive: {
    color: '#fff',
  },
  journalFilterRow: {
    paddingVertical: 10,
  },
  journalFilterPill: {
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  journalFilterPillText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '800',
  },
  journalScroll: {
    marginTop: 4,
  },
  journalScrollContent: {
    gap: 10,
    paddingBottom: 12,
  },
  journalEmpty: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  journalEntry: {
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 5,
  },
  journalEntryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  journalLevel: {
    fontSize: 11,
    fontWeight: '900',
  },
  journalLevel_info: {
    color: '#2563eb',
  },
  journalLevel_decision: {
    color: '#7c3aed',
  },
  journalLevel_success: {
    color: '#059669',
  },
  journalLevel_error: {
    color: '#dc2626',
  },
  journalTime: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  journalScope: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  journalMessage: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  journalOrder: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  journalDetails: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
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
  snackbar: {
    backgroundColor: '#111827',
  },
});
