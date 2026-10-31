import { AppModal as Modal } from '@/components/ui/AppModal';
import { appDialog as Alert } from '@/lib/app-dialog';
import { ActionButton as PaperButton } from '@/components/ui/ActionButton';
import { StatusBadge } from '@/components/ui';
import { fulfilmentTone, paymentTone, orderPaymentLabel } from '@/components/orders/presentation';
import { designTokens as t } from '@/lib/redesign';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Surface, Card, Divider } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReceiptTemplate } from './ReceiptTemplate';
import { PrintSimulatorModal } from './PrintSimulatorModal';
import {
  buildSectionPrintJobs,
  getSectionPrintTickets,
  hasAnySimulatorAssignment,
  resolvePrinterForSection,
} from '@/lib/printer-routing';
import { CustomerReceiptTemplate } from './CustomerReceiptTemplate';
import { usesIconOnlyOrderDetailActions } from '../utils/order-detail-layout';
import { captureReceiptForPrinter, type PrinterImageSource } from '@/lib/printer-image';
import { isSimulatorPrinter, type SavedPrinter } from '@/lib/escpos-printer';
import { buildKitchenReceiptDocument } from '@/lib/kitchen-receipt-document';
import { BRAND_COLORS } from '@/utils/brand';
import { buildInstoreInstantTicketDocument } from '@/lib/instore-instant-ticket';
import { ManualPrintButton } from '@/components/printer/ManualPrintButton';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  getDeliveryStatusColor,
  getDeliveryStatusLabel,
} from '../utils/constants';
import { getOrderFulfilmentLabel, formatOrderPaymentMethod, paymentSummary, getNextQuickAction, groupAddons, getOrderLineItemCount, getOrderNotes, getOrderOptions } from '../utils/orderUtils';
import { getOrderActionFeedback } from '../lib/order-status-feedback';
import type { AppSettings } from '../lib/settings';
import { DEFAULT_APP_SETTINGS, loadAppSettings } from '../lib/settings';
import { getPrintDeviceId } from '@/lib/print-device';
import {
  buildKitchenPrintDebugContext,
  createPrintDebugSessionId,
  type KitchenPrintDebugContext,
} from '@/lib/print-debug-footer';
import { useRouter } from 'expo-router';
import { getOrder } from '../lib/orders';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
import { getOrderPromotionSummary, isFreePromotionOrderItem } from '@/lib/promotion-summary';
import { PayByLinkModal } from './PayByLinkModal';
import { canPayByLink } from '../utils/pay-by-link';
import { getMarketplaceOrderDetail } from '@/lib/marketplace';
import {
  getManualMarketplaceSyncTarget,
  syncMarketplaceOrderOnDemand,
} from '@/lib/marketplace-sync';
import { syncMarketplaceOrderStatus } from '@/lib/marketplace-pos-order';
import { useCustomerOrderCounts } from '@/hooks/useCustomerOrderCounts';
import { useModalFocus } from '@/hooks/useModalFocus';
import { enqueuePreparedPrintJobs, waitForPrintJobs } from '@/lib/print-queue';

