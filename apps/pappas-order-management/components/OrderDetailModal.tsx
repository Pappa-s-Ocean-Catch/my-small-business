import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, useWindowDimensions, Alert, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button as PaperButton, IconButton, Surface, Card, Divider } from 'react-native-paper';
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
import { usesIconOnlyOrderDetailActions, usesLandscapeTabletOrderDetailLayout } from '../utils/order-detail-layout';
import { captureReceiptForPrinter, type PrinterImageSource } from '@/lib/printer-image';
import { escposPrintDocument, isSimulatorPrinter, type SavedPrinter } from '@/lib/escpos-printer';
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
import { formatOrderPaymentMethod, paymentSummary, getNextQuickAction, groupAddons, getOrderLineItemCount, getOrderNotes, getOrderOptions } from '../utils/orderUtils';
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

interface OrderDetailModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onOrderRefresh?: (order: Order) => void;
  onPrint: (order: Order, printer?: SavedPrinter | null) => Promise<boolean>;
  onPrintImage?: (order: Order, image: PrinterImageSource, printer?: SavedPrinter | null) => Promise<boolean>;
  onPrintCustomerCopyImage?: (order: Order, image: PrinterImageSource, printer?: SavedPrinter | null) => Promise<boolean>;
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
  const isLandscapeTablet = usesLandscapeTabletOrderDetailLayout(width, height);
  const isWide = width >= 920 && !isLandscapeTablet;
  const isPhoneActionLayout = usesIconOnlyOrderDetailActions(width);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [captureTarget, setCaptureTarget] = React.useState<'kitchen' | 'customer' | null>(null);
  const [printDebugContext, setPrintDebugContext] = React.useState<KitchenPrintDebugContext | null>(null);
  const [printPreviewOrder, setPrintPreviewOrder] = React.useState<Order | null>(null);
  const [showPayByLink, setShowPayByLink] = React.useState(false);
  const [refreshedOrder, setRefreshedOrder] = React.useState<Order | null>(orderProp);
  const [isMarketplaceSyncing, setIsMarketplaceSyncing] = React.useState(false);
  const [pendingOrderAction, setPendingOrderAction] = React.useState<'cancel' | 'cash' | 'card' | null>(null);
  const order = refreshedOrder?.id === orderProp?.id ? refreshedOrder : orderProp;
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
  const paymentColor = PAYMENT_STATUS_COLORS[order.payment_status];
  const paymentLabel = PAYMENT_STATUS_LABELS[order.payment_status];
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
        iconColor: '#b91c1c',
        title: 'Print failed',
        message: orderPrintState.error || 'The last print job failed.',
      }
    : orderPrintState?.status === 'printing'
      ? {
          backgroundColor: '#dbeafe',
          borderColor: '#93c5fd',
          icon: 'printer-outline' as const,
          iconColor: '#1d4ed8',
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
          await escposPrintDocument(document, resolvedPrintPrinter);
          usePrinterAutomationStore.getState().addJournalEntry({
            level: 'success',
            scope: 'order-detail:manual-text-direct',
            message: 'Manual text receipt dispatch completed',
            orderId: printOrder.id,
            orderNumber: printOrder.order_number,
            details: `printer=${resolvedPrintPrinter.deviceName} driver=${resolvedPrintPrinter.driver ?? 'epsonSdk'}`,
          });
          return;
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
        await onPrintImage(printOrder, image, resolvedPrintPrinter);
      } else {
        await onPrint(printOrder, printer);
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
      await onPrintCustomerCopyImage(printOrder, image, printer);
    } catch (error) {
      console.error('Failed to capture customer receipt:', error);
      Alert.alert('Print error', 'Failed to prepare the customer receipt.');
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
      await escposPrintDocument(document, printer);
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
    } finally {
      setIsCapturing(false);
    }
  };


  const renderActionButton = () => {
    if (!onQuickAction || !quickAction) return null;
    return (
      <PaperButton
        mode={isPhoneActionLayout ? 'outlined' : 'contained'}
        icon={quickAction.action === 'accept' ? 'check' : quickAction.action === 'prepare' ? 'chef-hat' : 'check-circle'}
        onPress={() => onQuickAction(order, quickAction.action)}
        loading={quickActionFeedback?.isUpdating}
        disabled={quickActionFeedback?.isUpdating}
        style={[styles.primaryActionButton, !isWide && styles.primaryActionButtonCompact, isPhoneActionLayout ? styles.phoneActionButton : null]}
        contentStyle={[styles.primaryActionButtonContent, isPhoneActionLayout ? styles.phoneActionButtonContent : null]}
        accessibilityLabel={quickAction.label}
      >
        {isPhoneActionLayout ? '' : (quickActionFeedback?.label ?? quickAction.label)}
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
      <View style={styles.container}>
        <View style={[styles.modalShell, forceFullScreen && styles.modalShellFullScreen]}>
        {/* Header */}
        <Surface 
          style={[
            styles.header, 
            { paddingTop: isWide ? 14 : Math.max(insets.top, 8) }
          ]} 
          elevation={1}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle}>Order {getFriendlyOrderNumber(order.order_number)}</Text>
              <Text style={styles.headerMeta}>{paymentSummary(order)}</Text>
            </View>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>
          <View style={styles.headerSub}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: paymentColor, marginLeft: 8 }]}>
              <Text style={styles.statusBadgeText}>{paymentLabel}</Text>
            </View>
            <Text style={styles.timeText}>{new Date(order.created_at).toLocaleString()}</Text>
          </View>
          {order.scheduled_pickup_at && (
            <View style={styles.scheduledInfo}>
              <MaterialCommunityIcons name="calendar-clock" size={16} color="#f97316" />
              <Text style={styles.scheduledText}>
                Scheduled Pickup: {new Date(order.scheduled_pickup_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
            </View>
          )}
        </Surface>

        <ScrollView style={styles.scrollContent} contentContainerStyle={[styles.scrollContainer, isWide && styles.scrollContainerWide]}>
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
              <Card style={[styles.infoCard, isWide && styles.summaryCard]}>
                <Card.Title title="Customer" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="account" />} />
                <Card.Content>
                  <TouchableOpacity
                    onPress={() => onCustomerPress(order)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.customerName}>{order.customer_name || 'N/A'}</Text>
                  </TouchableOpacity>
                  {!!order.customer_email && <Text style={styles.contactText}>{order.customer_email}</Text>}
                  {!!order.customer_phone && <Text style={styles.contactText}>{order.customer_phone}</Text>}
                </Card.Content>
              </Card>

              {order.order_type === 'delivery' ? (
                <Card style={[styles.infoCard, isWide && styles.summaryCard]}>
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

              <Card style={[styles.infoCard, isWide && styles.summaryCard]}>
                <Card.Title title="Totals" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="receipt" />} />
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
                  <Text style={[styles.totalLabel, { color: '#10b981' }]}>{promotionLabel}</Text>
                  <Text style={[styles.totalValue, { color: '#10b981' }]}>-${order.promotion_discount.toFixed(2)}</Text>
                </View>
              )}
              {order.coupon_discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#10b981' }]}>
                    {order.coupon_code ? `Coupon (${order.coupon_code})` : 'Coupon Discount'}
                  </Text>
                  <Text style={[styles.totalValue, { color: '#10b981' }]}>-${order.coupon_discount.toFixed(2)}</Text>
                </View>
              )}
              {rewardPointsUsed > 0 && rewardPointsValue > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#10b981' }]}>
                    Points Applied ({rewardPointsUsed.toLocaleString()} pts)
                  </Text>
                  <Text style={[styles.totalValue, { color: '#10b981' }]}>-${rewardPointsValue.toFixed(2)}</Text>
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
            <Card style={styles.infoCard}>
              <Card.Title
                title={`Items (${lineItemCount})`}
                titleStyle={styles.cardTitle}
                left={(props) => <IconButton {...props} icon="list-box" />}
              />
              <Card.Content>
                {orderOptions.map((option, index) => (
                  <View key={`order-option-${index}`} style={styles.optionRow}>
                    <MaterialCommunityIcons name="asterisk" size={16} color="#2563eb" />
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
              <Card style={[styles.infoCard, styles.instructionsCard]}>
                <Card.Title title="Instructions" titleStyle={styles.cardTitle} left={(props) => <IconButton {...props} icon="note-text" />} />
                <Card.Content>
                  <Text style={styles.instructionsText}>{orderNotes}</Text>
                </Card.Content>
              </Card>
            )}
            </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Bar */}
        <Surface 
          style={[
            styles.actionBar, 
            { paddingBottom: isWide ? 16 : Math.max(insets.bottom, 16) }
          ]} 
          elevation={4}
        >
          <View style={styles.secondaryActions}>
            <ManualPrintButton
              printers={availablePrinters}
              label="Print"
              icon="printer"
              loading={isCapturing}
              disabled={isCapturing}
              onSelectPrinter={handleInternalPrint}
              printModes={[
                { label: 'Kitchen', icon: 'chef-hat', onSelectPrinter: handleInternalPrint },
                { label: 'Customer Copy', icon: 'receipt-text-outline', disabled: !onPrintCustomerCopyImage, onSelectPrinter: handleCustomerCopyPrint },
                { label: 'Ticket', icon: 'ticket-confirmation-outline', onSelectPrinter: handleInstantTicketPrint },
              ]}
              mode={isPhoneActionLayout ? 'icon' : 'button'}
              style={isPhoneActionLayout ? styles.phoneActionIconButton : undefined}
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
                textColor="#ef4444"
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
                {isPhoneActionLayout ? '' : 'Cancel'}
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

        {/* Hidden Receipt Template for capture */}
        {captureTarget ? (
          <View style={styles.hiddenReceiptContainer} pointerEvents="none">
            {captureTarget === 'kitchen' ? (
              <View ref={receiptRef} collapsable={false}>
                <ReceiptTemplate
                  order={printPreviewOrder || order}
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
              <ActivityIndicator size="large" color="#2563eb" />
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
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2f6' },
  modalShell: { flex: 1, backgroundColor: '#eef2f6' },
  modalShellFullScreen: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  header: {
    paddingBottom: 18,
    backgroundColor: BRAND_COLORS.header,
    borderBottomWidth: 1,
    borderBottomColor: '#183457',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 20, paddingRight: 8 },
  headerTitleBlock: { flex: 1, paddingRight: 12 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#f8fafc' },
  headerMeta: { fontSize: 14, color: '#b9c8dd', fontWeight: '600', marginTop: 4 },
  headerSub: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 20, marginTop: 14, gap: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  timeText: { fontSize: 12, color: '#c8d5e6', marginLeft: 'auto', fontWeight: '700' },
  scheduledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 6,
  },
  scheduledText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffd089',
  },
  scrollContent: { flex: 1 },
  scrollContainer: { padding: 16, paddingBottom: 132 },
  scrollContainerWide: { padding: 18, paddingBottom: 96 },
  contentStack: { gap: 14 },
  orderDetailContent: { gap: 14 },
  orderDetailContentLandscape: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
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
    color: '#0f172a',
  },
  printFeedbackMessage: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  summaryGrid: { gap: 14 },
  summaryGridWide: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  summaryGridLandscape: { width: '33.333%', flexShrink: 0 },
  orderDetailPrimary: { gap: 14 },
  orderDetailPrimaryLandscape: { flex: 1, minWidth: 0 },
  summaryCard: { flex: 1, alignSelf: 'stretch' },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dde4ee',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#24364d' },
  customerName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  contactText: { fontSize: 14, color: '#4b5563', marginBottom: 2 },
  itemRow: { paddingVertical: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  optionText: { fontSize: 16, fontWeight: '900', color: '#10243f' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  itemPriceGroup: { alignItems: 'flex-end' },
  itemPriceFree: { fontSize: 16, fontWeight: 'bold', color: '#059669' },
  itemPriceOriginal: { fontSize: 12, color: '#6b7280', textDecorationLine: 'line-through' },
  itemComment: { fontSize: 14, color: '#b45309', fontStyle: 'italic', marginTop: 4 },
  addonsList: { marginTop: 4, paddingLeft: 12 },
  addonText: { fontSize: 13, color: '#6b7280' },
  removedText: { fontSize: 13, color: '#111827', fontWeight: 'bold' },
  divider: { marginTop: 12 },
  instructionsCard: { borderLeftWidth: 5, borderLeftColor: '#f59e0b' },
  instructionsText: { fontSize: 15, color: '#4b5563', lineHeight: 22 },
  deliveryStatusHeader: { marginBottom: 10 },
  deliveryStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deliveryStatusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  deliveryDetailText: { fontSize: 14, color: '#1f2937', fontWeight: '600', marginBottom: 6 },
  deliveryMetaText: { fontSize: 13, color: '#475569', marginBottom: 6 },
  deliveryTrackingLink: { fontSize: 14, color: '#2563eb', fontWeight: '700', marginBottom: 6 },
  deliveryInstructionsText: { marginTop: 4, fontSize: 14, color: '#374151', lineHeight: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  totalDivider: { marginVertical: 12 },
  finalTotalLabel: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  finalTotalValue: { fontSize: 24, fontWeight: '900', color: '#0f766e' },
  actionBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingHorizontal: 18, 
    paddingTop: 14,
    backgroundColor: '#fbfdff', 
    borderTopWidth: 1, 
    borderTopColor: '#d7dee7', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12 
  },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1 },
  actionButton: { borderRadius: 12, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  phoneActionButton: { flexGrow: 0, width: 40, minWidth: 0, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  phoneActionButtonContent: { width: 40, height: 40, marginHorizontal: 0 },
  phoneActionIconButton: { width: 40, height: 40, margin: 0, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, backgroundColor: '#fff' },
  primaryActionButton: { flexGrow: 1, minWidth: 0, borderRadius: 14, backgroundColor: '#10243f' },
  primaryActionButtonCompact: { flexGrow: 1 },
  primaryActionButtonContent: { height: 52 },
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
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  smartpayTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  smartpayText: {
    marginTop: 8,
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  smartpayAmount: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
});
