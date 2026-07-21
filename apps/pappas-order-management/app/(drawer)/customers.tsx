import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Appbar } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import type { Order } from '@my-small-business/types';
import { createCustomerProfile, getRecentCustomers, searchCustomers, Customer } from '@/lib/customers';
import { getOrder } from '@/lib/orders';
import { CustomerModal } from '@/components/CustomerModal';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { CustomerDirectoryList } from '@/components/customers/CustomerDirectoryList';
import { AddCustomerModal } from '@/components/customers/AddCustomerModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { DEFAULT_APP_SETTINGS, loadAppSettings, subscribeAppSettings, type AppSettings } from '@/lib/settings';
import { canAccessOrderManagement, isAdminUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 20;

export default function CustomersScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [canCreateCustomers, setCanCreateCustomers] = useState(false);
  const [canAdjustRewardPoints, setCanAdjustRewardPoints] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ email?: string; phone?: string } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const unsubscribe = subscribeAppSettings(setAppSettings);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadPermissions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      try {
        const [canAccess, isAdmin] = await Promise.all([
          canAccessOrderManagement(userId),
          isAdminUser(userId),
        ]);
        setCanCreateCustomers(canAccess);
        setCanAdjustRewardPoints(isAdmin);
      } catch (error) {
        console.error('Failed to load customer admin permissions:', error);
      }
    };

    void loadPermissions();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAppSettings().then(setAppSettings);
    }, [])
  );

  const loadCustomers = async (p: number, search: string, append = false) => {
    try {
      if (p === 0) setLoading(true);
      else setLoadingMore(true);

      const { data, error } = search.trim()
        ? await searchCustomers(search, p, PAGE_SIZE)
        : await getRecentCustomers(p, PAGE_SIZE);
      
      if (error) {
        console.error('Error fetching customers:', error);
      } else {
        const newData = data || [];
        setCustomers(prev => append ? [...prev, ...newData] : newData);
        setHasMore(newData.length === PAGE_SIZE);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const {
    updatingStatus,
    simulatorOrder,
    showSimulator,
    setShowSimulator,
    handleStatusUpdate,
    handlePaymentStatusUpdate,
    handleQuickAction,
    handlePrint,
    handlePrintImage,
    printImageUri,
  } = useOrderActions(
    appSettings,
    async () => {
      setPage(0);
      await loadCustomers(0, debouncedQuery, false);
    },
    (updated) => {
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
    }
  );

  // Trigger load on focus or search query change
  useFocusEffect(
    useCallback(() => {
      setPage(0);
      loadCustomers(0, debouncedQuery, false);
    }, [debouncedQuery])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(0);
    loadCustomers(0, debouncedQuery, false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadCustomers(nextPage, debouncedQuery, true);
    }
  };

  const handleCustomerPress = (customer: Customer) => {
    setSelectedCustomer({ email: customer.email, phone: customer.phone });
    setShowCustomerModal(true);
  };

  const handleCustomerPressFromOrder = (order: Order) => {
    setShowOrderModal(false);
    setSelectedCustomer({ email: order.customer_email, phone: order.customer_phone });
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

  const handleCreateCustomer = async (input: { name: string; email?: string; phone?: string }) => {
    setSavingCustomer(true);
    try {
      const result = await createCustomerProfile(input);
      if (result.error || !result.data) {
        Alert.alert('Add Customer', result.error || 'Failed to save customer');
        return;
      }

      setShowAddCustomerModal(false);
      setSearchQuery(result.data.name || result.data.email || result.data.phone);
      setDebouncedQuery(result.data.name || result.data.email || result.data.phone);
      await loadCustomers(0, result.data.name || '', false);
      setSelectedCustomer({ email: result.data.email, phone: result.data.phone });
      setShowCustomerModal(true);
      Alert.alert('Saved', 'Customer added successfully.');
    } finally {
      setSavingCustomer(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="Customers" titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="home" onPress={() => router.replace('/(drawer)/(tabs)/live-orders')} iconColor="#fff" />
      </Appbar.Header>

      <CustomerDirectoryList
        customers={customers}
        searchQuery={searchQuery}
        onChangeSearchQuery={setSearchQuery}
        onSelectCustomer={handleCustomerPress}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        headerActionLabel={canCreateCustomers ? 'New Customer' : undefined}
        onHeaderActionPress={canCreateCustomers ? () => setShowAddCustomerModal(true) : undefined}
      />

      {selectedCustomer && (
        <CustomerModal
          visible={showCustomerModal}
          email={selectedCustomer.email}
          phone={selectedCustomer.phone}
          onClose={() => setShowCustomerModal(false)}
          onOrderPress={handleOpenOrderFromCustomerModal}
          allowRewardAdjustments={canAdjustRewardPoints}
          onCustomerUpdated={() => void loadCustomers(0, debouncedQuery, false)}
        />
      )}

      <AddCustomerModal
        visible={showAddCustomerModal}
        saving={savingCustomer}
        onClose={() => setShowAddCustomerModal(false)}
        onSubmit={handleCreateCustomer}
      />

      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onPrint={handlePrint}
        onPrintImage={handlePrintImage}
        onPrintCustomerCopyImage={handlePrintImage}
        availablePrinters={appSettings.printerSaved}
        onCustomerPress={handleCustomerPressFromOrder}
        onStatusUpdate={handleStatusUpdate}
        onPaymentStatusUpdate={handlePaymentStatusUpdate}
        onQuickAction={handleQuickAction}
        updatingStatus={updatingStatus}
        showSimulator={showSimulator}
        setShowSimulator={setShowSimulator}
        simulatorOrder={simulatorOrder}
        printImageUri={printImageUri}
      />

      <PrintSimulatorModal
        visible={showSimulator && !showOrderModal}
        order={simulatorOrder}
        imageUri={printImageUri}
        onClose={() => setShowSimulator(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  appbar: {
    backgroundColor: '#2563eb',
  },
  appbarTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
