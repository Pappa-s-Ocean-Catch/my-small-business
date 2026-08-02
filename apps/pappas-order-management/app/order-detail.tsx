import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { ActivityIndicator, Text } from 'react-native-paper';
import { getOrder, refreshDeliveryStatus, updateOrderStatus, updatePaymentStatus } from '../lib/orders';
import { DEFAULT_APP_SETTINGS, loadAppSettings } from '../lib/settings';
import { isSimulatorPrinter, type SavedPrinter } from '../lib/escpos-printer';
import type { PrinterImageSource } from '../lib/printer-image';
import { getSectionPrintTickets, resolvePrinterForSection } from '../lib/printer-routing';
import { formatSmartpayError, isSmartpayPaired, processSmartpayCardPayment } from '../lib/smartpay';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { getNextQuickAction } from '../utils/orderUtils';
import { enqueuePreparedPrintJobs, waitForPrintJobs } from '../lib/print-queue';

const CLOSED_ORDER_STATUSES: OrderStatus[] = ['completed', 'cancelled'];

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [smartpayPaired, setSmartpayPaired] = useState(false);
  const [smartpayProcessing, setSmartpayProcessing] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorOrder, setSimulatorOrder] = useState<Order | null>(null);
  const [printImageUri, setPrintImageUri] = useState<string | null>(null);
  const [simulatorImageLabels, setSimulatorImageLabels] = useState<string[]>([]);
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);

  useEffect(() => {
    void loadOrder();
    isSmartpayPaired().then(setSmartpayPaired).catch(() => setSmartpayPaired(false));
    loadAppSettings().then(setSettings).catch(() => setSettings(DEFAULT_APP_SETTINGS));
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    const intervalId = setInterval(() => {
      void loadOrder({ silent: true });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [orderId]);

  const loadOrder = async (options?: { silent?: boolean }) => {
    if (!orderId) return;

    try {
      if (!options?.silent) setLoading(true);
      const result = await getOrder(orderId);
      if (result.error) {
        if (!options?.silent) {
          Alert.alert('Error', result.error);
          router.back();
        }
        return;
      }
      setOrder(result.data);
    } catch (error) {
      console.error('Error loading order:', error);
      if (!options?.silent) {
        Alert.alert('Error', 'Failed to load order');
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  const processUpdateResult = (
    result: { data: Order | null; error: string | null },
    options?: { closeOnStatuses?: OrderStatus[] }
  ) => {
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (result.data) {
      setOrder(result.data);
      if (options?.closeOnStatuses?.includes(result.data.order_status)) {
        router.back();
      }
    }
    setUpdatingStatus(null);
  };

  const handleStatusUpdate = async (selectedOrder: Order, newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(selectedOrder.id);

      let targetOrder = selectedOrder;
      if (newStatus === 'completed') {
        const latestResult = await getOrder(selectedOrder.id);
        if (latestResult.data) {
          targetOrder = latestResult.data;
          setOrder(latestResult.data);
        }
      }

      if (newStatus === 'completed' && targetOrder.payment_status === 'pending') {
        Alert.alert('Complete order', 'Select payment method', [
          { text: 'Card', onPress: () => void completeOrderWithPayment(targetOrder, 'Card') },
          { text: 'Cash', onPress: () => void completeOrderWithPayment(targetOrder, 'Cash') },
          { text: 'Cancel', style: 'cancel', onPress: () => setUpdatingStatus(null) },
        ]);
        return;
      }

      const result = await updateOrderStatus(targetOrder.id, newStatus);
      processUpdateResult(result, { closeOnStatuses: CLOSED_ORDER_STATUSES });
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
      setUpdatingStatus(null);
    }
  };

  const completeOrderWithPayment = async (selectedOrder: Order, paymentMethodDetail: 'Card' | 'Cash') => {
    const result = await updateOrderStatus(selectedOrder.id, 'completed', 'paid', paymentMethodDetail);
    processUpdateResult(result, { closeOnStatuses: CLOSED_ORDER_STATUSES });
  };

  const handlePaymentStatusUpdate = async (
    targetOrderId: string,
    newStatus: PaymentStatus,
    paymentMethodDetail?: string | null
  ) => {
    try {
      setUpdatingStatus(targetOrderId);
      const result = await updatePaymentStatus(targetOrderId, newStatus, paymentMethodDetail);
      processUpdateResult(result);
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('Error', 'Failed to update payment status');
      setUpdatingStatus(null);
    }
  };

  const handleQuickAction = async (selectedOrder: Order, action: string) => {
    const quickAction = getNextQuickAction(selectedOrder);
    if (!quickAction || quickAction.action !== action) return;
    const actionToStatus: Record<string, OrderStatus> = {
      accept: 'confirmed',
      prepare: 'preparing',
      ready: 'ready',
      completed: 'completed',
    };
    const nextStatus = actionToStatus[quickAction.action];
    if (!nextStatus) return;
    await handleStatusUpdate(selectedOrder, nextStatus);
  };

  const handleRefreshDelivery = async (selectedOrder: Order) => {
    if (selectedOrder.order_type !== 'delivery') return;

    try {
      setUpdatingStatus(selectedOrder.id);
      const result = await refreshDeliveryStatus(selectedOrder.id);
      if (result.error) {
        Alert.alert('Delivery refresh failed', result.error);
        return;
      }
      if (result.data) {
        setOrder(result.data);
      }
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePrint = async (selectedOrder: Order, selectedPrinter?: SavedPrinter | null): Promise<boolean> => {
    void selectedOrder;
    void selectedPrinter;
    Alert.alert('Receipt image unavailable', 'Please wait for the receipt preview to finish preparing.');
    return false;
  };

  const handlePrintImage = async (selectedOrder: Order, image: PrinterImageSource, selectedPrinter?: SavedPrinter | null): Promise<boolean> => {
    try {
      const settings = await loadAppSettings();
      if (selectedPrinter) {
        if (isSimulatorPrinter(selectedPrinter)) {
          setSimulatorOrder(selectedOrder);
          setPrintImageUri(image.kind === 'uri' ? image.uri : (image.previewUri ?? null));
          setSimulatorImageLabels([selectedPrinter.deviceName]);
          setShowSimulator(true);
          return true;
        }
        if (settings.printerEnabled) {
          const targetDots = settings.printerPaperWidth === '58mm' ? 384 : 576;
          const queuedJobs = enqueuePreparedPrintJobs({
            order: selectedOrder,
            source: 'manual',
            scope: 'order-detail:manual-image-direct',
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
          return true;
        }
        Alert.alert('Printer unavailable', 'Select and enable an image printer before printing.');
        return false;
      }
      const selected = resolvePrinterForSection(settings, getSectionPrintTickets(selectedOrder)[0]?.sections[0]?.sectionName || null);
      if (selected && isSimulatorPrinter(selected)) {
        setSimulatorOrder(selectedOrder);
        setPrintImageUri(image.kind === 'uri' ? image.uri : (image.previewUri ?? null));
        setSimulatorImageLabels(['Customer Copy']);
        setShowSimulator(true);
        return true;
      }

      if (settings.printerEnabled && selected) {
        const targetDots = settings.printerPaperWidth === '58mm' ? 384 : 576;
        const queuedJobs = enqueuePreparedPrintJobs({
          order: selectedOrder,
          source: 'manual',
          scope: 'order-detail:manual-image-routed',
          jobs: [{
            image,
            printer: selected,
            width: targetDots,
            label: selected.deviceName,
          }],
        });
        const queueResult = await waitForPrintJobs(queuedJobs.map((job) => job.id));
        if (!queueResult.success) {
          throw new Error(queueResult.failedJobs[0]?.error || 'Queued print job failed');
        }
        return true;
      }

      Alert.alert('Printer unavailable', 'Select and enable an image printer before printing.');
      return false;
    } catch (error) {
      console.error('Print image error:', error);
      Alert.alert('Error', 'Failed to print receipt image');
      return false;
    }
  };

  const handleSmartpayPayment = async (selectedOrder: Order) => {
    if (selectedOrder.payment_status === 'paid' || CLOSED_ORDER_STATUSES.includes(selectedOrder.order_status)) {
      return;
    }

    if (!smartpayPaired) {
      Alert.alert('SmartPay not paired', 'Pair this POS register with Smartpay before taking SmartPay payments.');
      return;
    }

    try {
      setUpdatingStatus(selectedOrder.id);
      const latestResult = await getOrder(selectedOrder.id);
      if (latestResult.error || !latestResult.data) {
        Alert.alert('Order refresh failed', latestResult.error || 'Order not found.');
        return;
      }

      const latestOrder = latestResult.data;
      setOrder(latestOrder);

      if (latestOrder.payment_status === 'paid') {
        Alert.alert('Already paid', 'This order was already paid on another POS.');
        return;
      }

      if (CLOSED_ORDER_STATUSES.includes(latestOrder.order_status)) {
        Alert.alert('Order already closed', `This order is already ${latestOrder.order_status}.`);
        return;
      }

      setSmartpayProcessing(true);
      await processSmartpayCardPayment(latestOrder.total);
      const result = await updatePaymentStatus(latestOrder.id, 'paid', 'SmartPay');
      processUpdateResult(result);
    } catch (error) {
      console.error('SmartPay payment failed:', error);
      Alert.alert('SmartPay payment failed', formatSmartpayError(error));
    } finally {
      setSmartpayProcessing(false);
      setUpdatingStatus(null);
    }
  };

  if (loading || !order) {
    return (
      <>
        <ActivityIndicator style={{ marginTop: 48 }} size="large" />
        {!order && !loading ? <Text style={{ textAlign: 'center', marginTop: 16 }}>Order not found</Text> : null}
      </>
    );
  }

  return (
    <OrderDetailModal
      visible
      order={order}
      onClose={() => router.back()}
      onOrderRefresh={setOrder}
      onPrint={handlePrint}
      onPrintImage={handlePrintImage}
      onPrintCustomerCopyImage={handlePrintImage}
      availablePrinters={settings.printerSaved}
      onCustomerPress={() => {}}
      onStatusUpdate={handleStatusUpdate}
      onPaymentStatusUpdate={handlePaymentStatusUpdate}
      onSmartpayPayment={handleSmartpayPayment}
      onQuickAction={handleQuickAction}
      onRefreshDeliveryStatus={handleRefreshDelivery}
      updatingStatus={updatingStatus}
      smartpayPaired={smartpayPaired}
      smartpayProcessing={smartpayProcessing}
      showSimulator={showSimulator}
      setShowSimulator={setShowSimulator}
      simulatorOrder={simulatorOrder}
      printImageUri={printImageUri}
      simulatorImageLabels={simulatorImageLabels}
      renderInModal={false}
      forceFullScreen
      routedKitchenPrintStrategy="first-ticket-section"
    />
  );
}