interface OrderDetailModalProps {
  visible: boolean;
  backgroundInert?: boolean;
  onCaptureBusyChange?: (busy: boolean) => void;
  order: Order | null;
  onClose: () => void;
  onOrderRefresh?: (order: Order) => void;
  onPrint: (order: Order, printer?: SavedPrinter | null) => Promise<boolean>;
  onPrintImage?: (order: Order, image: PrinterImageSource, printer?: SavedPrinter | null, copyType?: 'kitchen' | 'customer') => Promise<boolean>;
  onPrintCustomerCopyImage?: (order: Order, image: PrinterImageSource, printer?: SavedPrinter | null, copyType?: 'kitchen' | 'customer') => Promise<boolean>;
  onCustomerPress: (order: Order) => void;
  onStatusUpdate?: (order: Order, status: OrderStatus) => Promise<void>;
  onPaymentStatusUpdate?: (id: string, status: PaymentStatus, paymentMethodDetail?: string | null) => Promise<void>;
  onSmartpayPayment?: (order: Order) => void;
  onQuickAction?: (order: Order, action: string) => void;
  onRefreshDeliveryStatus?: (order: Order) => void;
  updatingStatus?: string | null;
  smartpayPaired?: boolean;
  smartpayProcessing?: boolean;
  // Simulator props to ensure it can be rendered on top of this modal
  showSimulator?: boolean;
  setShowSimulator?: (visible: boolean) => void;
  simulatorOrder?: Order | null;
  printImageUri?: string | null;
  simulatorImageLabels?: string[] | null;
  appSettings?: AppSettings;
  availablePrinters?: SavedPrinter[];
  renderInModal?: boolean;
  forceFullScreen?: boolean;
  routedKitchenPrintStrategy?: 'prefer-simulator' | 'first-ticket-section';
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  visible,
  backgroundInert = false,
  onCaptureBusyChange,
  order: orderProp,
  onClose,
  onOrderRefresh,
  onPrint,
  onPrintImage,
  onPrintCustomerCopyImage,
  onCustomerPress,
  onStatusUpdate,
  onPaymentStatusUpdate,
  onSmartpayPayment,
  onQuickAction,
  onRefreshDeliveryStatus,
  updatingStatus,
  smartpayPaired = false,
  smartpayProcessing = false,
  showSimulator,
  setShowSimulator,
  simulatorOrder,
  printImageUri,
  simulatorImageLabels,
  appSettings = DEFAULT_APP_SETTINGS,
  availablePrinters = [],
  renderInModal = true,
  forceFullScreen = false,
  routedKitchenPrintStrategy = 'prefer-simulator',
}) => {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscapeTablet = width >= 920;
  const isWide = width >= 920;
  const isPhoneActionLayout = usesIconOnlyOrderDetailActions(width);
  const [isCapturing, setCapturingState] = React.useState(false);
  const setIsCapturing = React.useCallback((busy: boolean) => {
    onCaptureBusyChange?.(busy);
    setCapturingState(busy);
  }, [onCaptureBusyChange]);
  const [captureTarget, setCaptureTarget] = React.useState<'kitchen' | 'customer' | null>(null);
  const [printDebugContext, setPrintDebugContext] = React.useState<KitchenPrintDebugContext | null>(null);
  const [printPreviewOrder, setPrintPreviewOrder] = React.useState<Order | null>(null);
  const [showPrinterChoice, setShowPrinterChoice] = React.useState(false);
  const [showPayByLink, setShowPayByLink] = React.useState(false);
  const [refreshedOrder, setRefreshedOrder] = React.useState<Order | null>(orderProp);
  const [isMarketplaceSyncing, setIsMarketplaceSyncing] = React.useState(false);
  const [pendingOrderAction, setPendingOrderAction] = React.useState<'cancel' | 'cash' | 'card' | null>(null);
  const order = refreshedOrder?.id === orderProp?.id ? refreshedOrder : orderProp;
  const { data: successfulOrderCounts } = useCustomerOrderCounts(order ? [order] : []);
  const successfulOrderCount = order ? successfulOrderCounts?.[order.id] : undefined;
  const modalRef = React.useRef<View>(null);
  const closeModal = React.useCallback(() => { if (!isCapturing && !smartpayProcessing) onClose(); }, [isCapturing, smartpayProcessing, onClose]);
  useModalFocus(modalRef, visible && !showSimulator && !showPayByLink && !showPrinterChoice && !backgroundInert, closeModal);
  const receiptRef = React.useRef(null);
  const customerReceiptRef = React.useRef(null);
  const orderPrintState = usePrinterAutomationStore((state) => (
    order?.id ? state.orderPrintStates[order.id] || null : null
  ));

  React.useEffect(() => {
    setRefreshedOrder(orderProp);
  }, [orderProp]);

  React.useEffect(() => {
    setPrintPreviewOrder(order);
  }, [order]);

  React.useEffect(() => {
    if (!visible || !order) return;

    let mounted = true;
    const refreshOrder = async () => {
      const latestOrderResult = await getOrder(order.id);
      if (!mounted || !latestOrderResult.data) return;
      setRefreshedOrder(latestOrderResult.data);
      onOrderRefresh?.(latestOrderResult.data);
    };

    void refreshOrder();
    const intervalId = setInterval(() => {
      void refreshOrder();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [visible, order?.id, onOrderRefresh]);

  if (!order) return null;

  const statusColor = STATUS_COLORS[order.order_status];
  const statusLabel = STATUS_LABELS[order.order_status];
  const paymentColor = order.payment_status === 'pending' ? t.color.danger : PAYMENT_STATUS_COLORS[order.payment_status];
  const paymentLabel = orderPaymentLabel(order.payment_status, order.order_status);
  const paymentMethodLabel = formatOrderPaymentMethod(order);
  const deliveryStatusColor = getDeliveryStatusColor(order.delivery_status);
  const deliveryStatusLabel = getDeliveryStatusLabel(order.delivery_status);
  const quickAction = getNextQuickAction(order);
  const isUpdating = updatingStatus === order.id;
  const requestOrderAction = async (
    action: 'cancel' | 'cash' | 'card',
    request: () => Promise<void>,
  ) => {
    setPendingOrderAction(action);
    try {
      await request();
    } finally {
      setPendingOrderAction(null);
    }
  };
  const quickActionFeedback = quickAction
    ? getOrderActionFeedback(order.id, updatingStatus ?? null, quickAction.label)
    : null;
  const rewardPointsUsed = order.reward_points_used ?? 0;
  const rewardPointsValue = order.reward_points_value ?? 0;
  const rewardPointsBalance = Number((order as Order & { reward_points_balance?: number | null }).reward_points_balance ?? 0);
  const promotionSummary = getOrderPromotionSummary(order);
  const promotionLabel = promotionSummary?.label || 'Promotion Discount';
  const lineItemCount = getOrderLineItemCount(order);
  const orderOptions = getOrderOptions(order);
  const orderNotes = getOrderNotes(order);
  const canSmartpay =
    smartpayPaired &&
    !!onSmartpayPayment &&
    order.payment_status !== 'paid' &&
    order.order_status !== 'completed' &&
    order.order_status !== 'cancelled';
  const printFeedbackTone = orderPrintState?.status === 'failed'
    ? {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
        icon: 'alert-circle-outline' as const,
        iconColor: t.color.danger,
        title: 'Print failed',
        message: orderPrintState.error || 'The last print job failed.',
      }
    : orderPrintState?.status === 'printing'
      ? {
          backgroundColor: '#dbeafe',
          borderColor: '#93c5fd',
          icon: 'printer-outline' as const,
          iconColor: t.color.primaryPressed,
          title: 'Printing',
          message: 'The printer is processing this order now.',
        }
      : orderPrintState?.status === 'queued'
        ? {
            backgroundColor: '#fef3c7',
            borderColor: '#fcd34d',
            icon: 'clock-outline' as const,
            iconColor: '#b45309',
            title: 'Queued for print',
            message: 'This print job is waiting in the queue.',
          }
        : orderPrintState?.status === 'success'
          ? {
              backgroundColor: '#dcfce7',
              borderColor: '#86efac',
              icon: 'check-circle-outline' as const,
              iconColor: '#15803d',
              title: 'Printed',
              message: 'The latest print job completed successfully.',
            }
          : null;

  const handleInternalPrint = async (printer?: SavedPrinter | null) => {
    setIsCapturing(true);
    try {
      let printOrder = order;
      const latestOrderResult = await getOrder(order.id);
      if (latestOrderResult.data) {
        printOrder = latestOrderResult.data;
        setPrintPreviewOrder(latestOrderResult.data);
      } else if (latestOrderResult.error) {
        console.warn('[OrderDetailModal] Failed to refresh order before printing:', latestOrderResult.error);
      }

      // If onPrintImage is provided, capture the template first
      if (onPrintImage) {
        const effectiveSettings = await loadAppSettings().catch(() => appSettings);
        const deviceId = await getPrintDeviceId().catch(() => 'unknown');
        const routedJobs = buildSectionPrintJobs(effectiveSettings, printOrder);
        const routedJob = printer
          ? null
          : routedKitchenPrintStrategy === 'first-ticket-section'
            ? (() => {
                const sectionName = getSectionPrintTickets(printOrder)[0]?.sections[0]?.sectionName || null;
                const resolvedPrinter = resolvePrinterForSection(effectiveSettings, sectionName);
                return resolvedPrinter ? {
                  label: `${sectionName || 'Default'} -> ${resolvedPrinter.deviceName}`,
                  sectionName,
                  printer: resolvedPrinter,
                } : null;
              })()
            : routedJobs.find((job) => !!job.printer && isSimulatorPrinter(job.printer))
              || routedJobs.find((job) => !!job.printer && !isSimulatorPrinter(job.printer))
              || null;
        const resolvedPrintPrinter = printer || routedJob?.printer || null;
        if (effectiveSettings.printerReceiptMode === 'text' && resolvedPrintPrinter && !isSimulatorPrinter(resolvedPrintPrinter)) {
          const document = buildKitchenReceiptDocument(printOrder, {
            paperWidth: effectiveSettings.printerPaperWidth,
            duplicateBySections: false,
            printDebugContext: null,
          });
          usePrinterAutomationStore.getState().addJournalEntry({
            level: 'info',
            scope: 'order-detail:manual-text-direct',
            message: 'Sending manual text receipt',
            orderId: printOrder.id,
            orderNumber: printOrder.order_number,
            details: `printer=${resolvedPrintPrinter.deviceName} driver=${resolvedPrintPrinter.driver ?? 'epsonSdk'} target=${resolvedPrintPrinter.target} paper=${effectiveSettings.printerPaperWidth} nodes=${document.nodes.length}`,
          });
          const jobs = enqueuePreparedPrintJobs({ order: printOrder, source: 'manual', scope: 'order-detail:manual-text-direct', jobs: [{ document, printer: resolvedPrintPrinter, width: effectiveSettings.printerPaperWidth === '58mm' ? 384 : 576, label: 'Kitchen', copyType: 'kitchen' }] });
          const result = await waitForPrintJobs(jobs.map((job) => job.id));
          if (!result.success) throw new Error(result.failedJobs[0]?.error || `Print outcome unknown. Check job ${jobs[0]?.id} in the printer journal before retrying.`);
          usePrinterAutomationStore.getState().addJournalEntry({
            level: 'success',
            scope: 'order-detail:manual-text-direct',
            message: 'Manual text receipt dispatch completed',
            orderId: printOrder.id,
            orderNumber: printOrder.order_number,
            details: `printer=${resolvedPrintPrinter.deviceName} driver=${resolvedPrintPrinter.driver ?? 'epsonSdk'}`,
          });
          return true;
        }
        setPrintDebugContext(buildKitchenPrintDebugContext({
          enabled: effectiveSettings.printerDebugFooter,
          registerName: effectiveSettings.registerName,
          deviceId,
          sessionId: createPrintDebugSessionId(),
          trigger: 'reprint',
          routeLabel: printer ? `Manual -> ${printer.deviceName}` : routedJob?.label || 'No resolved route',
          sectionName: routedJob?.sectionName || 'All',
          printerName: resolvedPrintPrinter?.deviceName,
          printerTarget: resolvedPrintPrinter?.target,
          printMode: 'combine',
          copies: 1,
          autoPrintEnabled: effectiveSettings.printerAutoPrint,
          autoPrintDelaySeconds: effectiveSettings.printerDelayPrintSec,
          paperWidth: appSettings.printerPaperWidth,
          highQuality: appSettings.printerHighQuality,
          capturedAt: new Date().toISOString(),
        }));
        setCaptureTarget('kitchen');
        // Small delay to ensure the hidden view is rendered
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!receiptRef.current) {
          throw new Error('Kitchen receipt preview is not ready yet.');
        }

        const targetDots = appSettings.printerPaperWidth === '58mm' ? 384 : 576;
        const scale = appSettings.printerHighQuality ? 2 : 1;

        if (!resolvedPrintPrinter) throw new Error('No printer is available for this receipt.');
        const image = await captureReceiptForPrinter(receiptRef.current, resolvedPrintPrinter, targetDots * scale, appSettings.printerHighQuality);
        return await onPrintImage(printOrder, image, resolvedPrintPrinter, 'kitchen');
      } else {
        return await onPrint(printOrder, printer);
      }
    } catch (error) {
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'error',
        scope: 'order-detail:manual-print',
        message: 'Manual receipt print failed',
        orderId: order.id,
        orderNumber: order.order_number,
        details: error instanceof Error ? error.message : String(error),
      });
      console.error('Manual receipt print failed:', error);
      Alert.alert(
        'Print error',
        error instanceof Error ? error.message : 'Failed to print receipt.'
      );
      return false;
    } finally {
      setIsCapturing(false);
      setCaptureTarget(null);
      setPrintDebugContext(null);
    }
  };

  const handleCustomerCopyPrint = async (printer?: SavedPrinter | null) => {
    if (!onPrintCustomerCopyImage) {
      Alert.alert('Customer copy unavailable', 'This screen is not ready to print the customer receipt yet.');
      return;
    }

    setIsCapturing(true);
    try {
      let printOrder = order;
      const latestOrderResult = await getOrder(order.id);
      if (latestOrderResult.data) {
        printOrder = latestOrderResult.data;
        setPrintPreviewOrder(latestOrderResult.data);
        console.log('[OrderDetailModal] refreshed customer copy order', {
          orderId: latestOrderResult.data.id,
          orderNumber: latestOrderResult.data.order_number,
          customerName: latestOrderResult.data.customer_name,
          userId: latestOrderResult.data.user_id,
          receiptClaimToken: latestOrderResult.data.receipt_claim_token,
        });
      } else if (latestOrderResult.error) {
        console.warn('[OrderDetailModal] Failed to refresh order before customer copy print:', latestOrderResult.error);
      }

      setCaptureTarget('customer');
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!customerReceiptRef.current) {
        throw new Error('Customer receipt preview is not ready yet.');
      }
      console.log('[OrderDetailModal] customer copy capture source', {
        orderId: printOrder.id,
        orderNumber: printOrder.order_number,
        customerName: printOrder.customer_name,
        userId: printOrder.user_id,
        receiptClaimToken: printOrder.receipt_claim_token,
      });

      const targetDots = appSettings.printerPaperWidth === '58mm' ? 384 : 576;
      const scale = appSettings.printerHighQuality ? 2 : 1;

      if (!printer) throw new Error('Select a printer before printing the customer receipt.');
      const image = await captureReceiptForPrinter(customerReceiptRef.current, printer, targetDots * scale, appSettings.printerHighQuality);
      return await onPrintCustomerCopyImage(printOrder, image, printer, 'customer');
    } catch (error) {
      console.error('Failed to capture customer receipt:', error);
      Alert.alert('Print error', 'Failed to prepare the customer receipt.');
      return false;
    } finally {
      setIsCapturing(false);
      setCaptureTarget(null);
    }
  };

  const handleInstantTicketPrint = async (printer?: SavedPrinter | null) => {
    setIsCapturing(true);
    try {
      let printOrder = order;
      const latestOrderResult = await getOrder(order.id);
      if (latestOrderResult.data) {
        printOrder = latestOrderResult.data;
        setPrintPreviewOrder(latestOrderResult.data);
      } else if (latestOrderResult.error) {
        console.warn('[OrderDetailModal] Failed to refresh order before ticket printing:', latestOrderResult.error);
      }

      if (!printer) throw new Error('Select a printer before printing the ticket.');
      if (isSimulatorPrinter(printer)) throw new Error('Tickets require a physical printer.');

      const document = buildInstoreInstantTicketDocument(printOrder);
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'info',
        scope: 'order-detail:manual-instant-ticket',
        message: 'Sending manual instant ticket',
        orderId: printOrder.id,
        orderNumber: printOrder.order_number,
        details: `printer=${printer.deviceName} driver=${printer.driver ?? 'epsonSdk'} target=${printer.target} nodes=${document.nodes.length}`,
      });
      const jobs = enqueuePreparedPrintJobs({ order: printOrder, source: 'manual', scope: 'order-detail:manual-instant-ticket', jobs: [{ document, printer, width: appSettings.printerPaperWidth === '58mm' ? 384 : 576, label: 'Ticket', copyType: 'ticket' }] });
      const result = await waitForPrintJobs(jobs.map((job) => job.id));
      if (!result.success) throw new Error(result.failedJobs[0]?.error || `Print outcome unknown. Check job ${jobs[0]?.id} in the printer journal before retrying.`);
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'success',
        scope: 'order-detail:manual-instant-ticket',
        message: 'Manual instant ticket dispatch completed',
        orderId: printOrder.id,
        orderNumber: printOrder.order_number,
        details: `printer=${printer.deviceName} driver=${printer.driver ?? 'epsonSdk'}`,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'error',
        scope: 'order-detail:manual-instant-ticket',
        message: 'Manual instant ticket failed',
        orderId: order.id,
        orderNumber: order.order_number,
        details: reason,
      });
      console.error('Manual instant ticket print failed:', error);
      Alert.alert('Print error', reason || 'Failed to print ticket.');
      return false;
    } finally {
      setIsCapturing(false);
    }
  };


  const renderActionButton = () => {
    if (!onQuickAction || !quickAction) return null;
    return (
      <PaperButton
        mode="contained"
        icon={quickAction.action === 'accept' ? 'check' : quickAction.action === 'prepare' ? 'chef-hat' : 'check-circle'}
        onPress={() => onQuickAction(order, quickAction.action)}
        loading={quickActionFeedback?.isUpdating}
        disabled={quickActionFeedback?.isUpdating}
        style={[styles.primaryActionButton, !isWide && styles.primaryActionButtonCompact, isPhoneActionLayout && { minWidth: 120, flexGrow: 1 }]}
        contentStyle={styles.primaryActionButtonContent}
        accessibilityLabel={quickAction.label}
      >
        {quickActionFeedback?.label ?? quickAction.label}
      </PaperButton>
    );
  };

  const showPaymentAction = onPaymentStatusUpdate && order.payment_status === 'pending';
  const showCancelAction = onStatusUpdate && order.order_status !== 'completed' && order.order_status !== 'cancelled';
  const showDeliveryRefreshAction = !!onRefreshDeliveryStatus && order.order_type === 'delivery';
  const marketplaceSyncTarget = getManualMarketplaceSyncTarget(order);

  const handleMarketplaceStatusSync = async () => {
    if (!marketplaceSyncTarget || isMarketplaceSyncing) return;

    setIsMarketplaceSyncing(true);
    try {
      const result = await syncMarketplaceOrderOnDemand({
        ...marketplaceSyncTarget,
        getOrderDetail: getMarketplaceOrderDetail,
        syncMarketplaceOrderStatus,
      });
      if (result.error || !result.order) {
        throw new Error(result.error || 'The local marketplace order could not be refreshed.');
      }
      setRefreshedOrder(result.order);
      onOrderRefresh?.(result.order);
    } catch (error) {
      Alert.alert(
        'Marketplace status sync failed',
        error instanceof Error ? error.message : 'Failed to sync marketplace order status.'
      );
    } finally {
      setIsMarketplaceSyncing(false);
    }
  };

  const content = (
      <View style={[styles.container, width < 600 && { padding: 0 }]}>
        <View ref={modalRef} accessibilityViewIsModal style={[styles.modalShell, (width < 600 || forceFullScreen) && styles.modalShellFullScreen]}>
        <View style={{ flex: 1 }} accessibilityElementsHidden={!!showSimulator || showPayByLink || showPrinterChoice || backgroundInert} importantForAccessibility={showSimulator || showPayByLink || showPrinterChoice || backgroundInert ? 'no-hide-descendants' : 'auto'} pointerEvents={showSimulator || showPayByLink || showPrinterChoice || backgroundInert ? 'none' : 'auto'}>
        {/* Header */}
        <Surface
          style={[
            styles.header,
            { paddingTop: width < 600 ? Math.max(insets.top, 0) : 0 }
          ]}
          elevation={0}
        >
          <View style={[styles.headerTop, width < 600 && { minHeight: 60, paddingHorizontal: 16 }]}><View style={styles.headerTitleBlock}><Text accessibilityRole="header" style={styles.headerTitle}>Order #{getFriendlyOrderNumber(order.order_number)}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open customer ${order.customer_name || 'Customer'}`} disabled={isCapturing || smartpayProcessing} hitSlop={8} onPress={() => onCustomerPress(order)}><Text style={styles.headerMeta}>{order.customer_name || 'Customer'} · {getOrderFulfilmentLabel(order)}</Text></TouchableOpacity></View><IconButton icon="close" hitSlop={4} accessibilityLabel="Close order details" disabled={isCapturing || smartpayProcessing} onPress={closeModal} style={styles.closeControl} /></View>

        </Surface>

        <ScrollView style={styles.scrollContent} contentContainerStyle={[styles.scrollContainer, isWide && styles.scrollContainerWide, width < 600 && { padding: 14 }]}>
          <View style={styles.headerSub}>
            <StatusBadge label={statusLabel} tone={fulfilmentTone(order.order_status)} />
            <StatusBadge label={paymentLabel} tone={paymentTone(order.payment_status)} />
            <Text style={styles.timeText}>{new Date(order.created_at).toLocaleString()}</Text>
          </View>
          {order.scheduled_pickup_at && (
            <View style={styles.scheduledInfo}>
              <MaterialCommunityIcons name="calendar-clock" size={16} color={t.color.warning} />
              <Text style={styles.scheduledText}>
                Scheduled Pickup: {new Date(order.scheduled_pickup_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </View>
          )}
          <View style={styles.contentStack}>
            {printFeedbackTone ? (
              <View style={[styles.printFeedbackBanner, { backgroundColor: printFeedbackTone.backgroundColor, borderColor: printFeedbackTone.borderColor }]}>
                <MaterialCommunityIcons
                  name={printFeedbackTone.icon}
                  size={20}
                  color={printFeedbackTone.iconColor}
                />
                <View style={styles.printFeedbackCopy}>
                  <Text style={styles.printFeedbackTitle}>{printFeedbackTone.title}</Text>
                  <Text style={styles.printFeedbackMessage}>{printFeedbackTone.message}</Text>
                </View>
              </View>
            ) : null}
            <View style={[styles.orderDetailContent, isLandscapeTablet && styles.orderDetailContentLandscape]}>
            <View style={[styles.summaryGrid, isWide && styles.summaryGridWide, isLandscapeTablet && styles.summaryGridLandscape]}>
              <Card mode="outlined" style={[styles.infoCard, isWide && styles.summaryCard]}>
                <Card.Title title="Customer" titleStyle={styles.cardTitle} />
                <Card.Content>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Open customer ${order.customer_name || 'Customer'}`}
                    disabled={isCapturing || smartpayProcessing}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                    onPress={() => onCustomerPress(order)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                  <Text style={styles.customerName}>{order.customer_name || 'N/A'}</Text>
                  </TouchableOpacity>
                  {!!order.customer_email && <Text style={styles.contactText}>{order.customer_email}</Text>}
                  {!!order.customer_phone && <Text style={styles.contactText}>{order.customer_phone}</Text>}
                  {successfulOrderCount != null && successfulOrderCount > 0 ? <Text style={styles.successfulOrderCount}>{successfulOrderCount} successful orders</Text> : null}
                </Card.Content>
              </Card>

              {order.order_type === 'delivery' ? (
                <Card mode="outlined" style={[styles.infoCard, isWide && styles.summaryCard]}>
                  <Card.Title title="Delivery" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="truck-delivery" />} />
                  <Card.Content>
                    <View style={styles.deliveryStatusHeader}>
                      <View style={[styles.deliveryStatusBadge, { backgroundColor: deliveryStatusColor }]}>
                        <Text style={styles.deliveryStatusBadgeText}>{deliveryStatusLabel}</Text>
                      </View>
                    </View>
                    {!!order.delivery_driver_name && <Text style={styles.deliveryDetailText}>Driver: {order.delivery_driver_name}</Text>}
                    {!!order.delivery_driver_phone && <Text style={styles.deliveryDetailText}>Phone: {order.delivery_driver_phone}</Text>}
                    {!!order.delivery_driver_pin && <Text style={styles.deliveryDetailText}>PIN: {order.delivery_driver_pin}</Text>}
                    {!!order.delivery_vehicle_info && <Text style={styles.deliveryDetailText}>Vehicle: {order.delivery_vehicle_info}</Text>}
                    {!!order.delivery_provider_id && <Text style={styles.deliveryMetaText}>Provider Ref: {order.delivery_provider_id}</Text>}
                    {!!order.delivery_tracking_url && (
                      <TouchableOpacity onPress={() => Linking.openURL(order.delivery_tracking_url!)}>
                        <Text style={styles.deliveryTrackingLink}>Open Tracking</Text>
                      </TouchableOpacity>
                    )}
                    {!!order.delivery_instructions && <Text style={styles.deliveryInstructionsText}>Instructions: {order.delivery_instructions}</Text>}
                  </Card.Content>
                </Card>
              ) : null}

              <Card mode="outlined" style={[styles.infoCard, isWide && styles.summaryCard]}>
                <Card.Title title="Order total" titleStyle={styles.cardTitle} />
                <Card.Content>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total items</Text>
                    <Text style={styles.totalValue}>{lineItemCount}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Payment status</Text>
                    <Text style={[styles.totalValue, { color: paymentColor }]}>{paymentLabel}</Text>
                  </View>
                  {order.payment_status === 'paid' ? (
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Payment method</Text>
                      <Text style={styles.totalValue}>{paymentMethodLabel}</Text>
                    </View>
                  ) : null}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>${order.subtotal.toFixed(2)}</Text>
                  </View>
                  {order.tax > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax</Text>
                  <Text style={styles.totalValue}>${order.tax.toFixed(2)}</Text>
                </View>
              )}
              {order.delivery_fee > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Delivery Fee</Text>
                  <Text style={styles.totalValue}>${order.delivery_fee.toFixed(2)}</Text>
                </View>
              )}
              {order.promotion_discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: t.color.primary }]}>{promotionLabel}</Text>
                  <Text style={[styles.totalValue, { color: t.color.primary }]}>-${order.promotion_discount.toFixed(2)}</Text>
                </View>
              )}
              {order.coupon_discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: t.color.primary }]}>
                    {order.coupon_code ? `Coupon (${order.coupon_code})` : 'Coupon Discount'}
                  </Text>
                  <Text style={[styles.totalValue, { color: t.color.primary }]}>-${order.coupon_discount.toFixed(2)}</Text>
                </View>
              )}
              {rewardPointsUsed > 0 && rewardPointsValue > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: t.color.primary }]}>
                    Points Applied ({rewardPointsUsed.toLocaleString()} pts)
                  </Text>
                  <Text style={[styles.totalValue, { color: t.color.primary }]}>-${rewardPointsValue.toFixed(2)}</Text>
                </View>
              )}
              {rewardPointsBalance > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Points Balance</Text>
                  <Text style={styles.totalValue}>{rewardPointsBalance.toLocaleString()}</Text>
                </View>
              )}
              {order.service_fee > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Service Fee</Text>
                  <Text style={styles.totalValue}>${order.service_fee.toFixed(2)}</Text>
                </View>
              )}
              <Divider style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.finalTotalLabel}>Grand Total</Text>
                <Text style={styles.finalTotalValue}>${order.total.toFixed(2)}</Text>
              </View>
                </Card.Content>
              </Card>
            </View>

            <View style={[styles.orderDetailPrimary, isLandscapeTablet && styles.orderDetailPrimaryLandscape]}>
            <Card mode="outlined" style={styles.infoCard}>
              <Card.Title
                title={`Items · ${lineItemCount}`}
                titleStyle={styles.cardTitle}
              />
              <Card.Content>
                {orderOptions.map((option, index) => (
                  <View key={`order-option-${index}`} style={styles.optionRow}>
                    <MaterialCommunityIcons name="asterisk" size={16} color={t.color.primary} />
                    <Text style={styles.optionText}>{option}</Text>
                  </View>
                ))}
                {order.items?.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.quantity}x {item.product_name}</Text>
                      {isFreePromotionOrderItem(order, item.product_name) ? (
                        <View style={styles.itemPriceGroup}>
                          <Text style={styles.itemPriceFree}>FREE</Text>
                          <Text style={styles.itemPriceOriginal}>${item.subtotal.toFixed(2)}</Text>
                        </View>
                      ) : (
                        <Text style={styles.itemPrice}>${item.subtotal.toFixed(2)}</Text>
                      )}
                    </View>
                    {item.comment && <Text style={styles.itemComment}>Note: {item.comment}</Text>}
                    {((item.removed_ingredients && item.removed_ingredients.length > 0) || (item.addons && item.addons.length > 0)) && (
                      <View style={styles.addonsList}>
                        {item.removed_ingredients?.map((ing, rIdx) => (
                          <Text key={`rm-${rIdx}`} style={styles.removedText}>
                            No {ing}
                          </Text>
                        ))}
                        {item.addons && item.addons.length > 0 &&
                          groupAddons(item.addons).map((addon, aIdx) => (
                            <Text key={`ad-${aIdx}`} style={styles.addonText}>
                              {addon.quantity > 1 ? `${addon.quantity}x ` : '+ '}{addon.name} {addon.price > 0 ? `($${addon.price.toFixed(2)})` : ''}
                            </Text>
                          ))
                        }
                      </View>
                    )}
                    {index < (order.items?.length || 0) - 1 && <Divider style={styles.divider} />}
                  </View>
                ))}
              </Card.Content>
            </Card>

            {orderNotes && (
              <Card mode="outlined" style={[styles.infoCard, styles.instructionsCard]}>
                <Card.Title title="Order notes" titleStyle={styles.cardTitle} />
                <Card.Content>
                  <Text style={styles.instructionsText}>{orderNotes}</Text>
                </Card.Content>
              </Card>
            )}
            </View>
            </View>
          </View>
        </ScrollView>
        {/* Fixed action bar */}
        <Surface
          style={[
            styles.actionBar,
            { paddingBottom: isWide ? 16 : Math.max(insets.bottom, 16) }
          ]}
          elevation={0}
        >
          <View style={styles.secondaryActions}>
            <ManualPrintButton
              onVisibilityChange={setShowPrinterChoice}
              printers={availablePrinters}
              label="Print order"
              icon="printer"
              loading={isCapturing}
              disabled={isCapturing}
              onSelectPrinter={handleInternalPrint}
              printModes={[
                { label: 'Kitchen', icon: 'chef-hat', onSelectPrinter: handleInternalPrint },
                { label: 'Customer Copy', icon: 'receipt-text-outline', disabled: !onPrintCustomerCopyImage, onSelectPrinter: handleCustomerCopyPrint },
                { label: 'Ticket', icon: 'ticket-confirmation-outline', onSelectPrinter: handleInstantTicketPrint },
              ]}
              mode="button"
              style={isPhoneActionLayout ? { minWidth: 112 } : undefined}
            />
            {showDeliveryRefreshAction && (
              <PaperButton
                mode="outlined"
                icon="refresh"
                onPress={() => onRefreshDeliveryStatus(order)}
                disabled={isUpdating}
                loading={isUpdating}
                style={[styles.actionButton, isPhoneActionLayout ? styles.phoneActionButton : null]}
                contentStyle={isPhoneActionLayout ? styles.phoneActionButtonContent : undefined}
                compact={!isWide}
                accessibilityLabel="Refresh delivery"
              >
                {isPhoneActionLayout ? '' : 'Refresh Delivery'}
              </PaperButton>
            )}
            {marketplaceSyncTarget && (
              <PaperButton
                mode="outlined"
                icon="sync"
                onPress={handleMarketplaceStatusSync}
                disabled={isMarketplaceSyncing || isUpdating}
                loading={isMarketplaceSyncing}
                style={[styles.actionButton, isPhoneActionLayout ? styles.phoneActionButton : null]}
                contentStyle={isPhoneActionLayout ? styles.phoneActionButtonContent : undefined}
                compact={!isWide}
                accessibilityLabel="Sync marketplace status"
              >
                {isPhoneActionLayout ? '' : 'Sync marketplace status'}
              </PaperButton>
            )}
            {showCancelAction && (
              <PaperButton
                mode="outlined"
                icon="cancel"
                textColor={t.color.danger}
                onPress={() => {
                  Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes, Cancel', onPress: () => void requestOrderAction('cancel', () => onStatusUpdate!(order, 'cancelled')), style: 'destructive' }
                  ]);
                }}
                disabled={isUpdating || pendingOrderAction !== null}
                loading={pendingOrderAction === 'cancel'}
                style={[styles.actionButton, isPhoneActionLayout ? styles.phoneActionButton : null]}
                contentStyle={isPhoneActionLayout ? styles.phoneActionButtonContent : undefined}
                compact={!isWide}
                accessibilityLabel="Cancel order"
              >
                {isPhoneActionLayout ? 'Cancel' : 'Cancel order'}
              </PaperButton>
            )}
            {order.payment_status !== 'paid' && order.order_status !== 'completed' && order.order_status !== 'cancelled' && (
              <PaperButton
                mode="outlined"
                icon="pencil"
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/pos', params: { orderId: order.id } });
                }}
                style={[styles.actionButton, isPhoneActionLayout ? styles.phoneActionButton : null]}
                contentStyle={isPhoneActionLayout ? styles.phoneActionButtonContent : undefined}
                compact={!isWide}
                accessibilityLabel="Edit order"
              >
                {isPhoneActionLayout ? '' : 'Edit'}
              </PaperButton>
            )}
            {showPaymentAction && (
              <PaperButton
                mode="outlined"
                icon="cash"
                onPress={() => void requestOrderAction('cash', () => onPaymentStatusUpdate!(order.id, 'paid', 'Cash'))}
                loading={pendingOrderAction === 'cash'}
                disabled={isUpdating || pendingOrderAction !== null}
                style={[styles.actionButton, isPhoneActionLayout ? styles.phoneActionButton : null]}
                contentStyle={isPhoneActionLayout ? styles.phoneActionButtonContent : undefined}
                compact={!isWide}
                accessibilityLabel="Mark paid by cash"
              >
                {isPhoneActionLayout ? '' : 'Cash'}
              </PaperButton>
            )}
            {showPaymentAction && (
              <PaperButton
                mode="outlined"
                icon="credit-card-outline"
                onPress={() => void requestOrderAction('card', () => onPaymentStatusUpdate!(order.id, 'paid', 'Card'))}
                loading={pendingOrderAction === 'card'}
                disabled={isUpdating || pendingOrderAction !== null}
                style={[styles.actionButton, isPhoneActionLayout ? styles.phoneActionButton : null]}
                contentStyle={isPhoneActionLayout ? styles.phoneActionButtonContent : undefined}
                compact={!isWide}
                accessibilityLabel="Mark paid by card"
              >
                {isPhoneActionLayout ? '' : 'Card'}
              </PaperButton>
            )}
            {canSmartpay && (
              <PaperButton
                mode="outlined"
                icon="credit-card-wireless-outline"
                onPress={() => onSmartpayPayment(order)}
                loading={smartpayProcessing}
                disabled={smartpayProcessing || isUpdating}
                style={[styles.actionButton, isPhoneActionLayout ? styles.phoneActionButton : null]}
                contentStyle={isPhoneActionLayout ? styles.phoneActionButtonContent : undefined}
                compact={!isWide}
                accessibilityLabel="Pay with SmartPay"
              >
                {isPhoneActionLayout ? '' : 'SmartPay'}
              </PaperButton>
            )}
            {canPayByLink(order) && (
              <PaperButton mode="outlined" icon="qrcode-scan" onPress={() => setShowPayByLink(true)} style={[styles.actionButton, isPhoneActionLayout ? styles.phoneActionButton : null]} contentStyle={isPhoneActionLayout ? styles.phoneActionButtonContent : undefined} compact={!isWide} accessibilityLabel="Pay by link">
                {isPhoneActionLayout ? '' : 'Pay by Link'}
              </PaperButton>
            )}
          </View>
          {renderActionButton()}
        </Surface>

        </View>
        {/* Hidden Receipt Template for capture */}
        {captureTarget ? (
          <View style={styles.hiddenReceiptContainer} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {captureTarget === 'kitchen' ? (
              <View ref={receiptRef} collapsable={false}>
                <ReceiptTemplate
                  order={printPreviewOrder || order}
                  successfulOrderCount={successfulOrderCount}
                  width={appSettings.printerPaperWidth === '58mm' ? 384 : 576}
                  printSource="order-detail-modal:capture"
                  showTicketCounter={hasAnySimulatorAssignment(appSettings)}
                  printDebugContext={printDebugContext}
                />
              </View>
            ) : null}
            {captureTarget === 'customer' ? (
              <View ref={customerReceiptRef} collapsable={false}>
                <CustomerReceiptTemplate
                  order={printPreviewOrder || order}
                  width={appSettings.printerPaperWidth === '58mm' ? 384 : 576}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <PrintSimulatorModal
          visible={!!showSimulator}
          order={simulatorOrder || null}
          imageUri={printImageUri || null}
          imageLabels={simulatorImageLabels || undefined}
          useModal={false}
          onClose={() => setShowSimulator?.(false)}
        />
        <PayByLinkModal
          visible={showPayByLink}
          order={order}
          onDismiss={() => setShowPayByLink(false)}
          onOrderRefresh={(updatedOrder) => onOrderRefresh?.(updatedOrder)}
        />
        {smartpayProcessing && (
          <View style={styles.smartpayOverlay} pointerEvents="auto">
            <View style={styles.smartpayPanel}>
              <ActivityIndicator size="large" color={t.color.primary} />
              <Text style={styles.smartpayTitle}>SmartPay payment</Text>
              <Text style={styles.smartpayText}>Waiting for terminal transaction to finish.</Text>
              <Text style={styles.smartpayAmount}>${order.total.toFixed(2)}</Text>
            </View>
          </View>
        )}
        </View>
      </View>
  );

  if (!renderInModal) {
    return content;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={closeModal}>
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(15, 35, 42, 0.48)', padding: 12, alignItems: 'center', justifyContent: 'center' },
  modalShell: { flex: 1, width: '100%', maxWidth: 1600, backgroundColor: t.color.background, borderRadius: 24, overflow: 'hidden' },
  modalShellFullScreen: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  header: {
    paddingBottom: 0,
    backgroundColor: t.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 18, paddingRight: 18, paddingVertical: 10, minHeight: 64 },
  headerTitleBlock: { flex: 1, paddingRight: 12 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: t.color.text },
  closeControl: { width: 40, height: 40, margin: 0, borderRadius: 20, backgroundColor: '#F0F4F3' },
  headerMeta: { fontSize: 14, color: t.color.muted, fontWeight: '600', marginTop: 4 },
  headerSub: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, gap: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  timeText: { fontSize: 14, color: t.color.muted },
  scheduledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 12,
    gap: 6,
  },
  scheduledText: {
    fontSize: 14,
    fontWeight: '700',
    color: t.color.warning,
  },
  scrollContent: { flex: 1 },
  scrollContainer: { padding: 18, paddingBottom: 24 },
  scrollContainerWide: { padding: 18, paddingBottom: 24 },
  contentStack: { gap: 14 },
  orderDetailContent: { gap: 16, flexDirection: 'column-reverse' },
  orderDetailContentLandscape: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 20 },
  printFeedbackBanner: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  printFeedbackCopy: {
    flex: 1,
    gap: 2,
  },
  printFeedbackTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: t.color.navy,
  },
  printFeedbackMessage: {
    fontSize: 13,
    color: t.color.muted,
    lineHeight: 18,
  },
  summaryGrid: { gap: 14 },
  summaryGridWide: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  summaryGridLandscape: { width: '38%', flexShrink: 0, flexDirection: 'column' },
  orderDetailPrimary: { gap: 14 },
  orderDetailPrimaryLandscape: { flex: 1, minWidth: 0 },
  summaryCard: { flex: 1, alignSelf: 'stretch' },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: t.radius.card,
    borderColor: t.color.border,
    shadowColor: t.color.navy,
    shadowOpacity: 0,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 0,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: t.color.text },
  customerName: { fontSize: 18, fontWeight: 'bold', color: t.color.text, marginBottom: 4 },
  successfulOrderCount: { fontSize: 14, fontWeight: '600', color: t.color.muted, marginTop: 6 },
  contactText: { fontSize: 14, color: t.color.muted, marginBottom: 2 },
  itemRow: { paddingVertical: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  optionText: { fontSize: 16, fontWeight: '900', color: t.color.navy },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  itemName: { fontSize: 16, fontWeight: '600', color: t.color.text, flex: 1 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: t.color.text },
  itemPriceGroup: { alignItems: 'flex-end' },
  itemPriceFree: { fontSize: 16, fontWeight: 'bold', color: '#059669' },
  itemPriceOriginal: { fontSize: 12, color: t.color.muted, textDecorationLine: 'line-through' },
  itemComment: { fontSize: 14, color: '#b45309', fontStyle: 'italic', marginTop: 4 },
  addonsList: { marginTop: 4, paddingLeft: 12 },
  addonText: { fontSize: 13, color: t.color.muted },
  removedText: { fontSize: 13, color: t.color.text, fontWeight: 'bold' },
  divider: { marginTop: 12 },
  instructionsCard: { minHeight: 110 },
  instructionsText: { fontSize: 15, color: t.color.muted, lineHeight: 22 },
  deliveryStatusHeader: { marginBottom: 10 },
  deliveryStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deliveryStatusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  deliveryDetailText: { fontSize: 14, color: '#1f2937', fontWeight: '600', marginBottom: 6 },
  deliveryMetaText: { fontSize: 13, color: t.color.muted, marginBottom: 6 },
  deliveryTrackingLink: { fontSize: 14, color: t.color.primary, fontWeight: '700', marginBottom: 6 },
  deliveryInstructionsText: { marginTop: 4, fontSize: 14, color: '#374151', lineHeight: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 14, color: t.color.muted },
  totalValue: { fontSize: 14, color: t.color.text, fontWeight: '500' },
  totalDivider: { marginVertical: 12 },
  finalTotalLabel: { fontSize: 18, fontWeight: 'bold', color: t.color.text },
  finalTotalValue: { fontSize: 28, fontWeight: '700', color: t.color.text },
  actionBar: {
    marginTop: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    backgroundColor: t.color.surface,
    borderTopWidth: 1,
    borderTopColor: t.color.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10
  },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  actionButton: { borderRadius: 12, borderColor: t.color.border, backgroundColor: '#fff' },
  phoneActionButton: { flexGrow: 0, width: 48, minWidth: 0, borderWidth: 1, borderColor: t.color.border, backgroundColor: '#fff' },
  phoneActionButtonContent: { width: 48, height: 48, marginHorizontal: 0 },
  phoneActionIconButton: { width: 48, height: 48, margin: 0, borderWidth: 1, borderColor: t.color.border, borderRadius: 12, backgroundColor: '#fff' },
  primaryActionButton: { flexGrow: 0, minWidth: 0, borderRadius: t.radius.control, backgroundColor: t.color.primary },
  primaryActionButtonCompact: { flexGrow: 0 },
  primaryActionButtonContent: { height: 48 },
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
    zIndex: 200,
  },
  smartpayPanel: {
    width: '100%',
    maxWidth: 360,
    borderRadius: t.radius.control,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.color.border,
  },
  smartpayTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: t.color.text,
  },
  smartpayText: {
    marginTop: 8,
    fontSize: 14,
    color: t.color.muted,
    textAlign: 'center',
  },
  smartpayAmount: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '900',
    color: t.color.text,
  },
});
