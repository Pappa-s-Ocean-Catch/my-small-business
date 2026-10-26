import { ActionButton as PaperButton } from '@/components/ui/ActionButton';
import { AsyncState, StatusBadge } from '@/components/ui';
import { orderPaymentLabel, paymentTone } from '@/components/orders/presentation';
import { getFriendlyOrderNumber } from '@/utils/orderNumber';
import { designTokens as t } from '@/lib/redesign';
import { OrdersWorkspaceHeader } from '@/components/navigation/OrdersWorkspaceHeader';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  useWindowDimensions,
  Pressable,
} from 'react-native';

import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import {
  claimOrderForAutoPrint,
  completeKitchenPrintClaim,
  getOrder,
  releaseKitchenPrintClaim,
} from '@/lib/orders';
import type { Order } from '@my-small-business/types';
import { CustomerModal } from '@/components/CustomerModal';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { DEFAULT_APP_SETTINGS, loadAppSettings } from '@/lib/settings';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { PRE_ORDERS_QUERY_KEY, usePreOrdersQuery } from '@/hooks/useLiveOrdersQuery';
import { useCustomerOrderCounts } from '@/hooks/useCustomerOrderCounts';
import { captureReceiptForPrinter, captureReceiptPreview, type PrinterImageSource } from '@/lib/printer-image';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { buildKitchenReceiptDocument } from '@/lib/kitchen-receipt-document';
import { CustomerReceiptTemplate } from '@/components/CustomerReceiptTemplate';
import { getPrinterDriver, isSimulatorPrinter, type SavedPrinter } from '@/lib/escpos-printer';
import { buildSectionPrintJobs, hasAnySimulatorAssignment } from '@/lib/printer-routing';
import { getSectionPrintImageCaptureKey } from '@/lib/section-print-image-capture';
import { getPrintDeviceId } from '@/lib/print-device';
import { useQueryClient } from '@tanstack/react-query';
import { enqueuePreparedPrintJobs, waitForPrintJobs } from '@/lib/print-queue';
import {
  buildKitchenPrintDebugContext,
  createPrintDebugSessionId,
  type KitchenPrintDebugContext,
} from '@/lib/print-debug-footer';
const RECEIPT_REF_WAIT_MS = 120;
const RECEIPT_REF_MAX_ATTEMPTS = 8;
const RECEIPT_RENDER_SETTLE_MS = 300;
const RECEIPT_RENDER_FRAME_COUNT = 2;

