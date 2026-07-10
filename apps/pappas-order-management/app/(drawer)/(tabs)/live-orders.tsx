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
} from 'react-native';
import {
  Button as PaperButton,
  Surface,
  Badge,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getOrder,
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
import { escposPrintOrderImage, formatPrinterError } from '@/lib/escpos-printer';
import { buildSectionPrintJobs, hasAnySimulatorAssignment } from '@/lib/printer-routing';
import { captureRef } from 'react-native-view-shot';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
import {
  LIVE_ORDERS_QUERY_KEY,
  useLiveOrdersQuery,
  usePreOrderCountQuery,
} from '@/hooks/useLiveOrdersQuery';

type TimeoutHandle = ReturnType<typeof setTimeout>;
const SECTION_PRINT_DELAY_MS = 1500;

type FilterKey = 'all' | 'needs-action' | 'unpaid' | 'ready' | 'scheduled';
type GroupKey = 'overdue' | 'due-soon' | 'ready' | 'on-the-way' | 'attention' | 'other';
type ListRow =
  | { type: 'section'; key: string; title: string; count: number }
  | { type: 'order'; key: string; order: Order };

const RECEIPT_REF_WAIT_MS = 120;
const RECEIPT_REF_MAX_ATTEMPTS = 8;

export default function LiveOrdersScreen() {
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
  const [cashTenderOrder, setCashTenderOrder] = useState<Order | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const globalReceiptRef = useRef(null);

  const queryClient = useQueryClient();
  const countdownIntervalRef = useRef<TimeoutHandle | null>(null);
  const printQueueRef = useRef<Promise<void>>(Promise.resolve());
  const preOrderSkipNotice = usePrinterAutomationStore((state) => state.preOrderSkipNotice);
  const addJournalEntry = usePrinterAutomationStore((state) => state.addJournalEntry);
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

  const loadOrders = async () => {
    try {
      const result = await refetchOrders();
      if (result.error) {
        Alert.alert('Error', result.error.message);
      }
    } finally {
      setRefreshing(false);
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

  const quickPrintOrder = async (order: Order) => {
    let releasePrintQueue = () => {};

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

      const previousPrint = printQueueRef.current;
      printQueueRef.current = new Promise<void>((resolve) => {
        releasePrintQueue = resolve;
      });
      await previousPrint.catch(() => undefined);
      
      // Update the hidden template with this order
      setTempPrintingOrder(freshOrder);
      setTempPrintSource('live-orders:manual-list-print');
      const targetDots = s.printerPaperWidth === '58mm' ? 384 : 576;
      const scale = s.printerHighQuality ? 2 : 1;
      const jobs = buildSectionPrintJobs(s, freshOrder);
      const capturedJobs: Array<{ uri: string; label: string; useSimulator: boolean; printer: NonNullable<ReturnType<typeof buildSectionPrintJobs>[number]['printer']> | null }> = [];
      for (const job of jobs) {
        setTempPrintTicketIndex(job.onlyTicketIndex ?? 0);
        setTempPrintDuplicateBySections(job.duplicateBySections);
        await new Promise((resolve) => setTimeout(resolve, 300));

        const receiptRef = await waitForReceiptTemplateRef.current();
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
        capturedJobs.push({ uri, label: job.label, useSimulator: job.useSimulator, printer: job.printer });
      }

      const simulatorImageUris: string[] = [];
      const simulatorImageLabels: string[] = [];
      const printerJobs: Array<{ uri: string; printer: NonNullable<typeof capturedJobs[number]['printer']> }> = [];
      for (const job of capturedJobs) {
        if (job.useSimulator) {
          simulatorImageUris.push(job.uri);
          simulatorImageLabels.push(job.label);
        } else {
          if (job.printer) {
            printerJobs.push({ uri: job.uri, printer: job.printer });
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

        for (let index = 0; index < printerJobs.length; index++) {
          await escposPrintOrderImage(
            printerJobs[index].uri,
            printerJobs[index].printer,
            1,
            targetDots
          );
          if (index < printerJobs.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, SECTION_PRINT_DELAY_MS));
          }
        }
      }
    } catch (error) {
      console.error('Quick print failed:', error);
      const message = formatPrinterError(error) || 'Failed to print order.';
      Alert.alert('Print error', message);
    } finally {
      releasePrintQueue();
      setPrintingOrderId(null);
      // We don't clear tempPrintingOrder immediately to avoid flicker if nested
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
  const isVerticalCardLayout = appSettings.liveOrderCardLayout === 'vertical';

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
              onPress={() => {
                void loadOrders();
              }}
              loading={loading || isFetchingOrders}
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
                showTicketCounter={hasAnySimulatorAssignment(appSettings)}
                onlyTicketIndex={tempPrintTicketIndex}
                duplicateBySections={tempPrintDuplicateBySections}
              />
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
