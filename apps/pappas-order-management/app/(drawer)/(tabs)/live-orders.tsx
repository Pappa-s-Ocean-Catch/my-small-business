import { useState, useEffect, useMemo, useRef } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import {
  Button as PaperButton,
  Surface,
  Badge,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getOrder,
  refreshDeliveryStatus,
} from '@/lib/orders';
import type { Order, PaymentStatus } from '@my-small-business/types';
import { DEFAULT_APP_SETTINGS, loadAppSettings } from '@/lib/settings';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { KitchenAlertOverlay } from '@/lib/KitchenAlertOverlay';
import { CustomerModal } from '@/components/CustomerModal';
import { LiveOrderListItem } from '@/components/LiveOrderListItem';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { CashTenderModal } from '@/components/CashTenderModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { formatPrinterError, isSimulatorPrinter, type SavedPrinter } from '@/lib/escpos-printer';
import { buildSectionPrintJobs, hasAnySimulatorAssignment } from '@/lib/printer-routing';
import { captureReceiptForPrinter, captureReceiptPreview, type PrinterImageSource } from '@/lib/printer-image';
import { enqueuePreparedPrintJobs, waitForPrintJobs } from '@/lib/print-queue';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { CustomerReceiptTemplate } from '@/components/CustomerReceiptTemplate';
import { JournalLogsModal } from '@/components/PrintLogsModal';
import { isScheduledPreOrder } from '@/utils/orderUtils';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
import { JOURNAL_LOGS_ENABLED } from '@/lib/journal-config';
import { getPrintDeviceId } from '@/lib/print-device';
import { shouldUseLiveOrderCardRail, shouldUseVerticalLiveOrderCards } from '@/lib/live-orders-layout';
import { isCompactPhoneWidth } from '@/lib/responsive';
import {
  buildKitchenPrintDebugContext,
  createPrintDebugSessionId,
  type KitchenPrintDebugContext,
} from '@/lib/print-debug-footer';
import {
  LIVE_ORDERS_QUERY_KEY,
  useLiveOrdersQuery,
  usePreOrderCountQuery,
} from '@/hooks/useLiveOrdersQuery';

type TimeoutHandle = ReturnType<typeof setTimeout>;
const RECEIPT_RENDER_SETTLE_MS = 300;
const RECEIPT_RENDER_FRAME_COUNT = 2;

type FilterKey = 'all' | 'needs-action' | 'unpaid' | 'ready' | 'scheduled';
type GroupKey = 'overdue' | 'due-soon' | 'ready' | 'on-the-way' | 'attention' | 'other';
type ListRow =
  | { type: 'section'; key: string; title: string; count: number }
  | { type: 'order'; key: string; order: Order };

const RECEIPT_REF_WAIT_MS = 120;
const RECEIPT_REF_MAX_ATTEMPTS = 8;
const DELIVERY_STATUS_SYNC_INTERVAL_MS = 10_000;

