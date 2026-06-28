import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  getAllOrders,
  getOrder,
  releaseKitchenPrintClaim,
} from '@/lib/orders';
import type { Order } from '@my-small-business/types';
import { CustomerModal } from '@/components/CustomerModal';
import { LiveOrderListItem } from '@/components/LiveOrderListItem';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { loadAppSettings, DEFAULT_APP_SETTINGS, type AppSettings } from '@/lib/settings';
import { captureRef } from 'react-native-view-shot';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { escposPrintOrderImage } from '@/lib/escpos-printer';
import { getPrintDeviceId } from '@/lib/print-device';

export default function PreOrdersScreen() {
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ email?: string; phone?: string }>({});
  const [tempPrintingOrder, setTempPrintingOrder] = useState<Order | null>(null);
  const [tempPrintSource, setTempPrintSource] = useState<string | null>(null);
  const [tempPrintTicketIndex, setTempPrintTicketIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const globalReceiptRef = useRef(null);
  const appSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const printDeviceIdRef = useRef<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Fetch all pre-orders for the next 7 days
      const results = await getAllOrders();
      if (results.error) {
        Alert.alert('Error', results.error);
        return;
      }

      let allOrders = results.data || [];
      // Filter for pre-orders only (scheduled_pickup_at is set)
      // and not completed/cancelled/refunded
      const preOrders = allOrders.filter(
        (o) => 
          o.scheduled_pickup_at !== null &&
          o.order_status !== 'completed' &&
          o.order_status !== 'cancelled' &&
          o.payment_status !== 'refunded'
      ).sort((a, b) => {
        const timeA = new Date(a.scheduled_pickup_at!).getTime();
        const timeB = new Date(b.scheduled_pickup_at!).getTime();
        return timeA - timeB;
      });

      setOrders(preOrders);
    } catch (error) {
      console.error('Failed to load pre-orders:', error);
    } finally {
      setLoading(false);
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
  } = useOrderActions(appSettings, loadOrders, (updated) => {
    if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
  });

  const quickPrintOrder = async (order: Order) => {
    let claimedDeviceId: string | null = null;
    let shouldReleaseClaim = false;

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
        setOrders((prev) => prev.map((item) => (item.id === freshOrder.id ? freshOrder : item)));
        if (selectedOrder?.id === freshOrder.id) {
          setSelectedOrder(freshOrder);
        }
      } else if (latestOrderResult.error) {
        console.warn('[PreOrders] Failed to refresh order before printing:', latestOrderResult.error);
      }

      const s = appSettingsRef.current;
      setIsCapturing(true);
      setPrintingOrderId(order.id);
      
      // Update the hidden template with this order
      setTempPrintingOrder(freshOrder);
      setTempPrintSource('pre-orders:manual-list-print');
      const targetDots = s.printerPaperWidth === '58mm' ? 384 : 576;
      const scale = s.printerHighQuality ? 2 : 1;
      const ticketCopies = [{ key: 'combined' }];
      const imageUris: string[] = [];

      for (let ticketIndex = 0; ticketIndex < ticketCopies.length; ticketIndex++) {
        setTempPrintTicketIndex(ticketIndex);
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!globalReceiptRef.current) {
          throw new Error('Receipt template ref not found');
        }

        const uri = await captureRef(globalReceiptRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: targetDots * scale,
        });
        imageUris.push(uri);
      }

      if (s.printerSimulator) {
        setSimulatorOrder(freshOrder);
        setPrintImageUri(imageUris[0] || null);
        setPrintImageUris(imageUris);
        setShowSimulator(true);
        const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
        if (!completion.completed) {
          throw new Error(completion.error || 'Failed to complete kitchen print claim');
        }
        shouldReleaseClaim = false;
        return;
      }

      const selected = s.printerSaved.find((p) => p.target === s.printerSelectedTarget) || null;
      if (!s.printerEnabled || !selected) {
        Alert.alert('Printer error', 'Print is enabled, but no printer is selected.');
        return;
      }

      for (const uri of imageUris) {
        await escposPrintOrderImage(uri, selected, s.printerCopies, targetDots);
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
    }
  };

  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  useEffect(() => {
    loadAppSettings().then(setAppSettings);
    loadOrders();

    const subscription = supabase
      .channel('pre-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
    loadOrders();
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
          <PaperButton mode="contained" onPress={loadOrders} loading={loading} style={styles.refreshButton}>
            Refresh
          </PaperButton>
        </View>
      </Surface>

      <FlatList
        data={orders}
        renderItem={({ item }) => (
          <LiveOrderListItem
            order={item}
            nowMs={nowMs}
            updatingStatus={updatingStatus}
            onOrderPress={handleOrderPress}
            onCustomerPress={handleCustomerPress}
            onPrintPress={quickPrintOrder}
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
        visible={showSimulator}
        order={simulatorOrder}
        imageUri={printImageUri}
        imageUris={printImageUris}
        onClose={() => setShowSimulator(false)}
      />

      {/* Global Hidden Receipt Template for auto/quick capture */}
      <View style={styles.hiddenReceiptContainer} pointerEvents="none">
         {tempPrintingOrder && (
           <View ref={globalReceiptRef} collapsable={false}>
              <ReceiptTemplate
                order={tempPrintingOrder}
                width={appSettings.printerPaperWidth === '58mm' ? 384 : 576}
                printSource={tempPrintSource || undefined}
                showTicketCounter={appSettings.printerSimulator}
                onlyTicketIndex={tempPrintTicketIndex}
                duplicateBySections={false}
              />
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
