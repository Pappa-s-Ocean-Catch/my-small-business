import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { 
  Text, 
  Searchbar, 
  Surface, 
  Avatar, 
  IconButton,
  Card,
  useTheme,
  Appbar,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Order } from '@my-small-business/types';
import { getRecentCustomers, searchCustomers, Customer } from '@/lib/customers';
import { getOrder } from '@/lib/orders';
import { CustomerModal } from '@/components/CustomerModal';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { DEFAULT_APP_SETTINGS, loadAppSettings, subscribeAppSettings, type AppSettings } from '@/lib/settings';

const PAGE_SIZE = 20;

export default function CustomersScreen() {
  const theme = useTheme();
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '??';
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <Card 
      style={styles.card} 
      onPress={() => handleCustomerPress(item)}
      mode="contained"
    >
      <Card.Content style={styles.cardContent}>
        <Avatar.Text 
          size={48} 
          label={getInitials(item.name || 'Unknown')} 
          style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]} 
          labelStyle={{ color: theme.colors.onPrimaryContainer }}
        />
        <View style={styles.infoContainer}>
          <Text variant="titleMedium" style={styles.name}>{item.name || 'Unknown'}</Text>
          <Text variant="bodySmall" style={styles.contact}>{item.email || item.phone}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="cart-outline" size={14} color={theme.colors.secondary} />
              <Text variant="labelSmall" style={styles.statText}>{item.totalOrders} orders</Text>
            </View>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="currency-usd" size={14} color="#16a34a" />
              <Text variant="labelSmall" style={styles.statText}>
                ${(Number(item.totalSpent) || 0).toFixed(2)} spent
              </Text>
            </View>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="star-outline" size={14} color="#f59e0b" />
              <Text variant="labelSmall" style={styles.statText}>
                {item.rewardPoints || 0} pts
              </Text>
            </View>
          </View>
        </View>
        <IconButton icon="chevron-right" size={20} />
      </Card.Content>
    </Card>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="Customers" titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="home" onPress={() => router.replace('/(drawer)/(tabs)/live-orders')} iconColor="#fff" />
      </Appbar.Header>

      <Surface style={styles.searchSurface} elevation={1}>
        <Searchbar
          placeholder="Search customers..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          elevation={0}
        />
      </Surface>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.email + item.phone}
          renderItem={renderCustomerItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-search-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          }
        />
      )}

      {selectedCustomer && (
        <CustomerModal
          visible={showCustomerModal}
          email={selectedCustomer.email}
          phone={selectedCustomer.phone}
          onClose={() => setShowCustomerModal(false)}
          onOrderPress={handleOpenOrderFromCustomerModal}
        />
      )}

      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        onClose={() => setShowOrderModal(false)}
        onPrint={handlePrint}
        onPrintImage={handlePrintImage}
        onPrintCustomerCopyImage={handlePrintImage}
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
  searchSurface: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBar: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    color: '#1e293b',
  },
  contact: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#64748b',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
