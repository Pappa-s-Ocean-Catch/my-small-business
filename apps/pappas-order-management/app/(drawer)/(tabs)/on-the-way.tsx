import { appDialog as Alert } from '@/lib/app-dialog';
import { ActionButton as PaperButton } from '@/components/ui/ActionButton';
import { useOrderHeaderActions } from '@/components/navigation/order-header-actions';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { designTokens as t } from '@/lib/redesign';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

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
  const { width } = useWindowDimensions();
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

  useOrderHeaderActions({ onRefresh: handleRefresh, refreshing: isLoading || isFetching || refreshing });

  const loadError = error instanceof Error ? error.message : null;

  return (
    <View style={styles.container}>

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
          contentContainerStyle={[styles.listContent, { padding: width >= 1100 ? 16 : 12 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {isLoading ? (
                <ActivityIndicator size="large" color={t.color.primary} />
              ) : (
                <View style={{ alignItems: 'center', gap: 16 }}><View style={{ backgroundColor: t.color.primaryTint, padding: 24, borderRadius: 24 }}><MaterialCommunityIcons name="check" size={28} color={t.color.primary} /></View><Text style={{ fontSize: 24, fontWeight: '700', color: t.color.text }}>No deliveries on the way</Text><Text style={styles.emptyText}>No deliveries are currently on the way.</Text><PaperButton mode="outlined" onPress={handleRefresh} contentStyle={{ minHeight: 48 }}>Refresh</PaperButton></View>
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
  container: { flex: 1, backgroundColor: t.color.background },
  header: { padding: 24, paddingHorizontal: 28, backgroundColor: t.color.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: t.color.text },
  headerSubtitle: { marginTop: 2, fontSize: 14, fontWeight: '700', color: t.color.muted },
  refreshButton: { borderRadius: t.radius.control },
  listContent: { padding: 28, paddingBottom: 20, flexGrow: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: t.color.muted, textAlign: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: t.color.danger, fontSize: 16, textAlign: 'center' },
});
