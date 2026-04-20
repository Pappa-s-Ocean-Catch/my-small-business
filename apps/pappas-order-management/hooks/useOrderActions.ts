import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import * as Print from 'expo-print';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { updateOrderStatus, updatePaymentStatus, getOrder } from '@/lib/orders';
import { escposPrintKitchenReceipt, escposPrintOrderImage, formatPrinterError } from '@/lib/escpos-printer';
import { generatePrintHTML } from '@/utils/orderUtils';
import type { AppSettings } from '@/lib/settings';

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

      if (newStatus === 'completed' && order.payment_status === 'pending') {
        Alert.alert('Complete Order', 'Select payment method', [
          {
            text: 'Cash',
            onPress: async () => {
              const result = await updateOrderStatus(order.id, 'completed', 'paid', 'Cash');
              processUpdateResult(result);
            },
          },
          {
            text: 'Card',
            onPress: async () => {
              const result = await updateOrderStatus(order.id, 'completed', 'paid', 'Card');
              processUpdateResult(result);
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => setUpdatingStatus(null) },
        ]);
        return;
      }

      const result = await updateOrderStatus(order.id, newStatus);
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

  const handlePaymentStatusUpdate = async (orderId: string, newStatus: PaymentStatus) => {
    try {
      setUpdatingStatus(orderId);
      const result = await updatePaymentStatus(orderId, newStatus);
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
          await escposPrintKitchenReceipt(order, selected, appSettings.printerCopies);
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
    handleStatusUpdate,
    handlePaymentStatusUpdate,
    handleQuickAction,
    handlePrint,
    handlePrintImage,
  };

};
