import { appDialog as Alert } from '@/lib/app-dialog';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { ActionButton as PaperButton } from '@/components/ui/ActionButton';
import { useOrderHeaderActions } from '@/components/navigation/order-header-actions';
import { countActiveOrderFilters } from '@/components/orders/filter-state';
import { SearchField as Searchbar } from '@/components/ui';
import { getFriendlyOrderNumber } from '@/utils/orderNumber';
import { AsyncState } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, Platform, useWindowDimensions, TouchableOpacity, ScrollView } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { IconButton, Surface } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getRecentCustomers, searchCustomers, Customer } from '@/lib/customers';
import { CustomerModal } from '@/components/CustomerModal';
import { HistoryOrderListItem } from '@/components/HistoryOrderListItem';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { OrderFiltersModal } from '@/components/OrderFiltersModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { getAllOrders, getOrder } from '@/lib/orders';
import { buildCompletedOrderStats } from '@/lib/completed-order-stats';
import type { Order } from '@my-small-business/types';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { useOrderActions } from '@/hooks/useOrderActions';
import { getTodayDateString, formatDateToLocalISO, getPaymentStatType } from '@/utils/orderUtils';
import { useCustomerOrderCounts } from '@/hooks/useCustomerOrderCounts';

export default function HistoryScreen() {
  const { width, height } = useWindowDimensions();
  const isCompact = width < 600 || height < 500;

  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isFiltersModalVisible, setIsFiltersModalVisible] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ email?: string; phone?: string }>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftDate, setDraftDate] = useState(new Date(selectedDate + 'T12:00:00'));
  const openDatePicker = () => { setDraftDate(new Date(selectedDate + 'T12:00:00')); setShowDatePicker(true); };
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
        setLoadError(result.error);
        Alert.alert('Error', result.error);
      } else {
        setLoadError(null);
        setOrders(result.data || []);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load orders');
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

  const quickStats = useMemo(
    () => orders.length ? buildCompletedOrderStats(orders) : null,
    [orders],
  );

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

    const query = searchQuery.trim().replace(/^#/, '').toLowerCase();
    return query ? result.filter((order) => [order.order_number, getFriendlyOrderNumber(order.order_number), order.customer_name, order.customer_email, order.customer_phone].some((value) => value?.toLowerCase().includes(query))) : result;
  }, [orders, paymentMethodFilter, orderMethodFilter, searchQuery]);

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
    if (event.type === 'set' && date) setDraftDate(date);
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

  useOrderHeaderActions({
    onRefresh: handleRefresh,
    refreshing: loading || refreshing,
    onToggleFilters: () => setFiltersExpanded((value) => !value),
    filtersExpanded,
    activeFilterCount: countActiveOrderFilters({ status: statusFilter, payment: paymentFilter, method: paymentMethodFilter, source: orderMethodFilter, search: searchQuery.trim() || 'all' }),
  });

  return (
    <View style={styles.container}>

      <Surface style={[styles.header, isCompact && styles.compactHeader]} elevation={0}>
        <View style={styles.headerTop}>
          <View style={[styles.dateNavigation, isCompact && styles.compactDateNavigation]}>
            {isCompact ? <>
              <IconButton icon="chevron-left" accessibilityLabel="Previous day" onPress={() => navigateDate('prev')} style={styles.dateArrow} />
              <PaperButton mode="outlined" accessibilityLabel="Choose order date" onPress={openDatePicker} style={styles.compactDateButton} contentStyle={styles.compactDateContent} labelStyle={styles.compactDateLabel}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
              </PaperButton>
              <IconButton icon="chevron-right" accessibilityLabel="Next day" onPress={() => navigateDate('next')} disabled={selectedDate === getTodayDateString()} style={styles.dateArrow} />
            </> : <>
            <PaperButton mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => navigateDate('prev')}>‹ Previous</PaperButton>
            <PaperButton mode="outlined" onPress={openDatePicker} style={styles.dateButton}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
            </PaperButton>
            <PaperButton mode="outlined" contentStyle={{ minHeight: 48 }}
              onPress={() => navigateDate('next')}
              disabled={selectedDate === getTodayDateString()}
            >Next ›</PaperButton>
            </>}
            {!isCompact && filtersExpanded && <PaperButton mode="text" onPress={() => navigateDate('today')}>Today</PaperButton>}
          </View>
          {filtersExpanded && <View style={styles.headerActions}>
            {isCompact && <PaperButton mode="text" onPress={() => navigateDate('today')}>Today</PaperButton>}
            <PaperButton mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => setIsFiltersModalVisible(true)}>More filters</PaperButton>

          </View>}
        </View>

        {isCompact && quickStats && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.compactStats} contentContainerStyle={styles.compactStatsRow}>
          {[
            { label: 'Paid orders', value: String(quickStats.totalOrders), method: 'all' as const },
            { label: 'Net sales', value: `$${quickStats.totalNetSales.toFixed(2)}` },
            { label: 'Card (gross)', value: `$${quickStats.totalCard.toFixed(2)}`, method: 'card' as const },
            { label: 'Cash (gross)', value: `$${quickStats.totalCash.toFixed(2)}`, method: 'cash' as const },
            ...(filtersExpanded ? [{ label: 'Market (gross)', value: `$${quickStats.totalMarketplace.toFixed(2)}`, method: 'marketplace' as const }] : []),
          ].map((stat) => stat.method === undefined ? <View key={stat.label} style={[styles.compactStatBox, { width: (width - 36) / 4 }]}>
            <Text numberOfLines={1} style={styles.compactStatLabel}>{stat.label}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.compactStatValue}>{stat.value}</Text>
          </View> : <TouchableOpacity key={stat.label} accessibilityRole="button" accessibilityLabel={`${stat.label}, ${stat.value}`} accessibilityState={{ selected: paymentMethodFilter === stat.method }} onPress={() => setPaymentMethodFilter(paymentMethodFilter === stat.method ? 'all' : stat.method!)} style={[styles.compactStatBox, { width: (width - 36) / 4 }, paymentMethodFilter === stat.method && styles.statBoxActive]}>
            <Text numberOfLines={1} style={styles.compactStatLabel}>{stat.label}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.compactStatValue}>{stat.value}</Text>
          </TouchableOpacity>)}
        </ScrollView>}

        {!isCompact && quickStats && (
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <TouchableOpacity
                style={styles.statBox}
                onPress={() => setPaymentMethodFilter('all')}
              >
                <Text style={styles.statLabel}>Paid orders</Text>
                <Text style={styles.statValue}>{quickStats.totalOrders}</Text>
              </TouchableOpacity>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Net sales</Text>
                <Text style={styles.statValue}>${quickStats.totalNetSales.toFixed(2)}</Text>
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
                    color={paymentMethodFilter === 'card' ? t.color.primary : t.color.muted}
                  />
                  <Text style={[styles.statLabel, { marginBottom: 0 }]}>Card (gross)</Text>
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
                    color={paymentMethodFilter === 'cash' ? t.color.primary : t.color.muted}
                  />
                  <Text style={[styles.statLabel, { marginBottom: 0 }]}>Cash (gross)</Text>
                </View>
                <Text style={styles.statValue}>${quickStats.totalCash.toFixed(2)}</Text>
              </TouchableOpacity>

              {filtersExpanded && (              <TouchableOpacity
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
                    color={paymentMethodFilter === 'marketplace' ? t.color.primary : t.color.muted}
                  />
                  <Text style={[styles.statLabel, { marginBottom: 0 }]}>Marketplace (gross)</Text>
                </View>
                <Text style={styles.statValue}>${quickStats.totalMarketplace.toFixed(2)}</Text>
              </TouchableOpacity>)}
            </View>
          </View>
        )}
      </Surface>

      <Searchbar placeholder="Search order or customer" value={searchQuery} onChangeText={setSearchQuery} style={isCompact ? styles.compactSearch : styles.search} />
      <View style={[styles.listFrame, isCompact && styles.compactListFrame, filteredOrders.length > 0 && styles.populatedListFrame]}><FlatList
        data={filteredOrders}
        renderItem={({ item }) => (
          <HistoryOrderListItem
            compact
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
          <AsyncState icon={loadError ? 'alert-circle-outline' : 'check'} loading={loading} title={loading ? 'Loading order history' : loadError ? 'Order history unavailable' : searchQuery.trim() ? 'No matching orders' : 'No orders for this date'} description={loadError || (searchQuery.trim() ? 'Try another order number or customer.' : 'Change date or clear filters to find orders.')} retryLabel={loadError ? 'Retry' : 'Change date'} retryMode={loadError ? 'outlined' : 'contained'} onRetry={loadError ? () => void loadOrders() : openDatePicker} />
        }
      /></View>

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

      <EditorSheet visible={showDatePicker} title="Choose date" onDismiss={() => setShowDatePicker(false)} footer={<><PaperButton mode="outlined" onPress={() => setShowDatePicker(false)}>Cancel</PaperButton><PaperButton mode="contained" onPress={() => { setSelectedDate(formatDateToLocalISO(draftDate)); setShowDatePicker(false); }}>Apply date</PaperButton></>}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><PaperButton mode="outlined" onPress={() => setDraftDate(new Date())}>Today</PaperButton><PaperButton mode="outlined" onPress={() => { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); setDraftDate(yesterday); }}>Yesterday</PaperButton></View>
        {showDatePicker && <DateTimePicker value={draftDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onDateChange} maximumDate={new Date()} />}
      </EditorSheet>

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
  container: { flex: 1, backgroundColor: t.color.background },
  compactHeader: { paddingHorizontal: 12, paddingVertical: 4 },
  compactDateNavigation: { flex: 1, flexWrap: 'nowrap', gap: 4 },
  dateArrow: { margin: 0, width: 44, height: 44 },
  compactDateButton: { flex: 1, minWidth: 0 },
  compactDateContent: { minHeight: 44 },
  compactDateLabel: { fontSize: 14, marginHorizontal: 8 },
  compactStats: { marginTop: 4 },
  compactStatsRow: { flexGrow: 1, gap: 4 },
  compactStatBox: { flexShrink: 0, minWidth: 0, minHeight: 56, padding: 6, borderWidth: 1, borderColor: t.color.border, borderRadius: 8, backgroundColor: t.color.surface, justifyContent: 'center', gap: 4 },
  compactStatLabel: { fontSize: 10, color: t.color.muted },
  compactStatValue: { fontSize: 12, fontWeight: '700', color: t.color.text, fontVariant: ['tabular-nums'] },
  search: { marginHorizontal: 16, marginTop: 8, marginBottom: 16 },
  compactSearch: { marginHorizontal: 12, marginVertical: 4, height: 44 },
  compactListFrame: { marginHorizontal: 12, marginBottom: 8 },
  header: { padding: 12, paddingHorizontal: 16, backgroundColor: t.color.background },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  dateNavigation: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  dateButton: { minWidth: 80, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  refreshButton: { borderRadius: t.radius.control },
  statsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.color.background },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
  statBox: { flex: 1, minWidth: 120, minHeight: 110, padding: 18, backgroundColor: t.color.surface, borderRadius: t.radius.card, alignItems: 'flex-start', justifyContent: 'center', borderWidth: 1, borderColor: t.color.border },
  statBoxActive: { borderColor: t.color.primary },
  statLabel: { fontSize: 14, color: t.color.muted, marginBottom: 6 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: t.color.text },
  listFrame: { flex: 1, marginHorizontal: 16, marginBottom: 16 },
  populatedListFrame: { borderWidth: 1, borderColor: t.color.border, borderRadius: 16, overflow: 'hidden', backgroundColor: t.color.surface },
  listContent: { flexGrow: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: t.color.muted },
});
