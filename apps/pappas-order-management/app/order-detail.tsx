import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { ActivityIndicator, Text } from 'react-native-paper';
import { getOrder, updateOrderStatus, updatePaymentStatus } from '../lib/orders';
import { loadAppSettings } from '../lib/settings';
import { escposPrintKitchenReceipt, escposPrintOrderImage, formatPrinterError } from '../lib/escpos-printer';
import { formatSmartpayError, isSmartpayPaired, processSmartpayCardPayment } from '../lib/smartpay';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { generatePrintHTML, getNextQuickAction } from '../utils/orderUtils';

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

  useEffect(() => {
    void loadOrder();
    isSmartpayPaired().then(setSmartpayPaired).catch(() => setSmartpayPaired(false));
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

  const processUpdateResult = (result: { data: Order | null; error: string | null }) => {
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (result.data) {
      setOrder(result.data);
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
      processUpdateResult(result);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
      setUpdatingStatus(null);
    }
  };

  const completeOrderWithPayment = async (selectedOrder: Order, paymentMethodDetail: 'Card' | 'Cash') => {
    const result = await updateOrderStatus(selectedOrder.id, 'completed', 'paid', paymentMethodDetail);
    processUpdateResult(result);
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

  const handlePrint = async (selectedOrder: Order): Promise<boolean> => {
    try {
      const settings = await loadAppSettings();
      if (settings.printerSimulator) {
        setSimulatorOrder(selectedOrder);
        setPrintImageUri(null);
        setSimulatorImageLabels([]);
        setShowSimulator(true);
        return true;
      }

      const selected = settings.printerSaved.find((printer) => printer.target === settings.printerSelectedTarget) || null;
      if (settings.printerEnabled && selected) {
        try {
          await escposPrintKitchenReceipt(selectedOrder, selected, settings.printerCopies, 'order-detail-screen:manual-line-print');
          return true;
        } catch (printerError) {
          Alert.alert(
            'Printer error',
            formatPrinterError(printerError),
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'System Print',
                onPress: () => void Print.printAsync({ html: generatePrintHTML(selectedOrder) }),
              },
            ]
          );
          return false;
        }
      }

      await Print.printAsync({ html: generatePrintHTML(selectedOrder) });
      return true;
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Error', 'Failed to print order');
      return false;
    }
  };

  const handlePrintImage = async (selectedOrder: Order, imageUri: string): Promise<boolean> => {
    try {
      const settings = await loadAppSettings();
      if (settings.printerSimulator) {
        setSimulatorOrder(selectedOrder);
        setPrintImageUri(imageUri);
        setSimulatorImageLabels(['Customer Copy']);
        setShowSimulator(true);
        return true;
      }

      const selected = settings.printerSaved.find((printer) => printer.target === settings.printerSelectedTarget) || null;
      if (settings.printerEnabled && selected) {
        const targetDots = settings.printerPaperWidth === '58mm' ? 384 : 576;
        await escposPrintOrderImage(imageUri, selected, settings.printerCopies, targetDots);
        return true;
      }

      await Print.printAsync({ html: generatePrintHTML(selectedOrder) });
      return true;
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
      onCustomerPress={() => {}}
      onStatusUpdate={handleStatusUpdate}
      onPaymentStatusUpdate={handlePaymentStatusUpdate}
      onSmartpayPayment={handleSmartpayPayment}
      onQuickAction={handleQuickAction}
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
    />
  );
}
