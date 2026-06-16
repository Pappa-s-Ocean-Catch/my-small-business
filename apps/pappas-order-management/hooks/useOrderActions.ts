import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Print from 'expo-print';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { updateOrderStatus, updatePaymentStatus, getOrder } from '@/lib/orders';
import { escposPrintKitchenReceipt, escposPrintOrderImage, formatPrinterError } from '@/lib/escpos-printer';
import { generatePrintHTML } from '@/utils/orderUtils';
import type { AppSettings } from '@/lib/settings';
import { formatSmartpayError, isSmartpayPaired, processSmartpayCardPayment } from '@/lib/smartpay';

const webBaseUrl = process.env.EXPO_PUBLIC_SITE_URL;

export const useOrderActions = (
  appSettings: AppSettings,
  loadOrders: () => Promise<void>,
  onOrderUpdated?: (order: Order) => void
) => {
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [simulatorOrder, setSimulatorOrder] = useState<Order | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [printImageUri, setPrintImageUri] = useState<string | null>(null);
  const [smartpayPaired, setSmartpayPaired] = useState(false);
  const [smartpayProcessingOrderId, setSmartpayProcessingOrderId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const refreshSmartpayPaired = () => {
      isSmartpayPaired()
        .then((paired) => {
          if (mounted) setSmartpayPaired(paired);
        })
        .catch(() => {
          if (mounted) setSmartpayPaired(false);
        });
    };

    refreshSmartpayPaired();
    const id = setInterval(refreshSmartpayPaired, 10000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const triggerOrderStatusEmail = async (orderId: string, status: string) => {
    if (!webBaseUrl) {
      console.warn('[OrderActions] EXPO_PUBLIC_SITE_URL is not configured; skipping status email.');
      return;
    }
    try {
      const response = await fetch(`${webBaseUrl}/api/orders/status-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('[OrderActions] Failed to send status email:', response.status, text);
      }
    } catch (error) {
      console.error('[OrderActions] Error sending status email:', error);
    }
  };

  const handleStatusUpdate = async (order: Order, newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(order.id);

      let latestOrder = order;
      if (newStatus === 'completed') {
        const latestResult = await getOrder(order.id);
        if (latestResult.data) {
          latestOrder = latestResult.data;
          if (onOrderUpdated) {
            onOrderUpdated(latestResult.data);
          }
        } else if (latestResult.error) {
          console.warn('[OrderActions] Failed to refresh order before completion:', latestResult.error);
        }
      }

      if (newStatus === 'completed' && latestOrder.payment_status === 'pending') {
        Alert.alert('Complete Order', 'Select payment method', [
          {
            text: 'Card',
            onPress: async () => {
              const result = await updateOrderStatus(latestOrder.id, 'completed', 'paid', 'Card');
              processUpdateResult(result);
            },
          },
          {
            text: 'Cash',
            onPress: async () => {
              const result = await updateOrderStatus(latestOrder.id, 'completed', 'paid', 'Cash');
              processUpdateResult(result);
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => setUpdatingStatus(null) },
        ]);
        return;
      }

      const result = await updateOrderStatus(latestOrder.id, newStatus);
      processUpdateResult(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
      console.error('Error updating status:', error);
      setUpdatingStatus(null);
    }
  };

  const processUpdateResult = async (result: { data: Order | null; error: string | null }) => {
    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      await loadOrders();
      if (onOrderUpdated && result.data) {
        onOrderUpdated(result.data);
      }
      if (result.data?.order_status === 'ready' || result.data?.order_status === 'completed') {
        void triggerOrderStatusEmail(result.data.id, result.data.order_status);
      }
    }
    setUpdatingStatus(null);
  };

  const handlePaymentStatusUpdate = async (
    orderId: string,
    newStatus: PaymentStatus,
    paymentMethodDetail?: string | null
  ) => {
    try {
      setUpdatingStatus(orderId);
      const result = await updatePaymentStatus(orderId, newStatus, paymentMethodDetail);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        await loadOrders();
        if (onOrderUpdated && result.data) {
          onOrderUpdated(result.data);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update payment status');
      console.error('Error updating payment status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleSmartpayPayment = async (order: Order) => {
    if (order.payment_status === 'paid' || order.order_status === 'completed' || order.order_status === 'cancelled') {
      return;
    }

    const paired = await isSmartpayPaired().catch(() => false);
    setSmartpayPaired(paired);
    if (!paired) {
      Alert.alert('SmartPay not paired', 'Pair this POS register with Smartpay before taking SmartPay payments.');
      return;
    }

    try {
      setUpdatingStatus(order.id);
      setSmartpayProcessingOrderId(order.id);
      await processSmartpayCardPayment(order.total);
      const result = await updatePaymentStatus(order.id, 'paid', 'SmartPay');
      if (result.error) {
        Alert.alert('Payment update failed', result.error);
        return;
      }
      await loadOrders();
      if (onOrderUpdated && result.data) {
        onOrderUpdated(result.data);
      }
    } catch (error) {
      console.error('SmartPay live order payment failed', error);
      Alert.alert('SmartPay payment failed', formatSmartpayError(error));
    } finally {
      setSmartpayProcessingOrderId(null);
      setUpdatingStatus(null);
    }
  };

  const handleQuickAction = async (order: Order, action: string) => {
    const statusMap: Record<string, OrderStatus> = {
      accept: 'confirmed',
      prepare: 'preparing',
      ready: 'ready',
      completed: 'completed',
    };

    const newStatus = statusMap[action];
    if (!newStatus) return;

    await handleStatusUpdate(order, newStatus);
  };

  const handlePrint = async (order: Order): Promise<boolean> => {
    try {
      if (appSettings.printerSimulator) {
        setSimulatorOrder(order);
        setPrintImageUri(null); // No image URI for standard fallback print usually
        setShowSimulator(true);
        return true;
      }

      const selected = appSettings.printerSaved.find((p) => p.target === appSettings.printerSelectedTarget) || null;
      if (appSettings.printerEnabled && selected) {
        try {
          await escposPrintKitchenReceipt(order, selected, appSettings.printerCopies, 'order-actions:manual-line-print');
          return true;
        } catch (printerError) {
          console.error('Print error:', printerError);
          // Fallback handled in UI or system print
          return false;
        }
      }

      const html = generatePrintHTML(order);
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('Print error:', error);
      return false;
    }
  };

  const handlePrintImage = async (order: Order, imageUri: string): Promise<boolean> => {
    try {
      if (appSettings.printerSimulator) {
        setSimulatorOrder(order);
        setPrintImageUri(imageUri);
        setShowSimulator(true);
        return true;
      }

      const selected = appSettings.printerSaved.find((p) => p.target === appSettings.printerSelectedTarget) || null;
      if (appSettings.printerEnabled && selected) {
        try {
          const targetDots = appSettings.printerPaperWidth === '58mm' ? 384 : 576;
          await escposPrintOrderImage(imageUri, selected, appSettings.printerCopies, targetDots);
          return true;
        } catch (printerError) {
          console.error('Print image error:', printerError);
          Alert.alert('Printer error', formatPrinterError(printerError));
          return false;
        }
      }

      // Fallback to system print if image printing is not available or failed
      const html = generatePrintHTML(order);
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('Print image error:', error);
      Alert.alert('Error', 'Failed to print receipt image');
      return false;
    }
  };

  return {
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
  };

};
