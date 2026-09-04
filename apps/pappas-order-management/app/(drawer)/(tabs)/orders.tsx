import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  Button as PaperButton,
  IconButton,
  Surface,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getRecentCustomers, searchCustomers, Customer } from '@/lib/customers';
import { CustomerModal } from '@/components/CustomerModal';
import { HistoryOrderListItem } from '@/components/HistoryOrderListItem';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { OrderFiltersModal } from '@/components/OrderFiltersModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { getAllOrders, getOrder } from '@/lib/orders';
import type { Order } from '@my-small-business/types';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { useOrderActions } from '@/hooks/useOrderActions';
import { getTodayDateString, formatDateToLocalISO, getPaymentStatType } from '@/utils/orderUtils';
import { useCustomerOrderCounts } from '@/hooks/useCustomerOrderCounts';

export default function HistoryScreen() {
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;
  const isNarrow = width < 420;
  const isTablet = width >= 600;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isFiltersModalVisible, setIsFiltersModalVisible] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ email?: string; phone?: string }>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'card' | 'cash' | 'marketplace'>('all');
  const [orderMethodFilter, setOrderMethodFilter] = useState<string>('all');
  const { data: appSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
  const { data: successfulOrderCounts } = useCustomerOrderCounts(orders);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const filters: { status?: string; payment_status?: string; date: string } = {
        date: selectedDate
      };
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (paymentFilter !== 'all') filters.payment_status = paymentFilter;

      const result = await getAllOrders(filters);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setOrders(result.data || []);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const {
    updatingStatus,
    simulatorOrder,
    showSimulator,
    setShowSimulator,
    printImageUri,
    printImageLabels,
    handleStatusUpdate,
    handlePaymentStatusUpdate,
    smartpayPaired,
    smartpayProcessingOrderId,
    handleSmartpayPayment,
    handleQuickAction,
    handlePrint,
    handlePrintImage,
  } = useOrderActions(appSettings, loadOrders, (updated) => {
    if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
  });

  useEffect(() => {
    loadOrders();
  }, [selectedDate, statusFilter, paymentFilter]);

  const quickStats = useMemo(() => {
    if (!orders.length) return null;
    let totalOrders = 0;
    let totalSales = 0;
    let totalCard = 0;
    let totalCash = 0;
    let totalMarketplace = 0;
    orders.forEach((order) => {
      if (order.payment_status === 'paid') {
        totalOrders++;
        totalSales += order.total;
        const paymentType = getPaymentStatType(order);
        if (paymentType === 'card') {
          totalCard += order.total;
        } else if (paymentType === 'marketplace') {
          totalMarketplace += order.total;
        } else {
          totalCash += order.total;
        }
      }
    });
    return { totalOrders, totalSales, totalCard, totalCash, totalMarketplace };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    
    // Payment method filter (Card/Cash) from top-level toggles
    if (paymentMethodFilter !== 'all') {
      result = result.filter((order) => getPaymentStatType(order) === paymentMethodFilter);
    }
    
    // Order source filter (Online/Store) from modal
    if (orderMethodFilter !== 'all') {
      result = result.filter((order) => order.payment_method === orderMethodFilter);
    }
    
    return result;
  }, [orders, paymentMethodFilter, orderMethodFilter]);

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setSelectedDate(getTodayDateString());
      return;
    }
    const date = new Date(selectedDate);
    if (direction === 'prev') {
      date.setDate(date.getDate() - 1);
    } else {
      date.setDate(date.getDate() + 1);
      if (date > new Date()) return;
    }
    setSelectedDate(formatDateToLocalISO(date));
  };

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && date) {
      setSelectedDate(formatDateToLocalISO(date));
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
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

      <Surface style={styles.header} elevation={1}>
        <View style={styles.headerTop}>
          <View style={styles.dateNavigation}>
            <IconButton icon="chevron-left" onPress={() => navigateDate('prev')} />
            <PaperButton mode="outlined" onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
              {selectedDate}
            </PaperButton>
            <IconButton
              icon="chevron-right"
              onPress={() => navigateDate('next')}
              disabled={selectedDate === getTodayDateString()}
            />
            <PaperButton mode="text" onPress={() => navigateDate('today')}>Today</PaperButton>
          </View>
          <View style={styles.headerActions}>
            <IconButton icon="filter-variant" onPress={() => setIsFiltersModalVisible(true)} />
            <PaperButton mode="contained" onPress={loadOrders} loading={loading} style={styles.refreshButton}>
              Refresh
            </PaperButton>
          </View>
        </View>

        {quickStats && (
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <TouchableOpacity 
                style={[
                  styles.statBox, 
                  paymentMethodFilter === 'all' && styles.statBoxActive
                ]} 
                onPress={() => setPaymentMethodFilter('all')}
              >
                <Text style={styles.statLabel}>Orders</Text>
                <Text style={styles.statValue}>{quickStats.totalOrders}</Text>
              </TouchableOpacity>
              
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Sales</Text>
                <Text style={styles.statValue}>${quickStats.totalSales.toFixed(2)}</Text>
              </View>

              <TouchableOpacity 
                style={[
                  styles.statBox, 
                  paymentMethodFilter === 'card' && styles.statBoxActive
                ]} 
                onPress={() => setPaymentMethodFilter(paymentMethodFilter === 'card' ? 'all' : 'card')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <MaterialCommunityIcons 
                    name="credit-card-outline" 
                    size={14} 
                    color={paymentMethodFilter === 'card' ? '#2563eb' : '#6b7280'} 
                  />
                  <Text style={[styles.statLabel, { marginBottom: 0 }]}>Card</Text>
                </View>
                <Text style={styles.statValue}>${quickStats.totalCard.toFixed(2)}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.statBox, 
                  paymentMethodFilter === 'cash' && styles.statBoxActive
                ]} 
                onPress={() => setPaymentMethodFilter(paymentMethodFilter === 'cash' ? 'all' : 'cash')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <MaterialCommunityIcons 
                    name="cash" 
                    size={14} 
                    color={paymentMethodFilter === 'cash' ? '#2563eb' : '#6b7280'} 
                  />
                  <Text style={[styles.statLabel, { marginBottom: 0 }]}>Cash</Text>
                </View>
                <Text style={styles.statValue}>${quickStats.totalCash.toFixed(2)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statBox,
                  paymentMethodFilter === 'marketplace' && styles.statBoxActive
                ]}
                onPress={() => setPaymentMethodFilter(paymentMethodFilter === 'marketplace' ? 'all' : 'marketplace')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <MaterialCommunityIcons
                    name="shopping-outline"
                    size={14}
                    color={paymentMethodFilter === 'marketplace' ? '#2563eb' : '#6b7280'}
                  />
                  <Text style={[styles.statLabel, { marginBottom: 0 }]}>Marketplace</Text>
                </View>
                <Text style={styles.statValue}>${quickStats.totalMarketplace.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Surface>

      <FlatList
        data={filteredOrders}
        renderItem={({ item }) => (
          <HistoryOrderListItem
            order={item}
            successfulOrderCount={successfulOrderCounts?.[item.id]}
            onOrderPress={(o) => { setSelectedOrder(o); setShowOrderModal(true); }}
            onCustomerPress={handleCustomerPress}
          />
        )}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No orders found for this date.</Text>
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
        onSmartpayPayment={handleSmartpayPayment}
        onQuickAction={handleQuickAction}
        updatingStatus={updatingStatus}
        smartpayPaired={smartpayPaired}
        smartpayProcessing={smartpayProcessingOrderId === selectedOrder?.id}
        showSimulator={showSimulator}
        setShowSimulator={setShowSimulator}
        simulatorOrder={simulatorOrder}
        printImageUri={printImageUri}
        appSettings={appSettings}
      />

      <OrderFiltersModal
        visible={isFiltersModalVisible}
        statusFilter={statusFilter}
        paymentFilter={paymentFilter}
        onStatusChange={setStatusFilter}
        onPaymentChange={setPaymentFilter}
        onApply={() => { setIsFiltersModalVisible(false); loadOrders(); }}
        onReset={() => { setStatusFilter('all'); setPaymentFilter('all'); setOrderMethodFilter('all'); }}
        onClose={() => setIsFiltersModalVisible(false)}
        orderMethodFilter={orderMethodFilter}
        onOrderMethodChange={setOrderMethodFilter}
      />

      <PrintSimulatorModal
        visible={showSimulator && !showOrderModal}
        order={simulatorOrder}
        imageUri={printImageUri}
        imageLabels={printImageLabels}
        onClose={() => setShowSimulator(false)}
      />

      {showDatePicker && (
        <DateTimePicker
          value={new Date(selectedDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}
      
      <CustomerModal
        visible={showCustomerModal}
        email={customerInfo.email}
        phone={customerInfo.phone}
        onClose={() => setShowCustomerModal(false)}
        onOrderPress={handleOpenOrderFromCustomerModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  dateNavigation: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  dateButton: { minWidth: 80, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  refreshButton: { borderRadius: 8 },
  statsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  statBox: { flex: 1, minWidth: 90, padding: 8, backgroundColor: '#f9fafb', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  statBoxActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  statLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2, textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#6b7280' },
});