export default function PreOrdersScreen() {
  const { width } = useWindowDimensions();
  const columns = width >= 800 ? 2 : 1;
  const gutter = width >= 1100 ? 16 : 12;
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ email?: string; phone?: string }>({});
  const [tempPrintingOrder, setTempPrintingOrder] = useState<Order | null>(null);
  const [tempPrintSource, setTempPrintSource] = useState<string | null>(null);
  const [tempPrintTicketIndex, setTempPrintTicketIndex] = useState(0);
  const [tempPrintDuplicateBySections, setTempPrintDuplicateBySections] = useState(false);
  const [tempPrintTemplate, setTempPrintTemplate] = useState<'kitchen' | 'customer-copy'>('kitchen');
  const [tempPrintDebugContext, setTempPrintDebugContext] = useState<KitchenPrintDebugContext | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const globalReceiptRef = useRef(null);
  const queryClient = useQueryClient();
  const { data: appSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
  const {
    data: orders = [],
    isLoading: loading,
    error: preOrdersError,
    refetch: refetchOrders,
  } = usePreOrdersQuery();
  const { data: successfulOrderCounts } = useCustomerOrderCounts(orders);
  const appSettingsRef = useRef(appSettings);
  const printDeviceIdRef = useRef<string | null>(null);
  const waitForReceiptTemplateRef = useCallback(async () => {
    for (let attempt = 0; attempt < RECEIPT_REF_MAX_ATTEMPTS; attempt++) {
      if (globalReceiptRef.current) {
        return globalReceiptRef.current;
      }
      await new Promise((resolve) => setTimeout(resolve, RECEIPT_REF_WAIT_MS));
    }
    return null;
  }, []);

  const waitForReceiptRenderFrames = useCallback(async (frameCount: number = RECEIPT_RENDER_FRAME_COUNT) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, []);

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
    handleStatusUpdate,
    handlePaymentStatusUpdate,
    handleQuickAction,
    handlePrint,
    handlePrintImage,
    showSimulator,
    setShowSimulator,
    simulatorOrder,
    setSimulatorOrder,
    printImageUri,
    setPrintImageUri,
    printImageUris,
    setPrintImageUris,
    printImageLabels,
    setPrintImageLabels,
  } = useOrderActions(appSettings, loadOrders, (updated) => {
    if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
  });

  const quickPrintOrder = async (order: Order, selectedPrinter?: SavedPrinter | null) => {
    let claimedDeviceId: string | null = null;
    let shouldReleaseClaim = false;

    setIsCapturing(true);
    setPrintingOrderId(order.id);

    try {
      if (!printDeviceIdRef.current) {
        printDeviceIdRef.current = await getPrintDeviceId();
      }
      claimedDeviceId = printDeviceIdRef.current;

      if (!isSimulatorPrinter(selectedPrinter)) {
      const claim = await claimOrderForAutoPrint(order.id, claimedDeviceId);
      if (!claim.claimed) {
        if (claim.error) {
          console.error('Pre-order print claim failed:', claim.error);
          Alert.alert('Print error', 'Could not secure this order for printing. Please try again.');
        } else {
          Alert.alert('Already printing', 'Another POS has already claimed or finished this order print.');
        }
        return false;
      }
      shouldReleaseClaim = true;
      }

      let freshOrder = order;
      const latestOrderResult = await getOrder(order.id);
      if (latestOrderResult.data) {
        freshOrder = latestOrderResult.data;
        queryClient.setQueryData<Order[]>(PRE_ORDERS_QUERY_KEY, (prev = []) => (
          prev.map((item) => (item.id === freshOrder.id ? freshOrder : item))
        ));
        if (selectedOrder?.id === freshOrder.id) {
          setSelectedOrder(freshOrder);
        }
      } else if (latestOrderResult.error) {
        console.warn('[PreOrders] Failed to refresh order before printing:', latestOrderResult.error);
      }

      const s = await loadAppSettings().catch(() => appSettingsRef.current);
      appSettingsRef.current = s;
      const printSessionId = createPrintDebugSessionId();
      const printSettingsDetails = [
        `simulator=${String(hasAnySimulatorAssignment(s))}`,
        `printerEnabled=${String(s.printerEnabled)}`,
        `defaultTarget=${s.printerSelectedTarget ?? 'none'}`,
        `savedPrinters=${s.printerSaved.length}`,
        `sectionRules=${s.printerSectionAssignments.length}`,
      ].join(', ');
      console.log('[PreOrders] Resolved manual print settings:', printSettingsDetails);
      // Update the hidden template with this order
      setTempPrintingOrder(freshOrder);
      setTempPrintSource('pre-orders:manual-list-print');
      setTempPrintTemplate('kitchen');
      const targetDots = s.printerPaperWidth === '58mm' ? 384 : 576;
      const scale = s.printerHighQuality ? 2 : 1;
      if (selectedPrinter) {
        if (s.printerReceiptMode === 'text' && !isSimulatorPrinter(selectedPrinter)) {
          const queuedJobs = enqueuePreparedPrintJobs({ order: freshOrder, source: 'manual', scope: 'pre-orders:manual-direct', jobs: [{ document: buildKitchenReceiptDocument(freshOrder, { paperWidth: s.printerPaperWidth, duplicateBySections: false, printDebugContext: null }), printer: selectedPrinter, width: targetDots, label: selectedPrinter.deviceName }] });
          const queueResult = await waitForPrintJobs(queuedJobs.map((job) => job.id));
          if (!queueResult.success) {
            if (queueResult.failedJobs.length === 0) shouldReleaseClaim = false;
            throw new Error(queueResult.failedJobs[0]?.error || `Print outcome unknown. Check request ${queuedJobs.map((job) => job.id).join(', ')} in the printer journal before retrying.`);
          }
          const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
          if (!completion.completed) throw new Error(completion.error || 'Failed to complete kitchen print claim');
          shouldReleaseClaim = false;
          return true;
        }
        setTempPrintTicketIndex(0);
        setTempPrintDuplicateBySections(false);
        setTempPrintDebugContext(buildKitchenPrintDebugContext({
          enabled: s.printerDebugFooter,
          registerName: s.registerName,
          deviceId: claimedDeviceId,
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
        await new Promise(resolve => setTimeout(resolve, RECEIPT_RENDER_SETTLE_MS));

        const receiptRef = await waitForReceiptTemplateRef();
        if (!receiptRef) {
          throw new Error('Receipt template is still loading. Please try again.');
        }

        if (isSimulatorPrinter(selectedPrinter)) {
          const uri = await captureReceiptPreview(receiptRef, targetDots * scale);
          setSimulatorOrder(freshOrder);
          setPrintImageUri(uri);
          setPrintImageUris([uri]);
          setPrintImageLabels([selectedPrinter.deviceName]);
          setShowSimulator(true);
          return true;
        }

        const image = await captureReceiptForPrinter(receiptRef, selectedPrinter, targetDots * scale, s.printerHighQuality);

        if (!s.printerEnabled) {
          Alert.alert('Printer error', `No printer is selected. ${printSettingsDetails}`);
          return false;
        }

        const queuedJobs = enqueuePreparedPrintJobs({
          order: freshOrder,
          source: 'manual',
          scope: 'pre-orders:manual-direct',
          jobs: [{
            image,
            printer: selectedPrinter,
            width: targetDots,
            label: selectedPrinter.deviceName,
          }],
        });
        const queueResult = await waitForPrintJobs(queuedJobs.map((job) => job.id));
        if (!queueResult.success) {
          if (queueResult.failedJobs.length === 0) shouldReleaseClaim = false;
          throw new Error(queueResult.failedJobs[0]?.error || `Print outcome unknown. Check request ${queuedJobs.map((job) => job.id).join(', ')} in the printer journal before retrying.`);
        }
        const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
        if (!completion.completed) {
          throw new Error(completion.error || 'Failed to complete kitchen print claim');
        }
        shouldReleaseClaim = false;
        return true;
      }

      const jobs = buildSectionPrintJobs(s, freshOrder);
      const capturedJobs: Array<{ image: PrinterImageSource; previewUri: string | null; label: string; printer: NonNullable<ReturnType<typeof buildSectionPrintJobs>[number]['printer']> | null; captureKey: string }> = [];

      for (let index = 0; index < jobs.length; index += 1) {
        const job = jobs[index];
        const captureKey = getSectionPrintImageCaptureKey(job, job.printer ? getPrinterDriver(job.printer) : 'simulator');
        const reusedCapture = job.printMode === 'combine'
          ? capturedJobs.find((capturedJob) => capturedJob.captureKey === captureKey)
          : null;
        if (reusedCapture) {
          capturedJobs.push({ ...reusedCapture, label: job.label, printer: job.printer, captureKey });
          continue;
        }
        setTempPrintTicketIndex(job.onlyTicketIndex ?? 0);
        setTempPrintDuplicateBySections(job.duplicateBySections);
        setTempPrintTemplate(job.template);
        setTempPrintDebugContext(buildKitchenPrintDebugContext({
          enabled: s.printerDebugFooter,
          registerName: s.registerName,
          deviceId: claimedDeviceId,
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
          await new Promise(resolve => setTimeout(resolve, RECEIPT_RENDER_SETTLE_MS));
        } else {
          await waitForReceiptRenderFrames();
        }

        const receiptRef = await waitForReceiptTemplateRef();
        if (!receiptRef) {
          throw new Error('Receipt template is still loading. Please try again.');
        }

        if (!job.printer || isSimulatorPrinter(job.printer)) {
          const uri = await captureReceiptPreview(receiptRef, targetDots * scale);
          capturedJobs.push({ image: { kind: 'uri', uri }, previewUri: uri, label: job.label, printer: job.printer, captureKey });
        } else {
          const image = await captureReceiptForPrinter(receiptRef, job.printer, targetDots * scale, s.printerHighQuality);
          const previewUri = image.kind === 'uri' ? image.uri : null;
          capturedJobs.push({ image, previewUri, label: job.label, printer: job.printer, captureKey });
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
        console.log('[PreOrders] Using simulator for manual print:', printSettingsDetails);
        setSimulatorOrder(freshOrder);
        setPrintImageUri(simulatorImageUris[0] || null);
        setPrintImageUris(simulatorImageUris);
        setPrintImageLabels(simulatorImageLabels);
        setShowSimulator(true);
      }

      if (printerJobs.length === 0) {
        const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
        if (!completion.completed) {
          throw new Error(completion.error || 'Failed to complete kitchen print claim');
        }
        shouldReleaseClaim = false;
        return true;
      }

      if (!s.printerEnabled) {
        console.log('[PreOrders] Manual print blocked because no printer was resolved:', printSettingsDetails);
        Alert.alert('Printer error', `No printer is selected. ${printSettingsDetails}`);
        return false;
      }

      const queuedJobs = enqueuePreparedPrintJobs({
        order: freshOrder,
        source: 'manual',
        scope: 'pre-orders:manual-routed',
        jobs: printerJobs.map((job) => ({
          image: job.image,
          printer: job.printer,
          width: targetDots,
          label: job.printer.deviceName,
        })),
      });
      const queueResult = await waitForPrintJobs(queuedJobs.map((job) => job.id));
      if (!queueResult.success) {
        if (queueResult.failedJobs.length === 0) shouldReleaseClaim = false;
        throw new Error(queueResult.failedJobs[0]?.error || `Print outcome unknown. Check request ${queuedJobs.map((job) => job.id).join(', ')} in the printer journal before retrying.`);
      }
      const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
      if (!completion.completed) {
        throw new Error(completion.error || 'Failed to complete kitchen print claim');
      }
      shouldReleaseClaim = false;
      return true;
    } catch (error) {
      console.error('Quick print failed:', error);
      Alert.alert('Print error', error instanceof Error ? error.message : 'Failed to prepare receipt for printing.');
      return false;
    } finally {
      if (claimedDeviceId && shouldReleaseClaim) {
        const released = await releaseKitchenPrintClaim(order.id, claimedDeviceId);
        if (released.error) {
          console.error('Failed to release kitchen print claim:', released.error);
        }
      }
      setIsCapturing(false);
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
    const subscription = supabase
      .channel('pre-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          void queryClient.invalidateQueries({ queryKey: PRE_ORDERS_QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [queryClient]);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [])
  );

  useEffect(() => {
    if (!isFocused) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isFocused]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadOrders();
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleCustomerPress = (order: Order) => {
    setCustomerInfo({ email: order.customer_email, phone: order.customer_phone });
    setShowCustomerModal(true);
  };

  const handleOpenOrderFromCustomerModal = async (orderId: string) => {
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
      <CustomerModal
        visible={showCustomerModal}
        email={customerInfo.email}
        phone={customerInfo.phone}
        onClose={() => setShowCustomerModal(false)}
        onOrderPress={handleOpenOrderFromCustomerModal}
      />

      <OrdersWorkspaceHeader actions={{ onRefresh: handleRefresh, refreshing: loading || refreshing }} />

      {orders.length > 0 && <View style={[styles.subHeader, { paddingHorizontal: gutter }]}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>Upcoming collections</Text>
          <Text style={styles.countText}>{orders.length} scheduled {orders.length === 1 ? 'order' : 'orders'} · Sorted by collection time</Text>
        </View>
      </View>}

      <FlatList
        key={columns}
        data={[...orders].sort((a, b) => new Date(a.scheduled_pickup_at || a.created_at).getTime() - new Date(b.scheduled_pickup_at || b.created_at).getTime())}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.cardRow : undefined}
        renderItem={({ item }) => (
          <View style={[styles.scheduledCard, columns > 1 && styles.gridCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderNumber}>#{getFriendlyOrderNumber(item.order_number)}</Text>
              <StatusBadge label="Pre-order" tone="primary" />
            </View>
            <View style={styles.scheduledTime}>
              <Text style={styles.scheduledTimeText}>{formatCollectionTime(item.scheduled_pickup_at, nowMs)}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`View customer ${item.customer_name || item.customer_email || 'Walk-in'}`} onPress={() => handleCustomerPress(item)} style={styles.customerButton}>
              <Text style={styles.customerName}>{item.customer_name || item.customer_email || 'Walk-in'}</Text>
            </Pressable>
            <Text style={styles.itemSummary}>{item.order_type === 'delivery' ? 'Delivery' : 'Pickup'}{item.items?.length ? ` · ${item.items.map((line) => line.product_name).join(', ')}` : ''}</Text>
            <View style={styles.totalRow}>
              <Text style={styles.total}>${item.total.toFixed(2)}</Text>
              <StatusBadge label={orderPaymentLabel(item.payment_status, item.order_status)} tone={paymentTone(item.payment_status)} />
            </View>
            <View style={styles.cardFooter}>
              <PaperButton mode="outlined" onPress={() => handleOrderPress(item)} style={styles.viewButton} contentStyle={styles.buttonContent}>View order</PaperButton>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: gutter }]}
        ListEmptyComponent={
          <AsyncState
            loading={loading}
            icon="check"
            title={loading ? 'Loading scheduled orders' : preOrdersError ? 'Scheduled orders unavailable' : 'No upcoming orders'}
            description={preOrdersError instanceof Error ? preOrdersError.message : 'Scheduled orders will appear here, sorted by collection time.'}
            onRetry={() => void loadOrders()}
            retryLabel={preOrdersError ? 'Try again' : 'Refresh'}
          />
        }
      />

      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onPrint={handlePrint}
        onPrintImage={handlePrintImage}
        onPrintCustomerCopyImage={handlePrintImage}
        availablePrinters={appSettings.printerSaved}
        onCustomerPress={handleCustomerPress}
        onStatusUpdate={handleStatusUpdate}
        onPaymentStatusUpdate={handlePaymentStatusUpdate}
        onQuickAction={handleQuickAction}
        updatingStatus={updatingStatus}
        showSimulator={showSimulator}
        setShowSimulator={setShowSimulator}
        simulatorOrder={simulatorOrder}
        printImageUri={printImageUri}
        appSettings={appSettings}
      />

      <PrintSimulatorModal
        visible={showSimulator && !showOrderModal}
        order={simulatorOrder}
        imageUri={printImageUri}
        imageUris={printImageUris}
        imageLabels={printImageLabels}
        onClose={() => setShowSimulator(false)}
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
                  successfulOrderCount={successfulOrderCounts?.[tempPrintingOrder.id]}
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

      {printingOrderId && (
        <View style={styles.printingOverlay} pointerEvents="none">
          <View style={styles.printingChip}>
            <Text style={styles.printingText}>Printing...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function formatCollectionTime(scheduledAt: string | null | undefined, nowMs: number): string {
  if (!scheduledAt) return 'Collection time not set';
  const collection = new Date(scheduledAt);
  if (Number.isNaN(collection.getTime())) return 'Collection time unavailable';
  const today = new Date(nowMs);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const day = collection.toDateString() === today.toDateString() ? 'Today'
    : collection.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
    : collection.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${collection.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.background },
  subHeader: { paddingTop: 16, paddingBottom: 32, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  heading: { flex: 1, minWidth: 220, gap: 12 },
  title: { fontSize: 26, color: t.color.text, fontWeight: '700' },
  countText: { fontSize: 14, color: t.color.muted, lineHeight: 21 },
  refreshButton: { borderRadius: t.radius.control, borderColor: t.color.border, backgroundColor: t.color.surface },
  buttonContent: { minHeight: 48 },
  listContent: { flexGrow: 1, paddingBottom: 24, gap: 20 },
  cardRow: { gap: 20, alignItems: 'flex-start' },
  scheduledCard: { padding: 20, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card, backgroundColor: t.color.surface, gap: 8 },
  gridCard: { width: '48%', flexGrow: 1, maxWidth: '50%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  orderNumber: { fontSize: 18, color: t.color.text, fontWeight: '700', flexShrink: 1 },
  scheduledTime: { backgroundColor: t.color.primaryTint, borderRadius: t.radius.control, paddingHorizontal: 16, paddingVertical: 12 },
  scheduledTimeText: { fontSize: 16, fontWeight: '700', color: t.color.primary },
  customerButton: { minHeight: 40, justifyContent: 'center' },
  customerName: { fontSize: 16, color: t.color.text, fontWeight: '700' },
  itemSummary: { fontSize: 14, lineHeight: 21, color: t.color.muted },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  total: { fontSize: 16, color: t.color.text, fontWeight: '700' },
  cardFooter: { borderTopWidth: 1, borderColor: t.color.border, paddingTop: 18, marginTop: 2, alignItems: 'flex-start' },
  viewButton: { borderRadius: t.radius.control, borderColor: t.color.border },
  hiddenReceiptContainer: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  printingOverlay: { position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  printingChip: { backgroundColor: t.color.primary, borderRadius: t.radius.card, paddingHorizontal: 16, paddingVertical: 8 },
  printingText: { color: '#fff', fontWeight: 'bold' },
});
