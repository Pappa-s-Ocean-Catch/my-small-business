import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Button as PaperButton,
  Surface,
} from 'react-native-paper';
import { Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import {
  claimOrderForAutoPrint,
  completeKitchenPrintClaim,
  getOrder,
  releaseKitchenPrintClaim,
} from '@/lib/orders';
import type { Order } from '@my-small-business/types';
import { CustomerModal } from '@/components/CustomerModal';
import { LiveOrderListItem } from '@/components/LiveOrderListItem';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { DEFAULT_APP_SETTINGS, loadAppSettings } from '@/lib/settings';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { PRE_ORDERS_QUERY_KEY, usePreOrdersQuery } from '@/hooks/useLiveOrdersQuery';
import { captureReceiptForPrinter, captureReceiptPreview, type PrinterImageSource } from '@/lib/printer-image';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { buildKitchenReceiptDocument } from '@/lib/kitchen-receipt-document';
import { CustomerReceiptTemplate } from '@/components/CustomerReceiptTemplate';
import { isSimulatorPrinter, type SavedPrinter } from '@/lib/escpos-printer';
import { buildSectionPrintJobs, hasAnySimulatorAssignment } from '@/lib/printer-routing';
import { getPrintDeviceId } from '@/lib/print-device';
import { useQueryClient } from '@tanstack/react-query';
import { enqueuePreparedPrintJobs, waitForPrintJobs } from '@/lib/print-queue';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
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
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
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
    refetch: refetchOrders,
  } = usePreOrdersQuery();
  const appSettingsRef = useRef(appSettings);
  const printDeviceIdRef = useRef<string | null>(null);
  const orderPrintStates = usePrinterAutomationStore((state) => state.orderPrintStates);

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

      const claim = await claimOrderForAutoPrint(order.id, claimedDeviceId);
      if (!claim.claimed) {
        if (claim.error) {
          console.error('Pre-order print claim failed:', claim.error);
          Alert.alert('Print error', 'Could not secure this order for printing. Please try again.');
        } else {
          Alert.alert('Already printing', 'Another POS has already claimed or finished this order print.');
        }
        return;
      }
      shouldReleaseClaim = true;

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
          if (!queueResult.success) throw new Error(queueResult.failedJobs[0]?.error || 'Queued text print job failed');
          const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
          if (!completion.completed) throw new Error(completion.error || 'Failed to complete kitchen print claim');
          shouldReleaseClaim = false;
          return;
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
          const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
          if (!completion.completed) {
            throw new Error(completion.error || 'Failed to complete kitchen print claim');
          }
          shouldReleaseClaim = false;
          return;
        }

        const image = await captureReceiptForPrinter(receiptRef, selectedPrinter, targetDots * scale, s.printerHighQuality);

        if (!s.printerEnabled) {
          Alert.alert('Printer error', `No printer is selected. ${printSettingsDetails}`);
          return;
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
          throw new Error(queueResult.failedJobs[0]?.error || 'Queued print job failed');
        }
        const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
        if (!completion.completed) {
          throw new Error(completion.error || 'Failed to complete kitchen print claim');
        }
        shouldReleaseClaim = false;
        return;
      }

      const jobs = buildSectionPrintJobs(s, freshOrder);
      const capturedJobs: Array<{ image: PrinterImageSource; previewUri: string | null; label: string; printer: NonNullable<ReturnType<typeof buildSectionPrintJobs>[number]['printer']> | null }> = [];

      for (let index = 0; index < jobs.length; index += 1) {
        const job = jobs[index];
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
          capturedJobs.push({ image: { kind: 'uri', uri }, previewUri: uri, label: job.label, printer: job.printer });
        } else {
          const image = await captureReceiptForPrinter(receiptRef, job.printer, targetDots * scale, s.printerHighQuality);
          const previewUri = image.kind === 'uri' ? image.uri : null;
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
        return;
      }

      if (!s.printerEnabled) {
        console.log('[PreOrders] Manual print blocked because no printer was resolved:', printSettingsDetails);
        Alert.alert('Printer error', `No printer is selected. ${printSettingsDetails}`);
        return;
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
        throw new Error(queueResult.failedJobs[0]?.error || 'Queued print job failed');
      }
      const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
      if (!completion.completed) {
        throw new Error(completion.error || 'Failed to complete kitchen print claim');
      }
      shouldReleaseClaim = false;
    } catch (error) {
      console.error('Quick print failed:', error);
      Alert.alert('Print error', 'Failed to capture receipt template image for printing.');
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
      subscription.unsubscribe();
    };
  }, [queryClient]);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [])
  );

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
      <CustomerModal
        visible={showCustomerModal}
        email={customerInfo.email}
        phone={customerInfo.phone}
        onClose={() => setShowCustomerModal(false)}
        onOrderPress={handleOpenOrderFromCustomerModal}
      />

      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="Pre-Orders" titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="home" onPress={() => router.replace('/(drawer)/(tabs)/live-orders')} iconColor="#fff" />
      </Appbar.Header>

      <Surface style={styles.subHeader} elevation={1}>
        <View style={styles.headerRow}>
          <Text style={styles.countText}>{orders.length} orders scheduled</Text>
          <PaperButton mode="contained" onPress={() => void loadOrders()} loading={loading} style={styles.refreshButton}>
            Refresh
          </PaperButton>
        </View>
      </Surface>

      <FlatList
        data={orders}
        renderItem={({ item }) => (
          <LiveOrderListItem
            order={item}
            printState={orderPrintStates[item.id] || null}
            nowMs={nowMs}
            updatingStatus={updatingStatus}
            onOrderPress={handleOrderPress}
            onCustomerPress={handleCustomerPress}
            onPrintPress={(order, printer) => void quickPrintOrder(order, printer)}
            availablePrinters={appSettings.printerSaved}
            onQuickAction={handleQuickAction}
            onStatusUpdate={handleStatusUpdate}
            onPaymentStatusUpdate={handlePaymentStatusUpdate}
          />
        )}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pre-orders found</Text>
          </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  appbar: { backgroundColor: '#2563eb' },
  appbarTitle: { color: '#fff', fontWeight: 'bold' },
  subHeader: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  countText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  refreshButton: { borderRadius: 8 },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#6b7280' },
  hiddenReceiptContainer: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  printingOverlay: { position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  printingChip: { backgroundColor: '#2563eb', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  printingText: { color: '#fff', fontWeight: 'bold' },
});
