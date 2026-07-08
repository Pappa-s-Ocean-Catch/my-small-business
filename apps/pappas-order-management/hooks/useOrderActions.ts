import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Print from 'expo-print';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { updateOrderStatus, updatePaymentStatus, getOrder } from '@/lib/orders';
import { escposPrintKitchenReceipt, escposPrintOrderImage, formatPrinterError } from '@/lib/escpos-printer';
import { buildSectionPrintJobs, getSectionPrintTickets, getSectionRoutingDebugLabel, hasAnySimulatorAssignment, resolvePrinterForSection, shouldSkipPrintForSection, shouldUseSimulatorForSection } from '@/lib/printer-routing';
import { generatePrintHTML } from '@/utils/orderUtils';
import { loadAppSettings, type AppSettings } from '@/lib/settings';
import { formatSmartpayError, isSmartpayPaired, processSmartpayCardPayment } from '@/lib/smartpay';

const webBaseUrl = process.env.EXPO_PUBLIC_SITE_URL;
const CLOSED_ORDER_STATUSES: OrderStatus[] = ['completed', 'cancelled'];

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
  const [printImageUris, setPrintImageUris] = useState<string[]>([]);
  const [printImageLabels, setPrintImageLabels] = useState<string[]>([]);
  const [smartpayPaired, setSmartpayPaired] = useState(false);
  const [smartpayProcessingOrderId, setSmartpayProcessingOrderId] = useState<string | null>(null);

  const getEffectiveSettings = async (): Promise<AppSettings> => {
    try {
      return await loadAppSettings();
    } catch {
      return appSettings;
    }
  };

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

  const refreshLatestOrder = async (order: Order): Promise<Order | null> => {
    const latestResult = await getOrder(order.id);
    if (latestResult.data) {
      if (onOrderUpdated) {
        onOrderUpdated(latestResult.data);
      }
      return latestResult.data;
    }

    if (latestResult.error) {
      Alert.alert('Order refresh failed', latestResult.error);
    }

    return null;
  };

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
            onPress: async () => completeOrderWithPayment(latestOrder, 'Card'),
          },
          {
            text: 'Cash',
            onPress: async () => completeOrderWithPayment(latestOrder, 'Cash'),
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

  const completeOrderWithPayment = async (order: Order, paymentMethodDetail: 'Card' | 'Cash') => {
    const result = await updateOrderStatus(order.id, 'completed', 'paid', paymentMethodDetail);
    await processUpdateResult(result);
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
    if (order.payment_status === 'paid' || CLOSED_ORDER_STATUSES.includes(order.order_status)) {
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
      const latestOrder = await refreshLatestOrder(order);
      if (!latestOrder) {
        return;
      }

      if (latestOrder.payment_status === 'paid') {
        Alert.alert('Already paid', 'This order was already paid on another POS.');
        return;
      }

      if (CLOSED_ORDER_STATUSES.includes(latestOrder.order_status)) {
        Alert.alert('Order already closed', `This order is already ${latestOrder.order_status}. Refreshing the screen now.`);
        await loadOrders();
        return;
      }

      setSmartpayProcessingOrderId(order.id);
      await processSmartpayCardPayment(latestOrder.total);
      const result = await updatePaymentStatus(latestOrder.id, 'paid', 'SmartPay');
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
      const effectiveSettings = await getEffectiveSettings();

      const jobs = buildSectionPrintJobs(effectiveSettings, order);
      const simulatorJobs = jobs.filter((job) => job.useSimulator);
      const printerJobs = jobs.filter((job) => !job.useSimulator && !!job.printer);
      if (simulatorJobs.length > 0) {
        setSimulatorOrder(order);
        setPrintImageUri(null); // No image URI for standard fallback print usually
        setPrintImageUris([]);
        setPrintImageLabels(simulatorJobs.map((job) => job.label));
        setShowSimulator(true);
        return true;
      }

      if (printerJobs.length === 0) {
        return true;
      }
      if (effectiveSettings.printerEnabled) {
        try {
          for (const job of printerJobs) {
            await escposPrintKitchenReceipt(order, job.printer!, 1, 'order-actions:manual-line-print', {
              duplicateBySections: job.duplicateBySections,
              onlyTicketIndex: job.onlyTicketIndex,
            });
          }
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
      const effectiveSettings = await getEffectiveSettings();
      const tickets = getSectionPrintTickets(order);
      const jobs = buildSectionPrintJobs(effectiveSettings, order);

      if (effectiveSettings.printerSimulator || hasAnySimulatorAssignment(effectiveSettings)) {
        setSimulatorOrder(order);
        setPrintImageUri(imageUri);
        setPrintImageUris([imageUri]);
        setPrintImageLabels([jobs[0]?.label || getSectionRoutingDebugLabel(effectiveSettings, tickets[0]?.sections[0]?.sectionName || null)]);
        setShowSimulator(true);
        return true;
      }

      const firstPrinterJob = jobs.find((job) => !job.useSimulator && !!job.printer) || null;
      if (!firstPrinterJob) {
        return true;
      }

      if (effectiveSettings.printerEnabled) {
        try {
          const targetDots = effectiveSettings.printerPaperWidth === '58mm' ? 384 : 576;
          await escposPrintOrderImage(imageUri, firstPrinterJob.printer!, 1, targetDots);
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
  };

};
