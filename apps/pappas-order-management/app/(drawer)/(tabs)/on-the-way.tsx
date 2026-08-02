import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button as PaperButton, Surface } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';

import { CustomerModal } from '@/components/CustomerModal';
import { HistoryOrderListItem } from '@/components/HistoryOrderListItem';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import {
  ON_THE_WAY_ORDERS_QUERY_KEY,
  useOnTheWayOrdersQuery,
} from '@/hooks/useLiveOrdersQuery';
import { useOrderActions } from '@/hooks/useOrderActions';
import { getOrder } from '@/lib/orders';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { isOnTheWayOrder } from '@/lib/live-order-window';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import type { Order } from '@my-small-business/types';

export default function OnTheWayScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ email?: string; phone?: string }>({});
  const { data: appSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
  const {
    data: orders = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useOnTheWayOrdersQuery();

  const refreshOrders = async () => {
    try {
      const result = await refetch();
      if (result.error) {
        Alert.alert('Error', result.error.message);
      }
    } finally {
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
    handleQuickAction,
    handlePrint,
    handlePrintImage,
  } = useOrderActions(appSettings, refreshOrders, (updated) => {
    setSelectedOrder((current) => (current?.id === updated.id ? updated : current));
  });

  const handleRefresh = () => {
    setRefreshing(true);
    void refreshOrders();
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

  const loadError = error instanceof Error ? error.message : null;

  return (
    <View style={styles.container}>
      <Surface style={styles.header} elevation={1}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>On the way</Text>
            <Text style={styles.headerSubtitle}>{orders.length} active delivery{orders.length === 1 ? '' : 'ies'}</Text>
          </View>
          <PaperButton
            mode="contained"
            onPress={handleRefresh}
            loading={isLoading || isFetching}
            style={styles.refreshButton}
          >
            Refresh
          </PaperButton>
        </View>
      </Surface>

      {loadError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Could not refresh deliveries: {loadError}</Text>
          <PaperButton mode="contained" onPress={handleRefresh}>Retry</PaperButton>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={({ item }) => (
            <HistoryOrderListItem
              order={item}
              onOrderPress={(order) => {
                setSelectedOrder(order);
                setShowOrderModal(true);
              }}
              onCustomerPress={handleCustomerPress}
            />
          )}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {isLoading ? (
                <ActivityIndicator size="large" color="#2563eb" />
              ) : (
                <Text style={styles.emptyText}>No deliveries are currently on the way.</Text>
              )}
            </View>
          }
        />
      )}

      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onOrderRefresh={(updatedOrder) => {
          setSelectedOrder(updatedOrder);
          queryClient.setQueryData<Order[]>(ON_THE_WAY_ORDERS_QUERY_KEY, (current = []) => (
            isOnTheWayOrder(updatedOrder)
              ? current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
              : current.filter((order) => order.id !== updatedOrder.id)
          ));
        }}
        onPrint={handlePrint}
        onPrintImage={handlePrintImage}
        onPrintCustomerCopyImage={handlePrintImage}
        availablePrinters={appSettings.printerSaved}
        onCustomerPress={handleCustomerPress}
        onStatusUpdate={handleStatusUpdate}
        onPaymentStatusUpdate={handlePaymentStatusUpdate}
        onQuickAction={handleQuickAction}
        updatingStatus={updatingStatus}
        showSimulator={showSimulator}
        setShowSimulator={setShowSimulator}
        simulatorOrder={simulatorOrder}
        printImageUri={printImageUri}
        simulatorImageLabels={printImageLabels}
        appSettings={appSettings}
      />

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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { marginTop: 2, fontSize: 12, fontWeight: '700', color: '#6b7280' },
  refreshButton: { borderRadius: 8 },
  listContent: { padding: 12, paddingBottom: 20, flexGrow: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: '#b91c1c', fontSize: 16, textAlign: 'center' },
});