export default function LiveOrdersScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ email?: string; phone?: string }>({});
  const [tempPrintingOrder, setTempPrintingOrder] = useState<Order | null>(null);
  const [tempPrintSource, setTempPrintSource] = useState<string | null>(null);
  const [tempPrintTicketIndex, setTempPrintTicketIndex] = useState(0);
  const [tempPrintDuplicateBySections, setTempPrintDuplicateBySections] = useState(false);
  const [tempPrintTemplate, setTempPrintTemplate] = useState<'kitchen' | 'customer-copy'>('kitchen');
  const [tempPrintDebugContext, setTempPrintDebugContext] = useState<KitchenPrintDebugContext | null>(null);
  const [cashTenderOrder, setCashTenderOrder] = useState<Order | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [showPrintLogs, setShowPrintLogs] = useState(false);
  const [refreshingDeliveryIds, setRefreshingDeliveryIds] = useState<string[]>([]);
  const globalReceiptRef = useRef(null);
  const lastDeliverySyncAtRef = useRef(0);
  const printDeviceIdRef = useRef<string | null>(null);

  const queryClient = useQueryClient();
  const countdownIntervalRef = useRef<TimeoutHandle | null>(null);
  const preOrderSkipNotice = usePrinterAutomationStore((state) => state.preOrderSkipNotice);
  const addJournalEntry = usePrinterAutomationStore((state) => state.addJournalEntry);
  const journalEntries = usePrinterAutomationStore((state) => state.journalEntries);
  const orderPrintStates = usePrinterAutomationStore((state) => state.orderPrintStates);
  const {
    data: orders = [],
    isLoading: loading,
    error: liveOrdersError,
    refetch: refetchOrders,
    isFetching: isFetchingOrders,
    dataUpdatedAt,
  } = useLiveOrdersQuery();
  const { data: preOrderCount = 0 } = usePreOrderCountQuery();
  const { data: appSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
  const loadError = liveOrdersError instanceof Error ? liveOrdersError.message : null;
  const appSettingsRef = useRef(appSettings);

  const logOrderEvent = (
    level: 'info' | 'decision' | 'success' | 'error',
    scope: string,
    message: string,
    options?: { order?: { id: string; order_number?: string | null } | null; details?: string | null }
  ) => {
    addJournalEntry({
      level,
      scope,
      message,
      orderId: options?.order?.id ?? null,
      orderNumber: options?.order?.order_number ?? null,
      details: options?.details ?? null,
    });
  };

  const formatDurationMs = (startedAt: number): string => `${Date.now() - startedAt}ms`;

  const loadOrders = async () => {
    try {
      const result = await refetchOrders();
      if (result.error) {
        Alert.alert('Error', result.error.message);
      } else if (result.data) {
        lastDeliverySyncAtRef.current = Date.now();
        void syncDeliveryStatuses(result.data);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const syncDeliveryStatuses = async (sourceOrders: Order[]) => {
    const deliveryOrders = sourceOrders.filter((order) => (
      order.order_type === 'delivery' && !!order.delivery_provider_id
    ));

    if (deliveryOrders.length === 0) return;

    const ids = deliveryOrders.map((order) => order.id);
    setRefreshingDeliveryIds((current) => Array.from(new Set([...current, ...ids])));

    try {
      const results = await Promise.all(deliveryOrders.map((order) => refreshDeliveryStatus(order.id)));
      const updatedOrders = results
        .map((result) => result.data)
        .filter((order): order is Order => !!order);

      if (updatedOrders.length > 0) {
        const updatedById = new Map(updatedOrders.map((order) => [order.id, order]));
        queryClient.setQueryData<Order[]>(LIVE_ORDERS_QUERY_KEY, (prev = []) => (
          prev.map((order) => updatedById.get(order.id) || order)
        ));

        if (selectedOrder) {
          const nextSelected = updatedById.get(selectedOrder.id);
          if (nextSelected) setSelectedOrder(nextSelected);
        }
      }
    } finally {
      setRefreshingDeliveryIds((current) => current.filter((id) => !ids.includes(id)));
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
    printImageLabels,
    setPrintImageLabels,
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

  const waitForReceiptTemplateRef = useRef(async () => {
    for (let attempt = 0; attempt < RECEIPT_REF_MAX_ATTEMPTS; attempt++) {
      if (globalReceiptRef.current) {
        return globalReceiptRef.current;
      }
      await new Promise((resolve) => setTimeout(resolve, RECEIPT_REF_WAIT_MS));
    }
    return null;
  });

  const waitForReceiptRenderFrames = async (frameCount: number = RECEIPT_RENDER_FRAME_COUNT) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  };

  const quickPrintOrder = async (order: Order, selectedPrinter?: SavedPrinter | null) => {
    const workflowStartedAt = Date.now();

    try {
      let freshOrder = order;

      const latestOrderResult = await getOrder(order.id);
      if (latestOrderResult.data) {
        freshOrder = latestOrderResult.data;
        queryClient.setQueryData<Order[]>(LIVE_ORDERS_QUERY_KEY, (prev = []) => (
          prev.map((item) => (item.id === freshOrder.id ? freshOrder : item))
        ));
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

      const s = await loadAppSettings().catch(() => appSettingsRef.current);
      appSettingsRef.current = s;
      if (!printDeviceIdRef.current) {
        printDeviceIdRef.current = await getPrintDeviceId().catch(() => 'unknown');
      }
      const printSessionId = createPrintDebugSessionId();
      const printSettingsDetails = [
        `simulator=${String(hasAnySimulatorAssignment(s))}`,
        `printerEnabled=${String(s.printerEnabled)}`,
        `defaultTarget=${s.printerSelectedTarget ?? 'none'}`,
        `savedPrinters=${s.printerSaved.length}`,
        `sectionRules=${s.printerSectionAssignments.length}`,
      ].join(', ');
      logOrderEvent('info', 'print', 'Resolved manual print settings', {
        order: freshOrder,
        details: printSettingsDetails,
      });
      setPrintingOrderId(order.id);

      logOrderEvent('info', 'print', 'Manual print queue acquired', {
        order: freshOrder,
        details: `driver=${selectedPrinter ? selectedPrinter.driver ?? 'epsonSdk' : 'section-routing'}`,
      });
      
      // Update the hidden template with this order
      setTempPrintingOrder(freshOrder);
      setTempPrintSource('live-orders:manual-list-print');
      setTempPrintTemplate('kitchen');
      const targetDots = s.printerPaperWidth === '58mm' ? 384 : 576;
      const scale = s.printerHighQuality ? 2 : 1;
      if (selectedPrinter) {
        setTempPrintTicketIndex(0);
        setTempPrintDuplicateBySections(false);
        setTempPrintDebugContext(buildKitchenPrintDebugContext({
          enabled: s.printerDebugFooter,
          registerName: s.registerName,
          deviceId: printDeviceIdRef.current,
          sessionId: printSessionId,
          trigger: 'manual',
          routeLabel: `Manual -> ${selectedPrinter.deviceName}`,
          sectionName: 'All',
          printerName: selectedPrinter.deviceName,
          printerTarget: selectedPrinter.target,
          printMode: 'combine',
          copies: 1,
          autoPrintEnabled: s.printerAutoPrint,
          autoPrintDelaySeconds: s.printerDelayPrintSec,
          paperWidth: s.printerPaperWidth,
          highQuality: s.printerHighQuality,
          capturedAt: new Date().toISOString(),
        }));
        const prepStartedAt = Date.now();
        await new Promise((resolve) => setTimeout(resolve, RECEIPT_RENDER_SETTLE_MS));
        logOrderEvent('info', 'print', 'Prepared receipt template for direct printer', {
          order: freshOrder,
          details: `renderSettle=${formatDurationMs(prepStartedAt)} printer=${selectedPrinter.deviceName}`,
        });

        const refWaitStartedAt = Date.now();
        const receiptRef = await waitForReceiptTemplateRef.current();
        if (!receiptRef) {
          throw new Error('Receipt template is still loading. Please try again.');
        }
        logOrderEvent('info', 'print', 'Receipt template ref resolved for direct printer', {
          order: freshOrder,
          details: `wait=${formatDurationMs(refWaitStartedAt)}`,
        });

        if (isSimulatorPrinter(selectedPrinter)) {
          const captureStartedAt = Date.now();
          const uri = await captureReceiptPreview(receiptRef, targetDots * scale);
          logOrderEvent('info', 'print', 'Captured simulator preview for direct printer', {
            order: freshOrder,
            details: `capture=${formatDurationMs(captureStartedAt)} width=${targetDots * scale}`,
          });
          setSimulatorOrder(freshOrder);
          setPrintImageUri(uri);
          setPrintImageUris([uri]);
          setPrintImageLabels([selectedPrinter.deviceName]);
          setShowSimulator(true);
          logOrderEvent('success', 'print', 'Manual print opened in simulator', {
            order: freshOrder,
            details: `printer=${selectedPrinter.deviceName}`,
          });
          return;
        }

        const captureStartedAt = Date.now();
        const image = await captureReceiptForPrinter(receiptRef, selectedPrinter, targetDots * scale, s.printerHighQuality);
        logOrderEvent('info', 'print', 'Captured receipt image for direct printer', {
          order: freshOrder,
          details: `capture=${formatDurationMs(captureStartedAt)} width=${targetDots * scale}`,
        });

        if (!s.printerEnabled) {
          Alert.alert('Printer error', `No printer is selected. ${printSettingsDetails}`);
          return;
        }

        const queuedJobs = enqueuePreparedPrintJobs({
          order: freshOrder,
          source: 'manual',
          scope: 'live-orders:manual-direct',
          jobs: [{
            image,
            printer: selectedPrinter,
            width: targetDots,
            label: selectedPrinter.deviceName,
          }],
        });
        const queueResult = await waitForPrintJobs(queuedJobs.map((job) => job.id));
        if (!queueResult.success) {
          throw new Error(queueResult.failedJobs[0]?.error || 'Queued print job failed');
        }
        logOrderEvent('success', 'print', 'Manual print sent to direct printer', {
          order: freshOrder,
          details: `queuedJobs=${queuedJobs.length} total=${formatDurationMs(workflowStartedAt)} printer=${selectedPrinter.deviceName}`,
        });
        return;
      }

      const jobs = buildSectionPrintJobs(s, freshOrder);
      const capturedJobs: Array<{ image: PrinterImageSource; previewUri: string | null; label: string; printer: NonNullable<ReturnType<typeof buildSectionPrintJobs>[number]['printer']> | null }> = [];
      for (let index = 0; index < jobs.length; index += 1) {
        const job = jobs[index];
        const jobStartedAt = Date.now();
        setTempPrintTicketIndex(job.onlyTicketIndex ?? 0);
        setTempPrintDuplicateBySections(job.duplicateBySections);
        setTempPrintTemplate(job.template);
        setTempPrintDebugContext(buildKitchenPrintDebugContext({
          enabled: s.printerDebugFooter,
          registerName: s.registerName,
          deviceId: printDeviceIdRef.current,
          sessionId: printSessionId,
          trigger: 'manual',
          routeLabel: job.label,
          sectionName: job.sectionName,
          printerName: job.printer?.deviceName,
          printerTarget: job.printer?.target,
          printMode: job.printMode,
          copies: 1,
          autoPrintEnabled: s.printerAutoPrint,
          autoPrintDelaySeconds: s.printerDelayPrintSec,
          paperWidth: s.printerPaperWidth,
          highQuality: s.printerHighQuality,
          capturedAt: new Date().toISOString(),
        }));
        if (index === 0) {
          await new Promise((resolve) => setTimeout(resolve, RECEIPT_RENDER_SETTLE_MS));
        } else {
          await waitForReceiptRenderFrames();
        }
        logOrderEvent('info', 'print', 'Prepared receipt template for routed print job', {
          order: freshOrder,
          details: `job=${job.label} renderSettle=${formatDurationMs(jobStartedAt)} mode=${index === 0 ? 'initial-wait' : 'frame-sync'}`,
        });

        const refWaitStartedAt = Date.now();
        const receiptRef = await waitForReceiptTemplateRef.current();
        if (!receiptRef) {
          logOrderEvent('error', 'print', 'Receipt template ref was not ready for capture', {
            order: freshOrder,
            details: `Waited ${RECEIPT_REF_WAIT_MS * RECEIPT_REF_MAX_ATTEMPTS}ms before capture`,
          });
          throw new Error('Receipt template is still loading. Please try again.');
        }
        logOrderEvent('info', 'print', 'Receipt template ref resolved for routed print job', {
          order: freshOrder,
          details: `job=${job.label} wait=${formatDurationMs(refWaitStartedAt)}`,
        });

        if (!job.printer || isSimulatorPrinter(job.printer)) {
          const captureStartedAt = Date.now();
          const uri = await captureReceiptPreview(receiptRef, targetDots * scale);
          logOrderEvent('info', 'print', 'Captured simulator preview for routed print job', {
            order: freshOrder,
            details: `job=${job.label} capture=${formatDurationMs(captureStartedAt)} width=${targetDots * scale}`,
          });
          capturedJobs.push({ image: { kind: 'uri', uri }, previewUri: uri, label: job.label, printer: job.printer });
        } else {
          const captureStartedAt = Date.now();
          const image = await captureReceiptForPrinter(receiptRef, job.printer, targetDots * scale, s.printerHighQuality);
          const previewUri = image.kind === 'uri' ? image.uri : await captureReceiptPreview(receiptRef, targetDots * scale);
          logOrderEvent('info', 'print', 'Captured receipt image for routed print job', {
            order: freshOrder,
            details: `job=${job.label} capture=${formatDurationMs(captureStartedAt)} printer=${job.printer.deviceName} driver=${job.printer.driver ?? 'epsonSdk'}`,
          });
          capturedJobs.push({ image, previewUri, label: job.label, printer: job.printer });
        }
      }

      const simulatorImageUris: string[] = [];
      const simulatorImageLabels: string[] = [];
      const printerJobs: Array<{ image: PrinterImageSource; printer: NonNullable<typeof capturedJobs[number]['printer']> }> = [];
      for (const job of capturedJobs) {
        if (isSimulatorPrinter(job.printer)) {
          if (job.previewUri) simulatorImageUris.push(job.previewUri);
          simulatorImageLabels.push(job.label);
        } else {
          if (job.printer) {
            printerJobs.push({ image: job.image, printer: job.printer });
          }
        }
      }

      if (simulatorImageUris.length > 0) {
        logOrderEvent('decision', 'print', 'Using print simulator', {
          order: freshOrder,
          details: `${simulatorImageUris.length} receipt image(s) prepared • ${printSettingsDetails}`,
        });
        setSimulatorOrder(freshOrder);
        setPrintImageUri(simulatorImageUris[0] || null);
        setPrintImageUris(simulatorImageUris);
        setPrintImageLabels(simulatorImageLabels);
        setShowSimulator(true);
      }

      if (printerJobs.length > 0) {
        if (!s.printerEnabled) {
        const message = `No printer is selected. ${printSettingsDetails}`;
          logOrderEvent('error', 'print', 'Manual print blocked because no printer was resolved', {
            order: freshOrder,
            details: printSettingsDetails,
          });
          Alert.alert('Printer error', message);
          return;
        }

        logOrderEvent('info', 'print', 'Sending receipt image(s) to printer', {
          order: freshOrder,
          details: `${printerJobs.length} image(s) using section printer routing`,
        });

        const queuedJobs = enqueuePreparedPrintJobs({
          order: freshOrder,
          source: 'manual',
          scope: 'live-orders:manual-routed',
          jobs: printerJobs.map((job) => ({
            image: job.image,
            printer: job.printer,
            width: targetDots,
            label: job.printer.deviceName,
          })),
        });
        const queueResult = await waitForPrintJobs(queuedJobs.map((job) => job.id));
        if (!queueResult.success) {
          throw new Error(queueResult.failedJobs[0]?.error || 'Queued print job failed');
        }
        logOrderEvent('success', 'print', 'Manual routed print jobs completed', {
          order: freshOrder,
          details: `queuedJobs=${queuedJobs.length} total=${formatDurationMs(workflowStartedAt)}`,
        });
      }
      logOrderEvent('success', 'print', 'Manual print workflow completed', {
        order: freshOrder,
        details: `total=${formatDurationMs(workflowStartedAt)} capturedJobs=${capturedJobs.length}`,
      });
    } catch (error) {
      console.error('Quick print failed:', error);
      const message = formatPrinterError(error) || 'Failed to print order.';
      logOrderEvent('error', 'print', 'Manual print workflow failed', {
        order,
        details: `after=${formatDurationMs(workflowStartedAt)} reason=${message}`,
      });
      Alert.alert('Print error', message);
    } finally {
      setPrintingOrderId(null);
      setTempPrintingOrder(null);
      setTempPrintSource(null);
      setTempPrintTicketIndex(0);
      setTempPrintDuplicateBySections(false);
      setTempPrintTemplate('kitchen');
      setTempPrintDebugContext(null);
    }
  };

  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  useEffect(() => {
    setLastUpdated(dataUpdatedAt ? new Date(dataUpdatedAt) : null);
    if (dataUpdatedAt) {
      setRefreshCountdown(appSettingsRef.current.refreshIntervalSec);
    }
  }, [dataUpdatedAt]);

  useEffect(() => {
    if (orders.length === 0) return;
    if (Date.now() - lastDeliverySyncAtRef.current < DELIVERY_STATUS_SYNC_INTERVAL_MS) return;
    lastDeliverySyncAtRef.current = Date.now();
    void syncDeliveryStatuses(orders);
  }, [dataUpdatedAt]);

  useEffect(() => {
    if (refreshCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            void loadOrders();
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
      if (isScheduledPreOrder(order)) scheduled += 1;
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
        return orders.filter((order) => isScheduledPreOrder(order));
      default:
        return orders;
    }
  }, [activeFilter, orders]);

  const groupedRows = useMemo<ListRow[]>(() => {
    const groups: Record<GroupKey, Order[]> = {
      overdue: [],
      'due-soon': [],
      ready: [],
      'on-the-way': [],
      attention: [],
      other: [],
    };

    for (const order of filteredOrders) {
      const targetTimeMs = new Date(order.scheduled_pickup_at || order.created_at).getTime();
      const diffMinutes = (targetTimeMs - nowMs) / (1000 * 60);

      if (
        order.order_type === 'delivery'
        && ['assigned', 'driver_assigned', 'inflight', 'picked_up', 'in_transit'].includes(order.delivery_status || '')
      ) {
        groups['on-the-way'].push(order);
      } else if (order.order_status === 'ready') {
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
      { key: 'on-the-way', title: 'On The Way' },
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
    logOrderEvent('info', 'ui', 'Opened order detail from live list', {
      order,
    });
    setShowOrderModal(true);
  };

  const handleRefreshDeliveryStatus = async (order: Order) => {
    if (order.order_type !== 'delivery') return;

    setRefreshingDeliveryIds((current) => Array.from(new Set([...current, order.id])));
    try {
      const result = await refreshDeliveryStatus(order.id);
      if (result.error) {
        Alert.alert('Delivery refresh failed', result.error);
        return;
      }

      if (result.data) {
        queryClient.setQueryData<Order[]>(LIVE_ORDERS_QUERY_KEY, (prev = []) => (
          prev.map((item) => (item.id === result.data!.id ? result.data! : item))
        ));
        if (selectedOrder?.id === result.data.id) {
          setSelectedOrder(result.data);
        }
      }
    } finally {
      setRefreshingDeliveryIds((current) => current.filter((id) => id !== order.id));
    }
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
  const isPhoneLayout = isCompactPhoneWidth(width);
  const isVerticalCardLayout = shouldUseVerticalLiveOrderCards(
    appSettings.liveOrderCardLayout === 'vertical',
    width,
  );
  const useVerticalCardRail = shouldUseLiveOrderCardRail(
    appSettings.liveOrderCardLayout === 'vertical',
    width,
  );

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
          onPrimaryAction={() => {
            void loadOrders();
          }}
        />
      )}

      <Surface style={styles.header} elevation={1}>
        <View style={[styles.headerRow, isPhoneLayout ? styles.headerRowPhone : null]}>
          <View style={[styles.headerTitleWrap, isPhoneLayout ? styles.headerTitleWrapPhone : null]}>
            {!isPhoneLayout ? <Text style={styles.headerTitle}>Live Orders</Text> : null}
            <Text style={styles.headerSubtitle}>
              {summaryCounts.all} active • {isStale ? 'Sync delayed' : refreshCountdown > 0 ? `Refresh in ${refreshCountdown}s` : 'Up to date'}
            </Text>
          </View>
          <View style={[styles.headerActions, isPhoneLayout ? styles.headerActionsPhone : null]}>
            <View style={styles.preOrderBadgeContainer}>
              <PaperButton
                mode="outlined"
                onPress={() => router.push('/pre-orders')}
                style={[styles.preOrderButton, isPhoneLayout ? styles.phoneActionButton : null]}
                contentStyle={isPhoneLayout ? styles.phoneActionContent : undefined}
                compact
                icon="calendar-clock"
                accessibilityLabel="Pre-orders"
              >
                {isPhoneLayout ? '' : 'Pre-orders'}
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
              style={[styles.filterToggleButton, isPhoneLayout ? styles.phoneActionButton : null]}
              contentStyle={isPhoneLayout ? styles.phoneActionContent : undefined}
              compact
              icon="filter-variant"
              accessibilityLabel={`Filter: ${activeFilterOption.label}`}
            >
              {isPhoneLayout ? '' : activeFilterOption.label}
            </PaperButton>
            {JOURNAL_LOGS_ENABLED ? (
              <TouchableOpacity
                style={styles.logButton}
                onPress={() => setShowPrintLogs(true)}
              >
                <MaterialCommunityIcons name="text-box-search-outline" size={20} color="#1f2937" />
                {journalEntries.length > 0 ? (
                  <Badge style={styles.logBadge} size={18}>
                    {journalEntries.length > 99 ? '99+' : journalEntries.length}
                  </Badge>
                ) : null}
              </TouchableOpacity>
            ) : null}
            <PaperButton
              mode="contained"
              onPress={() => {
                void loadOrders();
              }}
              loading={loading || isFetchingOrders}
              style={[styles.refreshButton, isPhoneLayout ? styles.phoneActionButton : null]}
              contentStyle={isPhoneLayout ? styles.phoneActionContent : undefined}
              compact
              icon="refresh"
              accessibilityLabel="Refresh live orders"
            >
              {isPhoneLayout ? '' : 'Refresh'}
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
                  horizontal={useVerticalCardRail}
                  scrollEnabled={useVerticalCardRail}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.verticalSectionRail, isPhoneLayout ? styles.verticalSectionRailPhone : null]}
                >
                  {section.orders.map((order) => (
                    <LiveOrderListItem
                      key={order.id}
                      order={order}
                      printState={orderPrintStates[order.id] || null}
                      nowMs={nowMs}
                      updatingStatus={updatingStatus}
                      layout="vertical"
                      onOrderPress={handleOrderPress}
                      onCustomerPress={handleCustomerPress}
                      onPrintPress={(order, printer) => void quickPrintOrder(order, printer)}
                      availablePrinters={appSettings.printerSaved}
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
                printState={orderPrintStates[order.id] || null}
                nowMs={nowMs}
                updatingStatus={updatingStatus}
                layout="horizontal"
                onOrderPress={handleOrderPress}
                onCustomerPress={handleCustomerPress}
                onPrintPress={(order, printer) => void quickPrintOrder(order, printer)}
                availablePrinters={appSettings.printerSaved}
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

      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onOrderRefresh={(updatedOrder) => {
          setSelectedOrder(updatedOrder);
          queryClient.setQueryData<Order[]>(LIVE_ORDERS_QUERY_KEY, (prev = []) => (
            prev.map((item) => (item.id === updatedOrder.id ? updatedOrder : item))
          ));
        }}
        onPrint={handlePrint}
        onPrintImage={handlePrintImage}
        onPrintCustomerCopyImage={handlePrintImage}
        availablePrinters={appSettings.printerSaved}
        onCustomerPress={handleCustomerPress}
        onStatusUpdate={handleStatusUpdate}
        onPaymentStatusUpdate={handlePaymentStatusUpdateWithTender}
        onSmartpayPayment={handleSmartpayPayment}
          onQuickAction={handleQuickAction}
          onRefreshDeliveryStatus={handleRefreshDeliveryStatus}
          updatingStatus={updatingStatus || refreshingDeliveryIds[0] || null}
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
              {tempPrintTemplate === 'customer-copy' ? (
                <CustomerReceiptTemplate
                  order={tempPrintingOrder}
                  width={appSettings.printerPaperWidth === '58mm' ? 384 : 576}
                />
              ) : (
                <ReceiptTemplate
                  order={tempPrintingOrder}
                  width={appSettings.printerPaperWidth === '58mm' ? 384 : 576}
                  printSource={tempPrintSource || undefined}
                  showTicketCounter={hasAnySimulatorAssignment(appSettings)}
                  onlyTicketIndex={tempPrintTicketIndex}
                  duplicateBySections={tempPrintDuplicateBySections}
                  printDebugContext={tempPrintDebugContext}
                />
              )}
           </View>
         )}
      </View>

      <PrintSimulatorModal
        visible={showSimulator && !showOrderModal}
        order={simulatorOrder}
        imageUri={printImageUri}
        imageUris={printImageUris}
        imageLabels={printImageLabels}
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

      <JournalLogsModal
        visible={showPrintLogs}
        onClose={() => setShowPrintLogs(false)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5', gap: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  headerRowPhone: { alignItems: 'center' },
  headerTitleWrap: { flex: 1, gap: 2 },
  headerTitleWrapPhone: { flexBasis: '100%' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', flexShrink: 1 },
  headerSubtitle: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-start' },
  headerActionsPhone: { width: '100%', justifyContent: 'space-between', flexWrap: 'nowrap' },
  preOrderBadgeContainer: { position: 'relative' },
  preOrderButton: { borderRadius: 8, borderColor: '#2563eb' },
  filterToggleButton: { borderRadius: 8 },
  logButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#dc2626',
  },
  preOrderBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    fontWeight: 'bold',
  },
  refreshButton: { borderRadius: 8, minWidth: 88 },
  phoneActionButton: { minWidth: 0, width: 40 },
  phoneActionContent: { width: 40, height: 40, marginHorizontal: 0 },
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
  verticalSectionRailPhone: { paddingRight: 0 },
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
  snackbar: {
    backgroundColor: '#111827',
  },
});
